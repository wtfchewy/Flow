import * as Y from 'yjs';
import { loadNote } from '../storage/persistence';
import { isTauri } from '../platform';
import type { NoteMeta } from '../types';

export interface SearchResult {
  noteId: string;
  title: string;
  preview: string;
  score: number;
  matchSnippet: string;
  matchBlockId?: string;
  matchMode?: 'page' | 'edgeless';
  updatedAt: number;
}

// Lazy-loaded Tauri invoke
let _invoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

async function getInvoke() {
  if (_invoke) return _invoke;
  const mod = await import('@tauri-apps/api/core');
  _invoke = mod.invoke;
  return _invoke;
}

/**
 * Search notes — uses Rust backend on Tauri (single IPC call, parallel disk reads,
 * native Yjs parsing) or falls back to JS engine in browser.
 */
export async function searchNotes(
  query: string,
  notesMeta: NoteMeta[]
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  if (isTauri()) {
    return searchViaRust(query);
  }
  return searchViaJS(query, notesMeta);
}

// ===== Rust backend (Tauri) =====

interface RustSearchResult {
  noteId: string;
  title: string;
  score: number;
  snippet: string;
  matchBlockId: string | null;
  matchMode: string | null;
  updatedAt: number;
}

async function searchViaRust(query: string): Promise<SearchResult[]> {
  const invoke = await getInvoke();
  const results: RustSearchResult[] = await invoke('search_notes', { query });
  return results.map(r => ({
    noteId: r.noteId,
    title: r.title,
    preview: r.snippet,
    score: r.score,
    matchSnippet: r.snippet,
    matchBlockId: r.matchBlockId ?? undefined,
    matchMode: (r.matchMode as 'page' | 'edgeless') ?? undefined,
    updatedAt: r.updatedAt,
  }));
}

// ===== JS fallback (Browser) =====

const textCache = new Map<string, { text: string; tokens: string[] }>();

export async function preloadAllNotes(notesMeta: NoteMeta[]): Promise<void> {
  if (isTauri()) return; // Rust handles everything
  await Promise.all(notesMeta.map(async (meta) => {
    if (textCache.has(meta.id)) return;
    const data = await loadNote(meta.id);
    if (!data) {
      textCache.set(meta.id, {
        text: meta.title + '\n' + meta.preview,
        tokens: tokenize(meta.title + ' ' + meta.preview),
      });
    } else {
      const text = extractTextFromBlockSuiteDoc(data);
      textCache.set(meta.id, { text, tokens: tokenize(text) });
    }
  }));
}

function searchViaJS(query: string, notesMeta: NoteMeta[]): SearchResult[] {
  const queryTokens = tokenize(query);
  const results: SearchResult[] = [];

  for (const meta of notesMeta) {
    const cached = textCache.get(meta.id);
    if (!cached) continue;

    const score = computeScore(queryTokens, cached.tokens, cached.text, query, meta.title);
    if (score <= 0) continue;

    const daysSinceUpdate = (Date.now() - meta.updatedAt) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - daysSinceUpdate / 365);

    results.push({
      noteId: meta.id,
      title: meta.title || 'Untitled',
      preview: meta.preview,
      score: score + recencyBoost * 0.5,
      matchSnippet: findSnippet(cached.text, query),
      updatedAt: meta.updatedAt,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function clearSearchCache() {
  textCache.clear();
}

// ===== Text extraction (browser only) =====

function extractTextFromBlockSuiteDoc(data: Uint8Array): string {
  const ydoc = new Y.Doc();
  try { Y.applyUpdate(ydoc, data); } catch { return ''; }

  const blocksMap = ydoc.getMap('blocks');
  if (!blocksMap || blocksMap.size === 0) { ydoc.destroy(); return ''; }

  const texts: string[] = [];
  let rootId: string | null = null;

  blocksMap.forEach((value: unknown, key: string) => {
    if (!(value instanceof Y.Map)) return;
    if (value.get('sys:flavour') === 'affine:page') rootId = key;
  });

  if (rootId) {
    collectBlockText(blocksMap, rootId, texts);
  } else {
    blocksMap.forEach((value: unknown) => {
      if (value instanceof Y.Map) extractBlockText(value, texts);
    });
  }

  ydoc.destroy();
  return texts.join('\n');
}

function collectBlockText(blocksMap: Y.Map<unknown>, blockId: string, texts: string[]): void {
  const block = blocksMap.get(blockId);
  if (!(block instanceof Y.Map)) return;

  const flavour = block.get('sys:flavour');

  // Extract text from edgeless surface elements
  if (flavour === 'affine:surface') {
    extractSurfaceElements(block, texts);
  }

  extractBlockText(block, texts);
  const children = block.get('sys:children');
  if (children instanceof Y.Array) {
    children.forEach((childId: unknown) => {
      if (typeof childId === 'string') collectBlockText(blocksMap, childId, texts);
    });
  }
}

function extractSurfaceElements(surfaceBlock: Y.Map<unknown>, texts: string[]): void {
  // prop:elements is a Boxed wrapper: Y.Map { type: "...", value: Y.Map<elements> }
  const boxed = surfaceBlock.get('prop:elements');
  if (!(boxed instanceof Y.Map)) return;
  const elements = boxed.get('value');
  if (!(elements instanceof Y.Map)) return;

  elements.forEach((elemVal: unknown) => {
    if (!(elemVal instanceof Y.Map)) return;
    // "text" — shapes, text elements, connector labels
    const text = elemVal.get('text');
    if (text instanceof Y.Text) {
      const s = text.toString().trim();
      if (s) texts.push(s);
    }
    // "title" — groups, frames
    const title = elemVal.get('title');
    if (title instanceof Y.Text) {
      const s = title.toString().trim();
      if (s) texts.push(s);
    }
  });
}

function extractBlockText(block: Y.Map<unknown>, texts: string[]): void {
  for (const key of ['prop:title', 'prop:text', 'prop:caption']) {
    const val = block.get(key);
    if (val instanceof Y.Text) {
      const s = val.toString().trim();
      if (s) texts.push(s);
    }
  }
  for (const key of ['prop:url', 'prop:description', 'prop:name']) {
    const val = block.get(key);
    if (typeof val === 'string' && val.trim()) texts.push(val.trim());
  }
}

// ===== Scoring (browser only) =====

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
}

function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return freq;
}

function getBigrams(str: string): Set<string> {
  const bg = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) bg.add(str.substring(i, i + 2));
  return bg;
}

