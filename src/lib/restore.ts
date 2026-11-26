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
  { table: 'dtr_settings', conflict: 'user_id', dropId: true },
  { table: 'dtr_entries', conflict: 'id' },
];

const CHUNK = 200;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return (typeof value === 'number' || typeof value === 'string') &&
    String(value).trim() !== '' &&
    Number.isFinite(Number(value));
}

function isDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function requireString(row: RecordValue, field: string, table: string, index: number, allowEmpty = false) {
  if (typeof row[field] !== 'string' || (!allowEmpty && row[field].trim() === '')) {
    throw new Error(`${table}[${index}] has an invalid ${field}.`);
  }
}

function requireNullableString(row: RecordValue, field: string, table: string, index: number) {
  if (row[field] !== null && typeof row[field] !== 'string') {
    throw new Error(`${table}[${index}] has an invalid ${field}.`);
  }
}

function requireNumber(row: RecordValue, field: string, table: string, index: number) {
  if (!isFiniteNumber(row[field])) {
    throw new Error(`${table}[${index}] has an invalid ${field}.`);
  }
}

function requireNullableNumber(row: RecordValue, field: string, table: string, index: number) {
  if (row[field] !== null && !isFiniteNumber(row[field])) {
    throw new Error(`${table}[${index}] has an invalid ${field}.`);
  }
}

function requireDate(row: RecordValue, field: string, table: string, index: number, nullable = false) {
  if (nullable && row[field] === null) return;
  if (!isDate(row[field])) {
    throw new Error(`${table}[${index}] has an invalid ${field}.`);
  }
}

function requireNullableTime(row: RecordValue, field: string, table: string, index: number) {
  if (row[field] !== null && (typeof row[field] !== 'string' || !/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(row[field] as string))) {
    throw new Error(`${table}[${index}] has an invalid ${field}.`);
  }
}

function requireNullableTimestamp(row: RecordValue, field: string, table: string, index: number) {
  if (row[field] !== null && (typeof row[field] !== 'string' || !Number.isFinite(Date.parse(row[field] as string)))) {
    throw new Error(`${table}[${index}] has an invalid ${field}.`);
  }
}

function pick(row: RecordValue, fields: string[]): RecordValue {
  const result: RecordValue = {};
  for (const field of fields) {
    if (row[field] !== undefined) result[field] = row[field];
  }
  return result;
}

