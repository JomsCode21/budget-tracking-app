import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

export default function AnimatedPressable({ onPressIn, onPressOut, style, ...props }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn(event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) {
    Animated.spring(scale, {
      damping: 16,
      stiffness: 260,
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
    onPressIn?.(event);
  }

  function pressOut(event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) {
    Animated.spring(scale, {
      damping: 16,
      stiffness: 260,
      toValue: 1,
      useNativeDriver: true,
    }).start();
    onPressOut?.(event);
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable {...props} style={style} onPressIn={pressIn} onPressOut={pressOut} />
    </Animated.View>
  );
}
