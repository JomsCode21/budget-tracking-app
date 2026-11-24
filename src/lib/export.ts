import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';
import { todayLocal } from './dates';

// Supabase returns at most 1000 rows per request, so read in pages.
async function fetchAll(table: string, select = '*', orderBy = 'id'): Promise<any[]> {
  const size = 1000;
  const rows: any[] = [];
  let expectedCount: number | null = null;
  const seenIds = new Set<string>();
  for (let from = 0; ; from += size) {
    const { data, count, error } = await supabase
      .from(table)
      .select(select, { count: 'exact' })
      .order(orderBy, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data) throw new Error(`${table}: Export returned no data.`);
    if (expectedCount === null) expectedCount = count;
    if (count !== null && expectedCount !== count) {
      throw new Error(`${table}: Export data changed while it was being created. Please try again.`);
    }
    for (const row of data as unknown as Record<string, unknown>[]) {
      if (row.id !== undefined && row.id !== null) {
        const id = String(row.id);
        if (seenIds.has(id)) {
          throw new Error(`${table}: Export pagination returned duplicate records. Please try again.`);
        }
        seenIds.add(id);
      }
    }
    rows.push(...data);
    if (data.length < size) {
      if (expectedCount !== null && rows.length !== expectedCount) {
        throw new Error(`${table}: Export data changed while it was being created. Please try again.`);
      }
      break;
    }
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

function csvText(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const protectedValue = /^[\t\r ]*[=+\-@]/.test(s) ? `'${s}` : s;
  return csvCell(protectedValue);
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function exportAmount(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('The export contains an invalid transaction amount.');
  }
  return amount.toFixed(2);
}

export async function exportTransactionsCsv() {
  const rows = await fetchAll(
    'transactions',
    '*, categories(name), accounts(name, currency)'
  );
  const active = rows
    .filter((r) => !r.deleted_at)
    .map((r) => {
      if (!validIsoDate(r.occurred_on)) {
        throw new Error('The export contains an invalid transaction date.');
      }
      if (r.kind !== 'income' && r.kind !== 'expense') {
        throw new Error('The export contains an invalid transaction type.');
      }
      exportAmount(r.amount);
      return r;
    })
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  const header = ['Date', 'Type', 'Amount', 'Currency', 'Account', 'Category', 'Note'];
  const lines = [header.join(',')];
  for (const r of active) {
    lines.push([
      r.occurred_on,
      csvText(r.kind),
      exportAmount(r.amount),
      csvText(r.accounts?.currency),
      csvText(r.accounts?.name),
      csvText(r.categories?.name),
      csvText(r.note),
    ].join(','));
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
  await shareFile(
    `budget-backup-${todayLocal()}.json`,
    JSON.stringify(backup, null, 2),
    'application/json'
  );
  return Object.values(tables).reduce((n, t) => n + t.length, 0);
}