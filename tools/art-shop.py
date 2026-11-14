# La Trastienda: piezas vectoriales de Abascal, los seis objetos, efectos y escenario del puesto clandestino.
# Genera assets/shop/*.svg (van al atlas) y assets/src/bg-shop.svg + assets/src/fg-shop.svg (imágenes grandes del escenario).
# Después: node tools/render.mjs && python3 tools/build-atlas.py
import os, random
os.makedirs('assets/shop', exist_ok=True)
INK = '#0a0605'; W = 2.4
SKIN, SKINL, SKIND = '#e8a479', '#f6c39c', '#c27a52'
BEARD, BEARDL, BEARDD = '#2b1d17', '#4d372b', '#160e0b'
VEST, VESTL, VESTD = '#33503a', '#4a6e50', '#1f3324'
SHIRT, SHIRTD = '#f6f3ec', '#cfc8ba'
DEFS = f'''<defs>
<radialGradient id="skin" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="{SKINL}"/><stop offset=".6" stop-color="{SKIN}"/><stop offset="1" stop-color="{SKIND}"/></radialGradient>
<linearGradient id="skinH" x1="0" x2="1"><stop offset="0" stop-color="{SKIND}"/><stop offset=".45" stop-color="{SKINL}"/><stop offset="1" stop-color="{SKIND}"/></linearGradient>
<linearGradient id="beard" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="{BEARDL}"/><stop offset=".5" stop-color="{BEARD}"/><stop offset="1" stop-color="{BEARDD}"/></linearGradient>
<linearGradient id="vest" x1="0" x2="1"><stop offset="0" stop-color="{VESTD}"/><stop offset=".4" stop-color="{VESTL}"/><stop offset=".7" stop-color="{VEST}"/><stop offset="1" stop-color="{VESTD}"/></linearGradient>
<linearGradient id="shirt" x1="0" x2="1"><stop offset="0" stop-color="{SHIRTD}"/><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="{SHIRTD}"/></linearGradient>
<linearGradient id="gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff4b0"/><stop offset=".35" stop-color="#ffd23f"/><stop offset=".7" stop-color="#e09a12"/><stop offset="1" stop-color="#9c5f00"/></linearGradient>
<linearGradient id="goldH" x1="0" x2="1"><stop offset="0" stop-color="#9c5f00"/><stop offset=".3" stop-color="#ffe680"/><stop offset=".6" stop-color="#f0b020"/><stop offset="1" stop-color="#8a5200"/></linearGradient>
<linearGradient id="steelV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e3eaf5"/><stop offset=".45" stop-color="#9aa8c0"/><stop offset="1" stop-color="#4a5670"/></linearGradient>
<linearGradient id="steelH" x1="0" x2="1"><stop offset="0" stop-color="#4a5670"/><stop offset=".3" stop-color="#e3eaf5"/><stop offset=".6" stop-color="#9aa8c0"/><stop offset="1" stop-color="#3a4560"/></linearGradient>
<linearGradient id="woodV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c98a4b"/><stop offset=".5" stop-color="#9c6431"/><stop offset="1" stop-color="#5e3815"/></linearGradient>
<linearGradient id="woodH" x1="0" x2="1"><stop offset="0" stop-color="#6e4118"/><stop offset=".4" stop-color="#b57a40"/><stop offset="1" stop-color="#6e4118"/></linearGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.42" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .12  0 0 0 0 .03  0 0 0 -1.5 1.02"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="2"/></filter><filter id="soft6"><feGaussianBlur stdDeviation="6"/></filter>
</defs>'''
NS = 'stroke="none"'
def svg(name, vb, body, stroke=True, folder='assets/shop'):
    x, y, w, h = vb
    g = f'<g stroke="{INK}" stroke-width="{W}" stroke-linejoin="round" stroke-linecap="round">{body}</g>' if stroke else body
    open(f'{folder}/{name}.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" width="{w}" height="{h}">{DEFS}{g}</svg>')
def wood(d, grad='woodV'): return f'<path d="{d}" fill="url(#{grad})"/><path d="{d}" fill="#fff" {NS} filter="url(#grain)"/>'
def bolt(x, y, r=3): return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#d5deec" stroke-width="1.3"/><circle cx="{x-r*.3}" cy="{y-r*.3}" r="{r*.35}" fill="#fff" {NS}/>'

