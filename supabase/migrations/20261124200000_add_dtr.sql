create table public.dtr_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  daily_rate numeric(12, 2) not null default 0 check (daily_rate >= 0),
  overtime_rate numeric(12, 2) not null default 0 check (overtime_rate >= 0),
  standard_start time,
  standard_end time,
  scheduled_break_minutes integer not null default 0 check (scheduled_break_minutes between 0 and 1440),
  grace_period_minutes integer not null default 0 check (grace_period_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dtr_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  break_started_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date),
  check (clock_out_at is null or clock_out_at >= clock_in_at),
  check (break_started_at is null or break_started_at >= clock_in_at)
);

alter table public.dtr_settings enable row level security;
alter table public.dtr_entries enable row level security;

create policy "Users can manage their DTR settings"
  on public.dtr_settings for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their DTR entries"
  on public.dtr_entries for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
