type ActionableOptions = {
  eventId: string;
  teamId: string;
  userId: string;
  displayName?: string;
  categoryId?: string;
  data?: object;
};

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  options?: ActionableOptions,
): Promise<void> {
  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
    data: options
      ? {
          eventId: options.eventId,
          teamId: options.teamId,
          userId: options.userId,
          ...(options.displayName ? { displayName: options.displayName } : {}),
          ...(options.data ?? {}),
        }
      : {},
  };

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.error('[sendPushNotification] Expo API error:', res.status, res.statusText);
    }
  } catch (err) {
    console.error('[sendPushNotification] fetch failed:', err);
  }
}
