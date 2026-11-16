#!/usr/bin/env python3
"""Pone la versión N en todo el juego: python3 tools/version.py 53

- index.html: los ?v=N de estilos e iconos, el texto «versión N» y el mapa de importación,
  que hace que TODOS los módulos (js/*.js, js/game/*.js) se pidan con ?v=N. Así ningún móvil
  mezcla código viejo guardado con código nuevo.
- sw.js: el nombre de la caché (aap-vN), para que el service worker tire lo guardado antes.
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
v = int(sys.argv[1])
mods = sorted(p.relative_to(root).as_posix() for p in (root / 'js').rglob('*.js'))
imap = {'imports': {f'./{m}': f'./{m}?v={v}' for m in mods}}
block = ('<!-- versión de cada módulo (lo genera tools/version.py): nadie se queda con código viejo guardado -->\n'
         f'<script type="importmap">{json.dumps(imap, separators=(",", ":"))}</script>\n')

p = root / 'index.html'; s = p.read_text()
s = re.sub(r'<!-- versión de cada módulo[^\n]*\n<script type="importmap">[^\n]*</script>\n', '', s)
s = re.sub(r'\?v=\d+\b', f'?v={v}', s)
s = re.sub(r'versión \d+', f'versión {v}', s)
i = s.index('<script type="module" src="js/main.js')
s = s[:i] + block + s[i:]
p.write_text(s)

p = root / 'sw.js'; s = p.read_text()
s = re.sub(r"const CACHE = 'aap-v\d+';", f"const CACHE = 'aap-v{v}';", s)
p.write_text(s)
print(f'versión {v}: {len(mods)} módulos')
