import * as Notifications from 'expo-notifications';
import { rescheduleReminders } from '../localNotifications';
import { makeEvent } from '@/utils/__tests__/fixtures';
import { expandEvent } from '@/utils/recurrence';
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, LOW: 2 },
  AndroidNotificationVisibility: { PRIVATE: 0, PUBLIC: 1 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationCategoryAsync: jest.fn(async () => {}),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'ok'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
}));
test('salva, preserva, remarca e remove o alarme nativo sem apagar os demais', async () => {
  const existing = new Map<string, Notifications.NotificationRequestInput>();
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockImplementation(async () => Array.from(existing.values()) as Notifications.NotificationRequest[]);
  jest.mocked(Notifications.scheduleNotificationAsync).mockImplementation(async (r) => {
    existing.set(r.identifier!, r);
    return r.identifier!;
  });
  const start = Date.now() + 3600000;
  const make = (at: number) =>
    expandEvent(
      makeEvent({
        starts_at: new Date(at).toISOString(),
        ends_at: new Date(at + 1800000).toISOString(),
        my_reminders: [5],
      }),
      new Date(),
      new Date(start + 86400000),
    );
  await rescheduleReminders(make(start), null, 'UTC', '24h');
  expect(existing.size).toBe(1);
  expect([...existing.values()][0].trigger).toMatchObject({ date: new Date(start - 300000) });
  await rescheduleReminders(make(start), null, 'UTC', '24h');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  await rescheduleReminders(make(start + 60000), null, 'UTC', '24h');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  await rescheduleReminders([], null, 'UTC', '24h');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
  expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
});
