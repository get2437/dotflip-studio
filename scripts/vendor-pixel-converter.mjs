// Maintainer-only regeneration. The published app uses the committed JS files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';

const revision='c6b074e3348b59d1b45a696aa08f587e3035ead1';
const source=process.argv[2];
if(!source)throw new Error('Pass a local Pixel_Art_Converter checkout at '+revision);
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revision)throw new Error('Upstream revision differs');
const target=fileURLToPath(new URL('../app/vendor/pixel-art-converter/',import.meta.url));
await mkdir(target,{recursive:true});
const files=['types','color','adjust','flatten','pixelate','lines','cleanup','edges'];
const hashes=[];
function replace(text,from,to){if(!text.includes(from))throw new Error('Upstream patch context missing: '+from);return text.replace(from,to);}
for(const name of files){
  const original=(await readFile(join(resolve(source),'src/pipeline',name+'.ts'),'utf8')).replace(/\r\n/g,'\n');
  hashes.push({path:'src/pipeline/'+name+'.ts',sha256:createHash('sha256').update(original).digest('hex')});
  let text=original;
  // The upstream still-image pipeline assumes opaque RGB around the subject.
  // Ignore transparent samples so sprite gutters cannot tint skin and cloth.
  if(name==='flatten'){
    text=replace(text,'  stride: number;','  stride: number;\n  count: Uint32Array;');
    text=replace(text,'    stride,','    stride,\n    count: new Uint32Array(size),');
    text=replace(text,'const { stride, r, g, b, l, l2 } = t;','const { stride, r, g, b, l, l2, count } = t;');
    text=replace(text,'    let rowL2 = 0;','    let rowL2 = 0;\n    let rowCount = 0;');
    text=replace(text,'      const cr = s[i];\n      const cg = s[i + 1];\n      const cb = s[i + 2];','      const visible = s[i + 3] >= 128;\n      const cr = visible ? s[i] : 0;\n      const cg = visible ? s[i + 1] : 0;\n      const cb = visible ? s[i + 2] : 0;');
    text=replace(text,'      rowL2 += cl * cl;','      rowL2 += cl * cl;\n      rowCount += visible ? 1 : 0;');
    text=replace(text,'      l2[k] = l2[up] + rowL2;','      l2[k] = l2[up] + rowL2;\n      count[k] = count[up] + rowCount;');
    text=replace(text,'        const n = (x1 - x0 + 1) * (y1 - y0 + 1);','        const n = rectSum(sums.count, stride, x0, y0, x1, y1);\n        if (!n) continue;');
    text=replace(text,'  const guide = boxBlur(lum, width, height, 2);','  const weights = Float32Array.from(lum, (_, p) => s[p * 4 + 3] >= 128 ? 1 : 0);\n  const coverage = boxBlur(weights, width, height, 2);\n  const guide = boxBlur(Float32Array.from(lum, (v, p) => v * weights[p]), width, height, 2);\n  for (let p = 0; p < count; p++) guide[p] = coverage[p] ? guide[p] / coverage[p] : 0;');
  }
  if(name==='lines'){
    text=replace(text,'  const narrow = gaussianBlur(lum, width, height, sigma);','  const alpha = Float32Array.from(lum, (_, p) => s[p * 4 + 3] >= 128 ? 1 : 0);\n  for (let p = 0; p < count; p++) lum[p] *= alpha[p];\n  const narrow = gaussianBlur(lum, width, height, sigma);');
    text=replace(text,'  const wide = gaussianBlur(lum, width, height, sigma * 1.6);','  const wide = gaussianBlur(lum, width, height, sigma * 1.6);\n  const narrowAlpha = gaussianBlur(alpha, width, height, sigma);\n  const wideAlpha = gaussianBlur(alpha, width, height, sigma * 1.6);\n  for (let p = 0; p < count; p++) {\n    narrow[p] /= Math.max(narrowAlpha[p], 1e-6);\n    wide[p] /= Math.max(wideAlpha[p], 1e-6);\n  }');
    text=replace(text,'      let n = 0;','      let n = 0;\n      let peak = 0;');
    text=replace(text,'          sum += mask[sy * srcW + sx];','          const value = mask[sy * srcW + sx];\n          sum += value;\n          peak = Math.max(peak, value);');
    text=replace(text,'      out[y * outW + x] = n > 0 ? sum / n : 0;','      out[y * outW + x] = n > 0 ? Math.max(sum / n, peak * .8) : 0;');
  }
  if(name==='cleanup'){
    text=replace(text,'            const n = source[yy * width + xx];','            if (d[(yy * width + xx) * 4 + 3] === 0) continue;\n            const n = source[yy * width + xx];');
    text=replace(text,'        if (winner === own) continue;','        if (winner === own) continue;\n        // Keep high-contrast dark details such as eyes and one-pixel blades.\n        const ownL = colors[own][0] * .2126 + colors[own][1] * .7152 + colors[own][2] * .0722;\n        const winnerL = colors[winner][0] * .2126 + colors[winner][1] * .7152 + colors[winner][2] * .0722;\n        if (ownL + 40 < winnerL) continue;');
  }
  if(name==='adjust'){
    text=replace(text,'            sum += s[(yy * width + xx) * 4 + c];','            if (s[(yy * width + xx) * 4 + 3] === 0) continue;\n            sum += s[(yy * width + xx) * 4 + c];');
    text=replace(text,'        const blurred = sum / n;','        const blurred = n ? sum / n : s[i + c];');
  }
  let js=stripTypeScriptTypes(text,{mode:'transform'}).replace(/(from\s+['"])(\.\/[^'"]+)(['"])/g,'$1$2.js$3');
  const header='// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.\n// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.\n';
  await writeFile(join(target,name+'.js'),header+js,'utf8');
}
await writeFile(join(target,'LICENSE.md'),await readFile(join(source,'LICENSE'),'utf8'));
await writeFile(join(target,'UPSTREAM.json'),JSON.stringify({repository:'https://github.com/AleksTomatoOnion/Pixel_Art_Converter',revision,files:hashes,changes:['TypeScript transformed to browser-native ESM; explicit .js imports','Alpha-aware Kuwahara, banding, sharpening and contour extraction for transparent sprite sheets','Preserve fine contour peaks when downsampling; ignore transparent neighbours and protect high-contrast dark details during cleanup','DOTFLIP performs palette selection across all poses in its own adapter; upstream logo and UI are not included']},null,2)+'\n');
console.log('Vendored Pixel-Art Converter '+revision);
