/**
 * Typed message contracts between content script, background service worker, and popup.
 * All messages passed via `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`
 * should use these types to prevent silent type mismatches.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface PendingSaveLogin {
  domain: string;
  username: string;
  password: string;
}

export interface AutoFillCredential {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Messages sent FROM popup/background TO content script
// ---------------------------------------------------------------------------

export type ContentScriptMessage =
  | {
      action: 'fillCredentials';
      username: string;
      password: string;
    }
  | {
      /** Ask the content script to show autofill suggestions for the active page. */
      action: 'showAutoFillOptions';
      credentials: AutoFillCredential[];
    };

// ---------------------------------------------------------------------------
// Messages sent FROM content script TO background/popup
// ---------------------------------------------------------------------------

export type BackgroundMessage =
  | {
      /** Prompt the user to save newly detected login credentials. */
      action: 'saveLogin';
      data: PendingSaveLogin;
    }
  | {
      /** Request current tab URL so the background can look up matching credentials. */
      action: 'getTabInfo';
    }
  | {
      /** Health-check ping — background responds with { pong: true }. */
      action: 'ping';
    };

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface TabInfoResponse {
  url: string;
  title: string;
}

export interface PingResponse {
  pong: true;
}

export type BackgroundResponse =
  | TabInfoResponse
  | PingResponse
  | { error: string };

// ---------------------------------------------------------------------------
// Type guard helpers
// ---------------------------------------------------------------------------

export function isContentScriptMessage(msg: unknown): msg is ContentScriptMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'action' in msg &&
    (
      (msg as ContentScriptMessage).action === 'fillCredentials' ||
      (msg as ContentScriptMessage).action === 'showAutoFillOptions'
    )
  );
}

export function isBackgroundMessage(msg: unknown): msg is BackgroundMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'action' in msg &&
    (
      (msg as BackgroundMessage).action === 'saveLogin' ||
      (msg as BackgroundMessage).action === 'getTabInfo' ||
      (msg as BackgroundMessage).action === 'ping'
    )
  );
}
