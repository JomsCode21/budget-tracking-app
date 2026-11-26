alter table public.dtr_settings
  add column if not exists overtime_end time not null default '18:00';
