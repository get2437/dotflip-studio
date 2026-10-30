// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
import { PaletteMap, luminance } from './color.js';
export function extractLines(src, sigma, threshold) {
    const { width, height } = src;
    const count = width * height;
    const s = src.data;
    const lum = new Float32Array(count);
    for(let p = 0; p < count; p++){
        lum[p] = luminance(s[p * 4], s[p * 4 + 1], s[p * 4 + 2]) / 255;
    }
    const alpha = Float32Array.from(lum, (_, p)=>s[p * 4 + 3] >= 128 ? 1 : 0);
    for(let p = 0; p < count; p++)lum[p] *= alpha[p];
    const narrow = gaussianBlur(lum, width, height, sigma);
    const wide = gaussianBlur(lum, width, height, sigma * 1.6);
    const narrowAlpha = gaussianBlur(alpha, width, height, sigma);
    const wideAlpha = gaussianBlur(alpha, width, height, sigma * 1.6);
    for(let p = 0; p < count; p++){
        narrow[p] /= Math.max(narrowAlpha[p], 1e-6);
        wide[p] /= Math.max(wideAlpha[p], 1e-6);
    }
    const edge = new Float32Array(count);
    for(let p = 0; p < count; p++){
        const v = wide[p] - narrow[p];
        edge[p] = v > 0 ? v : 0;
    }
    const MIN_EDGE_RESPONSE = 0.055;
    const scale = 1 / Math.max(percentile(edge, 0.97), MIN_EDGE_RESPONSE);
    const low = threshold;
    const high = threshold * 1.8 + 0.05;
    const mask = new Float32Array(count);
    for(let p = 0; p < count; p++){
        if (s[p * 4 + 3] === 0) continue;
        mask[p] = smoothstep(low, high, edge[p] * scale);
    }
    return mask;
}
function gaussianBlur(data, width, height, sigma) {
    const radius = Math.max(1, Math.ceil(sigma * 2.5));
    const kernel = new Float32Array(radius * 2 + 1);
    let total = 0;
    for(let i = -radius; i <= radius; i++){
        const v = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel[i + radius] = v;
        total += v;
    }
    for(let i = 0; i < kernel.length; i++)kernel[i] /= total;
    const pass1 = new Float32Array(data.length);
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            let sum = 0;
            for(let k = -radius; k <= radius; k++){
                const xx = Math.min(width - 1, Math.max(0, x + k));
                sum += data[y * width + xx] * kernel[k + radius];
            }
            pass1[y * width + x] = sum;
        }
    }
    const pass2 = new Float32Array(data.length);
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            let sum = 0;
            for(let k = -radius; k <= radius; k++){
                const yy = Math.min(height - 1, Math.max(0, y + k));
                sum += pass1[yy * width + x] * kernel[k + radius];
            }
            pass2[y * width + x] = sum;
        }
    }
    return pass2;
}
function percentile(data, p) {
    const stride = Math.max(1, Math.floor(data.length / 20000));
    const sample = [];
    for(let i = 0; i < data.length; i += stride)sample.push(data[i]);
    sample.sort((a, b)=>a - b);
    return sample[Math.min(sample.length - 1, Math.floor(sample.length * p))] ?? 0;
}
function smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
export function downsampleMask(mask, srcW, srcH, outW, outH) {
    const out = new Float32Array(outW * outH);
    const scaleX = srcW / outW;
    const scaleY = srcH / outH;
    for(let y = 0; y < outH; y++){
        const y0 = Math.floor(y * scaleY);
        const y1 = Math.min(srcH, Math.max(y0 + 1, Math.ceil((y + 1) * scaleY)));
        for(let x = 0; x < outW; x++){
            const x0 = Math.floor(x * scaleX);
            const x1 = Math.min(srcW, Math.max(x0 + 1, Math.ceil((x + 1) * scaleX)));
            let sum = 0;
            let n = 0;
            let peak = 0;
            for(let sy = y0; sy < y1; sy++){
                for(let sx = x0; sx < x1; sx++){
                    const value = mask[sy * srcW + sx];
                    sum += value;
                    peak = Math.max(peak, value);
                    n++;
                }
            }
            out[y * outW + x] = n > 0 ? Math.max(sum / n, peak * .8) : 0;
        }
    }
    return out;
}
export function compositeLines(frame, indices, map, mask, weight) {
    if (weight <= 0) return;
    const colors = map.colors;
    const darkest = darkestIndex(colors);
    const ink = colors[darkest];
    const d = frame.data;
    for(let p = 0; p < mask.length; p++){
        const coverage = mask[p];
        if (coverage <= 0.3) continue;
        if (d[p * 4 + 3] === 0) continue;
        const blend = Math.min(1, coverage * weight * 1.4);
        const i = p * 4;
        const idx = map.nearestIndex(Math.round(d[i] + (ink[0] - d[i]) * blend), Math.round(d[i + 1] + (ink[1] - d[i + 1]) * blend), Math.round(d[i + 2] + (ink[2] - d[i + 2]) * blend));
        indices[p] = idx;
        const c = colors[idx];
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
    }
}
function darkestIndex(colors) {
    let best = 0;
    let bestLum = Infinity;
    for(let i = 0; i < colors.length; i++){
        const l = luminance(colors[i][0], colors[i][1], colors[i][2]);
        if (l < bestLum) {
            bestLum = l;
            best = i;
        }
    }
    return best;
}
