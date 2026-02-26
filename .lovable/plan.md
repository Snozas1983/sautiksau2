
# Sutvarkyti slaptažodžio atstatymo el. laisko pristatyma

## Problema

Slaptazodzio atstatymo laiskas siunciamas is `info@sautiksau.lt` i `info@sautiksau.lt` (ta pati adresa). Hostinger el. pasto serveris tokius laiskus atmeta.

## Sprendimas

### 1. Prideti `admin_email` nustatyma duomenu bazeje

Ideti nauja irasa i `settings` lentele:
- `key = 'admin_email'`
- `value = 'ausra.banys@gmail.com'`

Tai bus el. pastas, i kuri ateis slaptazodzio atstatymo nuoroda.

### 2. Pakeisti el. laisko siuntimo logika (airtable-proxy)

Faile `supabase/functions/airtable-proxy/index.ts`:

- **Siuntejas**: pakeisti is `info@sautiksau.lt` i `SauTikSau <noreply@sautiksau.lt>`
- **Gavejas**: naudoti `admin_email` nustatyma (jei yra), kitaip `contact_email`
- **Logavimas**: prideti pilna Resend API atsakymo body logavima

### Techniniai pakeitimai

**Duomenu baze** (SQL migracija):
```text
INSERT INTO settings (key, value)
VALUES ('admin_email', 'ausra.banys@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = 'ausra.banys@gmail.com';
```

**Edge funkcija** (`supabase/functions/airtable-proxy/index.ts`):

1. Eilute ~863: prideti `admin_email` nuskaityma is settings
2. Eilute ~921: pakeisti `from: 'info@sautiksau.lt'` i `from: 'SauTikSau <noreply@sautiksau.lt>'`
3. Eilute ~922: pakeisti `to: [contactEmail]` i `to: [adminEmail]` (kur adminEmail = settings['admin_email'] || contactEmail)
4. Eilutes ~928-933: prideti response body logavima (`await res.text()` ir sekmes, ir klaidos atvejais)
5. Failover siuntejui (eilutes ~939-960): taip pat atnaujinti gaveja ir logavima

Rezultatas: slaptazodzio atstatymo laiskas bus siunciamas i `ausra.banys@gmail.com`, o ne i `info@sautiksau.lt`.
