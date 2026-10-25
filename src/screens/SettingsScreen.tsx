import React, { useEffect, useState } from 'react';
import { Text, View, Button } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 8 }}>Settings</Text>
        <Text style={{ marginBottom: 16 }}>Signed in as {email}</Text>
        <Button title="Log out" color="#c0392b" onPress={() => supabase.auth.signOut()} />
      </View>
    </SafeAreaView>
  );
}