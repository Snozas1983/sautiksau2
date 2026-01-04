const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const AIRTABLE_PROXY_URL = `${SUPABASE_URL}/functions/v1/airtable-proxy`;

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function normalizeFetchError(error: unknown): Error {
  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    return new Error('Nepavyko prisijungti prie serverio');
  }
  return error instanceof Error ? error : new Error('Nežinoma klaida');
}

export async function airtableApi(
  endpoint: string,
  options: RequestInit = {},
  adminPassword?: string
) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };

  // Only set content-type when we actually send a body
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (adminPassword) {
    // Use base64 UTF-8 to avoid invalid header value issues (e.g. non-ASCII chars)
    headers['x-admin-password-b64'] = base64EncodeUtf8(adminPassword);
  }

  let response: Response;
  try {
    response = await fetch(`${AIRTABLE_PROXY_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> | undefined),
      },
    });
  } catch (e) {
    throw normalizeFetchError(e);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');

    let message = text;
    try {
      const json = text ? JSON.parse(text) : null;
      if (json && typeof json === 'object' && 'error' in json) {
        message = String((json as any).error);
      }
    } catch {
      // ignore
    }

    throw new Error(message || `API error: ${response.status}`);
  }


  return response.json();
}

