import { resolve } from 'path';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

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
  optimizeDeps: {
    entries: ['index.html', ...(process.env.TAURI_ENV_PLATFORM ? ['notch.html'] : [])],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    dedupe: ['lit', 'yjs', '@preact/signals-core'],
    alias: {
      // @blocksuite/icons ships React (rc) + Lit exports; stub React since we only use Lit
      'react/jsx-runtime': resolve(__dirname, 'src/stubs/react.ts'),
      'react': resolve(__dirname, 'src/stubs/react.ts'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...(process.env.TAURI_ENV_PLATFORM ? { notch: resolve(__dirname, 'notch.html') } : {}),
      },
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
