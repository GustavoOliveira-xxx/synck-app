// Apresentação em 3 passos, mostrada só na primeira vez:
// 1. personagem do logo em destaque; 2. órbita de avatares; 3. esfera de vidro.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { GlassSphere, OrbitSymbol, useDecorSize } from '@/components/brand/Decor';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { EASE_OUT, MotionView } from '@/components/motion';
import { t } from '@/i18n';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { CALENDAR_COLORS, motion, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';

const PEOPLE = [
  { name: 'Ana', color: CALENDAR_COLORS[1].value },
  { name: 'Leo', color: CALENDAR_COLORS[3].value },
  { name: 'Ju', color: CALENDAR_COLORS[4].value },
  { name: 'Mãe', color: CALENDAR_COLORS[2].value },
];

/** Órbita de avatares girando devagar em volta do símbolo. */
function AvatarOrbit({ size }: { size: number }) {
  const { colors, reduceMotion } = useAppTheme();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1);
  }, [reduceMotion, spin]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 360}deg` }] }));
  const r = size / 2 - 26;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            margin: 26,
            borderRadius: size,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.inputBorder,
          },
        ]}
      />
      <View style={[styles.center, StyleSheet.absoluteFill]}>
        <View style={[styles.core, { borderColor: colors.border, width: size * 0.42, height: size * 0.42 }]}>
          <OrbitSymbol size={size * 0.34} />
        </View>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, ring]}>
        {PEOPLE.map((p, i) => {
          const a = (i / PEOPLE.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <Animated.View
              key={p.name}
              style={[
                styles.bubble,
                {
                  left: size / 2 + Math.cos(a) * r - 24,
                  top: size / 2 + Math.sin(a) * r - 24,
                  borderColor: colors.surface,
                },
                counter,
              ]}
            >
              <Avatar name={p.name} color={p.color} size={44} />
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

function Dots({ index, total }: { index: number; total: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={styles.dots}
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.progress', { n: index + 1, total })}
    >
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} active={i === index} color={i === index ? colors.primary : colors.inputBorder} />
      ))}
    </View>
  );
}

function Dot({ active, color }: { active: boolean; color: string }) {
  const w = useSharedValue(active ? 24 : 7);
  useEffect(() => {
    w.value = withSpring(active ? 24 : 7, motion.mola);
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export default function OnboardingScreen() {
  const { colors, reduceMotion } = useAppTheme();
  const { height } = useWindowDimensions();
  const hero = useDecorSize('hero');
  const [index, setIndex] = useState(0);
  const finish = () => {
    useUiStore.getState().setOnboardingDone();
    router.replace('/welcome');
  };
  const slides = [
    {
      overline: t('onboarding.slide1Overline'),
      title: t('onboarding.slide1Title'),
      text: t('onboarding.slide1Text'),
    },
    {
      overline: t('onboarding.slide2Overline'),
      title: t('onboarding.slide2Title'),
      text: t('onboarding.slide2Text'),
    },
    {
      overline: t('onboarding.slide3Overline'),
      title: t('onboarding.slide3Title'),
      text: t('onboarding.slide3Text'),
    },
  ];
  const slide = slides[index];
  const last = index === slides.length - 1;
  const artHeight = Math.min(height * 0.42, hero * 1.15);
  const entering = reduceMotion ? FadeIn.duration(150) : FadeInRight.duration(280).easing(EASE_OUT);
  const exiting = reduceMotion ? undefined : FadeOutLeft.duration(160);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        {index > 0 ? (
          <IconButton icon="chevron-back" label={t('common.back')} onPress={() => setIndex(index - 1)} />
        ) : (
          <View />
        )}
        <Button title={t('onboarding.skip')} variant="ghost" onPress={finish} compact />
      </View>
      <MotionView key={index} entering={entering} exiting={exiting} style={styles.body}>
        <View style={[styles.art, { height: artHeight }]}>
          {index === 0 && (
            <>
              <Image
                source={require('../../../assets/brand/personagem.png')}
                style={{ width: hero, height: hero / (160 / 112) }}
                resizeMode="contain"
                accessible={false}
              />
            </>
          )}
          {index === 1 && <AvatarOrbit size={Math.min(hero, artHeight)} />}
          {index === 2 && <GlassSphere size={Math.min(hero, artHeight)} />}
        </View>
        <View style={styles.texts} accessibilityLiveRegion="polite">
          <AppText variant="overline" tone="brand">
            {slide.overline}
          </AppText>
          <AppText variant="display" style={styles.title}>
            {slide.title}
          </AppText>
          <AppText tone="muted">{slide.text}</AppText>
        </View>
      </MotionView>
      <View style={styles.footer}>
        <Dots index={index} total={slides.length} />
        <Button
          title={last ? t('onboarding.start') : t('onboarding.next')}
          onPress={last ? finish : () => setIndex(index + 1)}
          compact
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: 56,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_MARGIN,
    gap: spacing.xxl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  art: { alignItems: 'center', justifyContent: 'center' },
  texts: { gap: spacing.sm },
  title: { fontSize: 32, lineHeight: 36 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_MARGIN,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 7, borderRadius: radius.pill },
  center: { alignItems: 'center', justifyContent: 'center' },
  core: { borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bubble: { position: 'absolute', borderWidth: 2, borderRadius: 26 },
});
