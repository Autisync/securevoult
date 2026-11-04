import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const phaseArg = args.find((a) => a.startsWith('--phase='))?.split('=')[1] ?? '1';
const continueOnError = args.includes('--continue-on-error');

const phases = {
  '1': {
    name: 'Phase 1 - Foundation Gate',
    steps: [
      'npm run env:check',
      'npm run type-check',
      'npm run api:error-contract-check',
      'npm run build',
      'npm run extension:build',
      'npm run extension:check',
    ],
  },
  '2': {
    name: 'Phase 2 - Platform Gate',
    steps: [
      'npm --prefix desktop install',
      'npm run desktop:build',
      'npm --prefix mobile install',
      'npx --prefix mobile expo config --type public',
      'npm run extension:pack',
    ],
  },
  '3': {
    name: 'Phase 3 - Security and Claims Gate',
    steps: [
      'npm run type-check',
      'npm run build',
      'npm run extension:check',
      'npm run extension:pack',
    ],
  },
};

const NEXT_BUILD_LOCK_RETRY_COUNT = 3;
const NEXT_BUILD_LOCK_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isTransientNextBuildLock(command, result) {
  return command === 'npm run build'
    && result.status !== 0
    && (result.stderr ?? '').includes('Another next build process is already running.');
}

function runStep(command) {
  let result = spawnSync(command, {
    shell: true,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (isTransientNextBuildLock(command, result)) {
    let combinedStdout = result.stdout ?? '';
    let combinedStderr = result.stderr ?? '';

    for (let attempt = 1; attempt <= NEXT_BUILD_LOCK_RETRY_COUNT; attempt += 1) {
      combinedStdout += `\n[audit] Retrying npm run build after transient Next.js build lock (attempt ${attempt}/${NEXT_BUILD_LOCK_RETRY_COUNT}) after ${NEXT_BUILD_LOCK_RETRY_DELAY_MS}ms.`;
      sleep(NEXT_BUILD_LOCK_RETRY_DELAY_MS);

      const retryResult = spawnSync(command, {
        shell: true,
        stdio: 'pipe',
        encoding: 'utf8',
      });

      combinedStdout += `\n${retryResult.stdout ?? ''}`;
      combinedStderr += `\n[audit] Retry attempt ${attempt}/${NEXT_BUILD_LOCK_RETRY_COUNT} after transient Next.js build lock.\n${retryResult.stderr ?? ''}`;
      result = retryResult;

      if (!isTransientNextBuildLock(command, result)) {
        break;
      }
    }

    result = {
      ...result,
      stdout: combinedStdout,
      stderr: combinedStderr,
    };
  }

  return {
    command,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runPhase(phaseId) {
  const phase = phases[phaseId];
  if (!phase) {
    throw new Error(`Unknown phase: ${phaseId}`);
  }

  const results = [];
  for (const step of phase.steps) {
    const stepResult = runStep(step);
    results.push(stepResult);

    if (stepResult.status === 'FAIL' && !continueOnError) {
      break;
    }
  }

  return { phaseId, phaseName: phase.name, results };
}

function toReport(data) {
  const failed = data.results.filter((r) => r.status === 'FAIL').length;
  const passed = data.results.filter((r) => r.status === 'PASS').length;
  const overall = failed === 0 ? 'PASS' : 'FAIL';

  const lines = [];
  lines.push(`# ${data.phaseName}`);
  lines.push('');
  lines.push(`- Overall: **${overall}**`);
  lines.push(`- Passed: ${passed}`);
  lines.push(`- Failed: ${failed}`);
  lines.push('');
  lines.push('## Step Results');
  lines.push('');
  lines.push('| Step | Status | Exit Code |');
  lines.push('|---|---|---|');
  for (const r of data.results) {
    lines.push(`| ${r.command} | ${r.status} | ${r.exitCode} |`);
  }

  for (const r of data.results) {
    lines.push('');
    lines.push(`## ${r.command}`);
    lines.push('');
    lines.push('```text');
    lines.push((r.stdout || '').slice(-8000));
    if (r.stderr) {
      lines.push('--- STDERR ---');
      lines.push(r.stderr.slice(-8000));
    }
    lines.push('```');
  }

  return lines.join('\n');
}

function main() {
  const phaseIds = phaseArg === 'all' ? ['1', '2', '3'] : [phaseArg];
  const all = [];
  let failedAny = false;

  for (const id of phaseIds) {
    const phaseData = runPhase(id);
    all.push(phaseData);

    const report = toReport(phaseData);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = join(process.cwd(), 'docs', 'reports');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `production-audit-phase-${id}-${stamp}.md`);
    writeFileSync(outPath, report, 'utf8');

    const phaseFailed = phaseData.results.some((r) => r.status === 'FAIL');
    failedAny = failedAny || phaseFailed;

    console.log(`Saved report: ${outPath}`);
    console.log(`${phaseData.phaseName}: ${phaseFailed ? 'FAIL' : 'PASS'}`);

    if (phaseFailed && !continueOnError && phaseArg === 'all') {
      break;
    }
  }

  process.exit(failedAny ? 1 : 0);
}

main();
