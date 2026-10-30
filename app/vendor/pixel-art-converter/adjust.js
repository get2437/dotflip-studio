// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
import { createFrame } from './types.js';
import { luminance } from './color.js';
export function adjust(src, settings) {
    const { brightness, contrast, saturation } = settings;
    if (brightness === 0 && contrast === 0 && saturation === 0) return src;
    const out = createFrame(src.width, src.height);
    const s = src.data;
    const d = out.data;
    const k = contrast >= 0 ? 1 / (1 - contrast * 0.92) : 1 + contrast;
    const offset = brightness * 110;
    const sat = 1 + saturation;
    for(let i = 0; i < s.length; i += 4){
        let r = s[i];
        let g = s[i + 1];
        let b = s[i + 2];
        if (brightness !== 0) {
            r += offset;
            g += offset;
            b += offset;
        }
        if (contrast !== 0) {
            r = (r - 128) * k + 128;
            g = (g - 128) * k + 128;
            b = (b - 128) * k + 128;
        }
        if (saturation !== 0) {
            const l = luminance(r, g, b);
            r = l + (r - l) * sat;
            g = l + (g - l) * sat;
            b = l + (b - l) * sat;
        }
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = s[i + 3];
    }
    return out;
}
export function sharpen(src, amount) {
    if (amount <= 0) return src;
    const { width, height } = src;
    const out = createFrame(width, height);
    const s = src.data;
    const d = out.data;
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            const i = (y * width + x) * 4;
            for(let c = 0; c < 3; c++){
                let sum = 0;
                let n = 0;
                for(let dy = -1; dy <= 1; dy++){
                    const yy = y + dy;
                    if (yy < 0 || yy >= height) continue;
                    for(let dx = -1; dx <= 1; dx++){
                        const xx = x + dx;
                        if (xx < 0 || xx >= width) continue;
                        if (s[(yy * width + xx) * 4 + 3] === 0) continue;
                        sum += s[(yy * width + xx) * 4 + c];
                        n++;
                    }
                }
                const blurred = n ? sum / n : s[i + c];
                d[i + c] = s[i + c] + (s[i + c] - blurred) * amount * 2;
            }
            d[i + 3] = s[i + 3];
        }
    }
    return out;
}
