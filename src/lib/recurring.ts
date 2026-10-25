import { supabase } from './supabase';
import { nextOccurrence, todayLocal } from './dates';
import { scheduleReminders } from './reminders';
import { RecurringRule } from '../types';

// Creates every transaction that has come due, then moves next_due forward.
export async function processDueRules() {
  const today = todayLocal();
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('active', true)
    .is('deleted_at', null)
    .lte('next_due', today);
  if (error || !data) return;

  for (const r of data as RecurringRule[]) {
    const rows = [];
    let due = r.next_due;
    let guard = 0;
    while (due <= today && guard < 366) {
      rows.push({
        account_id: r.account_id,
        category_id: r.category_id,
        kind: r.kind,
        amount: r.amount,
        note: r.name,
        occurred_on: due,
        recurring_rule_id: r.id,
      });
      due = nextOccurrence(due, r.frequency, r.anchor_day);
      guard++;
    }
    if (rows.length === 0) continue;

    const ins = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'recurring_rule_id,occurred_on', ignoreDuplicates: true });
    if (ins.error) continue;

    await supabase
      .from('recurring_rules')
      .update({ next_due: due, updated_at: new Date().toISOString() })
      .eq('id', r.id);
  }
}

export async function syncRecurring() {
  await processDueRules();
  const { data } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('active', true)
    .is('deleted_at', null);
  await scheduleReminders((data ?? []) as RecurringRule[]);
}