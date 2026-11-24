import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { exportBackupJson, exportTransactionsCsv } from '../lib/export';
import { restoreFromBackup } from '../lib/restore';
import { useAppLock } from '../lib/AppLock';

export default function MoreScreen() {
  const nav = useNavigation<any>();
  const { enabled, setEnabled } = useAppLock();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

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
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ color: '#666' }}>Signed in as {email}</Text>

      <Button title="Accounts" onPress={() => nav.navigate('Accounts')} />
      <Button title="Recurring bills & income" onPress={() => nav.navigate('Recurring')} />
      <Button title="Currency & exchange rates" onPress={() => nav.navigate('Currency')} />

      <View style={{ height: 8 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16 }}>Lock app (fingerprint / PIN)</Text>
        <Switch value={enabled} onValueChange={(v) => { setEnabled(v); }} />
      </View>

      <View style={{ height: 8 }} />
      <Button title={busy ? 'Working...' : 'Export transactions (CSV)'} disabled={busy}
        onPress={() => run(exportTransactionsCsv, 'Export')} />
      <Button title={busy ? 'Working...' : 'Back up all data (JSON)'} disabled={busy}
        onPress={() => run(exportBackupJson, 'Backup')} />
      <Button title={busy ? 'Working...' : 'Restore from backup (JSON)'} disabled={busy}
        onPress={doRestore} />

      <View style={{ height: 8 }} />
      <Button title="Log out" color="#c0392b" onPress={signOut} />
    </View>
  );
}