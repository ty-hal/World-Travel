#!/usr/bin/env node
/**
 * Import travel itinerary collections from travel-collections-data.mjs into Trek.
 *
 * Usage (server must be running, collections addon enabled):
 *   TREK_EMAIL=you@example.com TREK_PASSWORD=secret node scripts/import-travel-collections.mjs
 *
 * Options:
 *   --dry-run       Print what would be created without calling the API
 *   --skip-existing Skip collections whose name already exists
 *   --enable-addon  Enable the collections addon via admin API if disabled
 *   --dev           Use /api/auth/dev-login (local development only)
 *   --update-links  Patch links on existing collections matched by name
 *
 * Env:
 *   TREK_URL        Base URL (default http://localhost:3001)
 *   TREK_EMAIL      Login email (required unless --dry-run)
 *   TREK_PASSWORD   Login password (required unless --dry-run)
 */

import { travelCollections } from './travel-collections-data.mjs';

const BASE = process.env.TREK_URL || 'http://localhost:3001';
const EMAIL = process.env.TREK_EMAIL;
const PASSWORD = process.env.TREK_PASSWORD;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const skipExisting = args.has('--skip-existing');
const enableAddon = args.has('--enable-addon');
const useDevLogin = args.has('--dev') || process.env.TREK_DEV === '1';
const updateLinks = args.has('--update-links');

async function api(path, { method = 'GET', body, token, cookie } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function login() {
  if (useDevLogin) {
    const data = await api('/api/auth/dev-login', { method: 'POST', body: {} });
    if (!data.token) throw new Error('Dev login succeeded but no token returned');
    return data.token;
  }
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set TREK_EMAIL and TREK_PASSWORD, or pass --dev for local dev-login');
  }
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD, remember_me: true },
  });
  if (!data.token) throw new Error('Login succeeded but no token returned');
  return data.token;
}

async function ensureCollectionsAddon(token) {
  try {
    await api('/api/addons/collections', { token });
    return;
  } catch (err) {
    if (!enableAddon) {
      throw new Error(
        `${err.message}\nCollections addon may be disabled. Re-run with --enable-addon (admin account required).`,
      );
    }
  }

  const { addons } = await api('/api/admin/addons', { token });
  const coll = addons?.find((a) => a.id === 'collections');
  if (coll?.enabled) return;

  console.log('Enabling collections addon…');
  await api('/api/admin/addons/collections', {
    method: 'PUT',
    token,
    body: { enabled: true },
  });
}

async function listExistingCollections(token) {
  try {
    const data = await api('/api/addons/collections', { token });
    return data.collections || [];
  } catch {
    return [];
  }
}

async function listExistingNames(token) {
  const collections = await listExistingCollections(token);
  return new Set(collections.map((c) => c.name));
}

async function updateCollectionLinks(token, id, links) {
  await api(`/api/addons/collections/${id}`, {
    method: 'PATCH',
    token,
    body: { links },
  });
}

async function createCollection(token, def) {
  const created = await api('/api/addons/collections', {
    method: 'POST',
    token,
    body: {
      name: def.name,
      description: def.description,
      color: def.color,
      links: def.links,
    },
  });
  const id = created.id ?? created.collection?.id;
  if (!id) throw new Error(`No collection id in response for "${def.name}"`);
  return id;
}

async function addPlace(token, collectionId, place) {
  await api('/api/addons/collections/places', {
    method: 'POST',
    token,
    body: {
      collection_id: collectionId,
      name: place.name,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      notes: place.notes ?? null,
      status: place.status ?? 'want',
      force: true,
    },
  });
}

async function main() {
  console.log(`Trek import — ${travelCollections.length} collections, base ${BASE}`);

  if (dryRun) {
    for (const c of travelCollections) {
      console.log(`\n[${c.name}] ${c.places.length} places`);
      console.log(`  ${c.description}`);
      for (const link of c.links ?? []) {
        console.log(`  → ${link.label}: ${link.url}`);
      }
      for (const p of c.places) {
        const coords = p.lat != null ? ` (${p.lat}, ${p.lng})` : '';
        console.log(`  · ${p.name}${coords} [${p.status ?? 'want'}]`);
      }
    }
    console.log('\nDry run complete — no API calls made.');
    return;
  }

  const token = await login();
  console.log('Logged in.');

  await ensureCollectionsAddon(token);

  if (updateLinks) {
    const byName = new Map((await listExistingCollections(token)).map((c) => [c.name, c]));
    let updated = 0;
    let missing = 0;
    for (const def of travelCollections) {
      const existing = byName.get(def.name);
      if (!existing) {
        console.log(`Missing collection: ${def.name}`);
        missing++;
        continue;
      }
      await updateCollectionLinks(token, existing.id, def.links);
      const urls = (def.links ?? []).map((l) => l.url).join(', ');
      console.log(`Updated links: ${def.name} → ${urls}`);
      updated++;
    }
    console.log(`\nFinished: ${updated} collections updated, ${missing} not found.`);
    return;
  }

  const existing = skipExisting ? await listExistingNames(token) : new Set();
  let created = 0;
  let skipped = 0;
  let placesAdded = 0;

  for (const def of travelCollections) {
    if (skipExisting && existing.has(def.name)) {
      console.log(`Skip (exists): ${def.name}`);
      skipped++;
      continue;
    }

    process.stdout.write(`Creating "${def.name}" (${def.places.length} places)… `);
    const collectionId = await createCollection(token, def);
    for (const place of def.places) {
      await addPlace(token, collectionId, place);
      placesAdded++;
    }
    console.log(`done (id ${collectionId})`);
    created++;
  }

  console.log(`\nFinished: ${created} collections created, ${placesAdded} places added, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
