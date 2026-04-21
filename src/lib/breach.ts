/**
 * HaveIBeenPwned k-anonymity password breach check.
 *
 * Security model:
 *  - Only the first 5 characters of the SHA-1 hash are sent to the API.
 *  - The remaining hash suffix is compared locally — the full password hash
 *    (and therefore the password itself) never leaves the device.
 *  - This is the same k-anonymity model used by 1Password, Firefox Monitor, etc.
 *
 * API docs: https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange
 */

/** SHA-1 hash a string and return the hex digest (uppercase). */
async function sha1Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export interface BreachResult {
  breached: boolean;
  count: number;        // number of times seen in breach data (0 = not found)
  error?: string;       // set if the API call failed
}

/**
 * Check a single password against the HIBP Pwned Passwords API.
 * Returns how many times it has appeared in known data breaches.
 */
export async function checkPasswordBreach(password: string): Promise<BreachResult> {
  if (!password) return { breached: false, count: 0 };

  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          // Prevents timing-side-channel leakage by padding all responses to the same size
          'Add-Padding': 'true',
        },
        // Short timeout — don't block the UI
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return { breached: false, count: 0, error: `HIBP API returned ${response.status}` };
    }

    const text = await response.text();
    const lines = text.split('\r\n').filter(Boolean);

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const lineSuffix = line.slice(0, colonIdx);
      const count = parseInt(line.slice(colonIdx + 1), 10);
      if (lineSuffix === suffix) {
        return { breached: count > 0, count };
      }
    }

    return { breached: false, count: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    // AbortError = timeout, treat as network error
    return { breached: false, count: 0, error: msg };
  }
}

/**
 * Check multiple passwords in parallel (with concurrency limit to avoid rate-limiting).
 * Returns a map of password → BreachResult.
 */
export async function checkMultiplePasswords(
  passwords: string[],
  onProgress?: (done: number, total: number) => void,
  concurrency = 4
): Promise<Map<string, BreachResult>> {
  const results = new Map<string, BreachResult>();
  const unique = Array.from(new Set(passwords.filter(Boolean)));
  let done = 0;

  // Process in batches to limit concurrent requests
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(pw => checkPasswordBreach(pw)));
    batch.forEach((pw, idx) => {
      results.set(pw, batchResults[idx]);
    });
    done += batch.length;
    onProgress?.(done, unique.length);
  }

  return results;
}
