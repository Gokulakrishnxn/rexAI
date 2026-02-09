import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return false;
  }
  return true;
}


export async function scheduleTestNotification() {
  // Check for Expo Go on Android (Notification Support removed in SDK 53+)
  const isExpoGo = Constants.appOwnership === 'expo';
  if (Platform.OS === 'android' && isExpoGo) {
    Alert.alert(
      'Notification Test (Expo Go)',
      'RexAI Reminder 💊\nTime to take your medication!\n\n(Note: Native notifications are disabled in Expo Go on Android. This simulates the experience.)'
    );
    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    Alert.alert('Permission Denied', 'Please enable notifications in settings.');
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "RexAI Reminder 💊",
      body: "Time to take your medication!",
      sound: 'default',
    },
    trigger: {
      seconds: 2, // Test trigger in 2 seconds
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      channelId: 'default',
    },
  });

  Alert.alert('Scheduled', 'Notification will appear in 2 seconds (if app is backgrounded or foreground settings allow).');
}
