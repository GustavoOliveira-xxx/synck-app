// Vinheta de abertura da CK (versão Aurora), a mesma dos apps web: "Uma
// produção de", a máscara subindo com os raios girando, os olhos acendendo, o
// CK se formando com brilho, a piscadinha, o nome por extenso e o slogan.
//
// Os desenhos vêm prontos de dados.json, gerado em ck-group/marca
// (gerar_vinheta.py). Não edite o JSON à mão.
//
// Desempenho: toda animação roda na thread de interface (Reanimated), só com
// opacidade e transformação. Cada camada é um SVG pequeno desenhado uma vez.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  SvgXml,
} from 'react-native-svg';

import { useAppTheme } from '@/theme/ThemeProvider';

import dados from './dados.json';
import { CHAVE_DIA_VINHETA, decidirVinheta, diaLocal, type TipoVinheta } from './regra';

interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Camada {
  caixa: Caixa;
  ext?: Caixa;
  xml: string;
  d?: string;
}
interface Dados {
  ordem: string[];
  luz: string;
  vb: Caixa;
  centro: [number, number];
  ck: Caixa;
  estrelas: [number, number, number][];
  camadas: Record<string, Camada>;
}
const D = dados as unknown as Dados;
const VB = D.vb;
const [MX, MY] = D.centro;
const FUNDO = '#06020b';

const SAI = Easing.bezier(0.16, 1, 0.3, 1);
const VOLTA = Easing.bezier(0.34, 1.56, 0.64, 1);
const IO = Easing.bezier(0.65, 0, 0.35, 1);
const de = (em: number, valor: number, dur: number, easing: WithTimingConfig['easing'] = SAI) =>
  withDelay(em, withTiming(valor, { duration: dur, easing }));

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Abre a vinheta certa para esta abertura e chama onFim quando terminar. */
export function VinhetaCK({ onFim, credito = true }: { onFim: () => void; credito?: boolean }) {
  const { reduceMotion } = useAppTheme();
  const [tipo, setTipo] = useState<TipoVinheta | null>(null);

  useEffect(() => {
    if (tipo) return;
    let vivo = true;
    void AsyncStorage.getItem(CHAVE_DIA_VINHETA)
      .catch(() => null)
      .then((ultimoDia) => {
        if (!vivo) return;
        setTipo(decidirVinheta({ ultimoDia, hoje: diaLocal(), reduzirMovimento: reduceMotion }));
      });
    return () => {
      vivo = false;
    };
  }, [reduceMotion, tipo]);

  // Enquanto decide (alguns milissegundos), segura a tela escura para o app não aparecer antes.
  if (!tipo) return <View style={[StyleSheet.absoluteFill, styles.raiz]} />;
  return (
    <Palco
      tipo={tipo}
      credito={credito}
      onFim={() => {
        if (tipo === 'completa') void AsyncStorage.setItem(CHAVE_DIA_VINHETA, diaLocal()).catch(() => {});
        onFim();
      }}
    />
  );
}

