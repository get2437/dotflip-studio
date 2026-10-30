import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

test('static entry, imports, Worker and sample fetches share a content version',async()=>{
  const root=new URL('../dist/',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
  const version=html.match(/src="\.\/app\.js\?v=([a-f0-9]{12})"/)?.[1];
  assert.ok(version,'entry script must bypass old cached code');
  assert.ok(html.includes(`href="./styles.css?v=${version}"`));
  async function scripts(directory){const out=[];for(const file of await readdir(new URL(directory,root),{withFileTypes:true})){if(file.isDirectory())out.push(...await scripts(directory+file.name+'/'));else if(file.name.endsWith('.js'))out.push(directory+file.name);}return out;}
  const files=await scripts('');let references=0;
  for(const file of files){
    const code=await readFile(new URL(file,root),'utf8');
    for(const match of code.matchAll(/(['"])(\.{1,2}\/[^'"\r\n]+\.(?:js|json)(?:\?[^'"\r\n]*)?)\1/g)){
      references++;assert.equal(new URL(match[2],root).searchParams.get('v'),version,`${file}: ${match[2]}`);
    }
  }
  assert.ok(references>=10,'must cover dependent modules, not only the entry');
  const app=await readFile(new URL('app.js',root),'utf8');
  assert.ok(app.includes(`new URL('./gif-worker.js?v=${version}',import.meta.url)`));
  assert.ok(app.includes(`fetch('./assets/surf-strike.poses.json?v=${version}')`));
});
