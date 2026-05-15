import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReviewNotifications(reviewHour: number): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Primary: at review time every day
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to review your day',
      body: 'Take a minute to log your spending and close out the day.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reviewHour,
      minute: 0,
    },
  });

  // Follow-up: 30 minutes later
  const followUpHour = Math.floor((reviewHour * 60 + 30) / 60) % 24;
  const followUpMinute = (reviewHour * 60 + 30) % 60;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Still haven\'t reviewed?',
      body: 'Your daily review is waiting — only takes a minute.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: followUpHour,
      minute: followUpMinute,
    },
  });
}

export async function cancelReviewNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleSnoozeNotification(snoozeUntil: Date, reviewHour: number): Promise<void> {
  const seconds = Math.max(1, Math.round((snoozeUntil.getTime() - Date.now()) / 1000));
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Ready to review now?', body: 'Your spending review is waiting.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
    },
  });
  const followUpHour = Math.floor((reviewHour * 60 + 30) / 60) % 24;
  const followUpMinute = (reviewHour * 60 + 30) % 60;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Time to review your day', body: 'Take a minute to log your spending and close out the day.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: reviewHour, minute: 0 },
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: "Still haven't reviewed?", body: 'Your daily review is waiting — only takes a minute.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: followUpHour, minute: followUpMinute },
  });
}
