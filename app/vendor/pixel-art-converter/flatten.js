// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
import { createFrame } from './types.js';
import { luminance } from './color.js';
export function flatten(src, amount) {
    if (amount <= 0) return src;
    const iterations = Math.max(1, Math.round(amount * 3));
    const radius = 2 + Math.round(amount * 2);
    const sums = createSummedAreaTables(src.width, src.height);
    let current = src;
    for(let i = 0; i < iterations; i++){
        current = kuwaharaPass(current, radius, sums);
    }
    return current;
}
function createSummedAreaTables(width, height) {
    const stride = width + 1;
    const size = stride * (height + 1);
    return {
        stride,
        count: new Uint32Array(size),
        r: new Uint32Array(size),
        g: new Uint32Array(size),
        b: new Uint32Array(size),
        l: new Uint32Array(size),
        l2: new Float64Array(size)
    };
}
function fillSummedAreaTables(src, t) {
    const { width, height } = src;
    const s = src.data;
    const { stride, r, g, b, l, l2, count } = t;
    for(let y = 0; y < height; y++){
        let rowR = 0;
        let rowG = 0;
        let rowB = 0;
        let rowL = 0;
        let rowL2 = 0;
        let rowCount = 0;
        const cur = (y + 1) * stride;
        const above = y * stride;
        let i = y * width * 4;
        for(let x = 0; x < width; x++, i += 4){
            const visible = s[i + 3] >= 128;
            const cr = visible ? s[i] : 0;
            const cg = visible ? s[i + 1] : 0;
            const cb = visible ? s[i + 2] : 0;
            const cl = Math.round(luminance(cr, cg, cb));
            rowR += cr;
            rowG += cg;
            rowB += cb;
            rowL += cl;
            rowL2 += cl * cl;
            rowCount += visible ? 1 : 0;
            const k = cur + x + 1;
            const up = above + x + 1;
            r[k] = r[up] + rowR;
            g[k] = g[up] + rowG;
            b[k] = b[up] + rowB;
            l[k] = l[up] + rowL;
            l2[k] = l2[up] + rowL2;
            count[k] = count[up] + rowCount;
        }
    }
}
function rectSum(table, stride, x0, y0, x1, y1) {
    const bottom = (y1 + 1) * stride;
    const top = y0 * stride;
    return table[bottom + x1 + 1] - table[top + x1 + 1] - table[bottom + x0] + table[top + x0];
}
function kuwaharaPass(src, r, sums) {
    const { width, height } = src;
    const out = createFrame(width, height);
    const s = src.data;
    const d = out.data;
    const { stride } = sums;
    fillSummedAreaTables(src, sums);
    for(let y = 0; y < height; y++){
        const yTop = Math.max(0, y - r);
        const yBottom = Math.min(height - 1, y + r);
        for(let x = 0; x < width; x++){
            const xLeft = Math.max(0, x - r);
            const xRight = Math.min(width - 1, x + r);
            let bestVariance = Infinity;
            let bx0 = 0;
            let by0 = 0;
            let bx1 = 0;
            let by1 = 0;
            let bestN = 1;
            for(let q = 0; q < 4; q++){
                const x0 = q === 0 || q === 2 ? xLeft : x;
                const x1 = q === 0 || q === 2 ? x : xRight;
                const y0 = q < 2 ? yTop : y;
                const y1 = q < 2 ? y : yBottom;
                const n = rectSum(sums.count, stride, x0, y0, x1, y1);
                if (!n) continue;
                const sumL = rectSum(sums.l, stride, x0, y0, x1, y1);
                const sumL2 = rectSum(sums.l2, stride, x0, y0, x1, y1);
                const mean = sumL / n;
                const variance = sumL2 / n - mean * mean;
                if (variance < bestVariance) {
                    bestVariance = variance;
                    bx0 = x0;
                    by0 = y0;
                    bx1 = x1;
                    by1 = y1;
                    bestN = n;
                }
            }
            const o = (y * width + x) * 4;
            d[o] = rectSum(sums.r, stride, bx0, by0, bx1, by1) / bestN;
            d[o + 1] = rectSum(sums.g, stride, bx0, by0, bx1, by1) / bestN;
            d[o + 2] = rectSum(sums.b, stride, bx0, by0, bx1, by1) / bestN;
            d[o + 3] = s[o + 3];
        }
    }
    return out;
}
export function posterize(src, bands) {
    if (bands < 2) return src;
    const { width, height } = src;
    const out = createFrame(width, height);
    const s = src.data;
    const d = out.data;
    const steps = bands - 1;
    const count = width * height;
    const lum = new Float32Array(count);
    for(let p = 0; p < count; p++){
        lum[p] = luminance(s[p * 4], s[p * 4 + 1], s[p * 4 + 2]);
    }
    const weights = Float32Array.from(lum, (_, p)=>s[p * 4 + 3] >= 128 ? 1 : 0);
    const coverage = boxBlur(weights, width, height, 2);
    const guide = boxBlur(Float32Array.from(lum, (v, p)=>v * weights[p]), width, height, 2);
    for(let p = 0; p < count; p++)guide[p] = coverage[p] ? guide[p] / coverage[p] : 0;
    for(let p = 0; p < count; p++){
        const i = p * 4;
        const banded = Math.round(guide[p] / 255 * steps) / steps * 255;
        const scale = Math.min(6, banded / Math.max(lum[p], 1));
        d[i] = s[i] * scale;
        d[i + 1] = s[i + 1] * scale;
        d[i + 2] = s[i + 2] * scale;
        d[i + 3] = s[i + 3];
    }
    return out;
}
function boxBlur(data, width, height, radius) {
    const pass1 = new Float32Array(data.length);
    const window = radius * 2 + 1;
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            let sum = 0;
            for(let k = -radius; k <= radius; k++){
                const xx = Math.min(width - 1, Math.max(0, x + k));
                sum += data[y * width + xx];
            }
            pass1[y * width + x] = sum / window;
        }
    }
    const pass2 = new Float32Array(data.length);
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            let sum = 0;
            for(let k = -radius; k <= radius; k++){
                const yy = Math.min(height - 1, Math.max(0, y + k));
                sum += pass1[yy * width + x];
            }
            pass2[y * width + x] = sum / window;
        }
    }
    return pass2;
}
