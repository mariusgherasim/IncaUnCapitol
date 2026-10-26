# REMEMBER — ÎncăUnCapitol (carti.gherasimmarius.com)

Document unic de referință pentru site: ce conține, de unde vin produsele, cum se actualizează zilnic, ce s-a rezolvat și ce a rămas de făcut. Înlocuiește vechile `REMEMBER.md` și `REMEMBER-feed-uri.md`, care pot fi șterse.

**Actualizat: 21 octombrie 2026.**

---

## 1. Pe scurt: actualizarea zilnică (manuală)

Toate fișierele de lucru stau pe calculator, în:

```
C:\FOLDER DE LUCRU\PAUL MELINTE\SITE VANZARI - AFILIERE\site carti cu 3 fisiere
```

**Pași, în fiecare zi:**

1. Descarci cele 23 de feed-uri din 2Performant (lista în secțiunea 5) și le pui în folder. Nu le redenumești. Dacă există mai multe descărcări ale aceluiași feed (`feed_x.xml`, `feed_x_1.xml`), scriptul o ia automat pe cea mai nouă.
2. (Din când în când, ex. o dată pe săptămână) actualizezi prețurile cărților ACT și Politon: `node update-prices.js` (secțiunea 8).
3. Rulezi sync-ul și urci fișierele JSON:

```
cd /d "C:\FOLDER DE LUCRU\PAUL MELINTE\SITE VANZARI - AFILIERE\site carti cu 3 fisiere"
node --max-old-space-size=6000 sync-carti-feeds.cjs
git add books.json carti-copii-1.json carti-copii-2.json carti-copii-3.json manuale-scolare.json manuale-scolare-2.json materii-suplimentare.json rechizite-papetarie.json articole-scolare-accesorii.json articole-scolare-jocuri.json oferte-carti-scolare.json carti-parenting.json muzica-film-1.json muzica-film-2.json
git commit -m "Actualizare produse"
git push
```

4. Verifici la finalul rulării:
   - rândul fiecărui fișier: „X → Y produse | +noi | −dispărute”;
   - linia „📦 Mărimi”: toate fișierele sub 10.000 KB;
   - avertismentele „⚠️”: feed lipsă, feed vechi, prag de siguranță depășit;
   - dacă pragul de siguranță a fost depășit, scriptul afișează la final produsele dispărute și întreabă „Le scot? (da/nu)”. Verifici feed-ul manual și răspunzi. Cu `--scoate-tot` le scoate fără întrebare.

**Reguli:**
- **Niciodată `git add .` sau `git add *.json`.** Fișierele se numesc explicit, ca feed-urile, scriptul, `sync-report.json` și backup-urile să rămână doar local.
- **Dacă `git push` e refuzat:** între timp s-a modificat ceva pe GitHub (ex. un fișier urcat direct de pe site). Rulezi `git pull --rebase --autostash`, apoi din nou `git push`.
  - Conflict la `books.json`: `git checkout --theirs books.json` (în timpul unui rebase, „theirs” = versiunea locală), verifici că are cărțile noi, apoi `git add books.json` și `git -c core.editor=true rebase --continue`.
  - „untracked working tree files would be overwritten” (ex. poze urcate și pe GitHub, și în folder): muți pozele locale temporar într-un alt folder, apoi `git pull`.
  - Dacă urci ceva direct pe GitHub, rulează `git pull` în folder înainte de următorul sync.
- **Eroare „heap out of memory”:** pui `8000` în loc de `6000` (dacă PC-ul are 16 GB RAM). Feed-urile adunate au acum peste 700 MB.

**Fără automatizare:** actualizarea se face doar manual (decizia utilizatorului, 14.10.2026). `actualizeaza-zilnic.bat`, `instaleaza-task-zilnic.bat` și `feed-urls.txt` au fost șterse pe 20.10.2026: nu puteau răspunde la întrebarea „da/nu” a sync-ului, nu rulau `update-prices.js` și căutau feed-urile în alt folder.

---

## 2. Ce este site-ul

Site static (HTML + CSS + JS vanilla, fără framework, fără build step) de afiliere cu cărți și produse conexe:

- **Catalogul principal de cărți**, curatoriat manual: `books.json` (133 de cărți), plus „recomandarea lunii” din `monthly-book.json`;
- **Hub-ul de catalog din feed-uri**: cărți pentru copii, manuale, materii suplimentare, rechizite, accesorii, jocuri, oferte, parenting (~81.000 de produse);
- **Muzică și film**: ~18.000 de albume și filme, cu mostre audio Deezer;
- **Pagini de campanie** (sales pages) pentru reduceri punctuale;
- **Bannere** de afiliere (`banners.json`).

| | |
|---|---|
| Live | https://carti.gherasimmarius.com/ |
| Repo | https://github.com/mariusgherasim/IncaUnCapitol |
| Hosting | GitHub Pages (sursă: GitHub Actions) |
| GA4 | `G-HS59YL4Y3D` (comun cu celelalte site-uri gherasimmarius.com) |
| Microsoft Clarity | `ymwlhvvwpr` |
| MailerLite | cont `1999265` |
| 2Performant | `aff_code=676a7e7d9` |
| Pagina de Facebook | https://www.facebook.com/profile.php?id=61591238904271 |

---

## 3. Fișiere: ce e pe GitHub și ce stă doar local

### Pe GitHub (repo)

