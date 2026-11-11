# Pruebas automáticas (Playwright)

Con el juego servido en http://localhost:8080 (`python3 -m http.server 8080`):

```
npm i -D playwright   # una vez
node tests/test.mjs        # clics, tomates, lanzamiento, 3 resultados, persistencia
node tests/test-auth.mjs   # flujo de cuenta contra un Supabase simulado
```
Las capturas se guardan en `tests/out/`.
