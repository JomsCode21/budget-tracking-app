import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from './AnimatedPressable';

type Props = {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
};

export default function UndoToast({
  visible,
  message,
  onUndo,
  onDismiss,
  duration = 5000,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.timing(progress, {
      duration: 220,
      toValue: 1,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, progress, visible]);

  if (!visible) return null;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
      <Animated.View style={[styles.toast, {
        opacity: progress,
        transform: [{
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
        }],
      }]}>
        <View style={styles.icon}>
          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        <AnimatedPressable onPress={onUndo} style={styles.undoButton} accessibilityRole="button">
          <Text style={styles.undoText}>Undo</Text>
        </AnimatedPressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    bottom: 12,
    left: 16,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 16,
  },
  toast: {
    alignItems: 'center',
    backgroundColor: '#29304A',
    borderRadius: 16,
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#20263B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  icon: { alignItems: 'center', backgroundColor: '#D45B55', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  message: { color: '#FFFFFF', flex: 1, fontSize: 13, fontWeight: '700', marginHorizontal: 10 },
  undoButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, justifyContent: 'center', minHeight: 38, paddingHorizontal: 12 },
  undoText: { color: '#5865D9', fontSize: 13, fontWeight: '800' },
});
