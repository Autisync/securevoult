/** Hands a scanned QR code from the scan screen back to the form that opened it. */
type Listener = (value: string) => void;
let listener: Listener | null = null;

export function onScanned(fn: Listener): () => void {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function deliverScan(value: string): void {
  listener?.(value);
}
