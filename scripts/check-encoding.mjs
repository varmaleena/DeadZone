// Fails if any source file contains mojibake (UTF-8 text decoded as Windows-1252),
// e.g. an ellipsis turning into three odd Latin characters. Run in CI so garbled
// UI text can't ship again.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const roots = ['apps', 'packages', 'android', 'scripts', 'tests', 'docs'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.html', '.css', '.json', '.kt', '.kts', '.md', '.xml']);
const skipDirs = new Set(['node_modules', 'dist', 'build', '.gradle', '.test-build', 'output']);
// Lead bytes of common mis-decoded UTF-8 sequences (written as escapes so this
// file does not match itself).
const pattern = new RegExp('\u00e2\u20ac|\u00c3[\u0080-\u00bf]|\u00c2[\u00a0-\u00bf]');

const offenders = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (!skipDirs.has(name) && !name.startsWith('dist-')) walk(path);
    } else if (extensions.has(extname(name))) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (pattern.test(line)) offenders.push(`${path}:${index + 1}`);
        });
    }
  }
}
for (const root of roots) {
  try {
    walk(root);
  } catch {
    /* folder may not exist */
  }
}
if (offenders.length) {
  console.error('Garbled (mis-encoded) characters found:\n' + offenders.join('\n'));
  process.exit(1);
}
console.log('Encoding check passed: no mis-encoded characters.');