```
index.html, style.css, script.js
privacy.html, termeni.html, robots.txt, sitemap.xml, llms.txt
google5f466722dddce35e.html          ← verificare Search Console
books.json, monthly-book.json, banners.json, promo.json   ← promo.json: cardurile de ofertă (secțiunea 9)
update-prices.js + lib/ + test-scrapers.js + package.json   ← prețurile ACT și Politon din books.json, rulat local (secțiunea 8)
generate-carti-email.cjs              ← email „grilă” din books.json
.github/workflows/static.yml          ← deploy pe Pages la fiecare push

Pagini de catalog + date (secțiunea 4):
carti-copii.html          + carti-copii-1.json, carti-copii-2.json, carti-copii-3.json
manuale-scolare.html      + manuale-scolare.json, manuale-scolare-2.json
materii-suplimentare.html + materii-suplimentare.json
rechizite-papetarie.html  + rechizite-papetarie.json
articole-scolare-accesorii.html + .json
articole-scolare-jocuri.html    + .json
oferte-carti-scolare.html + .json
carti-parenting.html      + .json
muzica-film.html          + muzica-film-1.json, muzica-film-2.json

Pagini de campanie (secțiunea 10), pagini gândire critică, top10-*.html
imagini/   ← coperți, og-*.jpg, bannere, sal-badge.png, deezer-logo.png
```

`rechizite.json` (versiune veche, mică) nu mai e folosit de nicio pagină și se poate șterge.

### Doar local (NU se urcă)

- feed-urile XML (`feed_*.xml`);
- `sync-carti-feeds.cjs`;
- `sync-report.json` (se regenerează la fiecare rulare);
- `backup-feed-sync\<data-ora>\` (se păstrează ultimele 7);
- `node_modules\` (pachetele pentru `update-prices.js`, instalate cu `npm install`);
- CSV-urile de lucru (`oferte-inlocuiri-carturesti.csv` etc.).

`generate-catalog-from-feeds.cjs` e vechi, înlocuit de sync, și se poate șterge.

---

## 4. Paginile de catalog și fișierele JSON

Fiecare pagină e un „shell” generic: `#catalogContainer` cu `data-json-file="x.json"` sau, la mai multe fișiere, `data-json-files="a.json,b.json"`. `script.js` (`initGenericCatalogPage`) le încarcă și le combină. Opțional, `data-filter-field="genre"` activează butoanele de filtrare (folosit la muzică).

| Fișier JSON | Pagina | Surse | Produse (14.10.2026) |
|---|---|---|---|
| `carti-copii-1.json` | carti-copii.html | libris | 13.541 |
| `carti-copii-2.json` | carti-copii.html | cartepedia, libhumanitas, libris, librarie.net, Corint (+~220 din 20.10), Gama (+~810 din 21.10) | 10.126 |
| `carti-copii-3.json` | carti-copii.html | grupdzc | 9.149 |
| `manuale-scolare.json` | manuale-scolare.html | libris, cartepedia, librarie.net, libhumanitas, Corint (+~290 din 20.10), Gama (+~56) | 9.083 |
| `manuale-scolare-2.json` | manuale-scolare.html | grupdzc (inclusiv „Pedagogie”) | 9.639 |
| `materii-suplimentare.json` | materii-suplimentare.html | cartepedia, libhumanitas, libris, grupdzc, Corint (+~30) | 3.451 |
| `rechizite-papetarie.json` | rechizite-papetarie.html | carturesti, grupdzc | 6.402 |
| `articole-scolare-accesorii.json` | articole-scolare-accesorii.html | carturesti, libris, librarie.net, libhumanitas, grupdzc, Gama (+7 jurnale) | 6.846 |
| `articole-scolare-jocuri.json` | articole-scolare-jocuri.html | libris, carturesti, brickplanet, libhumanitas, cartepedia, librarie.net, grupdzc, Gama (+~78) | 9.620 |
| `oferte-carti-scolare.json` | oferte-carti-scolare.html | libris, libhumanitas, cartepedia, librarie.net (fostele cărți Cărturești, secțiunea 11) | 901 |
| `carti-parenting.json` | carti-parenting.html | libris, carturesti, libhumanitas, edituratrei, curteaveche, grupdzc, Corint (+10), Gama (+17) | 1.431 |
| `muzica-film-1.json` | muzica-film.html | carturesti (Rock, Pop, Alternative, Folk, Rap, R&B, Electro, Reggae, Latin) | 10.546 |
| `muzica-film-2.json` | muzica-film.html | carturesti (Clasică, Jazz, Soundtrack, Românească, restul genurilor + filme) | 7.447 |

**Limita: 10.000 KB pe fișier.** Cel mai mare e `carti-copii-1.json` (~7.650 KB). Peste limită, sync-ul salvează compact (~30% mai mic); dacă tot depășește, avertizează. Soluția e mereu încă un fișier `-N.json` adăugat în `data-json-files` al paginii.

**Format produs (feed):** `title`, `brand` (autor sau brand), `sourceSite`, `productUrl` (sau `productId` la feed-urile fără URL), `affiliate`, `image`, `category`, `price` („48,00 Lei”), opțional `oldPrice` și `discount` („20%”). La muzică, în plus: `genre`, `vinyl`, `ean`.

**Cifrele de pe cardurile din `index.html`** („peste 8.900 produse”) sunt scrise de mână, rotunjite în jos, și NU se actualizează la sync. Ultima actualizare: 21.10.2026 (manuale 19.000, copii 33.700, jocuri 8.900, calculate cu Corint + Gama).

---

## 5. Feed-urile 2Performant

Toate feed-urile de mai jos sunt citite. Toate actualizează prețul, linkul și imaginea produselor existente pe care le conțin; produse noi se adaugă doar din categoriile din `REGULI` (secțiunea 6).

