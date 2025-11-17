import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'full': 'src/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,  // FIXED BUG-010: Enable TypeScript declaration files
  splitting: false,  // Disable splitting to reduce bundle count
  sourcemap: true,  // FIXED BUG-011: Enable source maps for debugging
  clean: true,
  minify: true,
  treeshake: {
    preset: 'safest',  // Most aggressive tree-shaking
    moduleSideEffects: false,
  },
  shims: false,  // Disable shims to reduce size
  target: 'es2020',
  external: ['http', 'https', 'zlib', 'stream', 'url', 'path', 'util', 'buffer', 'events', 'crypto'],
  platform: 'neutral',
  bundle: true,  // Bundle all dependencies
  esbuildOptions(options) {
    options.keepNames = false;  // Enable name mangling
    options.drop = ['console', 'debugger'];
    options.treeShaking = true;
    options.minifyWhitespace = true;
    options.minifyIdentifiers = true;
    options.minifySyntax = true;
  }
});