function Palco({ tipo, credito, onFim }: { tipo: TipoVinheta; credito: boolean; onFim: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  // Caixa da composição: 86% da tela, mantendo a proporção do desenho.
  const bw = Math.min(W * 0.86, H * 0.86 * (VB.w / VB.h));
  const k = bw / VB.w;
  const bh = VB.h * k;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  const pt = (x: number, y: number) => [bx + (x - VB.x) * k, by + (y - VB.y) * k] as const;
  const [mcx, mcy] = pt(MX, MY);
  const ck = D.ck;
  const [ccx, ccy] = pt(ck.x + ck.w / 2, ck.y + ck.h / 2);

  const completa = tipo === 'completa';
  const inicio = completa ? 0 : 1;

  // ---- valores animados (0 → 1, salvo indicação) ----
  const tela = useSharedValue(1);
  const conteudo = useSharedValue(tipo === 'completa' ? 1 : 0);
  const escala = useSharedValue(tipo === 'curta' ? 0.97 : 1);
  const luz = useSharedValue(inicio);
  const luzGiro = useSharedValue(completa ? -60 : 0);
  const aurora = useSharedValue(inicio);
  const cred = useSharedValue(inicio);
  const sobe = useSharedValue(inicio);
  const raiosGiro = useSharedValue(completa ? -140 : 0);
  const raiosEsc = useSharedValue(completa ? 0.55 : 1);
  const exc1 = useSharedValue(inicio);
  const exc2 = useSharedValue(inicio);
  const exc3 = useSharedValue(inicio);
  const olhos = useSharedValue(completa ? 0.12 : 1);
  const piscada = useSharedValue(1);
  const olhosBrilho = useSharedValue(0);
  const letraC = useSharedValue(inicio);
  const letraK = useSharedValue(inicio);
  const ckBrilho = useSharedValue(completa ? 0 : 0.55);
  const ckBrilhoEsc = useSharedValue(completa ? 0.6 : 1);
  const clarao = useSharedValue(0);
  const nome = useSharedValue(inicio);
  const faixa = useSharedValue(0);
  const s1 = useSharedValue(inicio);
  const s2 = useSharedValue(inicio);
  const estrelas = useSharedValue(inicio);
  const estouro = useSharedValue(0);
  const estouro2 = useSharedValue(0);
  const eletrico = useSharedValue(0);
  const relogio = useSharedValue(0);

  const terminou = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const encerrar = (dur: number) => {
    if (terminou.current) return;
    terminou.current = true;
    timers.current.forEach(clearTimeout);
    tela.value = withTiming(0, { duration: dur, easing: Easing.in(Easing.quad) });
    escala.value = withTiming(1.04, { duration: dur, easing: Easing.in(Easing.quad) });
    timers.current = [setTimeout(onFim, dur + 30)];
  };

  useEffect(() => {
    const fim = (em: number, dur: number) => {
      timers.current.push(setTimeout(() => encerrar(dur), em));
    };
    relogio.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    if (tipo === 'reduzida') {
      conteudo.value = withTiming(1, { duration: 350 });
      fim(1500, 300);
    } else if (tipo === 'curta') {
      conteudo.value = withTiming(1, { duration: 260, easing: SAI });
      escala.value = withTiming(1, { duration: 260, easing: SAI });
      piscada.value = withDelay(
        300,
        withSequence(
          withTiming(0.06, { duration: 105, easing: IO }),
          withTiming(1, { duration: 125, easing: IO }),
        ),
      );
      raiosEsc.value = withDelay(
        380,
        withSequence(withTiming(1.07, { duration: 210 }), withTiming(1, { duration: 310 })),
      );
      raiosGiro.value = withDelay(
        380,
        withSequence(withTiming(5, { duration: 210 }), withTiming(0, { duration: 310 })),
      );
      faixa.value = de(450, 1, 620, IO);
      ckBrilho.value = withDelay(
        420,
        withSequence(withTiming(1, { duration: 210 }), withTiming(0.55, { duration: 490 })),
      );
      estouro.value = de(450, 1, 900, Easing.out(Easing.cubic));
      eletrico.value = de(450, 12, 250, Easing.linear);
      fim(1250, 330);
    } else {
      aurora.value = de(0, 1, 1700);
      luz.value = de(0, 1, 1600);
      luzGiro.value = withSequence(
        withTiming(0, { duration: 1600, easing: SAI }),
        withTiming(15, { duration: 3600, easing: Easing.linear }),
      );
      cred.value = de(80, 1, 700);
      sobe.value = de(0, 1, 1500);
      raiosGiro.value = de(60, 0, 1750);
      raiosEsc.value = de(60, 1, 1750);
      exc1.value = de(950, 1, 420, VOLTA);
      exc2.value = de(1040, 1, 420, VOLTA);
      exc3.value = de(1130, 1, 420, VOLTA);
      olhos.value = de(1015, 1, 165, Easing.linear);
      olhosBrilho.value = withDelay(
        1000,
        withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 600 })),
      );
      letraC.value = de(1100, 1, 800);
      letraK.value = de(1210, 1, 800);
      ckBrilho.value = withDelay(
        1480,
        withSequence(withTiming(1, { duration: 225 }), withTiming(0.55, { duration: 675 })),
      );
      ckBrilhoEsc.value = withDelay(
        1480,
        withSequence(withTiming(1.15, { duration: 225 }), withTiming(1, { duration: 675 })),
      );
      estouro2.value = de(2150, 1, 750, Easing.out(Easing.cubic));
      clarao.value = withDelay(
        1570,
        withSequence(withTiming(0.9, { duration: 105 }), withTiming(0, { duration: 595 })),
      );
      estouro.value = de(1600, 1, 1000, Easing.out(Easing.cubic));
      eletrico.value = withDelay(
        1600,
        withSequence(
          withTiming(12, { duration: 650, easing: Easing.linear }),
          withDelay(700, withTiming(16, { duration: 200, easing: Easing.linear })),
        ),
      );
      // a piscadinha
      piscada.value = withDelay(
        1950,
        withSequence(
          withTiming(0.06, { duration: 105, easing: IO }),
          withTiming(1, { duration: 125, easing: IO }),
        ),
      );
      nome.value = de(1800, 1, 650);
      faixa.value = de(2100, 1, 720, IO);
      estrelas.value = de(2050, 1, 450);
      s1.value = de(2250, 1, 560);
      s2.value = de(2450, 1, 560);
      fim(3650, 400);
    }
    const lista = timers.current;
    return () => lista.forEach(clearTimeout);
    // A linha do tempo roda uma vez, ao montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- posição de cada camada na tela ----
  const lugar = (c: Caixa): ViewStyle => ({
    position: 'absolute',
    left: bx + (c.x - VB.x) * k,
    top: by + (c.y - VB.y) * k,
    width: c.w * k,
    height: c.h * k,
  });
  const caixaDe = (nomeCamada: string) => {
    const c = D.camadas[nomeCamada];
    return c.ext ?? c.caixa;
  };
  /** Pivô em px dentro da camada, a partir de um ponto do desenho. */
  const pivo = (nomeCamada: string, ox: number, oy: number) => {
    const c = caixaDe(nomeCamada);
    return [(ox - c.x) * k, (oy - c.y) * k, 0] as [number, number, number];
  };
  const subida = bh * 0.28;

  // ---- estilos animados ----
  const sTela = useAnimatedStyle(() => ({ opacity: tela.value }));
  const sConteudo = useAnimatedStyle(() => ({
    opacity: conteudo.value,
    transform: [{ scale: escala.value }],
  }));
  const sAurora = useAnimatedStyle(() => ({ opacity: aurora.value }));
  const sClarao = useAnimatedStyle(() => ({ opacity: clarao.value }));
  const luzLado = Math.hypot(Math.max(mcx, W - mcx), Math.max(mcy, H - mcy)) * 2.1;
  const sLuz = useAnimatedStyle(() => ({
    opacity: luz.value,
    transform: [{ rotate: `${luzGiro.value}deg` }, { scale: luzLado / 200 }],
  }));
  const sMascara = useAnimatedStyle(() => ({
    opacity: sobe.value,
    transform: [{ translateY: (1 - sobe.value) * subida }, { scale: 0.72 + 0.28 * sobe.value }],
  }));
  const sRaios = useAnimatedStyle(() => ({
    transform: [{ rotate: `${raiosGiro.value}deg` }, { scale: raiosEsc.value }],
  }));
  const pula = (v: SharedValue<number>) => () => {
    'worklet';
    return { opacity: v.value, transform: [{ scale: 0.3 + 0.7 * v.value }] };
  };
  const sExc1 = useAnimatedStyle(pula(exc1));
  const sExc2 = useAnimatedStyle(pula(exc2));
  const sExc3 = useAnimatedStyle(pula(exc3));
  const sExc = [sExc1, sExc2, sExc3];
  const sOlhos = useAnimatedStyle(() => ({ opacity: olhos.value, transform: [{ scaleY: piscada.value }] }));
  const sOlhosBrilho = useAnimatedStyle(() => ({ opacity: olhosBrilho.value }));
  const letra = (v: SharedValue<number>) => () => {
    'worklet';
    return { opacity: v.value, transform: [{ scale: 1.45 - 0.45 * v.value }] };
  };
  const sC = useAnimatedStyle(letra(letraC));
  const sK = useAnimatedStyle(letra(letraK));
  const sCkBrilho = useAnimatedStyle(() => ({
    opacity: ckBrilho.value,
    transform: [{ scale: ckBrilhoEsc.value }],
  }));
  const sNome = useAnimatedStyle(() => ({
    opacity: nome.value,
    transform: [{ translateY: (1 - nome.value) * 16 }, { scaleX: 1.25 - 0.25 * nome.value }],
  }));
  const sobeTexto = (v: SharedValue<number>) => () => {
    'worklet';
    return { opacity: v.value, transform: [{ translateY: (1 - v.value) * 12 }] };
  };
  const sS1 = useAnimatedStyle(sobeTexto(s1));
  const sS2 = useAnimatedStyle(sobeTexto(s2));
  const sCred = useAnimatedStyle(() => ({
    opacity: cred.value,
    transform: [{ translateY: (1 - cred.value) * 14 }],
  }));
  const faixaLarg = ck.w * 0.34;
  const faixaCompensa = Math.tan((20 * Math.PI) / 180) * (ck.y + ck.h / 2);
  const faixaProps = useAnimatedProps(() => ({
    x: ck.x + faixaCompensa + faixaLarg * (-1.2 + 5.4 * faixa.value),
  }));
  const sEletricoA = useAnimatedStyle(() => {
    const v = eletrico.value;
    const ativo = (v > 0 && v < 12) || (v > 12 && v < 16);
    return { opacity: ativo && Math.floor(v) % 2 === 0 ? 1 : 0 };
  });
  const sEletricoB = useAnimatedStyle(() => {
    const v = eletrico.value;
    const ativo = (v > 0 && v < 12) || (v > 12 && v < 16);
    return { opacity: ativo && Math.floor(v) % 2 === 1 ? 1 : 0 };
  });

  // ---- desenhos que dependem do tamanho da tela ----
  const fundoXml = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>` +
      `<radialGradient id="f" gradientUnits="userSpaceOnUse" cx="${mcx}" cy="${mcy}" r="${Math.max(W, H) * 0.75}"><stop offset="0" stop-color="#1f0a33"/><stop offset=".55" stop-color="#0c0416"/><stop offset="1" stop-color="${FUNDO}"/></radialGradient>` +
      `<radialGradient id="a" gradientUnits="userSpaceOnUse" cx="${mcx}" cy="${mcy}" r="${Math.min(W, H) * 0.75}"><stop offset="0" stop-color="#a308c8" stop-opacity=".62"/><stop offset=".5" stop-color="#640187" stop-opacity=".26"/><stop offset="1" stop-color="#640187" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="b" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${H}" r="${Math.max(W, H) * 0.42}"><stop offset="0" stop-color="#fccf02" stop-opacity=".13"/><stop offset=".7" stop-color="#fccf02" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="c" gradientUnits="userSpaceOnUse" cx="${ccx}" cy="${ccy}" r="${Math.min(W, H) * 0.46}"><stop offset="0" stop-color="#ffeca0" stop-opacity=".9"/><stop offset=".35" stop-color="#fccf02" stop-opacity=".45"/><stop offset="1" stop-color="#fccf02" stop-opacity="0"/></radialGradient>` +
      `</defs>`,
    [W, H, mcx, mcy, ccx, ccy],
  );

  const camadasMascara = ['raios', 'exc1', 'exc2', 'exc3', 'cabeca', 'olhoE', 'olhoD', 'olhosBrilho'];

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.raiz, sTela]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="CK, Conscious Knowledge. Consciência que cria, Conhecimento que transforma."
      testID="vinheta-ck"
    >
      <SvgXml
        xml={`${fundoXml}<rect width="${W}" height="${H}" fill="url(#f)"/></svg>`}
        width={W}
        height={H}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, sAurora]} pointerEvents="none">
        <SvgXml
          xml={`${fundoXml}<rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#b)"/></svg>`}
          width={W}
          height={H}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: mcx - 100, top: mcy - 100, width: 200, height: 200 }, sLuz]}
      >
        <SvgXml xml={D.luz} width={200} height={200} />
      </Animated.View>

      {BRASAS.map((b, i) => (
        <Brasa key={i} brasa={b} relogio={relogio} W={W} H={H} k={k} />
      ))}

      <Animated.View style={[StyleSheet.absoluteFill, sConteudo]} pointerEvents="none">
        {D.ordem.map((nomeCamada) => {
          if (nomeCamada === 'credito' && !credito) return null;
          const c = D.camadas[nomeCamada];
          const caixa = caixaDe(nomeCamada);
          const desenho = <SvgXml xml={c.xml} width="100%" height="100%" />;
          if (camadasMascara.includes(nomeCamada)) {
            let interno: ComponentProps<typeof Animated.View>['style'];
            let pivoInterno: [number, number, number] | undefined;
            if (nomeCamada === 'raios') {
              interno = sRaios;
              pivoInterno = pivo('raios', MX, MY);
            } else if (nomeCamada.startsWith('exc')) {
              const i = Number(nomeCamada.slice(3)) - 1;
              interno = sExc[i];
              pivoInterno = pivo(nomeCamada, caixa.x + caixa.w * 0.06, caixa.y + caixa.h * 0.94);
            } else if (nomeCamada === 'olhoE' || nomeCamada === 'olhoD') {
              interno = sOlhos;
              pivoInterno = pivo(nomeCamada, caixa.x + caixa.w / 2, caixa.y + caixa.h * 0.62);
            } else if (nomeCamada === 'olhosBrilho') {
              interno = sOlhosBrilho;
            }
            return (
              <Animated.View
                key={nomeCamada}
                style={[lugar(caixa), { transformOrigin: pivo(nomeCamada, MX, MY) }, sMascara]}
              >
                <Animated.View
                  style={[StyleSheet.absoluteFill, pivoInterno && { transformOrigin: pivoInterno }, interno]}
                >
                  {desenho}
                </Animated.View>
              </Animated.View>
            );
          }
          const centroCk = pivo(nomeCamada, ck.x + ck.w / 2, ck.y + ck.h / 2);
          const estilo =
            nomeCamada === 'letraC'
              ? [{ transformOrigin: centroCk }, sC]
              : nomeCamada === 'letraK'
                ? [{ transformOrigin: centroCk }, sK]
                : nomeCamada === 'ckBrilho'
                  ? [sCkBrilho]
                  : nomeCamada === 'nome'
                    ? [sNome]
                    : nomeCamada === 'slogan1'
                      ? [sS1]
                      : nomeCamada === 'slogan2'
                        ? [sS2]
                        : [sCred];
          const camada = (
            <Animated.View key={nomeCamada} style={[lugar(caixa), ...estilo]}>
              {desenho}
            </Animated.View>
          );
          if (nomeCamada !== 'letraK') return camada;
          // faixa de brilho que corre pelo CK, recortada no formato das letras
          return [
            camada,
            <View key="faixa" style={lugar(ck)}>
              <Svg
                width="100%"
                height="100%"
                viewBox={`${ck.x} ${ck.y} ${ck.w} ${ck.h}`}
                preserveAspectRatio="none"
              >
                <Defs>
                  <ClipPath id="ckvClip">
                    <Path d={(D.camadas.letraC.d ?? '') + (D.camadas.letraK.d ?? '')} />
                  </ClipPath>
                  <LinearGradient id="ckvFaixa" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#fff" stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#fff" stopOpacity={0.85} />
                    <Stop offset="1" stopColor="#fff" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <G clipPath="url(#ckvClip)">
                  <AnimatedRect
                    animatedProps={faixaProps}
                    y={ck.y - ck.h * 0.2}
                    width={faixaLarg}
                    height={ck.h * 1.4}
                    transform="skewX(-20)"
                    fill="url(#ckvFaixa)"
                  />
                </G>
              </Svg>
            </View>,
          ];
        })}

        <Animated.View style={[lugar(ZONA_ELETRICA), sEletricoA]}>
          <SvgXml xml={RAIOS_A} width="100%" height="100%" />
        </Animated.View>
        <Animated.View style={[lugar(ZONA_ELETRICA), sEletricoB]}>
          <SvgXml xml={RAIOS_B} width="100%" height="100%" />
        </Animated.View>

        {D.estrelas.map(([x, y, s], i) => (
          <Estrela
            key={i}
            x={pt(x, y)[0]}
            y={pt(x, y)[1]}
            tam={s * k}
            i={i}
            aparece={estrelas}
            relogio={relogio}
          />
        ))}
        {FAISCAS.map((f, i) => (
          <Faisca key={i} f={f} cx={ccx} cy={ccy} k={k} progresso={estouro} />
        ))}
        {FAISCAS_2.map((f, i) => (
          <Faisca key={`b${i}`} f={f} cx={ccx} cy={ccy} k={k} progresso={estouro2} />
        ))}
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sClarao]}>
        <SvgXml
          xml={`${fundoXml}<rect width="${W}" height="${H}" fill="url(#c)"/></svg>`}
          width={W}
          height={H}
        />
      </Animated.View>

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => encerrar(260)}
        accessibilityRole="button"
        accessibilityLabel="Pular abertura"
      />
    </Animated.View>
  );
}

