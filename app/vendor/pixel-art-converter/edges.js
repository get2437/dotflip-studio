// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
import { PaletteMap, colorDistance, luminance } from './color.js';
function medianPaletteStep(colors) {
    if (colors.length < 2) return Infinity;
    const nearest = [];
    for(let i = 0; i < colors.length; i++){
        let best = Infinity;
        for(let j = 0; j < colors.length; j++){
            if (i === j) continue;
            const d = colorDistance(colors[i][0], colors[i][1], colors[i][2], colors[j][0], colors[j][1], colors[j][2]);
            if (d < best) best = d;
        }
        nearest.push(best);
    }
    nearest.sort((a, b)=>a - b);
    return nearest[nearest.length >> 1];
}
export function applyOutline(frame, indices, map, amount) {
    if (amount <= 0) return;
    const { width, height } = frame;
    const d = frame.data;
    const colors = map.colors;
    const factor = 1 - amount * 0.5;
    const source = indices.slice();
    const lum = new Float32Array(colors.length);
    for(let i = 0; i < colors.length; i++){
        lum[i] = luminance(colors[i][0], colors[i][1], colors[i][2]);
    }
    const n = colors.length;
    const distance = new Float32Array(n * n);
    for(let i = 0; i < n; i++){
        for(let j = i + 1; j < n; j++){
            const d = colorDistance(colors[i][0], colors[i][1], colors[i][2], colors[j][0], colors[j][1], colors[j][2]);
            distance[i * n + j] = d;
            distance[j * n + i] = d;
        }
    }
    const minEdge = medianPaletteStep(colors) * 4;
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            const p = y * width + x;
            if (d[p * 4 + 3] === 0) continue;
            const own = source[p];
            const ownLum = lum[own];
            let onLightSide = false;
            const isEdge = (neighbour)=>neighbour !== own && lum[neighbour] < ownLum - 18 && distance[own * n + neighbour] > minEdge;
            if (x > 0 && isEdge(source[p - 1])) onLightSide = true;
            else if (x + 1 < width && isEdge(source[p + 1])) onLightSide = true;
            else if (y > 0 && isEdge(source[p - width])) onLightSide = true;
            else if (y + 1 < height && isEdge(source[p + width])) onLightSide = true;
            if (!onLightSide) {
                if (x > 0 && d[(p - 1) * 4 + 3] === 0 || x + 1 < width && d[(p + 1) * 4 + 3] === 0 || y > 0 && d[(p - width) * 4 + 3] === 0 || y + 1 < height && d[(p + width) * 4 + 3] === 0) {
                    onLightSide = true;
                }
            }
            if (!onLightSide || ownLum < 24) continue;
            const c = colors[own];
            const idx = map.nearestIndex(Math.round(c[0] * factor), Math.round(c[1] * factor), Math.round(c[2] * factor));
            indices[p] = idx;
            const nc = colors[idx];
            d[p * 4] = nc[0];
            d[p * 4 + 1] = nc[1];
            d[p * 4 + 2] = nc[2];
        }
    }
}
