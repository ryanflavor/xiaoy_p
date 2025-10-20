#!/usr/bin/env node
// Minimal lint: fail on tabs or trailing spaces in JS/JSON/YAML files
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const roots = ['tools', 'packages', 'apps', 'services', 'package.json', 'pnpm-workspace.yaml'];
const globs = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.yml', '.yaml', '.md']);

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
  if (!globs.has(extname(f))) continue;
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    if (/\s+$/.test(line)) {
      console.error(`lint: trailing whitespace ${f}:${idx + 1}`);
      failed = true;
    }
    if (/\t/.test(line)) {
      console.error(`lint: tab character ${f}:${idx + 1}`);
      failed = true;
    }
  });
}

if (failed) process.exit(1);
console.log('lint: ok');
