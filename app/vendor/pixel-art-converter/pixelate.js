// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
import { createFrame } from './types.js';
export function targetSize(src, requestedWidth) {
    const width = Math.max(1, Math.min(Math.round(requestedWidth), src.width));
    const height = Math.max(1, Math.round(width * src.height / src.width));
    return {
        width,
        height
    };
}
export function downsample(src, outW, outH) {
    const out = createFrame(outW, outH);
    const s = src.data;
    const d = out.data;
    const scaleX = src.width / outW;
    const scaleY = src.height / outH;
    for(let y = 0; y < outH; y++){
        const y0 = Math.floor(y * scaleY);
        const y1 = Math.min(src.height, Math.max(y0 + 1, Math.ceil((y + 1) * scaleY)));
        for(let x = 0; x < outW; x++){
            const x0 = Math.floor(x * scaleX);
            const x1 = Math.min(src.width, Math.max(x0 + 1, Math.ceil((x + 1) * scaleX)));
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            let n = 0;
            for(let sy = y0; sy < y1; sy++){
                let i = (sy * src.width + x0) * 4;
                for(let sx = x0; sx < x1; sx++, i += 4){
                    const alpha = s[i + 3];
                    const w = alpha / 255;
                    r += s[i] * w;
                    g += s[i + 1] * w;
                    b += s[i + 2] * w;
                    a += alpha;
                    n++;
                }
            }
            const o = (y * outW + x) * 4;
            const totalAlpha = a / 255;
            if (totalAlpha > 0) {
                d[o] = r / totalAlpha;
                d[o + 1] = g / totalAlpha;
                d[o + 2] = b / totalAlpha;
            }
            d[o + 3] = a / n;
        }
    }
    return out;
}
export function thresholdAlpha(frame, threshold) {
    if (threshold <= 0) return;
    const d = frame.data;
    for(let i = 3; i < d.length; i += 4){
        d[i] = d[i] < threshold ? 0 : 255;
    }
}
export function upscale(src, factor) {
    const f = Math.max(1, Math.round(factor));
    if (f === 1) return src;
    const outW = src.width * f;
    const outH = src.height * f;
    const out = createFrame(outW, outH);
    const s = src.data;
    const d = out.data;
    for(let y = 0; y < outH; y++){
        const sy = y / f | 0;
        for(let x = 0; x < outW; x++){
            const sx = x / f | 0;
            const si = (sy * src.width + sx) * 4;
            const di = (y * outW + x) * 4;
            d[di] = s[si];
            d[di + 1] = s[si + 1];
            d[di + 2] = s[si + 2];
            d[di + 3] = s[si + 3];
        }
    }
    return out;
}
