import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { syncRecurring } from './src/lib/recurring';
import { AppLockProvider } from './src/lib/AppLock';
import AuthScreen from './src/screens/AuthScreen';
import AppTabs from './src/navigation/AppTabs';

const styles = StyleSheet.create({
  initContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  initTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  initMessage: {
    color: '#555',
    marginBottom: 16,
  },
});

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const initializeSession = useCallback(async () => {
    setRetrying(true);
    setInitError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);
      setReady(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setInitError(message);
      setReady(true);
    } finally {
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    initializeSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setInitError(null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [initializeSession]);

  // Create any recurring transactions that have come due and
  // reschedule bill reminders whenever a user is signed in.
  useEffect(() => {
    if (!session) return;
    syncRecurring().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Recurring items could not sync', message);
    });
  }, [session?.user.id]);

  if (!ready) return null;

  if (initError) {
    return (
      <SafeAreaProvider>
        <View style={styles.initContainer}>
          <Text style={styles.initTitle}>Could not start Budget Tracker</Text>
          <Text style={styles.initMessage}>{initError}</Text>
          <Button title={retrying ? 'Retrying...' : 'Retry'} disabled={retrying} onPress={initializeSession} />
        </View>
      </SafeAreaProvider>
    );
  }

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