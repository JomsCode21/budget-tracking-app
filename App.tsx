import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { syncRecurring } from './src/lib/recurring';
import { AppLockProvider } from './src/lib/AppLock';
import AuthScreen from './src/screens/AuthScreen';
import AppTabs from './src/navigation/AppTabs';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Create any recurring transactions that have come due and
  // reschedule bill reminders whenever a user is signed in.
  useEffect(() => {
    if (session) syncRecurring();
  }, [session?.user.id]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AppLockProvider>
        {session ? (
          <NavigationContainer>
            <AppTabs />
          </NavigationContainer>
        ) : (
          <AuthScreen />
        )}
      </AppLockProvider>
    </SafeAreaProvider>
  );
}