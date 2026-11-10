# Context — ÎncăUnCapitol (carti.gherasimmarius.com)

*Document de orientare rapidă, pentru un chat nou. Pentru detalii tehnice complete, vezi `REMEMBER.md` și `REMEMBER-feed-uri.md` — atașează-le pe amândouă la începutul conversației noi.*

## Ce e proiectul

Site static (HTML/CSS/JS vanilla, fără build step) de afiliere cărți + rechizite școlare, găzduit pe GitHub Pages. Marius îl administrează singur, eu (Claude) construiesc/repar cod și scriu conținut de marketing.

## Structura pe scurt

- **Catalog principal** (`books.json`) — cărți curatoriate manual, 9 surse de scraping (libris, carturesti, humanitas, nemira etc.), preț actualizat automat zilnic prin GitHub Actions
- **Hub rechizite/manuale** — 7+ pagini separate (manuale-scolare, carti-copii, rechizite-papetarie etc.), populate din feed-uri XML/CSV de la 2Performant (libris, librarie.net, humanitas, carturesti, **cartepedia.ro — sursă nouă**), regenerare **manuală** prin `generate-catalog-from-feeds.cjs`
- **Pagini de campanie separate** (nu în hub-ul principal): `carti-parenting.html`, `carti-gandire-critica.html` + `top10-carti-gandire-critica.html` + `gandire-critica-lista-gratuita.html` (lead magnet cu poartă de email MailerLite)
- **Email marketing** — MailerLite, cont `1999265`, grup `ÎncaUnCapitol` (ID `191544829491021196`); emailuri narative pe carte (stil „ap!”, ultimele: Seneca, Carrie, Shining — Săptămâna Stephen King)
- **Analytics** — GA4 (`G-HS59YL4Y3D`) pe toate paginile; **Microsoft Clarity** (`ymwlhvvwpr`) instalat doar pe 4 din ~18 pagini — task deschis

## Ce e activ chiar acum (la data acestui rezumat)

- **Săptămâna Stephen King** — postări + emailuri, zi cu zi, verificate cu ediții românești reale (Nemira)
- **Săptămâna gândire critică** — 3 pagini live, formular MailerLite dedicat pentru automatizare (ID `198972489088369761`, distinct de formularul general al site-ului)
- **Microsoft Clarity** — instalat pe 4 pagini, rămân ~9-10 neatinse (listă exactă în `REMEMBER.md` secțiunea 14)

## Convenții de lucru esențiale (citește înainte să modifici cod)

1. **Verifică mereu fișierul curent al utilizatorului cu `diff` înainte să confirmi o schimbare** — de multe ori în acest proiect am pornit accidental de la o versiune veche din propriul meu istoric de livrări, regresând modificări făcute între timp. Cere fișierul „așa cum e acum”, nu presupune.
2. **Hook-uri de conținut:** cifre concrete + întrebări retorice, ton direct, nu „de reclamă”.
3. **Copyright:** niciodată nu reproduc versuri/text protejat; parafrazez, citez sub 15 cuvinte.
4. **GDPR/legal:** orice tracking nou (Clarity, alt tool) → trebuie adăugat și în `privacy.html`, lângă disclosure-ul GA4 existent.
5. **Feed-uri XML/CSV** — merge, nu suprascriere (identitate = link de afiliere). Detalii complete în `REMEMBER-feed-uri.md`.

## Task-uri deschise, în ordinea probabilă de relevanță

1. Microsoft Clarity pe restul paginilor
2. Automatizarea MailerLite pentru lead magnet-ul de gândire critică (formular gata, automatizarea încă neconfigurată complet)
3. Sediul social + imagine SAL reală în paginile legale (blocant pentru orice aplicație CSS/Merchant Center viitoare)
4. `npm audit` — 2 vulnerabilități neinvestigate
5. CSS (Comparison Shopping Service) — oportunitate discutată, neînceput (necesită restructurare de date, vezi `REMEMBER.md` secțiunea 12)

## Cum reiei conversația

Atașează `REMEMBER.md` + `REMEMBER-feed-uri.md` + acest fișier, spui pe ce vrei să lucrezi, și continuăm fără să repetăm tot istoricul.
