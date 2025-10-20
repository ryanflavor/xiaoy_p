#!/usr/bin/env node
// Minimal format check: ensure .editorconfig rules satisfied for LF and EOF newline
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

let failed = false;

const files = execSync("rg --files --glob '!**/.git/**' --glob '!node_modules/**' tools packages apps package.json pnpm-workspace.yaml", { stdio: 'pipe' })
  .toString()
  .split('\n')
  .filter(Boolean)
  .filter(f => ['.js','.mjs','.cjs','.json','.md','.yml','.yaml','.ts','.tsx'].includes(extname(f)));

for (const f of files) {
  const buf = readFileSync(f);
  // Check LF
  if (buf.includes('\r\n')) {
    console.error(`format: CRLF detected in ${f}`);
    failed = true;
  }
  // Check final newline
  if (buf.length && buf[buf.length - 1] !== 0x0a) {
    console.error(`format: missing final newline in ${f}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('format: ok');
}
