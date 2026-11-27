import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export function AuthLayout({
  eyebrow,
  title,
  help,
  children,
}: {
  eyebrow: string;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.brandMark}>
            <Ionicons name="wallet-outline" size={27} color="#FFFFFF" />
          </View>
          <Text style={s.brandName}>Budget Tracker</Text>
          <View style={s.hero}>
            <Text style={s.eyebrow}>{eyebrow}</Text>
            <Text style={s.title}>{title}</Text>
            <Text style={s.help}>{help}</Text>
          </View>
          <View style={s.formCard}>{children}</View>
          <Text style={s.footer}>Your finances, in your hands.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputShell}>
        <Ionicons name={icon} size={19} color="#7C8496" style={s.inputIcon} />
        {children}
      </View>
    </View>
  );
}

export function PasswordField({
  label = 'Password',
  value,
  onChangeText,
  placeholder = 'Enter your password',
  showPassword,
  onToggleVisibility,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  showPassword: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <AuthField label={label} icon="lock-closed-outline">
      <View style={s.passwordRow}>
        <TextInput
          style={s.passwordInput}
          placeholder={placeholder}
          placeholderTextColor="#9AA1B2"
          secureTextEntry={!showPassword}
          value={value}
          onChangeText={onChangeText}
          textContentType="password"
          accessibilityLabel={label}
        />
        <Pressable onPress={onToggleVisibility} style={s.visibilityButton} accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#7C8496" />
        </Pressable>
      </View>
    </AuthField>
  );
}

export function CodeField({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  return (
    <AuthField label="Verification code" icon="keypad-outline">
      <TextInput
        style={s.input}
        placeholder="Enter 6-digit code"
        placeholderTextColor="#9AA1B2"
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        autoFocus
        maxLength={6}
        accessibilityLabel="Verification code"
      />
    </AuthField>
  );
}

export function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [s.primaryButton, pressed && s.pressed, busy && s.disabledButton]}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function GoogleButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [s.googleButton, pressed && s.pressed, busy && s.disabledButton]}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {busy ? <ActivityIndicator color="#4285F4" /> : (
        <>
          <Ionicons name="logo-google" size={18} color="#4285F4" />
          <Text style={s.googleButtonText}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.linkButton} accessibilityRole="button">
      <Text style={s.link}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F7FB' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 32 },
  brandMark: {
    alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 18, height: 56, justifyContent: 'center',
    shadowColor: '#5865D9', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, width: 56,
  },
  brandName: { color: '#29304A', fontSize: 15, fontWeight: '700', marginTop: 12 },
  hero: { marginBottom: 26, marginTop: 42 },
  eyebrow: { color: '#5865D9', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 12 },
  title: { color: '#20263B', fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40 },
  help: { color: '#697187', fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 330 },
  formCard: {
    backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 22, borderWidth: 1, padding: 20,
    shadowColor: '#28304A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20,
  },
  field: { marginBottom: 16 },
  label: { color: '#343B53', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  inputShell: { alignItems: 'center', backgroundColor: '#F8F9FC', borderColor: '#E4E7EF', borderRadius: 13,
    borderWidth: 1, flexDirection: 'row', minHeight: 52 },
  inputIcon: { marginLeft: 15 },
  input: { color: '#252B40', flex: 1, fontSize: 15, minHeight: 50, paddingHorizontal: 12 },
  passwordRow: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  passwordInput: { color: '#252B40', flex: 1, fontSize: 15, minHeight: 50, paddingLeft: 12 },
  visibilityButton: { padding: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 13, justifyContent: 'center', minHeight: 52, marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: '#DDE1EC', borderRadius: 13, borderWidth: 1, justifyContent: 'center', minHeight: 50 },
  secondaryButtonText: { color: '#5865D9', fontSize: 15, fontWeight: '800' },
  googleButton: { alignItems: 'center', borderColor: '#DDE1EC', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 50 },
  googleButtonText: { color: '#343B53', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  disabledButton: { opacity: 0.65 },
  linkButton: { alignItems: 'center', paddingVertical: 15 },
  link: { color: '#5865D9', fontSize: 14, fontWeight: '700' },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 8 },
  divider: { backgroundColor: '#E8EAF1', flex: 1, height: 1 },
  dividerText: { color: '#A0A6B6', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  footer: { color: '#9AA1B2', fontSize: 12, marginTop: 24, textAlign: 'center' },
});

export const authStyles = s;
