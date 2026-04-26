import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const webviewEntries = [
  { entryPoints: ['webview-ui/chat/index.tsx'], outfile: 'out/webview/chat.js' },
  { entryPoints: ['webview-ui/lineage/index.tsx'], outfile: 'out/webview/lineage.js' },
  { entryPoints: ['webview-ui/asset-detail/index.tsx'], outfile: 'out/webview/asset-detail.js' },
];

const baseConfig = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
    '.svg': 'dataurl',
  },
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
  logLevel: 'info',
};

async function build() {
  const contexts = await Promise.all(
    webviewEntries.map(entry => esbuild.context({ ...baseConfig, ...entry }))
  );

  if (isWatch) {
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('Watching webview files...');
  } else {
    await Promise.all(contexts.map(ctx => ctx.rebuild()));
    await Promise.all(contexts.map(ctx => ctx.dispose()));
    console.log('Webview build complete.');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
