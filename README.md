# AL AGUA PEDRO

Juego arcade satírico de feria: consigue tomates haciendo clic, lánzalos a la diana y tira a Pedro a la piscina. Gana pesetas, abre cofres y mejora tus cartas.

## Jugar en local
No necesita instalación ni compilación. Sirve la carpeta con cualquier servidor estático:

```
python3 -m http.server 8080
```
y abre http://localhost:8080

## Tecnología
- **Phaser 4** (`vendor/phaser.min.js`) para la escena y las mecánicas.
- HTML + CSS para el HUD y los paneles (tienda, cofres, cartas, ranking, cuenta).
- Web Audio API para efectos y música (sintetizados, sin archivos).
- **Supabase** para cuentas, guardado en la nube y ranking (`supabase/`).

## Estructura
| Carpeta | Contenido |
|---|---|
| `js/game/` | Escena Phaser: `scene.js` (lanzamiento y efectos), `pedro.js` (personaje por capas), `scenery.js` (feria) |
| `js/economy.js` | Reglas de la economía: cartas, cofres, precios, probabilidades |
| `js/play.js` | Clics, lanzamientos múltiples, decisión de caída |
| `js/backend.js` | Cofres, cofre diario y mejoras: en local (invitado) o en el servidor (con cuenta) |
| `js/ads.js` | Interfaz para un futuro proveedor de anuncios recompensados |
| `js/config.js` | Ajustes rápidos (clics por tomate, velocidad, radios de la diana) |
| `assets/src/pedro-ref.png` | Ilustración de referencia de Pedro |
| `assets/parts/`, `assets/img/` | Piezas vectoriales (extremidades, silla, tomate, diana...) |
| `assets/atlas.png/json` | Atlas de texturas que usa el juego (generado) |
| `tools/` | Generación de gráficos |
| `tests/` | Pruebas automáticas |

## Regenerar los gráficos
Tras cambiar la ilustración de referencia o alguna pieza SVG:
```
node tools/render.mjs && python3 tools/build-atlas.py
```
`tools/render.mjs` recorta la cabeza y el busto de la ilustración, compone las 5 expresiones (normal, parpadeo, risa, susto, enfado) y rasteriza las piezas vectoriales.

## Economía (resumen)
- 100 clics = 1 tomate. Los tomates son munición, nunca moneda.
- Impacto perfecto (centro amarillo) = Pedro cae = 1 peseta. Impacto cercano: solo cae con la carta Apagón.
- Cofre de madera: 15 ₧ (uno gratis al día). Cofre de diamante: 80 ₧.
- Cartas: Inflación (común), Joyas de Zapatero y Apagón (raras), Mariscada Sindical (épica), Amnistía (legendaria). Las repetidas dan fragmentos; mejorar cuesta fragmentos y pesetas.
- Simulación de progresión: `node tests/sim-economy.mjs`.

## Pruebas
Ver `tests/README.md`.

## Anuncios recompensados
Todavía no hay proveedor. El Falcón y el Sobre de la Moncloa están preparados pero desactivados. Para integrarlo: implementar la interfaz de `js/ads.js` y completar la función `claim_ad_reward` de `supabase/schema_v2.sql` con la verificación del proveedor.
