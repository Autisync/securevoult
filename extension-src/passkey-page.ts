/**
 * SecureVoult — passkey bridge, running in the page itself (MAIN world).
 *
 * Wraps navigator.credentials.create/get. When a site asks for a passkey,
 * the request goes to SecureVoult's content script, which asks you first
 * ("Save a passkey for example.com?" / "Sign in with SecureVoult?"). Choosing
 * "Use another device" hands the request to the browser as normal.
 *
 * Nothing secret ever lives here: the key pair is made and used by the
 * extension's background worker, and the page only receives what a website
 * gets from any passkey.
 */
(() => {
  const w = window as unknown as { __svPasskeys?: boolean };
  if (w.__svPasskeys || !window.isSecureContext || !navigator.credentials) return;
  w.__svPasskeys = true;
  // SecureVoult's own site uses the browser's passkeys for signing in to SecureVoult.
  try { if (location.hostname === new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://vault.autisync.com').hostname) return; } catch { /* no app address */ }

  const CHANNEL = 'securevoult-passkey';
  const creds = navigator.credentials;
  const nativeCreate = creds.create.bind(creds);
  const nativeGet = creds.get.bind(creds);

  const b64 = (b: ArrayBuffer | ArrayBufferView): string => {
    const u = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    let s = '';
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64 = (s: string): ArrayBuffer => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  };

  /** Options → plain JSON (binary as base64url), dropping things that can't be posted. */
  const plain = (v: unknown): unknown => {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return { $b: b64(v as ArrayBuffer) };
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) if (k !== 'signal' && typeof x !== 'function') o[k] = plain(x);
      return o;
    }
    return v;
  };

  let seq = 0;
  /** Asks SecureVoult; if it doesn't answer within a second (not loaded, or not on this page), the browser handles it. */
  const ask = (kind: 'create' | 'get', publicKey: unknown): Promise<any> => new Promise((resolve) => {
    const id = `${Date.now().toString(36)}.${++seq}.${Math.random().toString(36).slice(2)}`;
    const noAnswer = setTimeout(() => { window.removeEventListener('message', onReply); resolve({ fallback: true }); }, 1200);
    const onReply = (e: MessageEvent) => {
      if (e.source !== window || e.data?.channel !== CHANNEL || e.data.id !== id) return;
      if (e.data.dir === 'ack') { clearTimeout(noAnswer); return; }
      if (e.data.dir !== 'reply') return;
      clearTimeout(noAnswer);
      window.removeEventListener('message', onReply);
      resolve(e.data.result);
    };
    window.addEventListener('message', onReply);
    window.postMessage({ channel: CHANNEL, dir: 'ask', id, kind, publicKey: plain(publicKey) }, location.origin);
  });

  const define = (o: object, props: Record<string, unknown>) => {
    for (const [k, value] of Object.entries(props)) Object.defineProperty(o, k, { value, enumerable: true, configurable: true });
    return o;
  };

  function credential(r: any): PublicKeyCredential {
    const isCreate = !!r.attestationObject;
    const protoResp = isCreate ? (window as any).AuthenticatorAttestationResponse?.prototype : (window as any).AuthenticatorAssertionResponse?.prototype;
    const response = Object.create(protoResp ?? Object.prototype);
    const json: Record<string, unknown> = { clientDataJSON: r.clientDataJSON };
    if (isCreate) {
      define(response, {
        clientDataJSON: unb64(r.clientDataJSON),
        attestationObject: unb64(r.attestationObject),
        getTransports: () => ['hybrid', 'internal'],
        getAuthenticatorData: () => unb64(r.authenticatorData),
        getPublicKey: () => unb64(r.publicKey),
        getPublicKeyAlgorithm: () => -7,
      });
      Object.assign(json, { attestationObject: r.attestationObject, authenticatorData: r.authenticatorData, transports: ['hybrid', 'internal'], publicKey: r.publicKey, publicKeyAlgorithm: -7 });
    } else {
      define(response, {
        clientDataJSON: unb64(r.clientDataJSON),
        authenticatorData: unb64(r.authenticatorData),
        signature: unb64(r.signature),
        userHandle: r.userHandle ? unb64(r.userHandle) : null,
      });
      Object.assign(json, { authenticatorData: r.authenticatorData, signature: r.signature, userHandle: r.userHandle ?? undefined });
    }
    const ext = r.extensions ?? {};
    const cred = Object.create((window as any).PublicKeyCredential?.prototype ?? Object.prototype);
    define(cred, {
      id: r.id,
      rawId: unb64(r.id),
      type: 'public-key',
      authenticatorAttachment: 'cross-platform',
      response,
      getClientExtensionResults: () => ext,
      toJSON: () => ({ id: r.id, rawId: r.id, type: 'public-key', authenticatorAttachment: 'cross-platform', response: json, clientExtensionResults: ext }),
    });
    return cred as PublicKeyCredential;
  }

  const fail = (e: { name?: string; message?: string }) => new DOMException(e.message ?? 'The operation failed.', e.name ?? 'NotAllowedError');

  creds.create = async function (options?: CredentialCreationOptions) {
    if (!options?.publicKey) return nativeCreate(options);
    const r = await ask('create', options.publicKey);
    if (!r || r.fallback) return nativeCreate(options);
    if (r.error) throw fail(r.error);
    return credential(r.credential);
  } as typeof creds.create;

  creds.get = async function (options?: CredentialRequestOptions) {
    // Passkey autofill in the username box stays with the browser.
    if (!options?.publicKey || (options as { mediation?: string }).mediation === 'conditional') return nativeGet(options);
    const r = await ask('get', options.publicKey);
    if (!r || r.fallback) return nativeGet(options);
    if (r.error) throw fail(r.error);
    return credential(r.credential);
  } as typeof creds.get;
})();
