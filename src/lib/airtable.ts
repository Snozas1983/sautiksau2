const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const AIRTABLE_PROXY_URL = `${SUPABASE_URL}/functions/v1/airtable-proxy`;

export async function airtableApi(
  endpoint: string, 
  options: RequestInit = {},
  adminPassword?: string
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
  
  if (adminPassword) {
    headers['x-admin-password'] = adminPassword;
  }
  
  const response = await fetch(`${AIRTABLE_PROXY_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }
  
  return response.json();
}
