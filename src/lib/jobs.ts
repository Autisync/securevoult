/**
 * Background checks that run inside the app, every 6 hours (first one a few
 * minutes after start): late backups, low disk space, and security updates
 * needed for the code's packages. Problems become critical security events,
 * which are emailed to the admins.
 */
import { readdir, stat, statfs } from 'node:fs/promises';
import connectDB from '@/lib/db-connect';
import { SystemState } from '@/lib/models';
import { recordEvent } from '@/lib/security-events';
import { scanDependencies, isSerious } from '@/lib/vuln-scan';
import { heartbeat } from '@/lib/crm';

const BACKUP_DIR = process.env.BACKUP_DIR ?? '/backups';
const EVERY_MS = 6 * 3600e3;

async function getState<T>(key: string): Promise<T | null> {
  const d = await SystemState.findOne({ key }).lean() as { value?: T } | null;
  return d?.value ?? null;
}
async function setState(key: string, value: unknown) {
  await SystemState.updateOne({ key }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
}
/** True at most once per `hours` for a given key, so alerts don't repeat every run. */
async function due(key: string, hours: number): Promise<boolean> {
  const last = await getState<string>(`alerted:${key}`);
  if (last && Date.now() - new Date(last).getTime() < hours * 3600e3) return false;
  await setState(`alerted:${key}`, new Date().toISOString());
  return true;
}

async function checkBackups() {
  let names: string[];
  try { names = (await readdir(/* turbopackIgnore: true */ BACKUP_DIR)).filter((n) => /^securevoult-.*\.archive\.gz$/.test(n)); } catch { return; } // folder not mounted
  let newest = 0, newestSize = 0;
  for (const n of names) {
    const st = await stat(/* turbopackIgnore: true */ `${BACKUP_DIR}/${n}`);
    if (st.mtimeMs > newest) { newest = st.mtimeMs; newestSize = st.size; }
  }
  const hours = newest ? (Date.now() - newest) / 3600e3 : Infinity;
  // Shows in CRM → System status → Backups ("SecureVoult vaults").
  await heartbeat('securevoult-backup', hours <= 26, {
    lastOkAt: newest ? new Date(newest).toISOString() : null, sizeBytes: newestSize, host: 'vault.autisync.com', snapshots: names.length,
    message: hours <= 26 ? 'Nightly backup is fresh' : newest ? `Last backup is ${Math.round(hours)} hours old` : 'No backups found',
  }).catch(() => false);
  if (hours > 26 && await due('backup_late', 24)) {
    await recordEvent(null, { type: 'backup_late', summary: newest ? `The last backup is ${Math.round(hours)} hours old` : 'There are no backups in the backups folder' });
  }
}

async function checkDisk() {
  try {
    const s = await statfs(/* turbopackIgnore: true */ BACKUP_DIR).catch(() => statfs('/'));
    const pct = (s.bavail / s.blocks) * 100;
    if (pct < 10 && await due('disk_low', 24)) {
      await recordEvent(null, { type: 'disk_low', summary: `Only ${pct.toFixed(0)}% of the server's disk is free`, details: { freeGB: +(s.bavail * s.bsize / 1e9).toFixed(1) } });
    }
  } catch { /* not available */ }
}

export async function checkDependencies(force = false) {
  const scan = await scanDependencies();
  await setState('vuln-scan', scan);
  const serious = scan.findings.filter(isSerious);
  const known = new Set((await getState<string[]>('vuln-alerted')) ?? []);
  const fresh = serious.filter((f) => !known.has(`${f.id}:${f.name}@${f.version}`));
  if (fresh.length && (force || fresh.length)) {
    await recordEvent(null, {
      type: 'vulnerable_dependency',
      summary: `${fresh.length} package${fresh.length === 1 ? ' needs' : 's need'} a security update: ${fresh.slice(0, 5).map((f) => `${f.name} ${f.version}${f.fixed ? ` → ${f.fixed}` : ''} (${f.severity.toLowerCase()})`).join(', ')}`,
      details: { findings: fresh.slice(0, 20) },
    });
    await setState('vuln-alerted', [...known, ...fresh.map((f) => `${f.id}:${f.name}@${f.version}`)]);
  }
  return scan;
}

async function runAll() {
  try {
    await connectDB();
    await checkBackups();
    await checkDisk();
    await checkDependencies();
  } catch (e) {
    console.error('[jobs] check failed:', e instanceof Error ? e.message : e);
  }
}

let started = false;
export function startJobs() {
  if (started || process.env.SECUREVOULT_JOBS === 'off') return;
  started = true;
  setTimeout(() => { void runAll(); setInterval(() => void runAll(), EVERY_MS).unref?.(); }, 3 * 60e3).unref?.();
}
