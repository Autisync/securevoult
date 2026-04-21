/**
 * Shared API error response builder.
 *
 * All API routes should use `apiError()` for error responses so that the
 * client always gets a consistent shape:
 *   { error, code, message, details? }
 *
 * Internal error details (stack traces, DB errors) are stripped in
 * production — only the safe `message` field is returned.
 */
import { NextResponse } from 'next/server';

export interface ApiErrorBody {
  error: true;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Build a structured JSON error response.
 *
 * @param status  HTTP status code
 * @param code    Machine-readable error code (e.g. 'unauthorized', 'not_found')
 * @param message Human-readable message safe to display
 * @param details Optional extra data (omitted in production)
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: true, code, message };

  // Only include details in development to avoid leaking internals
  if (details !== undefined && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

// ── Convenience shorthands ───────────────────────────────────────────────────

export const unauthorized = (message = 'Authentication required') =>
  apiError(401, 'unauthorized', message);

export const forbidden = (message = 'Access denied') =>
  apiError(403, 'forbidden', message);

export const notFound = (message = 'Resource not found') =>
  apiError(404, 'not_found', message);

export const badRequest = (message: string, details?: unknown) =>
  apiError(400, 'bad_request', message, details);

export const conflict = (message: string, details?: unknown) =>
  apiError(409, 'conflict', message, details);

export const tooManyRequests = (retryAfterSeconds: number) =>
  NextResponse.json(
    { error: true, code: 'rate_limited', message: 'Too many requests. Please try again later.' } satisfies ApiErrorBody,
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );

export const serviceUnavailable = (message = 'Service temporarily unavailable. Please try again later.') =>
  apiError(503, 'service_unavailable', message);

export const internalError = (message = 'An unexpected error occurred') =>
  apiError(500, 'internal_error', message);
