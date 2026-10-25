import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

// Order matters: parents before the tables that reference them.
const PLAN: { table: string; conflict: string; dropId?: boolean }[] = [
  { table: 'accounts', conflict: 'id' },
  { table: 'categories', conflict: 'id' },
  { table: 'recurring_rules', conflict: 'id' },
  { table: 'transactions', conflict: 'id' },
  { table: 'budgets', conflict: 'user_id,category_id,month', dropId: true },
  { table: 'goals', conflict: 'id' },
  { table: 'goal_contributions', conflict: 'id' },
  { table: 'user_settings', conflict: 'user_id' },
  { table: 'exchange_rates', conflict: 'user_id,currency', dropId: true },
];

const CHUNK = 200;

// Returns the number of records restored, or null if the user cancelled.
export async function restoreFromBackup(
  confirm: (summary: string) => Promise<boolean>
): Promise<number | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;

  const text = await (await fetch(picked.assets[0].uri)).text();

  let backup: any;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('That file is not a valid backup (could not read it as JSON).');
  }
  if (backup?.app !== 'budget-tracker' || !backup.tables) {
    throw new Error('That file is not a Budget Tracker backup.');
  }

  const tables: Record<string, any[]> = backup.tables;
  const summary =
    `Backup from ${String(backup.exported_at ?? 'unknown date').slice(0, 10)}:\n` +
    PLAN.map((p) => `${p.table}: ${(tables[p.table] ?? []).length}`).join('\n') +
    '\n\nExisting records with the same ID will be overwritten. Nothing is deleted.';
  if (!(await confirm(summary))) return null;

  let total = 0;
  for (const { table, conflict, dropId } of PLAN) {
    const rows = (tables[table] ?? []).map((r) => {
      const { user_id, ...rest } = r; // your own user ID is filled in automatically
      if (dropId) delete (rest as any).id;
      return rest;
    });

    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from(table)
        .upsert(rows.slice(i, i + CHUNK), { onConflict: conflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    total += rows.length;
  }
  return total;
}