const CORES = ['#ffd84a', '#ffd84a', '#fff1a8', '#c35cff', '#e7a6ff'];

// Sorteados uma vez, quando o módulo carrega (nada de aleatório durante a renderização).
// Tamanhos em unidades do desenho (multiplicados pela escala da tela), iguais aos da web.
const BRASAS = Array.from({ length: 24 }, (_, i) => ({
  x: Math.random(),
  fase: i / 24,
  oscila: 8 + Math.random() * 18,
  tam: 6 + Math.random() * 12,
  cor: CORES[i % CORES.length],
}));
const faiscas = (n: number, vel: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    return {
      dx: Math.cos(a),
      dy: Math.sin(a),
      dist: (90 + Math.random() * 260) * vel,
      tam: 10 + Math.random() * 22,
      cor: CORES[i % CORES.length],
    };
  });
const FAISCAS = faiscas(40, 1);
const FAISCAS_2 = faiscas(18, 0.55);

/** Ponto de luz: centro branco, cor no meio, borda transparente. */
function Luz({ tam, cor }: { tam: number; cor: string }) {
  const id = `ckvLuz${cor.slice(1)}`;
  return (
    <Svg width={tam} height={tam} viewBox="0 0 2 2">
      <Defs>
        <RadialGradient id={id} cx="1" cy="1" r="1" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#fff" />
          <Stop offset="0.18" stopColor={cor} />
          <Stop offset="1" stopColor={cor} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="1" cy="1" r="1" fill={`url(#${id})`} />
    </Svg>
  );
}

