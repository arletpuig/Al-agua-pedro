# AL AGUA PEDRO

Juego arcade satírico de feria: consigue tomates haciendo clic, lánzalos a la diana y tira a Pedro a la piscina. Gana pesetas, abre cofres y mejora tus cartas.

## Jugar en local
No necesita instalación ni compilación. Sirve la carpeta con cualquier servidor estático:

```
python3 -m http.server 8080
```
y abre http://localhost:8080

## Cómo se juega
- Pulsa **¡DALE!**: cada 100 pulsaciones dan un tomate (el anillo dorado muestra el progreso).
- Elige ×1, ×3, ×5 o ×10 y pulsa **LANZAR**. El tomate va de lado a lado, solo en horizontal y despacio, por delante de la diana.
- Toca la pantalla (o **¡AHORA!**) cuando esté sobre el centro: Pedro cae a la pecera de las pirañas y ganas pesetas.
- Si te quedas cerca, Pedro se tambalea y te provoca: peineta, burla con la lengua fuera o carcajada, con frases como «¡Le tienes que dar al centro, eh! ¡Jajajaja!». Si fallas del todo, a veces atrapa el tomate y se lo pone de nariz.

## Tecnología
- **Canvas 2D** sin motor ni dependencias: escenario, Pedro animado, puntería y efectos (`js/game/`).
- HTML + CSS para la interfaz (marcador, botones, paneles, apertura de cofres).
- Web Audio API para efectos y música (sintetizados, sin archivos).
- **Supabase** para cuentas, guardado en la nube y ranking (`supabase/`).

## Estructura
| Carpeta | Contenido |
|---|---|
| `js/game/arena.js` | Escena del juego: puntería, lanzamientos, reacciones de Pedro, caída a la pecera, bocadillos y partículas |
| `js/game/pedro-rig.js` | Pedro de cuerpo entero: cabeza de la ilustración + cuerpo, brazos, manos, piernas y cara animables |
| `js/game/pedro-anims.js` | Animaciones por fotogramas clave (espera paseando, peineta, burla, risa, tomate en la nariz, caída, en el agua...) |
| `js/game/stage-art.js` | Escenario: plató, foco, torre, trampolín, diana con bombillas y pecera con pirañas |
| `js/ui.js`, `css/style.css` | Interfaz |
| `js/play.js` | Pulsaciones, lanzamientos múltiples y decisión de caída |
| `js/economy.js` | Reglas de la economía: cartas, cofres, precios, probabilidades |
| `js/backend.js` | Cofres, cofre diario y mejoras: en local (invitado) o en el servidor (con cuenta) |
| `js/config.js` | Ajustes rápidos (pulsaciones por tomate, velocidad de puntería, tamaño de la zona de acierto) |
| `assets/src/pedro-ref.png` | Ilustración de referencia de Pedro |
| `assets/pedro/` | Capas de la cabeza (generadas con `tools/pedro-parts.py`) |
| `tools/` | Generación de las capas de Pedro, página de pruebas de animación (`pedro-demo.html`) y grabación de vídeos |
| `tests/` | Pruebas automáticas |

## Regenerar las capas de Pedro
Tras cambiar la ilustración de referencia: `python3 tools/pedro-parts.py` (necesita `opencv-python-headless` y `numpy`).

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
