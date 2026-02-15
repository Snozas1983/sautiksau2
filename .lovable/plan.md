

# Planas: "Pamiršau slaptažodį" funkcija admin prisijungimui

## Kaip tai veiks

1. Admin prisijungimo puslapyje `/admin` atsiras nuoroda **"Pamiršau slaptažodį"**
2. Paspaudus -- sistema išsiųs el. laišką su slaptažodžio atstatymo nuoroda į admin el. paštą (ausra.banys@gmail.com arba kas nustatyta `contact_email`)
3. Nuoroda nuves į `/admin/reset-password?token=xxx`
4. Ten bus forma su nauju slaptažodžiu (su tomis pačiomis validacijos taisyklėmis: 8+ simboliai, didžioji, mažoji, skaičius, spec. simbolis)
5. Pakeitus slaptažodį -- nukreips į prisijungimo puslapį

## Saugumas

- Reset token galioja **1 valandą**
- Token sunaudojamas po panaudojimo (vienkartinis)
- Token saugomas `settings` lentelėje kaip `password_reset_token` su galiojimo laiku
- Siunčiama tik į nustatytą admin el. paštą (ne į vartotojo įvestą)

## Techniniai pakeitimai

| Failas | Pakeitimas |
|--------|------------|
| `supabase/functions/airtable-proxy/index.ts` | 2 nauji endpoint'ai: `POST /admin/forgot-password` ir `POST /admin/reset-password` |
| `src/pages/Admin.tsx` | Pridėti "Pamiršau slaptažodį" mygtuką ir jo logiką |
| `src/pages/AdminResetPassword.tsx` | **Naujas failas** -- slaptažodžio atstatymo puslapis |
| `src/App.tsx` | Pridėti naują route `/admin/reset-password` |

### Backend endpoint'ai

**POST /admin/forgot-password**
- Sugeneruoja atsitiktinį token'ą (UUID)
- Išsaugo `settings` lentelėje: `password_reset_token` = `{token}:{expiry_timestamp}`
- Siunčia el. laišką su nuoroda per Resend API

**POST /admin/reset-password**
- Priima: `{ token, newPassword }`
- Patikrina ar token'as galioja ir nesukęs
- Validuoja naują slaptažodį
- Atnaujina `admin_password_hash` settings
- Ištrina reset token'ą

### Frontend

**Admin.tsx** -- pridedamas mygtukas "Pamiršau slaptažodį", kuris iškviečia `/admin/forgot-password`. Po sėkmingo išsiuntimo rodomas pranešimas "Nuoroda išsiųsta į el. paštą".

**AdminResetPassword.tsx** -- naujas puslapis su:
- Naujo slaptažodžio įvedimo laukas
- Pakartojimo laukas
- Realtime validacijos indikatoriai (kaip nustatymuose)
- Mygtukas "Pakeisti slaptažodį"
