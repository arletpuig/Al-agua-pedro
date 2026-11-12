# Genera las piezas vectoriales del escenario (assets/parts/*.svg, assets/img/*.svg y assets/src/bg.svg).
# Después: node tools/render.mjs && python3 tools/build-atlas.py
INK = '#0a0605'; W = 2.4
SUIT, SUITL, SUITD = '#222d56', '#34447e', '#141b38'
SKIN, SKINL, SKIND = '#fdb17c', '#ffcfa4', '#e08a58'
DEFS = f'''<defs>
<linearGradient id="steelH" x1="0" x2="1"><stop offset="0" stop-color="#2c3650"/><stop offset=".3" stop-color="#b9c6da"/><stop offset=".55" stop-color="#7c8aa6"/><stop offset="1" stop-color="#222a40"/></linearGradient>
<linearGradient id="steelV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c3cfe2"/><stop offset=".45" stop-color="#7f8daa"/><stop offset="1" stop-color="#262e46"/></linearGradient>
<linearGradient id="woodV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e2a55e"/><stop offset=".5" stop-color="#b97a3c"/><stop offset="1" stop-color="#7c4a1e"/></linearGradient>
<linearGradient id="woodH" x1="0" x2="1"><stop offset="0" stop-color="#8a5526"/><stop offset=".4" stop-color="#d09252"/><stop offset="1" stop-color="#8f5a2a"/></linearGradient>
<linearGradient id="suitH" x1="0" x2="1"><stop offset="0" stop-color="{SUITD}"/><stop offset=".4" stop-color="{SUITL}"/><stop offset="1" stop-color="{SUITD}"/></linearGradient>
<linearGradient id="suitV" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="{SUITL}"/><stop offset="1" stop-color="{SUITD}"/></linearGradient>
<radialGradient id="skinR" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="{SKINL}"/><stop offset=".6" stop-color="{SKIN}"/><stop offset="1" stop-color="{SKIND}"/></radialGradient>
<radialGradient id="tomR" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="#ff8a6e"/><stop offset=".45" stop-color="#ee2f2a"/><stop offset="1" stop-color="#8f0f12"/></radialGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.42" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .12  0 0 0 0 .03  0 0 0 -1.5 1.02"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="grainV" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.42 0.012" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .12  0 0 0 0 .03  0 0 0 -1.5 1.02"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="3"/></filter><filter id="soft8"><feGaussianBlur stdDeviation="8"/></filter>
</defs>'''
def svg(folder, name, vb, body, stroke=True):
    x, y, w, h = vb
    g = f'<g stroke="{INK}" stroke-width="{W}" stroke-linejoin="round" stroke-linecap="round">{body}</g>' if stroke else body
    open(f'assets/{folder}/{name}.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" width="{w}" height="{h}">{DEFS}{g}</svg>')
NS = 'stroke="none"'
def bolt(x, y, r=3.2): return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#d5deec" stroke-width="1.4"/><circle cx="{x-r*.3}" cy="{y-r*.3}" r="{r*.35}" fill="#fff" {NS}/>'
def wood(d, grad='woodV', grain='grain'): return f'<path d="{d}" fill="url(#{grad})"/><path d="{d}" fill="#fff" {NS} filter="url(#{grain})"/>'

