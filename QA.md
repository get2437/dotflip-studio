# Verification

## Automated checks

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run release:package
```

The Node test suite covers pixel operations, transparency, common palettes, project JSON validation, GIF indexing and loop encoding, ZIP generation, uneven sheet division, connected sprite extraction, and action composition. Afterimages are disabled by default; enabling them is an explicit option. The input poses remain unchanged and the first and final guard frames match.

CI runs the build, tests, and release packager on Windows and Linux with Node.js 22. The Actions dependencies are pinned to official release commit hashes and the workflow token has read-only permissions.

## Export verification

Optional read-only checks use Python with Pillow:

```sh
python -m pip install Pillow
python tests/verify_gif.py
```

The verifier compares every decoded GIF frame against the source RGBA data, including transparency, nearest-neighbor enlargement, frame duration, and infinite looping. `tests/verify_sheet.py` checks a UI-exported sheet ZIP and its metadata.

The bundled SURF STRIKE sample was exported through the app UI and compared with its editable 64-frame project. All frame pixels and durations matched. The GIF is 1024×704px and lasts 3.12 seconds. The sample contains no afterimage copies of the character.

## Manual checks

The Japanese UI has been exercised in Chromium at 517×509 and 1440×1050 viewport sizes. Tested operations include image import, transparent sprite extraction, 16-pose conversion, 64-frame action creation, project save/reopen, GIF/PNG/sheet export, sample loading, and autosave restoration. Small dialog windows scroll internally.

To check a packaged release, extract its ZIP to a new directory, launch `start-studio.cmd` on Windows or `npm start` on other systems, and open the printed loopback URL. The bundled build must start without installing packages or contacting a remote API.
