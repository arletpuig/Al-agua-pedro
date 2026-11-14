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
- **Racha**: si pulsas mucho seguido, cada toque vale ×2 (unos 70 toques) y luego ×3 (unos 220). Si paras, se va enseguida.
- Elige cuántos lanzar (las opciones se adaptan a tus tomates: ×1… ×10, ×5… ×20, etc.): sale **un solo tomate que vale por todos** y va de lado a lado, en horizontal, por delante de la diana.
- Mientras apuntas, el mismo botón grande se vuelve **¡LANZA!**: púlsalo (o toca la pantalla) cuando el tomate esté sobre el centro. Pedro cae a la pecera y ganas pesetas (por cada tomate del lanzamiento).
- Los tomates se quedan pegados un momento en la diana. Si fallas, Pedro te provoca (peineta, burla, carcajada) y dice «¡Le tienes que dar al centro, eh! ¡Jajajaja!». En el resto de momentos suelta sus frases típicas al azar. Si fallas por la izquierda, Pedro atrapa el tomate y se lo pone de nariz.
- **Jugadores nuevos**: regalo de bienvenida (5 tomates y 10 pesetas) y los primeros lanzamientos van más despacio.
- **Regalo de bienvenida**: la primera vez que tiras a Pedro al agua baja un cofre en paracaídas (50–60 pesetas, 30–40 tomates y 2 cartas). Se abre viendo un vídeo (de muestra hasta que haya proveedor de anuncios); si no, se queda a la izquierda con una cuenta atrás de 10 minutos y luego desaparece. El servidor solo deja abrirlo una vez y antes de que caduque.
- **Título del perfil**: cada jugador escribe el suyo; de serie sale uno al azar (Azote de Ferraz, Gran anticomunista, Conservador o Antisanchista).
- **Cuenta obligatoria**: para jugar hay que entrar con Google o con correo y contraseña (el progreso se guarda en la nube). Quien tenía partida en el navegador de antes la conserva al crear su cuenta.
- **Perfil** (pestaña con tu bandera): nombre de jugador (único), foto de perfil a elegir entre 35 banderas redondas (España, España con escudo, Tercios, Tercios con águila bicéfala, Cruz cristiana, Cruz de Santiago, Castilla, Castilla y Aragón, León, España con toro, Falange, División Azul, Guardia Civil, La Legión, VOX, Don't Tread On Me y las comunidades autónomas con Ceuta y Melilla), tus números y el botón **Presume de estadísticas**, que crea una imagen 1080×1920 con la escena del juego, Pedro haciendo la peineta, tu bandera, tus estadísticas y la dirección del juego, para compartir o guardar.

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
| `js/avatars.js` | Banderas redondas para la foto de perfil (SVG) |
| `js/share.js` | Imagen para presumir de estadísticas |
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
- Cartas: Puerta Giratoria, Plus Ultra y Apagón (comunes), Mariscada Sindical (poco común), Hacienda Inversa y Paguitas (épicas), Inflación, Joyas de Zapatero y Amnistía (legendarias). Para desbloquear una carta hacen falta fragmentos (común 2, rara 3, épica 5, legendaria 6; cada aparición da 1). Ya desbloqueada, cada aparición da más (común y rara 3, épica y legendaria 2). Mejorar cuesta fragmentos y pesetas (precio = base × nivel^1,5). Niveles máximos: Inflación 30, Joyas 25, Mariscada 25, Apagón 25, Amnistía 20, Plus Ultra 25, Hacienda 20, Puerta 20, Paguitas 15. Plus Ultra a veces devuelve los tomates de un fallo; Hacienda Inversa devuelve parte de cada gasto (del 1,4 % a nivel 1 al 11 % a nivel 20, nunca más del 12 %); Puerta Giratoria da 2 tomates por nivel en cada mejora; Paguitas hace llover 3 pesetas cada 120·0,88^(nivel−1) s (de 120 s a 20 s). Joyas y Mariscada dan cada vez menos por nivel. Apagón agranda el centro de la diana; Amnistía perdona fallos (Pedro cae igual). Las cartas al máximo ya no salen en los cofres (con todo al máximo, cada carta se cambia por 3 pesetas). Las cartas nuevas se marcan con un punto hasta que las miras.
- Tienda: cofre diario, cofres de madera y diamante, y ofertas con vídeo (pendientes de proveedor).
- Simulación de progresión: `node tests/sim-economy.mjs`.

## Pruebas
Ver `tests/README.md`.

## Pagos (Stripe)
Packs de pesetas en la Tienda: Organización criminal 1,99 € (750 pesetas + 300 tomates), Caso Koldo 3,99 € (1.750 + 700) y Financiación ilegal PSOE 9,95 € (5.000 + 2.000 + 4 cartas épicas o legendarias, el de más valor), con bonus de lanzamiento. Pago con Stripe Checkout desde la función `supabase/functions/crear-pago`; las pesetas las entrega solo el webhook `supabase/functions/stripe-webhook` (firma comprobada, una vez por pago). Se encienden con `CONFIG.PAYMENTS` (`js/config.js`). Guía completa: `supabase/STRIPE.md`. Condiciones: `legal/compras.html`.

## Anuncios
- **Interruptor**: los vídeos recompensados están APAGADOS hasta que Google apruebe los anuncios (`CONFIG.REWARDED_ADS` en `js/config.js` y `aap_config.rewarded_ads` en el servidor). Apagados: el regalo de bienvenida se abre sin vídeo, cambiar de bandera es gratis y El Falcón y el Sobre muestran «PRONTO».
- **Vídeos recompensados** (`js/ads.js`): regalo de bienvenida, El Falcón (hasta 6 al día), Sobre de la Moncloa (25 pesetas, hasta 10 al día) y cambiar de bandera (la primera es gratis). Mientras no haya proveedor se usa un vídeo de muestra de 5 segundos. Para el proveedor real: implementar `isAvailable`/`showRewarded` y usar `setAdProvider`. El servidor (`claim_ad_reward`, schema_v10) aplica los límites diarios.
- **Anuncios fijos de AdSense** solo dentro de los paneles de Perfil, Cartas y Tienda (nunca en la pantalla de juego). Se activan poniendo el `data-ad-slot` de cada bloque en `CONFIG.ADSENSE.slots` (`js/config.js`). En la versión de pruebas se ve un recuadro donde irán.
