import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Button, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'appLockEnabled';
const GRACE_MS = 15000; // locks again after being away longer than this

type Ctx = { enabled: boolean; setEnabled: (value: boolean) => Promise<boolean> };

const AppLockContext = createContext<Ctx>({ enabled: false, setEnabled: async () => false });
export const useAppLock = () => useContext(AppLockContext);

async function authenticate(message: string): Promise<boolean> {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: message });
    return res.success;
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
    const [enabled, setEnabledState] = useState(false);
    const [locked, setLocked] = useState(false);
    const [ready, setReady] = useState(false);

    const enabledRef = useRef(false);
    const authenticating = useRef(false);
    const backgroundedAt = useRef<number | null>(null);

    // The system prompt itself makes the app go inactive/active, so changes
    // that happen while it is open (and just after) are ignored.
    function releaseAuthFlag() {
        setTimeout(() => { authenticating.current = false; }, 500);
    }

    const unlock = useCallback(async () => {
        if (authenticating.current) return;
        authenticating.current = true;
        try {
            if (await authenticate('Unlock Budget Tracker')) setLocked(false);
        } finally {
            releaseAuthFlag();
        }
    }, []);

    // read the saved setting on start
    useEffect(() => {
        AsyncStorage.getItem(KEY)
            .then((v) => {
                const on = v === '1';
                enabledRef.current = on;
                setEnabledState(on);
                if (on) setLocked(true);
            })
            .catch(() => { })
            .finally(() => setReady(true));
    }, []);

    // show the system prompt automatically whenever the app becomes locked
    useEffect(() => {
        if (ready && locked) unlock();
    }, [ready, locked, unlock]);

    // lock again after the app has been in the background for a while
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (authenticating.current || !enabledRef.current) return;
            if (state === 'background' || state === 'inactive') {
                if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
            } else if (state === 'active') {
                const at = backgroundedAt.current;
                backgroundedAt.current = null;
                if (at !== null && Date.now() - at > GRACE_MS) setLocked(true);
            }
        });
        return () => sub.remove();
    }, []);

    const setEnabled = useCallback(async (value: boolean) => {
        if (authenticating.current) return false;
        authenticating.current = true;
        try {
            const res = await LocalAuthentication.authenticateAsync({
                promptMessage: value ? 'Confirm to turn on app lock' : 'Confirm to turn off app lock',
            });

            if (!res.success) {
                const reason = res.error;
                if (reason === 'not_enrolled' || reason === 'passcode_not_set' || reason === 'not_available') {
                    Alert.alert(
                        'Set a screen lock first',
                        'Add a fingerprint, PIN, pattern or password in your phone settings, then try again.'
                    );
                } else if (reason !== 'user_cancel' && reason !== 'system_cancel' && reason !== 'app_cancel') {
                    Alert.alert('Could not verify you', `Reason: ${reason}`);
                }
                return false;
            }

            await AsyncStorage.setItem(KEY, value ? '1' : '0');
            enabledRef.current = value;
            setEnabledState(value);
            return true;
        } catch (e: any) {
            Alert.alert('App lock error', e?.message ?? String(e));
            return false;
        } finally {
            releaseAuthFlag();
        }
    }, []);

    if (!ready) return null;

    return (
        <AppLockContext.Provider value={{ enabled, setEnabled }}>
            {children}
            {enabled && locked && (
                <View style={s.overlay}>
                    <Text style={s.title}>Budget Tracker is locked</Text>
                    <Button title="Unlock" onPress={unlock} />
                </View>
            )}
        </AppLockContext.Provider>
    );
}

const s = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        zIndex: 1000,
        elevation: 1000,
    },
    title: { fontSize: 20, fontWeight: '600' },
});