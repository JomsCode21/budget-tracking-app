import React, { useCallback, useState } from 'react';
import { View, Text, Button, Alert, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { CURRENCIES, loadCurrency } from '../lib/currency';
import Chip from '../components/Chip';

export default function CurrencyScreen() {
  const [base, setBase] = useState('PHP');
  const [rateText, setRateText] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [info, acc] = await Promise.all([
      loadCurrency(),
      supabase.from('accounts').select('currency').is('deleted_at', null),
    ]);
    if (acc.error) return Alert.alert('Load failed', acc.error.message);
    setBase(info.base);
    const text: Record<string, string> = {};
    for (const [c, r] of Object.entries(info.rates)) text[c] = String(r);
    setRateText(text);
    setUsed(Array.from(new Set((acc.data ?? []).map((a: { currency: string }) => a.currency))));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const others = Array.from(new Set([...used, ...Object.keys(rateText)])).filter((c) => c !== base);
  const missing = used.filter((c) => c !== base && !(Number(rateText[c]) > 0));

  function changeBase(c: string) {
    if (c === base) return;
    setBase(c);
    setRateText({}); // old rates were relative to the previous base
  }

  async function save() {
    const now = new Date().toISOString();
    const s = await supabase
      .from('user_settings')
      .upsert({ base_currency: base, updated_at: now }, { onConflict: 'user_id' });
    if (s.error) return Alert.alert('Save failed', s.error.message);

    const rows = others
      .filter((c) => Number(rateText[c]) > 0)
      .map((c) => ({ currency: c, rate: Number(rateText[c]), updated_at: now }));
    if (rows.length > 0) {
      const r = await supabase.from('exchange_rates').upsert(rows, { onConflict: 'user_id,currency' });
      if (r.error) return Alert.alert('Save failed', r.error.message);
    }
    Alert.alert('Saved');
    load();
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Base currency</Text>
        <Text style={s.sub}>Totals, budgets and reports are shown in this currency.</Text>
        <View style={s.wrap}>
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} active={base === c} onPress={() => changeBase(c)} />
          ))}
        </View>

        <Text style={s.label}>Exchange rates</Text>
        <Text style={s.sub}>Enter how much 1 unit is worth in {base}. Update these whenever you like.</Text>

        {others.length === 0 ? (
          <Text style={[s.sub, { marginTop: 12 }]}>
            You only use {base} so far. Add an account in another currency to set a rate.
          </Text>
        ) : (
          others.map((c) => (
            <View key={c} style={s.rateRow}>
              <Text style={s.rateLabel}>1 {c} =</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                placeholder="rate"
                value={rateText[c] ?? ''}
                onChangeText={(t) => setRateText({ ...rateText, [c]: t })}
              />
              <Text style={s.rateLabel}>{base}</Text>
            </View>
          ))
        )}

        {missing.length > 0 && (
          <Text style={s.warn}>
            No rate set for {missing.join(', ')}. Until you add one, those amounts are counted 1:1.
          </Text>
        )}

        <View style={{ height: 16 }} />
        <Button title="Save" onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  label: { fontWeight: '600', fontSize: 16, marginTop: 8, marginBottom: 4 },
  sub: { color: '#666', fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  rateLabel: { width: 70 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  warn: { color: '#c0392b', marginTop: 12 },
});