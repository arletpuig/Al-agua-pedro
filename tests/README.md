# Pruebas automáticas

Necesitan Node y Playwright (`npm i -D playwright`) y el juego servido en http://localhost:8080 (`python3 -m http.server 8080`).

| Comando | Qué comprueba |
|---|---|
| `node tests/game.test.mjs` | Juego completo como invitado: clics, tomates, ×1/×3/×5/×10, precisión, caídas, pesetas, cofres, cofre diario, cartas, potenciadores, anuncios desactivados, persistencia |
| `node tests/layout.test.mjs` | Interfaz en 10 tamaños (móviles, tabletas, escritorio; vertical y apaisado) |
| `sh tests/pg-reset.sh && node tests/cloud.test.mjs` | Parte online de extremo a extremo contra el SQL real en un PostgreSQL local (puerto 5433) |
| `sh tests/pg-reset.sh && psql -h /tmp -p 5433 -U postgres -d aap -f tests/sql-test.sql` | Funciones SQL y permisos |
| `node tests/sim-economy.mjs` | Simulación de 30 días de progresión |

Las capturas se guardan en `tests/out/`.
