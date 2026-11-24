import React, { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import LoginScreen from './auth/LoginScreen';
import SignupScreen from './auth/SignupScreen';
import {
  AuthField,
  AuthLayout,
  CodeField,
  LinkText,
  PasswordField,
  PrimaryButton,
  authStyles as s,
} from './auth/AuthLayout';

type Mode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';
const MIN_PASSWORD = 8;

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const cleanEmail = email.trim();
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

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
    if (password !== confirmPassword) {
      return Alert.alert('Passwords do not match', 'Make sure both password fields are the same.');
    }
    await runAuth('Sign up failed', async () => {
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (error) throw error;
      if (!data.session) setMode('verify');
    });
  }

  async function resendCode() {
    if (needEmail()) return;
    await runAuth('Could not resend', async () => {
      const { error } = await supabase.auth.resend({ type: 'signup', email: cleanEmail });
      if (error) throw error;
      Alert.alert('Code sent', 'Check your email.');
    });
  }

  async function verifyCode() {
    if (needEmail()) return;
    if (!code.trim()) return Alert.alert('Enter the code from your email');
    await runAuth('Code not accepted', async () => {
      const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'signup' });
      if (error) throw error;
    });
  }

  async function sendResetCode() {
    if (needEmail()) return;
    await runAuth('Could not send code', async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      Alert.alert('Check your email', 'If an account exists for that email, we sent you a verification code.');
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
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      Alert.alert('Password changed', 'You are now signed in.');
    });
  }

  if (mode === 'login') {
    return (
      <LoginScreen email={email} password={password} busy={busy} showPassword={showPassword}
        onEmailChange={setEmail} onPasswordChange={setPassword}
        onTogglePassword={() => setShowPassword((current) => !current)} onLogin={signIn}
        onCreateAccount={() => {
          setPassword('');
          setConfirmPassword('');
          setMode('signup');
        }}
        onForgotPassword={() => setMode('forgot')} />
    );
  }

  if (mode === 'signup') {
    return (
      <SignupScreen email={email} password={password} confirmPassword={confirmPassword} busy={busy}
        showPassword={showPassword} onEmailChange={setEmail} onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onTogglePassword={() => setShowPassword((current) => !current)} onCreateAccount={signUp}
        onBackToLogin={() => setMode('login')} />
    );
  }

  if (mode === 'verify') {
    return (
      <AuthLayout eyebrow="CHECK YOUR EMAIL" title={'One quick step\nto get started.'}
        help={`We emailed a 6-digit code to ${cleanEmail || 'you'}.`}>
        <CodeField value={code} onChangeText={setCode} />
        <PrimaryButton label="Confirm code" onPress={verifyCode} busy={busy} />
        <LinkText label="Resend code" onPress={resendCode} />
        <LinkText label="Back to log in" onPress={() => setMode('login')} />
      </AuthLayout>
    );
  }

  if (mode === 'forgot') {
    return (
      <AuthLayout eyebrow="RESET PASSWORD" title={'Let’s get you\nback in.'}
        help="Enter your email and we will send you a verification code.">
        <AuthField label="Email address" icon="mail-outline">
          <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor="#9AA1B2"
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email}
            onChangeText={setEmail} textContentType="emailAddress" accessibilityLabel="Email address" />
        </AuthField>
        <PrimaryButton label="Send code" onPress={sendResetCode} busy={busy} />
        <LinkText label="Back to log in" onPress={() => setMode('login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="CREATE A NEW PASSWORD" title={'Choose a new\npassword.'}
      help="Enter the code from your email and choose a new password.">
      <AuthField label="Email address" icon="mail-outline">
        <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor="#9AA1B2"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email}
          onChangeText={setEmail} textContentType="emailAddress" accessibilityLabel="Email address" />
      </AuthField>
      <CodeField value={code} onChangeText={setCode} />
      <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword}
        placeholder={`At least ${MIN_PASSWORD} characters`} showPassword={showPassword}
        onToggleVisibility={() => setShowPassword((current) => !current)} />
      <PrimaryButton label="Change password" onPress={resetPassword} busy={busy} />
      <LinkText label="Back to log in" onPress={() => setMode('login')} />
    </AuthLayout>
  );
}
