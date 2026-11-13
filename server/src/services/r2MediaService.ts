import fs from 'node:fs';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { Jimp, JimpMime } from 'jimp';

const apiToken = () => process.env.CLOUDFLARE_API_TOKEN;
const accountId = () => process.env.CLOUDFLARE_ACCOUNT_ID;
const bucket = () => process.env.R2_BUCKET_NAME || 'world-travel-media';
const apiBase = () => `https://api.cloudflare.com/client/v4/accounts/${accountId()}/r2/buckets/${bucket()}/objects`;

function configured() {
  if (!apiToken() || !accountId()) throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in server/.env to connect R2.');
}

function validKey(key: string) {
  return key.startsWith('trips/') && !key.includes('..') && !key.includes('\\') && !key.startsWith('/') && key.length <= 1024;
}

async function r2Fetch(url: string, init?: RequestInit, allowNotFound = false) {
  configured();
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${apiToken()}`, ...init?.headers } });
  if (!response.ok && response.status !== 304 && !(allowNotFound && response.status === 404)) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Cloudflare R2 request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  return response;
}

export async function listR2Media(prefix: string, cursor?: string) {
  configured();
  if (!prefix.startsWith('trips/') || !prefix.endsWith('/') || !validKey(prefix) || (cursor && cursor.length > 4096)) throw new Error('Invalid trip media prefix or cursor');
  const url = new URL(apiBase());
  url.searchParams.set('prefix', prefix);
  url.searchParams.set('delimiter', '/');
  url.searchParams.set('per_page', '100');
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await r2Fetch(url.toString());
  const data = await response.json() as {
    result?: { key?: string; size?: number; etag?: string; http_metadata?: { contentType?: string }; last_modified?: string }[];
    result_info?: { delimited?: string[]; is_truncated?: boolean; cursor?: string };
  };
  return {
    objects: (data.result || []).filter(item => item.key && validKey(item.key)).map(item => ({
      key: item.key!,
      size: item.size || 0,
      etag: item.etag || '',
      contentType: item.http_metadata?.contentType || '',
      uploaded: item.last_modified || '',
    })),
    prefixes: data.result_info?.delimited || [],
    cursor: data.result_info?.is_truncated ? data.result_info.cursor : undefined,
  };
}

export async function uploadR2Media(key: string, contentType: string, filePath: string) {
  configured();
  if (!validKey(key) || !/^(?:image\/(?!svg\+xml$)[a-z0-9.+-]+|video\/[a-z0-9.+-]+)$/i.test(contentType)) throw new Error('Invalid media upload');
  const body = Readable.toWeb(fs.createReadStream(filePath));
  return r2Fetch(`${apiBase()}/${key.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
    duplex: 'half',
  } as RequestInit);
}

export async function getR2MediaThumbnail(key: string, version: string) {
  // shortcut: versioned previews stay in R2 after an object is replaced; add lifecycle cleanup if replacements become common.
  const hash = createHash('sha256').update(`${key}:${version}`).digest('hex');
  const thumbKey = `${key.slice(0, key.lastIndexOf('/') + 1)}.thumbnails/${hash}.jpg`;
  const cached = await r2Fetch(`${apiBase()}/${thumbKey.split('/').map(encodeURIComponent).join('/')}`, undefined, true);
  if (cached.ok) return cached;
  await cached.arrayBuffer();

  const source = await getR2Object(key);
  const image = await Jimp.read(Buffer.from(await source.arrayBuffer()));
  image.scaleToFit({ w: 480, h: 480 });
  const thumbnail = await image.getBuffer(JimpMime.jpeg, { quality: 78 });
  await r2Fetch(`${apiBase()}/${thumbKey.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': JimpMime.jpeg },
    body: Readable.toWeb(Readable.from(thumbnail)),
    duplex: 'half',
  } as RequestInit);
  return getR2Object(thumbKey);
}

export async function getR2Object(key: string, ifNoneMatch?: string) {
  configured();
  if (!validKey(key)) throw new Error('Invalid media key');
  return r2Fetch(`${apiBase()}/${key.split('/').map(encodeURIComponent).join('/')}`, ifNoneMatch ? { headers: { 'If-None-Match': ifNoneMatch } } : undefined);
}
