# Empaqueta assets/png/*.png en un atlas (assets/atlas.png + assets/atlas.json, formato JSON Hash de Phaser).
# Ejecutar tras tests/rasterize.mjs:  python3 tests/build-atlas.py
import json, os
from PIL import Image
SRC = 'assets/png'; PAD = 2
imgs = sorted([(f[:-4], Image.open(os.path.join(SRC, f)).convert('RGBA')) for f in os.listdir(SRC) if f.endswith('.png')], key=lambda t: -t[1].height)
W = 1024; x = y = rowh = 0; frames = {}; placed = []
for name, im in imgs:
    w, h = im.size
    if x + w + PAD > W: x = 0; y += rowh + PAD; rowh = 0
    placed.append((name, im, x, y)); frames[name] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
    x += w + PAD; rowh = max(rowh, h)
H = y + rowh
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for name, im, px, py in placed: atlas.paste(im, (px, py))
atlas.save('assets/atlas.png', optimize=True)
json.dump({'frames': frames, 'meta': {'image': 'atlas.png', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open('assets/atlas.json', 'w'))
print('atlas', W, 'x', H, len(frames), 'frames')
