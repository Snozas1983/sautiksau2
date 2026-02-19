

# Planas: Sutvarkyti deployment'ą į sautiksau.lt

## Problema

GitHub Actions workflow #23 "Add forgot/reset password flow" nepavyko vasario 15 d. Po to daugiau jokiu nauju commit'u i GitHub nebuvo nusiusta, todel sautiksau.lt vis dar rodo sena versija be "Pamirsa slaptazodi" mygtuko.

Kodas Lovable aplinkoje yra pilnai teisingas ir veikiantis -- problema tik su deployment pipeline.

## Sprendimas

### 1. Patikrinti klaidos priezasti

Pirmiausia reikia suzinoti, kas tiksliai sukele build klaida. Tam reikia:

- Eiti i GitHub: https://github.com/Snozas1983/sautiksau2/actions/runs/22033743764
- Prisijungti prie GitHub paskyros
- Paspauti ant "build-and-deploy" job'o
- Perskaityti klaidos zinute (error log)

Galimos priezastys:
- **Truksta GitHub Secrets** -- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `FTP_SERVER`, `FTP_USERNAME` arba `FTP_PASSWORD` gali buti nesustatyti
- **Build klaida** -- nors kodas atrodo teisingas, gali buti npm install problema
- **FTP klaida** -- Hostinger FTP prisijungimo duomenys gali buti pasenesie

### 2. Patikrinti GitHub Secrets

Eiti i GitHub repozitorija: Settings -> Secrets and variables -> Actions. Patikrinti ar visi 5 secrets yra nustatyti:

| Secret | Kam reikalingas |
|--------|----------------|
| `VITE_SUPABASE_URL` | Supabase projekto URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `FTP_SERVER` | Hostinger FTP serveris |
| `FTP_USERNAME` | Hostinger FTP vartotojas |
| `FTP_PASSWORD` | Hostinger FTP slaptazodis |

### 3. Paleisti is naujo

Kai problema bus isspesta, galima:
- **Variantas A**: GitHub Actions puslapyje paspausti "Re-run all jobs" ant nepavykusio workflow #23
- **Variantas B**: Padaryti maza pakeitima Lovable, kuris suaktyvins nauja push i GitHub ir nauja deployment'a

### 4. Kas bus po sekmingo deployment'o

Kai build sekmingai praeis, sautiksau.lt/admin puslapyje atsiras:
- "Pamirsa slaptazodi" nuoroda po prisijungimo formos
- Slaptazodzio atstatymo puslapis /admin/reset-password

## Veiksmai jums

1. **Atidarykite** https://github.com/Snozas1983/sautiksau2/actions/runs/22033743764 (prisijunge prie GitHub)
2. **Perskaitykite** klaidos zinute ir pasidalinkite ja su manimi
3. Arba tiesiog **patikrinkite** GitHub Secrets (Settings -> Secrets) -- jei truksta kurio nors, tai bus priezastis

Kai suziniosime klaidos priezasti, galesiu padeti ja istaisyti.

