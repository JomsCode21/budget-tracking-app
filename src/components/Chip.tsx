import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

export default function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={active ? s.textActive : s.text}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
  text: { color: '#333' },
  textActive: { color: '#fff' },
});