function computeScore(queryTokens: string[], docTokens: string[], docText: string, query: string, title: string): number {
  if (docTokens.length === 0 && !title) return 0;
  const lq = query.toLowerCase(), ld = docText.toLowerCase(), lt = title.toLowerCase();
  let score = 0;

  if (lt.includes(lq)) score += 15;
  if (ld.includes(lq)) score += 10;

  const docFreq = termFrequency(docTokens);
  const titleFreq = termFrequency(tokenize(title));

  for (const qt of queryTokens) {
    if (titleFreq.has(qt)) score += 5;
    const count = docFreq.get(qt) || 0;
    if (count > 0) score += 3 * (1 + Math.log(1 + count));
    for (const [term, freq] of docFreq) {
      if (term !== qt && term.length > 2 && (term.startsWith(qt) || qt.startsWith(term)))
        score += 1.5 * (1 + Math.log(1 + freq));
    }
  }

  const qbg = getBigrams(lq), tbg = getBigrams(lt);
  if (qbg.size > 0 && tbg.size > 0) {
    const inter = new Set([...qbg].filter(b => tbg.has(b)));
    score += (2 * inter.size) / (qbg.size + tbg.size) * 8;
  }

  for (const qt of queryTokens) {
    const qb = getBigrams(qt);
    if (qb.size === 0) continue;
    let best = 0;
    for (const [term] of docFreq) {
      const tb = getBigrams(term);
      if (tb.size === 0) continue;
      const inter = new Set([...qb].filter(b => tb.has(b)));
      const sim = (2 * inter.size) / (qb.size + tb.size);
      if (sim > best) best = sim;
    }
    if (best > 0.5) score += best * 2;
  }

  return score;
}

function findSnippet(docText: string, query: string): string {
  const ld = docText.toLowerCase(), lq = query.toLowerCase();
  const idx = ld.indexOf(lq);
  if (idx !== -1) {
    const start = Math.max(0, idx - 40), end = Math.min(docText.length, idx + query.length + 80);
    let s = docText.slice(start, end).replace(/\n/g, ' ').trim();
    if (start > 0) s = '...' + s;
    if (end < docText.length) s += '...';
    return s;
  }
  for (const word of lq.split(/\s+/).filter(w => w.length > 1)) {
    const wi = ld.indexOf(word);
    if (wi !== -1) {
      const start = Math.max(0, wi - 40), end = Math.min(docText.length, wi + word.length + 80);
      let s = docText.slice(start, end).replace(/\n/g, ' ').trim();
      if (start > 0) s = '...' + s;
      if (end < docText.length) s += '...';
      return s;
    }
  }
  return docText.replace(/\n/g, ' ').slice(0, 120).trim() + (docText.length > 120 ? '...' : '');
}