# ---------------- TORRE (origen: centro de la base, y=0 suelo) ----------------
def brace(x1, y1, x2, y2): return f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{INK}" stroke-width="15" fill="none"/><path d="M{x1},{y1} L{x2},{y2}" stroke="#b97a3c" stroke-width="10.5" fill="none"/><path d="M{x1},{y1} L{x2},{y2}" stroke="#e2a55e" stroke-width="3" fill="none" opacity=".7" transform="translate(-2,-2)"/>'
lx = lambda y: -58 + 34 * (-y / 468)   # eje de la pata izquierda a la altura y
tower = ''
tower += f'<rect x="-9" y="-742" width="18" height="290" rx="4" fill="url(#steelH)"/><circle cx="0" cy="-744" r="10" fill="#e3262e"/><circle cx="-3" cy="-747" r="3" fill="#fff" opacity=".7" {NS}/>'
tower += f'<rect x="0" y="-648" width="100" height="14" rx="4" fill="url(#steelV)"/><rect x="12" y="-634" width="6" height="170" fill="#55617c" stroke-width="1.6"/><circle cx="15" cy="-470" r="7" fill="#e3262e" stroke-width="1.8"/>'
for a, b in [(-24, -216), (-250, -444)]:
    tower += brace(lx(a) + 6, a, -lx(b) - 6, b) + brace(-lx(a) - 6, a, lx(b) + 6, b)
tower += f'<path d="M-66,0 L-50,0 L-16,-468 L-32,-468Z" fill="url(#steelH)"/><path d="M66,0 L50,0 L16,-468 L32,-468Z" fill="url(#steelH)"/>'
for y in (-232, -456): tower += f'<rect x="{lx(y)-6}" y="{y-7}" width="{-2*lx(y)+12}" height="14" rx="3" fill="url(#steelV)"/>' + bolt(lx(y), y) + bolt(-lx(y), y)
tower += f'<rect x="-80" y="-8" width="40" height="10" rx="3" fill="url(#steelV)"/><rect x="40" y="-8" width="40" height="10" rx="3" fill="url(#steelV)"/>' + bolt(-70, -3, 2.4) + bolt(-50, -3, 2.4) + bolt(50, -3, 2.4) + bolt(70, -3, 2.4)
tower += f'<rect x="-40" y="-474" width="80" height="10" rx="3" fill="url(#steelV)"/>'
svg('parts', 'tower', (-84, -758, 190, 764), tower)
# puntal que sujeta el tablón (pivote en la torre, apunta hacia +x)
svg('parts', 'strut', (-10, -10, 214, 20), f'<rect x="-6" y="-6" width="204" height="12" rx="6" fill="url(#steelV)"/>' + bolt(0, 0, 4) + bolt(192, 0, 4))
# tablón (pivote: bisagra)
P = 'M-330,-11 L82,-11 L82,11 L-330,11Z'
plank = wood(P) + f'<path d="M-200,-11 v22 M-60,-11 v22" stroke-width="1.4" opacity=".55"/><path d="M-326,-7 H78" stroke="#f4c88c" stroke-width="2" opacity=".6"/>'
plank += f'<clipPath id="hz"><rect x="-314" y="2" width="70" height="9"/></clipPath><g clip-path="url(#hz)" {NS}><rect x="-314" y="2" width="70" height="9" fill="#ffd21f"/>' + ''.join(f'<path d="M{-320+i*14},11 l9,-9 h7 l-9,9Z" fill="#1a1a1a"/>' for i in range(6)) + '</g>'
plank += f'<rect x="-334" y="-13" width="14" height="26" rx="3" fill="url(#steelH)"/><rect x="-22" y="-14" width="44" height="28" rx="5" fill="url(#steelV)"/><circle cx="0" cy="0" r="6.5" fill="#39435c"/>' + bolt(-14, -7, 2.4) + bolt(14, -7, 2.4) + bolt(-14, 7, 2.4) + bolt(14, 7, 2.4)
svg('parts', 'plank', (-338, -17, 424, 34), plank)

