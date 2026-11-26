export type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  opening_balance: number;
};

export type Kind = 'income' | 'expense';

export type Category = {
  id: string;
  name: string;
  kind: Kind;
};

export type Transaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  kind: Kind;
  amount: number;
  note: string | null;
  occurred_on: string;
  categories: { name: string } | null;
  accounts: { name: string; currency: string } | null;
};

export type Budget = {
  id: string;
  category_id: string;
  month: string;
  amount: number;
};

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  deadline: string | null;
}

export type RecurringRule = {
  id: string;
  name: string;
  account_id: string;
  category_id: string | null;
  kind: Kind;
  amount: number;
  frequency: 'weekly' | 'monthly';
  anchor_day: number;
  next_due: string;
  active: boolean;
  categories?: { name: string } | null;
  accounts?: { name: string; currency: string } | null;
};

export type DtrSettings = {
  user_id: string;
  daily_rate: number;
  overtime_rate: number;
  standard_start: string | null;
  standard_end: string | null;
  overtime_end: string | null;
  scheduled_break_start: string | null;
  scheduled_break_end: string | null;
  scheduled_break_minutes: number;
  grace_period_minutes: number;
};

export type DtrEntry = {
  id: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_started_at: string | null;
  break_minutes: number;
  overtime_minutes: number | null;
  note: string | null;
};