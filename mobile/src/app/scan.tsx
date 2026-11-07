/** Scan the QR code a website shows when you turn on two-step sign-in. */
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { parseTotp } from '../core/totp';
import { deliverScan } from '../services/scan-bridge';
import { Banner, Button, Screen } from '../ui/kit';
import { font, radius, space, useTheme } from '../ui/theme';

export default function Scan() {
  const t = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  if (!permission) return <Screen><View /></Screen>;

  if (!permission.granted) {
    return (
      <Screen>
        <Text style={[font.body, { color: t.textDim, marginTop: space.xl, lineHeight: 23 }]}>
          SecureVoult needs the camera to read the 2FA QR code. Nothing is recorded or sent anywhere.
        </Text>
        <Button title="Allow camera" onPress={() => void requestPermission()} style={{ marginTop: space.xl }} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (done.current) return;
          if (!/^otpauth:\/\/totp\//i.test(data) || !parseTotp(data)) {
            setError('That QR code isn\'t a 2FA code. Use the one shown when you turn on two-step sign-in.');
            return;
          }
          done.current = true;
          deliverScan(data);
          router.back();
        }}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={[styles.frame, { borderColor: t.gold }]} />
      </View>
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.xxl }}>
        {error ? <Banner kind="error" text={error} /> : (
          <Text style={[font.body, { color: '#fff', textAlign: 'center' }]}>Point the camera at the QR code</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderRadius: radius.lg },
});
