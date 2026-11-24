import { supabase } from './supabase';

export type CurrencyInfo = { base: string; rates: Record<string, number> };

export const CURRENCIES = [
  'PHP', 'USD', 'EUR', 'JPY', 'SGD', 'GBP', 'AUD', 'CAD',
  'KRW', 'CNY', 'HKD', 'AED', 'SAR',
];

export function formatMoney(value: number, currency?: string): string {
  return new Intl.NumberFormat('en-PH', {
    ...(currency ? { style: 'currency' as const, currency, currencyDisplay: 'narrowSymbol' as const } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

export function getCurrencySymbol(currency: string): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency;
}

export async function fetchLatestRates(
  base: string,
  quotes: string[],
): Promise<{ rates: Record<string, number>; date: string }> {
  const requested = Array.from(new Set(quotes.filter((currency) => currency !== base)));
  if (requested.length === 0) return { rates: {}, date: new Date().toISOString().slice(0, 10) };

  const query = new URLSearchParams({
    base,
    quotes: requested.join(','),
  });
  const response = await fetch(`https://api.frankfurter.dev/v2/rates?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Exchange-rate service returned HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Exchange-rate service returned an invalid response.');
  }

  const rates: Record<string, number> = {};
  let latestDate = '';
  for (const item of payload) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as { quote?: unknown; rate?: unknown; date?: unknown };
    if (
      typeof row.quote !== 'string'
      || typeof row.rate !== 'number'
      || !Number.isFinite(row.rate)
      || row.rate <= 0
    ) {
      continue;
    }

    // The app stores the value of 1 quote unit in the selected base currency.
    rates[row.quote] = 1 / row.rate;
    if (typeof row.date === 'string' && row.date > latestDate) latestDate = row.date;
  }

  const missing = requested.filter((currency) => !(rates[currency] > 0));
  if (missing.length > 0) {
    throw new Error(`No exchange rates were returned for ${missing.join(', ')}.`);
  }
  if (!latestDate) throw new Error('Exchange-rate service did not provide an update date.');

  return { rates, date: latestDate };
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

export function convertFromBase(amount: number, currency: string, info: CurrencyInfo): number {
  if (currency === info.base) return amount;
  const rate = info.rates[currency];
  return rate ? amount / rate : amount;
}

export function convertToCurrency(
  amount: number,
  sourceCurrency: string | undefined,
  targetCurrency: string,
  info: CurrencyInfo,
): number {
  return convertFromBase(convert(amount, sourceCurrency, info), targetCurrency, info);
}