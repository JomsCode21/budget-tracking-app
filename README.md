# Budgetora

Budgetora is a personal finance and work-hours tracker built with Expo, React Native, TypeScript, and Supabase. It helps you record income and expenses, plan budgets, follow savings goals, and review work attendance and pay.

## Features

- Track income and expenses by account, category, and date.
- Review monthly cash flow and spending trends.
- Set category budgets and monitor spending against them.
- Create savings goals and record deposits or withdrawals.
- Manage cash, bank, and e-wallet accounts.
- Schedule weekly or monthly recurring transactions.
- Configure currencies and view converted totals.
- Track work hours, breaks, lateness, and overtime with DTR summaries.
- Protect the app with fingerprint authentication or a device PIN.
- Export transactions as CSV, back up data as JSON, and restore a backup.

## Requirements

- Node.js and npm
- A Supabase project
- Expo Go for basic local testing, or an Android/iOS development build for native features

## Getting started

1. Change to the project directory and install dependencies:

   ```sh
   cd budget-tracker
   npm ci
   ```

2. Create a `.env.local` file in the project root and set your Supabase project credentials:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

   These `EXPO_PUBLIC_` values are included in the client app. Use only the Supabase publishable/anon key here; never put a service-role key or other secret in the app.

3. Configure the Supabase database. The app expects its core finance tables (including accounts, categories, transactions, budgets, goals, recurring rules, user settings, and exchange rates) and the `account_balances` view. The SQL files in [`supabase/migrations`](./supabase/migrations) add user-scoped row-level security and DTR tables/settings; they are not a complete initial schema for all finance tables. Ensure the core schema exists before applying the RLS migration, then apply the migrations in filename order.

4. Start Expo:

   ```sh
   npm start
   ```

   Use the Expo CLI prompts to open the app on a device or emulator. You can also start a platform-specific session:

   ```sh
   npm run android
   npm run ios
   npm run web
   ```

   Native modules such as local authentication and secure storage may require a development build; Expo Go does not include every native module.

## Development commands

```sh
npm run lint
npx tsc --noEmit
```

## Project structure

```text
App.tsx                  App initialization, auth state, and providers
src/components/           Reusable UI components
src/lib/                  Supabase, currency, dates, exports, DTR, and other utilities
src/navigation/           Bottom-tab and stack navigation
src/screens/              App screens
src/types.ts              Shared TypeScript types
supabase/migrations/      Supabase SQL migrations
```

## Builds

The EAS configuration currently defines an internal preview Android APK profile. Build it with the EAS CLI:

```sh
npx eas-cli@latest build --platform android --profile preview
```
