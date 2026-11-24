import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'verify' | 'forgot' | 'reset';

const MIN_PASSWORD = 8;

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return React.createElement(
    Pressable,
    { onPress, style: { paddingVertical: 10 } },
    React.createElement(Text, { style: s.link }, label),
  );
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const cleanEmail = email.trim();
  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  async function runAuth(title: string, operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
    } catch (error: unknown) {
      Alert.alert(title, errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function needEmail() {
    if (!cleanEmail) {
      Alert.alert('Enter your email');
      return true;
    }
    return false;
  }

  async function resendCode() {
    if (needEmail()) return;
    await runAuth('Could not resend', async () => {
      const { error } = await supabase.auth.resend({ type: 'signup', email: cleanEmail });
      if (error) throw error;
      Alert.alert('Code sent', 'Check your email.');
    });
  }

  async function signIn() {
    if (needEmail() || !password) return password ? undefined : Alert.alert('Enter your password');
    await runAuth('Login failed', async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: cleanEmail });
          if (resendError) throw resendError;
          Alert.alert('Email not confirmed', 'We sent you a new code. Enter it to finish signing up.');
          setMode('verify');
          return;
        }
        throw error;
      }
    });
  }

  async function signUp() {
    if (needEmail()) return;
    if (password.length < MIN_PASSWORD) {
      return Alert.alert('Password too short', `Use at least ${MIN_PASSWORD} characters.`);
    }
    await runAuth('Sign up failed', async () => {
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (error) throw error;
      if (!data.session) setMode('verify'); // email confirmation is on: wait for the code
    });
  }

  async function verifyCode() {
    if (needEmail()) return;
    if (!code.trim()) return Alert.alert('Enter the code from your email');
    await runAuth('Code not accepted', async () => {
      const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'signup' });
      if (error) throw error;
      // on success the session is created and the app switches screens by itself
    });
  }

  async function sendResetCode() {
    if (needEmail()) return;
    await runAuth('Could not send code', async () => {
      // The Supabase recovery email template must use {{ .Token }} rather than
      // the default recovery link because this screen accepts an OTP.
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      Alert.alert('Check your email', 'If an account exists for that email, we sent a verification code.');
      setMode('reset');
    });
  }

  async function resetPassword() {
    if (needEmail()) return;
    if (!code.trim()) return Alert.alert('Enter the code from your email');
    if (newPassword.length < MIN_PASSWORD) {
      return Alert.alert('Password too short', `Use at least ${MIN_PASSWORD} characters.`);
    }
    await runAuth('Could not set password', async () => {
      const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'recovery' });
      if (error) throw error;
      // the code signed us in; now set the new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      Alert.alert('Password changed', 'You are now signed in.');
    });
  }

  const h = React.createElement;
  const emailInput = h(TextInput, {
    style: s.input,
    placeholder: 'Email',
    autoCapitalize: 'none',
    keyboardType: 'email-address',
    value: email,
    onChangeText: setEmail,
  });

  return h(SafeAreaView, { style: { flex: 1 } },
    h(View, { style: s.box },
      h(Text, { style: s.title }, 'Budget Tracker'),

      mode === 'login' && h(React.Fragment, null,
        emailInput,
        h(TextInput, { style: s.input, placeholder: 'Password', secureTextEntry: true,
          value: password, onChangeText: setPassword }),
        h(Button, { title: 'Log in', onPress: signIn, disabled: busy }),
        h(View, { style: { height: 8 } }),
        h(Button, { title: 'Sign up', onPress: signUp, disabled: busy }),
        h(LinkText, { label: 'Forgot password?', onPress: () => setMode('forgot') }),
      ),

      mode === 'verify' && h(React.Fragment, null,
        h(Text, { style: s.help }, `We emailed a 6-digit code to ${cleanEmail || 'you'}. Enter it below.`),
        h(TextInput, { style: s.input, placeholder: 'Code', keyboardType: 'number-pad',
          value: code, onChangeText: setCode, autoFocus: true }),
        h(Button, { title: 'Confirm', onPress: verifyCode, disabled: busy }),
        h(LinkText, { label: 'Resend code', onPress: resendCode }),
        h(LinkText, { label: 'Back to log in', onPress: () => setMode('login') }),
      ),

      mode === 'forgot' && h(React.Fragment, null,
        h(Text, { style: s.help }, 'Enter your email and we will send you a code.'),
        emailInput,
        h(Button, { title: 'Send code', onPress: sendResetCode, disabled: busy }),
        h(LinkText, { label: 'Back to log in', onPress: () => setMode('login') }),
      ),

      mode === 'reset' && h(React.Fragment, null,
        h(Text, { style: s.help }, 'Enter the code from your email and choose a new password.'),
        emailInput,
        h(TextInput, { style: s.input, placeholder: 'Code', keyboardType: 'number-pad',
          value: code, onChangeText: setCode }),
        h(TextInput, { style: s.input, placeholder: `New password (min ${MIN_PASSWORD})`, secureTextEntry: true,
          value: newPassword, onChangeText: setNewPassword }),
        h(Button, { title: 'Change password', onPress: resetPassword, disabled: busy }),
        h(LinkText, { label: 'Back to log in', onPress: () => setMode('login') }),
      ),
    ),
  );
}

const s = StyleSheet.create({
  box: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  help: { color: '#555', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  link: { color: '#2196f3', textAlign: 'center' },
});