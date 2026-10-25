import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Button, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { MONTH_NAMES, monthStart, nextMonth, prevMonth } from '../lib/dates';
import { Kind } from '../types';

type Row = {
  kind: Kind;
  amount: number;
  occurred_on: string;
  categories: { name: string } | null;
};

const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
const CHART_H = 120;

export default function ReportsScreen() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState<Row[]>([]);

  // the 6 months ending at the selected month, oldest first
  const months = useMemo(() => {
    const list: { y: number; m: number }[] = [];
    let cur = { ...ym };
    for (let i = 0; i < 6; i++) {
      list.unshift(cur);
      cur = prevMonth(cur.y, cur.m);
    }
    return list;
  }, [ym]);

  const load = useCallback(async () => {
    const first = months[0];
    const nx = nextMonth(ym.y, ym.m);
    const { data, error } = await supabase
      .from('transactions')
      .select('kind, amount, occurred_on, categories(name)')
      .is('deleted_at', null)
      .gte('occurred_on', monthStart(first.y, first.m))
      .lt('occurred_on', monthStart(nx.y, nx.m));
    if (error) return Alert.alert('Load failed', error.message);
    setRows(data as unknown as Row[]);
  }, [months, ym]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const trend = useMemo(
    () =>
      months.map(({ y, m }) => {
        const k = key(y, m);
        let income = 0;
        let expense = 0;
        for (const r of rows) {
          if (!r.occurred_on.startsWith(k)) continue;
          if (r.kind === 'income') income += Number(r.amount);
          else expense += Number(r.amount);
        }
        return { label: MONTH_NAMES[m].slice(0, 3), income, expense };
      }),
    [rows, months]
  );

  const current = trend[trend.length - 1];
  const maxValue = Math.max(1, ...trend.flatMap((t) => [t.income, t.expense]));

  const byCategory = useMemo(() => {
    const k = key(ym.y, ym.m);
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.kind !== 'expense' || !r.occurred_on.startsWith(k)) continue;
      const name = r.categories?.name ?? 'Uncategorized';
      map[name] = (map[name] ?? 0) + Number(r.amount);
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [rows, ym]);

  const topTotal = byCategory[0]?.total ?? 1;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={s.box}>
        <Text style={s.title}>Reports</Text>

        <View style={s.monthRow}>
          <Button title="<" onPress={() => setYm(prevMonth(ym.y, ym.m))} />
          <Text style={s.month}>{MONTH_NAMES[ym.m]} {ym.y}</Text>
          <Button title=">" onPress={() => setYm(nextMonth(ym.y, ym.m))} />
        </View>

        <View style={s.totals}>
          <View><Text style={s.sub}>Income</Text><Text style={[s.num, { color: '#1e8e3e' }]}>{current.income.toFixed(2)}</Text></View>
          <View><Text style={s.sub}>Expenses</Text><Text style={[s.num, { color: '#c0392b' }]}>{current.expense.toFixed(2)}</Text></View>
          <View><Text style={s.sub}>Net</Text><Text style={s.num}>{(current.income - current.expense).toFixed(2)}</Text></View>
        </View>

        <Text style={s.section}>Last 6 months</Text>
        <View style={s.chart}>
          {trend.map((t) => (
            <View key={t.label} style={s.col}>
              <View style={s.bars}>
                <View style={[s.bar, { height: (t.income / maxValue) * CHART_H, backgroundColor: '#1e8e3e' }]} />
                <View style={[s.bar, { height: (t.expense / maxValue) * CHART_H, backgroundColor: '#c0392b' }]} />
              </View>
              <Text style={s.sub}>{t.label}</Text>
            </View>
          ))}
        </View>
        <View style={s.legend}>
          <Text style={[s.sub, { color: '#1e8e3e' }]}>■ Income</Text>
          <Text style={[s.sub, { color: '#c0392b' }]}>■ Expenses</Text>
        </View>

        <Text style={s.section}>Spending by category</Text>
        {byCategory.length === 0 ? (
          <Text style={s.sub}>No expenses this month.</Text>
        ) : (
          byCategory.map((c) => (
            <View key={c.name} style={{ marginBottom: 12 }}>
              <View style={s.catTop}>
                <Text style={s.catName}>{c.name}</Text>
                <Text style={s.sub}>
                  {c.total.toFixed(2)} · {current.expense ? Math.round((c.total / current.expense) * 100) : 0}%
                </Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${(c.total / topTotal) * 100}%` }]} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  box: { padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 18, fontWeight: '600' },
  totals: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 },
  num: { fontSize: 18, fontWeight: '600' },
  sub: { color: '#666', fontSize: 13 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 10 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  col: { alignItems: 'center', flex: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_H, marginBottom: 4 },
  bar: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 1 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontSize: 15, fontWeight: '500' },
  barBg: { height: 8, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: '#2196f3' },
});