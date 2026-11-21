// Builds both FreshCart variants: buggy (dist) and fixed (dist-fixed).
import { spawnSync } from 'node:child_process';

for (const fixed of [false, true]) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', fixed ? 'dist-fixed' : 'dist'],
    { cwd: 'apps/freshcart', stdio: 'inherit', env: { ...process.env, VITE_OFFLINE_FIX: String(fixed) } },
  );
  if (result.status) process.exit(result.status);
}