function validateAndSanitize(table: string, rows: unknown[]): RecordValue[] {
  return rows.map((value, index) => {
    if (!isRecord(value)) throw new Error(`${table}[${index}] must be an object.`);

    switch (table) {
      case 'accounts':
        requireString(value, 'id', table, index);
        requireString(value, 'name', table, index);
        requireString(value, 'type', table, index);
        requireString(value, 'currency', table, index);
        requireNumber(value, 'opening_balance', table, index);
        return pick(value, ['id', 'name', 'type', 'currency', 'opening_balance', 'deleted_at', 'created_at', 'updated_at']);
      case 'categories':
        requireString(value, 'id', table, index);
        requireString(value, 'name', table, index);
        if (value.kind !== 'income' && value.kind !== 'expense') throw new Error(`${table}[${index}] has an invalid kind.`);
        return pick(value, ['id', 'name', 'kind', 'deleted_at', 'created_at', 'updated_at']);
      case 'recurring_rules':
        requireString(value, 'id', table, index);
        requireString(value, 'name', table, index);
        requireString(value, 'account_id', table, index);
        requireNullableString(value, 'category_id', table, index);
        if (value.kind !== 'income' && value.kind !== 'expense') throw new Error(`${table}[${index}] has an invalid kind.`);
        requireNumber(value, 'amount', table, index);
        if (value.frequency !== 'weekly' && value.frequency !== 'monthly') throw new Error(`${table}[${index}] has an invalid frequency.`);
        if (!Number.isInteger(Number(value.anchor_day)) || Number(value.anchor_day) < 1 || Number(value.anchor_day) > 31) {
          throw new Error(`${table}[${index}] has an invalid anchor_day.`);
        }
        requireDate(value, 'next_due', table, index);
        if (typeof value.active !== 'boolean') throw new Error(`${table}[${index}] has an invalid active value.`);
        return pick(value, ['id', 'name', 'account_id', 'category_id', 'kind', 'amount', 'frequency', 'anchor_day', 'next_due', 'active', 'deleted_at', 'created_at', 'updated_at']);
      case 'transactions':
        requireString(value, 'id', table, index);
        requireString(value, 'account_id', table, index);
        requireNullableString(value, 'category_id', table, index);
        if (value.kind !== 'income' && value.kind !== 'expense') throw new Error(`${table}[${index}] has an invalid kind.`);
        requireNumber(value, 'amount', table, index);
        requireNullableString(value, 'note', table, index);
        requireDate(value, 'occurred_on', table, index);
        return pick(value, ['id', 'account_id', 'category_id', 'kind', 'amount', 'note', 'occurred_on', 'recurring_rule_id', 'deleted_at', 'created_at', 'updated_at']);
      case 'budgets':
        requireString(value, 'category_id', table, index);
        requireDate(value, 'month', table, index);
        requireNumber(value, 'amount', table, index);
        if (Number(value.amount) < 0) throw new Error(`${table}[${index}] has a negative amount.`);
        return pick(value, ['category_id', 'month', 'amount', 'created_at', 'updated_at']);
      case 'goals':
        requireString(value, 'id', table, index);
        requireString(value, 'name', table, index);
        requireNumber(value, 'target_amount', table, index);
        requireNullableString(value, 'deadline', table, index);
        requireDate(value, 'deadline', table, index, true);
        return pick(value, ['id', 'name', 'target_amount', 'deadline', 'deleted_at', 'created_at', 'updated_at']);
      case 'goal_contributions':
        requireString(value, 'id', table, index);
        requireString(value, 'goal_id', table, index);
        requireNumber(value, 'amount', table, index);
        requireDate(value, 'contributed_on', table, index);
        return pick(value, ['id', 'goal_id', 'amount', 'contributed_on', 'deleted_at', 'created_at', 'updated_at']);
      case 'user_settings':
        requireString(value, 'base_currency', table, index);
        return pick(value, ['base_currency', 'created_at', 'updated_at']);
      case 'exchange_rates':
        requireString(value, 'currency', table, index);
        requireNumber(value, 'rate', table, index);
        if (Number(value.rate) <= 0) throw new Error(`${table}[${index}] has a rate that is not positive.`);
        return pick(value, ['currency', 'rate', 'created_at', 'updated_at']);
      case 'dtr_settings':
        requireNumber(value, 'daily_rate', table, index);
        requireNumber(value, 'overtime_rate', table, index);
        if (Number(value.daily_rate) < 0 || Number(value.overtime_rate) < 0) {
          throw new Error(`${table}[${index}] has a negative rate.`);
        }
        requireNullableTime(value, 'standard_start', table, index);
        requireNullableTime(value, 'standard_end', table, index);
        if (value.overtime_end !== undefined) requireNullableTime(value, 'overtime_end', table, index);
        if (value.scheduled_break_start !== undefined) requireNullableTime(value, 'scheduled_break_start', table, index);
        if (value.scheduled_break_end !== undefined) requireNullableTime(value, 'scheduled_break_end', table, index);
        requireNumber(value, 'scheduled_break_minutes', table, index);
        requireNumber(value, 'grace_period_minutes', table, index);
        return pick(value, ['daily_rate', 'overtime_rate', 'standard_start', 'standard_end', 'overtime_end', 'scheduled_break_start', 'scheduled_break_end', 'scheduled_break_minutes', 'grace_period_minutes', 'created_at', 'updated_at']);
      case 'dtr_entries':
        requireString(value, 'id', table, index);
        requireDate(value, 'work_date', table, index);
        requireString(value, 'clock_in_at', table, index);
        if (!Number.isFinite(Date.parse(value.clock_in_at as string))) throw new Error(`${table}[${index}] has an invalid clock_in_at.`);
        requireNullableTimestamp(value, 'clock_out_at', table, index);
        requireNullableTimestamp(value, 'break_started_at', table, index);
        requireNumber(value, 'break_minutes', table, index);
        if (!Number.isInteger(Number(value.break_minutes)) || Number(value.break_minutes) < 0) {
          throw new Error(`${table}[${index}] has an invalid break_minutes.`);
        }
        if (value.overtime_minutes !== undefined) {
          requireNullableNumber(value, 'overtime_minutes', table, index);
          if (value.overtime_minutes !== null &&
            (!Number.isInteger(Number(value.overtime_minutes)) || Number(value.overtime_minutes) < 0)) {
            throw new Error(`${table}[${index}] has an invalid overtime_minutes.`);
          }
        }
        requireNullableString(value, 'note', table, index);
        return pick(value, ['id', 'work_date', 'clock_in_at', 'clock_out_at', 'break_started_at', 'break_minutes', 'overtime_minutes', 'note', 'created_at', 'updated_at']);
      default:
        throw new Error(`Unsupported backup table: ${table}.`);
    }
  });
}

// Returns the number of records restored, or null if the user cancelled.
export async function restoreFromBackup(
  confirm: (summary: string) => Promise<boolean>
): Promise<number | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  if (!picked.assets?.[0]?.uri) {
    throw new Error('The selected file could not be opened.');
  }

  let text: string;
  try {
    const response = await fetch(picked.assets[0].uri);
    if (!response.ok) throw new Error(`The file could not be read (HTTP ${response.status}).`);
    text = await response.text();
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? `Could not read backup: ${error.message}` : 'Could not read backup.');
  }

  let backup: any;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('That file is not a valid backup (could not read it as JSON).');
  }
  if (backup?.app !== 'budget-tracker' || !backup.tables) {
    throw new Error('That file is not a Budget Tracker backup.');
  }

  if (!isRecord(backup.tables)) {
    throw new Error('That backup has an invalid tables section.');
  }

  const tables: Record<string, unknown[]> = {};
  for (const { table } of PLAN) {
    const value = backup.tables[table];
    if (value === undefined) {
      tables[table] = [];
      continue;
    }
    if (!Array.isArray(value)) {
      throw new Error(`Backup table "${table}" must contain an array.`);
    }
    tables[table] = validateAndSanitize(table, value);
  }
  const summary =
    `Backup from ${String(backup.exported_at ?? 'unknown date').slice(0, 10)}:\n` +
    PLAN.map((p) => `${p.table}: ${(tables[p.table] ?? []).length}`).join('\n') +
    '\n\nExisting records with the same ID will be overwritten. Nothing is deleted.';
  if (!(await confirm(summary))) return null;

  let total = 0;
  for (const { table, conflict, dropId } of PLAN) {
    const rows = (tables[table] ?? []).map((r) => {
      const record = r as RecordValue;
      const { user_id, ...rest } = record; // your own user ID is filled in automatically
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