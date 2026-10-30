import { mkdir, cp, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(root + 'dist/vendor', { recursive: true });
await cp(root + 'app', root + 'dist', { recursive: true });
await copyFile(root + 'node_modules/gifenc/dist/gifenc.esm.js', root + 'dist/vendor/gifenc.esm.js');
await copyFile(root + 'node_modules/gifenc/LICENSE.md', root + 'dist/vendor/gifenc.LICENSE.md');
async function filesIn(directory) {
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const file=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await filesIn(file));
    else if(entry.isFile())files.push(file);
  }
  return files.sort();
}
const inputs=await filesIn(root+'app');
const hash=createHash('sha256').update(await readFile(new URL(import.meta.url)));
for(const file of inputs)hash.update(relative(root+'app',file).split(sep).join('/')).update('\0').update(await readFile(file));
hash.update(await readFile(root+'dist/vendor/gifenc.esm.js'));
const version=hash.digest('hex').slice(0,12);
// Version the entire module graph, including the Worker and sample fetches.
// Updating only the entry script can otherwise mix fresh UI with cached logic.
for(const file of await filesIn(root+'dist')){
  if(!/\.(?:html|js)$/.test(file))continue;
  const text=await readFile(file,'utf8');
  const versioned=text.replace(/(['"])(\.{1,2}\/[^'"\r\n?]+\.(?:js|css|json|png|svg))\1/g,(_,quote,url)=>`${quote}${url}?v=${version}${quote}`);
  if(versioned!==text)await writeFile(file,versioned,'utf8');
}
console.log('Built DOTFLIP Studio → dist/ (no CDN or runtime API required)');
