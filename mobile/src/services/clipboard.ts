/**
 * Copying secrets: marked sensitive (Android 13+ hides it from the clipboard
 * preview and keyboard suggestions) and cleared after the chosen time if it
 * is still what we copied.
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

let clearTimer: ReturnType<typeof setTimeout> | null = null;

export async function copySecret(value: string, clearAfterSeconds: number, sensitive = true): Promise<void> {
  await Clipboard.setStringAsync(value, {
    android: { isSensitive: sensitive },
    ...(clearAfterSeconds > 0 ? { ios: { localOnly: true, expiresAt: new Date(Date.now() + clearAfterSeconds * 1000) } } : {}),
  });
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  if (clearTimer) clearTimeout(clearTimer);
  if (clearAfterSeconds > 0) {
    clearTimer = setTimeout(async () => {
      try {
        if ((await Clipboard.getStringAsync()) === value) await Clipboard.setStringAsync('');
      } catch { /* clipboard not readable from the background */ }
    }, clearAfterSeconds * 1000);
  }
}
