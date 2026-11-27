import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { AuthField, AuthLayout, GoogleButton, LinkText, PasswordField, PrimaryButton, authStyles as s } from './AuthLayout';

type Props = {
  email: string;
  password: string;
  confirmPassword: string;
  busy: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onGoogleSignIn: () => void;
  onCreateAccount: () => void;
  onBackToLogin: () => void;
};

export default function SignupScreen({
  email, password, confirmPassword, busy, showPassword, showConfirmPassword, onEmailChange, onPasswordChange,
  onConfirmPasswordChange, onTogglePassword, onToggleConfirmPassword, onGoogleSignIn, onCreateAccount, onBackToLogin,
}: Props) {
  return (
    <AuthLayout eyebrow="CREATE YOUR ACCOUNT" title={'A better habit\nstarts here.'}
      help="Set up your free account and start building a clearer view of your money.">
      <AuthField label="Email address" icon="mail-outline">
        <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor="#9AA1B2"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email}
          onChangeText={onEmailChange} textContentType="emailAddress" accessibilityLabel="Email address" />
      </AuthField>
      <PasswordField value={password} onChangeText={onPasswordChange} placeholder="At least 8 characters"
        showPassword={showPassword} onToggleVisibility={onTogglePassword} />
      <PasswordField label="Confirm password" value={confirmPassword} onChangeText={onConfirmPasswordChange}
        placeholder="Re-enter your password" showPassword={showConfirmPassword}
        onToggleVisibility={onToggleConfirmPassword} />
      <PrimaryButton label="Create account" onPress={onCreateAccount} busy={busy} />
      <View style={s.dividerRow}>
        <View style={s.divider} />
        <Text style={s.dividerText}>OR</Text>
        <View style={s.divider} />
      </View>
      <GoogleButton onPress={onGoogleSignIn} busy={busy} />
      <LinkText label="Already have an account? Log in" onPress={onBackToLogin} />
    </AuthLayout>
  );
}
