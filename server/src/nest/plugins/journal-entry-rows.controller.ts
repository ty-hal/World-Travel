import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { db } from '../../db/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { pluginsEnabled } from './kill-switch';
import { PluginRuntimeService } from './plugin-runtime.service';
import { stripEmoji } from './text-sanitize';
import { canAccessJourney } from '../../services/journeyService';

interface JournalEntryItem {
  label: string;
  value?: string;
  url?: string;
}
interface ProviderResult {
  pluginId: string;
  items: JournalEntryItem[];
}

const MAX_ITEMS = 12;
const cap = (value: unknown, length: number): string => stripEmoji(String(value ?? '')).slice(0, length);

function safeUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    const url = new URL(raw);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? raw.slice(0, 2048) : undefined;
  } catch {
    return undefined;
  }
}

function normalize(raw: unknown): JournalEntryItem[] {
  const list = Array.isArray(raw) ? raw as Array<Record<string, unknown>> : [];
  const items: JournalEntryItem[] = [];
  for (const row of list) {
    if (items.length >= MAX_ITEMS) break;
    if (!row || typeof row !== 'object') continue;
    const label = cap(row.label, 60);
    if (!label) continue;
    items.push({
      label,
      value: row.value != null ? cap(row.value, 200) : undefined,
      url: safeUrl(row.url),
    });
  }
  return items;
}

/** Extra rows under a journal entry are additive and never delay or break core content. */
@Controller('api/journal-entry-rows')
@UseGuards(JwtAuthGuard)
export class JournalEntryRowsController {
  constructor(private readonly runtime: PluginRuntimeService) {}

  @Get(':entryId')
  async get(
    @Param('entryId') entryIdRaw: string,
    @Req() req: Request & { user?: { id: number } },
  ): Promise<{ providers: ProviderResult[] }> {
    if (!pluginsEnabled()) return { providers: [] };
    const entryId = Number(entryIdRaw);
    const userId = req.user?.id;
    if (!Number.isSafeInteger(entryId) || entryId < 1 || userId == null) return { providers: [] };

    const entry = db.prepare(`
      SELECT je.journey_id
      FROM journey_entries je
      WHERE je.id = ?
    `).get(entryIdRaw) as { journey_id: number } | undefined;
    if (!entry || !canAccessJourney(entry.journey_id, userId)) return { providers: [] };

    const providers = this.runtime.providersOf('journalEntryProvider');
    const results = await Promise.all(providers.map(async (pluginId): Promise<ProviderResult | null> => {
      try {
        const raw = await this.runtime.invokeHook(
          pluginId,
          'journalEntryProvider',
          'getRows',
          [entryId],
          userId,
          5000,
        );
        const items = normalize(raw);
        return items.length ? { pluginId, items } : null;
      } catch {
        return null;
      }
    }));
    return { providers: results.filter((result): result is ProviderResult => result !== null) };
  }
}
