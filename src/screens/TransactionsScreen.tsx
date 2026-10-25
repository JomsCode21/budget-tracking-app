import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Button, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ensureDefaultCategories } from '../lib/categories';
import { CurrencyInfo, convert, loadCurrency } from '../lib/currency';
import AddTransactionModal from '../components/AddTransactionsModal';
import { Account, Category, Transaction } from '../types';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cur, setCur] = useState<CurrencyInfo>({ base: 'PHP', rates: {} });
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    await ensureDefaultCategories();
    const [tx, acc, cat] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name), accounts(name, currency)')
        .is('deleted_at', null)
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
  }, []);

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
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={s.box}>
        <Text style={s.title}>Transactions</Text>
        <Text style={[s.sub, { marginBottom: 8 }]}>Totals in {cur.base}</Text>

        <View style={s.totals}>
          <View><Text style={s.sub}>Income</Text><Text style={[s.num, { color: '#1e8e3e' }]}>{totals.income.toFixed(2)}</Text></View>
          <View><Text style={s.sub}>Expenses</Text><Text style={[s.num, { color: '#c0392b' }]}>{totals.expense.toFixed(2)}</Text></View>
          <View><Text style={s.sub}>Net</Text><Text style={s.num}>{totals.net.toFixed(2)}</Text></View>
        </View>

        <Button title="+ Add transaction" onPress={openAdd} />

        <FlatList
          style={{ marginTop: 12 }}
          data={transactions}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => confirmDelete(item)}>
              <View style={s.item}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{item.categories?.name ?? 'Uncategorized'}</Text>
                  <Text style={s.sub}>
                    {item.occurred_on} · {item.accounts?.name}{item.note ? ` · ${item.note}` : ''}
                  </Text>
                </View>
                <Text style={{ color: item.kind === 'income' ? '#1e8e3e' : '#c0392b', fontWeight: '600' }}>
                  {item.kind === 'income' ? '+' : '-'}{Number(item.amount).toFixed(2)} {item.accounts?.currency}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={s.sub}>No transactions yet. Long-press one to delete it.</Text>}
        />
      </View>

      <AddTransactionModal
        visible={showAdd}
        accounts={accounts}
        categories={categories}
        onClose={() => setShowAdd(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  totals: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  num: { fontSize: 18, fontWeight: '600' },
  sub: { color: '#666', fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  itemTitle: { fontSize: 16, fontWeight: '500' },
});