// Typechecks every package with its own tsconfig, and with --build also builds every app.
// Uses each package's own installed binaries, so it works without pnpm on PATH.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const packages = ['packages/shared', 'apps/extension', 'apps/console', 'apps/freshcart', 'apps/spike'];
const build = process.argv.includes('--build');

function run(label, cwd, script, args, env = {}) {
  const bin = resolve(join(cwd, 'node_modules', script));
  if (!existsSync(bin)) {
    console.error(`${label}: missing ${bin}. Run pnpm install first.`);
    process.exit(1);
  }
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const pkg of packages) run(`typecheck ${pkg}`, pkg, 'typescript/bin/tsc', ['-p', 'tsconfig.json']);

if (build) {
  run('build apps/extension', 'apps/extension', 'vite/bin/vite.js', ['build']);
  run('build apps/console', 'apps/console', 'vite/bin/vite.js', ['build']);
  run('build apps/spike', 'apps/spike', 'vite/bin/vite.js', ['build']);
  run('build apps/freshcart (buggy)', 'apps/freshcart', 'vite/bin/vite.js', ['build', '--outDir', 'dist'], {
    VITE_OFFLINE_FIX: 'false',
  });
  run('build apps/freshcart (fixed)', 'apps/freshcart', 'vite/bin/vite.js', ['build', '--outDir', 'dist-fixed'], {
    VITE_OFFLINE_FIX: 'true',
  });
}
console.log(build ? '\nTypecheck and build passed.' : '\nTypecheck passed.');
