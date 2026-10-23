import { readdir, readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipFiles } from '../app/zip.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Use a stable numeric version for release packaging.');
await access(join(root, 'dist', 'index.html'));
const files = [];
async function collect(relative) {
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const path = relative + '/' + entry.name;
    if (entry.isSymbolicLink()) throw new Error('Symbolic links are not included in release archives: ' + path);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile()) files.push({ name: 'dotflip-studio/' + path, data: await readFile(join(root, path)) });
  }
}
// Explicit inputs keep Git metadata, credentials, Site identities and local work out of the release.
for (const directory of ['app', 'scripts', 'tests', 'dist', 'docs']) await collect(directory);
for (const name of ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'ASSETS.md', 'CHANGELOG.md', 'COMPUTER_USE_GUIDE.md', 'CONTRIBUTING.md', 'QA.md', 'package.json', 'package-lock.json', 'start-studio.cmd']) {
  files.push({ name: 'dotflip-studio/' + name, data: await readFile(join(root, name)) });
}
const bytes = zipFiles(files), name = `dotflip-studio-v${pkg.version}.zip`;
const sha256 = createHash('sha256').update(bytes).digest('hex');
await mkdir(join(root, 'release'), { recursive: true });
await writeFile(join(root, 'release', name), bytes);
await writeFile(join(root, 'release', 'SHA256SUMS.txt'), `${sha256}  ${name}\n`);
console.log(JSON.stringify({ archive: 'release/' + name, bytes: bytes.length, files: files.length, sha256 }));
