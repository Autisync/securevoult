import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const API_ROOT = join(process.cwd(), 'src', 'app', 'api');

const ERROR_STATUS_CODES = '(400|401|403|404|409|410|422|429|500|501|502|503)';

const RULES = [
  {
    id: 'legacy_string_error_payload',
    description: 'Use api-error helpers instead of NextResponse.json({ error: "..." }, ...).',
    pattern: /NextResponse\.json\(\s*\{\s*error\s*:\s*['"`]/gs,
  },
  {
    id: 'manual_error_contract_payload',
    description: 'Use api-error helpers instead of manually constructing { error: true, code, message }.',
    pattern: /NextResponse\.json\(\s*\{\s*error\s*:\s*true\s*,\s*code\s*:\s*['"`]/gs,
  },
  {
    id: 'plain_text_error_nextresponse',
    description: 'Use api-error helpers instead of plain-text new NextResponse("...", { status: ... }).',
    pattern: new RegExp(`new\\s+NextResponse\\(\\s*['\"][\\s\\S]*?\\{\\s*status\\s*:\\s*${ERROR_STATUS_CODES}\\b`, 'gs'),
  },
];

function collectFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    const ext = extname(entry.name);
    if (ext === '.ts' || ext === '.tsx') {
      files.push(fullPath);
    }
  }
  return files;
}

function indexToLine(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function run() {
  const files = collectFiles(API_ROOT);
  const findings = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf8');

    for (const rule of RULES) {
      for (const match of source.matchAll(rule.pattern)) {
        const index = match.index ?? 0;
        findings.push({
          file: relative(process.cwd(), filePath).replace(/\\/g, '/'),
          line: indexToLine(source, index),
          ruleId: rule.id,
          description: rule.description,
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log('API error contract check: PASS');
    process.exit(0);
  }

  console.error('API error contract check: FAIL');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.ruleId}] ${finding.description}`);
  }
  process.exit(1);
}

run();
