# Configurar las cuentas (Supabase)

## Primera vez
1. Entra en https://supabase.com/dashboard y abre tu proyecto.
2. Menú izquierdo → **SQL Editor** → **New query**. Pega TODO el contenido de `schema.sql` y pulsa **Run**.
3. Repite con `schema_v2.sql` (pesetas, cofres, cartas, ranking por tomates) después con `schema_v3.sql` (cofres más baratos, racha de pulsaciones, regalo de bienvenida) `schema_v4.sql` (200 clics por tomate conservando lo ya ganado, cartas con desbloqueo por fragmentos) `schema_v5.sql` (muchos más niveles de cartas, rendimiento decreciente, cartas al máximo fuera de los cofres) y por último `schema_v6.sql` (cartas Plus Ultra, Hacienda Inversa, Puerta Giratoria y Paguitas).
4. **Authentication → URL Configuration**: pon la dirección del juego en **Site URL** y en **Redirect URLs** (por ejemplo `https://arletpuig.github.io/Al-agua-pedro/`).
5. (Opcional) **Authentication → Providers → Email**: desactiva "Confirm email" para entrar sin confirmar el correo.

## Lo más fácil: todo en uno
Ejecuta solo `schema_todo.sql`. Sirve desde cualquier versión (o desde cero), conserva el progreso y se puede repetir sin problema.

## Si ya tenías la versión 5
Solo ejecuta `schema_v6.sql`.

## Si ya tenías la versión 4
Solo ejecuta `schema_v5.sql`.

## Si ya tenías la versión 3
Solo ejecuta `schema_v4.sql`. Conserva los jugadores y su progreso (los tomates ya conseguidos se mantienen).

## Si ya tenías la versión 2
Ejecuta `schema_v3.sql` y después `schema_v4.sql`. Conserva los jugadores y su progreso.

## Si ya tenías la versión 1
Solo el paso 3: ejecuta `schema_v2.sql`. Conserva los jugadores y su progreso. Hazlo a la vez que publicas la nueva versión del juego: la versión antigua del juego no puede guardar con el esquema nuevo, y viceversa.

Las claves que usa el juego están en `js/config.js`: la URL del proyecto y la clave **pública** (publishable/anon), pensada para ir en el navegador. Nunca pongas ahí la clave `service_role`.

## Seguridad aplicada
- Cada usuario solo puede leer su propia fila (RLS). Nadie puede escribir directamente en la tabla.
- `save_progress`: los totales nunca bajan; clics limitados a 25 pulsaciones por segundo (75 con la racha ×3); no se lanzan más tomates de los conseguidos; caídas ≤ impactos ≤ lanzamientos; pesetas ≤ 3 por caída.
- `open_chest`, `claim_daily`, `upgrade_card`: el sorteo, los precios y los descuentos se calculan en el servidor. El cofre diario usa la fecha del servidor (hora peninsular).
- `import_guest`: sube el progreso de invitado una sola vez, a un perfil vacío y con topes.
- `claim_ad_reward`: rechaza siempre hasta que exista un proveedor de anuncios verificado.
- El ranking solo expone nombre de jugador y estadísticas.