# =====================================================================================
# ABASCAL — cabeza (origen: base del cuello), unidades = píxeles del mundo
# Rasgos de caricatura: mandíbula enorme cubierta por barba cerrada, pelo muy corto,
# cejas gruesas, mirada intensa y hundida, nariz recta y cuello de toro.
# =====================================================================================
HEAD_VB = (-78, -200, 156, 204)
def ab_head(eyes='front', brows='stern', mouth='smirk'):
    b = ''
    # orejas (asoman por fuera del cráneo)
    for s in (-1, 1):
        b += f'<path d="M{56*s},-122 Q{74*s},-130 {73*s},-108 Q{72*s},-88 {56*s},-86Z" fill="url(#skin)"/><path d="M{61*s},-116 Q{67*s},-110 {64*s},-98" stroke-width="1.6" fill="none"/>'
    # cráneo ancho y mandíbula cuadrada
    b += '<path d="M-58,-70 C-64,-104 -64,-148 -48,-170 C-32,-190 32,-190 48,-170 C64,-148 64,-104 58,-70 C56,-40 44,-22 0,-16 C-44,-22 -56,-40 -58,-70Z" fill="url(#skin)"/>'
    # arrugas de la frente
    b += f'<path d="M-26,-146 Q0,-153 26,-146 M-18,-137 Q0,-141 18,-137" stroke="{SKIND}" stroke-width="1.6" fill="none" opacity=".75"/>'
    # sombra de afeitado en las mejillas (degradado suave entre piel y barba)
    b += f'<path d="M-56,-110 Q-46,-84 -24,-78 L24,-78 Q46,-84 56,-110 L58,-70 L-58,-70Z" fill="{BEARDL}" opacity=".35" filter="url(#soft)" {NS}/>'
    # barba cerrada y recortada: patillas finas delante de la oreja y mandíbula cuadrada
    b += ('<path d="M-60,-128 L-52,-128 C-52,-108 -48,-94 -40,-86 C-30,-76 -18,-78 -8,-80 L8,-80 C18,-78 30,-76 40,-86 C48,-94 52,-108 52,-128 L60,-128 '
          'C64,-96 62,-60 52,-38 C42,-18 22,-8 0,-8 C-22,-8 -42,-18 -52,-38 C-62,-60 -64,-96 -60,-128Z" fill="url(#beard)"/>')
    b += ''.join(f'<path d="M{x},{y} q{q},6 {d},10" stroke="{BEARDL}" stroke-width="1.5" fill="none" opacity=".75"/>' for x, y, q, d in [(-50,-74,2,1),(-42,-52,2,2),(-28,-34,1,2),(-10,-26,0,1),(8,-26,0,-1),(26,-34,-1,-2),(40,-52,-2,-2),(48,-74,-2,-1),(-55,-100,2,1),(54,-100,-2,-1),(-18,-46,1,0),(18,-46,-1,0),(0,-38,0,0),(-34,-62,1,1),(34,-62,-1,-1)])
    b += f'<path d="M-44,-26 Q0,-6 44,-26" stroke="{BEARDD}" stroke-width="2" fill="none" opacity=".6"/>'
    # pelo muy corto: solo la parte de arriba, con entradas
    b += f'<path d="M-60,-128 C-64,-166 -40,-194 0,-194 C40,-194 64,-166 61,-122 C58,-140 54,-152 46,-158 C36,-164 26,-162 14,-166 C6,-170 -6,-170 -14,-166 C-26,-162 -36,-164 -46,-158 C-54,-152 -58,-140 -61,-122Z" fill="url(#beard)"/>'
    b += ''.join(f'<path d="M{x},{y} l{dx},-4" stroke="{BEARDL}" stroke-width="1.6" opacity=".8"/>' for x, y, dx in [(-36,-176,3),(-20,-184,2),(-4,-186,1),(12,-184,-1),(28,-178,-2),(-50,-150,3),(48,-150,-3),(-28,-170,2),(20,-172,-2),(42,-166,-2),(-42,-166,2)])
    # boca
    if mouth == 'smirk':
        b += f'<path d="M-15,-58 Q-2,-55 10,-58 Q16,-60 19,-66" stroke-width="2.6" fill="none"/><path d="M-11,-55 Q0,-50 10,-56" fill="#c45a50" stroke-width="1.6"/>'
    elif mouth == 'grin':
        b += f'<path d="M-18,-62 Q0,-54 20,-66 Q16,-48 0,-46 Q-14,-48 -18,-62Z" fill="#5a0f18" stroke-width="2.4"/><path d="M-15,-60 Q0,-54 18,-64 L16,-58 Q0,-52 -13,-56Z" fill="#fff" stroke-width="1.4"/>'
    elif mouth == 'laugh':
        b += f'<path d="M-24,-64 Q0,-56 24,-64 Q22,-36 0,-34 Q-22,-36 -24,-64Z" fill="#5a0f18" stroke-width="2.6"/><path d="M-21,-62 Q0,-55 21,-62 L19,-55 Q0,-50 -19,-55Z" fill="#fff" stroke-width="1.4"/><path d="M-10,-40 Q0,-48 10,-40 Q0,-35 -10,-40Z" fill="#f26a72" stroke-width="1.2"/>'
    elif mouth == 'flat':
        b += '<path d="M-16,-60 Q0,-57 16,-60" stroke-width="2.8" fill="none"/>'
    # bigote
    b += f'<path d="M-26,-66 C-22,-80 -8,-82 0,-76 C8,-82 22,-80 26,-66 C18,-70 8,-71 0,-68 C-8,-71 -18,-70 -26,-66Z" fill="url(#beard)" stroke-width="2"/>'
    # nariz recta y fuerte
    b += f'<path d="M-6,-114 C-7,-106 -10,-98 -14,-90 C-16,-84 -10,-80 -5,-82 Q0,-78 5,-82 C10,-80 16,-84 14,-90 C11,-96 8,-104 7,-112" fill="url(#skin)" stroke-width="2.2"/>'
    b += f'<path d="M-8,-85 q2,2 5,1 M8,-85 q-2,2 -5,1" stroke-width="1.8" fill="none"/><path d="M2,-112 Q4,-100 6,-94" stroke="#fff" stroke-width="2" fill="none" opacity=".5"/>'
    # ojos hundidos con ojeras
    ex = {'front': (0, 0), 'side': (-5, 0), 'right': (5, 0), 'down': (0, 2)}.get(eyes, (0, 0))
    for s in (-1, 1):
        cx = 23 * s
        b += f'<path d="M{cx-12},-104 Q{cx},-96 {cx+12},-104" stroke="{SKIND}" stroke-width="1.8" fill="none" opacity=".8"/>'
        if eyes == 'closed' or (eyes == 'wink' and s == 1):
            b += f'<path d="M{cx-11},-110 Q{cx},-104 {cx+11},-110" stroke-width="3" fill="none"/>'
        elif eyes == 'laugh':
            b += f'<path d="M{cx-11},-108 Q{cx},-118 {cx+11},-108" stroke-width="3.2" fill="none"/>'
        else:
            b += f'<path d="M{cx-12},-110 Q{cx},-120 {cx+12},-110 Q{cx},-104 {cx-12},-110Z" fill="#f5efe8" stroke-width="2"/>'
            b += f'<clipPath id="e{s+1}"><path d="M{cx-12},-110 Q{cx},-120 {cx+12},-110 Q{cx},-104 {cx-12},-110Z"/></clipPath>'
            b += f'<g clip-path="url(#e{s+1})" {NS}><circle cx="{cx+ex[0]}" cy="{-111+ex[1]}" r="5.4" fill="#3a2418"/><circle cx="{cx+ex[0]}" cy="{-111+ex[1]}" r="2.6" fill="{INK}"/><circle cx="{cx+ex[0]-1.6}" cy="{-112.6+ex[1]}" r="1.3" fill="#fff"/></g>'
            b += f'<path d="M{cx-13},-110 Q{cx},-122 {cx+13},-110" stroke-width="3.2" fill="none"/>'
    # cejas pobladas
    brow = {'stern': (-120, -128, -124, -121), 'raise': None, 'up': (-126, -134, -128, -126), 'angry': (-128, -126, -118, -114)}
    for s in (-1, 1):
        if brows == 'raise':
            v = (-134, -142, -132, -128) if s == -1 else (-118, -124, -122, -116)
        else:
            v = brow[brows]
        o, m, i, base = v                       # extremo exterior, punto alto, extremo interior, base del grosor
        b += f'<path d="M{40*s},{o+2} Q{24*s},{m} {7*s},{i} L{7*s},{i+7} Q{24*s},{m+8} {40*s},{o+8}Z" fill="url(#beard)" stroke-width="2"/>'
    # mejillas
    b += f'<ellipse cx="-38" cy="-90" rx="9" ry="5" fill="#e0705a" opacity=".35" filter="url(#soft)" {NS}/><ellipse cx="38" cy="-90" rx="9" ry="5" fill="#e0705a" opacity=".35" filter="url(#soft)" {NS}/>'
    return b
