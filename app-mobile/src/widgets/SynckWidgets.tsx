// Widgets SynCK para a tela inicial do Android, nas cores e na fonte do app:
// - "Meu dia": o que tem hoje (compromissos, tarefas e lembretes);
// - "Mês": mini calendário com o dia de hoje e pontinhos nos dias com algo;
// - "Contagem": quantos dias faltam para o evento que a pessoa escolheu.
// Cada um tem versão clara e escura (segue o tema do celular) e se ajusta ao
// tamanho que a pessoa der na tela inicial.
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import { strings } from '@/i18n';
import { agendaColor } from '@/theme/tokens';
import type { DateKey } from '@/models/types';
import { addDaysToKey, dateKeyParts, monthMatrix } from '@/utils/dates';

import { simboloSvg } from './simbolo';
import { daysUntil, itemsOn, type WidgetCountdown, type WidgetItem, type WidgetSnapshot } from './snapshot';

const FONT = {
  regular: 'TitilliumWeb-Regular',
  semi: 'TitilliumWeb-SemiBold',
  bold: 'TitilliumWeb-Bold',
};

const PALETTE = {
  light: {
    bg: '#FFFFFF',
    bgEnd: '#EEF7F3',
    text: '#0E1A1C',
    muted: '#4A5B5D',
    faint: '#A4B3B0',
    primary: '#017A68',
    onPrimary: '#FFFFFF',
    soft: '#DDF3EE',
    ink: '#01604F',
    coral: '#FF6F4E',
    line: '#D5E0DC',
  },
  dark: {
    bg: '#112124',
    bgEnd: '#0A1416',
    text: '#E8F1EE',
    muted: '#9DB3B0',
    faint: '#4F6664',
    primary: '#15C9AB',
    onPrimary: '#03302F',
    soft: '#12393A',
    ink: '#89E1C4',
    coral: '#FF8A6E',
    line: '#22383B',
  },
} as const;
type Palette = (typeof PALETTE)['light'] | (typeof PALETTE)['dark'];

const hex = (c: string) => c as ColorProp;
const uri = (path: string) => ({ uri: `agendacompartilhada://${path}` });

function weekdayShort(day: DateKey): string {
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  const { day: d, month } = dateKeyParts(day);
  return `${strings.weekdays.short[wd]}, ${d} ${strings.months.short[month - 1]}`;
}

/** Fundo comum: cartão arredondado com degradê suave, como os cartões do app. */
function Card({ p, children, path }: { p: Palette; children: unknown; path: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={uri(path)}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        borderRadius: 24,
        padding: 14,
        backgroundGradient: { from: hex(p.bg), to: hex(p.bgEnd), orientation: 'TOP_BOTTOM' },
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Mark({ color, size = 22 }: { color: string; size?: number }) {
  return <SvgWidget svg={simboloSvg(color)} style={{ height: size, width: size }} />;
}

// -------------------------------------------------------------------------
// Meu dia
// -------------------------------------------------------------------------

function ItemRow({ item, p, dark }: { item: WidgetItem; p: Palette; dark: boolean }) {
  const color = agendaColor(item.color, dark) ?? p.primary;
  const path =
    item.kind === 'event' ? `event/${item.id}?date=${item.occurrence ?? item.date}` : `task/${item.id}`;
  const lead = item.kind === 'event' ? (item.time ?? 'Dia todo') : item.kind === 'reminder' ? '🔔' : '○';
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={uri(path)}
      style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', height: 26 }}
    >
      <FlexWidget style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: hex(color) }} />
      <TextWidget
        text={lead}
        style={{
          width: 52,
          marginLeft: 8,
          fontSize: 12,
          fontFamily: FONT.bold,
          color: hex(item.kind === 'event' ? p.ink : p.muted),
        }}
        maxLines={1}
      />
      <TextWidget
        text={item.time && item.kind !== 'event' ? `${item.title} · ${item.time}` : item.title}
        style={{ fontSize: 13, fontFamily: FONT.semi, color: hex(p.text), width: 'match_parent' }}
        maxLines={1}
        truncate="END"
      />
    </FlexWidget>
  );
}

