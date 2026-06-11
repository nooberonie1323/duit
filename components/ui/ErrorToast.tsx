import { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';

interface Props {
  message: string | null;
  onDismiss: () => void;
  bottomOffset?: number;
}

export function ErrorToast({ message, onDismiss, bottomOffset = 100 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismissRef.current());
  }, [message, opacity]);

  if (!message) return null;

  return (
    <Animated.View style={{
      position: 'absolute',
      bottom: bottomOffset,
      left: 16,
      right: 16,
      backgroundColor: '#1F2937',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      opacity,
      zIndex: 999,
    }}>
      <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center' }}>
        {message}
      </Text>
    </Animated.View>
  );
}
