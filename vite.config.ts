import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

import { blocksuiteAliases } from './blocksuite-aliases';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [wasm(), vanillaExtractPlugin()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  esbuild: {
    target: 'es2022',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    dedupe: ['lit', 'yjs', '@preact/signals-core'],
    alias: blocksuiteAliases,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (
          warning.code &&
          ['EVAL', 'SOURCEMAP_ERROR'].includes(warning.code)
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
});
