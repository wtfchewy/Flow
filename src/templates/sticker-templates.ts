import type { TemplateManager } from '@blocksuite/affine/gfx/template';

type StickerTemplate = {
  name: string;
  type: 'sticker';
  preview: string;
  content: unknown;
};

const categoryImports: Record<string, () => Promise<StickerTemplate[]>> = {
  'Cheeky Piggies': () => import('./stickers/Cheeky Piggies.json').then(m => m.default as StickerTemplate[]),
  'Contorted Stickers': () => import('./stickers/Contorted Stickers.json').then(m => m.default as StickerTemplate[]),
  'Paper': () => import('./stickers/Paper.json').then(m => m.default as StickerTemplate[]),
  'Arrows': () => import('./stickers/Arrows.json').then(m => m.default as StickerTemplate[]),
};

const cache = new Map<string, StickerTemplate[]>();

async function getCategory(name: string): Promise<StickerTemplate[]> {
  if (cache.has(name)) return cache.get(name)!;
  const loader = categoryImports[name];
  if (!loader) return [];
  const data = await loader();
  cache.set(name, data);
  return data;
}

function lcs(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export const peakStickerTemplates: TemplateManager = {
  list: async (category: string) => {
    return getCategory(category);
  },

  categories: async () => {
    return Object.keys(categoryImports);
  },

  search: async (query: string) => {
    const results: StickerTemplate[] = [];
    query = query.toLowerCase();
    for (const name of Object.keys(categoryImports)) {
      const stickers = await getCategory(name);
      for (const s of stickers) {
        if (s.name && lcs(query, s.name.toLowerCase()) === query.length) {
          results.push(s);
        }
      }
    }
    return results;
  },
};
