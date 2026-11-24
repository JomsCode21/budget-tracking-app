import { supabase } from './supabase';

export type CurrencyInfo = { base: string; rates: Record<string, number> };

export const CURRENCIES = [
  'PHP', 'USD', 'EUR', 'JPY', 'SGD', 'GBP', 'AUD', 'CAD',
  'KRW', 'CNY', 'HKD', 'AED', 'SAR',
];

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

export async function loadCurrency(): Promise<CurrencyInfo> {
  const [s, r] = await Promise.all([
    supabase.from('user_settings').select('base_currency').maybeSingle(),
    supabase.from('exchange_rates').select('currency, rate'),
  ]);
  const base: string = s.data?.base_currency ?? 'PHP';
  const rates: Record<string, number> = {};
  for (const row of r.data ?? []) rates[row.currency] = Number(row.rate);
  return { base, rates };
}

// rates[X] = how much 1 unit of X is worth in the base currency.
// A currency with no rate set is treated as 1:1 (the Currency screen warns about this).
export function convert(amount: number, currency: string | undefined, info: CurrencyInfo): number {
  if (!currency || currency === info.base) return amount;
  const rate = info.rates[currency];
  return rate ? amount * rate : amount;
}