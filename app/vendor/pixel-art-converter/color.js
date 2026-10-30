// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
export function colorDistance(r1, g1, b1, r2, g2, b2) {
    const rmean = r1 + r2 >> 1;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return ((512 + rmean) * dr * dr >> 8) + 4 * dg * dg + ((767 - rmean) * db * db >> 8);
}
export function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export class PaletteMap {
    colors;
    cache = new Map();
    constructor(colors){
        this.colors = colors;
    }
    nearestIndex(r, g, b) {
        const key = r << 16 | g << 8 | b;
        const hit = this.cache.get(key);
        if (hit !== undefined) return hit;
        let best = 0;
        let bestDistance = Infinity;
        for(let i = 0; i < this.colors.length; i++){
            const c = this.colors[i];
            const d = colorDistance(r, g, b, c[0], c[1], c[2]);
            if (d < bestDistance) {
                bestDistance = d;
                best = i;
                if (d === 0) break;
            }
        }
        this.cache.set(key, best);
        return best;
    }
}
export function rgbToHsl([r, g, b]) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const delta = max - min;
    if (delta === 0) return [
        0,
        0,
        l
    ];
    const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let h;
    if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / delta + 2) * 60;
    else h = ((rn - gn) / delta + 4) * 60;
    return [
        h,
        s,
        l
    ];
}
export function hslToRgb([h, s, l]) {
    const hn = (h % 360 + 360) % 360;
    if (s === 0) {
        const v = Math.round(l * 255);
        return [
            v,
            v,
            v
        ];
    }
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(hn / 60 % 2 - 1));
    const m = l - c / 2;
    let rgb;
    if (hn < 60) rgb = [
        c,
        x,
        0
    ];
    else if (hn < 120) rgb = [
        x,
        c,
        0
    ];
    else if (hn < 180) rgb = [
        0,
        c,
        x
    ];
    else if (hn < 240) rgb = [
        0,
        x,
        c
    ];
    else if (hn < 300) rgb = [
        x,
        0,
        c
    ];
    else rgb = [
        c,
        0,
        x
    ];
    return [
        Math.round(Math.min(255, Math.max(0, (rgb[0] + m) * 255))),
        Math.round(Math.min(255, Math.max(0, (rgb[1] + m) * 255))),
        Math.round(Math.min(255, Math.max(0, (rgb[2] + m) * 255)))
    ];
}
export function rotateHueToward(hue, target, amount) {
    let delta = (target - hue + 540) % 360 - 180;
    if (Math.abs(delta) > amount) delta = Math.sign(delta) * amount;
    return (hue + delta + 360) % 360;
}
export function hexToRgb(hex) {
    const v = parseInt(hex.replace('#', ''), 16);
    return [
        v >> 16 & 255,
        v >> 8 & 255,
        v & 255
    ];
}
export function rgbToHex([r, g, b]) {
    return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}
