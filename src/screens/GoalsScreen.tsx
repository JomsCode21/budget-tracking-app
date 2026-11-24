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
import { todayLocal } from '../lib/dates';
import { formatMoney } from '../lib/currency';
import { Goal } from '../types';
import AnimatedPressable from '../components/AnimatedPressable';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import SwipeableDeleteRow from '../components/SwipeableDeleteRow';

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
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setBusy(true);

    if (modal.mode === 'new') {
      const t = Number(target.replace(',', '.'));
      if (!name.trim()) {
        setBusy(false);
        return Alert.alert('Enter a goal name');
      }
      if (!t || t <= 0) {
        setBusy(false);
        return Alert.alert('Enter a target amount greater than 0');
      }
      if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
        setBusy(false);
        return Alert.alert('Invalid deadline', 'Use YYYY-MM-DD or leave it empty.');
      }
      const { error } = await supabase
        .from('goals')
        .insert({ name: name.trim(), target_amount: t, deadline: deadline || null });
      setBusy(false);
      if (error) return Alert.alert('Save failed', error.message);
    } else {
      const v = Number(amount.replace(',', '.'));
      if (!v || v <= 0) {
        setBusy(false);
        return Alert.alert('Enter an amount greater than 0');
      }
      const saved = savedByGoal[modal.goal.id] ?? 0;
      if (modal.mode === 'withdraw' && v > saved) {
        setBusy(false);
        return Alert.alert('Not enough saved', `This goal only has ${formatMoney(saved)}.`);
      }
      const { error } = await supabase.from('goal_contributions').insert({
        goal_id: modal.goal.id,
        amount: modal.mode === 'withdraw' ? -v : v,
        contributed_on: todayLocal(),
      });
      setBusy(false);
      if (error) return Alert.alert('Save failed', error.message);
    }

    setModal(null);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('goals')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) return Alert.alert('Delete failed', error.message);
    setDeleteTarget(null);
    load();
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <View style={s.box}>
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>YOUR FUTURE SAVINGS</Text>
            <Text style={s.title}>Savings goals</Text>
          </View>
          <AnimatedPressable onPress={() => openModal({ mode: 'new' })} style={s.headerButton}
            accessibilityRole="button" accessibilityLabel="Create a savings goal">
            <Ionicons name="add" size={25} color="#FFFFFF" />
          </AnimatedPressable>
        </View>

        <View style={s.summaryCard}>
          <View>
            <Text style={s.summaryLabel}>TOTAL SAVED</Text>
            <Text style={s.summaryAmount}>
              {formatMoney(goals.reduce((sum, goal) => sum + (savedByGoal[goal.id] ?? 0), 0))}
            </Text>
          </View>
          <View style={s.summaryGoalCount}>
            <Ionicons name="flag-outline" size={16} color="#5865D9" />
            <Text style={s.summaryGoalCountText}>{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</Text>
          </View>
        </View>

        <AnimatedPressable onPress={() => openModal({ mode: 'new' })} style={s.createButton} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={s.createButtonText}>Create new goal</Text>
        </AnimatedPressable>

        <FlatList
          style={s.list}
          contentContainerStyle={goals.length === 0 ? s.emptyList : s.listContent}
          showsVerticalScrollIndicator={false}
          data={goals}
          keyExtractor={(g) => g.id}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIcon}><Ionicons name="flag-outline" size={27} color="#5865D9" /></View>
              <Text style={s.emptyTitle}>Set your first goal</Text>
              <Text style={s.emptyText}>Create a savings target and track every contribution in one place.</Text>
              <AnimatedPressable onPress={() => openModal({ mode: 'new' })} style={s.emptyAction}
                accessibilityRole="button">
                <Text style={s.emptyActionText}>Create a goal</Text>
              </AnimatedPressable>
            </View>
          }
          renderItem={({ item }) => {
            const saved = savedByGoal[item.id] ?? 0;
            const target = Number(item.target_amount);
            const pct = Math.min((saved / target) * 100, 100);
            const done = saved >= target;
            const left = item.deadline ? daysLeft(item.deadline) : null;
            return (
              <SwipeableDeleteRow onDelete={() => setDeleteTarget(item)} label="Delete" disabled={deleting}>
                <View style={s.goalCard}>
                  <View style={s.goalTop}>
                    <View style={[s.goalIcon, done && s.goalIconDone]}>
                      <Ionicons name={done ? 'checkmark' : 'flag-outline'} size={20}
                        color={done ? '#16845A' : '#5865D9'} />
                    </View>
                    <View style={s.goalInfo}>
                      <Text style={s.goalName}>{item.name}</Text>
                      <Text style={[s.goalStatus, done && s.goalStatusDone]}>
                        {done
                          ? 'Goal reached!'
                          : left !== null
                            ? left >= 0 ? `${left} days left` : `${-left} days overdue`
                            : 'No deadline'}
                      </Text>
                    </View>
                    <View style={s.goalAmount}>
                      <Text style={s.savedAmount}>{formatMoney(saved)}</Text>
                      <Text style={s.targetAmount}>of {formatMoney(target)}</Text>
                    </View>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: done ? '#16845A' : '#5865D9' }]} />
                  </View>
                  <View style={s.goalFooter}>
                    <Text style={s.percentText}>{Math.round(pct)}%</Text>
                    <Text style={s.remainingText}>
                      {done ? 'Completed' : `${formatMoney(target - saved)} to go`}
                    </Text>
                  </View>
                  <View style={s.actions}>
                    <AnimatedPressable onPress={() => openModal({ mode: 'add', goal: item })}
                      style={s.addButton} accessibilityRole="button">
                      <Ionicons name="add" size={18} color="#5865D9" />
                      <Text style={s.addButtonText}>Add money</Text>
                    </AnimatedPressable>
                    <AnimatedPressable onPress={() => openModal({ mode: 'withdraw', goal: item })}
                      style={s.withdrawButton} accessibilityRole="button">
                      <Ionicons name="remove" size={18} color="#697187" />
                      <Text style={s.withdrawButtonText}>Withdraw</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </SwipeableDeleteRow>
            );
          }}
        />
      </View>

      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(null)} />
          <View style={s.editSheet}>
            <View style={s.handle} />
            {modal?.mode === 'new' ? (
              <>
                <Text style={s.editKicker}>NEW SAVINGS TARGET</Text>
                <Text style={s.editTitle}>Create a goal</Text>
                <Text style={s.inputLabel}>Goal name</Text>
                <View style={s.inputShell}>
                  <Ionicons name="flag-outline" size={18} color="#7C8496" style={s.inputIcon} />
                  <TextInput style={s.input} placeholder="Emergency fund" value={name} onChangeText={setName} />
                </View>
                <Text style={s.inputLabel}>Target amount</Text>
                <View style={s.inputShell}>
                  <Text style={s.inputCurrency}>PHP</Text>
                  <TextInput style={s.input} placeholder="0.00" keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
                </View>
                <Text style={s.inputLabel}>Deadline <Text style={s.optional}>(optional)</Text></Text>
                <View style={s.inputShell}>
                  <Ionicons name="calendar-outline" size={18} color="#7C8496" style={s.inputIcon} />
                  <TextInput style={s.input} placeholder="YYYY-MM-DD" autoCapitalize="none" value={deadline} onChangeText={setDeadline} />
                </View>
              </>
            ) : (
              <>
                <Text style={s.editKicker}>{modal?.mode === 'withdraw' ? 'REMOVE SAVINGS' : 'GROW YOUR GOAL'}</Text>
                <Text style={s.editTitle}>{modal?.mode === 'withdraw' ? 'Withdraw from' : 'Add to'} {modal?.goal.name}</Text>
                <Text style={s.inputLabel}>Amount</Text>
                <View style={s.inputShell}>
                  <Text style={s.inputCurrency}>PHP</Text>
                  <TextInput style={s.input} placeholder="0.00" keyboardType="decimal-pad" autoFocus
                    value={amount} onChangeText={setAmount} />
                </View>
              </>
            )}
            <AnimatedPressable onPress={save} disabled={busy} style={[s.saveButton, busy && s.disabledButton]} accessibilityRole="button">
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={s.saveButtonText}>{busy ? 'Saving...' : 'Save'}</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => setModal(null)} disabled={busy} style={s.cancelButton} accessibilityRole="button">
              <Text style={s.cancelText}>Cancel</Text>
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DeleteConfirmModal
        visible={deleteTarget !== null}
        title="Delete savings goal?"
        detail={deleteTarget?.name ?? ''}
        description="The goal and its saved contribution history will be hidden."
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { backgroundColor: '#F6F7FB', flex: 1 },
  box: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingTop: 18 },
  kicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headerButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 15, height: 46, justifyContent: 'center', width: 46 },
  summaryCard: { alignItems: 'center', backgroundColor: '#29304A', borderRadius: 22, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  summaryLabel: { color: '#AEB6D4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summaryAmount: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 4 },
  summaryGoalCount: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 12, flexDirection: 'row', paddingHorizontal: 9, paddingVertical: 8 },
  summaryGoalCountText: { color: '#5865D9', fontSize: 12, fontWeight: '800', marginLeft: 5 },
  createButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', marginTop: 12, minHeight: 50 },
  createButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  list: { flex: 1, marginTop: 18 },
  listContent: { paddingBottom: 18 },
  emptyList: { flexGrow: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 42 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#E9EBFF', borderRadius: 20, height: 58, justifyContent: 'center', width: 58 },
  emptyTitle: { color: '#29304A', fontSize: 17, fontWeight: '800', marginTop: 15 },
  emptyText: { color: '#7C8496', fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  emptyAction: { backgroundColor: '#EEF0FF', borderRadius: 12, marginTop: 18, paddingHorizontal: 15, paddingVertical: 11 },
  emptyActionText: { color: '#5865D9', fontSize: 13, fontWeight: '800' },
  goalCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 18, borderWidth: 1, padding: 14 },
  goalTop: { alignItems: 'center', flexDirection: 'row' },
  goalIcon: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 13, height: 44, justifyContent: 'center', width: 44 },
  goalIconDone: { backgroundColor: '#DDF5EA' },
  goalInfo: { flex: 1, marginHorizontal: 11 },
  goalName: { color: '#29304A', fontSize: 16, fontWeight: '800' },
  goalStatus: { color: '#D68A25', fontSize: 11, marginTop: 4 },
  goalStatusDone: { color: '#16845A' },
  goalAmount: { alignItems: 'flex-end' },
  savedAmount: { color: '#29304A', fontSize: 15, fontWeight: '800' },
  targetAmount: { color: '#8A91A4', fontSize: 11, marginTop: 3 },
  progressTrack: { backgroundColor: '#ECEEF4', borderRadius: 5, height: 8, marginTop: 14, overflow: 'hidden' },
  progressFill: { borderRadius: 5, height: 8 },
  goalFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  percentText: { color: '#5865D9', fontSize: 12, fontWeight: '800' },
  remainingText: { color: '#8A91A4', fontSize: 11 },
  actions: { alignItems: 'stretch', flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 14, width: '100%' },
  addButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 12, flex: 1, flexBasis: 0, flexDirection: 'row', justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  addButtonText: { color: '#5865D9', fontSize: 13, fontWeight: '800', marginLeft: 5 },
  withdrawButton: { alignItems: 'center', backgroundColor: '#F4F5F8', borderRadius: 12, flex: 1, flexBasis: 0, flexDirection: 'row', justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  withdrawButtonText: { color: '#697187', fontSize: 13, fontWeight: '800', marginLeft: 5 },
  overlay: { backgroundColor: 'rgba(24, 29, 49, 0.48)', flex: 1, justifyContent: 'flex-end' },
  editSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 12 },
  handle: { alignSelf: 'center', backgroundColor: '#DDE1EC', borderRadius: 3, height: 5, marginBottom: 18, width: 42 },
  editKicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  editTitle: { color: '#20263B', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  inputLabel: { color: '#343B53', fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  optional: { color: '#A0A6B6', fontWeight: '500' },
  inputShell: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#E4E7EF', borderRadius: 13, borderWidth: 1, flexDirection: 'row', minHeight: 52 },
  inputIcon: { marginLeft: 15 },
  inputCurrency: { color: '#5865D9', fontSize: 14, fontWeight: '800', marginLeft: 15, marginRight: 10 },
  input: { color: '#252B40', flex: 1, fontSize: 15, minHeight: 50, paddingHorizontal: 12 },
  saveButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', marginTop: 18, minHeight: 52 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  cancelButton: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#697187', fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.65 },
});