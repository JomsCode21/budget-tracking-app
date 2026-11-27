import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { useToast } from '../components/ToastProvider';
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
type AuthNotice = { title: string; message: string; kind?: 'success' | 'error' | 'info' };
const MIN_PASSWORD = 8;
const OTP_LENGTH = 6;

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { showToast } = useToast();

  const cleanEmail = email.trim().toLowerCase();
  const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

  async function runAuth(title: string, operation: () => Promise<AuthNotice>) {
    if (busy) return;
    setBusy(true);
    try {
      const notice = await operation();
      showToast(notice.title, notice.message, notice.kind ?? 'success');
    } catch (error: unknown) {
      showToast(title, errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  function needEmail() {
    if (!cleanEmail) {
      showToast('Enter your email', '', 'error');
      return true;
    }
    return false;
  }

  function needCode() {
    const token = code.trim();
    if (token.length !== OTP_LENGTH || !/^\d+$/.test(token)) {
      showToast('Invalid code', `Enter the ${OTP_LENGTH}-digit code from your email.`, 'error');
      return true;
    }
    return false;
  }

  async function signIn() {
    if (needEmail()) return;
    if (!password) return showToast('Enter your password', '', 'error');
    await runAuth('Login failed', async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: cleanEmail });
          if (resendError) throw resendError;
          setMode('verify');
          return {
            title: 'Email not confirmed',
            message: 'We sent you a new code. Enter it to finish signing up.',
            kind: 'info',
          };
        }
        throw error;
      }
      return { title: 'Signed in', message: 'Welcome back.' };
    });
  }

  async function signUp() {
    if (needEmail()) return;
    if (password.length < MIN_PASSWORD) {
      return showToast('Password too short', `Use at least ${MIN_PASSWORD} characters.`, 'error');
    }
    if (password !== confirmPassword) {
      return showToast('Passwords do not match', 'Make sure both password fields are the same.', 'error');
    }
    await runAuth('Sign up failed', async () => {
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (error) throw error;
      if (!data.user) throw new Error('No account was created. Please try again.');
      if (!data.session) {
        setCode('');
        setMode('verify');
        return {
          title: 'Account created',
          message: 'Check your email for the verification code to finish setting up your account.',
        };
      }
      return { title: 'Account created', message: 'Your account is ready.' };
    });
  }

  async function resendCode() {
    if (needEmail()) return;
    await runAuth('Could not resend', async () => {
      const { error } = await supabase.auth.resend({ type: 'signup', email: cleanEmail });
      if (error) throw error;
      return { title: 'Code sent', message: 'Check your email.' };
    });
  }

  async function verifyCode() {
    if (needEmail()) return;
    if (needCode()) return;
    await runAuth('Code not accepted', async () => {
      const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'signup' });
      if (error) throw error;
      return { title: 'Email verified', message: 'Your account is ready.' };
    });
  }

  async function sendResetCode() {
    if (needEmail()) return;
    await runAuth('Could not send code', async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      setMode('reset');
      return {
        title: 'Check your email',
        message: 'If an account exists for that email, we sent you a verification code.',
      };
    });
  }

  async function resetPassword() {
    if (needEmail()) return;
    if (needCode()) return;
    if (newPassword.length < MIN_PASSWORD) {
      return showToast('Password too short', `Use at least ${MIN_PASSWORD} characters.`, 'error');
    }
    await runAuth('Could not set password', async () => {
      const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'recovery' });
      if (error) throw error;
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      return { title: 'Password changed', message: 'Your password was updated and you are now signed in.' };
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
          setShowPassword(false);
          setShowConfirmPassword(false);
          setMode('signup');
        }}
        onForgotPassword={() => setMode('forgot')} />
    );
  }

  if (mode === 'signup') {
    return (
      <SignupScreen email={email} password={password} confirmPassword={confirmPassword} busy={busy}
        showPassword={showPassword} showConfirmPassword={showConfirmPassword}
        onEmailChange={setEmail} onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onTogglePassword={() => setShowPassword((current) => !current)}
        onToggleConfirmPassword={() => setShowConfirmPassword((current) => !current)}
        onCreateAccount={signUp}
        onBackToLogin={() => setMode('login')} />
    );
  }

  if (mode === 'verify') {
    return (
      <AuthLayout eyebrow="CHECK YOUR EMAIL" title={'One quick step\nto get started.'}
        help={`We emailed a verification code to ${cleanEmail || 'you'}.`}>
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
