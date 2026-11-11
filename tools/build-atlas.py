# Empaqueta .build/hi/*.png (reducidas a la mitad) en assets/atlas.png + assets/atlas.json (formato JSON Hash de Phaser).
# Ejecutar tras tools/render.mjs:  python3 tools/build-atlas.py
import json, os
from PIL import Image
SRC = '.build/hi'; PAD = 2; W = 1024
imgs = []
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(SRC, f)).convert('RGBA'); im = im.resize((round(im.width / 2), round(im.height / 2)), Image.LANCZOS); imgs.append((f[:-4], im))
imgs.sort(key=lambda t: -t[1].height)
x = y = rowh = 0; frames = {}; placed = []
for name, im in imgs:
    w, h = im.size
    if x + w + PAD > W: x = 0; y += rowh + PAD; rowh = 0
    placed.append((im, x, y)); frames[name] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
    x += w + PAD; rowh = max(rowh, h)
H = y + rowh
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for im, px, py in placed: atlas.paste(im, (px, py))
atlas.save('assets/atlas.png', optimize=True)
json.dump({'frames': frames, 'meta': {'image': 'atlas.png', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open('assets/atlas.json', 'w'))
print('atlas', W, 'x', H, len(frames), 'frames:', ' '.join(sorted(frames)))
