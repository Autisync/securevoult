// SecureVoult Mobile App entry point
//
// This app shares vault format and crypto strategy with the web app.
// See /expo/App.js comments for Phase-2 integration notes.
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
