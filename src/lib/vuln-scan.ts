/**
 * Checks every production package this server runs against the OSV
 * vulnerability database (osv.dev, which includes GitHub's advisories).
 * High and critical findings raise a security alert so the code gets updated.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface VulnFinding { name: string; version: string; id: string; severity: string; summary: string; fixed?: string; url: string }
export interface VulnScan { checkedAt: string; packages: number; findings: VulnFinding[]; error?: string }

type Lock = { packages?: Record<string, { version?: string; dev?: boolean }> };

export async function productionPackages(): Promise<{ name: string; version: string }[]> {
  const lock = JSON.parse(await readFile(join(/* turbopackIgnore: true */ process.cwd(), 'package-lock.json'), 'utf8')) as Lock;
  const seen = new Set<string>(); const out: { name: string; version: string }[] = [];
  for (const [path, info] of Object.entries(lock.packages ?? {})) {
    if (!path || info.dev || !info.version) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const key = `${name}@${info.version}`;
    if (!seen.has(key)) { seen.add(key); out.push({ name, version: info.version }); }
  }
  return out;
}

const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, MEDIUM: 2, LOW: 1 };

export async function scanDependencies(): Promise<VulnScan> {
  const checkedAt = new Date().toISOString();
  let pkgs: { name: string; version: string }[] = [];
  try { pkgs = await productionPackages(); } catch (e) {
    return { checkedAt, packages: 0, findings: [], error: `Could not read package-lock.json: ${e instanceof Error ? e.message : e}` };
  }
  try {
    const hits: { pkg: { name: string; version: string }; id: string }[] = [];
    for (let i = 0; i < pkgs.length; i += 500) {
      const chunk = pkgs.slice(i, i + 500);
      const res = await fetch('https://api.osv.dev/v1/querybatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: chunk.map((p) => ({ package: { name: p.name, ecosystem: 'npm' }, version: p.version })) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`osv.dev answered ${res.status}`);
      const data = await res.json() as { results: { vulns?: { id: string }[] }[] };
      data.results.forEach((r, j) => r.vulns?.forEach((v) => hits.push({ pkg: chunk[j], id: v.id })));
    }
    const findings: VulnFinding[] = [];
    for (const h of hits.slice(0, 60)) {
      const res = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(h.id)}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const v = await res.json() as {
        summary?: string; database_specific?: { severity?: string };
        affected?: { package?: { name?: string }; ranges?: { events?: { fixed?: string }[] }[] }[];
      };
      const fixed = v.affected?.find((a) => a.package?.name === h.pkg.name)?.ranges?.flatMap((r) => r.events ?? []).find((e) => e.fixed)?.fixed;
      findings.push({
        name: h.pkg.name, version: h.pkg.version, id: h.id,
        severity: (v.database_specific?.severity ?? 'UNKNOWN').toUpperCase(),
        summary: v.summary ?? h.id, fixed, url: `https://osv.dev/vulnerability/${h.id}`,
      });
    }
    findings.sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0));
    return { checkedAt, packages: pkgs.length, findings };
  } catch (e) {
    return { checkedAt, packages: pkgs.length, findings: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export const isSerious = (f: VulnFinding) => (rank[f.severity] ?? 0) >= 3;
