import { mkdir, cp, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(root + 'dist/vendor', { recursive: true });
await cp(root + 'app', root + 'dist', { recursive: true });
await copyFile(root + 'node_modules/gifenc/dist/gifenc.esm.js', root + 'dist/vendor/gifenc.esm.js');
await copyFile(root + 'node_modules/gifenc/LICENSE.md', root + 'dist/vendor/gifenc.LICENSE.md');
console.log('Built DOTFLIP Studio → dist/ (no CDN or runtime API required)');
