import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, Button, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { todayLocal } from '../lib/dates';
import { Account, Category, Kind } from '../types';

type Props = {
  visible: boolean;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
};

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={active ? s.chipTextActive : s.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function AddTransactionModal({ visible, accounts, categories, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<Kind>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setKind('expense');
      setAmount('');
      setNote('');
      setCategoryId(null);
      setAccountId(accounts[0]?.id ?? null);
      setDate(todayLocal());
    }
  }, [visible, accounts]);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  async function save() {
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    if (!accountId) return Alert.alert('Pick an account');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Invalid date', 'Use YYYY-MM-DD.');

    setBusy(true);
    const { error } = await supabase.from('transactions').insert({
      account_id: accountId,
      category_id: categoryId,
      kind,
      amount: value,
      note: note.trim() || null,
      occurred_on: date,
    });
    setBusy(false);
    if (error) return Alert.alert('Save failed', error.message);
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.box} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>New transaction</Text>

          <View style={s.row}>
            <Chip label="Expense" active={kind === 'expense'} onPress={() => { setKind('expense'); setCategoryId(null); }} />
            <Chip label="Income" active={kind === 'income'} onPress={() => { setKind('income'); setCategoryId(null); }} />
          </View>

          <TextInput style={s.input} placeholder="Amount" keyboardType="decimal-pad"
            value={amount} onChangeText={setAmount} />

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

          <Text style={s.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate} autoCapitalize="none" />

          <TextInput style={s.input} placeholder="Note (optional)" value={note} onChangeText={setNote} />

          <Button title={busy ? 'Saving...' : 'Save'} onPress={save} disabled={busy} />
          <View style={{ height: 8 }} />
          <Button title="Cancel" color="#888" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  box: { padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  label: { fontWeight: '600', marginTop: 8, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff' },
});