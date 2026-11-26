import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AnimatedPressable from '../components/AnimatedPressable';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { formatMoney, loadCurrency } from '../lib/currency';
import { todayLocal } from '../lib/dates';
import {
  creditedOvertimeMinutes,
  isValidDate,
  isValidTime,
  lateMinutes,
  localTime,
  localTimestamp,
  overtimeMinutes,
  maximumOvertimeMinutes,
  regularWorkMinutes,
  scheduledWorkMinutes,
  undertimeMinutes,
} from '../lib/dtr';
import { dtrPeriodForDate, DtrPeriod, formatDtrPeriod, shiftDtrPeriod } from '../lib/dtrPeriods';
import { exportDtrCsv } from '../lib/export';
import { supabase } from '../lib/supabase';
import { DtrEntry, DtrSettings } from '../types';

const EMPTY_SETTINGS: DtrSettings = {
  user_id: '',
  daily_rate: 0,
  overtime_rate: 0,
  standard_start: '06:00:00',
  standard_end: '15:00:00',
  overtime_end: '18:00:00',
  scheduled_break_start: '10:00:00',
  scheduled_break_end: '11:00:00',
  scheduled_break_minutes: 60,
  grace_period_minutes: 0,
};

function minuteText(value: number): string {
  return `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, '0')}m`;
}

function formatWorkDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function amountInput(value: string): number | null {
  if (!/^\d+(\.\d{0,2})?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [
      value.message,
      value.details,
      value.hint,
      value.code ? `Code: ${value.code}` : null,
    ].filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length > 0) return parts.join('\n');
  }
  return String(error);
}

function durationBetweenTimes(start: string | null, end: string | null): number {
  if (!start || !end || !isValidTime(start.slice(0, 5)) || !isValidTime(end.slice(0, 5))) return 0;
  const [startHour, startMinute] = start.slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = end.slice(0, 5).split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  if (endMinutes === startMinutes) return 0;
  return endMinutes > startMinutes ? endMinutes - startMinutes : endMinutes + 1440 - startMinutes;
}

