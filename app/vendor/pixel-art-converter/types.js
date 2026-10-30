// Pixel-Art Converter — Copyright (c) 2026 AleksTomatoOnion, MIT.
// Vendored/adapted by DOTFLIP; see LICENSE.md and UPSTREAM.json in this directory.
export function createFrame(width, height) {
    return {
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height
    };
}
