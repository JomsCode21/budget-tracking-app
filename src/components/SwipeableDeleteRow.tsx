import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  label?: string;
  disabled?: boolean;
};

export default function SwipeableDeleteRow({
  children,
  onDelete,
  label = 'Delete',
  disabled = false,
}: Props) {
  const offset = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabled && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (disabled) return;
        offset.setValue(Math.max(-110, Math.min(10, gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (!disabled && gesture.dx <= -75) {
          Animated.sequence([
            Animated.timing(offset, { duration: 100, toValue: -110, useNativeDriver: true }),
            Animated.timing(offset, { duration: 180, toValue: 0, useNativeDriver: true }),
          ]).start(() => onDelete());
          return;
        }
        Animated.spring(offset, {
          damping: 18,
          stiffness: 260,
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View style={styles.deleteBackground}>
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        <Text style={styles.deleteText}>{label}</Text>
      </View>
      <Animated.View
        style={[styles.foreground, { transform: [{ translateX: offset }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10, overflow: 'hidden', borderRadius: 16 },
  deleteBackground: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: '#D45B55',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'flex-end',
    paddingRight: 18,
  },
  deleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  foreground: { backgroundColor: '#FFFFFF', borderRadius: 16, zIndex: 1 },
});
