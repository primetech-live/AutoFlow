import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    ssr: true,
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'bin/index.ts'),
      name: 'autoflow-cli',
      fileName: () => 'cli.js',
      formats: ['cjs']
    },
    rollupOptions: {
      output: {
        entryFileNames: 'cli.js',
        inlineDynamicImports: true
      },
      // Only exclude native built-in node core modules
      external: [
        'child_process', 'crypto', 'events', 'fs', 'os', 'path', 'readline',
        'http', 'https', 'tls', 'net', 'dns', 'stream', 'util', 'zlib', 'assert', 'tty', 'url',
        'node:buffer', 'node:path', 'node:events', 'node:child_process', 'node:fs', 'node:process'
      ]
    }
  },
  ssr: {
    noExternal: true
  }
});
