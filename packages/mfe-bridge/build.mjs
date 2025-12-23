import fs from 'node:fs';
import path from 'node:path';

const src = path.join(process.cwd(), 'src', 'index.js');
const distDir = path.join(process.cwd(), 'dist');
fs.mkdirSync(distDir, { recursive: true });

// Simple build: copy ESM source to dist.
// (Você pode trocar por tsup/rollup depois, sem quebrar API.)
fs.copyFileSync(src, path.join(distDir, 'index.js'));

console.log('Built dist/index.js');
