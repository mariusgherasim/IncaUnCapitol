// sync-carti-feeds.cjs
// ============================================================
// ÎncăUnCapitol (carti.gherasimmarius.com)
// Sincronizare LOCALA a fisierelor JSON de produse cu feed-urile XML 2Performant.
//
// Ce face, pentru fiecare fisier JSON:
//   1. Actualizeaza pretul, pretul vechi, reducerea, linkul de afiliere si imaginea
//      pentru produsele care exista in feed.
//   2. Scoate produsele marcate inactive in feed (product_active = false).
//   3. Scoate produsele care au disparut din feed — DOAR pentru sursele la care
//      feed-ul e complet (vezi AUTORITATE mai jos) si doar daca feed-ul e prezent.
//   4. Adauga produsele noi din feed, in fisierul potrivit categoriei (vezi REGULI).
//   5. Elimina duplicatele (acelasi produs de doua ori, cu alt cod de afiliere).
//   6. books.json: actualizeaza doar pretul / pretul vechi / reducerea, pastrand linkul de afiliere
//      + „cel mai bun pret": cartea trece pe libraria cu pret mai mic cu peste 5% (vezi BOOKS_CEL_MAI_BUN_PRET)
//      (actsipoliton trece prin update-prices.js; printrecarti e verificat separat);
//      daca linkul nu mai e in feed, cauta aceeasi carte (titlu + autor) in alt feed si inlocuieste linkul.
//
// Nu are nevoie de npm install — foloseste doar Node.js.
//
// Rulare (din cmd, in folderul cu scriptul):
//   node sync-carti-feeds.cjs --dry-run                 (doar raport, nu salveaza nimic)
//   node sync-carti-feeds.cjs                           (actualizeaza fisierele)
//   node sync-carti-feeds.cjs --feeds=feeds --json=public\data
//   node sync-carti-feeds.cjs --fara-adaugare           (doar actualizeaza/scoate, nu adauga)
//   node sync-carti-feeds.cjs --scoate-tot              (scoate si produsele blocate de pragul de siguranta, fara intrebare)
//
// Prag de siguranta: daca dintr-un fisier ar disparea peste 25% din produsele unei surse, scriptul NU le scoate
// direct. La final afiseaza lista si te INTREABA (da/nu) daca le scoate. Verifici feed-ul manual, apoi raspunzi.
// La rularea automata (fara tastatura, ex. actualizeaza-zilnic.bat) raspunsul e „nu", in afara de --scoate-tot.
//
// Rulare zilnica automata: actualizeaza-zilnic.bat (+ instaleaza-task-zilnic.bat pentru Task Scheduler)
//
// Implicit, feed-urile XML si fisierele JSON sunt cautate in folderul scriptului.
// Inainte de salvare, fiecare JSON modificat e copiat in backup-feed-sync\<data-ora>\
// Raportul complet: sync-report.json
// ============================================================

const fs = require("fs");
const path = require("path");

// ---------- Argumente ----------
const args = process.argv.slice(2);
const arg = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : def;
};
const DRY_RUN = args.includes("--dry-run");
const NO_ADD = args.includes("--fara-adaugare");
const SCOATE_TOT = args.includes("--scoate-tot");
const FEEDS_DIR = path.resolve(__dirname, arg("feeds", "."));
const JSON_DIR = path.resolve(__dirname, arg("json", "."));
const REPORT_PATH = path.join(__dirname, "sync-report.json");

// Marimea maxima a unui fisier JSON (KB). Peste limita, fisierul se salveaza compact (fara indentare,
// cu ~30% mai mic); daca tot depaseste, primesti avertisment in raport si in log.
const LIMITA_KB = 10000;

// Feed-uri mai vechi de atatea ore genereaza avertisment (probabil n-au fost copiate din nou).
const VECHIME_MAXIMA_ORE = 36;

// Cate foldere de backup se pastreaza (cele mai vechi se sterg automat).
const BACKUPURI_PASTRATE = 7;

// Surse dezactivate: produsele lor sunt scoase din TOATE fisierele si nu se mai adauga altele noi.
// Ex.: ["carturesti.ro"] daca programul de afiliere Carturesti nu mai functioneaza.
// 10.11.2026: Carturesti dezactivat — feed-urile lor nu mai functioneaza in 2Performant.
// Efect: toate produsele carturesti dispar din fisierele de catalog (muzica-film-1/2 raman goale),
// feed-urile carturesti nu se mai citesc (nici daca fisierele vechi mai sunt in folder),
// iar cartile carturesti din books.json trec pe alta librarie (cel mai bun pret) sau, daca nu exista
// in niciun alt feed, sunt ascunse (available:false). Ca sa reactivezi: scoate "carturesti.ro" de aici
// si pune-l inapoi in PRIORITATE_LIBRARII.
// 11.11.2026: Humanitas dezactivat — feed-ul avea preturi inghetate din 9.10.2026 si a fost scos de la descarcare.
const SURSE_DEZACTIVATE = ["carturesti.ro", "libhumanitas.ro"];

// Daca mai mult de acest procent din produsele unei surse ar fi scoase dintr-un fisier,
// scoaterea se suspenda si la final scriptul te intreaba daca le scoate (vezi „Prag de siguranta" sus).
const PRAG_SIGURANTA_SCOATERE = 0.25;

// ---------- Feed-uri ----------
// Fisier XML -> sursa. Codurile vin din linkul feed-ului 2Performant (feeds.2performant.com/feed/<cod>.xml)
const FEEDS = {
  // Scoase pe 07.11.2026 (feed-urile nu mai exista in 2Performant; fisierele vechi din folder nu se mai citesc):
  //   feed_78ad15be7 — libris complet (404 din 21.10.2026); jocurile libris vin acum din feed_5d7d1b9bc
  //   feed_f23ec2538 — librarie.net Top 100 (inclus oricum in Top 10.000, feed_d399be9e5)
  "feed_bfb296a3b.xml": { sursa: "cartepedia.ro", descriere: "cartepedia — carti si jocuri in stoc" },
  "feed_dbcb0e675.xml": { sursa: "cartepedia.ro", descriere: "cartepedia — carti in stoc" },
  "feed_f70ce214f.xml": { sursa: "cartepedia.ro", descriere: "cartepedia — carti pentru copii in stoc" },
  "feed_198b495ca.xml": { sursa: "cartepedia.ro", descriere: "cartepedia — carti educationale in stoc" },
  "feed_d399be9e5.xml": { sursa: "librarie.net", descriere: "librarie.net — Top 10.000 produse" },
  "feed_d861df8a1.xml": { sursa: "carturesti.ro", descriere: "carturesti — Back to School 2026" },
  "feed_6ea72c5a4.xml": { sursa: "carturesti.ro", descriere: "carturesti — Carte in limba romana (15.000 carti)" },
  "feed_02a848b11.xml": { sursa: "carturesti.ro", descriere: "carturesti — 3.000 produse (hobby/arta, jocuri, fashion)" },
  "feed_23ed00784.xml": { sursa: "libris.ro", descriere: "libris — eBooks" },
  "feed_30725b952.xml": { sursa: "libris.ro", descriere: "libris — Carti in Romana (inclus in feed-ul complet)" },
  "feed_0c722f7a4.xml": { sursa: "libris.ro", descriere: "libris — Carti pentru copii (inclus in feed-ul complet)" },
  "feed_5d7d1b9bc.xml": { sursa: "libris.ro", descriere: "libris — Jocuri, accesorii si cadouri (~7.000 produse)" },
  "feed_7bd1c15b9.xml": { sursa: "edituratrei.ro", descriere: "Editura Trei" },
  "feed_0ab2094f6.xml": { sursa: "curteaveche.ro", descriere: "Curtea Veche" },
  "feed_5b10a2be9.xml": { sursa: "nemira.ro", descriere: "Nemira" },
  "feed_e82be0de9.xml": { sursa: "libhumanitas.ro", descriere: "libhumanitas — feed complet" },
  "feed_3dd5a1fd2.xml": { sursa: "brickplanet.ro", descriere: "brickplanet — seturi LEGO (feed redus: fara url, categorie, stoc)" },
  "feed_952ab47b2.xml": { sursa: "carturesti.ro", descriere: "carturesti — Muzica si film (CD, vinil, DVD)" },
  "feed_0b61412e9.xml": { sursa: "grupdzc.ro", descriere: "grupdzc — feed complet (carti copii, scolare, jucarii, papetarie + multe irelevante)" },
  "feed_8289d9f33.xml": { sursa: "edituracorint.ro", descriere: "Editura Corint — feed complet (~1.300 carti: scolare, copii, adulti)" },
  "feed_bd91e5f46.xml": { sursa: "edituragama.ro", descriere: "Editura Gama — feed complet (~1.300 produse pentru copii: activitati, lectura, scoala, jocuri)" },
  // 11.11.2026: librex.ro (campania 3085d2457), ~4.700 carti. Feed-ul nu are autor (<brand> = editura).
  "feed_e0aae345e.xml": { sursa: "librex.ro", descriere: "librex — feed complet (~4.700 carti: copii, beletristica, spiritualitate, istorie)" },
};

// Toate feed-urile de mai sus sunt citite: actualizeaza pretul si linkul oricarui produs existent pe care il contin.
// Produse NOI se adauga doar pentru categoriile din REGULI (si, la parenting, din REGULI_CUVINTE + lista aprobata).
// brickplanet (feed_3dd5a1fd2) are un feed redus (doar titlu, pret, imagini, link, descriere): produsele se
// recunosc dupa id-ul din calea imaginii si intra toate in articole-scolare-jocuri.json.
// Muzica si film (feed_952ab47b2, carturesti): albumele si filmele intra in muzica-film-1.json / muzica-film-2.json,
// cu campurile genre (gen muzical sau „Filme") si vinyl (true la viniluri), pentru filtrele de pe pagina.
// Feed ignorat intentionat: feed_09200f7e9 (printrecarti.ro — carti la mana a doua, decizia utilizatorului).
// Daca ai mai multe descarcari ale aceluiasi feed (ex. feed_bfb296a3b.xml si feed_bfb296a3b_1.xml),
// scriptul o foloseste automat pe cea mai noua.

// ---------- Fisiere JSON ----------
// Ordinea conteaza la deduplicare: un produs aflat in doua fisiere ramane in primul.
const JSON_FILES = [
  "carti-copii-1.json",
  "carti-copii-2.json",
  "carti-copii-3.json",
  "manuale-scolare.json",
  "manuale-scolare-2.json",
  "materii-suplimentare.json",
  "rechizite-papetarie.json",
  "articole-scolare-accesorii.json",
  "articole-scolare-jocuri.json",
  "oferte-carti-scolare.json",
  "carti-parenting.json",
  "muzica-film-1.json",
  "muzica-film-2.json",
];

// ---------- AUTORITATE (pentru scoaterea produselor disparute) ----------
// fisier JSON -> { sursa: [feed-urile care acopera complet sursa in acest fisier] }
// Un produs din aceasta sursa care nu mai apare in niciunul dintre feed-uri e scos.
// Surse neincluse aici (ex. libhumanitas.ro, libris in accesorii/jocuri) nu sunt atinse,
// pentru ca feed-urile lor nu sunt incarcate.
const CARTEPEDIA = ["feed_bfb296a3b.xml", "feed_dbcb0e675.xml", "feed_f70ce214f.xml", "feed_198b495ca.xml"];
const GRUPDZC = ["feed_0b61412e9.xml"];
const CORINT = ["feed_8289d9f33.xml"];
// libris, din 03.11.2026: cele 4 feed-uri ramase acopera toate cartile (verificat pe 20.10: 0 carti pentru copii,
// 0 agende/accesorii, 0 parenting lipsa fata de feed-ul complet sters).
const LIBRIS = ["feed_30725b952.xml", "feed_0c722f7a4.xml", "feed_5d7d1b9bc.xml", "feed_23ed00784.xml"];
// Jocurile si accesoriile libris: feed_5d7d1b9bc (verificat 07.11.2026: contine 3.584 din 3.762 de jocuri si
// 1.594 din 2.230 de accesorii libris de pe site, cu aceleasi linkuri; restul nu se mai vand).
const LIBRIS_JOCURI = ["feed_5d7d1b9bc.xml"];
const FEED_VECHI_STIUT = []; // feed-uri fara avertismentul zilnic „e vechi de X ore"
const GAMA = ["feed_bd91e5f46.xml"];
const LIBREX = ["feed_e0aae345e.xml"];
const AUTORITATE = {
  "carti-copii-1.json": { "libris.ro": LIBRIS },
  "carti-copii-2.json": { "libris.ro": LIBRIS, "cartepedia.ro": CARTEPEDIA, "edituracorint.ro": CORINT, "edituragama.ro": GAMA },
  "manuale-scolare.json": { "cartepedia.ro": CARTEPEDIA, "edituracorint.ro": CORINT, "edituragama.ro": GAMA },
  "materii-suplimentare.json": { "cartepedia.ro": CARTEPEDIA, "grupdzc.ro": GRUPDZC, "edituracorint.ro": CORINT, "librex.ro": LIBREX },
  "rechizite-papetarie.json": { "carturesti.ro": ["feed_d861df8a1.xml"], "grupdzc.ro": GRUPDZC },
  "articole-scolare-accesorii.json": { "carturesti.ro": ["feed_d861df8a1.xml"], "grupdzc.ro": GRUPDZC, "edituragama.ro": GAMA, "libris.ro": LIBRIS_JOCURI },
  "articole-scolare-jocuri.json": {
    "cartepedia.ro": CARTEPEDIA,
    "carturesti.ro": ["feed_d861df8a1.xml"],
    "libris.ro": LIBRIS_JOCURI,
    "libhumanitas.ro": ["feed_e82be0de9.xml"],
    "brickplanet.ro": ["feed_3dd5a1fd2.xml"],
    "grupdzc.ro": GRUPDZC,
    "edituragama.ro": GAMA,
    "librex.ro": LIBREX,
  },
  "oferte-carti-scolare.json": {
    "libris.ro": LIBRIS,
    "libhumanitas.ro": ["feed_e82be0de9.xml"],
    "cartepedia.ro": CARTEPEDIA,
  },
  "carti-parenting.json": {
    "libris.ro": LIBRIS,
    "libhumanitas.ro": ["feed_e82be0de9.xml"],
    "grupdzc.ro": GRUPDZC,
    "edituracorint.ro": CORINT,
    "edituragama.ro": GAMA,
    "librex.ro": LIBREX,
  },
  "muzica-film-1.json": { "carturesti.ro": ["feed_952ab47b2.xml"] },
  // grupdzc: feed complet -> produsele disparute din feed se scot din toate fisierele unde apar
  "carti-copii-3.json": { "grupdzc.ro": GRUPDZC, "librex.ro": LIBREX },
  "manuale-scolare-2.json": { "grupdzc.ro": GRUPDZC, "librex.ro": LIBREX },
  "muzica-film-2.json": { "carturesti.ro": ["feed_952ab47b2.xml"] },
};

