// Portable snapshots: data stays in the URL fragment or an exported file; no server required.
const MAX_BYTES = 2_000_000;
const MAX_LINK = 60_000;
const TYPES = new Set(['post', 'shot', 'doc', 'note', 'folder', 'clip']);
const KINDS = new Set(['connects', 'contradicts', 'money', 'verified', 'changed', 'origin']);
const text = x => typeof x === 'string';
const list = (x, check) => Array.isArray(x) && x.length <= 2000 && x.every(check);
export function validateSnapshot(value) {
  const b = value?.board;
  if (value?.version !== 1 || !b || !text(b.title) || !text(b.id) || !list(b.nodes, n => n && text(n.id) && TYPES.has(n.type) && text(n.title) && Number.isFinite(n.x) && Number.isFinite(n.y))) throw new Error('This is not a supported Paper Trail board.');
  const ids = new Set(b.nodes.map(n => n.id));
  if (ids.size !== b.nodes.length || !list(b.strings, s => s && ids.has(s.from) && ids.has(s.to) && KINDS.has(s.kind))) throw new Error('This board has invalid source connections.');
  for (const n of b.nodes) {
    for (const key of ['body', 'agent', 'platform', 'handle', 'date', 'stats', 'outlet', 'stamp', 'color', 'versionsOf']) if (n[key] != null && !text(n[key])) throw new Error('Invalid source details.');
    if (n.w != null && (!Number.isFinite(n.w) || n.w < 1 || n.w > 2000)) throw new Error('Invalid source width.');
    if (n.rot != null && !Number.isFinite(n.rot)) throw new Error('Invalid source rotation.');
    if (n.files && !list(n.files, f => f && text(f.t) && text(f.d))) throw new Error('Invalid source files.');
    if (n.versions && !list(n.versions, v => v && text(v.v) && text(v.d) && (v.why == null || text(v.why)) && list(v.clauses, c => c && text(c.k) && text(c.t)))) throw new Error('Invalid document versions.');
    if (n.type === 'shot' && (!text(n.img) || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(n.img))) throw new Error('Unsupported screenshot format.');
    const c = n.checks;
    if (c != null && (typeof c !== 'object' || Array.isArray(c))) throw new Error('Invalid source assessment.');
    if (c?.context != null && !text(c.context)) throw new Error('Invalid source context.');
    if (c?.validity && (!['verified','partial','contradicted','unverified'].includes(c.validity.verdict) || !text(c.validity.note))) throw new Error('Invalid evidence assessment.');
    if (c?.bias && (!Number.isFinite(c.bias.lean) || Math.abs(c.bias.lean) > 2 || !text(c.bias.label) || !text(c.bias.note))) throw new Error('Invalid framing assessment.');
    if (c?.origin && (!list(c.origin.chain, text) || !text(c.origin.note))) throw new Error('Invalid source chain.');
  }
  for (const key of ['question', 'created', 'category', 'location']) if (b[key] != null && !text(b[key])) throw new Error('Invalid board information.');
  for (const s of b.strings) if ((s.label != null && !text(s.label)) || (s.ev != null && !text(s.ev))) throw new Error('Invalid connection explanation.');
  for (const [key, check] of [['summary', x => x && text(x.h) && text(x.p)], ['qa', x => x && text(x.q) && text(x.a)], ['timeline', x => x && text(x.d) && text(x.t)], ['log', text]]) {
    if (b[key] != null && !list(b[key], check)) throw new Error('Invalid board details.');
  }
  return b;
}
export function snapshotJSON(board) {
  const value = { version: 1, board };
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > MAX_BYTES) throw new Error('This board is too large to share. Remove some uploaded images and try again.');
  validateSnapshot(value);
  return json;
}
export function parseSnapshot(json) {
  if (new TextEncoder().encode(json).length > MAX_BYTES) throw new Error('This board exceeds the 2 MB sharing limit.');
  try { return validateSnapshot(JSON.parse(json)); } catch (e) { throw new Error(e instanceof SyntaxError ? 'The board file could not be read.' : e.message); }
}
async function readLimited(stream) {
  const reader = stream.getReader(), chunks = []; let size = 0;
  try { for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES) { await reader.cancel(); throw new Error('This board exceeds the 2 MB sharing limit.'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  chunks.forEach(c => { bytes.set(c, offset); offset += c.length; }); return bytes;
}
export async function createShareURL(board, base = location.href) {
  const bytes = new TextEncoder().encode(snapshotJSON(board));
  const compressed = typeof CompressionStream !== 'undefined';
  const result = compressed ? await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))) : bytes;
  let binary = ''; result.forEach(b => { binary += String.fromCharCode(b); });
  const encoded = btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '');
  const url = new URL(base); url.hash = `board=${compressed ? 'gz' : 'raw'}.${encoded}`;
  if (url.href.length > MAX_LINK) throw new Error('This board is too large for a link. Download the board file instead.');
  return url.href;
}
export async function readShareURL(hash) {
  if (!hash.startsWith('#board=')) return null;
  if (hash.length > MAX_LINK) throw new Error('This board link is too large. Ask for a board file instead.');
  const match = hash.match(/^#board=(gz|raw)\.([A-Za-z0-9_-]+)$/);
  if (!match) throw new Error('This board link is invalid or incomplete.');
  const bytes = Uint8Array.from(atob(match[2].replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0));
  if (match[1] === 'gz' && typeof DecompressionStream === 'undefined') throw new Error('Open this link in a newer browser, or ask for a board file.');
  const decoded = match[1] === 'gz' ? await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))) : bytes;
  return parseSnapshot(new TextDecoder().decode(decoded));
}
