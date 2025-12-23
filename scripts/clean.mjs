import fs from 'node:fs';
import path from 'node:path';

const roots = ['packages', 'examples'];

function rm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

for (const r of roots) {
  const dir = path.join(process.cwd(), r);
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir)) {
    rm(path.join(dir, entry, 'node_modules'));
    rm(path.join(dir, entry, '.next'));
    rm(path.join(dir, entry, 'dist'));
  }
}
console.log('Cleaned workspace artifacts.');
