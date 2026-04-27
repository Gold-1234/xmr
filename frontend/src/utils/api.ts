const DEFAULT_BACKEND_URL = 'http://localhost:5001';

export function getBackendUrl(): string {
  const configuredUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocalhost && port === '5001') {
      return origin;
    }

    if (isLocalhost) {
      return `${protocol}//${hostname}:5001`;
    }
  }

  return DEFAULT_BACKEND_URL;
}

export const backendUrl = getBackendUrl();

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Server returned an unexpected response (${response.status})`);
  }
}

export function formatRequestError(error: unknown, action: string): Error {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return new Error(`Cannot ${action}. Backend server is not reachable at ${backendUrl}.`);
  }

  return error instanceof Error ? error : new Error(`Cannot ${action}.`);
}