| Feed | Magazin / conținut | Mărime |
|---|---|---|
| `feed_78ad15be7.xml` | libris, feed complet | ~160 MB |
| `feed_30725b952.xml` | libris, cărți în română (inclus în cel complet) | ~120 MB |
| `feed_0c722f7a4.xml` | libris, cărți pentru copii (inclus) | ~24 MB |
| `feed_5d7d1b9bc.xml` | libris, accesorii și cadouri (inclus) | ~5 MB |
| `feed_23ed00784.xml` | libris, eBooks (doar parenting) | ~11 MB |
| `feed_e82be0de9.xml` | libhumanitas, feed complet | ~70 MB |
| `feed_bfb296a3b.xml` | cartepedia, cărți și jocuri în stoc | ~38 MB |
| `feed_dbcb0e675.xml` | cartepedia, cărți în stoc | ~35 MB |
| `feed_f70ce214f.xml` | cartepedia, cărți pentru copii în stoc | ~10 MB |
| `feed_198b495ca.xml` | cartepedia, cărți educaționale în stoc | ~3 MB |
| `feed_d399be9e5.xml` | librarie.net, Top 10.000 | ~3 MB |
| `feed_f23ec2538.xml` | librarie.net, Top 100 (inclus în Top 10.000) | <1 MB |
| `feed_d861df8a1.xml` | carturesti, Back to School 2026 (campanie încheiată, secțiunea 11) | ~9 MB |
| `feed_6ea72c5a4.xml` | carturesti, „Carte în limba română” (15.000) | ~30 MB |
| `feed_02a848b11.xml` | carturesti, 3.000 de produse hobby/jocuri/fashion | ~5 MB |
| `feed_952ab47b2.xml` | carturesti, „Muzică și film” (CD, vinil, DVD) — adăugat 13.10.2026 | ~25 MB |
| `feed_7bd1c15b9.xml` | Editura Trei | ~7 MB |
| `feed_0ab2094f6.xml` | Curtea Veche | ~3 MB |
| `feed_5b10a2be9.xml` | Nemira | ~2 MB |
| `feed_3dd5a1fd2.xml` | brickplanet.ro (LEGO) — adăugat 12.10.2026 | ~2 MB |
| `feed_0b61412e9.xml` | grupdzc.ro, feed complet (~56.700 produse) — adăugat 14.10.2026 | ~100 MB |
| `feed_8289d9f33.xml` | Editura Corint (edituracorint.ro), feed complet (~1.280 cărți) — adăugat 20.10.2026 | ~3 MB |
| `feed_bd91e5f46.xml` | Editura Gama (edituragama.ro), feed complet (~1.320 produse pentru copii, ~970 active) — adăugat 21.10.2026 | ~2 MB |

**Ignorat intenționat:** `feed_09200f7e9` (printrecarti.ro, anticariat — decizia utilizatorului).

**Coduri de campanie** (`campaign_unique` în linkurile de afiliere): libris `9a6f02fef`, librarie.net `da1148931`, carturesti `07b5f0fed`, cartepedia `6f33f2a39`, libhumanitas `9aab15f10`, curteaveche `f9db13aad`, nemira `9617003d6`, edituratrei `4dc37856e`, grupdzc `e06ef5ee2`, brickplanet `d374fe7ee`, edituracorint `8dad9830f`, edituragama `655dd2374`.

**Quicklink 2Performant** (link spre orice pagină a unui magazin):
`https://event.2performant.com/events/click?ad_type=quicklink&aff_code=676a7e7d9&unique=<cod campanie>&redirect_to=https%253A//<url fără https://>`

---

## 6. Ce face `sync-carti-feeds.cjs` la fiecare rulare

Identitatea unui produs e **linkul de produs** (URL fără parametri). La feed-urile fără URL e `productId`, luat din calea imaginii. Brickplanet a primit `<url>` în feed (15.10.2026): produsele vechi, cu `productId`, sunt recunoscute după id-ul din imagine și trec automat pe link („trecute pe linkul nou de produs”), fără dubluri.

1. **Actualizează** prețul, prețul vechi, reducerea, linkul de afiliere și imaginea produselor găsite în feed.
2. **Scoate produsele inactive** (`product_active = false`). Feed-urile fără acest câmp (brickplanet) sunt considerate active.
3. **Scoate produsele dispărute din feed**, doar la sursele cu feed complet și doar dacă feed-ul e în folder (tabelul `AUTORITATE`). Siguranță: dacă ar dispărea peste 25% din produsele unei surse dintr-un fișier, scoaterea se suspendă și la final scriptul întreabă „da/nu” (fără tastatură, ex. rulare automată: „nu”; `--scoate-tot`: „da”).
4. **Adaugă produsele noi** în fișierul potrivit, după categoria din feed (tabelul `REGULI`).
5. **Elimină dublurile** din același fișier și dintre fișiere; produsul rămâne în primul fișier din ordinea `JSON_FILES`.
6. **Actualizează `books.json`** (secțiunea 8).
7. **Mărime, backup, raport:** salvare compactă peste 10.000 KB, backup înainte de salvare, `sync-report.json`, avertisment pentru feed-uri mai vechi de 36 de ore.

**Setări în script:** `LIMITA_KB = 10000`, `VECHIME_MAXIMA_ORE = 36`, `BACKUPURI_PASTRATE = 7`, `PRAG_SIGURANTA_SCOATERE = 0.25`, `SURSE_DEZACTIVATE = []` (ex. `["carturesti.ro"]` scoate toate produsele Cărturești din toate fișierele).

**Curățări automate la produsele noi:**
- **cartepedia:** titlul se taie înainte de „ - Format - Autor - Editură”; autorul vine din `other_data`.
- **carturesti:** se scoate „| Brand” din titlu; imaginile trec de pe `carturesti.ro/img-prod/` pe `cdn.dc5.ro/img-prod/` (carturesti blochează afișarea pozelor pe alte site-uri).
- **carturesti muzică:** „Album | Artist” → titlu = album, brand = artist.
- **grupdzc (cărți):** „Titlu - Autor” → titlu + autor; la jucării și papetărie rămâne brandul din feed.
- **brickplanet:** brand „LEGO” dacă apare în titlu/descriere.
- **Corint:** brand = „Editura Corint” (feed-ul nu are autor); titlurile scrise numai cu majuscule („TRIGONOMETRIA”) devin „Trigonometria”.
- **Gama:** brand = „Editura Gama” (feed-ul nu are nici autor, nici brand).
- **brand „-” sau gol:** devine numele magazinului.

