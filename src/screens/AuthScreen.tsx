import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function signUp() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return Alert.alert('Sign up failed', error.message);
    if (!data.session) Alert.alert('Check your email', 'Confirm your email, then log in.');
  }

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) Alert.alert('Login failed', error.message);
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={s.box}>
        <Text style={s.title}>Budget Tracker</Text>
        <TextInput style={s.input} placeholder="Email" autoCapitalize="none"
          keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="Password (min 6)" secureTextEntry
          value={password} onChangeText={setPassword} />
        <Button title="Log in" onPress={signIn} disabled={busy} />
        <View style={{ height: 8 }} />
        <Button title="Sign up" onPress={signUp} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  box: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
});