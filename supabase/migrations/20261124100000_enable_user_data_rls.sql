-- Every row written by the mobile client must belong to the authenticated user.
-- Apply this migration to the Supabase project before releasing the client.

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.user_settings enable row level security;
alter table public.exchange_rates enable row level security;

create policy "Users can manage their accounts"
  on public.accounts for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their categories"
  on public.categories for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their recurring rules"
  on public.recurring_rules for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their transactions"
  on public.transactions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their budgets"
  on public.budgets for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their goals"
  on public.goals for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their goal contributions"
  on public.goal_contributions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their settings"
  on public.user_settings for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can manage their exchange rates"
  on public.exchange_rates for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
