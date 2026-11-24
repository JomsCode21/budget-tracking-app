import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ensureDefaultCategories } from '../lib/categories';
import { CurrencyInfo, convert, formatMoney, loadCurrency } from '../lib/currency';
import { MONTH_NAMES, monthStart, nextMonth, prevMonth } from '../lib/dates';
import { Budget, Category } from '../types';
import AnimatedPressable from '../components/AnimatedPressable';

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
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

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
  const remaining = totalBudget - totalSpent;
  const overallPct = totalBudget ? (totalSpent / totalBudget) * 100 : 0;
  const categoriesWithBudgets = categories.filter((c) => Number(budgetByCat[c.id] ?? 0) > 0).length;

  function openMonthPicker() {
    setPickerYear(ym.y);
    setShowMonthPicker(true);
  }

  function categoryIcon(name: string): React.ComponentProps<typeof Ionicons>['name'] {
    const lower = name.toLowerCase();
    if (lower.includes('bill')) return 'receipt-outline';
    if (lower.includes('entertain')) return 'game-controller-outline';
    if (lower.includes('food')) return 'restaurant-outline';
    if (lower.includes('health')) return 'medkit-outline';
    if (lower.includes('shopping')) return 'bag-outline';
    if (lower.includes('transport')) return 'car-outline';
    return 'ellipse-outline';
  }

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
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <View style={s.box}>
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>MONTHLY PLANNING</Text>
            <Text style={s.title}>Budgets</Text>
          </View>
        </View>

        <View style={s.monthRow}>
          <AnimatedPressable onPress={() => setYm(prevMonth(ym.y, ym.m))}
            style={s.monthButton} accessibilityRole="button" accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={19} color="#5865D9" />
          </AnimatedPressable>
          <AnimatedPressable onPress={openMonthPicker} style={s.monthLabel} accessibilityRole="button"
            accessibilityLabel={`Choose month, currently ${MONTH_NAMES[ym.m]} ${ym.y}`}>
            <Text style={s.monthText}>{MONTH_NAMES[ym.m]} {ym.y}</Text>
            <Ionicons name="chevron-down" size={15} color="#5865D9" />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setYm(nextMonth(ym.y, ym.m))}
            style={s.monthButton} accessibilityRole="button" accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={19} color="#5865D9" />
          </AnimatedPressable>
        </View>

        <View style={s.summaryCard}>
          <View style={s.summaryTop}>
            <View>
              <Text style={s.summaryLabel}>TOTAL SPENT</Text>
              <Text style={s.summaryAmount}>{formatMoney(totalSpent)}</Text>
            </View>
            <View style={s.summaryBadge}>
              <Ionicons name={remaining >= 0 ? 'trending-down-outline' : 'alert-circle-outline'} size={16}
                color={remaining >= 0 ? '#16845A' : '#D45B55'} />
              <Text style={[s.summaryBadgeText, remaining < 0 && s.summaryBadgeDanger]}>
                {overallPct.toFixed(0)}% used
              </Text>
            </View>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryStats}>
            <View style={s.summaryStat}>
              <Text style={s.summaryStatLabel}>BUDGETED</Text>
              <Text style={s.summaryStatValue}>{formatMoney(totalBudget)} <Text style={s.summaryCurrency}>{cur.base}</Text></Text>
            </View>
            <View style={s.summaryStatDivider} />
            <View style={s.summaryStat}>
              <Text style={s.summaryStatLabel}>{remaining >= 0 ? 'REMAINING' : 'OVER BUDGET'}</Text>
              <Text style={[s.summaryStatValue, remaining < 0 && s.summaryOver]}>{formatMoney(remaining)}</Text>
            </View>
          </View>
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Categories</Text>
          <Text style={s.categoryCount}>{categoriesWithBudgets} of {categories.length} planned</Text>
        </View>

        <FlatList
          style={s.list}
          contentContainerStyle={categories.length === 0 ? s.emptyList : s.listContent}
          showsVerticalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => {
            const spent = spentByCat[item.id] ?? 0;
            const limit = budgetByCat[item.id];
            const pct = limit ? (spent / limit) * 100 : 0;
            const state = pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe';
            const color = state === 'danger' ? '#D45B55' : state === 'warning' ? '#D68A25' : '#16845A';
            const iconBg = state === 'danger' ? '#FDE5E2' : state === 'warning' ? '#FFF0D9' : '#EEF0FF';
            return (
              <AnimatedPressable onPress={() => openEdit(item)} style={s.categoryCard}>
                <View style={s.categoryTop}>
                  <View style={[s.categoryIcon, { backgroundColor: iconBg }]}>
                    <Ionicons name={categoryIcon(item.name)} size={19} color={color} />
                  </View>
                  <View style={s.categoryInfo}>
                    <Text style={s.categoryName}>{item.name}</Text>
                    <Text style={s.categoryStatus}>
                      {limit
                        ? state === 'danger'
                          ? `Over by ${formatMoney(spent - limit)} ${cur.base}`
                          : `${formatMoney(limit - spent)} ${cur.base} left`
                        : 'Tap to set a monthly limit'}
                    </Text>
                  </View>
                  <View style={s.categoryAmount}>
                    <Text style={s.categorySpent}>{formatMoney(spent)}</Text>
                    <Text style={s.categoryLimit}>{limit ? `of ${formatMoney(limit)}` : 'No budget'}</Text>
                  </View>
                </View>
                {limit ? (
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
                  </View>
                ) : null}
              </AnimatedPressable>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIcon}><Ionicons name="pie-chart-outline" size={27} color="#5865D9" /></View>
              <Text style={s.emptyTitle}>No expense categories yet</Text>
              <Text style={s.emptyText}>Add a transaction to create categories and start planning.</Text>
            </View>
          }
        />
      </View>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} />
          <View style={s.editSheet}>
            <View style={s.handle} />
            <View style={s.editHeader}>
              <View>
                <Text style={s.editKicker}>{MONTH_NAMES[ym.m]} {ym.y}</Text>
                <Text style={s.editTitle}>{editing?.name} budget</Text>
              </View>
              <AnimatedPressable onPress={() => setEditing(null)} style={s.closeButton}
                accessibilityRole="button" accessibilityLabel="Close budget editor">
                <Ionicons name="close" size={20} color="#697187" />
              </AnimatedPressable>
            </View>
            <Text style={s.editHelp}>Set a monthly limit in {cur.base}. Enter 0 to remove it.</Text>
            <Text style={s.inputLabel}>Monthly limit</Text>
            <View style={s.inputShell}>
              <Text style={s.inputCurrency}>{cur.base}</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" value={text}
                onChangeText={setText} placeholder="0.00" placeholderTextColor="#AEB6C5" autoFocus />
            </View>
            <AnimatedPressable onPress={saveBudget} style={s.saveButton} accessibilityRole="button">
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={s.saveButtonText}>Save budget</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => setEditing(null)} style={s.cancelButton} accessibilityRole="button">
              <Text style={s.cancelText}>Cancel</Text>
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setShowMonthPicker(false)}>
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
  box: { flex: 1, paddingHorizontal: 20 },
  header: { paddingBottom: 14, paddingTop: 18 },
  kicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  monthRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, padding: 8 },
  monthButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  monthLabel: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  monthText: { color: '#29304A', fontSize: 16, fontWeight: '800' },
  summaryCard: { backgroundColor: '#29304A', borderRadius: 22, padding: 18 },
  summaryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#AEB6D4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summaryAmount: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 4 },
  summaryBadge: { alignItems: 'center', backgroundColor: '#EEF5F1', borderRadius: 12, flexDirection: 'row', paddingHorizontal: 9, paddingVertical: 7 },
  summaryBadgeText: { color: '#16845A', fontSize: 12, fontWeight: '800', marginLeft: 5 },
  summaryBadgeDanger: { color: '#D45B55' },
  summaryDivider: { backgroundColor: '#4A5271', height: 1, marginVertical: 15 },
  summaryStats: { flexDirection: 'row' },
  summaryStat: { flex: 1 },
  summaryStatDivider: { backgroundColor: '#4A5271', marginHorizontal: 14, width: 1 },
  summaryStatLabel: { color: '#AEB6D4', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  summaryStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 5 },
  summaryCurrency: { color: '#C9CEE1', fontSize: 10 },
  summaryOver: { color: '#FFB0A9' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, marginTop: 20 },
  sectionTitle: { color: '#29304A', fontSize: 18, fontWeight: '800' },
  categoryCount: { color: '#8A91A4', fontSize: 12 },
  list: { flex: 1 },
  listContent: { paddingBottom: 18 },
  categoryCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 13 },
  categoryTop: { alignItems: 'center', flexDirection: 'row' },
  categoryIcon: { alignItems: 'center', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  categoryInfo: { flex: 1, marginHorizontal: 11 },
  categoryName: { color: '#29304A', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  categoryStatus: { color: '#8A91A4', fontSize: 11 },
  categoryAmount: { alignItems: 'flex-end' },
  categorySpent: { color: '#29304A', fontSize: 15, fontWeight: '800' },
  categoryLimit: { color: '#8A91A4', fontSize: 11, marginTop: 3 },
  barBg: { backgroundColor: '#ECEEF4', borderRadius: 4, height: 7, marginTop: 12, overflow: 'hidden' },
  barFill: { borderRadius: 4, height: 7 },
  emptyList: { flexGrow: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 42 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#E9EBFF', borderRadius: 20, height: 58, justifyContent: 'center', width: 58 },
  emptyTitle: { color: '#29304A', fontSize: 17, fontWeight: '800', marginTop: 15 },
  emptyText: { color: '#7C8496', fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  overlay: { backgroundColor: 'rgba(24, 29, 49, 0.48)', flex: 1, justifyContent: 'flex-end', padding: 0 },
  editSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 12 },
  handle: { alignSelf: 'center', backgroundColor: '#DDE1EC', borderRadius: 3, height: 5, marginBottom: 18, width: 42 },
  editHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  editKicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
  editTitle: { color: '#20263B', fontSize: 22, fontWeight: '800' },
  closeButton: { alignItems: 'center', backgroundColor: '#F1F2F7', borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  editHelp: { color: '#7C8496', fontSize: 13, lineHeight: 20, marginTop: 10 },
  inputLabel: { color: '#343B53', fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 18 },
  inputShell: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#DCE0EB', borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: 15 },
  inputCurrency: { color: '#5865D9', fontSize: 14, fontWeight: '800', marginRight: 10 },
  input: { color: '#20263B', flex: 1, fontSize: 20, fontWeight: '800', minHeight: 56 },
  saveButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', marginTop: 16, minHeight: 52 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  cancelButton: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#697187', fontSize: 14, fontWeight: '700' },
  monthPickerCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, width: '100%' },
  pickerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pickerTitle: { color: '#29304A', fontSize: 19, fontWeight: '800' },
  yearSelector: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  yearButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  yearText: { color: '#20263B', fontSize: 22, fontWeight: '800' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginTop: 18 },
  monthOption: { alignItems: 'center', backgroundColor: '#F7F8FC', borderRadius: 12, height: 46, justifyContent: 'center', width: '29%' },
  monthOptionActive: { backgroundColor: '#5865D9' },
  monthOptionText: { color: '#697187', fontSize: 14, fontWeight: '700' },
  monthOptionTextActive: { color: '#FFFFFF' },
});