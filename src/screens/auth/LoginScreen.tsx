import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AuthField, AuthLayout, GoogleButton, LinkText, PasswordField, PrimaryButton, authStyles as s } from './AuthLayout';

type Props = {
  email: string;
  password: string;
  busy: boolean;
  showPassword: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onLogin: () => void;
  onGoogleSignIn: () => void;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
};

export default function LoginScreen({
  email, password, busy, showPassword, onEmailChange, onPasswordChange, onTogglePassword,
  onLogin, onGoogleSignIn, onCreateAccount, onForgotPassword,
}: Props) {
  return (
    <AuthLayout eyebrow="WELCOME BACK" title={'Your money,\nmade clearer.'}
      help="Track spending, plan ahead, and make every money count.">
      <AuthField label="Email address" icon="mail-outline">
        <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor="#9AA1B2"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email}
          onChangeText={onEmailChange} textContentType="emailAddress" accessibilityLabel="Email address" />
      </AuthField>
      <PasswordField value={password} onChangeText={onPasswordChange} showPassword={showPassword}
        onToggleVisibility={onTogglePassword} />
      <PrimaryButton label="Log in" onPress={onLogin} busy={busy} />
      <LinkText label="Forgot password?" onPress={onForgotPassword} />
      <View style={s.dividerRow}>
        <View style={s.divider} />
        <Text style={s.dividerText}>OR</Text>
        <View style={s.divider} />
      </View>
      <GoogleButton onPress={onGoogleSignIn} busy={busy} />
      <View style={s.dividerRow}>
        <View style={s.divider} />
        <Text style={s.dividerText}>NEW HERE?</Text>
        <View style={s.divider} />
      </View>
      <Pressable onPress={onCreateAccount} disabled={busy}
        style={({ pressed }) => [s.secondaryButton, pressed && s.pressed]} accessibilityRole="button">
        <Text style={s.secondaryButtonText}>Create an account</Text>
      </Pressable>
    </AuthLayout>
  );
}