for name, kw in {'abHead': {}, 'abHeadSide': {'eyes': 'side'}, 'abHeadRight': {'eyes': 'right'}, 'abHeadBlink': {'eyes': 'closed'},
                 'abHeadBrow': {'brows': 'raise', 'mouth': 'grin'}, 'abHeadWink': {'eyes': 'wink', 'mouth': 'grin', 'brows': 'up'},
                 'abHeadLaugh': {'eyes': 'laugh', 'brows': 'up', 'mouth': 'laugh'}, 'abHeadNo': {'eyes': 'down', 'brows': 'angry', 'mouth': 'flat'}}.items():
    svg(name, HEAD_VB, ab_head(**kw))
# gafas de sol de "trato discreto" (se colocan sobre la cabeza y bajan a los ojos)
svg('abShades', (-46, -14, 92, 26), f'<path d="M-44,-6 H44" stroke-width="3.4"/><path d="M-40,-8 H-6 Q-4,8 -22,9 Q-40,8 -40,-8Z M6,-8 H40 Q40,8 22,9 Q4,8 6,-8Z" fill="#14161c"/><path d="M-34,-4 L-26,-4 M12,-4 L20,-4" stroke="#fff" stroke-width="2.6" opacity=".6"/>')

# torso (origen: base del cuello). Chaleco acolchado verde sobre camisa blanca abierta, cuello de toro.
torso = ''
torso += f'<path d="M-30,-44 L30,-44 L34,8 L-34,8Z" fill="url(#skinH)"/><path d="M-16,-10 Q0,-2 16,-10" stroke="{SKIND}" stroke-width="2" fill="none"/>'
torso += '<path d="M-118,40 C-116,18 -96,6 -60,0 L60,0 C96,6 116,18 118,40 L124,230 L-124,230Z" fill="url(#shirt)"/>'
torso += f'<path d="M-34,0 L0,58 L34,0 L22,-6 L0,34 L-22,-6Z" fill="url(#skinH)"/><path d="M-6,30 q6,6 12,0" stroke="{BEARDD}" stroke-width="1.4" fill="none"/>'
torso += '<path d="M-34,0 L-46,-10 L-26,40 L0,58Z M34,0 L46,-10 L26,40 L0,58Z" fill="#fff"/>'
quilt = ''.join(f'<path d="M-112,{y} Q-70,{y+6} -30,{y+2}" stroke="{VESTD}" stroke-width="2" fill="none"/><path d="M112,{y} Q70,{y+6} 30,{y+2}" stroke="{VESTD}" stroke-width="2" fill="none"/>' for y in range(56, 230, 26))
torso += f'<path d="M-104,26 C-96,16 -70,8 -48,6 L-6,92 L-6,230 L-114,230 Q-118,120 -104,26Z" fill="url(#vest)"/><path d="M104,26 C96,16 70,8 48,6 L6,92 L6,230 L114,230 Q118,120 104,26Z" fill="url(#vest)"/>'
torso += f'<g clip-path="url(#vc)">{quilt}</g><clipPath id="vc"><path d="M-104,26 C-96,16 -70,8 -48,6 L-6,92 L-6,230 L-114,230 Q-118,120 -104,26Z M104,26 C96,16 70,8 48,6 L6,92 L6,230 L114,230 Q118,120 104,26Z"/></clipPath>'
torso += f'<path d="M-6,92 V230 M6,92 V230" stroke-width="2.4"/><path d="M0,96 V230" stroke="#9aa8c0" stroke-width="2.6" stroke-dasharray="3 3"/><rect x="-5" y="150" width="10" height="16" rx="2" fill="url(#steelV)" stroke-width="1.4"/>'
torso += f'<path d="M-80,120 h26 v20 h-26Z" fill="{VESTD}" stroke-width="1.6"/><path d="M-80,124 h26" stroke-width="1.4"/>'
torso += f'<path d="M-90,40 Q-70,26 -50,24" stroke="{VESTL}" stroke-width="3" fill="none" opacity=".8"/>'
svg('abTorso', (-130, -50, 260, 284), torso)
# brazo recto (origen: hombro; cuelga hacia +y). Manga de camisa remangada, antebrazo velludo, mano abierta y pulsera rojigualda.
def ab_arm(hand='open'):
    a = '<path d="M-24,-6 Q-28,40 -22,92 L22,92 Q28,40 24,-6 Q0,-16 -24,-6Z" fill="url(#shirt)"/>'
    a += f'<path d="M-6,10 Q-10,50 -6,84" stroke="{SHIRTD}" stroke-width="3" fill="none"/>'
    a += '<rect x="-24" y="84" width="48" height="16" rx="6" fill="url(#shirt)"/><path d="M-22,92 H22" stroke-width="1.4" opacity=".6"/>'
    a += '<path d="M-18,100 L-15,160 L15,160 L18,100Z" fill="url(#skinH)"/>'
    a += ''.join(f'<path d="M{x},{y} l2,-4" stroke="{BEARD}" stroke-width="1.3" opacity=".6"/>' for x, y in [(-10,112),(-4,120),(6,116),(10,128),(-8,134),(2,140),(8,146),(-6,148)])
    a += f'<rect x="-16" y="150" width="32" height="5" fill="#c60b1e" stroke-width="1.4"/><rect x="-16" y="155" width="32" height="5" fill="#ffc400" stroke-width="1.4"/><rect x="-16" y="160" width="32" height="4" fill="#c60b1e" stroke-width="1.4"/>'
    if hand == 'open':      # palma abierta, dedos juntos (ofrecer)
        a += f'<path d="M-18,162 Q-22,182 -16,198 Q-4,212 8,206 L18,190 Q24,178 18,162Z" fill="url(#skin)"/><path d="M18,170 Q32,168 34,178 Q30,186 18,186" fill="url(#skin)"/><path d="M-10,198 Q-6,186 -8,174 M-2,204 Q2,190 0,176 M6,202 Q10,190 8,176" stroke="{SKIND}" stroke-width="1.6" fill="none"/>'
    else:                   # puño
        a += f'<path d="M-18,162 Q-24,180 -16,192 Q0,202 16,192 Q24,180 18,162Z" fill="url(#skin)"/><path d="M-12,184 Q-4,190 4,186 M-14,176 Q-4,182 6,178" stroke="{SKIND}" stroke-width="1.6" fill="none"/>'
    return a
