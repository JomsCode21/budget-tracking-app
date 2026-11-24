import React, { useCallback, useState } from 'react';
import { View, Text, Button, Alert, FlatList, Pressable, Modal, TextInput, ScrollView, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ensureDefaultCategories } from '../lib/categories';
import { nextOccurrence, todayLocal } from '../lib/dates';
import { syncRecurring } from '../lib/recurring';
import { formatMoney } from '../lib/currency';
import Chip from '../components/Chip';
import { Account, Category, Kind, RecurringRule } from '../types';

export default function RecurringScreen() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [show, setShow] = useState(false);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Kind>('expense');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [start, setStart] = useState(todayLocal());

  const load = useCallback(async () => {
    await ensureDefaultCategories();
    const [r, a, c] = await Promise.all([
      supabase
        .from('recurring_rules')
        .select('*, categories(name), accounts(name, currency)')
        .is('deleted_at', null)
        .order('next_due'),
      supabase.from('accounts').select('*').is('deleted_at', null).order('created_at'),
      supabase.from('categories').select('*').is('deleted_at', null).order('name'),
    ]);
    const err = r.error || a.error || c.error;
    if (err) return Alert.alert('Load failed', err.message);
    setRules(r.data as unknown as RecurringRule[]);
    setAccounts(a.data as Account[]);
    setCategories(c.data as Category[]);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openNew() {
    if (accounts.length === 0) {
      return Alert.alert('No account yet', 'Add an account first (More → Accounts).');
    }
    setName('');
    setAmount('');
    setKind('expense');
    setFrequency('monthly');
    setCategoryId(null);
    setAccountId(accounts[0].id);
    setStart(todayLocal());
    setShow(true);
  }

  async function create() {
    const v = Number(amount.replace(',', '.'));
    if (!name.trim()) return Alert.alert('Enter a name');
    if (!v || v <= 0) return Alert.alert('Enter an amount greater than 0');
    if (!accountId) return Alert.alert('Pick an account');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return Alert.alert('Invalid date', 'Use YYYY-MM-DD.');

    const { error } = await supabase.from('recurring_rules').insert({
      name: name.trim(),
      account_id: accountId,
      category_id: categoryId,
      kind,
      amount: v,
      frequency,
      anchor_day: Number(start.slice(8, 10)),
      next_due: start,
    });
    if (error) return Alert.alert('Save failed', error.message);
    setShow(false);
    try {
      await syncRecurring();
    } catch (e: unknown) {
      Alert.alert('Sync failed', e instanceof Error ? e.message : String(e));
    }
    load();
  }

  async function toggle(r: RecurringRule, value: boolean) {
    let nextDue = r.next_due;
    if (value) {
      // when turning a rule back on, skip the dates missed while it was off
      const today = todayLocal();
      let guard = 0;
      while (nextDue < today && guard < 366) {
        nextDue = nextOccurrence(nextDue, r.frequency, r.anchor_day);
        guard++;
      }
    }
    const { error } = await supabase
      .from('recurring_rules')
      .update({ active: value, next_due: nextDue, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) return Alert.alert('Update failed', error.message);
    try {
      await syncRecurring();
    } catch (e: unknown) {
      Alert.alert('Sync failed', e instanceof Error ? e.message : String(e));
    }
    load();
  }

  function confirmDelete(r: RecurringRule) {
    Alert.alert('Delete recurring item?', `${r.name}\nPast transactions are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from('recurring_rules')
            .update({ deleted_at: now, updated_at: now })
            .eq('id', r.id);
          if (error) return Alert.alert('Delete failed', error.message);
          try {
            await syncRecurring();
          } catch (e: unknown) {
            Alert.alert('Sync failed', e instanceof Error ? e.message : String(e));
          }
          load();
        },
      },
    ]);
  }

  const visibleCategories = categories.filter((c) => c.kind === kind);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={s.box}>
        <Button title="+ New recurring item" onPress={openNew} />
        <FlatList
          style={{ marginTop: 12 }}
          data={rules}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<Text style={s.sub}>Nothing yet. Long-press an item to delete it.</Text>}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => confirmDelete(item)} style={s.item}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{item.name}</Text>
                <Text style={s.sub}>
                  {item.kind === 'income' ? '+' : '-'}{formatMoney(Number(item.amount))} {item.accounts?.currency} · {item.frequency}
                </Text>
                <Text style={s.sub}>
                  {item.active ? `Next: ${item.next_due}` : 'Paused'}
                </Text>
              </View>
              <Switch value={item.active} onValueChange={(v) => toggle(item, v)} />
            </Pressable>
          )}
        />
      </View>

      <Modal visible={show} animationType="slide" onRequestClose={() => setShow(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.title}>New recurring item</Text>

            <View style={s.row}>
              <Chip label="Expense" active={kind === 'expense'} onPress={() => { setKind('expense'); setCategoryId(null); }} />
              <Chip label="Income" active={kind === 'income'} onPress={() => { setKind('income'); setCategoryId(null); }} />
            </View>

            <TextInput style={s.input} placeholder="Name (e.g. Rent, Netflix)" value={name} onChangeText={setName} />
            <TextInput style={s.input} placeholder="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

            <Text style={s.label}>Repeats</Text>
            <View style={s.row}>
              <Chip label="Monthly" active={frequency === 'monthly'} onPress={() => setFrequency('monthly')} />
              <Chip label="Weekly" active={frequency === 'weekly'} onPress={() => setFrequency('weekly')} />
            </View>

            <Text style={s.label}>Category</Text>
            <View style={s.wrap}>
              {visibleCategories.map((c) => (
                <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </View>

            <Text style={s.label}>Account</Text>
            <View style={s.wrap}>
              {accounts.map((a) => (
                <Chip key={a.id} label={`${a.name} (${a.currency})`} active={accountId === a.id} onPress={() => setAccountId(a.id)} />
              ))}
            </View>

            <Text style={s.label}>First due date (YYYY-MM-DD)</Text>
            <Text style={s.sub}>A past date creates the missed transactions right away.</Text>
            <TextInput style={s.input} value={start} onChangeText={setStart} autoCapitalize="none" />

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
  label: { fontWeight: '600', marginTop: 8, marginBottom: 6 },
  sub: { color: '#666', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  itemTitle: { fontSize: 16, fontWeight: '500' },
});