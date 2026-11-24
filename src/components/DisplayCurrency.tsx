import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CURRENCIES, getCurrencySymbol, loadCurrency } from '../lib/currency';
import AnimatedPressable from './AnimatedPressable';

const STORAGE_KEY = 'budget-tracker.display-currency';

type DisplayCurrencyContextValue = {
  currency: string;
  setCurrency: (currency: string) => Promise<void>;
};

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(null);

export function DisplayCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState('PHP');

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), loadCurrency()])
      .then(([savedCurrency, info]) => {
        if (active) setCurrencyState(savedCurrency ?? info.base);
      })
      .catch((error: unknown) => {
        Alert.alert('Could not load display currency', error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, []);

  const setCurrency = useCallback(async (nextCurrency: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextCurrency);
      setCurrencyState(nextCurrency);
    } catch (error: unknown) {
      Alert.alert('Could not save display currency', error instanceof Error ? error.message : String(error));
    }
  }, []);

  return (
    <DisplayCurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const context = useContext(DisplayCurrencyContext);
  if (!context) throw new Error('useDisplayCurrency must be used within DisplayCurrencyProvider.');
  return context;
}

export function CurrencySelector() {
  const { currency, setCurrency } = useDisplayCurrency();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <AnimatedPressable onPress={() => setVisible(true)} style={s.selector} accessibilityRole="button"
        accessibilityLabel={`Display currency ${currency}. Tap to change.`}>
        <Ionicons name="cash-outline" size={16} color="#5865D9" />
        <Text style={s.selectorText}>{getCurrencySymbol(currency)} {currency}</Text>
        <Ionicons name="chevron-down" size={14} color="#5865D9" />
      </AnimatedPressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setVisible(false)}>
          <Pressable style={s.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={s.heading}>
              <View>
                <Text style={s.title}>Display currency</Text>
                <Text style={s.subtitle}>Amounts across the app will use this currency.</Text>
              </View>
              <AnimatedPressable onPress={() => setVisible(false)} style={s.closeButton}
                accessibilityRole="button" accessibilityLabel="Close currency picker">
                <Ionicons name="close" size={20} color="#697187" />
              </AnimatedPressable>
            </View>
            <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
              {CURRENCIES.map((code) => {
                const active = currency === code;
                return (
                  <Pressable key={code} onPress={() => { void setCurrency(code); setVisible(false); }}
                    style={[s.option, active && s.optionActive]} accessibilityRole="button"
                    accessibilityLabel={`Display amounts in ${code}`}>
                    <Text style={[s.symbol, active && s.activeText]}>{getCurrencySymbol(code)}</Text>
                    <Text style={[s.code, active && s.activeText]}>{code}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={17} color="#5865D9" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  selector: { alignItems: 'center', backgroundColor: '#EEF0FF', borderColor: '#DDE1FF', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 38, paddingHorizontal: 10 },
  selectorText: { color: '#5865D9', fontSize: 12, fontWeight: '800' },
  overlay: { backgroundColor: 'rgba(24, 29, 49, 0.48)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '75%', padding: 20 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#20263B', fontSize: 19, fontWeight: '800' },
  subtitle: { color: '#7C8496', fontSize: 12, marginTop: 4 },
  closeButton: { alignItems: 'center', backgroundColor: '#F1F2F7', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  grid: { gap: 8, paddingBottom: 12 },
  option: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#E8EAF1', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 48, paddingHorizontal: 13 },
  optionActive: { backgroundColor: '#EEF0FF', borderColor: '#A8AFF1' },
  symbol: { color: '#29304A', fontSize: 15, fontWeight: '800', minWidth: 28 },
  code: { color: '#697187', flex: 1, fontSize: 13, fontWeight: '700' },
  activeText: { color: '#5865D9' },
});
