

# Planas: Sutvarkyti slaptažodžio atstatymo el. laiško pristatymą

## Problema

Kai paspaudžiate "Pamiršau slaptažodį", backend'as sėkmingai apdoroja užklausą (Resend API grąžina 200), bet el. laiškas nepasiekia gavėjo. Spam aplanke jo taip pat nėra.

## Pagrindinė priežastis

Laiškas siunčiamas **iš** `info@sautiksau.lt` **į** `info@sautiksau.lt` — t.y. pačiam sau. Daugelis el. pašto serverių (ypač Hostinger) tokius laiškus tiesiog atmeta arba ignoruoja, nes atrodo kaip spoofing.

## Sprendimas

### 1. Pakeisti siuntėjo adresą

Vietoj `from: 'info@sautiksau.lt'` naudoti `from: 'SauTikSau <noreply@sautiksau.lt>'` — tai standartinė praktika atstatymo laiškams.

### 2. Siųsti į asmeninį el. paštą

Pridėti naują nustatymą `admin_email` duomenų bazėje, kuris nurodytų tikrąjį admin el. paštą (pvz., `ausra.banys@gmail.com`). Slaptažodžio atstatymo laiškai bus siunčiami ten, o ne į `info@sautiksau.lt`.

### 3. Pridėti geresnį klaidų logavimą

Šiuo metu kodas tik tikrina `res.ok`, bet nelogoja Resend API atsakymo body. Pridėsime pilną atsakymo logavimą, kad ateityje būtų lengviau diagnozuoti.

## Techniniai pakeitimai

### Failas: `supabase/functions/airtable-proxy/index.ts`

1. Pakeisti `from` lauką iš `info@sautiksau.lt` į `SauTikSau <noreply@sautiksau.lt>`
2. Pakeisti gavėjo logiką: naudoti `admin_email` nustatymą (jei yra), kitaip `contact_email`
3. Pridėti Resend API response body logavimą tiek sėkmės, tiek klaidos atvejais

### Duomenų bazė: `settings` lentelė

Pridėti naują įrašą su `key = 'admin_email'` ir `value = 'ausra.banys@gmail.com'` (arba kitas jūsų asmeninis el. paštas).

## Veiksmai jums prieš tai

**Patikrinkite Resend paskyroje:**
1. Eikite į https://resend.com/domains
2. Patikrinkite ar `sautiksau.lt` domenas vis dar turi "Verified" statusą
3. Jei statusas "Pending" arba "Failed" — reikės atnaujinti DNS įrašus

Jei domenas verifikuotas — aš iškart atliksiu kodo pakeitimus ir el. laiškai pradės veikti.

