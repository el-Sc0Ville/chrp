type ActionableOptions = {
  eventId: string;
  teamId: string;
  userId: string;
  displayName?: string;
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
    ...(options ? { categoryId: 'AVAILABILITY_REQUEST' } : {}),
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

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}