svg('abArm', (-38, -20, 76, 236), ab_arm('open'))
svg('abFist', (-38, -20, 76, 236), ab_arm('fist'))
# brazo doblado (origen: hombro): codo abajo y mano a la altura de la barba (acariciarla, frotarse las manos)
bent = '<path d="M-24,-6 Q-30,40 -16,86 L24,90 Q30,40 24,-6 Q0,-16 -24,-6Z" fill="url(#shirt)"/><rect x="-22" y="76" width="48" height="18" rx="7" fill="url(#shirt)" transform="rotate(-10 2 85)"/>'
bent += '<path d="M-14,82 L-80,24 L-64,8 L12,64Z" fill="url(#skinH)"/>'
bent += f'<path d="M-78,18 Q-96,4 -92,-12 Q-84,-24 -70,-18 L-56,4Z" fill="url(#skin)"/><path d="M-90,-6 Q-80,-8 -74,-2 M-88,2 Q-78,0 -72,6" stroke="{SKIND}" stroke-width="1.6" fill="none"/>'
bent += f'<path d="M-52,10 l4,8 l4,-8" stroke="#c60b1e" stroke-width="5" fill="none"/>'
svg('abArmBent', (-104, -30, 140, 132), bent)

# =====================================================================================
# LOS SEIS OBJETOS
# =====================================================================================
# 1. El Besugo (cabeza a la derecha)
fish = '''<defs><linearGradient id="fsh" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8fa6c2"/><stop offset=".45" stop-color="#e8eef6"/><stop offset=".7" stop-color="#f6c9c0"/><stop offset="1" stop-color="#d98a8a"/></linearGradient></defs>'''
fish += '<path d="M-44,0 L-62,-20 Q-56,0 -62,20Z" fill="#c4a4b0"/><path d="M-50,-8 L-58,-14 M-50,8 L-58,14 M-50,0 H-60" stroke-width="1.2" opacity=".6"/>'
fish += '<path d="M-14,-22 Q0,-38 22,-24Z" fill="#c4a4b0"/><path d="M-6,22 Q4,32 14,22Z" fill="#c4a4b0"/>'
fish += '<path d="M-46,0 C-36,-24 10,-30 34,-18 C46,-12 54,-4 56,2 C52,12 44,18 32,22 C8,28 -34,22 -46,0Z" fill="url(#fsh)"/>'
fish += ''.join(f'<path d="M{x},{y} q5,5 0,10" stroke="#7d8fa8" stroke-width="1.1" fill="none" opacity=".6"/>' for x in range(-30, 20, 9) for y in (-12, -2, 8))
fish += f'<ellipse cx="-4" cy="-17" rx="20" ry="3.5" fill="#fff" opacity=".6" {NS}/><path d="M18,-14 Q22,0 18,16" stroke-width="1.8" fill="none"/>'
fish += '<circle cx="34" cy="-6" r="9.5" fill="#fff"/><circle cx="36" cy="-5" r="4.6" fill="#0a0605"/><circle cx="34.6" cy="-6.6" r="1.6" fill="#fff" stroke="none"/>'
fish += '<path d="M48,6 Q56,4 58,10 Q56,16 48,14Z" fill="#e88d96" stroke-width="2"/><path d="M50,10 h6" stroke-width="1.4"/>'
svg('itBesugo', (-66, -40, 128, 76), fish)
# 2. La Chancla de la abuela (vista desde arriba, puntera arriba)
ch = '<path d="M0,-58 C22,-58 30,-36 28,-14 C26,8 30,30 28,46 C26,60 14,66 0,66 C-14,66 -26,60 -28,46 C-30,30 -24,8 -26,-14 C-28,-36 -22,-58 0,-58Z" fill="#3a7bd5"/>'
ch += '<path d="M0,-52 C16,-52 22,-34 21,-14 C20,8 24,28 22,44 C20,54 12,58 0,58 C-12,58 -20,54 -22,44 C-24,28 -20,8 -20,-14 C-22,-34 -16,-52 0,-52Z" fill="#7fb3ff" stroke-width="1.6"/>'
ch += ''.join(f'<path d="M-18,{y} H20" stroke="#5a92e6" stroke-width="1.4" opacity=".8"/>' for y in range(-40, 54, 8))
ch += '<path d="M-24,-6 Q0,-30 24,-6 Q22,6 14,4 Q0,-10 -14,4 Q-22,6 -24,-6Z" fill="#ff5d8f"/>'
ch += '<g transform="translate(0,-14)"><circle r="7" fill="#ffd23f" stroke-width="1.6"/>' + ''.join(f'<ellipse cx="0" cy="-9" rx="4.5" ry="6" fill="#fff" stroke-width="1.4" transform="rotate({a})"/>' for a in range(0, 360, 72)) + '<circle r="4.5" fill="#ffd23f" stroke-width="1.4"/></g>'
ch += f'<path d="M-8,-46 Q0,-50 8,-46" stroke="#fff" stroke-width="2.4" fill="none" opacity=".7"/>'
svg('itChancla', (-34, -64, 68, 136), ch)
# huella roja de chancla para la mejilla (sin contorno, semitransparente)
svg('slapMark', (-16, -30, 32, 60), f'<path d="M0,-26 C10,-26 13,-16 12,-6 C11,4 13,14 12,20 C11,26 6,28 0,28 C-6,28 -11,26 -12,20 C-13,14 -11,4 -12,-6 C-13,-16 -10,-26 0,-26Z" fill="#e2263a" opacity=".55"/>' + ''.join(f'<path d="M-9,{y} H9" stroke="#b0101f" stroke-width="1.4" opacity=".55"/>' for y in range(-18, 24, 6)), stroke=False)
# 3. El Pollo de Goma (de pie, colgando por las patas)
pollo = '<path d="M-10,52 L-14,70 M-14,70 l-6,4 M-14,70 l0,7 M-14,70 l6,4 M8,52 L10,70 M10,70 l-6,4 M10,70 l0,7 M10,70 l6,4" stroke="#ff9a1f" stroke-width="4" fill="none"/>'
pollo += '<path d="M-26,10 C-34,30 -24,56 0,58 C24,56 32,34 24,12 C18,-4 -18,-6 -26,10Z" fill="#ffe14d"/>'
pollo += '<path d="M-20,22 Q-30,36 -18,46 Q-10,36 -14,24Z" fill="#f5c400" stroke-width="1.8"/><path d="M-6,4 C-10,-20 -6,-46 2,-56 C8,-48 10,-20 8,4Z" fill="#ffe14d"/>'
pollo += '<path d="M-6,-76 C-14,-74 -16,-60 -8,-54 C0,-50 10,-52 12,-60 C14,-70 6,-78 -6,-76Z" fill="#ffe14d"/>'
pollo += '<path d="M-10,-76 Q-12,-88 -4,-84 Q-2,-94 4,-86 Q10,-92 10,-80 Z" fill="#ff3b3b"/>'
pollo += '<path d="M10,-66 L28,-62 L12,-58Z" fill="#ff9a1f"/><path d="M10,-62 L26,-62" stroke-width="1.4"/><path d="M4,-56 Q8,-46 2,-44 Q-2,-50 4,-56Z" fill="#ff3b3b" stroke-width="1.6"/>'
pollo += '<path d="M-4,-70 l6,4 M2,-70 l-6,4" stroke-width="2.4"/>'
pollo += f'<ellipse cx="-14" cy="18" rx="6" ry="10" fill="#fff" opacity=".55" {NS} transform="rotate(25 -14 18)"/><path d="M-4,-40 Q-6,-20 -4,-4" stroke="#fff" stroke-width="2.4" fill="none" opacity=".6"/>'
svg('itPollo', (-40, -98, 76, 182), pollo)
# 4. El Tartazo (plato de cartón con nata y fresa)
tarta = '<path d="M-50,8 Q0,22 50,8 L46,18 Q0,32 -46,18Z" fill="#d9d4c8"/>'
tarta += '<path d="M-42,8 L-38,-8 Q0,0 38,-8 L42,8 Q0,18 -42,8Z" fill="#e8b46a"/><path d="M-36,4 Q0,12 36,4" stroke="#b47c34" stroke-width="1.6" fill="none"/>'
tarta += '<path d="M-40,-8 Q-46,-20 -34,-24 Q-30,-36 -16,-32 Q-8,-44 4,-36 Q16,-44 24,-32 Q38,-36 36,-22 Q48,-18 40,-8 Q0,0 -40,-8Z" fill="#fffaf0"/>'
tarta += '<path d="M-26,-22 q6,-6 12,0 M-2,-28 q6,-6 12,0 M18,-20 q6,-6 10,0" stroke="#e4dccb" stroke-width="2" fill="none"/>'
tarta += '<path d="M2,-38 Q-10,-42 -8,-54 Q-2,-60 6,-56 Q16,-58 18,-48 Q16,-38 2,-38Z" fill="#e8192c"/><path d="M0,-58 l2,-6 M2,-56 l-6,-4 M4,-56 l6,-4" stroke="#2f9a3d" stroke-width="2.6"/>'
tarta += ''.join(f'<circle cx="{x}" cy="{y}" r="1" fill="#ffd23f" {NS}/>' for x, y in [(-2,-50),(8,-48),(4,-44),(12,-52)])
tarta += f'<ellipse cx="-16" cy="-24" rx="10" ry="3" fill="#fff" {NS}/>'
svg('itTarta', (-54, -66, 108, 92), tarta)
# careta de nata para la cara de Pedro (en coordenadas locales de la cabeza)
cream = '<path d="M-48,-168 Q-58,-150 -54,-128 Q-62,-108 -50,-92 Q-52,-74 -38,-70 Q-36,-56 -22,-60 Q-16,-48 -4,-56 Q6,-46 14,-58 Q26,-50 30,-64 Q44,-60 44,-76 Q56,-84 50,-100 Q60,-116 52,-132 Q58,-150 46,-164 Q40,-180 22,-176 Q8,-188 -8,-178 Q-24,-188 -34,-176 Q-48,-180 -48,-168Z" fill="#fffaf0"/>'
cream += '<path d="M-30,-150 q8,-8 16,0 M4,-160 q8,-8 14,0 M-36,-110 q8,-6 14,0 M20,-120 q8,-6 14,0 M-10,-92 q8,-6 14,0" stroke="#e4dccb" stroke-width="2.4" fill="none"/>'
cream += f'<ellipse cx="-24" cy="-160" rx="14" ry="4" fill="#fff" {NS}/>'
svg('creamMask', (-66, -192, 132, 146), cream)
# ojos que parpadean dentro de la nata
svg('creamEyes', (-30, -14, 60, 28), f'<ellipse cx="-14" cy="0" rx="9" ry="8" fill="#5a3220"/><ellipse cx="14" cy="0" rx="8" ry="7.5" fill="#5a3220"/><circle cx="-14" cy="0" r="6" fill="#fff"/><circle cx="14" cy="0" r="5.5" fill="#fff"/><circle cx="-13" cy="1" r="2.8" fill="{INK}" {NS}/><circle cx="15" cy="1" r="2.6" fill="{INK}" {NS}/>')
svg('creamBlob', (-10, -10, 20, 20), '<path d="M-8,0 Q-9,-8 0,-8 Q9,-8 8,0 Q8,8 0,8 Q-8,8 -8,0Z" fill="#fffaf0" stroke="#d8cfbd" stroke-width="1.4"/>', stroke=False)
svg('strawberry', (-12, -14, 24, 26), '<path d="M0,10 Q-10,6 -9,-4 Q-4,-9 0,-7 Q4,-9 9,-4 Q10,6 0,10Z" fill="#e8192c"/><path d="M-5,-8 L0,-12 L5,-8" stroke="#2f9a3d" stroke-width="2.4" fill="none"/>')
# 5. El Cubo Helado (cubo metálico lleno de agua con hielo)
cubo = '<path d="M-40,-30 Q0,-50 40,-30" stroke-width="3.4" fill="none"/><path d="M-40,-30 Q0,-50 40,-30" stroke="#9aa8c0" stroke-width="1.6" fill="none"/>'
cubo += '<path d="M-36,-20 L-28,44 Q0,52 28,44 L36,-20Z" fill="url(#steelH)"/><path d="M-34,-8 Q0,0 34,-8 M-31,18 Q0,26 31,18" stroke="#5a6680" stroke-width="2" fill="none"/>'
cubo += '<ellipse cx="0" cy="-20" rx="38" ry="9" fill="#4ec9ec"/><ellipse cx="-6" cy="-21" rx="22" ry="4" fill="#bff3ff" opacity=".8" stroke="none"/>'
cubo += ''.join(f'<rect x="{x}" y="{y}" width="14" height="13" rx="3" fill="#e8fbff" fill-opacity=".9" stroke-width="1.6" transform="rotate({r} {x+7} {y+6})"/><path d="M{x+3},{y+3} h5" stroke="#fff" stroke-width="2" transform="rotate({r} {x+7} {y+6})"/>' for x, y, r in [(-24,-34,-14),(-6,-40,10),(12,-34,24),(-14,-28,4)])
cubo += f'<path d="M-30,-12 L-24,36" stroke="#fff" stroke-width="4" opacity=".6"/>' + bolt(-38, -26, 3.4) + bolt(38, -26, 3.4)
cubo += '<path d="M-24,46 l-2,6 M-4,50 l0,7 M16,48 l2,6" stroke="#7fdfff" stroke-width="3"/>'
svg('itCubo', (-46, -54, 92, 112), cubo)
svg('iceCube', (-10, -10, 20, 20), '<rect x="-8" y="-8" width="16" height="16" rx="3" fill="#e8fbff" fill-opacity=".9" stroke="#7fb8d8" stroke-width="1.6"/><path d="M-4,-4 h5" stroke="#fff" stroke-width="2"/>', stroke=False)
svg('iceShard', (-10, -12, 20, 24), '<path d="M0,-10 L8,4 L-2,10 L-8,-2Z" fill="#d9f6ff" fill-opacity=".9" stroke="#7fb8d8" stroke-width="1.4"/><path d="M-1,-4 L3,2" stroke="#fff" stroke-width="1.6"/>', stroke=False)
# bloque de hielo que encierra a Pedro (se dibuja a media resolución y se muestra x2)
ice = '<defs><linearGradient id="iceG" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#e8fbff" stop-opacity=".75"/><stop offset=".5" stop-color="#9fe0ff" stop-opacity=".45"/><stop offset="1" stop-color="#5fb8e8" stop-opacity=".6"/></linearGradient></defs>'
ice += '<path d="M-62,-120 L58,-124 L64,58 L-60,62Z" fill="url(#iceG)" stroke="#d9f6ff" stroke-width="2.4"/>'
ice += '<path d="M-52,-108 L-30,-112 L-48,-30Z" fill="#fff" opacity=".45"/><path d="M40,-100 L52,-104 L54,-60Z" fill="#fff" opacity=".35"/><path d="M-50,40 L-20,44 L-50,56Z" fill="#fff" opacity=".3"/>'
ice += '<path d="M10,-124 L4,-96 L14,-80 M-60,0 L-40,6 L-36,22 M64,10 L44,16" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>'
ice += '<path d="M-62,-120 Q-40,-128 -20,-120 Q0,-128 20,-121 Q40,-128 58,-124" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>'
svg('iceBlock', (-66, -130, 134, 196), ice, stroke=False)
svg('iceCrack', (-60, -120, 120, 180), '<path d="M-6,-118 L4,-80 L-12,-50 L8,-10 L-6,30 L10,60 M4,-80 L30,-70 M-12,-50 L-40,-40 M8,-10 L40,0 M-6,30 L-34,44" stroke="#fff" stroke-width="2.6" fill="none" stroke-linejoin="round"/>', stroke=False)
# 6. La Moción de Censura (urna dorada con papeletas). Objeto de pago.
urna = '<path d="M-44,-34 L44,-34 L44,46 L-44,46Z" fill="#cfe9ff" fill-opacity=".55"/>'
urna += ''.join(f'<rect x="{x}" y="{y}" width="22" height="14" rx="1.5" fill="#fffdf4" stroke-width="1.4" transform="rotate({r} {x+11} {y+7})"/><path d="M{x+4},{y+5} h10 M{x+4},{y+9} h7" stroke="#9aa8c0" stroke-width="1.2" transform="rotate({r} {x+11} {y+7})"/>' for x, y, r in [(-34,22,-8),(-10,26,6),(14,20,-14),(-24,8,18),(4,6,-4),(20,-6,22),(-30,-10,-20),(-6,-14,10)])
urna += f'<path d="M-36,-26 L-26,-26 L-40,30Z" fill="#fff" opacity=".5" {NS}/>'
urna += '<rect x="-50" y="-44" width="100" height="14" rx="3" fill="url(#gold)"/><rect x="-50" y="42" width="100" height="12" rx="3" fill="url(#gold)"/>'
urna += '<rect x="-50" y="-34" width="9" height="78" fill="url(#goldH)"/><rect x="41" y="-34" width="9" height="78" fill="url(#goldH)"/>'
urna += '<rect x="-20" y="-41" width="40" height="5" rx="2" fill="#3a2410" stroke-width="1.4"/>'
urna += '<path d="M-24,-60 L-16,-46 L0,-58 L16,-46 L24,-60 L22,-44 L-22,-44Z" fill="url(#gold)"/><circle cx="0" cy="-60" r="3.6" fill="#e8192c" stroke-width="1.4"/><circle cx="-24" cy="-61" r="2.6" fill="#3fa9f5" stroke-width="1.2"/><circle cx="24" cy="-61" r="2.6" fill="#3fa9f5" stroke-width="1.2"/>'
urna += '<path d="M-30,6 L30,6 L30,22 L-30,22Z" fill="#c60b1e" stroke-width="1.8"/><text x="0" y="18" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="10" fill="#fff" stroke="none">MOCIÓN</text>'
urna += f'<path d="M-46,-40 h30" stroke="#fff" stroke-width="2.4" opacity=".7"/>'
svg('itUrna', (-54, -68, 108, 126), urna)
svg('ballot', (-14, -10, 28, 20), '<rect x="-12" y="-8" width="24" height="16" rx="1.5" fill="#fffdf4" stroke="#0a0605" stroke-width="1.4"/><path d="M-7,-3 h11 M-7,2 h8" stroke="#9aa8c0" stroke-width="1.4"/><path d="M6,0 l2,3 l4,-6" stroke="#c60b1e" stroke-width="1.8" fill="none"/>', stroke=False)
svg('confetti', (-5, -3, 10, 6), '<rect x="-4" y="-2" width="8" height="4" rx="1" fill="#fff"/>', stroke=False)
# Pedro gira mareado: estrellita y pajarito de dibujos animados
svg('dizzyBird', (-14, -12, 28, 24), '<path d="M-10,2 Q-10,-8 0,-8 Q10,-8 10,2 Q10,8 0,8 Q-10,8 -10,2Z" fill="#ffd23f"/><path d="M10,-1 L16,1 L10,3Z" fill="#ff9a1f" stroke-width="1.2"/><circle cx="4" cy="-2" r="1.6" fill="#0a0605" stroke="none"/><path d="M-6,0 Q-2,-6 2,0" fill="#f5b400" stroke-width="1.4"/>')
svg('squeak', (-30, -16, 60, 32), '<path d="M-26,-10 L26,-14 L22,12 L-24,14Z" fill="#fff"/><text x="0" y="6" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="15" fill="#e8192c" stroke="none">¡ÑIIC!</text>')

