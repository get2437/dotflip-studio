# Verification

## Automated checks

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run release:package
```

The Node test suite covers pixel operations, transparency, common palettes, project JSON validation, GIF indexing and loop encoding, ZIP generation, uneven sheet division, connected sprite extraction, and action composition. Afterimages are disabled by default; enabling them is an explicit option. The input poses remain unchanged and the first and final guard frames match.

The dedicated pixel conversion engine is tested for texture suppression with hard-edge preservation, transparent-gutter colour isolation, hidden-RGB independence, weak-speck cleanup while retaining dark eye pixels, shared palette consistency and a bounded working raster. Low-resolution action sprites enlarge by integer factors. Visual art-style acceptance is separate from file/export correctness; a valid GIF does not by itself establish that a convincing pixel-art drawing was produced.

CI runs the build, tests, and release packager on Windows and Linux with Node.js 22. The Actions dependencies are pinned to official release commit hashes and the workflow token has read-only permissions.

## Export verification

Optional read-only checks use Python with Pillow:

```sh
python -m pip install Pillow
python tests/verify_gif.py
```

The verifier compares every decoded GIF frame against the source RGBA data, including transparency, nearest-neighbor enlargement, frame duration, and infinite looping. `tests/verify_sheet.py` checks a UI-exported sheet ZIP and its metadata.

The bundled SURF STRIKE sample was exported through the app UI and compared with its editable 64-frame project. All frame pixels and durations matched. The GIF is 1024×704px and lasts 3.12 seconds. The sample contains no afterimage copies of the character.

Action creation now includes the ground shadow in the transparent character layer by default. The visible “足元の影” checkbox can disable it before generation. The shadow stays at floor height, narrows during jumps, and sits behind the figure. Tests verify that it is present in all 64 frames, preserves every figure pixel and timing, and does not include the background or enemy in default exports. A real UI run regenerated the 128px reference action and saved a 512×352 transparent GIF; all 64 decoded frames and timings matched its project, and every existing character pixel matched the earlier action exactly.

## Manual checks

The Japanese UI has been exercised in Chromium at 517×509 and 1440×1050 viewport sizes. Tested operations include image import, transparent sprite extraction, 16-pose conversion, 64-frame action creation, project save/reopen, GIF/PNG/sheet export, sample loading, and autosave restoration. Small dialog windows scroll internally.

The coordinate editor supports Computer Use pixel corrections with a numbered 16×16 magnifier, X/Y inputs, hex colour, single-pixel paint/erase, and undo/redo. A real UI session reviewed and corrected all 16 poses. Exported RGBA data matched the recorded UI paint actions exactly, with the shared palette, transparency and frame durations preserved. Pixel corrections are performed by the external agent through visible controls; the website does not call an AI model.

A fresh-agent run completed generation, conversion, pixel edits and transparent GIF export, but the user preferred an earlier 128px result. The run used a taller, detailed illustration at 64px/24 colours/balanced; the preferred source had larger readable faces and used 128px/32 colours/soft. Functional completion was not visual acceptance. The defaults and guide now start at 128px/32 colours/soft, establish one converted guard pose before generating 16 matching poses, and require comparison against that guard before action creation. A real UI conversion of the preferred source with these defaults reproduced all 16 reference RGBA buffers, durations and the shared palette exactly. This is a deterministic reproduction check, not a new independent generation test or a guarantee that arbitrary generated material will match the reference.

To check a packaged release, extract its ZIP to a new directory, launch `start-studio.cmd` on Windows or `npm start` on other systems, and open the printed loopback URL. The bundled build must start without installing packages or contacting a remote API.