**Reguli de categorii pentru produse noi:**
- **libris:** Cărți pentru copii → copii-1; Board games, Puzzle, Jucării, Educative, Creative, Lego, Jocuri de călătorie, Roboți, Puzzle 3D, Kendama → jocuri (excluse: jocuri pentru adulți, Figurine/Funko Pop); Agende, Diverse, Semne de carte, Huse, Lămpi, Suport cărți, Termos, Sacoșe, Calendare → accesorii; Creșterea copilului, Parenting → parenting.
- **libhumanitas:** Board Games, Jocuri, Puzzle, Benzi desenate → jocuri (benzile desenate rămân la jocuri, la cererea utilizatorului); Diverse → accesorii; Creșterea copiilor, Pedagogie & Științele educației → parenting.
- **cartepedia:** Cărți pentru copii → copii-2; Cărți Școlare → manuale; limbi străine/engleză → materii; benzi desenate, jocuri, puzzle → jocuri.
- **librarie.net:** Carte Școlară → manuale; Diverse, Arts & Crafts → accesorii; Jucării → jocuri.
- **carturesti:** Back to School (papetărie, hobby, ghiozdane etc. → rechizite/accesorii/jocuri); 3.000 produse (hobby → rechizite, jucării → jocuri, fashion → accesorii); muzică → muzica-film-1/2 după gen; filme → muzica-film-2.
- **Editura Trei, Curtea Veche:** doar cele 59 de titluri de parenting aprobate manual (`PARENTING_APROBATE`, 6.10.2026); feed-urile lor nu au categorii pe teme.
- **brickplanet:** toate produsele → jocuri (regula `"*"`).
- **grupdzc** (`GRUPDZC_REGULI`, verificate pe eșantioane de titluri, 14.10.2026):
  - Carte Școlară, Pedagogie, Semestrul…, toate categoriile pe clase/materii, evaluări, auxiliare, lecturi școlare, activități extracurriculare → `manuale-scolare-2.json`;
  - Cărți pentru copii, povești, colorat, ilustrate, educative, enciclopedii pentru copii → `carti-copii-3.json`;
  - dicționare, limbi străine, gramatici, atlase, hărți → materii;
  - ghiozdane, rucsacuri, penare, semne de carte → accesorii;
  - carioci, caiete, pixuri, rollere, hârtie, capsatoare, acuarele, diplome etc. → rechizite;
  - jucării, LEGO, puzzle, păpuși, figurine, mașinuțe, jocuri → jocuri;
  - „Parenting” → parenting.
  - **Excluse:** „Familie” (decizia utilizatorului), ~25.000 de cărți pentru adulți (romane, religie, drept, medicină etc. — lăsate deocamdată pe dinafară), decorațiuni de Crăciun, gadgeturi, veselă, grădină, animale, cosmetice, alimente. Categoriile noi apărute în feed sunt ignorate până se adaugă în listă — de verificat lunar.
  - Feed-ul nu are preț vechi, deci produsele grupdzc nu afișează reduceri.
- **Editura Corint** (`fisierCorint`, 20.10.2026) — feed-ul nu are categorii utile (aproape tot „Cărţile noastre”) și nici autor, așa că fișierul se alege, în ordine:
  1. titlu de parenting („părinte”, „copilul tău”, „prenatal”) → `carti-parenting.json`;
  2. titlu școlar („manual”, „caiet”, „clasa”, „bacalaureat”, „teste”, „culegere”, „trigonometria”…) → `manuale-scolare.json`;
  3. dicționar, atlas, vocabular, gramatică, limbă străină, enciclopedie → `materii-suplimentare.json`;
  4. aceeași carte (după titlu) la celelalte librării din feed-uri: categoria lor decide (ex. libris „Carti Pentru Copii” → `carti-copii-2.json`);
  5. negăsită în alte feed-uri: copii doar dacă descrierea spune clar („vârsta între 5–9 ani”, „cei mici”).
  - Rezultat pe feed-ul din 20.10: ~290 manuale, ~220 copii, ~30 materii, 10 parenting. **Excluse:** ~700 de cărți pentru adulți (romane, istorie, memorii, young adult romance), ca la grupdzc, și 33 de manuale cu preț 0.
  - Multe cărți Corint există deja pe site de la alt magazin (libris, cartepedia); apar ambele variante, cu prețuri diferite.
- **Editura Gama** (`fisierGama`, 21.10.2026) — editură de cărți pentru copii; categoria din feed e o cale („Carti cu activitati/Dezvoltarea inteligentei/MultiQ”), iar fișierul se alege după ea:
  - `Carti pentru scoala/…` (Exersez!, Memorator, Teste de 10 minute, Evaluare națională) → `manuale-scolare.json` (~56);
  - `Invatare prin joc/…` (EduCard, EduFlash, Bingoletto, puzzle) și `Tiki-Tan/…` (jocuri Genius, lecții Montessori) → jocuri (~78);
  - căile care conțin „Parenting”, „Ghiduri Montessori” sau „pentru parinti” → parenting (~17);
  - `Jurnale…` („Mami, te iubesc!”, albume de grădiniță) → accesorii (7);
  - restul (cărți cu activități, „Învăț să citesc”, povești, Montessori pentru copii, cultură generală, ficțiune, colorat) → `carti-copii-2.json` (~810).
  - ~350 de produse sunt inactive în feed și nu intră. Feed-ul nu are preț vechi, deci produsele Gama nu afișează reduceri.

---

## 7. Muzică și film (`muzica-film.html`)