// ---------- REGULI (unde intra produsele noi) ----------
// feed -> { categorie din feed : fisier JSON }. Categoriile nelistate sunt ignorate.
const REGULI_CARTEPEDIA = {
  "Cărți pentru copii": "carti-copii-2.json",
  "Cărți Școlare": "manuale-scolare.json",
  "Cărţi în limbi străine": "materii-suplimentare.json",
  "Cărți în Engleză": "materii-suplimentare.json",
  "Benzi desenate şi romane grafice": "articole-scolare-jocuri.json",
  "Jocuri pentru copii": "articole-scolare-jocuri.json",
  "Jocuri educative": "articole-scolare-jocuri.json",
  "Jocuri pentru familie": "articole-scolare-jocuri.json",
  "Jocuri de cărți": "articole-scolare-jocuri.json",
  "BOARD GAMES": "articole-scolare-jocuri.json",
  "Puzzle": "articole-scolare-jocuri.json",
};
const JOCURI = "articole-scolare-jocuri.json";
// ---------- CATALOG CARTI PENTRU ADULTI (pagina carti-beletristica.html, din 11.11.2026) ----------
// Reconstruit DE LA ZERO la fiecare sync (pasul 4d), din toate feed-urile de mai jos:
//   - o singura carte pe titlu (aceeasi carte la mai multe librarii -> ramane oferta cea mai ieftina);
//   - fiecare carte primeste un gen (din categoria feed-ului; daca librăria nu are categorii, genul se ia
//     de la aceeasi carte gasita intr-un feed care are, altfel „Alte titluri");
//   - cate un fisier pe gen: carti-adulti-<gen>.json (impartit in -1, -2... peste ADULTI_MAX_KB),
//     plus carti-adulti.json = lista genurilor, fisierelor si numarului de carti (citita de pagina);
//   - cartile care sunt deja pe site in alte categorii (copii, manuale, parenting, materii) nu intra.
// Exclus: Humanitas (feed cu preturi inghetate din 9.10.2026), audiobook, ebook, reviste, carti in maghiara.
const ADULTI_PREFIX = "carti-adulti";
const ADULTI_MAX_KB = 7000;
const ALTE = "Alte titluri";
const GENURI_ORDINE = ["Beletristică", "Dezvoltare personală", "Psihologie", "Spiritualitate și religie", "Istorie", "Biografii și memorii", "Business, economie și drept", "Științe umaniste și artă", "Sănătate", "Hobby, călătorii și bucătărie", ALTE];
const GEN_SLUG = {
  "Beletristică": "beletristica", "Dezvoltare personală": "dezvoltare-personala", "Psihologie": "psihologie",
  "Spiritualitate și religie": "spiritualitate-religie", "Istorie": "istorie", "Biografii și memorii": "biografii-memorii",
  "Business, economie și drept": "business-economie-drept", "Științe umaniste și artă": "stiinte-umaniste-arta",
  "Sănătate": "sanatate", "Hobby, călătorii și bucătărie": "hobby-calatorii-bucatarie", [ALTE]: "alte-titluri",
};
// libris (feed_30725b952): <category>
const ADULTI_LIBRIS = {
  "Beletristica": "Beletristică", "Umor": "Beletristică",
  "Dezvoltare Personala": "Dezvoltare personală",
  "Religie": "Spiritualitate și religie", "Spiritualitate Ezoterism": "Spiritualitate și religie",
  "Biografii Memorii Jurnale": "Biografii și memorii",
  "Afaceri Economie": "Business, economie și drept", "Drept": "Business, economie și drept",
  "Stiinte Umaniste": "Științe umaniste și artă", "Arta Arhitectura Design": "Științe umaniste și artă",
  "Stiinta Si Tehnica": "Științe umaniste și artă", "It Computere": "Științe umaniste și artă", "Cultura Generala": "Științe umaniste și artă",
  "Sanatate": "Sănătate", "Medicina Si Farmacie": "Sănătate",
  "Hobby Practic": "Hobby, călătorii și bucătărie", "Calatorii Ghiduri Harti": "Hobby, călătorii și bucătărie", "Gastronomie": "Hobby, călătorii și bucătărie",
};
// cartepedia: doar doua categorii pentru adulti
const ADULTI_CARTEPEDIA = { "Cărți Ficțiune": "Beletristică", "Cărți Non-ficțiune": ALTE };
// librex (feed_e0aae345e): <category> = ultima subcategorie
const GENURI_LIBREX = {
  "Beletristică": ["Fictiune", "Carti de dragoste", "Literatura Contemporana", "Literatura Romana", "Thriller", "Fantasy", "Literatura Universala", "Eseuri", "Poezie", "Science-Fiction", "Carti politiste", "Roman Romanesc", "Drama", "Critica Literara", "Roman Strain", "Teatru", "Beletristica", "Roman istoric", "Aventuri", "Franta si scriitori francezi"],
  "Dezvoltare personală": ["Carti dezvoltare personala", "Dezvoltare Personala si Motivationale", "Relatii de cuplu"],
  "Psihologie": ["Psihoterapie", "Psihologie", "Psihologie aplicata", "Psihanaliza", "Neuropsihologie", "Psihologia femeii", "Psihologie si comunicare", "Personalitate"],
  "Spiritualitate și religie": ["Carti dezvoltare spirituala", "Carti de religie", "Carti Spiritualitate - Ezoterism", "Carti de astrologie", "Minte Corp", "Fenomene Paranormale"],
  "Istorie": ["Istorie generala", "Istoria romanilor", "Dezvaluiri", "Istorii secrete", "Istorie", "Centenarul Marii Uniri"],
  "Biografii și memorii": ["Biografii", "Memorii", "Jurnale", "Biografii Memorii Jurnale"],
  "Sănătate": ["Carti Nutritie & Alimentatie", "Carti medicina alternativa", "Carti de sanatate", "Boli", "Carti dieta", "Carti despre sanatatea mintala", "Sanatatea femeii", "Imbatranire", "Carti tratamente naturiste", "Fitness", "Medicina", "Specialitati Medicale", "Specialitati Fundamentale", "Alergologie"],
  "Business, economie și drept": ["Educatie financiara", "Carti Leadership", "Cariera", "Marketing", "Carti advertising", "Carti de antreprenoriat", "Carti de management", "Carti despre Comunicare & business", "Carti de economie", "Carti despre coaching", "Carti de Drept"],
  "Științe umaniste și artă": ["Filozofie", "Stiinta Tehnica", "Carti de stiinta si tehnica", "Carti de sociologie", "Carti de Matematica", "Litere Filologie", "Carti Genetica Biologie", "Geografie Topografie", "Politica", "Muzica", "Arhitectura", "Fotografie"],
  "Hobby, călătorii și bucătărie": ["Carti de bucate", "Carti Lifestyle", "Carti de colorat adulti", "Albume Romania", "Enciclopedii Geografice", "Legislatie Rutiera"],
};
const ADULTI_LIBREX = Object.fromEntries(Object.entries(GENURI_LIBREX).flatMap(([gen, cats]) => cats.map((c) => [c, gen])));
// categoriile de promotie librex fara gen (Black Friday, 2 + 1 Gratis...) -> ALTE; cardurile cadou si accesoriile -> nu intra
const LIBREX_FARA_GEN = /^(Black Friday|2 \+ 1 Gratis|Pachete BF|Recomandari Librex|Noutati Carti|50% reducere la carti|Indragostit De Citit|Grupul Editorial TREI|500cu50|Pachete speciale|Marea Lichidare de stoc|ZiuaCartii|Femei care citesc|Carti pentru Cadou|Carti)$/;
// Curtea Veche: primul nivel din <custom_field3> („Carti Beletristică > ...")
const ADULTI_CURTEAVECHE = {
  "Carti Beletristică": "Beletristică", "Cărți de Poezii": "Beletristică",
  "Carti Antreprenoriat": "Business, economie și drept", "Carieră": "Business, economie și drept", "Leadership": "Business, economie și drept", "Productivitate": "Business, economie și drept", "BNR": "Business, economie și drept",
  "Spiritualitate": "Spiritualitate și religie", "Memorialistică": "Biografii și memorii",
  "Cărți Regale": "Istorie", "Politică Românească": "Istorie", "Istoria Ideilor": "Științe umaniste și artă",
  "Neuroștiințe": "Psihologie", "Mental Health": "Psihologie",
  "Îmbunătățește-ți relația": "Dezvoltare personală", "Reinventare Personală": "Dezvoltare personală", "Self-Help": "Dezvoltare personală",
  "Despre corp": "Sănătate", "Nutriție": "Sănătate", "Rețete": "Hobby, călătorii și bucătărie", "Fotografie": "Hobby, călătorii și bucătărie",
};
// Gen dupa cuvintele din titlu — doar pentru cartile fara gen (ALTE) si pentru „Științe umaniste" de la libris
// (libris pune istoria, psihologia si filozofia in aceeasi categorie). Titlul e comparat fara diacritice.
const GEN_DIN_TITLU = [
  ["Psihologie", /\b(psiholog\w*|psihoterap\w*|psihanaliz\w*|terapi\w*|anxiet\w*|depresi\w*|trauma\w*|narcis\w*|emoti\w*|creier\w*|neuro\w*|mintii|mintea|inteligenta emotionala|atasament\w*|personalitat\w*|comportament\w*|subconstient\w*)\b/],
  ["Istorie", /\b(istori\w*|razboi\w*|imperi\w*|regel\w*|regina|regi|dinasti\w*|comunis\w*|securitat\w*|holocaust\w*|revolut\w*|nazis\w*|cruciad\w*|medieval\w*|antichitat\w*|romanilor|domnitor\w*|feudal\w*|gulag\w*|bizant\w*|otoman\w*)\b/],
  ["Business, economie și drept", /\b(bani|banii|banilor|bogat\w*|investit\w*|bursa|afacer\w*|antreprenor\w*|leadership\w*|lider\w*|manag\w*|marketing|vanzar\w*|negocier\w*|economi\w*|financ\w*|startup|cariera|drept\w*|juridic\w*|cod(ul)? (civil|penal|fiscal|muncii))\b/],
  ["Sănătate", /\b(sanatat\w*|dieta|diete|nutriti\w*|aliment\w*|boli|boala|bolilor|vindec\w*|medic\w*|cancer|diabet\w*|inim\w*|somn\w*|longevitat\w*|detox\w*|imunit\w*|hormon\w*|intestin\w*)\b/],
  ["Spiritualitate și religie", /\b(dumnezeu\w*|rugaciun\w*|biblie\w*|biblic\w*|credint\w*|ortodox\w*|crestin\w*|sfant\w*|sfinti\w*|evanghel\w*|isus|hristos|spiritual\w*|meditati\w*|budis\w*|karma|parintele|duhovnic\w*|staret\w*|cuvios\w*|suflet\w*|ingeri|angel\w*|astrolog\w*|zodi\w*|ezoter\w*)\b/],
  ["Dezvoltare personală", /\b(obicei\w*|succes\w*|motivati\w*|fericir\w*|incredere\w*|productivit\w*|disciplin\w*|stoic\w*|mindset|mindfulness|dezvoltare personala|relati(a|e|i|ile) de cuplu|comunicare|autocunoaster\w*|vointa)\b/],
  ["Hobby, călătorii și bucătărie", /\b(retet\w*|bucatari\w*|gatit\w*|prajitur\w*|deserturi|ghid turistic|calatori\w*|gradinar\w*|tricotat|crosetat|fotografi\w*)\b/],
  ["Biografii și memorii", /\b(biografi\w*|memorii|jurnal(ul)?|autobiografi\w*|amintiri)\b/],
];
const faraDiacritice = (t) => decode(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function genDupaTitlu(titlu, genActual) {
  const t = faraDiacritice(titlu);
  const permise = genActual === "Științe umaniste și artă" ? ["Psihologie", "Istorie"] : null;
  const r = GEN_DIN_TITLU.find(([gen, rx]) => (!permise || permise.includes(gen)) && rx.test(t));
  return r ? r[0] : genActual;
}
// grupdzc: categoriile pentru adulti (regex pe <category>) -> gen. Completat dupa verificarea feed-ului.
const ADULTI_GRUPDZC = [
  // verificat pe titluri, 11.11.2026; exclus: „Prajituri", „Pizza", „Finger food", „Cocktail" (ustensile de bucatarie),
  // „Literatura" (lecturi in germana), „Diverse", „Altele", „Carti erse" (amestec), tot ce e scolar sau pentru copii
  [/^(Romane|Proza ersa|Fictiune|Romantice|Poezie|Literatura universala|Literatura Universala|Literatura romana|Literatura Romana|Politiste|Thriller|Antologie|Science Fiction|Beletristica|Piese de teatru scenarii|Aventura|Bestseller)$/, "Beletristică"],
  [/^(Religie|Spiritualitate)$/, "Spiritualitate și religie"],
  [/^Memorialistica$/, "Biografii și memorii"],
  [/^(Carti dezvoltare personala|Dezvoltare personala|Motivational)$/, "Dezvoltare personală"],
  [/^(Istorie|Tratat)$/, "Istorie"],
  [/^(Psihologie|Psihoterapie|Psihiatrie)$/, "Psihologie"],
  [/^(Afaceri|Management|Economie generala|Marketing si Comert|Finante si banci|Economie politica|Contabilitate|Stiinte Economice|Statistica|General|Administratie publica|Procedura|Practica Judiciara|Cod Civil|Codul Penal|Codul|Drept Civil|Drept Penal|Drept financiar si fiscal|Drept   Juridice   Legislatie|Carti drept (international|administrativ|constitutional))$/, "Business, economie și drept"],
  [/^(Arta|Filologie|Stiinte Politice|Sociologie|Filosofie|Partituri si carti muzicale|Istorie si critica literara|Stiinte Umaniste|Stiinte Exacte|Astronomie|Folclor|Proza eseistica|Non-fiction)$/, "Științe umaniste și artă"],
  [/^(Alimentatie si nutritie|Naturista|Stomatologie|Anatomie|Atlas anatomie|Medicina Generala|Medicina Interna|Farmacologie|Cardiologie|Pediatrie|Chirurgie|Neurologie|Obstretica si Ginecologie|Dermatologie|Ortopedie|Carti medicale)$/, "Sănătate"],
  [/^(Gastronomie|Calatorie|Sfaturi Practice|Turism si Mediu|Agricultura|VREAU PERMIS AUTO)$/, "Hobby, călătorii și bucătărie"],
];
// Feed-uri fara categorii de carti pentru adulti: toate cartile active intra (gen de la aceeasi carte din alt feed, altfel ALTE)
const ADULTI_FARA_CATEGORII = ["feed_d399be9e5.xml", "feed_7bd1c15b9.xml", "feed_5b10a2be9.xml"];
// librarie.net: doar categoria „Cărți" (restul e scolar, jucarii, diverse)
const ADULTI_LIBRARIENET = /^Cărți$/;

// ---------- LIBREX (feed_e0aae345e) — <category> = ultima subcategorie din feed ----------
const LIBREX_COPII = "carti-copii-3.json";
const REGULI_LIBREX = {
  "Carti educative": LIBREX_COPII,
  "Carti de povesti": LIBREX_COPII,
  "Literatura pentru copii": LIBREX_COPII,
  "Bookurii pentru copii": LIBREX_COPII,
  "Carti pentru copii si bebelusi": LIBREX_COPII,
  "Carti cu activitati si jocuri pentru copii": LIBREX_COPII,
  "Carti de colorat": LIBREX_COPII,
  "Carti de Craciun": LIBREX_COPII,
  "Carti cu Abtibilduri": LIBREX_COPII,
  "Carti cu sunete": LIBREX_COPII,
  "Enciclopedii pentru copii": LIBREX_COPII,
  "Legende si mituri": LIBREX_COPII,
  "Carti Puzzle": LIBREX_COPII,
  "Carti cu Animale": LIBREX_COPII,
  "Basme": LIBREX_COPII,
  "Carti cu poezii": LIBREX_COPII,
  "Fabule": LIBREX_COPII,
  "Dictionare pentru copii": LIBREX_COPII,
  "Carti pentru adolescenti": LIBREX_COPII,
  "Manuale si auxiliare scolare": "manuale-scolare-2.json",
  "Back to school": "manuale-scolare-2.json",
  "Atlase": "materii-suplimentare.json",
  "Enciclopedii": "materii-suplimentare.json",
  "Dictionare Tematice": "materii-suplimentare.json",
  "Franceza": "materii-suplimentare.json",
  "Germana": "materii-suplimentare.json",
  "Carti Parenting": "carti-parenting.json",
  "Psihologia copilului": "carti-parenting.json",
  "Mama si copilul": "carti-parenting.json",
  "Pedagogie": "carti-parenting.json",
  "Jocuri puzzle copii": JOCURI,
  "Jocuri de societate": JOCURI,
  "Jucarii educative": JOCURI,
  // tot restul (beletristica, istorie, psihologie...) intra in catalogul de adulti (pasul 4d), nu aici
};
// ---------- GRUPDZC (feed_0b61412e9) ----------
// Feed generalist (56.000+ produse, 906 categorii). Intra pe site doar categoriile de mai jos,
// verificate pe esantioane de titluri (14.10.2026). Restul (romane, religie, drept, medicina,
// vesela, gradina, animale, cosmetice, decoratiuni de Craciun, gadgeturi) e ignorat intentionat.
// Exclus la cererea utilizatorului: „Familie" (nu intra la parenting), cartile pentru adulti.
const GRUPDZC_REGULI = [
  ["manuale-scolare-2.json", /^(Carte Scolara|Pedagogie|Semestrul|Clasa|Abecedare|Fairyland|Teste|Admitere|Auxiliare|Lecturi scolare|Lecturi$|Bibliografie scolara|Culegeri|Marius Burtea|Carti de Lucretia|Bacalaureat|Evaluare|Pachete Evaluare|Comunicare in limba romana|Matematica si explorarea mediului|Domeniul|Activitati extracurriculare|Carti pentru Premii|Invatamant profesional)|Clas(a|ele) |Clasa \d|clasa /],
  ["carti-parenting.json", /^Parenting$/],
  ["carti-copii-3.json", /^(Carti pentru copii|Povesti pentru copii|Povesti|Carti de colorat|Carti ilustrate|Atlase si enciclopedii pentru copii|Legende si basme pentru copii|Poezii pentru copii|Carte de activitati|Carti cu sunete|Carti Montessori|Colinde si poezii|Carti educative|Harta Lumii pentru copii)$/],
  ["materii-suplimentare.json", /^(Dictionare.*|Dictionar|Limba Engleza|Limba engleza|Limba Germana|Limba germana|Limba Franceza|Limba franceza|Carti de gramatica|Enciclopedii Dictionare si Atlase|Atlase.*|Atlas .*|Harta.*|Folio-Cartografie|Cugetari.*|Cultura generala)$/],
  ["articole-scolare-accesorii.json", /^(Ghiozdane si genti|Rucsacuri|Penare|Semn de carte)$/],
  ["rechizite-papetarie.json", /^(Caiete si coperti|Carioci si markere|Pixuri|Rollere|Creioane|Creioane colorate|Tempera si acuarele|Acuarele si pensule|Pensule si instrumente desen|Seturi pictura si desen|Hartie copiator.*|Cuburi hartie.*|Capsatoare.*|Perforatoare|Rezerve instrumente de scris|Blocuri de desen|Instrumente de geometrie|Plastilina|Nisip modelabil|Stilouri|Corectoare|Plicuri|Accesorii birou|Rechizite scolare|Rechizite|Hartie creponata|Hartie gumata|Tusuri.*|Registre si Repertoare|Dosare|Bibliorafturi|Etichete autoadezive|Ace .*|Accesorii pentru tabla|Diploma.*|Adezivi si benzi adezive|Suporturi documente|Margele|Mozaic|Lucru manual|Abtibilduri si stampile|Coloreaza accesorii|Deseneaza|Pictura|Arta si desen|Slime .*|File de protectie|Cutii arhivare.*)$/],
  ["articole-scolare-jocuri.json", /^(Jucarii.*|Jucarie.*|LEGO.*|Accesorii LEGO|Puzzle.*|Jocuri.*|Joc .*|Papusi|Set de joaca pentru papusi|Casute de papusi.*|Haine si accesorii pentru papusi|Masinute.*|Masini de (lux|curse|interventie|constructii).*|Trenulete.*|Circuite si trenulete|Garaje si piste.*|Alte vehicule|Automachete|Minimodele|Motociclete de jucarie|Elicoptere.*|Figurine umane|Figurine|Dinozauri|Plusuri funny|Ursuleti de plus|Personaje din desene animate|Animale.*|Cai  ponei.*|Serpi.*|Super eroi|Lumi imaginare.*|Blastere Nerf.*|Seturi de asamblat|Cuburi jucarie|Labirint Lemn|Logica si Memorie|Forme si culori|Litere si limbaj|Experimente practice|Micul .*|Seturi de doctorat.*|Bucatarii copii|Carusele si proiectoare|Sunete si instrumente muzicale|Carti de joc|Mese fotbal.*|Casute si corturi copii|Triciclete si trotinete|Caini si pisici|La ferma|Ansambluri joaca)$/],
];
// Fisiere de carti: titlul „Carte - Autor" se imparte in titlu + autor (afisat sub titlu)
const GRUPDZC_CARTI = ["manuale-scolare-2.json", "carti-copii-3.json", "materii-suplimentare.json", "carti-parenting.json"];
function fisierGrupdzc(p) {
  const c = String(p.category || "").trim();
  const r = GRUPDZC_REGULI.find(([, rx]) => rx.test(c));
  return r ? r[0] : null;
}

// ---------- MUZICA SI FILM ----------
// Genurile din feed (<subcategory>) -> eticheta afisata pe site
const GENURI_MUZICA = {
  "Rock": "Rock", "Pop": "Pop", "Alternative/Indie": "Alternative/Indie", "Folk/Country": "Folk/Country",
  "Rap/Hip-Hop": "Rap/Hip-Hop", "R&B": "R&B", "Electro": "Electro", "Reggae": "Reggae", "Latin": "Latin",
  "Clasica": "Clasică", "Jazz/Blues": "Jazz/Blues", "Soundtrack": "Soundtrack", "Romaneasca": "Românească",
  "World Music": "World Music", "Muzica de Craciun": "Crăciun", "Pentru copii": "Pentru copii",
};
// Genurile care merg in muzica-film-1.json; restul (+ filmele) merg in muzica-film-2.json
const GENURI_FISIER_1 = ["Rock", "Pop", "Alternative/Indie", "Folk/Country", "Rap/Hip-Hop", "R&B", "Electro", "Reggae", "Latin"];
// Codul de bare (EAN) din <other_data> {"EAN":"..."} — folosit de mostrele audio Deezer de pe site
function eanDinFeed(p) {
  const m = String(p.other_data || "").match(/"EAN"\s*:\s*"(\d{8,14})"/);
  return m ? m[1] : "";
}
function fisierMuzica(p) {
  return GENURI_FISIER_1.includes(p.subcategory) ? "muzica-film-1.json" : "muzica-film-2.json";
}
const ACCESORII = "articole-scolare-accesorii.json";
const PARENTING = "carti-parenting.json";

// ---------- EDITURA CORINT (feed_8289d9f33) ----------
// Feed-ul nu are categorii utile (aproape toate „Cărţile noastre") si nici autor. Fisierul se alege asa:
//   1. titlu de parenting (parinte, copilul tau, prenatal...)          -> carti-parenting.json
//   2. titlu scolar (manual, caiet, clasa, bacalaureat, teste...)       -> manuale-scolare.json
//   3. dictionar, atlas, vocabular, gramatica, limba straina, enciclopedie -> materii-suplimentare.json
//   4. aceeasi carte (dupa titlu) in feed-urile celorlalte librarii: categoria lor decide
//      (copii -> carti-copii-2.json, scolar -> manuale, parenting) — ex. libris „Carti Pentru Copii"
//   5. negasita in alte feed-uri: copii doar daca descrierea o spune clar („varsta intre 5-9 ani", „cei mici")
// Restul (romane, istorie, memorii, young adult romance) e ignorat intentionat, ca la grupdzc:
// site-ul nu are (inca) o sectiune de carti pentru adulti. Verificat pe toate cele 1.278 de produse (20.10.2026).
const CORINT_FOLD = (s) => decode(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const CORINT_PARENTING = /parent|\bparinte|\bparintii|\bparintilor|copilul tau|copilului\b|copiii in fata|prenatal|bebelus/;
const CORINT_SCOLAR = /\b(manual|manualul|caiet|caietul|clasa|clasele|clasei|bacalaureat|evaluare|evaluarea|teste|test|auxiliar|culegere|admitere|olimpiad\w*|pregatire|fise|exercitii|probleme|formule|abecedar|bibliografie scolara|competente|trigonometri\w*|algebr\w*|geometri\w*|compendiu)\b/;
const CORINT_MATERII = /dictionar|vocabular|\batlas|\batlasul|\blimba (engleza|germana|franceza|spaniola|italiana)|\blese\b|arbeitsbuch|gramatica|enciclopedi/;
const CORINT_COPII_DESCRIERE = /varsta intre|\b\d{1,2}\s*[-–]\s*\d{1,2}\s*ani\b|cei mici|micii cititori|copiii vor|pentru copiii de|povesti ilustrate pentru copii|colectie de carti pentru copii|o poveste pentru copii/;
// titlul fara diacritice, serie, editie, „cu autograf", „Pachet A + B" -> „A"
function corintTitlu(t) {
  return CORINT_FOLD(t)
    .replace(/^pachet\s+/, "")
    .split(/\s\+\s/)[0]
    .split(/\s[-|]\s/)[0]
    .replace(/\(.*?\)/g, " ")
    .replace(/,?\s*(cu autograf|editie speciala|editia a [ivx]+-a|paperback|hardcover.*|hard cover|soft cover)\b.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
// categoria unei librarii -> tipul de pagina de pe site
function corintTipCategorie(c) {
  c = CORINT_FOLD(c).trim();
  if (/parenting|cresterea cop/.test(c)) return "parenting";
  if (/manual|auxiliar|scolar|clasa|clasele|semestrul|matematica|comunicare|evaluare|bacalaureat|lecturi/.test(c)) return "scolar";
  if (/cop(ii|il)|povest|poezii pentru|adolescen|ilustrate/.test(c)) return "copii";
  if (/dictionar|atlas|limbi straine|limba|enciclopedii|lexic/.test(c)) return "materii";
  if (/^(carte|carti|diverse|libhumanitas|noutati|ebooks|audiobooks|carti in limbi straine|jocuri|)$/.test(c)) return null;
  return "adulti";
}
// titlu -> categoriile aceleiasi carti la celelalte librarii (construit o singura data, la primul produs Corint)
let corintCategoriiExterne = null;
function fisierCorint(p) {
  if (!corintCategoriiExterne) {
    corintCategoriiExterne = new Map();
    for (const din of index.values()) {
      if (din.sursa === "edituracorint.ro") continue;
      const t = corintTitlu(din.p.title);
      if (t.length < 3) continue;
      if (!corintCategoriiExterne.has(t)) corintCategoriiExterne.set(t, new Set());
      corintCategoriiExterne.get(t).add(din.sursa + "|" + (din.p.category || ""));
    }
  }
  const t = CORINT_FOLD(p.title);
  if (CORINT_PARENTING.test(t) && !CORINT_SCOLAR.test(t)) return PARENTING;
  if (CORINT_SCOLAR.test(t)) return "manuale-scolare.json";
  if (CORINT_MATERII.test(t)) return "materii-suplimentare.json";
  const voturi = { copii: 0, scolar: 0, adulti: 0, materii: 0, parenting: 0 };
  for (const x of corintCategoriiExterne.get(corintTitlu(p.title)) || []) {
    const tip = corintTipCategorie(x.split("|").slice(1).join("|"));
    if (tip) voturi[tip]++;
  }
  if (voturi.parenting) return PARENTING;
  if (voturi.copii && voturi.copii >= voturi.adulti) return "carti-copii-2.json";
  if (voturi.scolar > voturi.adulti) return "manuale-scolare.json";
  if (voturi.materii && voturi.materii >= voturi.adulti) return "materii-suplimentare.json";
  if (!voturi.adulti && !voturi.copii && !voturi.scolar) {
    const d = CORINT_FOLD(String(p.description || "").replace(/#html-body[^}]*\}/g, " ").replace(/<[^>]+>/g, " "));
    if (CORINT_COPII_DESCRIERE.test(d)) return "carti-copii-2.json";
  }
  return null;
}

// ---------- EDITURA GAMA (feed_bd91e5f46) ----------
// Editura de carti pentru copii. Categoria din feed e o cale („Carti cu activitati/Dezvoltarea inteligentei/MultiQ"),
// iar fisierul se alege dupa ea (verificat pe toate cele 969 de produse active, 21.10.2026):
//   Carti pentru scoala (Exersez!, Memorator, Teste de 10 minute, Evaluare nationala...) -> manuale-scolare.json
//   Invatare prin joc (EduCard, EduFlash, Bingoletto, puzzle) si Tiki-Tan (jocuri Genius, lectii Montessori) -> jocuri
//   .../Parenting/... si Montessori/Ghiduri Montessori (ghiduri pentru parinti) -> carti-parenting.json
//   Jurnale, Jurnale cadou (albume, „Mami, te iubesc!") -> articole-scolare-accesorii.json
//   restul (activitati, lectura, povesti, Montessori pentru copii, cultura generala, fictiune, colorat) -> carti-copii-2.json
function fisierGama(p) {
  const c = String(p.category || "").trim();
  const top = c.split("/")[0].trim();
  if (/\/Parenting|Ghiduri Montessori|pentru parinti/i.test(c)) return PARENTING;
  if (top === "Carti pentru scoala") return "manuale-scolare.json";
  if (top === "Invatare prin joc" || top === "Tiki-Tan") return JOCURI;
  if (/^Jurnale/.test(top)) return ACCESORII;
  return "carti-copii-2.json";
}

const REGULI = {
  "feed_23ed00784.xml": { "Parenting": PARENTING },
  // libris, din 03.11.2026 (in locul feed-ului complet sters): carti pentru copii, parenting, accesorii
  "feed_30725b952.xml": { "Carti Pentru Copii": "carti-copii-1.json", "Cresterea Copilului": PARENTING },
  "feed_0c722f7a4.xml": { "Carti Pentru Copii": "carti-copii-1.json", "Parenting": PARENTING },
  // libris jocuri (din 07.11.2026). Fara figurine, felicitari, decoratiuni, cani, muzica, tricouri, bijuterii, martisoare.
  "feed_5d7d1b9bc.xml": {
    "Jocuri pentru copii": JOCURI,
    "Jocuri de societate": JOCURI,
    "Puzzle": JOCURI,
    "LEGO": JOCURI,
    "Agende si jurnale": ACCESORII,
    "Diverse": ACCESORII,
    "Semne de carte": ACCESORII,
    "Huse carte, Huse laptop": ACCESORII,
    "Lampi de citit": ACCESORII,
    "Suport carti (Bookends)": ACCESORII,
    "Termos, sticle apa, cani calatorie": ACCESORII,
    "Sacose de panza, Tote Bags": ACCESORII,
    "Calendare": ACCESORII,
  },
  "feed_02a848b11.xml": {
    "Hobby, arta, DIY": "rechizite-papetarie.json",
    "ROD": "rechizite-papetarie.json",
    "Jocuri si Jucarii": JOCURI,
    "Jucarii": JOCURI,
    "Fashion": ACCESORII,
  },
  "feed_e82be0de9.xml": {
    "Board Games": JOCURI,
    "Jocuri": JOCURI,
    "Puzzle": JOCURI,
    "Benzi desenate": JOCURI,
    "Diverse": ACCESORII,
    "Creșterea copiilor": PARENTING,
    "Pedagogie & Științele educației": PARENTING,
  },
  // grupdzc: 906 categorii -> fisierul se alege dupa categoria din feed (vezi fisierGrupdzc)
  "feed_0b61412e9.xml": { "*": fisierGrupdzc },
  // Editura Corint: fara categorii utile in feed -> fisierul se alege dupa titlu + librariile care vand aceeasi carte
  "feed_8289d9f33.xml": { "*": fisierCorint },
  // Editura Gama: carti pentru copii, impartite dupa calea de categorie din feed (vezi fisierGama)
  "feed_bd91e5f46.xml": { "*": fisierGama },
  // Muzica si film (carturesti): impartit in 2 fisiere dupa gen, ca fiecare sa ramana sub limita de marime
  "feed_952ab47b2.xml": { "Muzica": fisierMuzica, "Film": "muzica-film-2.json" },
  // brickplanet: feed-ul nu are categorii -> toate produsele merg la jocuri ("*" = orice categorie)
  "feed_3dd5a1fd2.xml": { "*": JOCURI },
  // librex (din 11.11.2026): doar categoriile potrivite site-ului. Beletristica, spiritualitate, istorie,
  // psihologie, sanatate etc. NU intra in catalog — sunt folosite doar ca alternative de pret in books.json.
  // Ignorate si categoriile de promotie fara gen (Black Friday, 2 + 1 Gratis, Pachete BF, Recomandari Librex...).
  "feed_e0aae345e.xml": REGULI_LIBREX,
  "feed_bfb296a3b.xml": REGULI_CARTEPEDIA,
  "feed_dbcb0e675.xml": REGULI_CARTEPEDIA,
  "feed_f70ce214f.xml": REGULI_CARTEPEDIA,
  "feed_198b495ca.xml": REGULI_CARTEPEDIA,
  "feed_d399be9e5.xml": {
    "Diverse": "articole-scolare-accesorii.json",
    "Arts & Crafts": "articole-scolare-accesorii.json",
    "Jucării": "articole-scolare-jocuri.json",
    "Carte Școlară": "manuale-scolare.json",
  },
  "feed_d861df8a1.xml": {
    "Papetarie, birotica": "rechizite-papetarie.json",
    "Hobby, arta, DIY": "rechizite-papetarie.json",
    "Caiete, carnete": "rechizite-papetarie.json",
    "ROD": "rechizite-papetarie.json",
    "Instrumente de scris": "rechizite-papetarie.json",
    "Accesorii de birou": "rechizite-papetarie.json",
    "Scolaresti": "articole-scolare-accesorii.json",
    "Fashion": "articole-scolare-accesorii.json",
    "Home & Deco": "articole-scolare-accesorii.json",
    "Ceai & accesorii": "articole-scolare-accesorii.json",
    "Gadgeturi si accesorii": "articole-scolare-accesorii.json",
    "Genti si ghiozdane": "articole-scolare-accesorii.json",
    "Accesorii pentru cititori": "articole-scolare-accesorii.json",
    "Jocuri si Jucarii": "articole-scolare-jocuri.json",
    "Board games": "articole-scolare-jocuri.json",
    "Jucarii": "articole-scolare-jocuri.json",
  },
};

// ---------- PARENTING — carti aprobate manual (Editura Trei, Curtea Veche) ----------
// Aceste feed-uri nu au categorii pe teme, asa ca la parenting se adauga DOAR cartile din lista
// aprobata de utilizator (06.10.2026, 59 de titluri). Pentru titluri noi: adauga linkul de produs aici.
const PARENTING_APROBATE = [
  "https://www.curteaveche.ro/cele-cinci-limbaje-ale-iubirii-pentru-adolescenti",
  "https://www.curteaveche.ro/cele-5-limbaje-ale-iubirii-pentru-parintii-copiilor-cu-dizabilitati",
  "https://www.curteaveche.ro/cum-sa-i-asculti-pe-adolescenti-si-cum-sa-te-faci-ascultat",
  "https://www.curteaveche.ro/cum-sa-ti-arati-iubirea-fata-de-copilul-tau-adult",
  "https://www.curteaveche.ro/deserturi-raw-pentru-copii-si-parinti-sanatosi",
  "https://www.curteaveche.ro/fituici-de-parenting",
  "https://www.curteaveche.ro/ghid-esential-de-parenting",
  "https://www.curteaveche.ro/inteligenta-emotionala-in-educatia-copiilor",
  "https://www.curteaveche.ro/nu-esti-un-parinte-de-r*hat",
  "https://www.curteaveche.ro/pachet-parinti-calmi-copii-fericiti",
  "https://www.curteaveche.ro/parenting-constient",
  "https://www.curteaveche.ro/parenting-pozitiv",
  "https://www.curteaveche.ro/parenting-viral",
  "https://www.curteaveche.ro/puterile-nebanuite-ale-parintilor",
  "https://www.curteaveche.ro/parinti-mama",
  "https://www.curteaveche.ro/parinti-scrisori-remarcabile",
  "https://www.curteaveche.ro/parinti-tata",
  "https://www.curteaveche.ro/un-parinte-mai-bun",
  "https://www.edituratrei.ro/carte/cartea-pe-care-v-ati-fi-dorit-sa-o-citeasca-parintii-vostri/14254/",
  "https://www.edituratrei.ro/carte/cartea-pe-care-v-ati-fi-dorit-sa-o-citeasca-parintii-vostri/11867/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-esti-foarte-timid-ghid-pentru-copiii-care-vor-sa-scape-de-anxietatea-sociala/11441/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-mintea-ti-se-blocheaza-ghid-pentru-copiii-care-se-confrunta-cu-toc-tulburarea/11326/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-stirile-de-sperie-un-ghid-pentru-copiii-care-vor-sa-inteleaga-evenimentele-recente/11866/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-ai-capatat-obiceiuri-proaste-un-ghid-destinat-copiilor-care-nu-reusesc-sa-scape-de/11451/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-nu-e-corect-ghid-pentru-copiii-care-vor-sa-faca-fata-invidiei-si-geloziei/11357/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-te-cuprinde-frica-ghid-pentru-copiii-care-vor-sa-si-infranga-fobiile/11215/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-iti-iesi-din-fire-ghid-pentru-copiii-care-nu-si-pot-stapani-furia/11686/",
  "https://www.edituratrei.ro/carte/ce-sa-faci-cand-ti-e-frica-sa-te-bagi-in-pat-ghid-pentru-copiii-care-adorm-greu/11043/",
  "https://www.edituratrei.ro/carte/cine-i-seful-aici/13500/",
  "https://www.edituratrei.ro/carte/conflicte-care-apropie/15026/",
  "https://www.edituratrei.ro/carte/copii-obraznici-asa-ceva-nu-exista/10850/",
  "https://www.edituratrei.ro/carte/crescuti-in-puf/15214/",
  "https://www.edituratrei.ro/carte/cand-obosesti-sa-mai-fii-parinte/10202/",
  "https://www.edituratrei.ro/carte/de-ale-gurii-carte-de-nutritie-pentru-copii-si-parinti/12050/",
  "https://www.edituratrei.ro/carte/disciplina-cu-suflet/11538/",
  "https://www.edituratrei.ro/carte/fericire-mostenita/15232/",
  "https://www.edituratrei.ro/carte/ghid-pentru-rezolvarea-dificultatilor-psihice-ale-copiilor-si-adolescentilor/11889/",
  "https://www.edituratrei.ro/carte/ghid-pentru-rezolvarea-dificultatilor-psihice-ale-copiilor-si-adolescentilor/14294/",
  "https://www.edituratrei.ro/carte/imperativele-adolescentei/14316/",
  "https://www.edituratrei.ro/carte/imperativele-adolescentei/10899/",
  "https://www.edituratrei.ro/carte/instrumentar-de-tehnici-terapeutice-creative-cum-lucram-cu-adolescentii-si-copiii-cu-trauma-de/11689/",
  "https://www.edituratrei.ro/carte/mog-si-bebelusul/11675/",
  "https://www.edituratrei.ro/carte/mama-pentru-prima-data/15170/",
  "https://www.edituratrei.ro/carte/maturizeaza-te/13811/",
  "https://www.edituratrei.ro/carte/maturizeaza-te/13726/",
  "https://www.edituratrei.ro/carte/ma-poti-ajuta-un-ghid-pentru-parinti/11771/",
  "https://www.edituratrei.ro/carte/pachet-dezvoltarea-copilului-si-adolescentei/14750/",
  "https://www.edituratrei.ro/carte/pachet-ghid-complet-parinti/14587/",
  "https://www.edituratrei.ro/carte/pachet-mog-in-familie/14844/",
  "https://www.edituratrei.ro/carte/pachet-parenting-constient/14584/",
  "https://www.edituratrei.ro/carte/pachet-parenting-creativ/14588/",
  "https://www.edituratrei.ro/carte/pachet-prietenii-clasice/14826/",
  "https://www.edituratrei.ro/carte/perfectionismul-in-copilarie-si-adolescenta/13323/",
  "https://www.edituratrei.ro/carte/parintele-constient/13272/",
  "https://www.edituratrei.ro/carte/parintele-constient/11761/",
  "https://www.edituratrei.ro/carte/parintele-eficient/11432/",
  "https://www.edituratrei.ro/carte/retete-de-jocuri-de-ce-si-cum-sa-te-joci-cu-copilul-tau/11387/",
  "https://www.edituratrei.ro/carte/secrete-si-sinceritate/13624/",
  "https://www.edituratrei.ro/carte/terapia-schemelor-pentru-copii-si-adolescenti/11555/"
];

// ============================================================
// Utilitare
// ============================================================
function decode(s) {
  if (!s) return "";
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .trim();
}

// Cheia unui produs: URL-ul fara parametri, fara www, litere mici
function cheie(url) {
  return decode(url || "")
    .split("?")[0]
    .replace(/\/+$/, "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .toLowerCase();
}

// Cheia unui produs din feed. Unele feed-uri (ex. brickplanet) nu au <url>:
// atunci cheia vine din id-ul produsului din calea imaginii, altfel din codul unique al linkului.
function cheieFeed(p) {
  if (p.url) return cheie(p.url);
  const img = (p.image_urls || "").split(",")[0];
  const bp = img.match(/brickplanet\.ro\/continut\/produse\/\w+\/(\d+)\//i);
  if (bp) return "brickplanet.ro/produs/" + bp[1];
  const u = (decode(p.aff_code || "").match(/[?&]unique=([^&]+)/) || [])[1];
  return u ? "2p/" + u : "";
}
// Cheie veche de rezerva (id din calea imaginii), pentru produsele adaugate cand feed-ul nu avea <url>.
// Daca feed-ul primeste ulterior <url>, produsele vechi sunt recunoscute dupa aceasta cheie si trec pe url.
function cheieImagine(p) {
  const img = (p.image_urls || "").split(",")[0];
  const bp = img.match(/brickplanet\.ro\/continut\/produse\/\w+\/(\d+)\//i);
  return bp ? "brickplanet.ro/produs/" + bp[1] : "";
}
// Cheia unui produs din JSON: productUrl, sau productId pentru produsele din feed-uri fara url
function cheieItem(it) {
  return it.productUrl ? cheie(it.productUrl) : it.productId || "";
}

function formatPret(n) {
  return n.toFixed(2).replace(".", ",") + " Lei";
}

// Parser XML minimal pentru structura 2Performant: <items><item><tag>val</tag>...</item></items>
function citesteFeed(fisier) {
  const xml = fs.readFileSync(fisier, "utf8");
  const produse = [];
  const reItem = /<item>([\s\S]*?)<\/item>/g;
  const reTag = /<(\w+)>([\s\S]*?)<\/\1>|<(\w+)\s*\/>/g;
  let m;
  while ((m = reItem.exec(xml))) {
    const p = {};
    let t;
    reTag.lastIndex = 0;
    while ((t = reTag.exec(m[1]))) {
      if (t[1]) p[t[1]] = decode(t[2]);
      else p[t[3]] = "";
    }
    // feed-uri reduse fara <product_active>: produsul e in feed -> e activ
    if (!("product_active" in p)) p.product_active = "true";
    produse.push(p);
  }
  return produse;
}

// Transforma un produs din feed in formatul JSON al site-ului
function dinFeed(p, sursa, categorieSite) {
  let titlu = p.title || "";
  let brand = (p.brand || "").trim();
  let imagine = (p.image_urls || "").split(",")[0].trim();

  if (sursa === "cartepedia.ro") {
    // „Titlu - Hardcover - Autor - Editura" -> „Titlu"
    titlu = titlu.split(" | ")[0].split(" - ")[0].trim();
    const autor = (p.other_data || "").trim();
    brand = autor && !autor.startsWith("{") ? autor : "cartepedia.ro";
  } else if (sursa === "carturesti.ro" && /^muzica-film/.test(categorieSite)) {
    // „Album | Artist" -> titlu = album, brand = artist (in feed, <brand> e casa de discuri)
    const i = titlu.indexOf(" | ");
    if (i > 0) {
      brand = titlu.slice(i + 3).trim();
      titlu = titlu.slice(0, i).trim();
    }
    if (!brand) brand = sursa;
    imagine = imagine.replace("https://carturesti.ro/img-prod/", "https://cdn.dc5.ro/img-prod/");
  } else if (sursa === "carturesti.ro") {
    // „Produs | Brand" -> „Produs"; imaginile de pe cdn.dc5.ro (carturesti blocheaza hotlink)
    if (brand && titlu.endsWith(" | " + brand)) titlu = titlu.slice(0, -(" | " + brand).length).trim();
    imagine = imagine.replace("https://carturesti.ro/img-prod/", "https://cdn.dc5.ro/img-prod/");
    if (!brand) brand = sursa;
  } else if (sursa === "grupdzc.ro") {
    // carti: „Titlu - Autor1, Autor2" -> titlu + autor; la jucarii/papetarie ramane brandul din feed
    const esteCarte = GRUPDZC_CARTI.some((f) => f.replace(/(-\d+)?\.json$/, "") === categorieSite);
    const i = titlu.lastIndexOf(" - ");
    if (esteCarte && i > 0 && titlu.length - i < 90) {
      brand = titlu.slice(i + 3).trim();
      titlu = titlu.slice(0, i).trim();
    }
    if (!brand || brand === '""') brand = sursa;
  } else if (sursa === "librex.ro") {
    // feed fara autor: <brand> e editura -> „Editura X"
    brand = brand && brand !== "-" ? (/^editura\b/i.test(brand) ? brand : "Editura " + brand) : sursa;
  } else if (sursa === "brickplanet.ro") {
    if (!brand) brand = /LEGO/i.test(p.title + " " + (p.description || "")) ? "LEGO" : sursa;
  } else if (sursa === "edituragama.ro") {
    // feed-ul nu are autor/brand
    brand = "Editura Gama";
  } else if (sursa === "edituracorint.ro") {
    // feed-ul nu are autor (<brand> = „CORINT"); unele titluri sunt scrise cu majuscule („TRIGONOMETRIA")
    brand = "Editura Corint";
    if (titlu === titlu.toUpperCase() && /[A-ZĂÂÎȘȚŞŢ]{4}/.test(titlu)) titlu = titlu.charAt(0) + titlu.slice(1).toLowerCase();
  } else {
    if (!brand || brand === "-") brand = sursa;
  }

  if (titlu) titlu = titlu.charAt(0).toUpperCase() + titlu.slice(1);

  const item = {
    title: titlu,
    brand,
    sourceSite: sursa,
    productUrl: p.url,
    affiliate: p.aff_code,
    image: imagine,
    category: categorieSite,
  };
  if (!p.url) {
    delete item.productUrl;
    item.productId = cheieFeed(p);
  }
  if (/^muzica-film/.test(categorieSite)) {
    // gen + format, folosite de filtrele de pe pagina muzica-film.html
    item.genre = p.category === "Film" ? "Filme" : GENURI_MUZICA[p.subcategory] || "Altele";
    if (p.category !== "Film" && (p.subcategory === "Vinil" || /\b(vinyl|vinil|LP)\b/i.test(p.title))) item.vinyl = true;
    const ean = eanDinFeed(p);
    if (ean) item.ean = ean;
  }
  aplicaPret(item, p);
  return item;
}

// Pune pretul, pretul vechi si reducerea (pastrand ordinea cheilor)
function aplicaPret(item, p) {
  const pret = parseFloat(p.price);
  const vechi = parseFloat(p.old_price);
  delete item.price;
  delete item.oldPrice;
  delete item.discount;
  item.price = formatPret(pret);
  if (vechi > pret) {
    const red = Math.round(((vechi - pret) / vechi) * 100);
    if (red >= 1) {
      item.oldPrice = formatPret(vechi);
      item.discount = red + "%";
    }
  }
}

// ============================================================
// Program
// ============================================================
const raport = {
  data: new Date().toISOString(),
  dryRun: DRY_RUN,
  feeduri: {},
  fisiere: {},
  avertismente: [],
};
const avert = (msg) => {
  raport.avertismente.push(msg);
  console.warn("⚠️  " + msg);
};

// 1. Citeste feed-urile
const index = new Map(); // cheie -> { p, feed, sursa }
const alias = new Map(); // cheie veche (productId) -> cheie noua (url), cand un feed primeste <url>
// cauta un produs din JSON in feed-uri: dupa cheia lui sau, la produsele vechi, dupa alias
const dinIndex = (it) => index.get(cheieItem(it)) || (alias.has(cheieItem(it)) ? index.get(alias.get(cheieItem(it))) : undefined);
const incarcate = new Set();
// Alege cea mai noua descarcare: feed_<cod>.xml, feed_<cod>_1.xml, feed_<cod> (2).xml ...
function gasesteFeed(fisier) {
  const cod = fisier.replace(/^feed_/, "").replace(/\.xml$/, "");
  const re = new RegExp("^feed_" + cod + "(?:[_ ]?\\(?\\d+\\)?)?\\.xml$", "i");
  const candidati = fs.readdirSync(FEEDS_DIR).filter((f) => re.test(f));
  if (!candidati.length) return null;
  candidati.sort((a, b) => fs.statSync(path.join(FEEDS_DIR, b)).mtimeMs - fs.statSync(path.join(FEEDS_DIR, a)).mtimeMs || b.localeCompare(a));
  return path.join(FEEDS_DIR, candidati[0]);
}

for (const [fisier, cfg] of Object.entries(FEEDS)) {
  // sursa dezactivata: feed-ul nu se citeste (produsele ei nu mai pot fi alese nici ca alternativa in books.json)
  if (SURSE_DEZACTIVATE.includes(cfg.sursa)) continue;
  const cale = gasesteFeed(fisier);
  if (!cale) {
    avert(`Lipseste ${fisier} (${cfg.descriere}) — produsele din aceasta sursa nu se actualizeaza si nu se scot.`);
    continue;
  }
  const produse = citesteFeed(cale);
  incarcate.add(fisier);
  const mtime = fs.statSync(cale).mtimeMs;
  let active = 0;
  for (const p of produse) {
    const k = cheieFeed(p);
    if (!k) continue;
    if (p.product_active === "true") active++;
    if (!index.has(k)) index.set(k, { p, feed: fisier, sursa: cfg.sursa, feeds: new Set([fisier]), mtime });
    else {
      // acelasi produs in mai multe feed-uri (ex. libris complet + libris carti in romana):
      // pretul se ia din feed-ul descarcat cel mai recent (03.11.2026: feed-ul complet libris vechi „bloca" preturile)
      const ex = index.get(k);
      ex.feeds.add(fisier);
      if (mtime > ex.mtime + 60000 && ex.sursa === cfg.sursa) { ex.p = p; ex.feed = fisier; ex.mtime = mtime; }
    }
    const kVechi = p.url ? cheieImagine(p) : "";
    if (kVechi && !alias.has(kVechi)) alias.set(kVechi, k);
    // produse salvate cand feed-ul a venit fara <url> (cheie „2p/<cod unique>"): trec pe url cand url-ul apare
    // (s-a intamplat la Corint pe 20.10.2026: o descarcare fara <url> si fara <old_price>)
    const u2p = p.url ? (decode(p.aff_code || "").match(/[?&]unique=([^&]+)/) || [])[1] : "";
    if (u2p && !alias.has("2p/" + u2p)) alias.set("2p/" + u2p, k);
  }
  raport.feeduri[fisier] = { descriere: cfg.descriere, produse: produse.length, active };
  raport.feeduri[fisier].fisierFolosit = path.basename(cale);
  const ore = (Date.now() - fs.statSync(cale).mtimeMs) / 3600000;
  raport.feeduri[fisier].vechimeOre = Math.round(ore);
  if (FEED_VECHI_STIUT.includes(fisier)) console.log(`ℹ️  ${path.basename(cale)} (vechi de ${Math.round(ore / 24)} zile) — feed șters din 2Performant, folosit doar pentru jocurile libris`);
  else if (ore > VECHIME_MAXIMA_ORE) avert(`${path.basename(cale)} e vechi de ${Math.round(ore)} ore — copiaza feed-ul nou din 2Performant.`);
  console.log(`📥 ${path.basename(cale)}: ${produse.length} produse (${active} active) — ${cfg.descriere}`);
}
{
  // feed-uri ale aceleiasi surse descarcate la date diferite -> avertisment
  const peSursa = {};
  for (const [f, info] of Object.entries(raport.feeduri)) {
    if (FEED_VECHI_STIUT.includes(f)) continue;
    const sursa = FEEDS[f].sursa;
    (peSursa[sursa] = peSursa[sursa] || []).push([info.fisierFolosit, info.vechimeOre]);
  }
  for (const [sursa, l] of Object.entries(peSursa)) {
    const ore = l.map((x) => x[1]);
    if (l.length > 1 && Math.max(...ore) - Math.min(...ore) > 24)
      avert(`${sursa}: feed-uri descărcate la date diferite (${l.map((x) => x[0] + " " + x[1] + "h").join(", ")}) — descarcă-le pe toate din nou.`);
  }
}
if (incarcate.size === 0) {
  console.error("❌ Niciun feed XML gasit in " + FEEDS_DIR);
  process.exit(1);
}

// 2. Citeste fisierele JSON
const date = {};
for (const f of JSON_FILES) {
  const cale = path.join(JSON_DIR, f);
  if (!fs.existsSync(cale)) {
    avert(`Lipseste ${f} — sarit.`);
    continue;
  }
  try {
    date[f] = JSON.parse(fs.readFileSync(cale, "utf8"));
  } catch (e) {
    avert(`${f} nu e JSON valid (${e.message}). Fisierul NU a fost atins — verifica-l sau restaureaza-l din git.`);
  }
}

// 3. Actualizeaza, scoate, deduplica
const vazute = new Set(); // chei deja prezente in fisierele procesate
const modificate = new Set();
// scoateri suspendate de pragul de siguranta: { fisier, sursa, n, total, chei:Set, exemple:[] }
const blocate = [];

for (const f of JSON_FILES) {
  if (!date[f]) continue;
  const initial = date[f];
  const r = { initial: initial.length, actualizate: 0, preturiSchimbate: 0, inactiveScoase: 0, disparuteScoase: 0, duplicateScoase: 0, adaugate: 0, final: 0, scoaterePlanificata: {} };

  // numarul de produse pe sursa, pentru pragul de siguranta
  const peSursa = {};
  for (const it of initial) peSursa[it.sourceSite] = (peSursa[it.sourceSite] || 0) + 1;

  // candidati la scoatere pe sursa (disparute din feed)
  const disparute = {};
  const autoritate = AUTORITATE[f] || {};
  for (const it of initial) {
    const feeduriSursa = autoritate[it.sourceSite];
    if (!feeduriSursa) continue;
    if (!feeduriSursa.every((x) => incarcate.has(x))) continue;
    if (!dinIndex(it)) disparute[it.sourceSite] = (disparute[it.sourceSite] || 0) + 1;
  }
  const scoatePeSursa = {};
  for (const [s, n] of Object.entries(disparute)) {
    const pondere = n / peSursa[s];
    r.scoaterePlanificata[s] = n;
    if (pondere > PRAG_SIGURANTA_SCOATERE) {
      avert(`${f}: ${n} din ${peSursa[s]} produse ${s} (${Math.round(pondere * 100)}%) lipsesc din feed — peste pragul de siguranta. Te intreb la final daca le scot.`);
      const chei = new Set();
      const exemple = [];
      for (const it of initial) {
        if (it.sourceSite !== s || dinIndex(it)) continue;
        chei.add(it);
        if (exemple.length < 5) exemple.push(it.title);
      }
      const feeduriSursa = autoritate[s];
      const inFeed = feeduriSursa.reduce((t, x) => t + ((raport.feeduri[x] || {}).active || 0), 0);
      blocate.push({ fisier: f, sursa: s, n, total: peSursa[s], inFeed, produse: chei, exemple });
    } else scoatePeSursa[s] = true;
  }

  const rezultat = [];
  r.dezactivateScoase = 0;
  for (const it of initial) {
    let k = cheieItem(it);
    // produs vechi fara url, iar feed-ul are acum url: trece pe url (cheia noua)
    if (!index.has(k) && alias.has(k)) {
      const din0 = index.get(alias.get(k));
      if (din0 && din0.p.url) {
        delete it.productId;
        it.productUrl = din0.p.url;
        k = alias.get(k);
        r.trecutePeUrl = (r.trecutePeUrl || 0) + 1;
      }
    }
    if (SURSE_DEZACTIVATE.includes(it.sourceSite)) {
      r.dezactivateScoase++;
      continue;
    }
    if (vazute.has(k)) {
      r.duplicateScoase++;
      continue;
    }
    const din = index.get(k);
    if (din) {
      if (din.p.product_active !== "true") {
        r.inactiveScoase++;
        continue;
      }
      const inainte = JSON.stringify(it);
      const pretVechi = it.price;
      aplicaPret(it, din.p);
      if (din.p.aff_code) it.affiliate = din.p.aff_code;
      let img = (din.p.image_urls || "").split(",")[0].trim();
      if (din.sursa === "carturesti.ro") img = img.replace("https://carturesti.ro/img-prod/", "https://cdn.dc5.ro/img-prod/");
      if (img) it.image = img;
      if (/^muzica-film/.test(it.category) && !it.ean && eanDinFeed(din.p)) it.ean = eanDinFeed(din.p);
      if (JSON.stringify(it) !== inainte) r.actualizate++;
      if (it.price !== pretVechi) r.preturiSchimbate++;
    } else if (scoatePeSursa[it.sourceSite] && autoritate[it.sourceSite]) {
      r.disparuteScoase++;
      continue;
    }
    vazute.add(k);
    rezultat.push(it);
  }
  date[f] = rezultat;
  raport.fisiere[f] = r;
}

// 4. Adauga produse noi
const APROBATE_SET = new Set(PARENTING_APROBATE.map(cheie));
if (!NO_ADD) {
  for (const [k, din] of index) {
    if (vazute.has(k)) continue;
    if (din.p.product_active !== "true") continue;
    if (SURSE_DEZACTIVATE.includes(din.sursa)) continue;
    if (!(parseFloat(din.p.price) > 0)) continue;
    // prima regula care se potriveste, in ordinea feed-urilor in care apare produsul
    let tinta = APROBATE_SET.has(k) ? PARENTING : null;
    for (const feed of tinta ? [] : din.feeds) {
      const reg = REGULI[feed] || {};
      let r = reg[din.p.category] || reg["*"];
      if (typeof r === "function") r = r(din.p);
      if (r) {
        tinta = r;
        break;
      }
    }
    if (!tinta || !date[tinta]) continue;
    const categorieSite = tinta.replace(/-\d+\.json$/, "").replace(/\.json$/, "");
    date[tinta].push(dinFeed(din.p, din.sursa, categorieSite));
    raport.fisiere[tinta].adaugate++;
    vazute.add(k);
  }
}

// 4b. books.json (catalogul curatoriat manual)
// Actualizeaza DOAR price / oldPrice / discount si pastreaza linkul de afiliere.
// Daca produsul nu mai e in feed-ul sursei lui (sau e inactiv), cauta aceeasi carte dupa titlu + autor
// in celelalte feed-uri; daca o gaseste, inlocuieste linkul de afiliere, productUrl si sursa.
// Prioritate la alternativa: autor confirmat > libris > pretul cel mai mic.
// Nu atinge sursele fara feed (actsipoliton etc.) — acelea raman pe update-prices.js.
const BOOKS_FILE = "books.json";
const SURSA_BOOKS = {
  // "source" din books.json -> sursa din FEEDS
  libris: "libris.ro",
  humanitas: "libhumanitas.ro",
  curteaveche: "curteaveche.ro",
  edituratrei: "edituratrei.ro",
  librarienet: "librarie.net",
  carturesti: "carturesti.ro",
  cartepedia: "cartepedia.ro",
  nemira: "nemira.ro",
  corint: "edituracorint.ro",
  gama: "edituragama.ro",
  librex: "librex.ro",
};
const BOOKS_DIN_SURSA = Object.fromEntries(Object.entries(SURSA_BOOKS).map(([a, b]) => [b, a]));
// Surse cu feed complet: o carte care lipseste peste tot e marcata available:false (ascunsa, revine automat).
// La librarie.net (Top 10.000) si carturesti (feed partial) lipsa din feed nu inseamna link mort -> raman neatinse.
const BOOKS_FEED_COMPLET = ["libris.ro", "libhumanitas.ro", "curteaveche.ro", "edituratrei.ro", "cartepedia.ro", "nemira.ro", "edituracorint.ro", "edituragama.ro", "librex.ro"];
// Feed-uri din care NU se iau alternative (link expirat / ebook-uri)
const BOOKS_FARA_ALTERNATIVE = ["feed_d861df8a1.xml", "feed_23ed00784.xml"];
// ---------- books.json: CEL MAI BUN PRET (din 03.11.2026) ----------
// La fiecare sync, fiecare carte din books.json (cu link 2Performant) e cautata in TOATE feed-urile,
// dupa titlu + autor confirmat. Regula:
//   1. se ia pretul cel mai mic gasit (min);
//   2. „banda": ofertele cu pret <= min + PRAG_BANDA_PRET (5%) sunt considerate la fel de bune;
//   3. daca oferta actuala e in banda, cartea RAMANE unde e (fara schimbari de link de la o zi la alta);
//   4. altfel (oferta actuala e mai scumpa cu peste 5% sau nu mai exista), trece pe librăria din banda
//      aflata cea mai sus in PRIORITATE_LIBRARII.
// Se pastreaza titlul, imaginea, descrierea si scorul; se schimba source, affiliate, productUrl, pretul.
// actsipoliton (program de afiliere propriu, fara 2Performant) nu e mutat.
const BOOKS_CEL_MAI_BUN_PRET = true;
const PRAG_BANDA_PRET = 0.05;
// ORDINEA TA (prima = preferata). Librariile care lipsesc din lista vin la final.
const PRIORITATE_LIBRARII = [
  "libris.ro",
  // "carturesti.ro" — scos 10.11.2026 (sursa dezactivata, vezi SURSE_DEZACTIVATE)
  "librarie.net",
  "cartepedia.ro",
  // "libhumanitas.ro" — scos 11.11.2026 (sursa dezactivata)
  "curteaveche.ro",
  "edituratrei.ro",
  "nemira.ro",
  "edituracorint.ro",
  "edituragama.ro",
  "grupdzc.ro",
  "librex.ro", // adaugat 11.11.2026 — muta-l mai sus daca vrei sa-l preferi la preturi egale
];
// Surse din books.json pe care sync-ul nu le atinge deloc (raman pe update-prices.js). Goala din 03.11.2026:
// humanitas trece prin regula de mai sus (feed-ul libhumanitas e inghetat din 9.10.2026, iar site-ul blocheaza scraperul).
const BOOKS_PE_SCRAPER = [];
// Feed-uri cu preturi INGHETATE: oferta lor nu e aleasa ca „mai ieftina" (pretul din feed nu mai e real).
// O carte deja la ei ramane acolo doar daca nu exista alta oferta.
const BOOKS_FEED_INGHETAT = ["libhumanitas.ro"];
// Cand cartea trece pe alta librarie/editie, coperta din books.json e inlocuita cu cea a produsului nou,
// ca cititorul sa vada exact editia pe care o cumpara (false = pastreaza imaginea ta).
const BOOKS_SCHIMBA_IMAGINEA = true;
// printrecarti.ro (carti la mana a doua, exemplar unic): feed-ul e ignorat pentru catalog, dar e citit
// DOAR pentru cartile din books.json cu link printrecarti. Cartea vanduta (lipsa/inactiva in feed) e inlocuita
// cu aceeasi carte noua din alt feed, daca exista, altfel e ascunsa (available:false).
const PRINTRECARTI_FEED = "feed_09200f7e9.xml";
const PRINTRECARTI_CAMPANIE = "f3492fc89";

function norm(s) {
  return decode(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/i/g, "a") // doar pentru comparatie: „atîția"/„atâția", feed-uri fara diacritice
    .trim();
}
function variantaTitluFeed(t) {
  const v = new Set();
  const full = decode(t || "");
  v.add(norm(full));
  const a = full.split(" | ")[0];
  v.add(norm(a));
  v.add(norm(a.split(/\s+-\s+/)[0]));
  return [...v].filter((x) => x.length >= 3);
}
function numeAutori(autor) {
  // „Morgan Housel" -> ["housel"]; „Peter Attia, Bill Gifford" -> ["attia","gifford"]
  return norm(autor)
    .split(/ si | and |,/)
    .flatMap((a) => (a.split(" ").filter((w) => w.length >= 3).slice(-1)))
    .filter(Boolean);
}
function pretBook(it, p) {
  const pret = parseFloat(p.price);
  const vechi = parseFloat(p.old_price);
  delete it.oldPrice;
  delete it.discount;
  it.price = formatPret(pret);
  if (vechi > pret) {
    const red = Math.round(((vechi - pret) / vechi) * 100);
    if (red >= 1) {
      it.oldPrice = formatPret(vechi);
      it.discount = "-" + red + "%";
    }
  }
}
const rangLibrarie = (s) => { const i = PRIORITATE_LIBRARII.indexOf(s); return i < 0 ? 99 : i; };
// din lista de oferte: banda de pret (min + 5%), apoi ordinea din PRIORITATE_LIBRARII, apoi pretul
function alegeDinBanda(lista) {
  lista = lista.filter((c) => !BOOKS_FEED_INGHETAT.includes(c.din.sursa));
  if (!lista.length) return null;
  const min = Math.min(...lista.map((c) => parseFloat(c.din.p.price)));
  const banda = lista.filter((c) => parseFloat(c.din.p.price) <= min * (1 + PRAG_BANDA_PRET) + 0.001);
  banda.sort((a, b) => rangLibrarie(a.din.sursa) - rangLibrarie(b.din.sursa) || parseFloat(a.din.p.price) - parseFloat(b.din.p.price));
  return banda[0];
}
function schimbaImaginea(it, p) {
  if (!BOOKS_SCHIMBA_IMAGINEA) return;
  const img = String(decode(p.image_urls || p.image || "")).split(",")[0].trim();
  if (img && /^https?:/.test(img)) { if (!it.imageOriginala) it.imageOriginala = it.image; it.image = img; }
}
function reordoneaza(it) {
  const ordine = ["title", "source", "author", "category", "score", "oldPrice", "price", "discount", "image", "affiliate", "productUrl"];
  const nou = {};
  for (const k of ordine) if (k in it) nou[k] = it[k];
  for (const k of Object.keys(it)) if (!(k in nou)) nou[k] = it[k];
  return nou;
}

const booksPath = path.join(JSON_DIR, BOOKS_FILE);
let books = null;
if (fs.existsSync(booksPath)) {
  try {
    books = JSON.parse(fs.readFileSync(booksPath, "utf8"));
  } catch (e) {
    avert(`${BOOKS_FILE} nu e JSON valid (${e.message}) — sarit.`);
  }
}
if (books) {
  const rb = { total: books.length, actualizate: 0, preturiSchimbate: 0, linkInlocuit: [], ascunse: [], reactivate: 0, faraFeed: 0, negasite: [] };
  // index dupa aff_code (pentru cartile fara productUrl) si dupa titlu (pentru alternative)
  const dupaAff = new Map();
  const dupaTitlu = new Map();
  for (const din of index.values()) {
    if (din.p.aff_code) dupaAff.set(din.p.aff_code.replace(/&amp;/g, "&"), din);
    if (din.p.product_active !== "true" || !(parseFloat(din.p.price) > 0)) continue;
    if ([...din.feeds].every((f) => BOOKS_FARA_ALTERNATIVE.includes(f))) continue;
    if (/\/ebook|e-?book/i.test(din.p.url + " " + din.p.category)) continue;
    if (/audio-?book|\baudio\b|\bcd\b|\bmp3\b/i.test(din.p.title + " " + din.p.url + " " + din.p.category)) continue;
    for (const v of variantaTitluFeed(din.p.title)) {
      if (!dupaTitlu.has(v)) dupaTitlu.set(v, []);
      dupaTitlu.get(v).push(din);
    }
  }
  const gasesteAlternativa = (it) => {
    const tFull = norm(it.title);
    const tScurt = norm(String(it.title).split(/[:(]/)[0]);
    const autori = numeAutori(it.author);
    const cand = new Map();
    for (const [t, tare] of [[tFull, true], [tScurt, false]]) {
      for (const din of dupaTitlu.get(t) || []) {
        const hay = " " + norm([din.p.title, din.p.url, din.p.brand, din.p.other_data, din.p.custom_field2].join(" ")) + " ";
        const autorOk = autori.length > 0 && autori.some((a) => hay.includes(" " + a + " "));
        const prev = cand.get(din);
        if (!prev || (tare && !prev.tare)) cand.set(din, { din, tare, autorOk });
      }
    }
    let lista = [...cand.values()].filter((c) => c.autorOk || (c.tare && tFull.length >= 12));
    if (lista.some((c) => c.autorOk)) lista = lista.filter((c) => c.autorOk);
    return alegeDinBanda(lista);
  };
  // toate ofertele active pentru carte, DOAR cu autor confirmat (folosit la „cel mai bun pret")
  const oferteConfirmate = (it) => {
    const tFull = norm(it.title);
    const tScurt = norm(String(it.title).split(/[:(]/)[0]);
    const autori = numeAutori(it.author);
    if (!autori.length) return [];
    const vazut = new Set();
    const out = [];
    for (const t of [tFull, tScurt]) {
      for (const din of dupaTitlu.get(t) || []) {
        if (vazut.has(din)) continue;
        vazut.add(din);
        const hay = " " + norm([din.p.title, din.p.url, din.p.brand, din.p.other_data, din.p.custom_field2].join(" ")) + " ";
        if (autori.some((a) => hay.includes(" " + a + " "))) out.push({ din, tare: t === tFull, autorOk: true });
      }
    }
    return out;
  };

  const unic = (link) => ((decode(link || "").match(/[?&]unique=([^&]+)/) || [])[1] || "");
  const dupaUnic = new Map();
  for (const din of index.values()) if (din.p.aff_code) dupaUnic.set(unic(din.p.aff_code), din);
  const CAMPANII = { "9a6f02fef": "libris.ro", da1148931: "librarie.net", "07b5f0fed": "carturesti.ro", "6f33f2a39": "cartepedia.ro", "9aab15f10": "libhumanitas.ro", f9db13aad: "curteaveche.ro", "9617003d6": "nemira.ro", "4dc37856e": "edituratrei.ro", "8dad9830f": "edituracorint.ro", "655dd2374": "edituragama.ro", "3085d2457": "librex.ro" };
  // sursa reala: din productUrl / campania linkului (campul "source" poate fi gresit)
  const sursaReala = (it) => {
    const dom = cheie(it.productUrl || "").split("/")[0];
    const dinUrl = Object.values(FEEDS).map((c) => c.sursa).find((s) => dom && dom.endsWith(s));
    const camp = (decode(it.affiliate || "").match(/campaign_unique=([^&]+)/) || [])[1];
    return dinUrl || CAMPANII[camp] || SURSA_BOOKS[it.source] || null;
  };
  // verifica ca produsul din feed e chiar cartea (prinde linkuri puse gresit in books.json)
  const aceeasiCarte = (it, p) => {
    const t = norm(String(it.title).split(/[:.(,]/)[0]);
    const tf = norm(String(p.title || "").split(/ \| | - |[:.(,]/)[0]);
    const hay = norm((p.title || "") + " " + (p.url || ""));
    return t.length > 0 && (hay.includes(t) || (tf.length >= 4 && t.includes(tf)));
  };
  rb.linkReinnoit = 0;
  rb.linkGresit = [];
  rb.faraFeedTitluri = [];
  rb.mutatePret = [];

  // printrecarti: se citeste doar daca exista carti cu link printrecarti in books.json
  let printre = null;
  if (books.some((it) => String(it.affiliate || "").includes(PRINTRECARTI_CAMPANIE))) {
    const cale = gasesteFeed(PRINTRECARTI_FEED);
    if (cale) {
      printre = new Map();
      for (const p of citesteFeed(cale)) {
        const u = unic(p.aff_code);
        if (u) printre.set(u, { title: p.title, url: p.url, price: p.price, old_price: p.old_price, product_active: p.product_active });
      }
      const ore = (Date.now() - fs.statSync(cale).mtimeMs) / 3600000;
      console.log(`📥 ${path.basename(cale)}: ${printre.size} produse — printrecarti (doar pentru books.json)`);
      if (ore > VECHIME_MAXIMA_ORE) avert(`${path.basename(cale)} e vechi de ${Math.round(ore)} ore — copiaza feed-ul nou din 2Performant.`);
    } else {
      avert(`Lipseste ${PRINTRECARTI_FEED} (printrecarti) — cartile printrecarti din books.json nu se verifica.`);
    }
  }

  books = books.map((it) => {
    // printrecarti (exemplar unic, la mana a doua)
    if (String(it.affiliate || "").includes(PRINTRECARTI_CAMPANIE)) {
      if (!printre) { rb.negasite.push(`${it.title} (printrecarti, feed lipsa)`); return it; }
      const inainte = JSON.stringify(it);
      const pretInainte = it.price;
      const p = printre.get(unic(it.affiliate));
      if (p && p.product_active === "true" && parseFloat(p.price) > 0) {
        pretBook(it, p);
        if (it.available === false) { it.available = true; rb.reactivate++; }
      } else {
        const alt = gasesteAlternativa(it);
        if (alt) {
          const d = alt.din;
          rb.linkInlocuit.push({ titlu: it.title, deLa: "printrecarti", la: BOOKS_DIN_SURSA[d.sursa] || d.sursa, autorConfirmat: alt.autorOk, titluFeed: d.p.title, url: d.p.url });
          it.source = BOOKS_DIN_SURSA[d.sursa] || d.sursa;
          it.affiliate = d.p.aff_code.replace(/&amp;/g, "&");
          it.productUrl = d.p.url;
          pretBook(it, d.p);
          if (it.available === false) { it.available = true; rb.reactivate++; }
        } else {
          if (it.available !== false) rb.ascunse.push(it.title + " (printrecarti: vândută, nicio ediție nouă în feeduri)");
          it.available = false;
        }
      }
      const nou = reordoneaza(it);
      if (JSON.stringify(nou) !== inainte) rb.actualizate++;
      if (nou.price !== pretInainte) rb.preturiSchimbate++;
      return nou;
    }
    const sursa = sursaReala(it);
    if (!sursa || BOOKS_PE_SCRAPER.includes(sursa) || !String(it.affiliate || "").includes("2performant")) {
      rb.faraFeed++;
      rb.faraFeedTitluri.push(`${it.title} (${it.source})`);
      return it;
    }
    const inainte = JSON.stringify(it);
    const pretInainte = it.price;
    const activ = (d) => d && d.p.product_active === "true" && parseFloat(d.p.price) > 0;
    // 1) linkul de afiliere exista in feed?  2) altfel, acelasi produs (productUrl) cu link nou?
    let din = dupaUnic.get(unic(it.affiliate)) || null;
    let reinnoit = false;
    if (din && !aceeasiCarte(it, din.p)) {
      rb.linkGresit.push(`${it.title} → linkul duce la „${din.p.title}"`);
      din = null;
    }
    if (!activ(din) && it.productUrl) {
      const d2 = index.get(cheie(it.productUrl));
      if (activ(d2) && aceeasiCarte(it, d2.p)) { din = d2; reinnoit = true; }
    }
    if (activ(din)) {
      pretBook(it, din.p);
      if (reinnoit && din.p.aff_code) { it.affiliate = din.p.aff_code.replace(/&amp;/g, "&"); rb.linkReinnoit++; }
      it.source = BOOKS_DIN_SURSA[din.sursa] || it.source;
      if (it.available === false) { it.available = true; rb.reactivate++; }
      // cel mai bun pret: mutam cartea doar daca oferta actuala e cu peste 5% peste cea mai ieftina
      if (BOOKS_CEL_MAI_BUN_PRET) {
        const oferte = oferteConfirmate(it);
        if (!oferte.some((o) => o.din === din)) oferte.push({ din, tare: true, autorOk: true });
        const valide = oferte.filter((o) => !BOOKS_FEED_INGHETAT.includes(o.din.sursa));
        const min = valide.length ? Math.min(...valide.map((o) => parseFloat(o.din.p.price))) : Infinity;
        const actual = parseFloat(din.p.price);
        // oferta din feed inghetat nu e de incredere: cartea pleaca de acolo cand alternativa nu e cu peste 5% mai scumpa
        // (ex. „Jurnalul Annei Frank": 40,46 la Humanitas vs 59,00 la Cartepedia -> ramane la Humanitas)
        const actualInghetat = BOOKS_FEED_INGHETAT.includes(din.sursa);
        const mutam = actualInghetat ? min <= actual * (1 + PRAG_BANDA_PRET) + 0.001 : actual > min * (1 + PRAG_BANDA_PRET) + 0.001;
        if (valide.length && mutam) {
          const best = alegeDinBanda(oferte);
          if (best && best.din !== din) {
            const d = best.din;
            rb.mutatePret.push({ titlu: it.title, deLa: BOOKS_DIN_SURSA[din.sursa] || din.sursa, la: BOOKS_DIN_SURSA[d.sursa] || d.sursa, pretVechi: actual, pretNou: parseFloat(d.p.price), titluFeed: d.p.title, url: d.p.url });
            it.source = BOOKS_DIN_SURSA[d.sursa] || d.sursa;
            it.affiliate = d.p.aff_code.replace(/&amp;/g, "&");
            it.productUrl = d.p.url;
            pretBook(it, d.p);
            schimbaImaginea(it, d.p);
          }
        }
      }
    } else {
      const alt = gasesteAlternativa(it);
      if (alt) {
        const d = alt.din;
        rb.linkInlocuit.push({ titlu: it.title, deLa: it.source, la: BOOKS_DIN_SURSA[d.sursa] || d.sursa, autorConfirmat: alt.autorOk, titluFeed: d.p.title, url: d.p.url });
        it.source = BOOKS_DIN_SURSA[d.sursa] || d.sursa;
        it.affiliate = d.p.aff_code.replace(/&amp;/g, "&");
        it.productUrl = d.p.url;
        pretBook(it, d.p);
        schimbaImaginea(it, d.p);
        if (it.available === false) { it.available = true; rb.reactivate++; }
      } else if (SURSE_DEZACTIVATE.includes(sursa)) {
        // sursa dezactivata (ex. carturesti din 10.11.2026) si cartea nu e in niciun alt feed: o ascundem
        if (it.available !== false) rb.ascunse.push(it.title + " (" + sursa + " dezactivat, nicio alta librarie in feeduri)");
        it.available = false;
      } else if (BOOKS_FEED_COMPLET.includes(sursa) && feedurileSurseiIncarcate(sursa)) {
        if (it.available !== false) rb.ascunse.push(it.title);
        it.available = false;
      } else {
        rb.negasite.push(`${it.title} (${it.source})`);
      }
    }
    const nou = reordoneaza(it);
    if (JSON.stringify(nou) !== inainte) rb.actualizate++;
    if (nou.price !== pretInainte) rb.preturiSchimbate++;
    return nou;
  });
  raport.books = rb;
  console.log(
    `${BOOKS_FILE}\n   ${rb.total} cărți | actualizate ${rb.actualizate} (preț schimbat: ${rb.preturiSchimbate}) | link înlocuit ${rb.linkInlocuit.length} | ascunse ${rb.ascunse.length} | reactivate ${rb.reactivate} | fără feed (neatinse) ${rb.faraFeed} | negăsite (neatinse) ${rb.negasite.length}`
  );
  for (const x of rb.linkInlocuit) console.log(`   🔁 ${x.titlu}: ${x.deLa} → ${x.la}${x.autorConfirmat ? "" : " (autor neconfirmat — verifică)"}`);
  for (const x of rb.ascunse) console.log(`   🙈 ascunsă (nu mai e în niciun feed): ${x}`);
  for (const x of rb.linkGresit) console.log(`   ⚠️  link greșit în books.json: ${x}`);
  for (const x of rb.negasite) console.log(`   ❔ negăsită în feed (neatinsă): ${x}`);
  for (const x of rb.mutatePret) console.log(`   💸 ${x.titlu}: ${x.deLa} ${formatPret(x.pretVechi)} → ${x.la} ${formatPret(x.pretNou)} (verifică ediția: ${x.titluFeed})`);
  if (rb.mutatePret.length) console.log(`   💸 ${rb.mutatePret.length} cărți mutate pe librăria mai ieftină (regula „cel mai bun preț", banda ${Math.round(PRAG_BANDA_PRET * 100)}%)`);
  const faraScraper = rb.faraFeedTitluri.filter((t) => !/\(actsipoliton\)$/.test(t));
  if (faraScraper.length) console.log(`   ⚠️  fără feed și fără scraper (prețul NU se actualizează): ${faraScraper.join("; ")}`);
  console.log(`   ℹ️  actsipoliton (${rb.faraFeedTitluri.length - faraScraper.length} cărți) se actualizează cu: node update-prices.js`);
  if (rb.linkReinnoit) console.log(`   🔗 ${rb.linkReinnoit} linkuri reînnoite (același produs, cod de afiliere nou din feed)`);
  if (rb.actualizate && !DRY_RUN) {
    const stampB = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
    const dirB = path.join(__dirname, "backup-feed-sync", stampB);
    fs.mkdirSync(dirB, { recursive: true });
    fs.copyFileSync(booksPath, path.join(dirB, BOOKS_FILE));
    fs.writeFileSync(booksPath, JSON.stringify(books, null, 2) + "\n", "utf8");
    rb.salvat = true;
  }
}
function feedurileSurseiIncarcate(sursa) {
  const f = Object.entries(FEEDS).filter(([, c]) => c.sursa === sursa).map(([k]) => k);
  return f.length > 0 && f.some((x) => incarcate.has(x));
}

// 4c. Scoaterile suspendate de pragul de siguranta: intreaba utilizatorul
function intreaba(intrebare) {
  process.stdout.write(intrebare);
  if (!process.stdin.isTTY) {
    console.log("(fara tastatura — raspuns: nu)");
    return "";
  }
  const buf = Buffer.alloc(256);
  try {
    const n = fs.readSync(0, buf, 0, 256, null);
    return buf.toString("utf8", 0, n).trim().toLowerCase();
  } catch (e) {
    return "";
  }
}
raport.scoateriSuspendate = [];
if (blocate.length) {
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  PRODUSE DISPARUTE DIN FEED, PESTE PRAGUL DE SIGURANTA (" + Math.round(PRAG_SIGURANTA_SCOATERE * 100) + "%)");
  for (const b of blocate) {
    console.log(`\n   ${b.fisier} — ${b.sursa}: ${b.n} din ${b.total} produse nu mai sunt in feed (feed-ul are acum ${b.inFeed} produse active).`);
    console.log("   Exemple: " + b.exemple.map((t) => `„${t}"`).join(", "));
  }
  console.log("\n   Verifica feed-ul. Daca e corect, produsele de mai sus se scot de pe site.");
  let raspuns = "";
  if (DRY_RUN) console.log("   (DRY RUN — nu se scoate nimic)");
  else if (SCOATE_TOT) { console.log("   --scoate-tot: le scot fara intrebare."); raspuns = "da"; }
  else raspuns = intreaba("   Le scot? Scrie da sau nu si apasa Enter: ");
  const da = /^(da|d|y|yes)$/.test(raspuns);
  for (const b of blocate) {
    raport.scoateriSuspendate.push({ fisier: b.fisier, sursa: b.sursa, produse: b.n, scoase: da });
    if (!da) continue;
    const inainte = date[b.fisier].length;
    date[b.fisier] = date[b.fisier].filter((it) => !b.produse.has(it));
    raport.fisiere[b.fisier].disparuteScoase += inainte - date[b.fisier].length;
  }
  console.log(da ? "   ✅ Scoase." : "   ⏭  Nu am scos nimic din acestea; restul actualizarii se salveaza normal.");
}

// 4d. Catalogul de carti pentru adulti (reconstruit de la zero, vezi ADULTI_* mai sus)
function genAdulti(feed, p) {
  const c = String(p.category || "").trim();
  if (feed === "feed_30725b952.xml") return ADULTI_LIBRIS[c] || null;
  if (CARTEPEDIA.includes(feed)) return ADULTI_CARTEPEDIA[c] || null;
  if (feed === "feed_e0aae345e.xml") {
    if (REGULI_LIBREX[c]) return null; // e deja pe site, la copii/manuale/parenting/materii/jocuri
    if (ADULTI_LIBREX[c]) return ADULTI_LIBREX[c];
    return LIBREX_FARA_GEN.test(c) ? ALTE : null;
  }
  if (feed === "feed_0ab2094f6.xml") {
    const top = String(p.custom_field3 || "").split(">")[0].trim();
    return ADULTI_CURTEAVECHE[top] || null;
  }
  if (feed === "feed_0b61412e9.xml") {
    const r = ADULTI_GRUPDZC.find(([rx]) => rx.test(c));
    return r ? r[1] : null;
  }
  if (feed === "feed_d399be9e5.xml") return ADULTI_LIBRARIENET.test(c) ? ALTE : null;
  if (ADULTI_FARA_CATEGORII.includes(feed)) return ALTE;
  return null;
}
const raportAdulti = { carti: 0, oferte: 0, genuri: {}, fisiere: {}, salvat: false };
{
  // titlurile deja prezente pe site (copii, manuale, parenting, materii...) nu se repeta in catalogul de adulti
  const peSite = new Set();
  for (const f of Object.keys(date)) for (const it of date[f] || []) if (it && it.title) peSite.add(norm(it.title));
  const grupuri = new Map(); // titlu normalizat -> { oferta, gen }
  for (const din of index.values()) {
    const p = din.p;
    if (p.product_active !== "true" || !(parseFloat(p.price) > 0)) continue;
    if (SURSE_DEZACTIVATE.includes(din.sursa) || din.sursa === "libhumanitas.ro") continue;
    if (/audio-?book|e-?book|\bcd\b|\bmp3\b/i.test(p.title + " " + p.url + " " + p.category)) continue;
    let gen = null;
    for (const feed of din.feeds) {
      gen = genAdulti(feed, p);
      if (gen) break;
    }
    if (!gen) continue;
    const item = dinFeed(p, din.sursa, ADULTI_PREFIX);
    // „Titlu - Autor" (libris, grupdzc) -> titlu + autor; autorul din alte campuri la cartepedia/Trei
    const i = item.title.lastIndexOf(" - ");
    if (i > 0 && item.title.length - i < 90 && (din.sursa === "libris.ro" || din.sursa === "grupdzc.ro")) {
      item.brand = item.title.slice(i + 3).trim();
      item.title = item.title.slice(0, i).trim();
    }
    if (din.sursa === "edituratrei.ro" && p.custom_field2) item.brand = p.custom_field2.trim();
    const k = norm(item.title);
    if (!k || peSite.has(k)) continue;
    raportAdulti.oferte++;
    const pret = parseFloat(p.price);
    const g = grupuri.get(k);
    if (!g) {
      grupuri.set(k, { item, pret, gen });
      continue;
    }
    // genul: primul gen „adevarat" gasit (nu ALTE); oferta: cea mai ieftina
    if (g.gen === ALTE && gen !== ALTE) g.gen = gen;
    if (pret < g.pret) {
      // pastreaza autorul daca oferta noua are doar editura/librăria ca „brand"
      if (/^(Editura |Nemira$|Curtea Veche|cartepedia\.ro$|librarie\.net$|librex\.ro$)/.test(item.brand) && !/^(Editura |Nemira$|Curtea Veche|cartepedia\.ro$|librarie\.net$|librex\.ro$)/.test(g.item.brand)) item.brand = g.item.brand;
      g.item = item;
      g.pret = pret;
    }
  }
  const peGen = new Map(GENURI_ORDINE.map((gn) => [gn, []]));
  for (const g of grupuri.values()) {
    if (g.gen === ALTE || g.gen === "Științe umaniste și artă") g.gen = genDupaTitlu(g.item.title, g.gen);
    g.item.genre = g.gen;
    peGen.get(g.gen).push(g.item);
  }
  const manifest = { generat: new Date().toISOString(), total: 0, genuri: [] };
  const deScris = [];
  for (const [gen, lista] of peGen) {
    if (!lista.length) continue;
    lista.sort((a, b) => (parseInt(b.discount) || 0) - (parseInt(a.discount) || 0) || a.title.localeCompare(b.title, "ro"));
    const slug = GEN_SLUG[gen];
    const kb = Buffer.byteLength(JSON.stringify(lista)) / 1024;
    const bucati = Math.max(1, Math.ceil(kb / ADULTI_MAX_KB));
    const marime = Math.ceil(lista.length / bucati);
    const fisiere = [];
    for (let b = 0; b < bucati; b++) {
      const nume = `${ADULTI_PREFIX}-${slug}${bucati > 1 ? "-" + (b + 1) : ""}.json`;
      deScris.push([nume, lista.slice(b * marime, (b + 1) * marime)]);
      fisiere.push(nume);
    }
    manifest.genuri.push({ gen, slug, carti: lista.length, fisiere });
    manifest.total += lista.length;
    raportAdulti.genuri[gen] = lista.length;
  }
  raportAdulti.carti = manifest.total;
  console.log(`\ncarti-adulti (catalog nou, reconstruit): ${manifest.total} carti unice din ${raportAdulti.oferte} oferte`);
  for (const gn of manifest.genuri) console.log(`   ${gn.gen}: ${gn.carti} (${gn.fisiere.join(", ")})`);
  if (!DRY_RUN) {
    // sterge fisierele vechi de gen (ex. un gen impartit ieri in 2 si azi in 1)
    for (const f of fs.readdirSync(JSON_DIR)) if (new RegExp("^" + ADULTI_PREFIX + "-.+\\.json$").test(f) && !deScris.some(([n]) => n === f)) fs.unlinkSync(path.join(JSON_DIR, f));
    for (const [nume, lista] of deScris) {
      const text = JSON.stringify(lista) + "\n";
      fs.writeFileSync(path.join(JSON_DIR, nume), text, "utf8");
      raportAdulti.fisiere[nume] = Math.round(Buffer.byteLength(text) / 1024);
    }
    fs.writeFileSync(path.join(JSON_DIR, ADULTI_PREFIX + ".json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    raportAdulti.salvat = true;
  }
  raport.adulti = raportAdulti;
}

// 5. Salveaza
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
const backupDir = path.join(__dirname, "backup-feed-sync", stamp);
console.log("\n" + "=".repeat(60));
for (const f of Object.keys(raport.fisiere)) {
  const r = raport.fisiere[f];
  r.final = date[f].length;
  const schimbat = r.actualizate || r.inactiveScoase || r.disparuteScoase || r.duplicateScoase || r.adaugate || r.dezactivateScoase;
  console.log(
    `${f}\n   ${r.initial} → ${r.final} produse | actualizate ${r.actualizate} (preț schimbat: ${r.preturiSchimbate}) | +${r.adaugate} noi | −${r.inactiveScoase} inactive | −${r.disparuteScoase} disparute | −${r.duplicateScoase} duplicate` +
      (r.dezactivateScoase ? ` | −${r.dezactivateScoase} din surse dezactivate` : "") +
      (r.trecutePeUrl ? ` | ${r.trecutePeUrl} trecute pe linkul nou de produs` : "")
  );
  if (!schimbat || DRY_RUN) continue;
  const cale = path.join(JSON_DIR, f);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(cale, path.join(backupDir, f));
  let text = JSON.stringify(date[f], null, 2) + "\n";
  if (Buffer.byteLength(text) / 1024 > LIMITA_KB) {
    text = JSON.stringify(date[f]) + "\n";
    r.compact = true;
    avert(`${f} depasea ${LIMITA_KB} KB formatat — salvat compact (fara indentare).`);
  }
  r.marimeKB = Math.round(Buffer.byteLength(text) / 1024);
  if (r.marimeKB > LIMITA_KB) avert(`${f} are ${r.marimeKB} KB, peste limita de ${LIMITA_KB} KB chiar si compact — trebuie impartit in doua fisiere.`);
  fs.writeFileSync(cale, text, "utf8");
  modificate.add(f);
}
// marimea tuturor fisierelor (si a celor nemodificate)
for (const f of Object.keys(raport.fisiere)) {
  const cale = path.join(JSON_DIR, f);
  if (raport.fisiere[f].marimeKB == null && fs.existsSync(cale)) raport.fisiere[f].marimeKB = Math.round(fs.statSync(cale).size / 1024);
  if (raport.fisiere[f].marimeKB > LIMITA_KB) avert(`${f}: ${raport.fisiere[f].marimeKB} KB, peste ${LIMITA_KB} KB.`);
}
// pastreaza doar ultimele BACKUPURI_PASTRATE backup-uri
const rootBackup = path.join(__dirname, "backup-feed-sync");
if (fs.existsSync(rootBackup)) {
  const foldere = fs.readdirSync(rootBackup).filter((d) => /^\d{8}-\d{4}$/.test(d)).sort();
  for (const d of foldere.slice(0, Math.max(0, foldere.length - BACKUPURI_PASTRATE))) {
    fs.rmSync(path.join(rootBackup, d), { recursive: true, force: true });
  }
}
fs.writeFileSync(REPORT_PATH, JSON.stringify(raport, null, 2), "utf8");
console.log("📦 Marimi: " + Object.entries(raport.fisiere).map(([f, r]) => `${f.replace(".json", "")} ${r.marimeKB} KB`).join(" · "));
console.log("=".repeat(60));
if (DRY_RUN) console.log("🔎 DRY RUN — nimic salvat. Raport: sync-report.json");
else console.log(`✅ ${modificate.size} fisiere salvate. Backup: ${modificate.size ? backupDir : "-"}\n   Raport: sync-report.json`);
