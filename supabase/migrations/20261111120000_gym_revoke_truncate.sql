-- Gym · Fase I (validación): margen de seguridad adicional.
-- Supabase concede TRUNCATE a `authenticated` en las tablas nuevas por defecto. La API REST no permite TRUNCATE,
-- pero se retira igualmente para que nadie con sesión pueda vaciar una tabla completa por otra vía.
-- No cambia datos ni políticas; solo retira un permiso que la app no usa. Las tablas posteriores ya lo traían retirado.
revoke truncate on table
  public.gym_exercises, public.gym_routines, public.gym_sessions, public.gym_sets, public.body_metrics,
  public.gym_profiles, public.nutrition_targets
from authenticated;

-- Revertir:
-- grant truncate on table public.gym_exercises, public.gym_routines, public.gym_sessions, public.gym_sets,
--   public.body_metrics, public.gym_profiles, public.nutrition_targets to authenticated;
