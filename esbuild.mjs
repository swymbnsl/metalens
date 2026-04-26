import * as esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

const baseConfig = {
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  logLevel: 'info',
};

async function build() {
  // Build extension host
  const ctx = await esbuild.context({
    ...baseConfig,
    entryPoints: ['src/extension.ts'],
    outfile: 'out/extension.js',
    format: 'cjs',
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for extension changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Extension host build complete.');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