# ---------------- PECERA (260x200) ----------------
back = f'''<defs><linearGradient id="wat" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3fd6e6"/><stop offset=".45" stop-color="#1593c4"/><stop offset="1" stop-color="#0a4a86"/></linearGradient>
<filter id="caus" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.035 0.06" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.2 -1.25"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<clipPath id="wc"><rect x="8" y="30" width="244" height="156"/></clipPath></defs>
<rect x="6" y="4" width="248" height="184" fill="#9fd8ff" opacity=".13" {NS}/>
<rect x="8" y="30" width="244" height="156" fill="url(#wat)" {NS}/>
<g clip-path="url(#wc)" {NS}><rect x="8" y="30" width="244" height="156" fill="#fff" filter="url(#caus)" opacity=".2"/>
<path d="M40,30 L70,30 L30,186 L-20,186Z M120,30 L140,30 L120,186 L86,186Z M190,30 L226,30 L236,186 L186,186Z" fill="#fff" opacity=".1"/>
<path d="M8,186 V172 Q30,164 52,170 Q80,160 110,168 Q140,160 170,169 Q200,162 226,168 Q242,165 252,170 V186Z" fill="#d9b779"/><path d="M8,186 V176 Q40,170 70,176 Q110,168 150,176 Q200,170 252,176 V186Z" fill="#b08a4e"/></g>
<g stroke-width="1.6"><path d="M150,168 q8,-6 16,0 q8,6 16,0" fill="none" stroke="#f1ead8" stroke-width="5"/><circle cx="148" cy="168" r="4.5" fill="#f1ead8"/><circle cx="184" cy="168" r="4.5" fill="#f1ead8"/>
<path d="M60,160 L72,158 L78,176 L70,182 L62,176Z" fill="#e3262e"/><path d="M60,160 L72,158 L70,152 L62,153Z" fill="#b3171d"/></g>'''
svg('parts', 'tankBack', (0, 0, 260, 200), back, stroke=False)
front = f'''<rect x="8" y="30" width="244" height="156" fill="#46c8e8" opacity=".16" {NS}/>
<path d="M22,14 L64,14 L14,150 L14,60Z" fill="#fff" opacity=".16" {NS}/><path d="M84,14 L98,14 L40,186 L26,186Z" fill="#fff" opacity=".1" {NS}/><path d="M236,60 L246,40 L246,150 L236,170Z" fill="#fff" opacity=".12" {NS}/>
<rect x="0" y="0" width="12" height="190" rx="3" fill="url(#steelH)"/><rect x="248" y="0" width="12" height="190" rx="3" fill="url(#steelH)"/><rect x="0" y="0" width="260" height="11" rx="4" fill="url(#steelV)"/>
<rect x="-6" y="182" width="272" height="20" rx="5" fill="url(#steelV)"/>''' + ''.join(bolt(x, 192, 2.6) for x in (6, 40, 220, 254)) + bolt(6, 6, 2.4) + bolt(254, 6, 2.4) + f'''
<rect x="92" y="184" width="76" height="16" rx="3" fill="#e9b949" stroke-width="1.6"/><text x="130" y="196" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="10" fill="#5a3a00" {NS}>PIRAÑAS</text>'''
svg('parts', 'tankFront', (-8, -2, 276, 206), front)

