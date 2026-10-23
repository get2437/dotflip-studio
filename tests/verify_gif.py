"""Decode actual exported GIFs with Pillow and compare against source RGBA frames."""
import sys, json, base64
from pathlib import Path
from PIL import Image, ImageChops

root=Path(__file__).resolve().parents[1]
project_path=Path(sys.argv[1]) if len(sys.argv)>1 else root/'artifacts/demo.dotflip.json'
gif_path=Path(sys.argv[2]) if len(sys.argv)>2 else root/'artifacts/demo.gif'
project=json.loads(project_path.read_text(encoding='utf-8'))
gif=Image.open(gif_path)
w,h=project['width'],project['height']
scale=gif.width//w
assert gif.size==(w*scale,h*scale)
assert gif.n_frames==len(project['frames']),(gif.n_frames,len(project['frames']))
assert gif.info.get('loop')==0
for i,frame in enumerate(project['frames']):
    gif.seek(i)
    expected=Image.frombytes('RGBA',(w,h),base64.b64decode(frame['rgba'])).resize(gif.size,Image.Resampling.NEAREST)
    actual=gif.convert('RGBA')
    assert ImageChops.difference(expected.getchannel('A'),actual.getchannel('A')).getbbox() is None, f'alpha / disposal mismatch at frame {i}'
    # RGB under fully transparent pixels is irrelevant. Opaque pixels must match exactly for these small palettes.
    mask=expected.getchannel('A')
    for channel in ['R','G','B']:
        diff=ImageChops.difference(expected.getchannel(channel),actual.getchannel(channel))
        assert ImageChops.multiply(diff,mask).getbbox() is None, f'color mismatch at frame {i}'
    expected_duration=max(20,int(frame['duration']/10+.5)*10)
    assert gif.info['duration']==expected_duration,(i,gif.info['duration'],expected_duration)
print(f'PASS {gif_path.name}: {gif.n_frames} frames, {gif.width}x{gif.height}px, exact opaque colors, correct transparency/disposal/timings, infinite loop')
