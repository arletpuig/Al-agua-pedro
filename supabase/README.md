# Configurar las cuentas (Supabase)

## Primera vez
1. Entra en https://supabase.com/dashboard y abre tu proyecto.
2. Menú izquierdo → **SQL Editor** → **New query**. Pega TODO el contenido de `schema.sql` y pulsa **Run**.
3. Repite con `schema_v2.sql` (pesetas, cofres, cartas, ranking por tomates) y después con `schema_v3.sql` (cofres más baratos, racha de pulsaciones, regalo de bienvenida).
4. **Authentication → URL Configuration**: pon la dirección del juego en **Site URL** y en **Redirect URLs** (por ejemplo `https://arletpuig.github.io/Al-agua-pedro/`).
5. (Opcional) **Authentication → Providers → Email**: desactiva "Confirm email" para entrar sin confirmar el correo.

## Si ya tenías la versión 2
Solo ejecuta `schema_v3.sql`. Conserva los jugadores y su progreso.

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
