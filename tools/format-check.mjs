#!/usr/bin/env node
// Minimal format check: ensure LF endings and final newline per .editorconfig
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const exts = new Set(['.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.ts', '.tsx']);
const roots = ['tools', 'packages', 'apps', 'services', 'package.json', 'pnpm-workspace.yaml'];

function listFiles() {
  try {
    const out = execSync(`git ls-files -- ${roots.join(' ')}`, { stdio: 'pipe' }).toString();
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

let failed = false;
for (const f of listFiles()) {
  if (!exts.has(extname(f))) continue;
  const buf = readFileSync(f);
  if (buf.includes('\r\n')) {
    console.error(`format: CRLF detected in ${f}`);
    failed = true;
  }
  if (buf.length && buf[buf.length - 1] !== 0x0a) {
    console.error(`format: missing final newline in ${f}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('format: ok');
