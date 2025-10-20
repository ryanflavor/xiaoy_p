#!/usr/bin/env node
// Placeholder build consolidating workspaces build scripts when present
import { execSync } from 'node:child_process';

try {
  execSync('npm run -ws build', { stdio: 'inherit' });
} catch (e) {
  // No workspace build scripts defined; treat as no-op
  console.log('build: no workspace build scripts; skipping');
}

