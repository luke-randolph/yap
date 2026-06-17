/**
 * The error envelope every REST response uses on failure. The API's
 * HttpExceptionFilter normalizes all errors to this shape, and clients can
 * rely on it when reading a thrown fetch error's `data`.
 */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/**
 * Extract the normalized error payload from a thrown fetch error.
 *
 * ofetch/$fetch attach the parsed response body to the error's `data`
 * property, so this is the single typed boundary for reading server errors on
 * the client. Returns `null` when the error doesn't carry an `ApiErrorBody`
 * (e.g. network failures or non-API errors).
 */
export function getApiError(e: unknown): ApiErrorBody['error'] | null {
  return (e as { data?: ApiErrorBody })?.data?.error ?? null;
}
