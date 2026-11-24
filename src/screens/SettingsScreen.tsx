import React, { useEffect, useState } from 'react';
import { Text, View, Button, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error) throw error;
        setEmail(data.user?.email ?? '');
      })
      .catch((error: unknown) => {
        Alert.alert('Could not load account', error instanceof Error ? error.message : String(error));
      });
  }, []);

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: unknown) {
      Alert.alert('Could not log out', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 8 }}>Settings</Text>
        <Text style={{ marginBottom: 16 }}>Signed in as {email}</Text>
        <Button title="Log out" color="#c0392b" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}