import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { CURRENCIES, fetchLatestRates, loadCurrency } from '../lib/currency';
import AnimatedPressable from '../components/AnimatedPressable';
import { CurrencySelector } from '../components/DisplayCurrency';

const RATE_REFRESH_INTERVAL = 30 * 60 * 1000;

export default function CurrencyScreen() {
  const [base, setBase] = useState('PHP');
  const [savedBase, setSavedBase] = useState('PHP');
  const [rateText, setRateText] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<string[]>([]);
  const [ratesDate, setRatesDate] = useState<string | null>(null);
  const [rateError, setRateError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const refreshId = useRef(0);

  const refreshRates = useCallback(async (selectedBase: string, persist: boolean) => {
    const requestId = ++refreshId.current;
    setRefreshing(true);
    setRateError('');

    try {
      const quotes = CURRENCIES.filter((currency) => currency !== selectedBase);
      const result = await fetchLatestRates(selectedBase, quotes);
      if (requestId !== refreshId.current) return false;

      const now = new Date().toISOString();
      const text: Record<string, string> = {};
      for (const [currency, rate] of Object.entries(result.rates)) {
        text[currency] = String(rate);
      }

      if (persist) {
        const rows = Object.entries(result.rates).map(([currency, rate]) => ({
          currency,
          rate,
          updated_at: now,
        }));
        const { error } = await supabase
          .from('exchange_rates')
          .upsert(rows, { onConflict: 'user_id,currency' });
        if (error) throw error;
      }

      setRateText(text);
      setRatesDate(result.date);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (requestId === refreshId.current) setRateError(message);
      return false;
    } finally {
      if (requestId === refreshId.current) setRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    const [info, acc] = await Promise.all([
      loadCurrency(),
      supabase.from('accounts').select('currency').is('deleted_at', null),
    ]);
    if (acc.error) {
      Alert.alert('Load failed', acc.error.message);
      return;
    }

    const currencies = Array.from(new Set((acc.data ?? []).map((a: { currency: string }) => a.currency)));
    setBase(info.base);
    setSavedBase(info.base);
    setUsed(currencies);
    const savedRates: Record<string, string> = {};
    for (const [currency, rate] of Object.entries(info.rates)) savedRates[currency] = String(rate);
    setRateText(savedRates);

    await refreshRates(info.base, true);
  }, [refreshRates]);

  useFocusEffect(useCallback(() => {
    load().catch((error: unknown) => {
      Alert.alert('Could not load currency settings', error instanceof Error ? error.message : String(error));
    });
  }, [load]));

  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => {
      void refreshRates(base, base === savedBase);
    }, RATE_REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [base, savedBase, refreshRates]));

  const others = Array.from(new Set([...used, ...Object.keys(rateText)])).filter((currency) => currency !== base);
  const missing = used.filter((currency) => currency !== base && !(Number(rateText[currency]) > 0));

  function changeBase(currency: string) {
    if (currency === base) return;
    setBase(currency);
    setRateText({});
    setRatesDate(null);
    void refreshRates(currency, false);
  }

  async function save() {
    if (missing.length > 0) {
      Alert.alert('Missing exchange rates', `Add or refresh rates for ${missing.join(', ')} before saving.`);
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const settings = await supabase
        .from('user_settings')
        .upsert({ base_currency: base, updated_at: now }, { onConflict: 'user_id' });
      if (settings.error) throw settings.error;

      const rows = others
        .filter((currency) => Number(rateText[currency]) > 0)
        .map((currency) => ({
          currency,
          rate: Number(rateText[currency]),
          updated_at: now,
        }));
      if (rows.length > 0) {
        const result = await supabase.from('exchange_rates').upsert(rows, { onConflict: 'user_id,currency' });
        if (result.error) throw result.error;
      }

      setSavedBase(base);
      Alert.alert('Saved', 'Your base currency and exchange rates are up to date.');
    } catch (error: unknown) {
      Alert.alert('Save failed', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.kicker}>PERSONALIZE YOUR TOTALS</Text>
              <Text style={s.title}>Currency</Text>
            </View>
            <CurrencySelector />
          </View>
          <Text style={s.subtitle}>Choose your base currency for conversions. Use the currency button to change how amounts are displayed across the app.</Text>
        </View>

        <View style={s.baseCard}>
          <View style={s.sectionHeading}>
            <View style={s.sectionIcon}>
              <Ionicons name="cash-outline" size={20} color="#5865D9" />
            </View>
            <View style={s.sectionTitleBlock}>
              <Text style={s.sectionTitle}>Base currency</Text>
              <Text style={s.sectionSubtitle}>Reference currency for conversions</Text>
            </View>
          </View>
          <View style={s.currencyGrid}>
            {CURRENCIES.map((currency) => {
              const active = currency === base;
              return (
                <AnimatedPressable key={currency} onPress={() => changeBase(currency)}
                  style={[s.currencyOption, active && s.currencyOptionActive]}
                  accessibilityRole="button" accessibilityLabel={`Set base currency to ${currency}`}>
                  <Text style={[s.currencyCode, active && s.currencyCodeActive]}>{currency}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={16} color="#5865D9" /> : null}
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <View style={s.ratesCard}>
          <View style={s.ratesHeader}>
            <View style={s.sectionHeading}>
              <View style={[s.sectionIcon, s.ratesIcon]}>
                <Ionicons name="sync-outline" size={19} color="#16845A" />
              </View>
              <View style={s.sectionTitleBlock}>
                <Text style={s.sectionTitle}>Exchange rates</Text>
                <Text style={s.sectionSubtitle}>1 foreign unit converted to {base}</Text>
              </View>
            </View>
            <AnimatedPressable onPress={() => void refreshRates(base, base === savedBase)}
              style={s.refreshButton} accessibilityRole="button" accessibilityLabel="Refresh exchange rates">
              {refreshing
                ? <ActivityIndicator size="small" color="#5865D9" />
                : <Ionicons name="refresh" size={19} color="#5865D9" />}
            </AnimatedPressable>
          </View>

          <View style={s.rateStatus}>
            <View style={[s.statusDot, rateError ? s.errorDot : null]} />
            <Text style={[s.statusText, rateError ? s.errorText : null]}>
              {rateError
                ? `Refresh failed: ${rateError}`
                : refreshing
                  ? 'Updating reference rates...'
                  : ratesDate
                    ? `Latest reference data · ${ratesDate}`
                    : 'Rates not yet updated'}
            </Text>
          </View>
          <Text style={s.rateDisclaimer}>
            Rates refresh when this screen opens and every 30 minutes while open. Reference rates update through the day; they are not live trading quotes.
          </Text>

          {others.length === 0 ? (
            <View style={s.emptyRates}>
              <Ionicons name="globe-outline" size={24} color="#8A91A4" />
              <Text style={s.emptyTitle}>No other currencies in use</Text>
              <Text style={s.emptyText}>Add an account in another currency to use its exchange rate.</Text>
            </View>
          ) : (
            <View style={s.ratesList}>
              {others.map((currency, index) => (
                <View key={currency} style={[s.rateRow, index === others.length - 1 && s.lastRateRow]}>
                  <View style={s.ratePair}>
                    <Text style={s.rateFrom}>{currency}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#A0A6B6" />
                    <Text style={s.rateTo}>{base}</Text>
                  </View>
                  <TextInput
                    style={s.rateInput}
                    keyboardType="decimal-pad"
                    placeholder="Rate"
                    placeholderTextColor="#AEB6C5"
                    value={rateText[currency] ?? ''}
                    onChangeText={(value) => setRateText((current) => ({ ...current, [currency]: value }))}
                    accessibilityLabel={`Rate from ${currency} to ${base}`}
                  />
                </View>
              ))}
            </View>
          )}

          {missing.length > 0 ? (
            <View style={s.warning}>
              <Ionicons name="alert-circle-outline" size={19} color="#D68A25" />
              <Text style={s.warningText}>
                Missing rates for {missing.join(', ')}. Amounts in those currencies may be counted 1:1.
              </Text>
            </View>
          ) : null}
        </View>

        <AnimatedPressable onPress={save} disabled={saving || refreshing}
          style={[s.saveButton, (saving || refreshing) && s.disabledButton]} accessibilityRole="button">
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
          <Text style={s.saveButtonText}>{saving ? 'Saving...' : 'Save currency settings'}</Text>
        </AnimatedPressable>
        <Text style={s.footer}>Exchange rates by Frankfurter · frankfurter.dev</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { backgroundColor: '#F6F7FB', flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  header: { paddingBottom: 17, paddingTop: 18 },
  headerTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#7C8496', fontSize: 13, lineHeight: 19, marginTop: 7 },
  baseCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 19, borderWidth: 1, padding: 15 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row' },
  sectionIcon: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  ratesIcon: { backgroundColor: '#DDF5EA' },
  sectionTitleBlock: { flex: 1, marginLeft: 11 },
  sectionTitle: { color: '#29304A', fontSize: 15, fontWeight: '800' },
  sectionSubtitle: { color: '#8A91A4', fontSize: 11, marginTop: 3 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  currencyOption: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#E5E8F0', borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 40, minWidth: '22%', paddingHorizontal: 10 },
  currencyOptionActive: { backgroundColor: '#EEF0FF', borderColor: '#8F98EA' },
  currencyCode: { color: '#697187', fontSize: 12, fontWeight: '700' },
  currencyCodeActive: { color: '#5865D9', fontWeight: '800' },
  ratesCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 19, borderWidth: 1, marginTop: 14, padding: 15 },
  ratesHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  refreshButton: { alignItems: 'center', backgroundColor: '#EEF0FF', borderRadius: 11, height: 40, justifyContent: 'center', marginLeft: 8, width: 40 },
  rateStatus: { alignItems: 'center', flexDirection: 'row', marginTop: 14 },
  statusDot: { backgroundColor: '#16845A', borderRadius: 4, height: 8, marginRight: 7, width: 8 },
  errorDot: { backgroundColor: '#D45B55' },
  statusText: { color: '#16845A', flex: 1, fontSize: 11, fontWeight: '700' },
  errorText: { color: '#D45B55' },
  rateDisclaimer: { color: '#8A91A4', fontSize: 10, lineHeight: 15, marginTop: 6 },
  ratesList: { marginTop: 10 },
  rateRow: { alignItems: 'center', borderBottomColor: '#ECEEF4', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56 },
  lastRateRow: { borderBottomWidth: 0 },
  ratePair: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  rateFrom: { color: '#29304A', fontSize: 14, fontWeight: '800', minWidth: 36 },
  rateTo: { color: '#7C8496', fontSize: 13, fontWeight: '700' },
  rateInput: { backgroundColor: '#F8F9FC', borderColor: '#E4E7EF', borderRadius: 10, borderWidth: 1, color: '#29304A', fontSize: 14, fontWeight: '700', minWidth: 120, paddingHorizontal: 11, paddingVertical: 9, textAlign: 'right' },
  emptyRates: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 25 },
  emptyTitle: { color: '#29304A', fontSize: 14, fontWeight: '800', marginTop: 9 },
  emptyText: { color: '#8A91A4', fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: 'center' },
  warning: { alignItems: 'flex-start', backgroundColor: '#FFF5E5', borderRadius: 12, flexDirection: 'row', gap: 8, marginTop: 12, padding: 11 },
  warningText: { color: '#8D601F', flex: 1, fontSize: 11, lineHeight: 17 },
  saveButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16, minHeight: 52 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  footer: { color: '#A0A6B6', fontSize: 10, marginTop: 14, textAlign: 'center' },
});
