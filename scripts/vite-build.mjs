import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function findViteBin(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Unable to find Vite CLI (node_modules/vite/bin/vite.js) starting from: ${startDir}. Did you run npm install?`
  );
}

const viteBin = findViteBin(process.cwd());
const extraArgs = process.argv.slice(2);

const result = spawnSync(process.execPath, [viteBin, 'build', ...extraArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    BABEL_ENV: 'production',
  },
});

process.exit(result.status ?? 1);
