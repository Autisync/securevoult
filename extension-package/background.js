// SecureVoult â€” background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('SecureVoult extension installed');
});

// â”€â”€ Message handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) { sendResponse({ error: 'No active tab' }); return; }
      try {
        const url = new URL(tab.url);
        sendResponse({
          url: tab.url,
          title: tab.title ?? '',
          domain: url.hostname.replace('www.', ''),
        });
      } catch {
        sendResponse({ error: 'Invalid URL' });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'saveLogin') {
    // Store pending save-login data so the popup can pick it up
    chrome.storage.session.set({ sv_pending_save: request.data }, () => {
      sendResponse({ queued: true });
    });
    return true;
  }

  if (request.action === 'openPopup') {
    // Programmatic popup open is not supported in MV3 â€” notify the user instead
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'showAutoFillOptions' });
      }
    });
    return true;
  }
});

// â”€â”€ Context menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.contextMenus.create({
  id: 'sv-fill',
  title: 'Fill with SecureVoult',
  contexts: ['editable'],
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sv-fill' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'showAutoFillOptions' });
  }
});


