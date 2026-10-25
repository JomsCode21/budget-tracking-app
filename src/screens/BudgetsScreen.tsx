import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Button, Alert, FlatList, Pressable, Modal, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ensureDefaultCategories } from '../lib/categories';
import { CurrencyInfo, convert, loadCurrency } from '../lib/currency';
import { MONTH_NAMES, monthStart, nextMonth, prevMonth } from '../lib/dates';
import { Budget, Category } from '../types';

type SpentRow = {
  category_id: string | null;
  amount: number;
  accounts: { currency: string } | null;
};

export default function BudgetsScreen() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spentRows, setSpentRows] = useState<SpentRow[]>([]);
  const [cur, setCur] = useState<CurrencyInfo>({ base: 'PHP', rates: {} });
  const [editing, setEditing] = useState<Category | null>(null);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    await ensureDefaultCategories();
    const start = monthStart(ym.y, ym.m);
    const nx = nextMonth(ym.y, ym.m);
    const [cat, bud, tx] = await Promise.all([
      supabase.from('categories').select('*').eq('kind', 'expense').is('deleted_at', null).order('name'),
      supabase.from('budgets').select('*').eq('month', start),
      supabase
        .from('transactions')
        .select('category_id, amount, accounts(currency)')
        .eq('kind', 'expense')
        .is('deleted_at', null)
        .gte('occurred_on', start)
        .lt('occurred_on', monthStart(nx.y, nx.m)),
    ]);
    const err = cat.error || bud.error || tx.error;
    if (err) return Alert.alert('Load failed', err.message);
    setCategories(cat.data as Category[]);
    setBudgets(bud.data as Budget[]);
    setSpentRows(tx.data as unknown as SpentRow[]);
    setCur(await loadCurrency());
  }, [ym]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const spentByCat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of spentRows) {
      if (r.category_id) {
        map[r.category_id] =
          (map[r.category_id] ?? 0) + convert(Number(r.amount), r.accounts?.currency, cur);
      }
    }
    return map;
  }, [spentRows, cur]);

  const budgetByCat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of budgets) map[b.category_id] = Number(b.amount);
    return map;
  }, [budgets]);

  const totalBudget = Object.values(budgetByCat).reduce((a, b) => a + b, 0);
  const totalSpent = categories.reduce((sum, c) => sum + (spentByCat[c.id] ?? 0), 0);

  function openEdit(c: Category) {
    setEditing(c);
    setText(budgetByCat[c.id] ? String(budgetByCat[c.id]) : '');
  }

  async function saveBudget() {
    if (!editing) return;
    const value = Number(text.replace(',', '.') || '0');
    if (isNaN(value) || value < 0) return Alert.alert('Invalid amount');
    const month = monthStart(ym.y, ym.m);

    const { error } =
      value === 0
        ? await supabase.from('budgets').delete().eq('category_id', editing.id).eq('month', month)
        : await supabase.from('budgets').upsert(
            { category_id: editing.id, month, amount: value, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,category_id,month' }
          );
    if (error) return Alert.alert('Save failed', error.message);
    setEditing(null);
    load();
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={s.box}>
        <Text style={s.title}>Budgets</Text>

        <View style={s.monthRow}>
          <Button title="<" onPress={() => setYm(prevMonth(ym.y, ym.m))} />
          <Text style={s.month}>{MONTH_NAMES[ym.m]} {ym.y}</Text>
          <Button title=">" onPress={() => setYm(nextMonth(ym.y, ym.m))} />
        </View>

        <Text style={s.sub}>
          Amounts in {cur.base} · Spent {totalSpent.toFixed(2)}
          {totalBudget ? ` of ${totalBudget.toFixed(2)} budgeted` : ''}
        </Text>

        <FlatList
          style={{ marginTop: 12 }}
          data={categories}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => {
            const spent = spentByCat[item.id] ?? 0;
            const limit = budgetByCat[item.id];
            const pct = limit ? (spent / limit) * 100 : 0;
            const color = pct > 100 ? '#c0392b' : pct >= 80 ? '#e67e22' : '#1e8e3e';
            return (
              <Pressable onPress={() => openEdit(item)} style={s.item}>
                <View style={s.itemTop}>
                  <Text style={s.itemTitle}>{item.name}</Text>
                  <Text style={s.sub}>
                    {spent.toFixed(2)}{limit ? ` / ${limit.toFixed(2)}` : ' (tap to set budget)'}
                  </Text>
                </View>
                {limit ? (
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
                  </View>
                ) : null}
                {limit && spent > limit ? (
                  <Text style={{ color: '#c0392b', fontSize: 12 }}>Over by {(spent - limit).toFixed(2)}</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={s.overlay}>
          <View style={s.card}>
            <Text style={s.itemTitle}>{editing?.name} budget</Text>
            <Text style={s.sub}>
              {MONTH_NAMES[ym.m]} {ym.y} · in {cur.base} (enter 0 to remove)
            </Text>
            <TextInput style={s.input} keyboardType="decimal-pad" value={text}
              onChangeText={setText} placeholder="Monthly limit" autoFocus />
            <Button title="Save" onPress={saveBudget} />
            <View style={{ height: 8 }} />
            <Button title="Cancel" color="#888" onPress={() => setEditing(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 18, fontWeight: '600' },
  sub: { color: '#666', fontSize: 13 },
  item: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemTitle: { fontSize: 16, fontWeight: '500' },
  barBg: { height: 8, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginVertical: 12 },
});