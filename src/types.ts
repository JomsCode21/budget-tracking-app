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