# =====================================================================================
# PUESTO: etiquetas de precio, cartel de neón, bombilla
# =====================================================================================
svg('tag', (-34, -26, 68, 52), '<path d="M-30,-14 L22,-14 L32,0 L22,14 L-30,14Z" fill="#f2e3c2"/><circle cx="22" cy="0" r="3" fill="#5a3a1a" stroke-width="1.2"/><path d="M-26,-10 L18,-10" stroke="#d9c49a" stroke-width="1.4"/>')
svg('tagOwned', (-34, -26, 68, 52), '<path d="M-30,-14 L22,-14 L32,0 L22,14 L-30,14Z" fill="#7ed957"/><circle cx="22" cy="0" r="3" fill="#2e6a14" stroke-width="1.2"/>')
svg('tagPremium', (-40, -26, 80, 52), '<path d="M-36,-15 L26,-15 L37,0 L26,15 L-36,15Z" fill="url(#gold)"/><circle cx="26" cy="0" r="3" fill="#6a4000" stroke-width="1.2"/>')
svg('lock', (-14, -18, 28, 34), '<path d="M-7,-2 V-8 Q-7,-15 0,-15 Q7,-15 7,-8 V-2" stroke-width="4.2" fill="none"/><path d="M-7,-2 V-8 Q-7,-15 0,-15 Q7,-15 7,-8 V-2" stroke="#9aa8c0" stroke-width="1.8" fill="none"/><rect x="-11" y="-3" width="22" height="18" rx="3" fill="url(#gold)"/><circle cy="4" r="2.6" fill="#3a2410" stroke="none"/><path d="M0,5 v5" stroke="#3a2410" stroke-width="2"/>')
svg('lampGlow', (-60, -60, 120, 120), '<defs><radialGradient id="lg"><stop offset="0" stop-color="#fff6cf"/><stop offset=".25" stop-color="#ffd363" stop-opacity=".8"/><stop offset="1" stop-color="#ffb62e" stop-opacity="0"/></radialGradient></defs><circle r="60" fill="url(#lg)"/>', stroke=False)
svg('lampBulb', (-14, -30, 28, 48), '<path d="M-5,-28 V-14 M5,-28 V-14" stroke-width="1.6"/><rect x="-7" y="-16" width="14" height="10" rx="2" fill="url(#steelV)"/><path d="M-7,-6 Q-12,4 -8,10 Q0,18 8,10 Q12,4 7,-6Z" fill="#fff3c2"/><path d="M-3,-2 Q0,4 3,-2" stroke="#d9a400" stroke-width="1.4" fill="none"/>')
neon = f'''<defs><filter id="ng" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>
<rect x="-176" y="-34" width="352" height="68" rx="10" fill="#140a1c" stroke="{INK}" stroke-width="3"/><rect x="-170" y="-28" width="340" height="56" rx="7" fill="none" stroke="#3a2a4c" stroke-width="2"/>
<g font-family="Arial Black,Arial" font-weight="900" font-size="34" text-anchor="middle"><text x="0" y="12" fill="none" stroke="#ff3d8b" stroke-width="7" filter="url(#ng)" opacity=".9">LA TRASTIENDA</text>
<text x="0" y="12" fill="none" stroke="#ffd1e6" stroke-width="2.2">LA TRASTIENDA</text></g>
{bolt(-164,-22,2.6)}{bolt(164,-22,2.6)}{bolt(-164,22,2.6)}{bolt(164,22,2.6)}'''
svg('neonSign', (-180, -38, 360, 76), neon, stroke=False)

