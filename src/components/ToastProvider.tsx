import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type ToastKind = 'success' | 'error' | 'info';

type ToastMessage = {
  id: number;
  title: string;
  message: string;
  kind: ToastKind;
};

type ToastContextValue = {
  showToast: (title: string, message?: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider.');
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((title: string, message = '', kind: ToastKind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++nextId.current;
    setToast({ id, title, message, kind });
    timer.current = setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
      timer.current = null;
    }, kind === 'error' ? 5000 : 3500);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={styles.root}>
        {children}
        {toast && <ToastBanner key={toast.id} toast={toast} onDismiss={dismissToast} />}
      </View>
    </ToastContext.Provider>
  );
}

function ToastBanner({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      duration: 180,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, toast.id]);

  const color = toast.kind === 'success'
    ? '#25805D'
    : toast.kind === 'error'
      ? '#B64242'
      : '#5865D9';
  const icon = toast.kind === 'success'
    ? 'checkmark-circle-outline'
    : toast.kind === 'error'
      ? 'alert-circle-outline'
      : 'information-circle-outline';

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: color,
            opacity: progress,
            transform: [{
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }),
            }],
          },
        ]}
      >
        <Ionicons name={icon} size={22} color="#FFFFFF" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{toast.title}</Text>
          {!!toast.message && <Text style={styles.message}>{toast.message}</Text>}
        </View>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={8}
          style={styles.dismissButton}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: {
    left: 16,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 16,
    top: 0,
    zIndex: 1000,
  },
  toast: {
    alignItems: 'center',
    borderRadius: 14,
    elevation: 8,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#20263B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  textContainer: { flex: 1, marginHorizontal: 10 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  message: { color: '#FFFFFF', fontSize: 12, lineHeight: 17, marginTop: 2 },
  dismissButton: { alignItems: 'center', justifyContent: 'center', padding: 2 },
});