# ---------------- PIRAÑA ----------------
body = f'''<defs><linearGradient id="pb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3fb3b8"/><stop offset=".55" stop-color="#1d6f80"/><stop offset="1" stop-color="#134a5c"/></linearGradient>
<linearGradient id="pr" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff7a3c"/><stop offset="1" stop-color="#d8261c"/></linearGradient></defs>
<path d="M-12,-23 Q0,-42 14,-24Z" fill="#17596a"/>
<path d="M-36,0 C-30,-24 4,-30 26,-20 C38,-14 43,-6 43,1 L24,6 C18,19 -14,24 -36,0Z" fill="url(#pb)"/>
<path d="M-33,2 C-14,21 14,19 24,6 C8,11 -14,9 -33,2Z" fill="url(#pr)" stroke-width="1.2"/>
<g fill="none" stroke="#0d3b4a" stroke-width="1.2" opacity=".45"><path d="M-18,-8 q5,5 0,10 M-8,-12 q5,5 0,10 M-8,0 q5,5 0,9 M2,-14 q5,5 0,10 M2,-3 q5,5 0,9"/></g>
<ellipse cx="-2" cy="-19" rx="15" ry="3.5" fill="#fff" opacity=".35" {NS}/>
<path d="M26,4.5 l3,6 l3,-6.6 l3,5.6 l3,-6.4 l2.6,4.8 l2.4,-5.6" fill="#fff" stroke-width="1.1"/>
<path d="M-2,7 Q-13,19 5,14Z" fill="#ff9a4a" stroke-width="1.6"/>
<circle cx="22" cy="-8" r="8.2" fill="#fff" stroke-width="1.8"/><circle cx="24.5" cy="-7" r="3.4" fill="{INK}" {NS}/><circle cx="23.2" cy="-8.4" r="1.2" fill="#fff" {NS}/>
<path d="M11,-18 L31,-12" stroke-width="4.2"/>'''
svg('parts', 'fishBody', (-40, -44, 88, 70), body)
svg('parts', 'fishJaw', (-6, -9, 36, 26), f'''<path d="M0,-2 L24,-5 Q31,3 22,11 Q8,15 -3,7Z" fill="#c9301f"/><path d="M4,-2 l2.4,-5.4 l2.6,5 l2.6,-5.6 l2.6,5.2 l2.6,-5.6 l2.6,5.2 l2.4,-5 l1.8,4.6" fill="#fff" stroke-width="1.1"/>''')
svg('parts', 'fishTail', (-26, -20, 30, 40), f'''<path d="M2,0 L-21,-17 Q-13,0 -21,17Z" fill="#1d6f80"/><path d="M-4,0 L-16,-8 M-4,0 L-16,8 M-3,0 H-15" stroke-width="1.1" opacity=".6"/>''')
svg('img', 'bubble', (-8, -8, 16, 16), f'<circle r="6" fill="#cfefff" fill-opacity=".25" stroke="#e8fbff" stroke-width="1.4"/><circle cx="-2" cy="-2" r="1.6" fill="#fff"/>', stroke=False)

# ---------------- DIANA Y BOMBILLA ----------------
tg = f'''<defs><radialGradient id="tsh"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>
<radialGradient id="rimg" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#eef3fb"/><stop offset=".5" stop-color="#8c9bb8"/><stop offset="1" stop-color="#2a3350"/></radialGradient><clipPath id="tc"><circle r="88"/></clipPath></defs>
<circle r="97" fill="url(#rimg)"/><circle r="88" fill="#fff8ea"/><circle r="70" fill="#e3262e" stroke-width="1.6"/><circle r="52" fill="#fff8ea" stroke-width="1.6"/><circle r="33" fill="#e3262e" stroke-width="1.8"/>
<path d="M0,-13 L3.8,-4.4 L13,-3.6 L6,2.6 L8.2,11.6 L0,6.8 L-8.2,11.6 L-6,2.6 L-13,-3.6 L-3.8,-4.4Z" fill="#ffd21f" stroke-width="1.6"/>
<circle r="88" fill="url(#tsh)" {NS}/><g clip-path="url(#tc)" {NS}><ellipse cx="-34" cy="-46" rx="62" ry="30" fill="#fff" opacity=".2" transform="rotate(-32 -34 -46)"/></g>'''
svg('img', 'target', (-100, -100, 200, 200), tg)
svg('img', 'bulb', (-16, -16, 32, 32), f'<defs><radialGradient id="bg1"><stop offset="0" stop-color="#fff6cf"/><stop offset=".3" stop-color="#ffd363" stop-opacity=".9"/><stop offset="1" stop-color="#ffb62e" stop-opacity="0"/></radialGradient></defs><circle r="16" fill="url(#bg1)"/><circle r="5" fill="#fff3c2" stroke="{INK}" stroke-width="1.2"/><circle cx="-1.5" cy="-1.5" r="1.6" fill="#fff"/>', stroke=False)
svg('img', 'tomato', (-22, -25, 44, 48), f'<circle cy="2" r="18" fill="url(#tomR)"/><path d="M-11,3 Q-12,-8 -3,-11" stroke="#fff" stroke-width="3.2" fill="none" opacity=".55"/><path d="M-10,-13 Q-4,-9 0,-15 Q4,-9 10,-13 Q7,-6 0,-7 Q-7,-6 -10,-13Z" fill="#4db85a" stroke-width="1.6"/><path d="M0,-15 Q1,-20 4,-22" stroke-width="3.4" fill="none"/><path d="M0,-15 Q1,-20 4,-22" stroke="#3a8f45" stroke-width="1.6" fill="none"/>')

