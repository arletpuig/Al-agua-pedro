# La Trastienda — propuesta de diseño

Puesto clandestino escondido en un callejón detrás de la feria. Lo atiende **Abascal**, que vende seis objetos **permanentes** para lanzar a Pedro. Es el objetivo de la mitad y el final de la partida: en qué gastar las pesetas cuando ya tienes las cartas mejoradas.

## Cómo se llega
- Botón de neón **Trastienda** (gafas de sol) en la esquina superior izquierda de la escena.
- Cerrado hasta tirar a Pedro al agua **300 veces** (unos 5-7 días de juego según `tests/sim-economy.mjs`). Mientras tanto muestra el progreso (`🔒 120/300 caídas`) y al tocarlo: *"Psst... vuelve cuando hayas tirado a Pedro 300 veces"*.
- Al entrar, la feria se funde a negro y aparece el puesto. Los mandos de abajo se sustituyen por la ficha del objeto y **← Volver a la feria**.

## El puesto (dirección de arte)
| Capa | Contenido |
|---|---|
| Fondo (`assets/bg-shop.jpg`) | Pared de ladrillo morado oscuro, rendija con las luces de la feria desenfocadas, carteles "FERIA DE SAN PEDRO" y "SE BUSCA: tomate fugado", cortina de terciopelo granate y suelo de adoquines mojados. |
| Luz | Bombilla colgada que se balancea, halo cálido que respira y parpadea de vez en cuando; motas de polvo flotando. Neón rosa **LA TRASTIENDA** con parpadeo de tubo viejo. |
| Abascal | Tras el mostrador, por capas (cabeza con 8 expresiones, torso, brazos rectos y doblados, gafas de sol). |
| Primer plano (`assets/fg-shop.png`) | Toldo a rayas verde y crema con festón, mostrador de madera con cartel pintado a mano *"GÉNERO DE PRIMERA · Pago al contado · No se hacen facturas"*, peana de terciopelo para la urna y cajas "FRÁGIL" / "NO ABRIR". |
| Objetos | Besugo y pollo de goma colgados del toldo con cordel (se balancean); chancla, tarta, cubo y urna sobre el mostrador. Etiquetas de cartón con el precio; la urna lleva etiqueta dorada, halo y destellos. |

