// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
import { PaletteMap } from './color.js';
export function despeckle(frame, indices, map, amount) {
    if (amount <= 0) return;
    const passes = amount > 0.66 ? 2 : 1;
    const required = amount > 0.33 ? 2 : 1;
    const { width, height } = frame;
    const colors = map.colors;
    const d = frame.data;
    for(let pass = 0; pass < passes; pass++){
        const source = indices.slice();
        const tally = new Map();
        for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                const p = y * width + x;
                if (d[p * 4 + 3] === 0) continue;
                const own = source[p];
                tally.clear();
                let same = 0;
                for(let dy = -1; dy <= 1; dy++){
                    const yy = y + dy;
                    if (yy < 0 || yy >= height) continue;
                    for(let dx = -1; dx <= 1; dx++){
                        if (dx === 0 && dy === 0) continue;
                        const xx = x + dx;
                        if (xx < 0 || xx >= width) continue;
                        if (d[(yy * width + xx) * 4 + 3] === 0) continue;
                        const n = source[yy * width + xx];
                        if (n === own) same++;
                        tally.set(n, (tally.get(n) ?? 0) + 1);
                    }
                }
                if (same >= required) continue;
                let winner = own;
                let winnerCount = 0;
                for (const [index, seen] of tally){
                    if (seen > winnerCount) {
                        winnerCount = seen;
                        winner = index;
                    }
                }
                if (winner === own) continue;
                const ownL = colors[own][0] * .2126 + colors[own][1] * .7152 + colors[own][2] * .0722;
                const winnerL = colors[winner][0] * .2126 + colors[winner][1] * .7152 + colors[winner][2] * .0722;
                if (ownL + 40 < winnerL) continue;
                indices[p] = winner;
                const c = colors[winner];
                d[p * 4] = c[0];
                d[p * 4 + 1] = c[1];
                d[p * 4 + 2] = c[2];
            }
        }
    }
}
