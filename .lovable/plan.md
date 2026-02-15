

# Planas: Admin puslapis per sautiksau.lt/admin

## Problema
Kai naudotojas eina tiesiai į `sautiksau.lt/admin`, Hostinger serveris ieško realaus `/admin` katalogo ar failo. Kadangi tai yra SPA (Single Page Application), visi maršrutai turi būti nukreipti į `index.html`, o tada React Router parodo teisingą puslapį.

## Sprendimas
Sukurti `.htaccess` failą `public/` kataloge, kuris nukreips visus maršrutus į `index.html`. Hostinger naudoja Apache serverį, todėl `.htaccess` veiks.

## Failų pakeitimai

| Failas | Pakeitimas |
|--------|------------|
| `public/.htaccess` | Naujas failas - Apache perrašymo taisyklės SPA maršrutizavimui |

## Naujas failas: `public/.htaccess`

```
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

Ši konfigūracija:
- Jei failas realiai egzistuoja (CSS, JS, paveikslėliai) - grąžina jį tiesiogiai
- Jei failas neegzistuoja (pvz. `/admin`, `/admin/dashboard`, `/booking/abc`) - grąžina `index.html`
- React Router tada parodo teisingą puslapį

## Rezultatas
- `sautiksau.lt/admin` - veiks, rodys admin prisijungimo puslapį
- `sautiksau.lt/admin/dashboard` - veiks, rodys admin dashboard
- `sautiksau.lt/booking/xyz` - veiks, rodys rezervacijos valdymą
- Visi kiti puslapiai veiks kaip ir anksčiau