function Brasa({
  brasa,
  relogio,
  W,
  H,
  k,
}: {
  brasa: { x: number; fase: number; oscila: number; tam: number; cor: string };
  relogio: SharedValue<number>;
  W: number;
  H: number;
  k: number;
}) {
  const tam = brasa.tam * k * 1.3;
  const estilo = useAnimatedStyle(() => {
    const p = (relogio.value + brasa.fase) % 1;
    return {
      opacity: Math.sin(p * Math.PI) * 0.85,
      transform: [
        { translateX: brasa.x * W + Math.sin(p * 6.28 * 2) * brasa.oscila },
        { translateY: H + 10 - p * H * 0.75 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: tam, height: tam }, estilo]}
    >
      <Luz tam={tam} cor={brasa.cor} />
    </Animated.View>
  );
}

function Faisca({
  f,
  cx,
  cy,
  k,
  progresso,
}: {
  f: { dx: number; dy: number; dist: number; tam: number; cor: string };
  cx: number;
  cy: number;
  k: number;
  progresso: SharedValue<number>;
}) {
  const tam = f.tam * k * 1.3;
  const dist = f.dist * k * 1.3;
  const estilo = useAnimatedStyle(() => {
    const p = progresso.value;
    return {
      opacity: p > 0 && p < 1 ? 1 - p : 0,
      transform: [
        { translateX: cx + f.dx * dist * p - tam / 2 },
        { translateY: cy + f.dy * dist * p + 30 * p * p - tam / 2 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: tam, height: tam }, estilo]}
    >
      <Luz tam={tam} cor={f.cor} />
    </Animated.View>
  );
}

const ESTRELA = 'M0,-1 Q.13,-.13 1,0 Q.13,.13 0,1 Q-.13,.13 -1,0 Q-.13,-.13 0,-1Z';
function Estrela({
  x,
  y,
  tam,
  i,
  aparece,
  relogio,
}: {
  x: number;
  y: number;
  tam: number;
  i: number;
  aparece: SharedValue<number>;
  relogio: SharedValue<number>;
}) {
  const estilo = useAnimatedStyle(() => {
    const d = Math.min(1, Math.max(0, aparece.value * 1.6 - i * 0.08));
    const brilho = 0.55 + 0.45 * Math.sin(relogio.value * 6.28 * 1.6 + i * 1.7);
    return {
      opacity: d * brilho,
      transform: [{ scale: (d < 1 ? 1.6 - 0.6 * d : 1) * (0.85 + 0.15 * brilho) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - tam, top: y - tam, width: tam * 2, height: tam * 2 }, estilo]}
    >
      <Svg width="100%" height="100%" viewBox="-1 -1 2 2">
        <Path d={ESTRELA} fill="#fff6d0" />
      </Svg>
    </Animated.View>
  );
}

/** Quatro raios elétricos saindo dos lados do CK (coordenadas do desenho). */
function gerarRaios(): number[][][] {
  const c = D.ck;
  const cy = c.y + c.h / 2;
  const x0 = c.x;
  const x1 = c.x + c.w;
  const segs = [
    [x0 + 40, cy - 40, x0 - 150, cy - 120],
    [x0 + 30, cy + 50, x0 - 170, cy + 90],
    [x1 - 40, cy - 30, x1 + 160, cy - 100],
    [x1 - 30, cy + 60, x1 + 170, cy + 110],
  ];
  return segs.map(([ax, ay, bx, by]) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const pts = [[ax, ay]];
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const o = (Math.random() * 2 - 1) * 18;
      pts.push([ax + dx * t + nx * o, ay + dy * t + ny * o]);
    }
    pts.push([bx, by]);
    return pts;
  });
}
function svgRaios(zona: Caixa, raios: number[][][]): string {
  const d = raios
    .map((pl) => pl.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(''))
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${zona.x} ${zona.y} ${zona.w} ${zona.h}" preserveAspectRatio="none">` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${d}" stroke="#b046ff" stroke-opacity=".18" stroke-width="26"/>` +
    `<path d="${d}" stroke="#c66bff" stroke-opacity=".5" stroke-width="12"/>` +
    `<path d="${d}" stroke="#fff4ff" stroke-width="4"/></g></svg>`
  );
}

const ZONA_ELETRICA: Caixa = { x: D.ck.x - 230, y: D.ck.y - 140, w: D.ck.w + 460, h: D.ck.h + 280 };
const RAIOS_A = svgRaios(ZONA_ELETRICA, gerarRaios());
const RAIOS_B = svgRaios(ZONA_ELETRICA, gerarRaios());

const styles = StyleSheet.create({
  raiz: { backgroundColor: FUNDO, zIndex: 100, elevation: 100 },
});