# =====================================================================================
# ESCENARIO (720x960): fondo (callejón y trasera del puesto) y primer plano (toldo y mostrador)
# =====================================================================================
random.seed(11)
bricks = ''
for row in range(0, 40):
    y = row * 22; off = 0 if row % 2 else 22
    for col in range(-1, 17):
        x = col * 46 + off; c = random.choice(['#2a1a3a', '#30203f', '#26183a', '#331f42', '#2c1c3c'])
        bricks += f'<rect x="{x+1}" y="{y+1}" width="44" height="20" rx="2" fill="{c}"/>'
bok = ''.join(f'<circle cx="{random.randint(10,120)}" cy="{random.randint(250,620)}" r="{random.randint(5,16)}" fill="{random.choice(["#ffd98a","#7fb6ff","#ff8fa3","#9ff0e8"])}" opacity="{random.uniform(.2,.5):.2f}"/>' for _ in range(16))
bg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960" width="720" height="960">{DEFS[:-7]}
<radialGradient id="spot" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".42"/><stop offset=".6" stop-color="#ff9d5c" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#05030a" stop-opacity="0"/><stop offset="1" stop-color="#05030a" stop-opacity=".95"/></radialGradient>
<linearGradient id="gap" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0b1440"/><stop offset=".6" stop-color="#1f2f7a"/><stop offset="1" stop-color="#0b1236"/></linearGradient>
<linearGradient id="curt" x1="0" x2="1"><stop offset="0" stop-color="#3a0812"/><stop offset=".5" stop-color="#7a1222"/><stop offset="1" stop-color="#3a0812"/></linearGradient>
<linearGradient id="floorG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1c1428"/><stop offset="1" stop-color="#07050c"/></linearGradient>
<filter id="b4"><feGaussianBlur stdDeviation="4"/></filter><filter id="b12"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter></defs>
<rect width="720" height="960" fill="#120a1c"/><g>{bricks}</g>
<rect x="0" y="0" width="720" height="960" fill="#05030a" opacity=".25"/>
<path d="M0,170 L60,170 L60,900 L0,900Z" fill="url(#gap)"/><g filter="url(#b4)">{bok}</g><path d="M0,170 L60,170 L60,900 L0,900Z" fill="#000" opacity=".25"/>
<path d="M60,160 V900" stroke="{INK}" stroke-width="6"/>
<g opacity=".85"><rect x="580" y="90" width="96" height="124" rx="3" fill="#e9dcc0" transform="rotate(4 628 152)"/><text x="628" y="122" text-anchor="middle" font-family="Arial Black,Arial" font-size="17" font-weight="900" fill="#2a1a10" transform="rotate(4 628 152)">SE BUSCA</text>
<circle cx="628" cy="160" r="22" fill="#e02b2b" stroke="{INK}" stroke-width="2" transform="rotate(4 628 152)"/><text x="628" y="203" text-anchor="middle" font-family="Arial" font-size="10" font-weight="700" fill="#2a1a10" transform="rotate(4 628 152)">tomate fugado</text></g>
<g opacity=".7"><rect x="78" y="96" width="110" height="64" rx="3" fill="#ffd23f" transform="rotate(-5 133 128)"/><text x="133" y="122" text-anchor="middle" font-family="Arial Black,Arial" font-size="13" fill="#2a1a10" transform="rotate(-5 133 128)">FERIA DE</text><text x="133" y="142" text-anchor="middle" font-family="Arial Black,Arial" font-size="13" fill="#c60b1e" transform="rotate(-5 133 128)">SAN PEDRO</text></g>
<rect x="70" y="250" width="580" height="420" fill="url(#curt)"/>
{''.join(f'<path d="M{x},250 Q{x+12},460 {x},670" stroke="#2a050c" stroke-width="5" fill="none" opacity=".7"/><path d="M{x+16},250 Q{x+26},460 {x+16},670" stroke="#a52a3c" stroke-width="3" fill="none" opacity=".35"/>' for x in range(84, 650, 38))}
<rect x="60" y="250" width="22" height="650" fill="url(#woodH)" stroke="{INK}" stroke-width="3"/><rect x="638" y="250" width="22" height="650" fill="url(#woodH)" stroke="{INK}" stroke-width="3"/>
<rect x="0" y="860" width="720" height="100" fill="url(#floorG)"/>
{''.join(f'<path d="M{x},{y} q18,-6 36,0" stroke="#2c2240" stroke-width="2" fill="none" opacity=".8"/>' for x in range(0, 720, 40) for y in (884, 912, 940))}
<ellipse cx="520" cy="925" rx="120" ry="14" fill="#ffcf7a" opacity=".12"/><ellipse cx="160" cy="940" rx="90" ry="10" fill="#7fb6ff" opacity=".12"/>
<rect width="720" height="960" fill="url(#spot)"/>
<rect width="720" height="960" filter="url(#noise)"/><rect width="720" height="960" fill="url(#vig)"/>
<rect width="720" height="64" fill="#05030a"/></svg>'''
open('assets/src/bg-shop.svg', 'w').write(bg)

# primer plano: toldo a rayas con festón, mostrador con cartel pintado a mano y peana de terciopelo para la urna
aw = ''
sc = 'M30,250 ' + ''.join(f'Q{30+i*55+27.5},{290} {30+(i+1)*55},250 ' for i in range(12))
for i in range(12):
    x0 = 30 + i * 55; c = '#1d5b3a' if i % 2 == 0 else '#efe4c8'
    aw += f'<path d="M{x0+12},150 L{x0+12+55},150 L{x0+55},250 Q{x0+27.5},290 {x0},250Z" fill="{c}"/>'
aw = f'<g stroke="{INK}" stroke-width="2.6" stroke-linejoin="round">{aw}<path d="M{sc} L690,250" fill="none" stroke-width="3"/><rect x="30" y="140" width="680" height="16" rx="4" fill="url(#woodV)"/></g>'
aw += '<path d="M42,160 L702,160 L690,190 L36,190Z" fill="#000" opacity=".18"/>'
front = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960" width="720" height="960">{DEFS[:-7]}
<filter id="ds"><feGaussianBlur stdDeviation="5"/></filter></defs>
{aw}
<rect x="36" y="664" width="648" height="40" fill="#000" opacity=".3" filter="url(#ds)"/>
<g stroke="{INK}" stroke-width="3" stroke-linejoin="round">
{wood('M40,676 L680,676 L672,880 L48,880Z')}
<path d="M44,736 L676,736 M46,800 L674,800" stroke-width="2" opacity=".55"/>
{wood('M24,648 L696,648 L700,680 L20,680Z', 'woodH')}
<path d="M28,652 H692" stroke="#e8b06a" stroke-width="2.4" opacity=".7"/>
</g>
<g transform="rotate(-2 360 760)" stroke="{INK}" stroke-width="2.6"><rect x="150" y="712" width="420" height="96" rx="6" fill="#f2e3c2"/>
<text x="360" y="750" text-anchor="middle" font-family="Arial Black,Arial" font-size="27" font-weight="900" fill="#c60b1e" stroke="none">GÉNERO DE PRIMERA</text>
<text x="360" y="784" text-anchor="middle" font-family="Arial" font-size="17" font-weight="700" fill="#2a1a10" stroke="none">Pago al contado · No se hacen facturas</text>
<circle cx="164" cy="726" r="4" fill="#9aa8c0" stroke-width="1.4"/><circle cx="556" cy="726" r="4" fill="#9aa8c0" stroke-width="1.4"/></g>
<g stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"><path d="M560,648 Q560,630 580,628 L652,628 Q672,630 672,648Z" fill="#7a1222"/><path d="M572,640 Q614,630 660,640" stroke="#c84a5c" stroke-width="2" fill="none"/>
<rect x="556" y="644" width="120" height="8" rx="3" fill="url(#gold)"/></g>
<g stroke="{INK}" stroke-width="2.6" stroke-linejoin="round">
{wood('M-6,846 L92,846 L92,960 L-6,960Z')}<path d="M-6,846 L92,960 M92,846 L-6,960" stroke-width="2" opacity=".5"/><rect x="-6" y="846" width="98" height="114" fill="none"/>
{wood('M10,786 L78,786 L78,846 L10,846Z')}<text x="44" y="822" text-anchor="middle" font-family="Arial Black,Arial" font-size="11" fill="#3a1a08" stroke="none">FRÁGIL</text>
{wood('M630,872 L730,872 L730,960 L630,960Z')}<text x="680" y="916" text-anchor="middle" font-family="Arial Black,Arial" font-size="12" fill="#3a1a08" stroke="none">NO ABRIR</text>
<path d="M640,884 h80" stroke-width="1.6" opacity=".5"/></g>
<path d="M0,888 L720,888" stroke="#000" stroke-width="2" opacity=".4"/></svg>'''
open('assets/src/fg-shop.svg', 'w').write(front)
print('art-shop ok')
