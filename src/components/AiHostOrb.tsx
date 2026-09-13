import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

interface Props {
  size?: number;
  listening?: boolean;
  caption?: string;
}

export function AiHostOrb({ size = 132, listening = false, caption = 'AI HOST' }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: listening ? 700 : 1400,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: listening ? 700 : 1400,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.halo,
          {
            width: size + 36,
            height: size + 36,
            borderRadius: (size + 36) / 2,
            opacity: glow,
            transform: [{ scale }],
            backgroundColor: listening ? colors.cyan : colors.purple,
          },
        ]}
      />
      <LinearGradient
        colors={listening ? [colors.cyan, colors.purple] : [colors.purple, colors.cyan]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={styles.core}>
          <View style={styles.eyeRow}>
            <View style={[styles.eye, listening && styles.eyeLive]} />
            <View style={[styles.eye, listening && styles.eyeLive]} />
          </View>
          <View style={[styles.mouth, listening && styles.mouthLive]} />
        </View>
      </LinearGradient>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  halo: {
    position: 'absolute',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  core: {
    width: '58%',
    height: '58%',
    borderRadius: 999,
    backgroundColor: 'rgba(7, 17, 31, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  eye: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  eyeLive: {
    backgroundColor: colors.gold,
  },
  mouth: {
    width: 22,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  mouthLive: {
    width: 16,
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  caption: {
    marginTop: 10,
    color: colors.muted,
    letterSpacing: 3,
    fontSize: 11,
    fontWeight: '700',
  },
});
