import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { exportBackupJson, exportTransactionsCsv } from '../lib/export';
import { restoreFromBackup } from '../lib/restore';
import { useAppLock } from '../lib/AppLock';
import AnimatedPressable from '../components/AnimatedPressable';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

export default function MoreScreen() {
  const nav = useNavigation<any>();
  const { enabled, setEnabled } = useAppLock();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

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
      setShowLogout(false);
    } catch (error: unknown) {
      Alert.alert('Could not log out', error instanceof Error ? error.message : String(error));
    }
  }

  async function run(fn: () => Promise<number>, what: string) {
    setBusy(true);
    try {
      const n = await fn();
      if (n === 0) Alert.alert(what, 'There was nothing to export yet.');
    } catch (e: any) {
      Alert.alert(`${what} failed`, e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmRestore(summary: string) {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Restore backup?',
        summary,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Restore', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  }

  async function doRestore() {
    setBusy(true);
    try {
      const n = await restoreFromBackup(confirmRestore);
      if (n !== null) Alert.alert('Restore complete', `${n} records restored.`);
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.kicker}>APP & ACCOUNT</Text>
          <Text style={s.title}>More</Text>
        </View>

        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{email ? email.charAt(0).toUpperCase() : 'U'}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileLabel}>SIGNED IN AS</Text>
            <Text style={s.profileEmail} numberOfLines={1}>{email || 'Loading account...'}</Text>
          </View>
          <View style={s.profileBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#16845A" />
          </View>
        </View>

        <Text style={s.sectionTitle}>Money tools</Text>
        <View style={s.menuCard}>
          <MenuRow icon="wallet-outline" iconColor="#5865D9" iconBackground="#EEF0FF"
            title="Accounts" subtitle="Manage cash, banks and e-wallets"
            onPress={() => nav.navigate('Accounts')} />
          <MenuRow icon="repeat-outline" iconColor="#16845A" iconBackground="#DDF5EA"
            title="Recurring" subtitle="Bills and recurring income"
            onPress={() => nav.navigate('Recurring')} />
          <MenuRow icon="swap-horizontal-outline" iconColor="#D68A25" iconBackground="#FFF0D9"
            title="Currency" subtitle="Base currency and exchange rates"
            onPress={() => nav.navigate('Currency')} last />
        </View>

        <Text style={s.sectionTitle}>Work tools</Text>
        <View style={s.menuCard}>
          <MenuRow icon="time-outline" iconColor="#5865D9" iconBackground="#EEF0FF"
            title="DTR" subtitle="Attendance, work hours and pay summary"
            onPress={() => nav.navigate('DTR')} last />
        </View>

        <Text style={s.sectionTitle}>Security</Text>
        <View style={s.menuCard}>
          <View style={s.securityRow}>
            <View style={[s.rowIcon, { backgroundColor: '#FDE5E2' }]}>
              <Ionicons name="finger-print-outline" size={20} color="#D45B55" />
            </View>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>App lock</Text>
              <Text style={s.rowSubtitle}>Fingerprint or PIN</Text>
            </View>
            <Switch value={enabled} onValueChange={(value) => { void setEnabled(value); }}
              trackColor={{ false: '#D8DBE5', true: '#AEB4F4' }}
              thumbColor={enabled ? '#5865D9' : '#FFFFFF'} />
          </View>
        </View>

        <Text style={s.sectionTitle}>Data and backup</Text>
        <View style={s.menuCard}>
          <MenuRow icon="document-text-outline" iconColor="#5865D9" iconBackground="#EEF0FF"
            title={busy ? 'Working...' : 'Export transactions'} subtitle="Download as CSV"
            onPress={() => run(exportTransactionsCsv, 'Export')} disabled={busy} />
          <MenuRow icon="archive-outline" iconColor="#16845A" iconBackground="#DDF5EA"
            title={busy ? 'Working...' : 'Back up all data'} subtitle="Download a JSON backup"
            onPress={() => run(exportBackupJson, 'Backup')} disabled={busy} />
          <MenuRow icon="refresh-outline" iconColor="#D68A25" iconBackground="#FFF0D9"
            title={busy ? 'Working...' : 'Restore backup'} subtitle="Import data from JSON"
            onPress={doRestore} disabled={busy} last />
        </View>

        <AnimatedPressable onPress={() => setShowLogout(true)} style={s.logoutButton} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={20} color="#D45B55" />
          <Text style={s.logoutText}>Log out</Text>
        </AnimatedPressable>

        <Text style={s.versionText}>Budget Tracker</Text>
      </ScrollView>

      <DeleteConfirmModal
        visible={showLogout}
        title="Log out?"
        detail="Your data remains saved"
        description="You will need to sign in again to continue."
        onCancel={() => setShowLogout(false)}
        onConfirm={signOut}
      />
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  iconColor,
  iconBackground,
  title,
  subtitle,
  onPress,
  disabled,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={[s.menuRow, last && s.lastMenuRow, disabled && s.disabledRow]}
      accessibilityRole="button"
    >
      <View style={[s.rowIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={s.rowText}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#A0A6B6" />
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  safeArea: { backgroundColor: '#F6F7FB', flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 28 },
  header: { paddingBottom: 14, paddingTop: 18 },
  kicker: { color: '#5865D9', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: '#20263B', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#29304A',
    borderRadius: 22,
    flexDirection: 'row',
    padding: 16,
  },
  avatar: { alignItems: 'center', backgroundColor: '#5865D9', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1, marginHorizontal: 12, minWidth: 0 },
  profileLabel: { color: '#AEB6D4', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  profileEmail: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 5 },
  profileBadge: { alignItems: 'center', backgroundColor: '#EEF5F1', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  sectionTitle: { color: '#29304A', fontSize: 15, fontWeight: '800', marginBottom: 9, marginTop: 20 },
  menuCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EAF1', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  menuRow: {
    alignItems: 'center',
    borderBottomColor: '#ECEEF4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: 13,
  },
  lastMenuRow: { borderBottomWidth: 0 },
  rowIcon: { alignItems: 'center', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  rowText: { flex: 1, marginHorizontal: 11, minWidth: 0 },
  rowTitle: { color: '#29304A', fontSize: 15, fontWeight: '800' },
  rowSubtitle: { color: '#8A91A4', fontSize: 11, marginTop: 3 },
  disabledRow: { opacity: 0.55 },
  securityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: 13,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#FDECE9',
    borderColor: '#F7D1CC',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
  },
  logoutText: { color: '#D45B55', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  versionText: { color: '#A0A6B6', fontSize: 11, marginTop: 16, textAlign: 'center' },
});