- **Date:** feed carturesti „Muzică și film”; ~17.300 albume (din care ~6.000 pe vinil) + ~700 filme.
- **Filtre:** butoane pe gen, generate automat din date, cu numărul de produse, plus „Doar vinil”. Selecția rămâne în adresă (`muzica-film.html?gen=Rock&vinil=1`), deci se poate trimite ca link. Pe mobil, butoanele stau pe un rând cu scroll lateral.
- **Homepage:** secțiune proprie pe fundal închis, sub catalogul de cărți, cu 9 carduri: Viniluri, Rock, Clasică, Pop, Jazz/Blues, Alternative, Românească, Soundtrack, Filme.
- **Mostre audio Deezer (30 s):** buton cu difuzor pe coperta fiecărui album (nu pe filme).
  - La clic, `script.js` caută albumul pe Deezer prin JSONP (API-ul Deezer nu permite apeluri directe din browser): întâi după codul de bare (`/album/upc:<ean>`, cu și fără 0 în față), apoi după artist + album, acceptat doar dacă albumul găsit seamănă.
  - Redă prima piesă care are mostră. O singură mostră odată. Albumele negăsite primesc iconița gri, cu difuzorul tăiat.
  - Linkurile de mostră NU se salvează: expiră, iar regulile Deezer interzic stocarea audio.
  - Logo Deezer obligatoriu (regula Deezer): `imagini/deezer-logo.png`, varianta orizontală, extrasă dintr-un cadru al GIF-ului animat oficial. Apare deasupra albumelor și sub preț, la albumul care cântă.
  - GA4: eveniment `asculta_mostra` (rezultat: `ean`, `cautare`, `negasit`, `eroare`).
- **Variante respinse:** Apple/iTunes (regulile cer ca mostrele să promoveze doar vânzarea pe iTunes), Spotify (fără mostre pentru aplicații noi din nov. 2024), YouTube (limită de căutări), fragmente proprii tăiate de pe CD (încalcă drepturile de autor).

---

## 8. `books.json` — catalogul principal

Două mecanisme îl actualizează:

**A. `sync-carti-feeds.cjs` (local, din 10.10.2026)** — doar `price`, `oldPrice`, `discount` („-X%”), păstrând linkul de afiliere:
- linkul se verifică după codul `unique=` din feed; dacă lipsește, dar același produs (`productUrl`) e în feed, linkul se reînnoiește;
- dacă linkul duce la altă carte, apare „⚠️ link greșit” și se corectează;
- dacă cartea lipsește sau e inactivă, se caută după titlu + autor în celelalte feed-uri (prioritate: autor confirmat, libris, preț minim) și se înlocuiesc `affiliate`, `productUrl`, `source`;
- negăsită: la sursele cu feed complet primește `available:false` (ascunsă, revine automat); la librarie.net și carturesti rămâne neatinsă;
- nu atinge actsipoliton și intrările fără link 2Performant.

