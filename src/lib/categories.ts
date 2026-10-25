import { supabase } from './supabase';

const DEFAULTS = [
  { name: 'Food', kind: 'expense' },
  { name: 'Transport', kind: 'expense' },
  { name: 'Bills', kind: 'expense' },
  { name: 'Shopping', kind: 'expense' },
  { name: 'Health', kind: 'expense' },
  { name: 'Entertainment', kind: 'expense' },
  { name: 'Other', kind: 'expense' },
  { name: 'Salary', kind: 'income' },
  { name: 'Allowance', kind: 'income' },
  { name: 'Other income', kind: 'income' },
];

export async function ensureDefaultCategories() {
  const { count, error } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true });
  if (error || (count ?? 0) > 0) return;
  await supabase.from('categories').insert(DEFAULTS);
}