alter table public.dtr_settings
  add column if not exists scheduled_break_start time default '10:00',
  add column if not exists scheduled_break_end time default '11:00';