**B. `update-prices.js` (LOCAL, manual, din când în când)** — scraping per carte. Workflow-ul `update-prices.yml` a fost șters din repo pe 16.10.2026 (ultima rulare automată: #132); din 20.10.2026 scriptul se rulează manual, local, **înainte de sync**:

```
npm install          ← o singură dată în folder (axios, cheerio, playwright)
node update-prices.js
```

Apoi rulezi sync-ul și urci `books.json` ca de obicei. `node_modules\` nu se urcă (e în `.gitignore`). **Atinge DOAR sursele fără feed 2Performant** (`SURSE_FARA_FEED = ["actsipoliton"]`), ca să nu mai intre în conflict cu sync-ul; restul cărților sunt actualizate de sync. `rechizite.json` a fost scos din `DATA_FILES`. Sursă nouă fără feed = adaugi numele în `SURSE_FARA_FEED` + scraper în `lib/scrapers/`.

**Scraperele (`lib/scrapers/`):**

| Sursă | Metodă | Note |
|---|---|---|
| actsipoliton | axios+cheerio, pe linkul curățat de `?tracking=` | fără `productUrl` |
| edituratrei | axios+cheerio, `.product-book-*` | |
| curteaveche | axios+cheerio, `.price` / `.old--price` | |
| bookzone | axios+cheerio | Google Ads interzis ca sursă la Bookzone |
| humanitas | Playwright | pagină anti-bot „Doar un moment...”, retry |
| librarienet | axios+cheerio, `table.css_box_pret` | |
| nemira | axios+cheerio, `meta[itemprop="price"]` | |
| libris | axios+cheerio, `.pr-pret-redus` / `.pr-pret-intreg` | PRP ≠ preț vechi |
| carturesti | Playwright (axios dă 403), `.pret`/`.bani` | `domcontentloaded`, nu `networkidle`; eșecuri intermitente acceptate |

Sursă nouă = fișier nou în `lib/scrapers/` + o linie în `lib/scrapers/index.js`. Helper comun: `waitPastVerificationPage` (`lib/helpers.js`). Test local fără rețea: `npm install` + `node test-scrapers.js`.

**Erori de date găsite:** „Elevul Dima dintr-a șaptea” are autorul trecut greșit (Simon Sinek în loc de Mihail Drumeș) — de corectat manual.

---

## 9. Pagina principală (`index.html`)

- **Hero** redus la ~3/4 din înălțimea inițială (padding 70px, 50px pe mobil).
- **Carduri de promoție** (din 16.10.2026, ca pe site-ul Beauty): definite în `promo.json`, afișate de `script.js` (`loadPromos()`) pe **toate paginile**. Pe homepage stau în `.promo-mount`, în locul primului slot de banner; pe celelalte pagini se inserează automat sub header (pe mobil fără textul lung).
  - Câmpuri: `id`, `pages` (`"all"` / `"home"`), `start` / `end` (ISO cu fus orar, ex. `2026-10-18T23:59:59+03:00`; cardul apare doar în interval), `tag`, `tagSmall`, `kicker`, `title`, `text`, `button`, `link`, `external` (link de afiliere → tab nou, `rel="sponsored"`), culori opționale `accent`, `tagBg`, `tagColor`, `tagSmallColor`. Ordinea din fișier = ordinea pe pagină.
  - GA4: `promo_click`. **Campanie nouă = modifici doar `promo.json`**, fără HTML.
  - Acum (toate pe `"all"`): Black Friday Nemira (pagină din 26.10, campania 6–10.11.2026), ACT și Politon @ librarie.net (până la 23.12.2026), Book-Half (librarie.net), Nemira NEM40 (până la 1.11.2026). MacBook scos pe 26.10.
  - **Ora de iarnă:** din 25.10.2026, 04:00, fusul României e `+02:00`; datele de după trebuie scrise cu `+02:00`, nu `+03:00`.
- **Bannere** (`banners.json`): `id`, `merchant`, `image`, `link`, `alt`, `channels` (`site`/`email`), `startDate`, `endDate`, `weight`. Rotație pe zi (hash pe dată) + la 2 minute cât pagina e deschisă. Înălțime maximă 250px (`BANNER_MAX_HEIGHT_PX`). Secțiunea se ascunde dacă nu e niciun banner activ. Eticheta „PUBLICITATE”, `rel="nofollow sponsored noopener"`, GA4 `banner_click`. Nu se mai pun pe site bannere mari.
- **Catalog de cărți** (`books.json`) cu filtre pe categorie, căutare, paginare, countdown (`offerEnds`).
- **Secțiunea Muzică și film** (secțiunea 7).
- **Hub „Rechizite, manuale și articole școlare”**: 8 carduri-link, cu cifre scrise de mână.
- **Newsletter MailerLite** (secțiunea 12).
- **JSON-LD static** `Organization` + `WebSite`, cu toate paginile de catalog în `hasPart` (vizibil și pentru crawlerele care nu execută JS).
- **Cache browser:** la paginile modificate recent, `style.css` și `script.js` au versiune în link (`style.css?v=20261014`). La fiecare schimbare a acestor două fișiere se schimbă data, altfel vizitatorii văd versiunea veche.

---

## 10. Pagini de campanie (sales pages)

Distribuite direct pe social media și pe email; nu apar în meniu. Model comun: header fix cu buton de abonare, hero cu element vizual (etichetă/cupon), selecții, bannere, formular de abonare în dialog (MailerLite prin fetch, cu rezervă `form.submit`), countdown cu stare „încheiat” (`body[data-state]`), footer cu mențiunea de afiliere și link ANPC SAL.

| Pagină | Campanie | Valabilitate |
|---|---|---|
| `weekend-literar-litera.html` | Litera -50% | 25–28.09.2026 (încheiată) |
| `book-half-librarie-net.html` | librarie.net, cărți la jumătate de preț | |
| `nemira-toamna-literara.html` | Nemira -40% cu codul NEM40 | până la 1.11.2026 |
| `libris-carti-engleza-weekend.html` | libris, cărți în engleză -20…-50% | 9–11.10.2026 (încheiată) |
| `libris-happy-days.html` + `email-libris-happy-days.html` | libris Happy Days, până la -86% (16 cărți alese din feed; 1.849 cărți ≥50%, 336 sub 10 lei) + card + 3 bannere | 20–21.10.2026 (încheiată) |
| `libris-macbook-neo.html` + `email-libris-macbook-neo.html` | concurs libris: comenzile din 23–25.10 livrate cu succes intră la tragerea pentru un MacBook Neo (3.999,99 lei); 8 cărți libris din `books.json` + card + 3 bannere. Countdown până la 26.10 00:00 **+02:00** (pe 25.10 se trece la ora de iarnă) | 23–25.10.2026 |
| `act-politon-librarie-net.html` + `email-act-politon-librarie.html` | librarie.net: toată oferta ACT și Politon (600+ titluri, `editura_id=6005`) la minimum -23%; 4 rafturi → quicklink ofertă, 4 cărți ACT din feedul librarie.net (Profit First, Carnegie, Gerber, Covey jr.), fără prețuri (feedul e de dinainte de campanie); butoane share WhatsApp/Facebook; imagine OG proprie `imagini/og-act-politon-librarie.jpg` (1200×630, nu există bannere 2P). Countdown până la 24.12 00:00 +02:00 | 23.10–23.12.2026 |
| `nemira-black-friday.html` (fără email) | Black Friday Nemira: 6–8.11 Black Friday, 9.11 Cyber Monday, 10.11 After Friday; până la -90% + cod EXTRA20 (-20% la coș, 6–10.11); 8 oferte (pachete, Happy Hours 7,99 lei, 5toFRIDAY 5 cărți/50 lei, FAMILY la 300 lei, bestsellere -50%, noutăți -30%, Nezumi, cadouri) → quicklink `nemira.ro/black-friday`; 8 cărți ecranizate din feedul Nemira (feed_5b10a2be9). Pagina are 3 stări: `pre` (countdown până la start), `live`, `ended`. Imagini proprii `imagini/nemira-bf-og.jpg`, `-ig.jpg` (1080×1080), `-story.jpg` (1080×1920). Bannere 2P (6): pe pagină 1141×401, 1344×756, 840×840, 840×1050; în `banners.json` nemira-bf-01 (971×251) și -02 (1141×401) site+email, -03 (1344×756) doar email, 26.10–10.11; 840×1050 bun pt Instagram feed, 756×1344 pt story/TikTok. Cifre verificate: Dune ~20 mil. ex. (Britannica), Urzeala 100+ mil. ex. în 47 de limbi, Jocurile foamei 100+ mil. ex. în 54 de limbi (Scholastic), Problema celor trei corpuri Hugo 2015. Noutăți: -25% în textul pt marketeri, -30% în cel pt clienți (am folosit -30%) | 26.10–10.11.2026 |
| `carti-parenting.html` | catalog parenting (șablonul generic) | permanentă |
| `carti-gandire-critica.html`, `top10-carti-gandire-critica.html`, `gandire-critica-lista-gratuita.html` | săptămâna gândire critică + lead magnet | permanente |
| `top10-carti-vara-2026.html` | top 10 vară | |

**Gândire critică:** lead magnet-ul (`gandire-critica-lista-gratuita.html`) folosește un formular MailerLite separat (`198972489088369761`, container `mlb2-46096733`), ca automatizarea să pornească doar pentru cei abonați de acolo. Titlul actual: „10 cărți care te ajută să gândești mai limpede într-o lume plină de informații”; fără mențiuni PISA. **Automatizarea MailerLite (trimiterea listei) nu e confirmată ca activă.**

**Campanii doar de conținut (fără pagini):** Săptămâna Stephen R. Covey (19–24.10.2026: 3 emailuri HTML — „Cele 7 deprinderi”, „Cele 12 pârghii”, final cu 3 cărți inclusiv „Etica liderului eficient”; research în proiectul claude.ai, `saptamana-covey-research.md`; accidentul a fost în Provo, Utah, nu în Idaho), Săptămâna Stephen King (5 postări + emailuri; „It”, „Misery”, „Cimitirul animalelor” confirmate la Nemira), Săptămâna Cervantes (4 postări + 2 emailuri; corecturi factuale: mâna paralizată, nu pierdută; romanul imaginat în închisoare, nu scris acolo; „140+ limbi” disputat).

**Regula hook-urilor pentru orice text creativ:** cifre concrete, minimum 3 întrebări retorice la rând, detalii de tip cine/când/unde. Umor, fără calcuri și șabloane („când se răcește” respins). Pe Facebook linkul poate sta în postare; pe profilul personal, în primul comentariu.

---

## 11. Cărturești și parenting — situații deschise

- **Back to School 2026 s-a încheiat (28.09.2026)**; linkurile de afiliere ale cărților din campanie nu mai sunt valabile.
  - `oferte-carti-scolare.json`: 738 din 873 de cărți înlocuite cu aceeași carte de la alt magazin (prioritate libris, apoi preț minim); 135 scoase.
  - `carti-copii-2.json`: 22 înlocuite, 19 scoase. `articole-scolare-accesorii.json`: 4 înlocuite, 7 de verificat.
  - 86 de potriviri făcute după subtitlu, marcate „DA - verifica” în CSV-urile de înlocuire.
  - **De verificat:** rechizitele, accesoriile și jocurile Cărturești folosesc același cod de campanie `07b5f0fed`. Dacă și linkurile lor sunt moarte → `SURSE_DEZACTIVATE = ["carturesti.ro"]`.
  - Pagina de oferte: multe cărți nu mai sunt la reducere; titlul/rolul paginii poate necesita revizuire.
- **`feed_6ea72c5a4`** (carturesti, 15.000 de cărți): linkuri verificate ca funcționale (3.10.2026).
- **carti-parenting:** 421 de cărți Cărturești inițial fără afiliere; 126 au primit afiliere din `feed_6ea72c5a4`; **295 rămân fără afiliere** (quicklink sau scoatere). Decizie: cărțile de parenting nu se înlocuiesc cu alte magazine.

---

## 12. Email marketing (MailerLite)

- **Formular general:** `ÎncaUnCapitol_carti`, ID `193716714758735700`; grup de bază `ÎncaUnCapitol` (`191544829491021196`); grup opțional `CROSS_BRAND_OPTIN` (`193604797722527101`).
- **Tipuri de email:** narativ, o carte (stil F5); „grilă” automată (`node generate-carti-email.cjs`, în ziua trimiterii); emailuri de campanie (King, Cervantes, Litera, Book-Half, Nemira).
- **Două variante de cod pentru fiecare email:**
  - completă, cu `{$unsubscribe}` în footer — pentru editorul **Custom HTML**;
  - `-bloc-mailerlite`, fără footer — pentru editorul **drag & drop**, unde se adaugă un bloc din secțiunea Footer. Altfel apare „Unsubscribe link is missing”.
- **Trimitere:** Send a test obligatoriu înainte de cea reală.
- **Imaginile din email** trebuie urcate în `imagini/` pe GitHub înainte de trimitere, cu literele mari/mici exacte (`Mancha.jpg`).
- **De completat:** linkul real „Abonează-te aici” (cross-brand) din footerul emailurilor-grilă.

---

## 13. Tracking, SEO, legal, DNS

- **GA4 — evenimente:** `click_cumpara`, `affiliate_click`, `featured_book_click`, `click_cumpara_rechizita`, `banner_click`, `filtru_catalog`, `asculta_mostra`, `newsletter_signup`; pe paginile de campanie: `click_afiliere`, `deschide_abonare`, `abonare_reusita`, `copiaza_cod`, `click_facebook`.
- **UTM:** `utm_source=facebook`, `utm_medium=social`, `utm_campaign` fix (litere mici, cratime), `utm_content` obligatoriu când două linkuri au aceeași sursă/mediu/campanie (ex. `pagina-carti` / `profil-personal`).
- **Microsoft Clarity** (`ymwlhvvwpr`) instalat pe: `index.html`, `carti-parenting.html`, `top10-*`, `muzica-film.html`, paginile de campanie. **Lipsește** pe: `privacy.html`, `termeni.html`, paginile hub (manuale, copii, materii, rechizite, accesorii, oferte; jocuri are din 21.10.2026), `carti-gandire-critica.html`, `gandire-critica-lista-gratuita.html`. Se inserează imediat după blocul GA4. De menționat în `privacy.html`.
- **Open Graph:** fiecare pagină de catalog are `og:image` dedicat (`imagini/og-*.jpg`). Facebook ține minte preview-ul vechi → Sharing Debugger + „Scrape Again” înainte de postare.
- **AI-visibility:** JSON-LD static adăugat; `llms.txt` adăugat (fără așteptări); „CatyAI Trust Layer” respins (produs comercial, nu standard); `robots.txt` permite toate crawlerele.
- **Google Shopping / CSS:** Merchant Center direct respins (model de afiliere). CSS (Comparison Shopping Service) e o oportunitate reală în România, dar cere comparația aceluiași produs la mai mulți comercianți (inexistentă acum; `books.json` are 0 suprapuneri), înregistrare formală și sediu social completat. Neînceput. Enrichment AI pe feed-uri respins (prea multe produse). GTIN/taxonomie Google irelevante fără CSS.
- **Legal:** `privacy.html` și `termeni.html` — de completat sediul social (`[de completat]`) și imaginea SAL reală; recomandată verificare juridică.
- **DNS:** domeniul la Squarespace; CNAME `carti` → `mariusgherasim.github.io`; TXT de verificare Google. Sitemap trimis în Search Console.

---

## 14. Probleme rezolvate (de reținut)

- Titluri cu apostrof/ghilimele rupeau pagina → `escapeHtml()` + delegare de evenimente.
- `books.json` și fișierele de catalog rămâneau în cache → `?v=timestamp` + `cache: "no-store"` la fetch.
- **`script.js`/`style.css` vechi în browser** (ex. difuzorul Deezer nu apărea, logo uriaș) → Ctrl+F5 local; versiune în link (`?v=AAAALLZZ`) pentru vizitatori.
- `manuale-scolare.json` trunchiat → recuperate 8.033 de produse complete.
- Preview Facebook cu pictograma SAL → tag-uri Open Graph complete pe fiecare pagină.
- „Unsubscribe link is missing” în MailerLite → varianta `-bloc-mailerlite` + bloc Footer.
- Imagini lipsă în email → coperțile trebuie urcate pe GitHub, cu literele exacte.
- Carduri promo care nu apăreau → `index.html` și `banners.json` nu fuseseră urcate.
- „fatal: not a git repository” în folderul local → `git init`, `remote add origin`, `fetch`, `symbolic-ref HEAD refs/heads/main`, `reset origin/main`, `branch --set-upstream-to=origin/main`.
- Linkuri greșite în `books.json` („Rusia lui Putin” cu linkul altei cărți, „Rămășițele zilei”, „21 de lecții…”) → detectate și corectate automat de sync.
- Logo Deezer primit ca GIF animat (2,8 MB, primul cadru gol, părea alb) → extras cadrul complet ca PNG transparent (17 KB).
- Feed brickplanet fără URL și fără stoc → cheie din id-ul imaginii, produse considerate active.
- **Corint, 21.10.2026: 552 de cărți „lipsă din feed” + dubluri.** Pe 20.10, feed-ul Corint descărcat local venise fără `<url>` și fără `<old_price>`, așa că sync-ul a salvat cărțile cu cheia `productId: "2p/<cod unique>"`. Pe 21.10 feed-ul a venit complet, cu url, și aceleași cărți au fost adăugate încă o dată. Rezolvat în sync: cheile `2p/<cod>` se recunosc după codul `unique` din linkul de afiliere și trec automat pe linkul de produs, iar dublurile se scot („trecute pe linkul nou de produs”, „−duplicate”). Lecție: la întrebarea „Le scot?” cu 100% dintr-o sursă, răspunde „nu” și verifică feed-ul.

---

## 15. Task-uri rămase

- [ ] **Cărturești:** de verificat dacă linkurile rechizite/accesorii/jocuri (`07b5f0fed`) mai funcționează.
- [ ] **carti-parenting:** 295 de cărți Cărturești fără afiliere (quicklink sau scoatere).
- [ ] **oferte-carti-scolare:** de revizuit titlul/rolul paginii; de verificat cele 86 de potriviri prin subtitlu.
- [ ] **`books.json`:** de corectat autorul la „Elevul Dima dintr-a șaptea”; de verificat înlocuirile „Fahrenheit 451” (acum librarie.net) și „Stephen Hawking, o viață dedicată științei” (libhumanitas).
- [ ] **grupdzc:** verificare lunară a categoriilor noi din feed; ~25.000 de cărți pentru adulți nefolosite (posibilă secțiune nouă).
- [ ] **Gama:** de verificat că pozele de pe edituragama.ro se afișează pe site.
- [ ] **carti-parenting.html:** bannerul Cărturești „-20% cărți de parenting” (oferta 6675) e probabil expirat — de verificat și scos dacă nu mai funcționează.
- [ ] **Corint:** ~700 de cărți pentru adulți nefolosite (aceeași posibilă secțiune nouă); de verificat că pozele de pe edituracorint.ro se afișează pe site; subtitlurile paginilor copii/manuale pot menționa Corint.
- [ ] **`books.json`:** „Etica liderului eficient” are `source: "libris"`, dar linkul e de la printrecarti.ro (anticariat) — de corectat.
- [ ] **Imagini cu spații în nume** (`cele 7 deprinderi.jpg`, `cele 12 parghii.jpg`): de redenumit cu cratime.
- [ ] **brickplanet:** câteva produse sunt ghiozdane/brelocuri LEGO (acum la jocuri); de verificat că pozele se afișează.
- [ ] **Deezer:** de verificat dimensiunea minimă a logo-ului în ghidul de pe deezerbrand.com.
- [ ] **muzica-film.html:** imagine Open Graph proprie (acum folosește `og-image.jpg`).
- [ ] **Microsoft Clarity** pe paginile rămase + mențiune în `privacy.html`.
- [ ] **MailerLite:** confirmarea automatizării pentru lead magnet-ul de gândire critică; linkul real cross-brand din emailuri.
- [ ] **Legal:** sediul social + imaginea SAL reală în paginile legale.
- [ ] `npm audit` — 3 vulnerabilități „high severity” (20.10.2026): de rulat `npm audit fix` (fără `--force`).
- [ ] Ștergerea secțiunii „Cărțile care m-au influențat cel mai mult” din `index.html` (se ocupă utilizatorul).
- [ ] Ștergerea fișierelor nefolosite: `rechizite.json`, `generate-catalog-from-feeds.cjs`, `REMEMBER-feed-uri.md`.
- [ ] **CSS (Comparison Shopping Service):** oportunitate de discutat (secțiunea 13).
