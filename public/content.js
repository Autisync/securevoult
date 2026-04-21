// SecureVoult â€” content script
// Handles autofill, field detection, and save-login prompts.
(function () {
  'use strict';

  const BRAND = {
    bg: '#0a0f1e',
    border: '#1e2d4a',
    text: '#f0f4ff',
    muted: '#7a8ba8',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    danger: '#ef4444',
    radius: '14px',
    font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  // â”€â”€ HTML escaping â€” prevents XSS when user-controlled text is set via innerHTML â”€â”€
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  // â”€â”€ Message handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillCredentials') {
      const ok = fillCredentials(request.username, request.password);
      sendResponse({ success: ok });
    } else if (request.action === 'showAutoFillOptions') {
      showToast('Open the SecureVoult popup to select credentials for this site.');
    } else if (request.action === 'ping') {
      sendResponse({ alive: true });
    }
    return true;
  });

  // â”€â”€ Fill credentials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function setNativeValue(el, value) {
    // Works for React-controlled inputs by triggering the React synthetic event
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function findVisibleInput(selectors) {
    for (const sel of selectors) {
      const candidates = document.querySelectorAll(sel);
      for (const el of candidates) {
        if (el instanceof HTMLInputElement && el.offsetParent !== null && !el.disabled && !el.readOnly) {
          return el;
        }
      }
    }
    return null;
  }

  function fillCredentials(username, password) {
    let filled = false;

    if (username) {
      const usernameField = findVisibleInput([
        'input[type="email"]',
        'input[autocomplete="username"]',
        'input[autocomplete="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[id*="email"]',
        'input[id*="user"]',
        'input[name*="email"]',
        'input[name*="user"]',
        'input[type="text"][placeholder*="email" i]',
        'input[type="text"][placeholder*="user" i]',
        'input[type="text"]',
      ]);
      if (usernameField) {
        usernameField.focus();
        setNativeValue(usernameField, username);
        filled = true;
      }
    }

    if (password) {
      const passwordField = findVisibleInput([
        'input[type="password"]',
        'input[autocomplete="current-password"]',
        'input[autocomplete="new-password"]',
      ]);
      if (passwordField) {
        passwordField.focus();
        setNativeValue(passwordField, password);
        filled = true;
      }
    }

    if (filled) showFillBadge();
    return filled;
  }

  // â”€â”€ Fill success badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function showFillBadge() {
    const existing = document.getElementById('sv-fill-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = 'sv-fill-badge';
    badge.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      display: flex; align-items: center; gap: 8px;
      background: ${BRAND.bg}; border: 1px solid ${BRAND.border};
      border-radius: ${BRAND.radius}; padding: 10px 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      font-family: ${BRAND.font}; animation: svSlideIn 0.2s ease;
    `;
    badge.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${BRAND.primary}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span style="font-size:13px; color:${BRAND.text}; font-weight:500;">Credentials filled by SecureVoult</span>
    `;

    injectAnimation();
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 3000);
  }

  // â”€â”€ Toast notification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function showToast(message) {
    const existing = document.getElementById('sv-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'sv-toast';
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483647;
      background: ${BRAND.bg}; border: 1px solid ${BRAND.border};
      border-radius: ${BRAND.radius}; padding: 12px 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5); max-width: 300px;
      font-family: ${BRAND.font}; font-size: 13px; color: ${BRAND.muted};
      animation: svSlideIn 0.2s ease;
    `;

    // Build the toast DOM safely â€” no innerHTML interpolation of external data
    const inner = document.createElement('div');
    inner.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';

    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '15');
    iconSvg.setAttribute('height', '15');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', BRAND.primary);
    iconSvg.setAttribute('stroke-width', '2');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');
    iconSvg.style.cssText = 'flex-shrink:0; margin-top:1px;';
    iconSvg.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';

    const textSpan = document.createElement('span');
    textSpan.style.color = BRAND.text;
    textSpan.textContent = String(message); // textContent â€” never innerHTML

    inner.appendChild(iconSvg);
    inner.appendChild(textSpan);
    toast.appendChild(inner);

    injectAnimation();
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // â”€â”€ Save-login prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let lastSubmittedCredentials = null;

  function showSaveLoginPrompt(username, password, domain) {
    const existing = document.getElementById('sv-save-prompt');
    if (existing) existing.remove();

    const prompt = document.createElement('div');
    prompt.id = 'sv-save-prompt';
    prompt.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      background: ${BRAND.bg}; border: 1px solid ${BRAND.border};
      border-radius: ${BRAND.radius}; padding: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.6); width: 300px;
      font-family: ${BRAND.font}; animation: svSlideIn 0.25s ease;
    `;
    prompt.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${BRAND.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style="font-size:13px; font-weight:600; color:${BRAND.text};">Save this login?</span>
        </div>
        <button id="sv-save-close" style="background:none; border:none; cursor:pointer; color:${BRAND.muted}; font-size:18px; line-height:1; padding:0;">&#215;</button>
      </div>
      <p style="font-size:12px; color:${BRAND.muted}; margin-bottom:12px;">
        <strong style="color:${BRAND.text};">${escapeHtml(domain)}</strong> &mdash; ${escapeHtml(username) || 'Unknown user'}
      </p>
      <div style="display:flex; gap:8px;">
        <button id="sv-save-deny" style="flex:1; padding:7px; background:transparent; border:1px solid ${BRAND.border}; border-radius:8px; color:${BRAND.muted}; font-size:12px; cursor:pointer;">Not now</button>
        <button id="sv-save-confirm" style="flex:2; padding:7px; background:${BRAND.primary}; border:none; border-radius:8px; color:#fff; font-size:12px; font-weight:600; cursor:pointer;">Save to vault</button>
      </div>
    `;

    injectAnimation();
    document.body.appendChild(prompt);

    document.getElementById('sv-save-close').onclick = () => {
      lastSubmittedCredentials = null; // clear credentials from memory on dismiss
      prompt.remove();
    };
    document.getElementById('sv-save-deny').onclick = () => {
      lastSubmittedCredentials = null; // clear credentials from memory on deny
      prompt.remove();
    };
    document.getElementById('sv-save-confirm').onclick = () => {
      chrome.runtime.sendMessage({
        action: 'saveLogin',
        data: { username, password, domain, url: window.location.href, title: document.title },
      });
      lastSubmittedCredentials = null; // clear immediately after handoff to background
      prompt.remove();
      showToast('Login saved â€” open SecureVoult to review it.');
    };

    // Auto-dismiss after 20 seconds
    setTimeout(() => { if (document.getElementById('sv-save-prompt')) prompt.remove(); }, 20000);
  }

  // â”€â”€ Login form detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function detectLoginForms() {
    const passwordFields = document.querySelectorAll('input[type="password"]:not([data-sv-detected])');
    passwordFields.forEach(field => {
      if (!(field instanceof HTMLInputElement)) return;
      field.dataset.svDetected = 'true';

      // Add subtle SecureVoult indicator inside the password field
      const wrapper = field.parentElement;
      if (!wrapper) return;
      const wrapperPos = window.getComputedStyle(wrapper).position;
      if (wrapperPos === 'static') wrapper.style.position = 'relative';

      const indicator = document.createElement('button');
      indicator.setAttribute('type', 'button');
      indicator.setAttribute('title', 'Fill with SecureVoult');
      indicator.setAttribute('aria-label', 'Fill with SecureVoult');
      indicator.style.cssText = `
        position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
        width: 20px; height: 20px; background: transparent; border: none;
        cursor: pointer; z-index: 100; padding: 0; display: flex;
        align-items: center; justify-content: center; opacity: 0.5;
        transition: opacity 0.15s;
      `;
      indicator.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${BRAND.primary}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      `;
      indicator.onmouseenter = () => { indicator.style.opacity = '1'; };
      indicator.onmouseleave = () => { indicator.style.opacity = '0.5'; };
      indicator.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast('Open the SecureVoult popup to fill credentials for this page.');
      };
      wrapper.appendChild(indicator);

      // Watch for form submission to offer save-login
      const form = field.closest('form');
      if (form && !form.dataset.svWatched) {
        form.dataset.svWatched = 'true';
        form.addEventListener('submit', () => {
          const usernameField = findVisibleInput([
            'input[type="email"]', 'input[autocomplete="username"]',
            'input[name="email"]', 'input[name="username"]',
            'input[id*="email"]', 'input[id*="user"]', 'input[type="text"]',
          ]);
          const submittedUsername = usernameField?.value?.trim();
          const submittedPassword = field.value;
          if (submittedPassword && submittedUsername) {
            lastSubmittedCredentials = { username: submittedUsername, password: submittedPassword };
            const domain = window.location.hostname.replace('www.', '');
            // Short delay so form submit completes before prompt appears
            setTimeout(() => {
              if (lastSubmittedCredentials) {
                showSaveLoginPrompt(submittedUsername, submittedPassword, domain);
              }
            }, 1200);
          }
        }, { once: true });
      }
    });
  }

  // â”€â”€ CSS animation injection (once) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function injectAnimation() {
    if (document.getElementById('sv-anim-style')) return;
    const style = document.createElement('style');
    style.id = 'sv-anim-style';
    style.textContent = `
      @keyframes svSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // â”€â”€ Bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  detectLoginForms();

  const observer = new MutationObserver(() => detectLoginForms());
  observer.observe(document.body, { childList: true, subtree: true });

  // Clear saved credentials if user navigates away
  window.addEventListener('pagehide', () => { lastSubmittedCredentials = null; });
})();