# ---------------- PEDRO: piezas del cuerpo con volumen ----------------
svg('parts', 'hips', (-72, -16, 144, 56), f'''<path d="M-66,-12 L-4,-12 L-3,20 Q-4,36 -22,36 L-46,36 Q-66,36 -66,18Z" fill="url(#suitV)"/><path d="M66,-12 L4,-12 L3,20 Q4,36 22,36 L46,36 Q66,36 66,18Z" fill="url(#suitV)"/>
<path d="M-56,-4 Q-58,14 -50,26 M14,-4 Q12,14 20,26" stroke="#4a5c9c" stroke-width="4" fill="none" opacity=".6"/><path d="M-30,-10 Q-26,4 -34,14 M30,-10 Q26,4 34,14" stroke-width="1.3" fill="none" opacity=".6"/>''')
svg('parts', 'shin', (-26, -10, 52, 122), f'''<path d="M-17,-6 L17,-6 L15,74 L-15,74Z" fill="url(#suitH)"/><path d="M-6,4 Q-9,36 -5,66" stroke-width="1.3" fill="none" opacity=".55"/><path d="M8,10 Q10,30 7,50" stroke-width="1.3" fill="none" opacity=".4"/>
<rect x="-13" y="72" width="26" height="8" fill="#2b2b33" stroke-width="1.6"/>
<path d="M-17,82 Q-19,78 0,78 Q19,78 17,82 L21,100 Q22,110 0,110 Q-22,110 -21,100Z" fill="#17171c"/><path d="M-12,86 Q-2,81 10,86" stroke="#6b6b78" stroke-width="2.4" fill="none"/><path d="M-21,102 Q0,108 21,102" stroke="#3a2a1c" stroke-width="2" fill="none"/>''')
def hand(cy, up=False):
    s = -1 if up else 1
    return f'<path d="M-13,{cy-8*s} Q-17,{cy+6*s} -10,{cy+14*s} Q0,{cy+20*s} 10,{cy+14*s} Q17,{cy+6*s} 13,{cy-8*s}Z" fill="url(#skinR)"/><path d="M-5,{cy+16*s} Q-4,{cy+8*s} -5,{cy+3*s} M1,{cy+17.5*s} Q2,{cy+9*s} 1,{cy+4*s} M7,{cy+15.5*s} Q8,{cy+8*s} 7,{cy+3*s}" stroke-width="1.3" fill="none"/><path d="M13,{cy-4*s} Q20,{cy} 15,{cy+8*s}" fill="{SKIN}" stroke-width="1.6"/>'
