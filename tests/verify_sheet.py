"""Verify a UI-exported PNG + metadata ZIP, preserving a PNG fixture for reimport."""
from pathlib import Path
import json,sys,zipfile,io
from PIL import Image
path=Path(sys.argv[1])
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    png_names=[n for n in z.namelist() if n.endswith('.sheet.png')]
    json_names=[n for n in z.namelist() if n.endswith('.sheet.json')]
    assert len(png_names)==len(json_names)==1
    png=z.read(png_names[0]);meta=json.loads(z.read(json_names[0]))
    image=Image.open(io.BytesIO(png)).convert('RGBA')
    assert image.size==(meta['size']['width'],meta['size']['height'])
    assert meta['image']==png_names[0]
    for f in meta['frames']:
        r=f['rect'];assert r['x']>=0 and r['y']>=0
        assert r['x']+r['width']<=image.width and r['y']+r['height']<=image.height
        assert 20<=f['duration']<=5000
    (root/'artifacts/sheet-roundtrip.png').write_bytes(png)
    (root/'artifacts/sheet-roundtrip.meta.json').write_text(json.dumps(meta,ensure_ascii=False),encoding='utf-8')
    print(f"PASS ZIP CRC32, PNG {image.width}x{image.height}, {len(meta['frames'])} frame rectangles, exact filenames and valid durations")
