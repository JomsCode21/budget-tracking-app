import { RecurringRule } from '../types';

// Bill reminders are disabled for now: Expo Go doesn't include the native
// notifications module. We'll re-enable this when we move to a development build.
export async function scheduleReminders(_rules: RecurringRule[]) {
  // intentionally empty
}