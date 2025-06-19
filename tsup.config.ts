import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  shims: true,
  target: 'es2020',
  external: ['http', 'https', 'zlib', 'stream', 'url', 'path', 'util', 'buffer', 'events'],
  platform: 'neutral',
  esbuildOptions(options) {
    options.keepNames = true;
    options.drop = ['console', 'debugger'];
    options.treeShaking = true;
    options.minifyWhitespace = true;
    options.minifyIdentifiers = true;
    options.minifySyntax = true;
  }
});