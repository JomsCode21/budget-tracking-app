import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Alert, FlatList, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ensureDefaultCategories } from '../lib/categories';
import { CurrencyInfo, convert, loadCurrency } from '../lib/currency';
import { MONTH_NAMES, monthStart, nextMonth, prevMonth } from '../lib/dates';
import AddTransactionModal from '../components/AddTransactionsModal';
import { Account, Category, Transaction } from '../types';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cur, setCur] = useState<CurrencyInfo>({ base: 'PHP', rates: {} });
  const [showAdd, setShowAdd] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [ym, setYm] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  const load = useCallback(async () => {
    await ensureDefaultCategories();
    const start = monthStart(ym.y, ym.m);
    const end = nextMonth(ym.y, ym.m);
    const [tx, acc, cat] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name), accounts(name, currency)')
        .is('deleted_at', null)
        .gte('occurred_on', start)
        .lt('occurred_on', monthStart(end.y, end.m))
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').is('deleted_at', null).order('created_at'),
      supabase.from('categories').select('*').is('deleted_at', null).order('name'),
    ]);
    const err = tx.error || acc.error || cat.error;
    if (err) return Alert.alert('Load failed', err.message);
    setTransactions(tx.data as unknown as Transaction[]);
    setAccounts(acc.data as Account[]);
    setCategories(cat.data as Category[]);
    setCur(await loadCurrency());
  }, [ym]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const v = convert(Number(t.amount), t.accounts?.currency, cur);
      if (t.kind === 'income') income += v;
      else expense += v;
    }
    return { income, expense, net: income - expense };
  }, [transactions, cur]);

  function openAdd() {
    if (accounts.length === 0) {
      return Alert.alert('No account yet', 'Add an account first (More → Accounts).');
    }
    setShowAdd(true);
  }

  function openMonthPicker() {
    setPickerYear(ym.y);
    setShowMonthPicker(true);
  }

  function confirmDelete(t: Transaction) {
    Alert.alert('Delete transaction?', `${t.categories?.name ?? 'Uncategorized'} ${Number(t.amount).toFixed(2)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from('transactions')
            .update({ deleted_at: now, updated_at: now })
            .eq('id', t.id);
          if (error) return Alert.alert('Delete failed', error.message);
          load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <View style={s.box}>
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>YOUR MONEY ACTIVITY</Text>
            <Text style={s.title}>Transactions</Text>
          </View>
          <Pressable onPress={openAdd} style={s.headerAction} accessibilityRole="button" accessibilityLabel="Add transaction">
            <Ionicons name="add" size={25} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={s.summaryCard}>
          <View style={s.summaryHeading}>
            <Text style={s.summaryLabel}>NET THIS PERIOD</Text>
            <Text style={s.currency}>In {cur.base}</Text>
          </View>
          <Text style={[s.netAmount, totals.net < 0 && s.negativeAmount]}>
            {totals.net < 0 ? '-' : ''}{Math.abs(totals.net).toFixed(2)}
          </Text>
          <View style={s.summaryDivider} />
          <View style={s.totals}>
            <View style={s.totalBlock}>
              <View style={[s.totalIcon, s.incomeIcon]}>
                <Ionicons name="arrow-down" size={15} color="#16845A" />
              </View>
              <View>
                <Text style={s.sub}>Income</Text>
                <Text style={[s.num, s.incomeText]}>{totals.income.toFixed(2)}</Text>
              </View>
            </View>
            <View style={s.totalBlock}>
              <View style={[s.totalIcon, s.expenseIcon]}>
                <Ionicons name="arrow-up" size={15} color="#D45B55" />
              </View>
              <View>
                <Text style={s.sub}>Expenses</Text>
                <Text style={[s.num, s.expenseText]}>{totals.expense.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.monthSelector}>
          <Pressable
            onPress={() => setYm((current) => prevMonth(current.y, current.m))}
            style={s.monthButton}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={19} color="#5865D9" />
          </Pressable>
          <Pressable onPress={openMonthPicker} style={s.monthLabel} accessibilityRole="button"
            accessibilityLabel={`Choose month, currently ${MONTH_NAMES[ym.m]} ${ym.y}`}>
            <Text style={s.monthKicker}>SHOWING TRANSACTIONS FOR</Text>
            <View style={s.monthTextRow}>
              <Text style={s.monthText}>{MONTH_NAMES[ym.m]} {ym.y}</Text>
              <Ionicons name="chevron-down" size={16} color="#5865D9" />
            </View>
          </Pressable>
          <Pressable
            onPress={() => setYm((current) => nextMonth(current.y, current.m))}
            style={s.monthButton}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={19} color="#5865D9" />
          </Pressable>
        </View>

        <Pressable onPress={openAdd} style={({ pressed }) => [s.addButton, pressed && s.pressed]} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={21} color="#FFFFFF" />
          <Text style={s.addButtonText}>Add transaction</Text>
        </Pressable>

        <View style={s.listHeader}>
          <Text style={s.sectionTitle}>Recent activity</Text>
          <Text style={s.count}>{transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}</Text>
        </View>

        <FlatList
          style={s.list}
          contentContainerStyle={transactions.length === 0 ? s.emptyList : undefined}
          data={transactions}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => {
            const isIncome = item.kind === 'income';
            return (
              <Pressable onLongPress={() => confirmDelete(item)} accessibilityRole="button"
                accessibilityLabel={`${item.categories?.name ?? 'Uncategorized'}, ${isIncome ? 'income' : 'expense'}`}>
                <View style={s.item}>
                  <View style={[s.categoryIcon, isIncome ? s.incomeIcon : s.expenseIcon]}>
                    <Ionicons name={isIncome ? 'arrow-down' : 'arrow-up'} size={18}
                      color={isIncome ? '#16845A' : '#D45B55'} />
                  </View>
                  <View style={s.itemInfo}>
                    <Text style={s.itemTitle}>{item.categories?.name ?? 'Uncategorized'}</Text>
                    <Text style={s.sub} numberOfLines={1}>
                      {item.accounts?.name ?? 'Unknown account'} · {item.occurred_on}
                    </Text>
                    {item.note ? <Text style={s.note} numberOfLines={1}>{item.note}</Text> : null}
                  </View>
                  <View style={s.amountBlock}>
                    <Text style={[s.amount, isIncome ? s.incomeText : s.expenseText]}>
                      {isIncome ? '+' : '-'}{Number(item.amount).toFixed(2)}
                    </Text>
                    <Text style={s.currencyCode}>{item.accounts?.currency}</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIcon}><Ionicons name="receipt-outline" size={26} color="#5865D9" /></View>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptyText}>Add your first expense or income to start seeing your money story here.</Text>
              <Pressable onPress={openAdd} style={s.emptyAction} accessibilityRole="button">
                <Text style={s.emptyActionText}>Add your first transaction</Text>
              </Pressable>
            </View>
          }
        />
      </View>

      <AddTransactionModal
        visible={showAdd}
        accounts={accounts}
        categories={categories}
        onClose={() => setShowAdd(false)}
        onSaved={load}
      />

      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <Pressable style={s.monthPickerCard} onPress={(event) => event.stopPropagation()}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Choose a month</Text>
              <Pressable onPress={() => setShowMonthPicker(false)} style={s.closeButton}
                accessibilityRole="button" accessibilityLabel="Close month picker">
                <Ionicons name="close" size={21} color="#697187" />
              </Pressable>
            </View>

            <View style={s.yearSelector}>
              <Pressable onPress={() => setPickerYear((year) => year - 1)} style={s.yearButton}
                accessibilityRole="button" accessibilityLabel="Previous year">
                <Ionicons name="chevron-back" size={18} color="#5865D9" />
              </Pressable>
              <Text style={s.yearText}>{pickerYear}</Text>
              <Pressable onPress={() => setPickerYear((year) => year + 1)} style={s.yearButton}
                accessibilityRole="button" accessibilityLabel="Next year">
                <Ionicons name="chevron-forward" size={18} color="#5865D9" />
              </Pressable>
            </View>

            <View style={s.monthGrid}>
              {MONTH_NAMES.map((month, index) => {
                const active = ym.y === pickerYear && ym.m === index;
                return (
                  <Pressable
                    key={month}
                    onPress={() => {
                      setYm({ y: pickerYear, m: index });
                      setShowMonthPicker(false);
                    }}
                    style={[s.monthOption, active && s.monthOptionActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`${month} ${pickerYear}`}
                  >
                    <Text style={[s.monthOptionText, active && s.monthOptionTextActive]}>
                      {month.slice(0, 3)}
                    </Text>
                  </Pressable>
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
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20, paddingTop: 18 },
  kicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headerAction: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 15, height: 46, justifyContent: 'center', width: 46 },
  summaryCard: { backgroundColor: '#29304A', borderRadius: 22, padding: 20 },
  summaryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#AEB6D4', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  currency: { color: '#C9CEE1', fontSize: 12 },
  netAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  negativeAmount: { color: '#FFB0A9' },
  summaryDivider: { backgroundColor: '#4A5271', height: 1, marginVertical: 17 },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  totalBlock: { alignItems: 'center', flexDirection: 'row', minWidth: '45%' },
  totalIcon: { alignItems: 'center', borderRadius: 10, height: 30, justifyContent: 'center', marginRight: 9, width: 30 },
  incomeIcon: { backgroundColor: '#DDF5EA' },
  expenseIcon: { backgroundColor: '#FDE5E2' },
  num: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  incomeText: { color: '#16845A' },
  expenseText: { color: '#D45B55' },
  sub: { color: '#AEB6D4', fontSize: 12 },
  monthSelector: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, padding: 8 },
  monthButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  monthLabel: { alignItems: 'center' },
  monthKicker: { color: '#8A91A4', fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  monthTextRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  monthText: { color: '#29304A', fontSize: 16, fontWeight: '800', marginTop: 3 },
  addButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', marginTop: 14, minHeight: 50 },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  pressed: { opacity: 0.78 },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, marginTop: 25 },
  sectionTitle: { color: '#29304A', fontSize: 18, fontWeight: '800' },
  count: { color: '#8A91A4', fontSize: 12 },
  list: { flex: 1 },
  item: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 10, minHeight: 78, paddingHorizontal: 13, paddingVertical: 12 },
  categoryIcon: { alignItems: 'center', borderRadius: 13, height: 42, justifyContent: 'center', marginRight: 11, width: 42 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { color: '#29304A', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  note: { color: '#8A91A4', fontSize: 11, marginTop: 3 },
  amountBlock: { alignItems: 'flex-end', marginLeft: 8 },
  amount: { fontSize: 15, fontWeight: '800' },
  currencyCode: { color: '#9AA1B2', fontSize: 10, marginTop: 3 },
  emptyList: { flexGrow: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 42 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#E9EBFF', borderRadius: 20, height: 58, justifyContent: 'center', width: 58 },
  emptyTitle: { color: '#29304A', fontSize: 17, fontWeight: '800', marginTop: 15 },
  emptyText: { color: '#7C8496', fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  emptyAction: { backgroundColor: '#EEF0FF', borderRadius: 12, marginTop: 18, paddingHorizontal: 15, paddingVertical: 11 },
  emptyActionText: { color: '#5865D9', fontSize: 13, fontWeight: '800' },
  modalOverlay: { backgroundColor: 'rgba(24, 29, 49, 0.48)', flex: 1, justifyContent: 'center', padding: 24 },
  monthPickerCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20 },
  pickerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pickerTitle: { color: '#29304A', fontSize: 19, fontWeight: '800' },
  closeButton: { alignItems: 'center', backgroundColor: '#F1F2F7', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  yearSelector: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  yearButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  yearText: { color: '#20263B', fontSize: 22, fontWeight: '800' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginTop: 22 },
  monthOption: { alignItems: 'center', backgroundColor: '#F7F8FC', borderRadius: 12, height: 46, justifyContent: 'center', width: '29%' },
  monthOptionActive: { backgroundColor: '#5865D9' },
  monthOptionText: { color: '#697187', fontSize: 14, fontWeight: '700' },
  monthOptionTextActive: { color: '#FFFFFF' },
});