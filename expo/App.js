// Mobile app entry point
//
// Phase-2 integration note:
// The Expo app shares the same vault format and crypto strategy as the web app.
// To productionize:
//   1. Replace Firebase web SDK with @react-native-firebase/app + auth.
//   2. Pass the Firebase ID token as Bearer to all /api/* routes.
//   3. Use expo-secure-store instead of AsyncStorage for the encrypted vault blob.
//   4. Import CryptoService from src/lib/crypto.ts (Web Crypto is available in
//      React Native via the react-native-quick-crypto polyfill).
//
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { VaultProvider } from '../src/contexts/VaultContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { MobileApp } from '../src/components/MobileApp';

export default function App() {
  return (
    <AuthProvider>
      <VaultProvider>
        <View style={styles.container}>
          <StatusBar style="light" />
          <MobileApp />
        </View>
      </VaultProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080d1a',
  },
});
