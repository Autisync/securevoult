// ============================================================================
// package-extension: builds the browser extension and zips it into
// public/downloads/securevoult-extension.zip, so customers can download it
// from Settings → Extension. Runs in the Docker build (see Dockerfile).
//   node scripts/package-extension.mjs
// ============================================================================
import { execFileSync } from 'child_process';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import JSZip from 'jszip';

const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'extension-package');
execFileSync('node', ['scripts/build-extension-popup.mjs'], { cwd: root, stdio: 'inherit' });

const SKIP = new Set(['popup.js', 'INSTALL.md', 'manifest-firefox.json', 'package-info.json', 'globals.css']);
const zip = new JSZip();
const add = (d) => {
  for (const name of readdirSync(d)) {
    const full = join(d, name);
    const rel = relative(dir, full).replace(/\\/g, '/');
    if (statSync(full).isDirectory()) { add(full); continue; }
    if (SKIP.has(rel) || rel.endsWith('.zip')) continue;
    zip.file(`securevoult-extension/${rel}`, readFileSync(full));
  }
};
add(dir);
const out = join(root, 'public', 'downloads');
mkdirSync(out, { recursive: true });
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
writeFileSync(join(out, 'securevoult-extension.zip'), buf);
const version = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).version;
writeFileSync(join(out, 'securevoult-extension.json'), JSON.stringify({ version, bytes: buf.length, builtAt: new Date().toISOString() }));
console.log(`✅ public/downloads/securevoult-extension.zip (v${version}, ${Math.round(buf.length / 1024)} KB)`);
