# AL AGUA PEDRO

Juego arcade satírico de feria: consigue tomates haciendo clic, lánzalos a la diana y tira a Pedro a la piscina. Gana pesetas, abre cofres y mejora tus cartas.

## Jugar en local
No necesita instalación ni compilación. Sirve la carpeta con cualquier servidor estático:

```
python3 -m http.server 8080
```
y abre http://localhost:8080

## Cómo se juega
- Pulsa el botón grande **¡DALE!**: cada 200 pulsaciones dan un tomate (la barra del botón muestra el progreso).
- **Racha**: si pulsas mucho seguido, cada toque vale ×2 y luego ×3 (el botón cambia de color). Tarda en aparecer y, si paras, baja poco a poco.
- Elige **×1, ×3, ×5 o ×10**: sale **un solo tomate que vale por todos** y va de lado a lado, en horizontal, por delante de la diana.
- Mientras apuntas, el mismo botón grande se vuelve **¡LANZA!**: púlsalo (o toca la pantalla) cuando el tomate esté sobre el centro. Pedro cae a la pecera y ganas pesetas (por cada tomate del lanzamiento).
- Los tomates se quedan pegados un momento en la diana. Si te quedas cerca, Pedro te provoca (peineta, burla, carcajada: «¡Le tienes que dar al centro, eh! ¡Jajajaja!»). Si fallas por la izquierda, Pedro atrapa el tomate y se lo pone de nariz.
- **Jugadores nuevos**: regalo de bienvenida (5 tomates y 10 pesetas) y los primeros lanzamientos van más despacio.

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
| `js/play.js` | Pulsaciones con racha, lanzamientos (un tiro que vale por N tomates) y decisión de caída |
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
- 200 clics = 1 tomate (antes 100: los tomates ya conseguidos se conservan). Con racha, cada toque vale hasta ×3. Los tomates son munición, nunca moneda.
- Impacto perfecto (centro amarillo) = Pedro cae = 1 peseta. Impacto cercano: solo cae con la carta Apagón.
- Cofre de madera: 8 pesetas (uno gratis al día). Cofre de diamante: 40 pesetas.
- Cartas: Inflación (común), Joyas de Zapatero y Apagón (raras), Mariscada Sindical (épica), Amnistía (legendaria). Para desbloquear una carta hacen falta fragmentos (común 2, rara 3, épica 5, legendaria 6; cada aparición da 1). Ya desbloqueada, cada aparición da más (común y rara 3, épica y legendaria 2). Mejorar cuesta fragmentos y pesetas. Las cartas nuevas se marcan con un punto hasta que las miras.
- Tienda: cofre diario, cofres de madera y diamante, y ofertas con vídeo (pendientes de proveedor).
- Simulación de progresión: `node tests/sim-economy.mjs`.

## Pruebas
Ver `tests/README.md`.

## Anuncios recompensados
Todavía no hay proveedor. El Falcón y el Sobre de la Moncloa están preparados pero desactivados. Para integrarlo: implementar la interfaz de `js/ads.js` y completar la función `claim_ad_reward` de `supabase/schema_v2.sql` con la verificación del proveedor.
