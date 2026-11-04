import { NextResponse } from 'next/server';
import { readdir, readFile, access } from 'fs/promises';
import { join, relative } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import JSZip from 'jszip';
import { internalError } from '@/lib/api-error';

const execFileAsync = promisify(execFile);
const EXTENSION_DIR = join(process.cwd(), 'extension-package');
const BUNDLE_FILE = join(EXTENSION_DIR, 'popup.bundle.js');

async function fileExists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

async function buildBundle() {
  try {
    await execFileAsync('node', ['scripts/build-extension-popup.mjs'], {
      cwd: process.cwd(),
      timeout: 60_000,
    });
  } catch (err) {
    console.error('[extension/download] bundle build failed:', err);
    throw new Error('Failed to build extension popup bundle.');
  }
}

async function addDirToZip(zip: JSZip, dir: string, baseDir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const zipPath = relative(baseDir, fullPath).replace(/\\/g, '/');
    // Exclude the raw source entry point — the bundle replaces it
    if (zipPath === 'popup.js') continue;
    if (entry.isDirectory()) {
      await addDirToZip(zip, fullPath, baseDir);
    } else {
      const data = await readFile(fullPath);
      zip.file(zipPath, data);
    }
  }
}

export async function GET() {
  try {
    // Build the popup bundle if it doesn't exist yet
    if (!(await fileExists(BUNDLE_FILE))) {
      await buildBundle();
    }

    const zip = new JSZip();
    // Add files directly to zip root — Chrome/Edge require manifest.json at the top level
    await addDirToZip(zip, EXTENSION_DIR, EXTENSION_DIR);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="securevoult-extension.zip"',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[extension/download]', err);
    return internalError('Failed to package extension.');
  }
}
