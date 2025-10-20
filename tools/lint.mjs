#!/usr/bin/env node
// Minimal lint: fail on tabs or trailing spaces in JS/JSON/YAML files
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rg = (pattern) => {
  try {
    const cmd = `rg -n --glob '!**/.git/**' --glob '!node_modules/**' "${pattern}"`;
    execSync(cmd, { stdio: 'pipe' }).toString();
    return true;
  } catch (e) {
    return false;
  }
};

let failed = false;

// Scan a limited set of paths to avoid flagging legacy docs
const PATHS = [
  'tools',
  'packages',
  'apps',
  'package.json',
  'pnpm-workspace.yaml'
].join(' ');

// Trailing spaces
try {
  execSync(`rg -n --glob '!**/.git/**' --glob '!node_modules/**' '[ \t]+$' ${PATHS}`, { stdio: 'pipe' });
  // If command exits 0, matches found
  console.error('lint: trailing whitespace found.');
  failed = true;
} catch {}

// Tabs in source files
try {
  execSync(`rg -n --glob '!**/.git/**' --glob '!node_modules/**' '\\t' --iglob '**/*.{js,jsx,ts,tsx,json,yml,yaml,md}' ${PATHS}`, { stdio: 'pipe' });
  console.error('lint: tab characters found.');
  failed = true;
} catch {}

if (failed) {
  process.exit(1);
} else {
  console.log('lint: ok');
}
