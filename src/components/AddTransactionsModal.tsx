import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { todayLocal } from '../lib/dates';
import { Account, Category, Kind } from '../types';
import AnimatedPressable from './AnimatedPressable';

type Props = {
  visible: boolean;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
};

function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]}>
      {icon ? <Ionicons name={icon} size={16} color={active ? '#FFFFFF' : '#697187'} /> : null}
      <Text style={active ? s.chipTextActive : s.chipText}>{label}</Text>
      {active ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const sheetY = useRef(new Animated.Value(36)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!visible) return;
    sheetY.setValue(36);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY, { damping: 19, stiffness: 220, toValue: 0, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { duration: 180, toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [backdropOpacity, sheetY, visible]);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  function dateFromInput(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date();
    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function formatDate(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function onDateValueChange(_event: DateTimePickerChangeEvent, value: Date) {
    setDate(formatDate(value));
    if (Platform.OS !== 'ios') setShowDatePicker(false);
  }

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button"
            accessibilityLabel="Close add transaction form" />
        </Animated.View>
        <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
          <SafeAreaView edges={['bottom']}>
            <ScrollView contentContainerStyle={s.box} keyboardShouldPersistTaps="handled">
              <View style={s.handle} />
              <View style={s.header}>
                <View>
                  <Text style={s.eyebrow}>MONEY ACTIVITY</Text>
                  <Text style={s.title}>Add transaction</Text>
                </View>
                <AnimatedPressable onPress={onClose} style={s.closeButton} accessibilityRole="button" accessibilityLabel="Close">
                  <Ionicons name="close" size={21} color="#697187" />
                </AnimatedPressable>
              </View>

              <View style={s.kindToggle}>
                <AnimatedPressable onPress={() => { setKind('expense'); setCategoryId(null); }}
                  style={[s.kindOption, kind === 'expense' && s.kindOptionExpense]}>
                  <Ionicons name="arrow-up-circle-outline" size={21} color={kind === 'expense' ? '#D45B55' : '#8A91A4'} />
                  <Text style={[s.kindText, kind === 'expense' && s.kindTextExpense]}>Expense</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => { setKind('income'); setCategoryId(null); }}
                  style={[s.kindOption, kind === 'income' && s.kindOptionIncome]}>
                  <Ionicons name="arrow-down-circle-outline" size={21} color={kind === 'income' ? '#16845A' : '#8A91A4'} />
                  <Text style={[s.kindText, kind === 'income' && s.kindTextIncome]}>Income</Text>
                </AnimatedPressable>
              </View>

              <Text style={s.label}>Amount</Text>
              <View style={s.amountShell}>
                <Text style={s.amountCurrency}>{accounts.find((a) => a.id === accountId)?.currency ?? 'PHP'}</Text>
                <TextInput
                  style={s.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#AEB6C5"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus
                  accessibilityLabel="Transaction amount"
                />
              </View>

              <Text style={s.label}>Category</Text>
              <View style={s.wrap}>
                {visibleCategories.map((c) => (
                  <Chip key={c.id} label={c.name} active={categoryId === c.id}
                    icon="pricetag-outline" onPress={() => setCategoryId(c.id)} />
                ))}
              </View>

              <Text style={s.label}>Account</Text>
              <View style={s.wrap}>
                {accounts.map((a) => (
                  <Chip key={a.id} label={`${a.name} · ${a.currency}`} active={accountId === a.id}
                    icon="wallet-outline" onPress={() => setAccountId(a.id)} />
                ))}
              </View>

              <Text style={s.label}>Date</Text>
              <View style={s.inputShell}>
                <Ionicons name="calendar-outline" size={18} color="#7C8496" style={s.inputIcon} />
                <TextInput style={s.input} value={date} onChangeText={setDate} autoCapitalize="none"
                  keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor="#AEB6C5"
                  accessibilityLabel="Transaction date" />
                <AnimatedPressable onPress={() => setShowDatePicker(true)} style={s.calendarButton}
                  accessibilityRole="button" accessibilityLabel="Open calendar">
                  <Ionicons name="calendar" size={19} color="#5865D9" />
                </AnimatedPressable>
              </View>
              {showDatePicker ? (
                <View style={s.datePickerContainer}>
                  <DateTimePicker
                    value={dateFromInput(date)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onValueChange={onDateValueChange}
                    onDismiss={() => setShowDatePicker(false)}
                  />
                  {Platform.OS === 'ios' ? (
                    <AnimatedPressable onPress={() => setShowDatePicker(false)} style={s.dateDoneButton}
                      accessibilityRole="button" accessibilityLabel="Done choosing date">
                      <Text style={s.dateDoneText}>Done</Text>
                    </AnimatedPressable>
                  ) : null}
                </View>
              ) : null}

              <Text style={s.label}>Note <Text style={s.optional}>(optional)</Text></Text>
              <View style={s.inputShell}>
                <Ionicons name="document-text-outline" size={18} color="#7C8496" style={s.inputIcon} />
                <TextInput style={s.input} placeholder="What was this for?" placeholderTextColor="#AEB6C5"
                  value={note} onChangeText={setNote} accessibilityLabel="Transaction note" />
              </View>

              <AnimatedPressable onPress={save} disabled={busy}
                style={[s.saveButton, busy && s.disabledButton]}
                accessibilityRole="button">
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={s.saveButtonText}>{busy ? 'Saving...' : 'Save transaction'}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={onClose} disabled={busy} style={s.cancelButton} accessibilityRole="button">
                <Text style={s.cancelText}>Cancel</Text>
              </AnimatedPressable>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(24, 29, 49, 0.48)', flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%' },
  box: { padding: 22, paddingBottom: 12 },
  handle: { alignSelf: 'center', backgroundColor: '#DDE1EC', borderRadius: 3, height: 5, marginBottom: 18, width: 42 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  closeButton: { alignItems: 'center', backgroundColor: '#F1F2F7', borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  kindToggle: { borderRadius: 15, flexDirection: 'row', gap: 10, marginBottom: 20 },
  kindOption: { alignItems: 'center', backgroundColor: '#F3F4F8', borderColor: '#E4E7EF', borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 58, paddingHorizontal: 12 },
  kindOptionExpense: { backgroundColor: '#FDE5E2' },
  kindOptionIncome: { backgroundColor: '#DDF5EA' },
  kindText: { color: '#697187', fontSize: 16, fontWeight: '800', marginLeft: 8 },
  kindTextExpense: { color: '#D45B55' },
  kindTextIncome: { color: '#16845A' },
  label: { color: '#343B53', fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  optional: { color: '#A0A6B6', fontWeight: '500' },
  amountShell: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#DCE0EB', borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginBottom: 16, minHeight: 68, paddingHorizontal: 16 },
  amountCurrency: { color: '#5865D9', fontSize: 14, fontWeight: '800', marginRight: 10 },
  amountInput: { color: '#20263B', flex: 1, fontSize: 29, fontWeight: '800', paddingVertical: 8 },
  inputShell: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#E4E7EF', borderRadius: 13, borderWidth: 1, flexDirection: 'row', marginBottom: 14, minHeight: 52 },
  inputIcon: { marginLeft: 15 },
  input: { color: '#252B40', flex: 1, fontSize: 15, minHeight: 50, paddingHorizontal: 12 },
  calendarButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 10, height: 38, justifyContent: 'center', marginRight: 7, width: 38 },
  datePickerContainer: { backgroundColor: '#F8F9FC', borderColor: '#E4E7EF', borderRadius: 13, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  dateDoneButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 10, margin: 10, minHeight: 42, justifyContent: 'center' },
  dateDoneText: { color: '#5865D9', fontSize: 14, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 13 },
  chip: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#E1E4ED', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  chipActive: { backgroundColor: '#5865D9', borderColor: '#5865D9' },
  chipText: { color: '#697187', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  saveButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', marginTop: 7, minHeight: 53 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  cancelButton: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#697187', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  disabledButton: { opacity: 0.65 },
});