Paleta: noche morada (#120a1c), granate de la cortina (#7a1222), verde del toldo y del chaleco (#1d5b3a / #33503a), dorado de la urna (#ffd23f), rosa neón (#ff3d8b). Mismo trazo negro grueso (2,4) que el resto del juego.

### Abascal
Caricatura: barba cerrada y recortada que domina la cara, pelo muy corto, cejas pobladas, mirada hundida e intensa, nariz recta, cuello ancho. Chaleco acolchado verde sobre camisa blanca remangada, antebrazos velludos y pulsera rojigualda.

| Gesto | Cuándo |
|---|---|
| Respira, balancea la cabeza y parpadea | Siempre |
| Vigila el callejón (mira a un lado y a otro) | Al azar |
| Se baja las gafas de sol, levanta una ceja y se las vuelve a subir | Al entrar y al azar |
| Se acaricia la barba | Al azar |
| Guiño cómplice con destello | Al azar |
| Se frota las manos | Al azar |
| Señala el objeto con la palma abierta y lo ofrece con una frase | Al elegir un objeto |
| Puño en alto, carcajada y gafas abajo; monedas volando y sello ¡TUYO! en la etiqueta | Al comprar |
| Niega con la cabeza, cejas fruncidas | Sin pesetas suficientes |

Frases: *"Psst... ¿buscas algo especial?"*, *"Aquí no hay cámaras. Pasa, pasa."*, *"Todo legal. Más o menos."*, *"Trato hecho. Aquí no ha pasado nada."*, *"Sin pesetas no hay género."*

## Los seis objetos
Comprados una vez, son **para siempre**: aparecen en el **arsenal** (columna de botones a la izquierda de la escena) y se lanzan cuantas veces quieras. Son de exhibición: no dan pesetas ni cuentan como caída, para no desequilibrar la economía. Cada objeto tiene un botón **Probar** (demostración gratuita, `SHOP.FREE_TRY`).

| # | Objeto | Precio | Animación del objeto | Reacción de Pedro |
|---|---|---|---|---|
| 1 | **El Besugo** | 120 ₧ | Vuela girando en curva y se estampa en la cara: **¡PLAF!** Resbala hasta el tablón, coletea cuatro veces y cae a la pecera, donde las pirañas se lo comen. | Latigazo de cabeza, cara de mareo (ojos en espiral, lengua fuera), estrellas y pajarito girando. *"¡Huele a lonja!"* |
| 2 | **La Chancla** | 200 ₧ | Entra en arco desde la derecha girando: **¡ZAS!** en la mejilla y vuelve sola como un bumerán. | Cabeza girada por el golpe, marca roja de chancla en la mejilla que se desvanece; se frota la cara, enfadado. *"¡Ni mi madre me daba así!"* |
| 3 | **El Pollo de Goma** | 320 ₧ | Rebota tres veces en la cabeza con **¡ÑIIC!** cada vez y se le queda de sombrero; al final se cae a la pecera. | La cabeza se aplasta en cada bote, mareado; luego mira el pollo, incrédulo. *"¿Me has tirado un pollo? ¿EN SERIO?"* |
| 4 | **El Tartazo** | 480 ₧ | Llega de frente creciendo: **¡PLOF!** Estallido de nata, el plato se queda pegado un instante y cae. | Careta de nata con los ojos parpadeando, fresa en la cabeza, goterones; se limpia a manotazos en tres pasadas. *"¡Esto es merengue de la oposición!"* |
| 5 | **El Cubo Helado** | 700 ₧ | Baja colgado de una cuerda, tiembla y vuelca agua con cubitos. | Mojado, se congela dentro de un bloque de hielo (tinte azul, castañeteo, escarcha); dos grietas y **¡CRASH!** en esquirlas. *"¡B-b-brrr! ¡Esto es c-c-cambio climático!"* |
| 6 | **La Moción de Censura** | **1,99 € (pago)** | Pantalla a oscuras, redoble y título dorado. La urna dorada baja del cielo con un foco, cae sobre el extremo corto del tablón y lo convierte en catapulta. Explosión de papeletas, sello **¡APROBADA!**, confeti y fuegos artificiales. | Sale disparado al cielo dando vueltas, cae de cabeza en la pecera (gran salpicadura y pirañas desatadas), sale empapado y furioso. *"¡Pienso recurrir al Constitucional!"* |

Precios: unos 2.270 ₧ en total, entre 10 y 12 días de juego a mitad de partida (~200 ₧/día).

## Pendiente fuera del arte
- **Pago real de la Moción de Censura**: no hay pasarela de pago. El botón responde *"Los pagos llegarán próximamente"*. `Shop.grant('mocion')` está preparado para cuando se verifique el pago.
- **Cuentas**: `supabase/schema_v3.sql` añade `shop_items` y `buy_shop_item` (precio y desbloqueo calculados en el servidor). Hay que ejecutarlo en Supabase; sin él, la compra con cuenta muestra *"El servidor todavía no está actualizado"*.
- **Probar gratis**: decidir si se queda libre, se limita (una vez por objeto) o se cambia por un vídeo recompensado.

## Archivos
| Archivo | Qué hace |
|---|---|
| `tools/art-shop.py` | Dibuja en SVG a Abascal, los objetos, los efectos, el fondo y el primer plano del puesto |
| `js/shop.js` | Objetos, precios, desbloqueo, propiedad y compra |
| `js/game/shop-scene.js` | Escena Phaser del puesto |
| `js/game/abascal.js` | Abascal por capas y sus gestos |
| `js/game/arsenal.js` | Animaciones de los objetos y reacciones de Pedro |
| `tests/shop.test.mjs` | Prueba de extremo a extremo de la trastienda |

Para regenerar los gráficos: `python3 tools/art-shop.py && node tools/render.mjs && python3 tools/build-atlas.py`.
