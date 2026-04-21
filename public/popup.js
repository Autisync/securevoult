// Extension popup entry point
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionPopup } from '../src/components/ExtensionPopup';
import { AuthProvider } from '../src/contexts/AuthContext';
import { VaultProvider } from '../src/contexts/VaultContext';
import { Toaster } from '../src/components/ui/toaster';
import '../src/app/globals.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <VaultProvider>
          <ExtensionPopup />
          <Toaster />
        </VaultProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}