svg('parts', 'forearm', (-24, -18, 48, 116), f'''<rect x="-17" y="-13" width="34" height="74" rx="15" fill="url(#suitH)"/><path d="M-6,0 Q-8,28 -5,50 M8,6 Q9,24 7,40" stroke-width="1.3" fill="none" opacity=".5"/>
<rect x="-15.5" y="55" width="31" height="10" rx="3.5" fill="#fff"/>{hand(74)}''')
svg('parts', 'armUp', (-28, -150, 56, 168), f'''<rect x="-17" y="-74" width="34" height="88" rx="15" fill="url(#suitH)"/><path d="M-6,0 Q-8,-30 -5,-60" stroke-width="1.3" fill="none" opacity=".5"/><rect x="-15.5" y="-82" width="31" height="10" rx="3.5" fill="#fff"/>
<rect x="-7" y="-146" width="14" height="48" rx="7" fill="url(#skinR)"/><path d="M-3.5,-134 h7 M-3.5,-122 h7" stroke="{SKIND}" stroke-width="1.3"/><path d="M-3,-143 Q0,-145 3,-143" stroke="#fff" stroke-width="1.6" opacity=".7" fill="none"/>
<path d="M-19,-104 Q-20,-112 -12,-112 L12,-112 Q20,-112 19,-104 L17,-86 Q15,-78 0,-78 Q-15,-78 -17,-86Z" fill="url(#skinR)"/>
<path d="M-19,-100 Q-13,-110 -8,-102 M8,-102 Q13,-110 19,-100 M-10,-88 Q0,-84 10,-88" stroke-width="1.5" fill="none"/><path d="M-19,-96 Q-25,-92 -20,-84" fill="{SKIN}" stroke-width="1.6"/>''')
# fondo del escenario (720x960), sin contorno
import random; random.seed(5)
bok = ''.join(f'<circle cx="{random.randint(20,700)}" cy="{random.randint(30,560)}" r="{random.randint(8,26)}" fill="{random.choice(["#ffd98a","#7fb6ff","#ff8fa3","#9ff0e8"])}" opacity="{random.uniform(.05,.16):.2f}"/>' for _ in range(26))
bg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960" width="720" height="960"><defs>
<radialGradient id="sky" cx=".37" cy=".36" r=".85"><stop offset="0" stop-color="#2c4fb5"/><stop offset=".45" stop-color="#15286e"/><stop offset="1" stop-color="#070c24"/></radialGradient>
<linearGradient id="cone" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff2c9" stop-opacity=".5"/><stop offset="1" stop-color="#fff2c9" stop-opacity="0"/></linearGradient>
<linearGradient id="floor" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1a2c6e"/><stop offset=".25" stop-color="#0c1740"/><stop offset="1" stop-color="#050919"/></linearGradient>
<radialGradient id="pool"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#070c24" stop-opacity="0"/><stop offset="1" stop-color="#070c24" stop-opacity="1"/></radialGradient>
<filter id="b10"><feGaussianBlur stdDeviation="10"/></filter><filter id="b5"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter></defs>
<rect width="720" height="960" fill="url(#sky)"/><g filter="url(#b5)">{bok}</g>
<path d="M226,-40 L306,-40 L446,900 L46,900Z" fill="url(#cone)" filter="url(#b10)" opacity=".5"/><path d="M616,-40 L676,-40 L736,560 L446,560Z" fill="url(#cone)" filter="url(#b10)" opacity=".22"/>
<rect y="888" width="720" height="72" fill="url(#floor)"/><rect y="886" width="720" height="3" fill="#6f8fe6" opacity=".5"/>
<ellipse cx="290" cy="902" rx="290" ry="34" fill="url(#pool)"/>
<rect width="720" height="960" filter="url(#noise)"/><rect width="720" height="960" fill="url(#vig)"/>
<linearGradient id="eL" x1="0" x2="1"><stop offset="0" stop-color="#070c24"/><stop offset="1" stop-color="#070c24" stop-opacity="0"/></linearGradient><linearGradient id="eT" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#070c24"/><stop offset="1" stop-color="#070c24" stop-opacity="0"/></linearGradient>
<rect width="60" height="960" fill="url(#eL)"/><rect x="660" width="60" height="960" fill="url(#eL)" transform="rotate(180 690 480)"/><rect width="3" height="960" fill="#070c24"/><rect x="717" width="3" height="960" fill="#070c24"/><rect y="956" width="720" height="4" fill="#070c24"/><rect y="60" width="720" height="60" fill="url(#eT)"/><rect width="720" height="62" fill="#070c24"/><rect y="930" width="720" height="30" fill="url(#eT)" transform="rotate(180 360 945)"/></svg>'''
open('assets/src/bg.svg', 'w').write(bg)
print('art ok')
