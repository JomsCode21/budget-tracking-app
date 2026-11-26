import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from './AnimatedPressable';

type Props = {
  visible: boolean;
  title: string;
  detail: string;
  description?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmModal({
  visible,
  title,
  detail,
  description = 'This action cannot be undone.',
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.spring(progress, {
      damping: 18,
      stiffness: 230,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Animated.View style={[styles.overlay, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View style={[styles.card, {
          transform: [{
            scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
          }, {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
          }],
        }]}>
          <View style={styles.icon}>
            <Ionicons name="trash-outline" size={24} color="#D45B55" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
          <Text style={styles.description}>{description}</Text>
          <AnimatedPressable onPress={onConfirm} disabled={busy} style={[styles.deleteButton, busy && styles.disabled]}
            accessibilityRole="button">
            <Text style={styles.deleteText}>{busy ? 'Deleting...' : 'Delete'}</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={onCancel} disabled={busy} style={styles.cancelButton} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </AnimatedPressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(24, 29, 49, 0.48)', flex: 1, justifyContent: 'center', padding: 24 },
  card: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, width: '100%' },
  icon: { alignItems: 'center', backgroundColor: '#FDE5E2', borderRadius: 18, height: 58, justifyContent: 'center', width: 58 },
  title: { color: '#20263B', fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  detail: { color: '#29304A', fontSize: 15, fontWeight: '700', marginTop: 7, textAlign: 'center' },
  description: { color: '#7C8496', fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  deleteButton: { alignItems: 'center', backgroundColor: '#D45B55', borderRadius: 14, justifyContent: 'center', marginTop: 20, minHeight: 52, paddingHorizontal: 24, width: '100%' },
  deleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  cancelButton: { alignItems: 'center', paddingVertical: 14, width: '100%' },
  cancelText: { color: '#697187', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.65 },
});
