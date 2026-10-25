import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ZoomIn } from 'react-native-reanimated';

import { MotionView } from './motion';

import { strings, t } from '@/i18n';
import type { DateKey } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, radius } from '@/theme/tokens';
import { dateKeyParts, formatLongDate, monthMatrix } from '@/utils/dates';

import { AppText } from './AppText';

export interface DayInfo {
  count: number;
  colors: string[];
  /** Tarefas e lembretes com prazo no dia (marcadores quadrado e anel). */
  tasks?: number;
  reminders?: number;
  /** Tudo concluído no dia (marcadores mais claros). */
  allDone?: boolean;
}

/** Grade mensal. Cada dia diz por voz quantos eventos tem (não só pelos pontinhos). */
export const MonthGrid = memo(function MonthGrid({
  year,
  month,
  weekStartsOn,
  selected,
  today,
  days,
  onSelect,
}: {
  year: number;
  month: number;
  weekStartsOn: 0 | 1;
  selected: DateKey | null;
  today: DateKey;
  days: Record<DateKey, DayInfo>;
  onSelect: (day: DateKey) => void;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const matrix = monthMatrix(year, month, weekStartsOn);
  const headers = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);

  return (
    <View accessibilityRole="grid">
      <View style={styles.week}>
        {headers.map((wd) => (
          <View key={wd} style={styles.cell} accessibilityElementsHidden importantForAccessibility="no">
            <AppText variant="overline" tone="muted" maxFontSizeMultiplier={1.2}>
              {strings.weekdays.letter[wd]}
            </AppText>
          </View>
        ))}
      </View>
      {matrix.map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((day) => {
            const { month: m, day: d } = dateKeyParts(day);
            const outside = m !== month;
            const isSelected = day === selected;
            const isToday = day === today;
            const info = days[day];
            const label = [
              formatLongDate(day),
              isToday ? t('common.today') : null,
              info?.count ? t('calendarView.eventsCount', { n: info.count }) : null,
              info?.tasks ? `${info.tasks} ${t('tasks.title').toLowerCase()}` : null,
              info?.reminders ? `${info.reminders} ${t('tasks.views.reminders').toLowerCase()}` : null,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <Pressable
                key={day}
                onPress={() => onSelect(day)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.dayCircle,
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.today },
                  ]}
                >
                  {isSelected && (
                    <MotionView
                      entering={reduceMotion ? undefined : ZoomIn.springify().stiffness(400).damping(28)}
                      style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: colors.primary }]}
                    />
                  )}
                  <AppText
                    maxFontSizeMultiplier={1.3}
                    style={{
                      fontSize: 16,
                      lineHeight: 20,
                      fontVariant: ['tabular-nums'],
                      color: isSelected
                        ? colors.primaryText
                        : outside
                          ? colors.textMuted
                          : isToday
                            ? colors.primaryInk
                            : colors.text,
                      ...fonte(isToday || isSelected ? 'negrito' : 'semi'),
                      opacity: outside && !isSelected ? 0.55 : 1,
                    }}
                  >
                    {d}
                  </AppText>
                </View>
                <View style={styles.dots}>
                  {(info?.colors ?? []).slice(0, 3).map((c, i) => (
                    <View key={`${c}-${i}`} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
                  {info && info.count > 3 ? (
                    <AppText variant="caption" tone="muted" maxFontSizeMultiplier={1} style={styles.more}>
                      +
                    </AppText>
                  ) : null}
                  {info?.tasks ? (
                    <View
                      style={[
                        styles.taskMark,
                        { borderColor: colors.primaryInk, opacity: info.allDone ? 0.45 : 1 },
                      ]}
                    />
                  ) : null}
                  {info?.reminders ? (
                    <View style={[styles.reminderMark, { borderColor: colors.coral }]} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 52 },
  fill: { borderRadius: radius.pill },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 3, height: 8, alignItems: 'center', marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  more: { fontSize: 10, lineHeight: 10 },
  taskMark: { width: 6, height: 6, borderRadius: 1.5, borderWidth: 1.5 },
  reminderMark: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5 },
});
