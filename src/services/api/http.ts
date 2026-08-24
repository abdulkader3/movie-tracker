const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  readonly kind: 'offline' | 'http' | 'config' | 'parse' | 'timeout';

  constructor(message: string, kind: ApiError['kind'] = 'http') {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

export async function fetchJson<T>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError('No internet connection.', 'offline');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(
        `Timed out after ${Math.round((options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)}s.`,
        'timeout',
      );
    }
    throw new ApiError('Network request failed.', 'offline');
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status} ${response.statusText}`.trim(), 'http');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('Malformed JSON response.', 'parse');
  }
}
