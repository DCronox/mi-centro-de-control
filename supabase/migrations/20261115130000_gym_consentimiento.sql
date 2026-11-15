-- MCC 0.3 · Fase 0: registro del consentimiento explícito para datos de salud de Gym.
-- La Ley 1581 de 2012 (Colombia) trata los datos de salud como sensibles: su tratamiento requiere autorización
-- explícita y facultativa. Se guarda cuándo y qué versión del texto aceptó la persona.
-- Migración aditiva: dos columnas opcionales. No modifica filas existentes (quedan en NULL hasta la próxima
-- vez que la persona guarde su evaluación y autorice). La app funciona sin estas columnas.
alter table public.gym_profiles add column if not exists health_consent_at timestamptz;
alter table public.gym_profiles add column if not exists health_consent_version text
  check (health_consent_version is null or length(health_consent_version) between 1 and 20);

-- Revertir:
-- alter table public.gym_profiles drop column if exists health_consent_version, drop column if exists health_consent_at;