export default function DtrScreen() {
  const [periodStart, setPeriodStart] = useState(() => dtrPeriodForDate(todayLocal()).start);
  const [entries, setEntries] = useState<DtrEntry[]>([]);
  const [active, setActive] = useState<DtrEntry | null>(null);
  const [activeConflict, setActiveConflict] = useState(false);
  const [settings, setSettings] = useState<DtrSettings>(EMPTY_SETTINGS);
  const [currency, setCurrency] = useState('PHP');
  const [clock, setClock] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DtrEntry | null>(null);
  const [editing, setEditing] = useState<DtrEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [dailyRateText, setDailyRateText] = useState('');
  const [overtimeRateText, setOvertimeRateText] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [overtimeEndText, setOvertimeEndText] = useState('18:00');
  const [breakStartText, setBreakStartText] = useState('');
  const [breakEndText, setBreakEndText] = useState('');
  const [graceText, setGraceText] = useState('');
  const [dateText, setDateText] = useState('');
  const [clockInText, setClockInText] = useState('');
  const [clockOutText, setClockOutText] = useState('');
  const [breakText, setBreakText] = useState('');
  const [overtimeText, setOvertimeText] = useState('');
  const [noteText, setNoteText] = useState('');
  const period = useMemo(() => dtrPeriodForDate(periodStart), [periodStart]);
  const periodOptions = useMemo(() => {
    const options = [period];
    let previous = period;
    let next = period;
    for (let index = 0; index < 6; index++) {
      previous = shiftDtrPeriod(previous, -1);
      next = shiftDtrPeriod(next, 1);
      options.unshift(previous);
      options.push(next);
    }
    return options;
  }, [period]);

  const load = useCallback(async () => {
    const [settingsResult, entriesResult, activeResult, currencyInfo] = await Promise.all([
      supabase.from('dtr_settings').select('*').maybeSingle(),
      supabase
        .from('dtr_entries')
        .select('*')
        .gte('work_date', period.start)
        .lte('work_date', period.end)
        .order('work_date', { ascending: false }),
      supabase
        .from('dtr_entries')
        .select('*')
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: true })
        .limit(2),
      loadCurrency(),
    ]);
    const error = settingsResult.error || entriesResult.error || activeResult.error;
    if (error) {
      Alert.alert('Could not load DTR', error.message);
      return;
    }

    const record = settingsResult.data;
    setSettings(record ? {
      ...record,
      daily_rate: Number(record.daily_rate),
      overtime_rate: Number(record.overtime_rate),
      overtime_end: record.overtime_end ?? '18:00:00',
      scheduled_break_start: record.scheduled_break_start ?? null,
      scheduled_break_end: record.scheduled_break_end ?? null,
      scheduled_break_minutes: durationBetweenTimes(
        record.scheduled_break_start,
        record.scheduled_break_end,
      ) || Number(record.scheduled_break_minutes),
      grace_period_minutes: Number(record.grace_period_minutes),
    } as DtrSettings : EMPTY_SETTINGS);
    setEntries((entriesResult.data ?? []) as DtrEntry[]);
    setCurrency(currencyInfo.base);
    const activeRows = (activeResult.data ?? []) as DtrEntry[];
    setActiveConflict(activeRows.length > 1);
    setActive(activeRows[0] ?? null);
    if (activeRows.length > 1) {
      Alert.alert(
        'More than one open DTR day',
        'There are multiple clock-ins without clock-outs. Complete or correct them before starting another day.',
      );
    }
  }, [period]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, [active]);

  const completedEntries = useMemo(
    () => entries.filter((entry) => Boolean(entry.clock_out_at)),
    [entries],
  );
  const totalRegularMinutes = completedEntries.reduce(
    (sum, entry) => sum + regularWorkMinutes(entry, settings),
    0,
  );
  const totalOvertimeMinutes = completedEntries.reduce(
    (sum, entry) => sum + creditedOvertimeMinutes(entry, settings),
    0,
  );
  const totalUndertimeMinutes = completedEntries.reduce(
    (sum, entry) => sum + undertimeMinutes(entry, settings),
    0,
  );
  const totalLateMinutes = completedEntries.reduce((sum, entry) => sum + lateMinutes(entry, settings), 0);
  const regularPay = completedEntries.length * settings.daily_rate;
  const overtimePay = (totalOvertimeMinutes / 60) * settings.overtime_rate;
  const periodPay = regularPay + overtimePay;

  function openSettings() {
    setDailyRateText(String(settings.daily_rate));
    setOvertimeRateText(String(settings.overtime_rate));
    setStartText(settings.standard_start?.slice(0, 5) ?? '');
    setEndText(settings.standard_end?.slice(0, 5) ?? '');
    setOvertimeEndText(settings.overtime_end?.slice(0, 5) ?? '18:00');
    setBreakStartText(settings.scheduled_break_start?.slice(0, 5) ?? '');
    setBreakEndText(settings.scheduled_break_end?.slice(0, 5) ?? '');
    setGraceText(String(settings.grace_period_minutes));
    setShowSettings(true);
  }

  function openNewEntry() {
    const current = new Date();
    setEditing(null);
    setDateText(todayLocal());
    setClockInText(`${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`);
    setClockOutText('');
    setBreakText('0');
    setOvertimeText('');
    setNoteText('');
    setShowEntry(true);
  }

  function openEditEntry(entry: DtrEntry) {
    if (!entry.clock_out_at) return;
    setEditing(entry);
    setDateText(entry.work_date);
    setClockInText(localTime(entry.clock_in_at));
    setClockOutText(localTime(entry.clock_out_at));
    setBreakText(String(entry.break_minutes));
    setOvertimeText(
      ((entry.overtime_minutes ?? overtimeMinutes(entry, settings)) / 60).toFixed(2),
    );
    setNoteText(entry.note ?? '');
    setShowEntry(true);
  }

  async function clockIn() {
    if (activeConflict) return;
    const date = todayLocal();
    const { data: existing, error: existingError } = await supabase
      .from('dtr_entries')
      .select('id')
      .eq('work_date', date)
      .maybeSingle();
    if (existingError) {
      Alert.alert('Could not check today’s DTR', existingError.message);
      return;
    }
    if (existing) {
      Alert.alert('DTR already recorded', 'Edit today’s entry if you need to correct it. Multiple shifts per day are not supported yet.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('dtr_entries').insert({
        work_date: date,
        clock_in_at: new Date().toISOString(),
      });
      if (error) throw error;
      await load();
    } catch (error: unknown) {
      Alert.alert('Clock-in failed', errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    if (!active || active.break_started_at) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('dtr_entries')
        .update({ clock_out_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', active.id);
      if (error) throw error;
      await load();
    } catch (error: unknown) {
      Alert.alert('Clock-out failed', errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleBreak() {
    if (!active) return;
    const nowIso = new Date().toISOString();
    const update = active.break_started_at
      ? {
          break_started_at: null,
          break_minutes: active.break_minutes + Math.max(
            0,
            Math.floor((Date.now() - new Date(active.break_started_at).getTime()) / 60000),
          ),
        }
      : { break_started_at: nowIso };
    setBusy(true);
    try {
      const { error } = await supabase
        .from('dtr_entries')
        .update({ ...update, updated_at: nowIso })
        .eq('id', active.id);
      if (error) throw error;
      await load();
    } catch (error: unknown) {
      Alert.alert('Break update failed', errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    const dailyRate = amountInput(dailyRateText);
    const overtimeRate = amountInput(overtimeRateText);
    const grace = Number(graceText);
    if (dailyRate === null || overtimeRate === null) {
      Alert.alert('Check the rates', 'Enter valid amounts of zero or more (up to two decimal places).');
      return;
    }
    if (!Number.isInteger(grace) || grace < 0 || grace > 1440) {
      Alert.alert('Check the schedule values', 'Grace period must be a whole number of minutes between 0 and 1440.');
      return;
    }
    if ((startText && !isValidTime(startText)) || (endText && !isValidTime(endText)) ||
      Boolean(startText) !== Boolean(endText)) {
      Alert.alert('Check the schedule', 'Enter both expected times in 24-hour HH:MM format, or leave both blank.');
      return;
    }
    if ((breakStartText && !isValidTime(breakStartText)) ||
      (breakEndText && !isValidTime(breakEndText)) ||
      Boolean(breakStartText) !== Boolean(breakEndText) ||
      (breakStartText && breakStartText === breakEndText)) {
      Alert.alert('Check the break time', 'Enter both break times in 24-hour HH:MM format, or leave both blank.');
      return;
    }
    const scheduledBreak = durationBetweenTimes(breakStartText, breakEndText);
    if (!isValidTime(overtimeEndText) || (endText && overtimeEndText <= endText)) {
      Alert.alert('Check the overtime cutoff', 'Enter an overtime cutoff later than the expected end time.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from('dtr_settings').upsert({
        daily_rate: dailyRate,
        overtime_rate: overtimeRate,
        standard_start: startText ? `${startText}:00` : null,
        standard_end: endText ? `${endText}:00` : null,
        overtime_end: `${overtimeEndText}:00`,
        scheduled_break_start: breakStartText ? `${breakStartText}:00` : null,
        scheduled_break_end: breakEndText ? `${breakEndText}:00` : null,
        scheduled_break_minutes: scheduledBreak,
        grace_period_minutes: grace,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setShowSettings(false);
      await load();
    } catch (error: unknown) {
      Alert.alert('Could not save DTR settings', errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry() {
    const breakMinutes = Number(breakText);
    if (!isValidDate(dateText) || !isValidTime(clockInText) || !isValidTime(clockOutText)) {
      Alert.alert('Check the entry', 'Enter a valid date and clock-in/clock-out times in 24-hour HH:MM format.');
      return;
    }
    if (clockInText === clockOutText) {
      Alert.alert('Check the times', 'Clock-in and clock-out cannot be the same time.');
      return;
    }
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440) {
      Alert.alert('Check the break', 'Break must be a whole number of minutes between 0 and 1440.');
      return;
    }
    const overtimeHours = overtimeText.trim() ? amountInput(overtimeText) : null;
    if (overtimeText.trim() && overtimeHours === null) {
      Alert.alert('Check overtime', 'Enter overtime as hours, for example 3 or 2.5.');
      return;
    }
    const overtimeMinutesValue = overtimeHours === null ? null : Math.round(overtimeHours * 60);
    const maximumOvertime = maximumOvertimeMinutes(settings);
    if (overtimeMinutesValue !== null && overtimeMinutesValue > (maximumOvertime ?? 1440)) {
      Alert.alert('Overtime exceeds the cutoff', 'Overtime cannot go beyond the configured cutoff time.');
      return;
    }
    const overnight = clockOutText < clockInText ? 1 : 0;
    const clockIn = localTimestamp(dateText, clockInText);
    const clockOut = localTimestamp(dateText, clockOutText, overnight);
    if (!clockIn || !clockOut) {
      Alert.alert('Could not read the times', 'Check the date and time values and try again.');
      return;
    }

    setBusy(true);
    try {
      const values = {
        work_date: dateText,
        clock_in_at: clockIn,
        clock_out_at: clockOut,
        break_started_at: null,
        break_minutes: breakMinutes,
        overtime_minutes: overtimeMinutesValue,
        note: noteText.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const result = editing
        ? await supabase.from('dtr_entries').update(values).eq('id', editing.id)
        : await supabase.from('dtr_entries').insert(values);
      if (result.error) throw result.error;
      setShowEntry(false);
      const newPeriodStart = dtrPeriodForDate(dateText).start;
      if (newPeriodStart !== period.start) setPeriodStart(newPeriodStart);
      else await load();
    } catch (error: unknown) {
      Alert.alert('Could not save DTR entry', errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('dtr_entries').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      await load();
    } catch (error: unknown) {
      Alert.alert('Could not delete DTR entry', errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportPeriod() {
    setBusy(true);
    try {
      const count = await exportDtrCsv(entries, settings, currency, period.start);
      if (count === 0) Alert.alert('DTR export', 'There are no entries in this cutoff period.');
    } catch (error: unknown) {
      Alert.alert('DTR export failed', errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const scheduledMinutes = scheduledWorkMinutes(settings);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>ATTENDANCE & PAY</Text>
            <Text style={s.title}>DTR</Text>
          </View>
          <View style={s.headerActions}>
            <AnimatedPressable onPress={openSettings} style={s.iconButton} accessibilityRole="button" accessibilityLabel="DTR settings">
              <Ionicons name="settings-outline" size={20} color="#5865D9" />
            </AnimatedPressable>
            <AnimatedPressable onPress={() => { void exportPeriod(); }} disabled={busy}
              style={[s.iconButton, busy && s.disabled]} accessibilityRole="button" accessibilityLabel="Export cutoff-period DTR">
              <Ionicons name="download-outline" size={20} color="#5865D9" />
            </AnimatedPressable>
          </View>
        </View>

        <View style={s.monthRow}>
          <AnimatedPressable onPress={() => setPeriodStart(shiftDtrPeriod(period, -1).start)} style={s.monthButton}
            accessibilityRole="button" accessibilityLabel="Previous cutoff period">
            <Ionicons name="chevron-back" size={19} color="#5865D9" />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setShowPeriodPicker(true)} style={s.periodLabel}
            accessibilityRole="button" accessibilityLabel={`Choose cutoff period, ${formatDtrPeriod(period)}`}>
            <Text style={s.periodLabelText}>{formatDtrPeriod(period)}</Text>
            <Ionicons name="chevron-down" size={14} color="#5865D9" />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setPeriodStart(shiftDtrPeriod(period, 1).start)} style={s.monthButton}
            accessibilityRole="button" accessibilityLabel="Next cutoff period">
            <Ionicons name="chevron-forward" size={19} color="#5865D9" />
          </AnimatedPressable>
        </View>

        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>ESTIMATED PAY · CUTOFF PERIOD</Text>
          <Text style={s.summaryPay}>{formatMoney(periodPay, currency)}</Text>
          <View style={s.summaryDivider} />
          <View style={s.summaryStats}>
            <View style={s.stat}>
              <Text style={s.statLabel}>DAYS</Text>
              <Text style={s.statValue}>{completedEntries.length}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>REGULAR HOURS</Text>
              <Text style={s.statValue}>{minuteText(totalRegularMinutes)}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>OVERTIME</Text>
              <Text style={s.statValue}>{minuteText(totalOvertimeMinutes)}</Text>
            </View>
          </View>
          <Text style={s.payDetail}>
            Daily {formatMoney(regularPay, currency)} · OT {formatMoney(overtimePay, currency)}
          </Text>
          <Text style={s.estimateHint}>
            Estimate: one daily rate per completed day plus overtime at the entered hourly rate. No late or undertime deductions yet.
          </Text>
          <Text style={s.scheduleHint}>Late {minuteText(totalLateMinutes)} · Undertime {minuteText(totalUndertimeMinutes)}</Text>
          {scheduledMinutes === null && (
            <Text style={s.scheduleHint}>Set expected start and end times to calculate overtime.</Text>
          )}
        </View>

        <View style={s.clockCard}>
          <View style={s.clockHeading}>
            <View>
              <Text style={s.clockTitle}>{active ? (active.break_started_at ? 'On break' : 'Clocked in') : 'Ready to start?'}</Text>
              <Text style={s.clockSubtitle}>
                {active
                  ? `${formatWorkDate(active.work_date)} · ${localTime(active.clock_in_at)} start`
                  : 'Clock in when your workday begins'}
              </Text>
            </View>
            <View style={[s.statusDot, active && s.statusDotActive]} />
          </View>
          {active && (
            <Text style={s.elapsed}>
              {minuteText(regularWorkMinutes(active, settings, clock))} regular · {minuteText(creditedOvertimeMinutes(active, settings, clock))} OT
            </Text>
          )}
          {active ? (
            <View style={s.clockActions}>
              <ActionButton
                title={active.break_started_at ? 'End break' : 'Start break'}
                icon={active.break_started_at ? 'play-outline' : 'cafe-outline'}
                onPress={() => { void toggleBreak(); }}
                disabled={busy}
                secondary
              />
              <ActionButton
                title="Clock out"
                icon="stop-circle-outline"
                onPress={() => { void clockOut(); }}
                disabled={busy || Boolean(active.break_started_at)}
              />
            </View>
          ) : (
            <ActionButton
              title={busy ? 'Please wait...' : 'Clock in'}
              icon="play-circle-outline"
              onPress={() => { void clockIn(); }}
              disabled={busy || activeConflict}
            />
          )}
        </View>

        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionTitle}>Daily records</Text>
            <Text style={s.sectionSubtitle}>Correct or delete a daily record.</Text>
          </View>
          <AnimatedPressable onPress={openNewEntry} style={s.addButton} accessibilityRole="button" accessibilityLabel="Add DTR entry">
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </AnimatedPressable>
        </View>

        {entries.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="time-outline" size={28} color="#A0A6B6" />
            <Text style={s.emptyTitle}>No DTR entries this month</Text>
            <Text style={s.emptySubtitle}>Clock in or add a completed day manually.</Text>
          </View>
        ) : entries.map((entry) => {
          const worked = regularWorkMinutes(entry, settings, clock);
          const overtime = creditedOvertimeMinutes(entry, settings, clock);
          const undertime = undertimeMinutes(entry, settings, clock);
          const isComplete = Boolean(entry.clock_out_at);
          const pay = isComplete
            ? settings.daily_rate + (overtime / 60) * settings.overtime_rate
            : 0;
          return (
            <View key={entry.id} style={[s.entryCard, !isComplete && s.openEntry]}>
              <View style={s.entryTop}>
                <View style={s.entryDateBlock}>
                  <Text style={s.entryDate}>{formatWorkDate(entry.work_date)}</Text>
                  <Text style={s.entryTimes}>
                    {localTime(entry.clock_in_at)} – {localTime(entry.clock_out_at) || 'In progress'}
                  </Text>
                </View>
                <View style={s.entryActions}>
                  <Text style={s.entryPay}>{isComplete ? formatMoney(pay, currency) : 'Open'}</Text>
                  {isComplete && (
                    <AnimatedPressable onPress={() => openEditEntry(entry)} style={s.rowAction}
                      accessibilityRole="button" accessibilityLabel={`Edit DTR entry for ${entry.work_date}`}>
                      <Ionicons name="pencil-outline" size={17} color="#5865D9" />
                    </AnimatedPressable>
                  )}
                  <AnimatedPressable onPress={() => setDeleteTarget(entry)} style={s.rowAction}
                    accessibilityRole="button" accessibilityLabel={`Delete DTR entry for ${entry.work_date}`}>
                    <Ionicons name="trash-outline" size={17} color="#D45B55" />
                  </AnimatedPressable>
                </View>
              </View>
              <View style={s.entryBottom}>
                <Text style={s.entryMeta}>{minuteText(worked)} regular</Text>
                <Text style={s.entryMeta}>{overtime ? `OT ${minuteText(overtime)}` : entry.break_minutes ? `${entry.break_minutes}m break` : 'No overtime'}</Text>
                {isComplete && undertime > 0 && <Text style={s.lateBadge}>Undertime {minuteText(undertime)}</Text>}
                {isComplete && lateMinutes(entry, settings) > 0 && (
                  <Text style={s.lateBadge}>Late {lateMinutes(entry, settings)}m</Text>
                )}
              </View>
              {entry.note ? <Text style={s.entryNote} numberOfLines={2}>{entry.note}</Text> : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showPeriodPicker} animationType="slide" transparent onRequestClose={() => setShowPeriodPicker(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.periodPickerCard}>
            <ModalHeading title="Choose cutoff period" onClose={() => setShowPeriodPicker(false)} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {periodOptions.map((option) => {
                const selected = option.start === period.start;
                return (
                  <AnimatedPressable
                    key={option.start}
                    onPress={() => {
                      setPeriodStart(option.start);
                      setShowPeriodPicker(false);
                    }}
                    style={[s.periodOption, selected && s.selectedPeriodOption]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[s.periodOptionText, selected && s.selectedPeriodText]}>
                      {formatDtrPeriod(option)}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#5865D9" />}
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={s.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalDock}>
            <ScrollView style={s.modalCard} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <ModalHeading title="DTR settings" onClose={() => setShowSettings(false)} />
              <Text style={s.fieldLabel}>Daily rate ({currency} per completed day)</Text>
              <TextInput value={dailyRateText} onChangeText={setDailyRateText} keyboardType="decimal-pad" style={s.input} placeholder="0.00" />
              <Text style={s.fieldLabel}>Overtime rate ({currency} per hour)</Text>
              <TextInput value={overtimeRateText} onChangeText={setOvertimeRateText} keyboardType="decimal-pad" style={s.input} placeholder="0.00" />
              <Text style={s.formSection}>Work schedule (optional)</Text>
              <Text style={s.formHint}>Early clock-in is not counted. Your scheduled unpaid break is deducted automatically. Overtime starts at the expected end and stops at the cutoff.</Text>
              <View style={s.inputPair}>
                <View style={s.inputHalf}>
                  <Text style={s.fieldLabel}>Expected start</Text>
                  <TextInput value={startText} onChangeText={setStartText} style={s.input} placeholder="09:00" maxLength={5} />
                </View>
                <View style={s.inputHalf}>
                  <Text style={s.fieldLabel}>Expected end</Text>
                  <TextInput value={endText} onChangeText={setEndText} style={s.input} placeholder="17:00" maxLength={5} />
                </View>
              </View>
              <Text style={s.fieldLabel}>Overtime cutoff</Text>
              <TextInput value={overtimeEndText} onChangeText={setOvertimeEndText} style={s.input} placeholder="18:00" maxLength={5} />
              <View style={s.inputPair}>
                <View style={s.inputHalf}>
                  <Text style={s.fieldLabel}>Unpaid break starts</Text>
                  <TextInput value={breakStartText} onChangeText={setBreakStartText} style={s.input} placeholder="10:00" maxLength={5} />
                </View>
                <View style={s.inputHalf}>
                  <Text style={s.fieldLabel}>Unpaid break ends</Text>
                  <TextInput value={breakEndText} onChangeText={setBreakEndText} style={s.input} placeholder="11:00" maxLength={5} />
                </View>
              </View>
              <View style={s.inputPair}>
                <View style={s.inputHalf}>
                  <Text style={s.fieldLabel}>Late grace (min)</Text>
                  <TextInput value={graceText} onChangeText={setGraceText} keyboardType="number-pad" style={s.input} />
                </View>
              </View>
              <ActionButton title={busy ? 'Saving...' : 'Save settings'} icon="checkmark" onPress={() => { void saveSettings(); }} disabled={busy} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showEntry} animationType="slide" transparent onRequestClose={() => setShowEntry(false)}>
        <View style={s.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalDock}>
            <ScrollView style={s.modalCard} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <ModalHeading title={editing ? 'Correct DTR entry' : 'Add DTR entry'} onClose={() => setShowEntry(false)} />
              <Text style={s.fieldLabel}>Work date (YYYY-MM-DD)</Text>
              <TextInput value={dateText} onChangeText={setDateText} style={s.input} placeholder={todayLocal()} />
              <View style={s.inputPair}>
                <View style={s.inputHalf}>
                  <Text style={s.fieldLabel}>Clock in (24-hour)</Text>
                  <TextInput value={clockInText} onChangeText={setClockInText} style={s.input} placeholder="09:00" maxLength={5} />
                </View>
                <View style={s.inputHalf}>
                  <Text style={s.fieldLabel}>Clock out (24-hour)</Text>
                  <TextInput value={clockOutText} onChangeText={setClockOutText} style={s.input} placeholder="17:00" maxLength={5} />
                </View>
              </View>
              <Text style={s.fieldLabel}>Break (minutes)</Text>
              <TextInput value={breakText} onChangeText={setBreakText} keyboardType="number-pad" style={s.input} placeholder="0" />
              <Text style={s.fieldLabel}>Overtime hours (optional)</Text>
              <TextInput value={overtimeText} onChangeText={setOvertimeText} keyboardType="decimal-pad" style={s.input} placeholder="Auto-calculated" />
              <Text style={s.formHint}>Leave blank to calculate from your schedule, or enter hours such as 3.</Text>
              <Text style={s.fieldLabel}>Note (optional)</Text>
              <TextInput value={noteText} onChangeText={setNoteText} style={[s.input, s.noteInput]} multiline placeholder="Add a note" />
              <ActionButton title={busy ? 'Saving...' : 'Save entry'} icon="checkmark" onPress={() => { void saveEntry(); }} disabled={busy} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <DeleteConfirmModal
        visible={deleteTarget !== null}
        title="Delete DTR entry?"
        detail={deleteTarget ? formatWorkDate(deleteTarget.work_date) : ''}
        description="This removes the clock times and pay calculations for this day. This action cannot be undone."
        busy={busy}
        onCancel={() => { if (!busy) setDeleteTarget(null); }}
        onConfirm={() => { void deleteEntry(); }}
      />
    </SafeAreaView>
  );
}

function ActionButton({
  title,
  icon,
  onPress,
  disabled,
  secondary,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={[s.actionButton, secondary && s.secondaryAction, disabled && s.disabled]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={19} color={secondary ? '#5865D9' : '#FFFFFF'} />
      <Text style={[s.actionText, secondary && s.secondaryActionText]}>{title}</Text>
    </AnimatedPressable>
  );
}

function ModalHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={s.modalHeading}>
      <Text style={s.modalTitle}>{title}</Text>
      <AnimatedPressable onPress={onClose} style={s.closeButton} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={22} color="#687087" />
      </AnimatedPressable>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { backgroundColor: '#F6F7FB', flex: 1 },
  content: { paddingBottom: 30, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, paddingTop: 16 },
  kicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 9 },
  iconButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 13, height: 42, justifyContent: 'center', width: 42 },
  disabled: { opacity: 0.55 },
  monthRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  monthButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 12, borderWidth: 1, height: 38, justifyContent: 'center', width: 42 },
  periodLabel: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', maxWidth: '70%', minHeight: 40, paddingHorizontal: 8 },
  periodLabelText: { color: '#29304A', fontSize: 14, fontWeight: '800' },
  summaryCard: { backgroundColor: '#29304A', borderRadius: 21, marginBottom: 14, padding: 18 },
  summaryLabel: { color: '#AEB6D4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summaryPay: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', marginTop: 7 },
  summaryDivider: { backgroundColor: '#444B64', height: 1, marginVertical: 15 },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1 },
  statLabel: { color: '#AEB6D4', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 5 },
  payDetail: { color: '#C4CAE0', fontSize: 11, marginTop: 14 },
  estimateHint: { color: '#AEB6D4', fontSize: 10, lineHeight: 14, marginTop: 7 },
  scheduleHint: { color: '#F2D8A5', fontSize: 11, marginTop: 9 },
  clockCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 19, borderWidth: 1, marginBottom: 22, padding: 16 },
  clockHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  clockTitle: { color: '#29304A', fontSize: 17, fontWeight: '800' },
  clockSubtitle: { color: '#8A91A4', fontSize: 11, marginTop: 4 },
  statusDot: { backgroundColor: '#D5D8E2', borderRadius: 6, height: 11, width: 11 },
  statusDotActive: { backgroundColor: '#16845A' },
  elapsed: { color: '#5865D9', fontSize: 23, fontWeight: '800', marginTop: 15 },
  clockActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  actionButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 13, flexDirection: 'row', justifyContent: 'center', marginTop: 15, minHeight: 48, paddingHorizontal: 15 },
  secondaryAction: { backgroundColor: '#EEF0FF', flex: 1 },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  secondaryActionText: { color: '#5865D9' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#29304A', fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { color: '#8A91A4', fontSize: 11, marginTop: 3 },
  addButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 13, height: 42, justifyContent: 'center', width: 42 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 18, borderWidth: 1, padding: 25 },
  emptyTitle: { color: '#29304A', fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptySubtitle: { color: '#8A91A4', fontSize: 11, marginTop: 5, textAlign: 'center' },
  entryCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 16, borderWidth: 1, marginBottom: 9, padding: 14 },
  openEntry: { borderColor: '#BEC4F6' },
  entryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  entryDateBlock: { flex: 1 },
  entryDate: { color: '#29304A', fontSize: 14, fontWeight: '800' },
  entryTimes: { color: '#8A91A4', fontSize: 11, marginTop: 4 },
  entryPay: { color: '#16845A', fontSize: 13, fontWeight: '800' },
  entryActions: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  rowAction: { alignItems: 'center', backgroundColor: '#F3F4F9', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  entryBottom: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  entryMeta: { color: '#687087', fontSize: 10, fontWeight: '700' },
  lateBadge: { color: '#D45B55', fontSize: 10, fontWeight: '800' },
  entryNote: { color: '#8A91A4', fontSize: 11, marginTop: 8 },
  modalBackdrop: { backgroundColor: 'rgba(24, 29, 47, 0.42)', flex: 1, justifyContent: 'flex-end' },
  modalDock: { maxHeight: '92%' },
  modalCard: { backgroundColor: '#F6F7FB', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalContent: { padding: 20, paddingBottom: 34 },
  periodPickerCard: { backgroundColor: '#F6F7FB', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '78%', padding: 20, paddingBottom: 30 },
  periodOption: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 13, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, minHeight: 48, paddingHorizontal: 13 },
  selectedPeriodOption: { backgroundColor: '#EEF0FF', borderColor: '#C9CEFB' },
  periodOptionText: { color: '#29304A', fontSize: 13, fontWeight: '700' },
  selectedPeriodText: { color: '#5865D9' },
  modalHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { color: '#29304A', fontSize: 20, fontWeight: '800' },
  closeButton: { alignItems: 'center', backgroundColor: '#E9EBF3', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  fieldLabel: { color: '#596177', fontSize: 11, fontWeight: '800', marginBottom: 6, marginTop: 11 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E1E4EC', borderRadius: 12, borderWidth: 1, color: '#29304A', fontSize: 14, minHeight: 46, paddingHorizontal: 12 },
  noteInput: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  formSection: { color: '#29304A', fontSize: 15, fontWeight: '800', marginTop: 22 },
  formHint: { color: '#8A91A4', fontSize: 11, lineHeight: 16, marginTop: 5 },
  inputPair: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },
});
