

# Google Calendar 403 Klaidos Sprendimo Planas

## Dabartinė Situacija

Jūs bandote susieti Lovable sistemą su Google Calendar, naudojant `ausra.banys@gmail.com` paskyrą, bet nuolat gaunate **403 klaidą** iš Google OAuth proceso. Problema išlieka net po to, kai atnaujinote:
- Google Cloud Console konfigūraciją (OAuth 2.0 Client ID, Redirect URI)
- `GOOGLE_CLIENT_ID` ir `GOOGLE_CLIENT_SECRET` secrets backend'e
- Publishing status iš "Testing" į "Published"

## Problemos Priežasties Diagnozė

### Pagal surinktus duomenis:

1. **Network Request Analysis**: Peržiūrėjau jūsų sistemos HTTP užklausas. `google-calendar-auth` edge funkcija veikia teisingai ir grąžina galiojantį `authUrl`:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=165157130388-...&redirect_uri=https%3A%2F%2Fgwjdijkbmesjoqmfepkc.supabase.co%2Ffunctions%2Fv1%2Fgoogle-calendar-callback&...
   ```

2. **Redirect URI**: Sistema generuoja šį redirect URI:
   ```
   https://gwjdijkbmesjoqmfepkc.supabase.co/functions/v1/google-calendar-callback
   ```

3. **403 Klaidos Tipas**: Jūs gavote bendrą Google pranešimą:
   > "403. That's an error. We're sorry, but you do not have access to this page."

   Tai reiškia, kad Google atmeta prieigą **prieš** autorizacijos screeną. Tai dažniausiai nutinka dėl **skirtumų tarp** Google Cloud Console konfigūracijos ir tai, ką sistema siunčia.

4. **Edge Function Logs**: `google-calendar-callback` funkcija **niekada nesulaukia request'ų**, nes Google blokuoja jūsų prieigą dar prieš redirect'ą. Tai patvirtina, kad problema yra **Google Cloud Console pusėje**, ne backend'e.

---

## Esminė Problema: Authorized Redirect URI Tikslumas

OAuth 403 klaida **dažniausiai** pasirodo dėl šių priežasčių:
1. **Netinkamas Authorized Redirect URI** Google Cloud Console
2. **Typo arba whitespace** Redirect URI lauke
3. **Multiple OAuth Clients** (senesnės versijos su blogais redirect URIs)
4. **Google Calendar API neaktyvuotas** (rečiau, bet tikėtina)

---

## Sprendimo Žingsniai

### 1. Patikrinkite Google Cloud Console Redirect URI (KRITINIS ŽINGSNIS)

**Eikite į:**
```
Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
→ Pasirinkite savo Client ID (165157130388-...) → Redaguokite
```

**Authorized redirect URIs sekcijoje PRIVALO būti TIKSLIAI šis URL:**
```
https://gwjdijkbmesjoqmfepkc.supabase.co/functions/v1/google-calendar-callback
```

**Patikrinkite:**
- ✅ Ar pradedasi `https://` (ne `http://`)?
- ✅ Ar baigiasi `/google-calendar-callback` (be trailing slash)?
- ✅ Ar nėra whitespace prieš arba po URL?
- ✅ Ar nėra typo (pvz., `function` vietoj `functions`)?

**Jei yra keli OAuth Client IDs:**
- Patikrinkite, ar naudojate **teisingą Client ID** (165157130388-hhmu938ojfu2nggl30ase3u1eu5he693)
- Jei turite senus client IDs su blogais redirect URI, **ištrinkite juos** arba atnaujinkite

**Po pakeitimų:**
- Spauskite **Save** ir **laukite 1-2 minutes**, kol Google paskelbia pakeitimus

---

### 2. Patikrinkite Google Calendar API aktyvaciją

**Eikite į:**
```
Google Cloud Console → APIs & Services → Library
→ Ieškokite "Google Calendar API" → Įsitikinkite, kad jis ENABLED
```

Jei neaktyvuotas:
- Spauskite **Enable**
- Laukite ~30 sekundžių, kol aktyvuojasi

---

### 3. Patikrinkite OAuth Consent Screen konfigūraciją

Kadangi jau perkėlėte į "Published" statusą, patikrinkite:

**Eikite į:**
```
Google Cloud Console → APIs & Services → OAuth consent screen
```

**Patikrinkite:**
- ✅ Publishing status: **In production** (jūs jau pakeistėte į Published, tai turėtų būti OK)
- ✅ User type: **External**
- ✅ Authorized domains: Turėtų būti `supabase.co` (jei ne, pridėkite)

**Scopes:**
Patikrinkite, ar pridėti šie scopes:
```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
```

---

### 4. Patikrinkite GOOGLE_CLIENT_ID ir GOOGLE_CLIENT_SECRET backend'e

Nors jūs jau perrašėte secrets, patikrinkime dar kartą:

**Backend secrets turi būti:**
- **GOOGLE_CLIENT_ID**: `165157130388-hhmu938ojfu2nggl30ase3u1eu5he693.apps.googleusercontent.com`
- **GOOGLE_CLIENT_SECRET**: [slaptažodis iš Google Cloud Console → Credentials → Client ID → "Client secret"]

