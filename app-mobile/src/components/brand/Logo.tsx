// Logo oficial SynCK. A arte completa (com as letras escuras) só aparece
// sobre fundo claro. No tema escuro, em vez de uma placa clara em volta, o
// logo é montado com o personagem (que funciona em qualquer fundo) e o nome
// SynCK em texto claro, com "CK" na cor da marca.
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { CORES_DO_LOGO } from '@/theme/marca';
import { fonte } from '@/theme/tokens';

import { AppText } from '../AppText';

const SOURCES = {
  vertical: { src: require('../../../assets/brand/logo-vertical.png'), ratio: 200 / 179 },
  horizontal: { src: require('../../../assets/brand/logo-horizontal.png'), ratio: 240 / 56 },
  personagem: { src: require('../../../assets/brand/personagem.png'), ratio: 160 / 112 },
} as const;

/** Nome "SynCK" em texto, para fundos escuros. */
export function Wordmark({ size }: { size: number }) {
  const { colors } = useAppTheme();
  return (
    <AppText
      accessible={false}
      style={[styles.word, { fontSize: size, lineHeight: size * 1.15, color: colors.text }]}
    >
      Syn
      <AppText style={[styles.word, { fontSize: size, lineHeight: size * 1.15, color: CORES_DO_LOGO.jade }]}>
        CK
      </AppText>
    </AppText>
  );
}

export function Logo({
  kind,
  width,
  style,
}: {
  kind: keyof typeof SOURCES;
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { dark } = useAppTheme();
  const { src, ratio } = SOURCES[kind];
  if (!dark || kind === 'personagem') {
    return (
      <View style={style}>
        <Image
          source={src}
          style={{ width, height: width / ratio }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="SynCK"
        />
      </View>
    );
  }
  // Tema escuro: personagem + nome, nas mesmas proporções da arte original.
  const character = SOURCES.personagem;
  const vertical = kind === 'vertical';
  const art = vertical ? width * 0.78 : (width / ratio) * character.ratio * 1.05;
  return (
    <View
      style={[vertical ? styles.vertical : styles.horizontal, { width }, style]}
      accessibilityRole="image"
      accessibilityLabel="SynCK"
    >
      <Image
        source={character.src}
        style={{ width: art, height: art / character.ratio }}
        resizeMode="contain"
      />
      <Wordmark size={vertical ? width * 0.22 : (width / ratio) * 0.62} />
    </View>
  );
}

const styles = StyleSheet.create({
  word: { ...fonte('tituloForte'), letterSpacing: -0.5 },
  vertical: { alignItems: 'center' },
  horizontal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
