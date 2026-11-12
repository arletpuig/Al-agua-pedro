"""Separa la ilustración de referencia de Pedro en capas animables.

Entrada:  assets/src/pedro-ref.png (1312x1199)
Salida:   assets/pedro/head.png   cabeza sin cejas, ojos ni boca (rellenados con la piel de alrededor)
          assets/pedro/browL.png, browR.png   cejas originales recortadas (para moverlas)
          assets/pedro/bust.png   busto con el cuello prolongado por detrás de la mandíbula
          assets/pedro/parts.json posición de cada capa en coordenadas de la ilustración

Uso: python3 tools/pedro-parts.py   (necesita opencv-python-headless y numpy)
"""
import json
import os

import cv2
import numpy as np

SRC = 'assets/src/pedro-ref.png'
OUT = 'assets/pedro'
os.makedirs(OUT, exist_ok=True)

img = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)  # BGRA
H, W = img.shape[:2]
bgr, alpha = img[:, :, :3].copy(), img[:, :, 3].copy()
lum = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)


def poly_mask(pts):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255)
    return m


# ---------- cejas: píxeles oscuros dentro de su zona ----------
brow_zone_l = poly_mask([(538, 352), (600, 330), (700, 360), (760, 400), (752, 432), (690, 418), (560, 412), (538, 400)])
brow_zone_r = poly_mask([(796, 400), (850, 366), (904, 352), (907, 419), (862, 421), (806, 436)])
dark = (lum < 150).astype(np.uint8) * 255


def brow_mask(zone):
    m = cv2.bitwise_and(dark, zone)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    # conservar solo la mancha principal
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return ((lab == k) * 255).astype(np.uint8)


bl, br = brow_mask(brow_zone_l), brow_mask(brow_zone_r)
# ---------- ojos y boca: polígonos medidos sobre la ilustración ----------
eye_l = poly_mask([(560, 438), (578, 416), (630, 400), (684, 408), (708, 440), (703, 458), (640, 459), (578, 452)])
eye_r = poly_mask([(789, 457), (800, 434), (836, 424), (874, 434), (898, 466), (884, 477), (830, 477), (796, 468)])
mouth = poly_mask([(572, 572), (584, 562), (606, 568), (680, 600), (760, 614), (822, 604), (842, 608), (843, 634),
                   (800, 642), (740, 652), (680, 640), (620, 616), (586, 600)])


def soft_edge(m, grow):
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow, grow)))


hole = soft_edge(bl, 9) | soft_edge(br, 9) | soft_edge(eye_l, 5) | soft_edge(eye_r, 5) | soft_edge(mouth, 5)
hole[:, 906:] = 0
# Relleno por convolución normalizada a varias escalas: cada píxel del hueco toma la media ponderada
# de la piel cercana (sin contar líneas negras), de cerca a lejos. Conserva el degradado sin manchas.
valid = ((hole == 0) & (lum > 150) & (alpha > 200)).astype(np.float32)
src = bgr.astype(np.float32)
fill = None
for sigma in (64, 32, 16, 8, 4):
    den = cv2.GaussianBlur(valid, (0, 0), sigma)
    num = cv2.GaussianBlur(src * valid[:, :, None], (0, 0), sigma)
    est = num / np.maximum(den, 1e-6)[:, :, None]
    if fill is None:
        fill = est
    else:
        w = np.clip(den / 0.35, 0, 1)[:, :, None]
        fill = fill * (1 - w) + est * w
hm = cv2.GaussianBlur(cv2.dilate(hole, np.ones((3, 3), np.uint8)), (0, 0), 1.5).astype(np.float32)[:, :, None] / 255
clean = (src * (1 - hm) + fill * hm).astype(np.uint8)


def save_layer(name, color, a, box):
    x, y, w, h = box
    out = np.dstack([color, a])[y:y + h, x:x + w]
    cv2.imwrite(f'{OUT}/{name}.png', out)
    return {'x': x, 'y': y, 'w': w, 'h': h}


parts = {}
# ---------- cabeza: polígono que sigue la mandíbula ----------
HEAD_POLY = [(0, 0), (W, 0), (W, 600), (894, 634), (859, 680), (835, 740), (810, 794), (764, 808), (680, 804),
             (600, 772), (468, 722), (445, 678), (443, 596), (0, 596)]
head_a = cv2.bitwise_and(alpha, poly_mask(HEAD_POLY))
parts['head'] = save_layer('head', clean, head_a, (340, 10, 610, 810))
for name, m in (('browL', bl), ('browR', br)):
    a = cv2.GaussianBlur(soft_edge(m, 3), (0, 0), 1.2)
    a = cv2.min(a, alpha)
    ys, xs = np.where(a > 0)
    box = (int(xs.min()) - 2, int(ys.min()) - 2, int(xs.max() - xs.min()) + 5, int(ys.max() - ys.min()) + 5)
    parts[name] = save_layer(name, bgr, a, box)
# ---------- busto: el resto, con el cuello prolongado por detrás de la cabeza ----------
bust_a = cv2.bitwise_and(alpha, 255 - poly_mask(HEAD_POLY))
bust_c = bgr.copy()
neck = poly_mask([(486, 640), (836, 640), (836, 690), (745, 806), (680, 882), (495, 782), (486, 718)])
neck_fill = (neck > 0) & (bust_a < 200)
bust_c[neck_fill] = (60, 99, 197)  # BGR de la sombra del cuello
bust_a[neck_fill] = 255
# el centro del borde inferior del busto se borra con un degradado: ahí sigue el torso dibujado (cintura, botón)
ramp = np.clip((np.arange(H) - 1108) / 10.0, 0, 1)[:, None]
cols = np.zeros(W, bool); cols[357:1009] = True
bust_a = (bust_a * (1 - ramp * cols[None, :])).astype(np.uint8)
# los muñones de las mangas del busto se quitan: los brazos se dibujan aparte desde el hombro
yr = np.clip((np.arange(H) - 985) / 14.0, 0, 1)[:, None]
side = np.zeros(W, np.float32); side[:350] = 1; side[1014:] = 1
bust_a = (bust_a * (1 - yr * side[None, :])).astype(np.uint8)
parts['bust'] = save_layer('bust', bust_c, bust_a, (160, 600, 965, 590))
parts['pivots'] = {'neck': [690, 790], 'browL': [645, 385], 'browR': [852, 402]}
json.dump(parts, open(f'{OUT}/parts.json', 'w'), indent=1)
print('ok', parts)
