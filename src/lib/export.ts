import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';
import { todayLocal } from './dates';

// Supabase returns at most 1000 rows per request, so read in pages.
async function fetchAll(table: string, select = '*', orderBy = 'id'): Promise<any[]> {
  const size = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

async function shareFile(name: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType });
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportTransactionsCsv() {
  const rows = await fetchAll(
    'transactions',
    '*, categories(name), accounts(name, currency)'
  );
  const active = rows
    .filter((r) => !r.deleted_at)
    .sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1));

  const header = ['Date', 'Type', 'Amount', 'Currency', 'Account', 'Category', 'Note'];
  const lines = [header.join(',')];
  for (const r of active) {
    lines.push(
      [
        r.occurred_on,
        r.kind,
        Number(r.amount).toFixed(2),
        r.accounts?.currency,
        r.accounts?.name,
        r.categories?.name,
        r.note,
      ].map(csvCell).join(',')
    );
  }
  // leading BOM so Excel reads the file as UTF-8
  await shareFile(`transactions-${todayLocal()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv');
  return active.length;
}

export async function exportBackupJson() {
  const tables: Record<string, any[]> = {
    accounts: await fetchAll('accounts'),
    categories: await fetchAll('categories'),
    recurring_rules: await fetchAll('recurring_rules'),
    transactions: await fetchAll('transactions'),
    budgets: await fetchAll('budgets'),
    goals: await fetchAll('goals'),
    goal_contributions: await fetchAll('goal_contributions'),
    user_settings: await fetchAll('user_settings', '*', 'user_id'),
    exchange_rates: await fetchAll('exchange_rates'),
  };
  const backup = { app: 'budget-tracker', version: 1, exported_at: new Date().toISOString(), tables };
  await shareFile(`budget-backup-${todayLocal()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  return Object.values(tables).reduce((n, t) => n + t.length, 0);
}