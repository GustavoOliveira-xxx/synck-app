// Mural de anotações: cartões lado a lado, na cor da agenda, com as fixadas
// primeiro. Tocar abre a anotação; tocar e segurar fixa ou desafixa (as
// fixadas também aparecem na tela Hoje). O primeiro cartão cria uma nova.
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useCalendarsMap } from '@/hooks/useEventsView';
import { t } from '@/i18n';
import type { Note } from '@/models/types';
import { updateNote } from '@/services/itemActions';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, fonte, mix, pastel, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { useFeedback } from './Feedback';
import { Icon } from './Icon';
import { EnterItem, PressableScale, tapFeedback } from './motion';

const CARD_W = 168;
const CARD_H = 148;

export function noteHeadline(note: Note): string {
  return note.title?.trim() || note.body.trim().split('\n')[0].slice(0, 80) || t('notes.untitled');
}

/** Anotações em ordem de mural: fixadas, depois as alteradas mais recentemente. */
export function boardOrder(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
  );
}

export function NotesBoard({
  notes,
  calendarId,
  showCalendar,
  canAdd = true,
  max = 10,
}: {
  notes: Note[];
  /** Agenda onde a anotação nova nasce (vazio: pessoal). */
  calendarId?: string;
  /** Mostrar o nome da agenda em cada cartão (mural com várias agendas). */
  showCalendar?: boolean;
  canAdd?: boolean;
  max?: number;
}) {
  const { colors, dark } = useAppTheme();
  const { toast } = useFeedback();
  const calendars = useCalendarsMap();
  const shown = boardOrder(notes).slice(0, max);

  const togglePin = async (note: Note) => {
    tapFeedback('select');
    await updateNote(note, { pinned: !note.pinned });
    toast(note.pinned ? t('notes.unpinned') : t('notes.pinnedToast'));
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {canAdd && (
        <EnterItem index={0}>
          <PressableScale
            onPress={() => router.push({ pathname: '/notes/new', params: { calendarId: calendarId ?? '' } })}
            haptic
            accessibilityRole="button"
            accessibilityLabel={t('notes.new')}
            style={[styles.card, styles.add, { borderColor: colors.inputBorder }]}
          >
            <View style={[styles.addIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="add" size={22} color={colors.primaryInk} />
            </View>
            <AppText variant="label" center>
              {t('notes.new')}
            </AppText>
          </PressableScale>
        </EnterItem>
      )}
      {shown.length === 0 && (
        <EnterItem index={1}>
          <View style={[styles.card, styles.hint, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="star-outline" size={18} color={colors.textMuted} />
            <AppText variant="caption" tone="muted">
              {t('notes.boardHint')}
            </AppText>
          </View>
        </EnterItem>
      )}
      {shown.map((note, i) => {
        const calendar = note.calendar_id ? calendars[note.calendar_id] : undefined;
        const base = agendaColor(calendar?.color, false) ?? colors.primary;
        const bg = dark ? mix(base, colors.surface, 0.78) : pastel(base);
        const ink = dark ? colors.text : mix(base, colors.text, 0.55);
        const body = note.title?.trim() ? note.body.trim() : note.body.trim().split('\n').slice(1).join('\n');
        return (
          <EnterItem key={note.id} index={i + 1}>
            <PressableScale
              onPress={() => router.push({ pathname: '/notes/[id]', params: { id: note.id } })}
              onLongPress={() => void togglePin(note)}
              accessibilityRole="button"
              accessibilityLabel={`${noteHeadline(note)}${note.pinned ? `. ${t('notes.pinned')}` : ''}`}
              accessibilityHint={note.pinned ? t('notes.unpinHint') : t('notes.pinHint')}
              style={[styles.card, { backgroundColor: bg }]}
            >
              <View style={styles.top}>
                <AppText numberOfLines={2} style={[styles.title, { color: ink }]}>
                  {noteHeadline(note)}
                </AppText>
                {note.pinned && <Icon name="star-outline" size={16} color={ink} />}
              </View>
              {body ? (
                <AppText
                  variant="caption"
                  numberOfLines={4}
                  style={[styles.flex, { color: ink, opacity: 0.85 }]}
                >
                  {body}
                </AppText>
              ) : (
                <View style={styles.flex} />
              )}
              {showCalendar && (
                <AppText variant="caption" numberOfLines={1} style={{ color: ink, ...fonte('semi') }}>
                  {calendar?.name ?? t('tasks.personal')}
                </AppText>
              )}
            </PressableScale>
          </EnterItem>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingRight: spacing.lg, paddingVertical: spacing.xxs },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  add: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  hint: { width: 220, justifyContent: 'center' },
  addIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  title: { flex: 1, fontSize: 15, lineHeight: 19, ...fonte('negrito') },
  flex: { flex: 1 },
});
