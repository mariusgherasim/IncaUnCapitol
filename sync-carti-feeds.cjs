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
//   6. books.json: actualizeaza doar pretul / pretul vechi / reducerea, pastrand linkul de afiliere;
//      daca linkul nu mai e in feed, cauta aceeasi carte (titlu + autor) in alt feed si inlocuieste linkul.
//
// Nu are nevoie de npm install — foloseste doar Node.js.
//
// Rulare (din cmd, in folderul cu scriptul):
//   node sync-carti-feeds.cjs --dry-run                 (doar raport, nu salveaza nimic)
//   node sync-carti-feeds.cjs                           (actualizeaza fisierele)
//   node sync-carti-feeds.cjs --feeds=feeds --json=public\data
//   node sync-carti-feeds.cjs --fara-adaugare           (doar actualizeaza/scoate, nu adauga)
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
const SURSE_DEZACTIVATE = [];

// Daca mai mult de acest procent din produsele unei surse ar fi scoase dintr-un fisier,
// scoaterea se anuleaza pentru sursa respectiva (probabil feed gresit sau incomplet).
const PRAG_SIGURANTA_SCOATERE = 0.25;

// ---------- Feed-uri ----------
// Fisier XML -> sursa. Codurile vin din linkul feed-ului 2Performant (feeds.2performant.com/feed/<cod>.xml)
const FEEDS = {
  "feed_78ad15be7.xml": { sursa: "libris.ro", descriere: "libris — feed complet (carti, copii, jocuri, accesorii, ebooks)" },
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
  "feed_5d7d1b9bc.xml": { sursa: "libris.ro", descriere: "libris — Accesorii si cadouri (inclus in feed-ul complet)" },
  "feed_f23ec2538.xml": { sursa: "librarie.net", descriere: "librarie.net — Top 100 (inclus in Top 10.000)" },
  "feed_7bd1c15b9.xml": { sursa: "edituratrei.ro", descriere: "Editura Trei" },
  "feed_0ab2094f6.xml": { sursa: "curteaveche.ro", descriere: "Curtea Veche" },
  "feed_5b10a2be9.xml": { sursa: "nemira.ro", descriere: "Nemira" },
  "feed_e82be0de9.xml": { sursa: "libhumanitas.ro", descriere: "libhumanitas — feed complet" },
  "feed_3dd5a1fd2.xml": { sursa: "brickplanet.ro", descriere: "brickplanet — seturi LEGO (feed redus: fara url, categorie, stoc)" },
  "feed_952ab47b2.xml": { sursa: "carturesti.ro", descriere: "carturesti — Muzica si film (CD, vinil, DVD)" },
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
  "manuale-scolare.json",
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
const AUTORITATE = {
  "carti-copii-1.json": { "libris.ro": ["feed_78ad15be7.xml"] },
  "carti-copii-2.json": { "libris.ro": ["feed_78ad15be7.xml"], "cartepedia.ro": CARTEPEDIA },
  "manuale-scolare.json": { "cartepedia.ro": CARTEPEDIA },
  "materii-suplimentare.json": { "cartepedia.ro": CARTEPEDIA },
  "rechizite-papetarie.json": { "carturesti.ro": ["feed_d861df8a1.xml"] },
  "articole-scolare-accesorii.json": { "carturesti.ro": ["feed_d861df8a1.xml"] },
  "articole-scolare-jocuri.json": {
    "cartepedia.ro": CARTEPEDIA,
    "carturesti.ro": ["feed_d861df8a1.xml"],
    "libris.ro": ["feed_78ad15be7.xml"],
    "libhumanitas.ro": ["feed_e82be0de9.xml"],
    "brickplanet.ro": ["feed_3dd5a1fd2.xml"],
  },
  "oferte-carti-scolare.json": {
    "libris.ro": ["feed_78ad15be7.xml"],
    "libhumanitas.ro": ["feed_e82be0de9.xml"],
    "cartepedia.ro": CARTEPEDIA,
  },
  "carti-parenting.json": {
    "libris.ro": ["feed_78ad15be7.xml"],
    "libhumanitas.ro": ["feed_e82be0de9.xml"],
  },
  "muzica-film-1.json": { "carturesti.ro": ["feed_952ab47b2.xml"] },
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
function fisierMuzica(p) {
  return GENURI_FISIER_1.includes(p.subcategory) ? "muzica-film-1.json" : "muzica-film-2.json";
}
const ACCESORII = "articole-scolare-accesorii.json";
const PARENTING = "carti-parenting.json";
const REGULI = {
  "feed_78ad15be7.xml": {
    "Carti Pentru Copii": "carti-copii-1.json",
    // jocuri si jucarii pentru copii (fara „Jocuri de societate pentru adulti" si fara „Figurine, Funko Pop")
    "Board games": JOCURI,
    "Puzzle": JOCURI,
    "Jucarii": JOCURI,
    "Educative": JOCURI,
    "Creative": JOCURI,
    "Lego": JOCURI,
    "Jocuri de calatorie": JOCURI,
    "Roboti si Kituri de Constructie": JOCURI,
    "Puzzle 3D Lemn": JOCURI,
    "Kendama": JOCURI,
    // accesorii
    "Agende si jurnale": ACCESORII,
    "Diverse": ACCESORII,
    "Semne de carte": ACCESORII,
    "Huse carte, Huse laptop": ACCESORII,
    "Lampi de citit": ACCESORII,
    "Suport carti (Bookends)": ACCESORII,
    "Termos, sticle apa, cani calatorie": ACCESORII,
    "Sacose de panza, Tote Bags": ACCESORII,
    "Calendare": ACCESORII,
    // parenting
    "Cresterea Copilului": PARENTING,
    "Parenting": PARENTING, // ebookuri libris de parenting
  },
  "feed_23ed00784.xml": { "Parenting": PARENTING },
  "feed_02a848b11.xml": {
    "Hobby, arta, DIY": "rechizite-papetarie.json",
    "ROD": "rechizite-papetarie.json",
    "Jocuri si Jucarii": JOCURI,
    "Jucarii": JOCURI,
    "Fashion": ACCESORII,
  },
  "feed_f23ec2538.xml": {
    "Carte Școlară": "manuale-scolare.json",
    "Diverse": ACCESORII,
    "Jucării": JOCURI,
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
  // Muzica si film (carturesti): impartit in 2 fisiere dupa gen, ca fiecare sa ramana sub limita de marime
  "feed_952ab47b2.xml": { "Muzica": fisierMuzica, "Film": "muzica-film-2.json" },
  // brickplanet: feed-ul nu are categorii -> toate produsele merg la jocuri ("*" = orice categorie)
  "feed_3dd5a1fd2.xml": { "*": JOCURI },
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
  } else if (sursa === "brickplanet.ro") {
    if (!brand) brand = /LEGO/i.test(p.title + " " + (p.description || "")) ? "LEGO" : sursa;
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
  const cale = gasesteFeed(fisier);
  if (!cale) {
    avert(`Lipseste ${fisier} (${cfg.descriere}) — produsele din aceasta sursa nu se actualizeaza si nu se scot.`);
    continue;
  }
  const produse = citesteFeed(cale);
  incarcate.add(fisier);
  let active = 0;
  for (const p of produse) {
    const k = cheieFeed(p);
    if (!k) continue;
    if (p.product_active === "true") active++;
    if (!index.has(k)) index.set(k, { p, feed: fisier, sursa: cfg.sursa, feeds: new Set([fisier]) });
    else index.get(k).feeds.add(fisier);
  }
  raport.feeduri[fisier] = { descriere: cfg.descriere, produse: produse.length, active };
  raport.feeduri[fisier].fisierFolosit = path.basename(cale);
  const ore = (Date.now() - fs.statSync(cale).mtimeMs) / 3600000;
  raport.feeduri[fisier].vechimeOre = Math.round(ore);
  if (ore > VECHIME_MAXIMA_ORE) avert(`${path.basename(cale)} e vechi de ${Math.round(ore)} ore — copiaza feed-ul nou din 2Performant.`);
  console.log(`📥 ${path.basename(cale)}: ${produse.length} produse (${active} active) — ${cfg.descriere}`);
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
    if (!index.has(cheieItem(it))) disparute[it.sourceSite] = (disparute[it.sourceSite] || 0) + 1;
  }
  const scoatePeSursa = {};
  for (const [s, n] of Object.entries(disparute)) {
    const pondere = n / peSursa[s];
    r.scoaterePlanificata[s] = n;
    if (pondere > PRAG_SIGURANTA_SCOATERE) {
      avert(`${f}: ${n} din ${peSursa[s]} produse ${s} (${Math.round(pondere * 100)}%) lipsesc din feed — peste pragul de siguranta, NU le scot. Verifica feed-ul.`);
    } else scoatePeSursa[s] = true;
  }

  const rezultat = [];
  r.dezactivateScoase = 0;
  for (const it of initial) {
    const k = cheieItem(it);
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
};
const BOOKS_DIN_SURSA = Object.fromEntries(Object.entries(SURSA_BOOKS).map(([a, b]) => [b, a]));
// Surse cu feed complet: o carte care lipseste peste tot e marcata available:false (ascunsa, revine automat).
// La librarie.net (Top 10.000) si carturesti (feed partial) lipsa din feed nu inseamna link mort -> raman neatinse.
const BOOKS_FEED_COMPLET = ["libris.ro", "libhumanitas.ro", "curteaveche.ro", "edituratrei.ro", "cartepedia.ro", "nemira.ro"];
// Feed-uri din care NU se iau alternative (link expirat / ebook-uri)
const BOOKS_FARA_ALTERNATIVE = ["feed_d861df8a1.xml", "feed_23ed00784.xml"];

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
    lista.sort(
      (a, b) =>
        (b.din.sursa === "libris.ro") - (a.din.sursa === "libris.ro") ||
        parseFloat(a.din.p.price) - parseFloat(b.din.p.price)
    );
    return lista[0] || null;
  };

  const unic = (link) => ((decode(link || "").match(/[?&]unique=([^&]+)/) || [])[1] || "");
  const dupaUnic = new Map();
  for (const din of index.values()) if (din.p.aff_code) dupaUnic.set(unic(din.p.aff_code), din);
  const CAMPANII = { "9a6f02fef": "libris.ro", da1148931: "librarie.net", "07b5f0fed": "carturesti.ro", "6f33f2a39": "cartepedia.ro", "9aab15f10": "libhumanitas.ro", f9db13aad: "curteaveche.ro", "9617003d6": "nemira.ro", "4dc37856e": "edituratrei.ro" };
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

  books = books.map((it) => {
    const sursa = sursaReala(it);
    if (!sursa || !String(it.affiliate || "").includes("2performant")) {
      rb.faraFeed++;
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
    } else {
      const alt = gasesteAlternativa(it);
      if (alt) {
        const d = alt.din;
        rb.linkInlocuit.push({ titlu: it.title, deLa: it.source, la: BOOKS_DIN_SURSA[d.sursa] || d.sursa, autorConfirmat: alt.autorOk, titluFeed: d.p.title, url: d.p.url });
        it.source = BOOKS_DIN_SURSA[d.sursa] || d.sursa;
        it.affiliate = d.p.aff_code.replace(/&amp;/g, "&");
        it.productUrl = d.p.url;
        pretBook(it, d.p);
        if (it.available === false) { it.available = true; rb.reactivate++; }
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
      (r.dezactivateScoase ? ` | −${r.dezactivateScoase} din surse dezactivate` : "")
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