**Kaip patikrinti:**
1. Eikite į Lovable Cloud backend (Settings → View Backend → Secrets)
2. Patikrinkite, ar `GOOGLE_CLIENT_ID` prasideda `165157130388-`
3. Patikrinkite, ar `GOOGLE_CLIENT_SECRET` nėra tuščias
4. Jei abejojate, **nukopijuokite iš naujo** iš Google Cloud Console ir perrašykite

---

### 5. Testuokite OAuth sraute

Po visų pakeitimų:
1. Palaukite **2-3 minutes**, kad Google paskelbtų naują konfigūraciją
2. Admin Dashboard → Settings → Google Calendar → Spauskite **"Susieti su Google Calendar"**
3. Jei vis dar gaunate 403:
   - Atidarykite naršyklės Developer Tools (F12)
   - Eikite į Network tab
   - Spauskite "Susieti su Google Calendar"
   - Peržiūrėkite redirect URL, kurį sistema generuoja
   - Nukopijuokite pilną URL ir palyginkite su tuo, ką turite Google Cloud Console

---

## Dažniausi 403 Scenarijai ir Sprendimai

### Scenarijus A: "redirect_uri_mismatch"
**Priežastis:** Google Cloud Console redirect URI nesutampa su tuo, ką sistema siunčia

**Sprendimas:**
1. Nukopijuokite tikslų redirect URI iš sistemos error pranešimo arba network request'o
2. Įklijuokite į Google Cloud Console → Authorized redirect URIs
3. Išsaugokite ir testuokite

---

### Scenarijus B: "access_denied" su pranešimu "The developer hasn't given you access"
**Priežastis:** App yra "Testing" mode, o `ausra.banys@gmail.com` nėra test users sąraše

**Sprendimas:**
✅ Jūs jau perkėlėte į "Published" → ši problema turėtų išnykti

---

### Scenarijus C: "This app is blocked"
**Priežastis:** Google nustato, kad app nėra patvirtintas (unverified)

**Sprendimas:**
1. Eikite į OAuth consent screen
2. Spauskite "Publish App"
3. Jei reikia, pridėkite domain verification arba testuokite su test users

---

## Ko NEDARYTI

❌ **Nekurkite naujo OAuth Client ID** – tai tik sukels daugiau painiavos
❌ **Nekeiskite SUPABASE_URL** – tai automatinis edge function parametras
❌ **Nekeiskite google-calendar-auth arba google-calendar-callback kodo** – jie veikia teisingai

---

## Techninis Kontekstas (Detali Architekūra)

### OAuth Flow Schema:

```text
1. [Admin Dashboard] 
   ↓ (User spauskite "Susieti")
   ↓
2. [google-calendar-auth Edge Function]
   ↓ (Generuoja authUrl su redirect_uri)
   ↓
3. [Google OAuth Page]
   ↓ (User autorizuoja)
   ↓ (Google redirects back)
   ↓
4. [google-calendar-callback Edge Function]
   ↓ (Exchangeina code → access_token)
   ↓ (Išsaugo google_calendar_tokens)
   ↓
5. [Admin Dashboard] (redirect su ?google_success=true)
```

### Kodėl 403 nutinka žingsnyje #3:

Google tikrina:
- Ar `client_id` egzistuoja?
- Ar `redirect_uri` yra whitelist'e (Authorized redirect URIs)?
- Ar user turi prieigą prie app (Testing vs Published)?

Jei NORS VIENA iš šių sąlygų nevykdoma → **403 error**.

---

## Papildomi Debuggingo Metodai

### Jei problema išlieka:

1. **Atidarykite Incognito/Private Window** ir testuokite iš naujo
   - Kartais cache arba cookies trikdo OAuth

2. **Testuokite su kitu Google account**
   - Jei veikia su kitu account, problema yra specifinė `ausra.banys@gmail.com` prieigai

3. **Patikrinkite Google Account Security Settings**
   - Eikite į https://myaccount.google.com/permissions
   - Patikrinkite, ar nėra blokuotų third-party apps

4. **Peržiūrėkite Google Cloud Console Audit Logs** (jei turite prieigą)
   - Logs → View Logs → Filtruokite OAuth errors
   - Tai parodys tikslią Google pusės klaidos priežastį

---

## Galutiniai Veiksmai

1. **Patikrinkite Google Cloud Console:**
   - Authorized redirect URIs: `https://gwjdijkbmesjoqmfepkc.supabase.co/functions/v1/google-calendar-callback`
   - Google Calendar API: Enabled
   - Publishing status: In production

2. **Patikrinkite backend secrets:**
   - GOOGLE_CLIENT_ID ir GOOGLE_CLIENT_SECRET teisingai įrašyti

3. **Testuokite:**
   - Palaukite 2-3 minutes po pakeitimų
   - Incognito window
   - Spauskite "Susieti su Google Calendar"

4. **Jei vis dar 403:**
   - Nukopijuokite pilną error pranešimą iš Google OAuth page
   - Peržiūrėkite network request'ą (F12 → Network tab)
   - Palyginkite redirect_uri iš request'o su Google Cloud Console konfigūracija

---

## Tikėtinas Rezultatas

Po šių žingsnių, kai viskas sutampa:
- Google OAuth puslapis turėtų parodyti **autorizacijos ekraną** (ne 403)
- Po "Allow", būsite nukreipti į `/admin/dashboard?google_success=true`
- Sistema parodys pranešimą "Google Calendar sėkmingai susietas!"
- Google Calendar status taps "Susietas" Settings tab'e

