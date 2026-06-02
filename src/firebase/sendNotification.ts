export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: object,
): Promise<void> {
  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: data ?? {},
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
