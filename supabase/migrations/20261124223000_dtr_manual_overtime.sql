alter table public.dtr_entries
  add column if not exists overtime_minutes integer
  check (overtime_minutes is null or overtime_minutes >= 0);