export function MeuDiaWidget({
  snapshot,
  today,
  height,
  dark,
}: {
  snapshot: WidgetSnapshot;
  today: DateKey;
  height: number;
  dark: boolean;
}) {
  const p = dark ? PALETTE.dark : PALETTE.light;
  const items = itemsOn(snapshot, today);
  const events = items.filter((i) => i.kind === 'event').length;
  const tasks = items.length - events;
  const fits = Math.max(1, Math.floor((height - 74) / 26));
  const shown = items.slice(0, fits);
  const tomorrow = itemsOn(snapshot, addDaysToKey(today, 1));
  const summary = items.length
    ? [
        events ? `${events} compromisso${events > 1 ? 's' : ''}` : null,
        tasks ? `${tasks} tarefa${tasks > 1 ? 's' : ''}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Nada marcado hoje';
  return (
    <Card p={p} path="">
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <Mark color={p.primary} />
        <FlexWidget style={{ flexDirection: 'column', marginLeft: 8, flex: 1 }}>
          <TextWidget text="Meu dia" style={{ fontSize: 15, fontFamily: FONT.bold, color: hex(p.text) }} />
          <TextWidget
            text={`${weekdayShort(today)} · ${summary}`}
            style={{ fontSize: 11, fontFamily: FONT.regular, color: hex(p.muted) }}
            maxLines={1}
            truncate="END"
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={uri(`create?date=${today}`)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: hex(p.primary),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget text="+" style={{ fontSize: 20, fontFamily: FONT.bold, color: hex(p.onPrimary) }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ height: 8, width: 'match_parent' }} />
      {shown.length ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flex: 1 }}>
          {shown.map((item) => (
            <ItemRow key={`${item.kind}-${item.id}-${item.date}`} item={item} p={p} dark={dark} />
          ))}
          {items.length > shown.length ? (
            <TextWidget
              text={`+ ${items.length - shown.length} no app`}
              style={{ fontSize: 11, fontFamily: FONT.semi, color: hex(p.ink), marginTop: 2 }}
            />
          ) : null}
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            borderRadius: 16,
            backgroundColor: hex(p.soft),
            padding: 10,
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text="Dia livre ✨"
            style={{ fontSize: 14, fontFamily: FONT.bold, color: hex(p.ink) }}
          />
          <TextWidget
            text={
              tomorrow.length
                ? `Amanhã: ${tomorrow[0].time ? `${tomorrow[0].time} ` : ''}${tomorrow[0].title}`
                : 'Toque no + para planejar algo.'
            }
            style={{ fontSize: 12, fontFamily: FONT.regular, color: hex(p.muted) }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>
      )}
    </Card>
  );
}

// -------------------------------------------------------------------------
// Mini calendário
// -------------------------------------------------------------------------

export function CalendarioWidget({
  snapshot,
  today,
  width,
  height,
  dark,
}: {
  snapshot: WidgetSnapshot;
  today: DateKey;
  width: number;
  height: number;
  dark: boolean;
}) {
  const p = dark ? PALETTE.dark : PALETTE.light;
  const { year, month } = dateKeyParts(today);
  const weeks = monthMatrix(year, month, snapshot.weekStartsOn);
  // Só as semanas que tocam o mês (5 ou 6).
  const rows = weeks.filter((w) => w.some((d) => dateKeyParts(d).month === month));
  const busy = new Set(snapshot.busyDays);
  const cell = Math.max(16, Math.min((width - 28) / 7, (height - 64) / (rows.length + 0.6)));
  const font = Math.max(10, Math.min(15, cell * 0.42));
  const letters = strings.weekdays.letter;
  const order = Array.from({ length: 7 }, (_, i) => (i + snapshot.weekStartsOn) % 7);
  return (
    <Card p={p} path="month">
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget
          text={strings.months.long[month - 1].replace(/^./, (c) => c.toUpperCase())}
          style={{ fontSize: 16, fontFamily: FONT.bold, color: hex(p.text) }}
        />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={` ${year}`}
            style={{ fontSize: 16, fontFamily: FONT.semi, color: hex(p.muted) }}
          />
        </FlexWidget>
        <Mark color={p.primary} size={20} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 6 }}>
        {order.map((wd) => (
          <FlexWidget key={wd} style={{ flex: 1, alignItems: 'center' }}>
            <TextWidget
              text={letters[wd]}
              style={{ fontSize: 10, fontFamily: FONT.bold, color: hex(p.muted) }}
            />
          </FlexWidget>
        ))}
      </FlexWidget>
      {rows.map((week) => (
        <FlexWidget key={week[0]} style={{ flexDirection: 'row', width: 'match_parent', flex: 1 }}>
          {week.map((day) => {
            const inMonth = dateKeyParts(day).month === month;
            const isToday = day === today;
            return (
              <FlexWidget
                key={day}
                clickAction="OPEN_URI"
                clickActionData={uri(`month?date=${day}`)}
                style={{ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              >
                <FlexWidget
                  style={{
                    width: cell * 0.82,
                    height: cell * 0.82,
                    borderRadius: cell,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: hex(isToday ? p.primary : '#00000000'),
                  }}
                >
                  <TextWidget
                    text={String(dateKeyParts(day).day)}
                    style={{
                      fontSize: font,
                      fontFamily: isToday ? FONT.bold : FONT.semi,
                      color: hex(isToday ? p.onPrimary : inMonth ? p.text : p.faint),
                    }}
                  />
                </FlexWidget>
                <FlexWidget
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: hex(busy.has(day) && inMonth && !isToday ? p.coral : '#00000000'),
                  }}
                />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      ))}
    </Card>
  );
}

// -------------------------------------------------------------------------
// Contagem regressiva
// -------------------------------------------------------------------------

export function ContagemWidget({
  countdown,
  today,
  dark,
  width,
}: {
  countdown: WidgetCountdown | null;
  today: DateKey;
  dark: boolean;
  width: number;
}) {
  const big = Math.max(34, Math.min(64, width * 0.34));
  // Fundo na cor da marca (ou do evento), com o texto claro.
  const tone = countdown ? (agendaColor(countdown.color, false) ?? '#017A68') : '#017A68';
  const background = {
    from: hex(tone),
    to: hex(dark ? '#03302F' : '#01604F'),
    orientation: 'TL_BR' as const,
  };
  const frame = {
    height: 'match_parent' as const,
    width: 'match_parent' as const,
    flexDirection: 'column' as const,
    borderRadius: 24,
    padding: 14,
    backgroundGradient: background,
  };

  if (!countdown) {
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={uri('month')} style={frame}>
        <Mark color="#FFFFFF" size={24} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget
          text="Contagem regressiva"
          style={{ fontSize: 14, fontFamily: FONT.bold, color: hex('#FFFFFF') }}
        />
        <TextWidget
          text="No app, abra um evento e toque em “Contar no widget”."
          style={{ fontSize: 11, fontFamily: FONT.regular, color: hex('#DDF3EE') }}
          maxLines={3}
        />
      </FlexWidget>
    );
  }

  const n = daysUntil(today, countdown.date);
  const label = n > 1 ? 'dias' : n === 1 ? 'dia' : '';
  const headline = n > 0 ? 'FALTAM' : n === 0 ? 'É HOJE' : 'JÁ PASSOU';
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={uri(`event/${countdown.eventId}?date=${countdown.occurrence}`)}
      style={frame}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={headline}
            style={{ fontSize: 11, fontFamily: FONT.bold, color: hex('#DDF3EE'), letterSpacing: 0.12 }}
          />
        </FlexWidget>
        <Mark color="#FFFFFF" size={18} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flex: 1 }}>
        <TextWidget
          text={n > 0 ? String(n) : n === 0 ? (countdown.time ?? '✨') : String(Math.abs(n))}
          style={{ fontSize: big, fontFamily: FONT.bold, color: hex('#FFFFFF') }}
        />
        <TextWidget
          text={n < 0 ? ' dias atrás' : label ? ` ${label}` : ''}
          style={{ fontSize: 14, fontFamily: FONT.semi, color: hex('#DDF3EE'), marginBottom: big * 0.16 }}
        />
      </FlexWidget>
      <TextWidget
        text={countdown.title}
        style={{ fontSize: 14, fontFamily: FONT.bold, color: hex('#FFFFFF') }}
        maxLines={2}
        truncate="END"
      />
      <TextWidget
        text={`${weekdayShort(countdown.date)}${countdown.time ? ` · ${countdown.time}` : ''}`}
        style={{ fontSize: 11, fontFamily: FONT.regular, color: hex('#DDF3EE') }}
        maxLines={1}
      />
    </FlexWidget>
  );
}
