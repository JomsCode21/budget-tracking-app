import React, { useCallback, useState } from 'react';
import { View, Text, Button, Alert, FlatList, Pressable, Modal, TextInput, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { CURRENCIES, CurrencyInfo, convert, loadCurrency } from '../lib/currency';
import Chip from '../components/Chip';
import { Account } from '../types';

const TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
];

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [cur, setCur] = useState<CurrencyInfo>({ base: 'PHP', rates: {} });
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [currency, setCurrency] = useState('PHP');
  const [opening, setOpening] = useState('');

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('accounts').select('*').is('deleted_at', null).order('created_at'),
      supabase.from('account_balances').select('account_id, balance'),
      loadCurrency(),
    ]);
    const err = a.error || b.error;
    if (err) return Alert.alert('Load failed', err.message);
    const map: Record<string, number> = {};
    for (const row of b.data ?? []) map[row.account_id] = Number(row.balance);
    setAccounts(a.data as Account[]);
    setBalances(map);
    setCur(c);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const netWorth = accounts.reduce(
    (sum, a) => sum + convert(balances[a.id] ?? Number(a.opening_balance), a.currency, cur),
    0
  );

  function openNew() {
    setName('');
    setType('cash');
    setCurrency(cur.base);
    setOpening('');
    setShow(true);
  }

  async function create() {
    const ob = opening.trim() ? Number(opening.replace(',', '.')) : 0;
    if (!name.trim()) return Alert.alert('Enter a name');
    if (isNaN(ob)) return Alert.alert('Invalid opening balance');
    const { error } = await supabase
      .from('accounts')
      .insert({ name: name.trim(), type, currency, opening_balance: ob });
    if (error) return Alert.alert('Save failed', error.message);
    setShow(false);
    load();
  }

  async function confirmDelete(a: Account) {
    const { count, error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', a.id)
      .is('deleted_at', null);
    if (error) return Alert.alert('Check failed', error.message);
    if ((count ?? 0) > 0) {
      return Alert.alert('Account has transactions', 'Delete its transactions first, then delete the account.');
    }
    Alert.alert('Delete account?', a.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const now = new Date().toISOString();
          const { error: e2 } = await supabase
            .from('accounts')
            .update({ deleted_at: now, updated_at: now })
            .eq('id', a.id);
          if (e2) return Alert.alert('Delete failed', e2.message);
          load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={s.box}>
        <Text style={s.sub}>Net worth ({cur.base})</Text>
        <Text style={s.net}>{netWorth.toFixed(2)}</Text>

        <Button title="+ New account" onPress={openNew} />

        <FlatList
          style={{ marginTop: 12 }}
          data={accounts}
          keyExtractor={(a) => a.id}
          ListEmptyComponent={<Text style={s.sub}>No accounts yet. Long-press one to delete it.</Text>}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => confirmDelete(item)} style={s.item}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{item.name}</Text>
                <Text style={s.sub}>{item.type} · {item.currency}</Text>
              </View>
              <Text style={s.itemTitle}>
                {(balances[item.id] ?? Number(item.opening_balance)).toFixed(2)} {item.currency}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <Modal visible={show} animationType="slide" onRequestClose={() => setShow(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.title}>New account</Text>
            <TextInput style={s.input} placeholder="Name (e.g. Wallet, BDO, GCash)" value={name} onChangeText={setName} />

            <Text style={s.label}>Type</Text>
            <View style={s.wrap}>
              {TYPES.map((t) => (
                <Chip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
              ))}
            </View>

            <Text style={s.label}>Currency</Text>
            <View style={s.wrap}>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </View>

            <TextInput style={s.input} placeholder="Opening balance (optional)" keyboardType="decimal-pad"
              value={opening} onChangeText={setOpening} />

            <Button title="Save" onPress={create} />
            <View style={{ height: 8 }} />
            <Button title="Cancel" color="#888" onPress={() => setShow(false)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  net: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  label: { fontWeight: '600', marginTop: 8, marginBottom: 6 },
  sub: { color: '#666', fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  itemTitle: { fontSize: 16, fontWeight: '500' },
});