#!/usr/bin/env node
const { build } = require('esbuild')
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, 'src')
const DIST = path.join(__dirname, 'dist')
const ENTRY = path.join(SRC, 'cli', 'entry.js')

// Clean
fs.rmSync(DIST, { recursive: true, force: true })
fs.mkdirSync(DIST, { recursive: true })

async function main() {
  // 1. Bundle CLI into a single executable
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(DIST, 'cli.js'),
    external: ['ws', 'commander'],
    banner: { js: '#!/usr/bin/env node' },
  })
  fs.chmodSync(path.join(DIST, 'cli.js'), 0o755)

  // 2. Bundle client library as CJS
  await build({
    entryPoints: [path.join(SRC, 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(DIST, 'index.cjs'),
    format: 'cjs',
    external: ['ws'],
  })

  // 3. Bundle client library as ESM
  await build({
    entryPoints: [path.join(SRC, 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.join(DIST, 'index.mjs'),
    format: 'esm',
    external: ['ws'],
  })

  console.log('=== Built ===')
  for (const entry of fs.readdirSync(DIST)) {
    const p = path.join(DIST, entry)
    const stat = fs.statSync(p)
    console.log(`  ${entry} (${stat.isDirectory() ? 'dir' : (stat.size / 1024).toFixed(1) + ' KB'})`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
