import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Button, Alert, FlatList, Pressable, Modal, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { todayLocal } from '../lib/dates';
import { formatMoney } from '../lib/currency';
import { Goal } from '../types';

type ModalState =
  | { mode: 'new' }
  | { mode: 'add' | 'withdraw'; goal: Goal }
  | null;

function daysLeft(deadline: string): number {
  const ms = new Date(deadline).getTime() - new Date(todayLocal()).getTime();
  return Math.ceil(ms / 86400000);
}

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contribs, setContribs] = useState<{ goal_id: string; amount: number }[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    const [g, c] = await Promise.all([
      supabase.from('goals').select('*').is('deleted_at', null).order('created_at'),
      supabase.from('goal_contributions').select('goal_id, amount').is('deleted_at', null),
    ]);
    const err = g.error || c.error;
    if (err) return Alert.alert('Load failed', err.message);
    setGoals(g.data as Goal[]);
    setContribs(c.data as { goal_id: string; amount: number }[]);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const savedByGoal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contribs) map[c.goal_id] = (map[c.goal_id] ?? 0) + Number(c.amount);
    return map;
  }, [contribs]);

  function openModal(m: ModalState) {
    setName('');
    setTarget('');
    setDeadline('');
    setAmount('');
    setModal(m);
  }

  async function save() {
    if (!modal) return;

    if (modal.mode === 'new') {
      const t = Number(target.replace(',', '.'));
      if (!name.trim()) return Alert.alert('Enter a goal name');
      if (!t || t <= 0) return Alert.alert('Enter a target amount greater than 0');
      if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
        return Alert.alert('Invalid deadline', 'Use YYYY-MM-DD or leave it empty.');
      }
      const { error } = await supabase
        .from('goals')
        .insert({ name: name.trim(), target_amount: t, deadline: deadline || null });
      if (error) return Alert.alert('Save failed', error.message);
    } else {
      const v = Number(amount.replace(',', '.'));
      if (!v || v <= 0) return Alert.alert('Enter an amount greater than 0');
      const saved = savedByGoal[modal.goal.id] ?? 0;
      if (modal.mode === 'withdraw' && v > saved) {
        return Alert.alert('Not enough saved', `This goal only has ${formatMoney(saved)}.`);
      }
      const { error } = await supabase.from('goal_contributions').insert({
        goal_id: modal.goal.id,
        amount: modal.mode === 'withdraw' ? -v : v,
        contributed_on: todayLocal(),
      });
      if (error) return Alert.alert('Save failed', error.message);
    }

    setModal(null);
    load();
  }

  function confirmDelete(g: Goal) {
    Alert.alert('Delete goal?', g.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from('goals')
            .update({ deleted_at: now, updated_at: now })
            .eq('id', g.id);
          if (error) return Alert.alert('Delete failed', error.message);
          load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={s.box}>
        <Text style={s.title}>Savings goals</Text>
        <Button title="+ New goal" onPress={() => openModal({ mode: 'new' })} />

        <FlatList
          style={{ marginTop: 12 }}
          data={goals}
          keyExtractor={(g) => g.id}
          ListEmptyComponent={<Text style={s.sub}>No goals yet. Long-press a goal to delete it.</Text>}
          renderItem={({ item }) => {
            const saved = savedByGoal[item.id] ?? 0;
            const target = Number(item.target_amount);
            const pct = Math.min((saved / target) * 100, 100);
            const done = saved >= target;
            const left = item.deadline ? daysLeft(item.deadline) : null;
            return (
              <Pressable onLongPress={() => confirmDelete(item)} style={s.item}>
                <View style={s.itemTop}>
                  <Text style={s.itemTitle}>{item.name}</Text>
                  <Text style={s.sub}>{formatMoney(saved)} / {formatMoney(target)}</Text>
                </View>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${pct}%`, backgroundColor: done ? '#1e8e3e' : '#2196f3' }]} />
                </View>
                <Text style={s.sub}>
                  {done
                    ? 'Goal reached!'
                    : `${Math.round(pct)}% · ${formatMoney(target - saved)} to go`}
                  {left !== null && !done
                    ? left >= 0 ? ` · ${left} days left` : ` · ${-left} days overdue`
                    : ''}
                </Text>
                <View style={s.actions}>
                  <Button title="Add" onPress={() => openModal({ mode: 'add', goal: item })} />
                  <Button title="Withdraw" color="#888" onPress={() => openModal({ mode: 'withdraw', goal: item })} />
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <View style={s.card}>
            {modal?.mode === 'new' ? (
              <>
                <Text style={s.itemTitle}>New goal</Text>
                <TextInput style={s.input} placeholder="Name (e.g. Emergency fund)" value={name} onChangeText={setName} />
                <TextInput style={s.input} placeholder="Target amount" keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
                <TextInput style={s.input} placeholder="Deadline YYYY-MM-DD (optional)" autoCapitalize="none" value={deadline} onChangeText={setDeadline} />
              </>
            ) : (
              <>
                <Text style={s.itemTitle}>
                  {modal?.mode === 'withdraw' ? 'Withdraw from' : 'Add to'} {modal?.goal.name}
                </Text>
                <TextInput style={s.input} placeholder="Amount" keyboardType="decimal-pad" autoFocus value={amount} onChangeText={setAmount} />
              </>
            )}
            <Button title="Save" onPress={save} />
            <View style={{ height: 8 }} />
            <Button title="Cancel" color="#888" onPress={() => setModal(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  sub: { color: '#666', fontSize: 13 },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemTitle: { fontSize: 16, fontWeight: '500' },
  barBg: { height: 8, backgroundColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginVertical: 8 },
});