// Editar uma anotação: título, texto, fixar e, ao criar, onde guardar.
// Links (https://) no texto aparecem como botões para abrir.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useFeedback } from '@/components/Feedback';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useItems } from '@/hooks/useItems';
import { strings, t } from '@/i18n';
import { createNote, deleteNote, updateNote } from '@/services/itemActions';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { goBack } from '@/services/navigation';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { spacing } from '@/theme/tokens';
import { canCreateEvents, canEditEvent } from '@/utils/permissions';

const LINK = /https?:\/\/[^\s)]+/g;

export default function NoteEditorScreen() {
  const { id, calendarId } = useLocalSearchParams<{ id?: string; calendarId?: string }>();
  const { notes } = useItems();
  const note = id ? notes[id] : undefined;
  const userId = useUserId();
  const calendars = useDataStore((s) => s.calendars);
  const { toast, confirm } = useFeedback();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [where, setWhere] = useState<string | null>(note?.calendar_id ?? (calendarId || null));
  const [error, setError] = useState<string>();
  const { allowLeave } = useUnsavedChanges(
    title !== (note?.title ?? '') || body !== (note?.body ?? '') || pinned !== (note?.pinned ?? false),
  );

  if (id && !note) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('notes.notFound')} />
      </Screen>
    );
  }
  const calendar = note?.calendar_id ? calendars.find((c) => c.id === note.calendar_id) : undefined;
  const canEdit = !note
    ? true
    : calendar
      ? canEditEvent(calendar, { created_by: note.created_by, is_masked: false }, userId)
      : note.created_by === userId;
  const writable = calendars.filter((c) => canCreateEvents(c) && c.kind !== 'personal');
  const links = [...new Set(body.match(LINK) ?? [])].slice(0, 10);

  const save = async () => {
    if (!title.trim() && !body.trim()) {
      setError(t('validation.required'));
      return;
    }
    if (body.length > 20000) {
      setError(t('validation.tooLong', { max: 20000 }));
      return;
    }
    if (note) {
      const changes: Record<string, unknown> = {};
      if ((note.title ?? '') !== title.trim()) changes.title = title.trim() || null;
      if (note.body !== body) changes.body = body;
      if (note.pinned !== pinned) changes.pinned = pinned;
      if (Object.keys(changes).length) await updateNote(note, changes);
    } else {
      await createNote({ title: title.trim() || null, body, calendar_id: where, pinned });
    }
    toast(t('notes.saved'));
    allowLeave();
    goBack();
  };

  const remove = async () => {
    if (!note) return;
    const ok = await confirm({
      title: t('notes.deleteTitle'),
      destructive: true,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    await deleteNote(note);
    toast(t('notes.deleted'));
    allowLeave();
    goBack();
  };

  return (
    <Screen
      footer={
        canEdit ? (
          <Button title={t('common.save')} onPress={() => void save()} testID="note-save" />
        ) : undefined
      }
    >
      <Stack.Screen
        options={{
          title: note ? t('notes.edit') : t('notes.new'),
          headerRight:
            note && canEdit
              ? () => (
                  <IconButton icon="trash-outline" label={t('common.delete')} onPress={() => void remove()} />
                )
              : undefined,
        }}
      />
      {!canEdit && (
        <AppText variant="small" tone="muted">
          {t('notes.readOnly')}
        </AppText>
      )}
      <TextField
        label={t('notes.titleLabel')}
        placeholder={t('notes.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        maxLength={150}
        editable={canEdit}
      />
      <TextField
        label={t('notes.body')}
        placeholder={t('notes.bodyPlaceholder')}
        value={body}
        onChangeText={(v) => {
          setBody(v);
          setError(undefined);
        }}
        multiline
        error={error}
        maxLength={20000}
        editable={canEdit}
        style={styles.body}
        autoFocus={!note}
      />
      {!note && (
        <SelectField<string | null>
          label={t('notes.calendar')}
          value={where}
          onChange={setWhere}
          options={[
            { value: null, label: t('tasks.personal') },
            ...writable.map((c) => ({
              value: c.id as string | null,
              label: c.name,
              description: strings.calendarKinds[c.kind],
            })),
          ]}
        />
      )}
      {canEdit && <SwitchRow label={t('notes.pin')} value={pinned} onChange={setPinned} />}
      {links.length > 0 && (
        <View style={styles.gap}>
          <AppText variant="label">{t('tasks.links')}</AppText>
          {links.map((l) => (
            <Button
              key={l}
              title={l}
              icon="link-outline"
              variant="ghost"
              compact
              onPress={() => void Linking.openURL(l)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.xs },
  body: { minHeight: 200, textAlignVertical: 'top' },
});
