import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { MONTH_NAMES, monthStart, nextMonth, prevMonth } from '../lib/dates';
import { CurrencyInfo, convert, formatMoney, loadCurrency } from '../lib/currency';
import { Kind } from '../types';
import AnimatedPressable from '../components/AnimatedPressable';

type Row = {
  kind: Kind;
  amount: number;
  occurred_on: string;
  categories: { name: string } | null;
  accounts: { currency: string } | null;
};

const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
const CHART_H = 120;

export default function ReportsScreen() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState<Row[]>([]);
  const [cur, setCur] = useState<CurrencyInfo>({ base: 'PHP', rates: {} });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const introProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    introProgress.setValue(0);
    Animated.timing(introProgress, {
      duration: 280,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [introProgress, ym]);

  function openMonthPicker() {
    setPickerYear(ym.y);
    setShowMonthPicker(true);
  }

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
    const [tx, currency] = await Promise.all([
      supabase
        .from('transactions')
        .select('kind, amount, occurred_on, categories(name), accounts(currency)')
        .is('deleted_at', null)
        .gte('occurred_on', monthStart(first.y, first.m))
        .lt('occurred_on', monthStart(nx.y, nx.m)),
      loadCurrency(),
    ]);
    if (tx.error) return Alert.alert('Load failed', tx.error.message);
    setRows(tx.data as unknown as Row[]);
    setCur(currency);
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
          const amount = convert(Number(r.amount), r.accounts?.currency, cur);
          if (r.kind === 'income') income += amount;
          else expense += amount;
        }
        return { label: MONTH_NAMES[m].slice(0, 3), income, expense };
      }),
    [rows, months, cur]
  );

  const current = trend[trend.length - 1];
  const maxValue = Math.max(1, ...trend.flatMap((t) => [t.income, t.expense]));

  const byCategory = useMemo(() => {
    const k = key(ym.y, ym.m);
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.kind !== 'expense' || !r.occurred_on.startsWith(k)) continue;
      const name = r.categories?.name ?? 'Uncategorized';
      map[name] = (map[name] ?? 0) + convert(Number(r.amount), r.accounts?.currency, cur);
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [rows, ym, cur]);

  const topTotal = byCategory[0]?.total ?? 1;

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={s.box}>
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>MONEY OVERVIEW</Text>
            <Text style={s.title}>Reports</Text>
          </View>
          <View style={s.currencyBadge}>
            <Ionicons name="cash-outline" size={16} color="#5865D9" />
            <Text style={s.currencyText}>{cur.base}</Text>
          </View>
        </View>

        <View style={s.monthRow}>
          <AnimatedPressable onPress={() => setYm(prevMonth(ym.y, ym.m))} style={s.monthButton}
            accessibilityRole="button" accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={19} color="#5865D9" />
          </AnimatedPressable>
          <AnimatedPressable onPress={openMonthPicker} style={s.monthLabel} accessibilityRole="button"
            accessibilityLabel={`Choose month, currently ${MONTH_NAMES[ym.m]} ${ym.y}`}>
            <Text style={s.monthText}>{MONTH_NAMES[ym.m]} {ym.y}</Text>
            <Ionicons name="chevron-down" size={15} color="#5865D9" />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setYm(nextMonth(ym.y, ym.m))} style={s.monthButton}
            accessibilityRole="button" accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={19} color="#5865D9" />
          </AnimatedPressable>
        </View>

        <Animated.View style={[s.summaryCard, {
          opacity: introProgress,
          transform: [{ translateY: introProgress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }]}>
          <View style={s.summaryTop}>
            <Text style={s.summaryLabel}>NET CASH FLOW</Text>
            <View style={s.summaryStatus}>
              <Ionicons name={current.income - current.expense >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                size={16} color={current.income - current.expense >= 0 ? '#16845A' : '#D45B55'} />
            </View>
          </View>
          <Text style={[s.netAmount, current.income - current.expense < 0 && s.negativeAmount]}>
            {formatMoney(current.income - current.expense)}
          </Text>
          <View style={s.summaryDivider} />
          <View style={s.totals}>
            <View style={s.totalBlock}>
              <View style={[s.totalIcon, s.incomeIcon]}>
                <Ionicons name="arrow-down" size={15} color="#16845A" />
              </View>
              <View>
                <Text style={s.totalLabel}>Income</Text>
                <Text style={[s.totalAmount, s.incomeText]}>{formatMoney(current.income)}</Text>
              </View>
            </View>
            <View style={s.totalBlock}>
              <View style={[s.totalIcon, s.expenseIcon]}>
                <Ionicons name="arrow-up" size={15} color="#D45B55" />
              </View>
              <View>
                <Text style={s.totalLabel}>Expenses</Text>
                <Text style={[s.totalAmount, s.expenseText]}>{formatMoney(current.expense)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={s.chartHeader}>
          <Text style={s.section}>Last 6 months</Text>
          <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.legendDot, s.incomeDot]} /><Text style={s.legendText}>Income</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, s.expenseDot]} /><Text style={s.legendText}>Expense</Text></View>
          </View>
        </View>
        <View style={s.chartCard}>
          <View style={s.chart}>
            {trend.map((t, index) => {
              const month = months[index];
              const active = month.y === ym.y && month.m === ym.m;
              return (
                <AnimatedPressable key={`${month.y}-${month.m}`} style={[s.col, active && s.activeCol]}
                  onPress={() => setYm(month)} accessibilityRole="button"
                  accessibilityLabel={`${MONTH_NAMES[month.m]} ${month.y}, income ${formatMoney(t.income)}, expenses ${formatMoney(t.expense)}`}>
                  <Text style={[s.chartValue, active && s.activeChartValue]}>{formatMoney(Math.max(t.income, t.expense))}</Text>
                  <View style={s.bars}>
                    <View style={[s.bar, { height: (t.income / maxValue) * CHART_H, backgroundColor: '#16845A' }]} />
                    <View style={[s.bar, { height: (t.expense / maxValue) * CHART_H, backgroundColor: '#D45B55' }]} />
                  </View>
                  <Text style={[s.chartMonth, active && s.activeChartMonth]}>{t.label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Text style={s.chartHint}>Tap a month to view its report</Text>
        </View>

        <View style={s.categoryHeader}>
          <Text style={s.section}>Spending by category</Text>
          <Text style={s.categoryMonth}>{MONTH_NAMES[ym.m].slice(0, 3)} {ym.y}</Text>
        </View>
        {byCategory.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}><Ionicons name="pie-chart-outline" size={26} color="#5865D9" /></View>
            <Text style={s.emptyTitle}>No expenses this month</Text>
            <Text style={s.emptyText}>Transactions from this period will appear here by category.</Text>
          </View>
        ) : (
          byCategory.map((c, index) => (
            <View key={c.name} style={s.categoryCard}>
              <View style={s.categoryTop}>
                <View style={[s.categoryIcon, { backgroundColor: index === 0 ? '#FDE5E2' : '#EEF0FF' }]}>
                  <Ionicons name={index === 0 ? 'flame-outline' : 'ellipse-outline'} size={17}
                    color={index === 0 ? '#D45B55' : '#5865D9'} />
                </View>
                <View style={s.categoryInfo}>
                  <Text style={s.catName}>{c.name}</Text>
                  <Text style={s.categoryPercent}>
                    {current.expense ? Math.round((c.total / current.expense) * 100) : 0}% of expenses
                  </Text>
                </View>
                <Text style={s.categoryAmount}>{formatMoney(c.total)}</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, {
                  width: `${(c.total / topTotal) * 100}%`,
                  backgroundColor: index === 0 ? '#5865D9' : '#9DA6E8',
                }]} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <Pressable style={s.monthPickerCard} onPress={(event) => event.stopPropagation()}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Choose a month</Text>
              <AnimatedPressable onPress={() => setShowMonthPicker(false)} style={s.closeButton}
                accessibilityRole="button" accessibilityLabel="Close month picker">
                <Ionicons name="close" size={20} color="#697187" />
              </AnimatedPressable>
            </View>
            <View style={s.yearSelector}>
              <AnimatedPressable onPress={() => setPickerYear((year) => year - 1)} style={s.yearButton}
                accessibilityRole="button" accessibilityLabel="Previous year">
                <Ionicons name="chevron-back" size={18} color="#5865D9" />
              </AnimatedPressable>
              <Text style={s.yearText}>{pickerYear}</Text>
              <AnimatedPressable onPress={() => setPickerYear((year) => year + 1)} style={s.yearButton}
                accessibilityRole="button" accessibilityLabel="Next year">
                <Ionicons name="chevron-forward" size={18} color="#5865D9" />
              </AnimatedPressable>
            </View>
            <View style={s.monthGrid}>
              {MONTH_NAMES.map((month, index) => {
                const active = ym.y === pickerYear && ym.m === index;
                return (
                  <AnimatedPressable key={month}
                    onPress={() => { setYm({ y: pickerYear, m: index }); setShowMonthPicker(false); }}
                    style={[s.monthOption, active && s.monthOptionActive]} accessibilityRole="button"
                    accessibilityLabel={`${month} ${pickerYear}`}>
                    <Text style={[s.monthOptionText, active && s.monthOptionTextActive]}>{month.slice(0, 3)}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { backgroundColor: '#F6F7FB', flex: 1 },
  box: { paddingHorizontal: 20, paddingBottom: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingTop: 18 },
  kicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  currencyBadge: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 12, flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8 },
  currencyText: { color: '#5865D9', fontSize: 12, fontWeight: '800', marginLeft: 5 },
  monthRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, padding: 8 },
  monthButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  monthLabel: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  monthText: { color: '#29304A', fontSize: 16, fontWeight: '800' },
  summaryCard: { backgroundColor: '#29304A', borderRadius: 22, padding: 18 },
  summaryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#AEB6D4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summaryStatus: { alignItems: 'center', backgroundColor: '#EEF5F1', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  netAmount: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 6 },
  negativeAmount: { color: '#FFB0A9' },
  summaryDivider: { backgroundColor: '#4A5271', height: 1, marginVertical: 15 },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  totalBlock: { alignItems: 'center', flexDirection: 'row', width: '48%' },
  totalIcon: { alignItems: 'center', borderRadius: 10, height: 30, justifyContent: 'center', marginRight: 8, width: 30 },
  incomeIcon: { backgroundColor: '#DDF5EA' },
  expenseIcon: { backgroundColor: '#FDE5E2' },
  totalLabel: { color: '#AEB6D4', fontSize: 11 },
  totalAmount: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  incomeText: { color: '#69C79E' },
  expenseText: { color: '#FF9E96' },
  chartHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, marginTop: 20 },
  section: { color: '#29304A', fontSize: 18, fontWeight: '800' },
  legend: { flexDirection: 'row', gap: 9 },
  legendItem: { alignItems: 'center', flexDirection: 'row' },
  legendDot: { borderRadius: 3, height: 7, marginRight: 5, width: 7 },
  incomeDot: { backgroundColor: '#16845A' },
  expenseDot: { backgroundColor: '#D45B55' },
  legendText: { color: '#7C8496', fontSize: 10 },
  chartCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 18, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 12 },
  chart: { alignItems: 'flex-end', flexDirection: 'row', height: CHART_H + 52, justifyContent: 'space-between' },
  col: { alignItems: 'center', borderRadius: 12, flex: 1, height: CHART_H + 52, justifyContent: 'flex-end', marginHorizontal: 2, paddingBottom: 7, paddingTop: 3 },
  activeCol: { backgroundColor: '#F1F3FF' },
  bars: { alignItems: 'flex-end', flexDirection: 'row', gap: 3, height: CHART_H },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2, width: 10 },
  chartValue: { color: '#A0A6B6', fontSize: 8, fontWeight: '700', marginBottom: 4 },
  activeChartValue: { color: '#5865D9' },
  chartMonth: { color: '#697187', fontSize: 10, marginTop: 5 },
  activeChartMonth: { color: '#5865D9', fontWeight: '800' },
  chartHint: { color: '#A0A6B6', fontSize: 10, marginTop: 4, textAlign: 'center' },
  categoryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, marginTop: 20 },
  categoryMonth: { color: '#5865D9', fontSize: 12, fontWeight: '800' },
  categoryCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 13 },
  categoryTop: { alignItems: 'center', flexDirection: 'row' },
  categoryIcon: { alignItems: 'center', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  categoryInfo: { flex: 1, marginHorizontal: 10 },
  catName: { color: '#29304A', fontSize: 15, fontWeight: '800' },
  categoryPercent: { color: '#8A91A4', fontSize: 11, marginTop: 3 },
  categoryAmount: { color: '#29304A', fontSize: 14, fontWeight: '800' },
  barBg: { backgroundColor: '#ECEEF4', borderRadius: 4, height: 7, marginTop: 12, overflow: 'hidden' },
  barFill: { borderRadius: 4, height: 7 },
  emptyState: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 28 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#E9EBFF', borderRadius: 18, height: 52, justifyContent: 'center', width: 52 },
  emptyTitle: { color: '#29304A', fontSize: 16, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#7C8496', fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' },
  modalOverlay: { backgroundColor: 'rgba(24, 29, 49, 0.48)', flex: 1, justifyContent: 'flex-end' },
  monthPickerCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 28, width: '100%' },
  pickerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pickerTitle: { color: '#29304A', fontSize: 19, fontWeight: '800' },
  closeButton: { alignItems: 'center', backgroundColor: '#F1F2F7', borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  yearSelector: { alignItems: 'center', backgroundColor: '#F7F8FC', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, padding: 6 },
  yearButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E1E4ED', borderRadius: 10, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  yearText: { color: '#20263B', fontSize: 22, fontWeight: '800', minWidth: 90, textAlign: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, justifyContent: 'space-between', rowGap: 10, marginTop: 18 },
  monthOption: { alignItems: 'center', backgroundColor: '#F7F8FC', borderColor: '#E1E4ED', borderRadius: 12, borderWidth: 1, height: 54, justifyContent: 'center', width: '31%' },
  monthOptionActive: { backgroundColor: '#5865D9' },
  monthOptionText: { color: '#697187', fontSize: 14, fontWeight: '700' },
  monthOptionTextActive: { color: '#FFFFFF' },
});