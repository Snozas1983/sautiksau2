

# Planas: Admin el. pašto keitimas ir slaptažodžio valdymas

## 1. Pakeisti numatytąjį admin el. paštą

Pakeisti `contact_email` numatytąją reikšmę iš `info@sautiksau.lt` į `ausra.banys@gmail.com` faile `SettingsTab.tsx`.

## 2. Slaptažodžio keitimo funkcionalumas

### Slaptažodžio reikalavimai:
- Minimalus ilgis: **8 simboliai**
- Bent **1 didžioji raidė** (A-Z)
- Bent **1 mažoji raidė** (a-z)
- Bent **1 skaičius** (0-9)
- Bent **1 specialus simbolis** (!@#$%^&* ir pan.)

### Failų pakeitimai:

| Failas | Pakeitimas |
|--------|------------|
| `src/components/admin/SettingsTab.tsx` | Pakeisti numatytąjį el. paštą + pridėti slaptažodžio keitimo sekciją |
| `supabase/functions/airtable-proxy/index.ts` | Pridėti `/admin/change-password` endpoint |

### A. Backend: Naujas endpoint `/admin/change-password`

Pridėti naują POST endpoint, kuris:
1. Patikrina seną slaptažodį
2. Validuoja naują slaptažodį pagal reikalavimus
3. Atnaujina `ADMIN_PASSWORD` secret per Supabase Management API (arba saugo settings lentelėje kaip hash)

Kadangi Deno Edge Functions negali tiesiogiai keisti secrets, slaptažodis bus saugomas `settings` lentelėje kaip papildomas įrašas (`admin_password_hash`). Tikrinimo logika bus atnaujinta: pirma tikrinti DB, jei nėra - tikrinti env secret.

```typescript
// POST /admin/change-password
if (path === '/admin/change-password' && req.method === 'POST') {
  const body = await req.json();
  const { currentPassword, newPassword } = body;
  
  // Verify current password
  if (!verifyAdminPassword(currentPassword)) {
    return error response;
  }
  
  // Validate new password
  // min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special
  
  // Save hashed password to settings table
  // Update verifyAdminPassword to check DB first
}
```

### B. Slaptažodžio hash'avimas

Naudosime `crypto.subtle` (Deno built-in) SHA-256 hash'avimui su salt, kad slaptažodis nebūtų saugomas atviru tekstu.

### C. Frontend: Slaptažodžio keitimo forma

Pridėti naują kortelę `SettingsTab.tsx` su:
- Dabartinis slaptažodis (input)
- Naujas slaptažodis (input)
- Pakartoti naują slaptažodį (input)
- Realtime validacijos indikatoriai:
  - ✓/✗ Mažiausiai 8 simboliai
  - ✓/✗ Bent viena didžioji raidė
  - ✓/✗ Bent viena mažoji raidė
  - ✓/✗ Bent vienas skaičius
  - ✓/✗ Bent vienas specialus simbolis
  - ✓/✗ Slaptažodžiai sutampa
- Mygtukas "Keisti slaptažodį"

Po sėkmingo pakeitimo - automatiškai atnaujinti session su nauju slaptažodžiu.

### D. Atnaujinta `verifyAdminPassword` funkcija

```typescript
async function verifyAdminPassword(password: string): Promise<boolean> {
  // First check if there's a hashed password in settings
  const { data } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'admin_password_hash')
    .single();
  
  if (data?.value) {
    // Compare with stored hash
    const [salt, hash] = data.value.split(':');
    const computedHash = await hashPassword(password, salt);
    return computedHash === hash;
  }
  
  // Fallback to env secret
  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  return password === adminPassword;
}
```

**Pastaba:** Kadangi `verifyAdminPassword` taps asinchronine funkcija, reikės atnaujinti visas jos iškvietimo vietas su `await`.

## Eiliškumas

1. Pakeisti el. paštą (greitas pakeitimas)
2. Pridėti backend endpoint su hash'avimu
3. Atnaujinti `verifyAdminPassword` į async
4. Pridėti frontend formą su validacija
5. Deploy edge function

