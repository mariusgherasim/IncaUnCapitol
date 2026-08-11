#!/usr/bin/env node
// generate-catalog-from-feeds.cjs
//
// Extrage produsele relevante (rechizite/manuale/articole scolare/
// carti pentru copii) din cele 3 feed-uri XML de afiliere (libris.ro,
// librarie.net, libhumanitas.ro) si genereaza cate un fisier JSON
// separat per subcategorie — nu unul singur uriaș, ca fiecare pagina
// de subcategorie sa descarce doar datele ei, nu tot catalogul.
//
// De rulat din nou de fiecare data cand primesti feed-uri XML noi de
// la edituri (feed-urile expira/se actualizeaza periodic).
//
// Rulare:
//   node generate-catalog-from-feeds.cjs
//
// Fisiere de intrare asteptate, in acelasi folder:
//   libris.xml, librarie-net.xml, humanitas.xml
//
// Fisiere de iesire (in ./output/):
//   manuale-scolare.json, materii-suplimentare.json,
//   rechizite-papetarie.json, articole-scolare-accesorii.json,
//   articole-scolare-jocuri.json, carti-copii.json

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "output");

// ========================================
// MAPARE: categorie brută din feed -> bucket-ul nostru (fisier JSON)
// ========================================
// cheia e categoria EXACTA din <category> in feed (dupa decodare
// entitati HTML), valoarea e numele bucket-ului/fisierului de iesire

const CATEGORY_MAP = {

    // --- libris.xml ---
    "Manuale Carte Scolara": "manuale-scolare",
    "Manuale & Auxiliare scolare": "manuale-scolare",
    "Culegere": "manuale-scolare",
    "Bibliografie scolara": "manuale-scolare",

    "Limbi Straine": "materii-suplimentare",
    "It Computere": "materii-suplimentare",
    "Medicina Si Farmacie": "materii-suplimentare",
    "Cultura generala": "materii-suplimentare",

    "Rechizite": "rechizite-papetarie",
    "Papetarie": "rechizite-papetarie",
    "Instrumente De Scris": "rechizite-papetarie",

    "Rucsacuri, Ghiozdane, Genti": "articole-scolare-accesorii",
    "Agende, Jurnale": "articole-scolare-accesorii",
    "Bookends, Suport Lateral Carti": "articole-scolare-accesorii",
    "Huse Carte, Huse Laptop": "articole-scolare-accesorii",
    "Lampi Pentru Citit": "articole-scolare-accesorii",
    "Semne De Carte": "articole-scolare-accesorii",
    "Seturi Cadou": "articole-scolare-accesorii",
    "Termos, Sticle Apa, Cani Calatorie": "articole-scolare-accesorii",
    "Diverse": "articole-scolare-accesorii",

    "Carti Pentru Copii": "carti-copii",

    // --- librarie-net.xml ---
    "Carte Școlară": "manuale-scolare",

    // --- humanitas.xml (libhumanitas.ro) ---
    "Manuale": "manuale-scolare",
    "Manuale & auxiliare scolare": "manuale-scolare",
    "Auxiliare şcolare": "manuale-scolare",

    "Dicţionare & Lexic": "materii-suplimentare",
    "Enciclopedii pentru copii": "materii-suplimentare",

    "Board Games": "articole-scolare-jocuri",
    "Benzi desenate": "articole-scolare-jocuri",

    "Cărţi pentru copii": "carti-copii",
    "Literatură pentru copii": "carti-copii",

    // --- carturesti-scoala.xml (widget "Back to School 2026") ---
    // Categoria e generica ("Carte") pe majoritatea produselor — nu
    // sunt neaparat manuale/rechizite, sunt carti obisnuite incluse
    // in campania sezoniera. Merg intr-un bucket separat, nu amestecate
    // cu manualele reale.
    "Carte": "oferte-carti-scolare",
    "Audiobook": "oferte-carti-scolare",
    "Carte copii & adolescenti": "carti-copii",

    // --- carturesti-scoala.csv (export COMPLET, CSV, acelasi widget
    // "Back to School 2026" ca mai sus, dar export diferit de XML —
    // 5968 produse fata de 992 in XML). Categoriile din CSV sunt
    // diferite si uneori inselatoare (verificat pe esantioane reale):
    // "Fashion" contine de fapt rucsacuri, "Ceai & accesorii" contine
    // termosuri pentru copii, nu ceai.
    "Papetarie, birotica": "rechizite-papetarie",
    "Caiete, carnete": "rechizite-papetarie",
    "ROD": "rechizite-papetarie",
    "Instrumente de scris": "rechizite-papetarie",
    "Accesorii de birou": "rechizite-papetarie",
    "Hobby, arta, DIY": "rechizite-papetarie",

    "Scolaresti": "articole-scolare-accesorii",
    "Fashion": "articole-scolare-accesorii",
    "Genti si ghiozdane": "articole-scolare-accesorii",
    "Ceai & accesorii": "articole-scolare-accesorii",
    "Gadgeturi si accesorii": "articole-scolare-accesorii",
    "Accesorii pentru cititori": "articole-scolare-accesorii",
    "Home & Deco": "articole-scolare-accesorii",

    "Jocuri si Jucarii": "articole-scolare-jocuri",
    "Board games": "articole-scolare-jocuri",
    "Jucarii": "articole-scolare-jocuri"

};

const FEEDS = [
    { file: "libris.xml", campaignFallback: "libris.ro", type: "xml" },
    { file: "librarie-net.xml", campaignFallback: "librarie.net", type: "xml" },
    { file: "humanitas.xml", campaignFallback: "libhumanitas.ro", type: "xml" },
    { file: "carturesti-scoala.xml", campaignFallback: "carturesti.ro", type: "xml" },
    { file: "carturesti-scoala.csv", campaignFallback: "carturesti.ro", type: "csv" }
];

// ========================================
// HELPERE
// ========================================

function decodeEntities(str) {

    if (!str) return "";

    return str
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&#039;", "'");

}

function extractField(itemStr, tag) {

    const match = itemStr.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));

    return match ? decodeEntities(match[1].trim()) : "";

}

// normalizeaza "35.05" -> "35,05 Lei"
function normalizePrice(rawNumericPrice) {

    if (!rawNumericPrice) return null;

    const numeric = parseFloat(rawNumericPrice);

    if (Number.isNaN(numeric)) return null;

    return numeric.toFixed(2).replace(".", ",") + " Lei";

}

function calculateDiscountPercent(oldPriceRaw, priceRaw) {

    const oldNumeric = parseFloat(oldPriceRaw);
    const newNumeric = parseFloat(priceRaw);

    if (!oldNumeric || !newNumeric || oldNumeric <= newNumeric) return null;

    const percent = Math.round(((oldNumeric - newNumeric) / oldNumeric) * 100);

    return percent + "%";

}

// ========================================
// CONSTRUIRE PRODUS — logica comuna, indiferent daca vine din XML
// sau CSV (ambele tipuri de feed folosesc aceleasi campuri, doar
// formatul de fisier difera)
// ========================================

function buildProduct(fields, campaignFallback) {

    const category = fields.category;
    const bucket = CATEGORY_MAP[category];

    if (!bucket) return null; // categorie irelevanta pentru initiativa asta

    // XML foloseste "true"/"false", CSV foloseste "1"/"0" — acceptam
    // ambele conventii
    const activeRaw = String(fields.product_active || "").trim().toLowerCase();
    const isActive = activeRaw !== "false" && activeRaw !== "0";

    if (!isActive) return null;

    const priceRaw = fields.price;
    const oldPriceRaw = fields.old_price;

    const price = normalizePrice(priceRaw);

    if (!price) return null; // fara pret, nu are rost sa afisam produsul

    const oldPrice =
        oldPriceRaw && parseFloat(oldPriceRaw) > parseFloat(priceRaw)
            ? normalizePrice(oldPriceRaw)
            : null;

    const discount = oldPrice ? calculateDiscountPercent(oldPriceRaw, priceRaw) : null;

    const brand = fields.brand;
    const campaignName = (fields.campaign_name || campaignFallback).trim();

    // unele feed-uri (ex. carturesti-scoala) pun "Titlu | Autor" direct
    // in title — separam autorul, ca sa nu apara inghesuit in titlu
    let title = fields.title || "";
    let titleAuthor = "";

    const pipeIndex = title.indexOf(" | ");

    if (pipeIndex !== -1) {
        titleAuthor = title.slice(pipeIndex + 3).trim();
        title = title.slice(0, pipeIndex).trim();
    }

    // domeniul din feed (carturesti.ro/img-prod/...) e gresit —
    // verificat direct pe pagina live a unui produs, imaginile
    // sunt servite de fapt de pe cdn.dc5.ro/img-prod/... (acelasi
    // path, alt domeniu — probabil CDN schimbat de carturesti,
    // fara actualizarea feed-ului)
    let image = String(fields.image_urls || "").split(",")[0].trim();
    image = image.replace("https://carturesti.ro/img-prod/", "https://cdn.dc5.ro/img-prod/");

    return {
        title,
        brand: titleAuthor || brand || campaignName,
        sourceSite: campaignName,
        productUrl: fields.url,
        affiliate: fields.aff_code,
        image,
        category: bucket,
        price,
        ...(oldPrice ? { oldPrice } : {}),
        ...(discount ? { discount } : {})
    };

}

// ========================================
// PARSARE XML
// ========================================

function parseXmlFile(filePath, campaignFallback) {

    console.log(`Citesc ${filePath}...`);

    const content = fs.readFileSync(filePath, "utf8");

    const rawItems = content.split("<item>").slice(1);

    console.log(`  ${rawItems.length} produse găsite în total.`);

    const parsed = [];

    for (const raw of rawItems) {

        const itemStr = raw.split("</item>")[0];

        const fields = {
            category: extractField(itemStr, "category"),
            product_active: extractField(itemStr, "product_active"),
            price: extractField(itemStr, "price"),
            old_price: extractField(itemStr, "old_price"),
            brand: extractField(itemStr, "brand"),
            campaign_name: extractField(itemStr, "campaign_name"),
            title: extractField(itemStr, "title"),
            image_urls: extractField(itemStr, "image_urls"),
            url: extractField(itemStr, "url"),
            aff_code: extractField(itemStr, "aff_code")
        };

        const product = buildProduct(fields, campaignFallback);

        if (product) parsed.push(product);

    }

    console.log(`  ${parsed.length} produse relevante (active, cu preț, categorie mapată).`);

    return parsed;

}

// ========================================
// PARSARE CSV (parser simplu, respecta campuri intre ghilimele
// cu virgule/ghilimele-duble escapate — fara linii multi-rand,
// verificat ca formatul feed-ului nu are campuri cu newline literal)
// ========================================

function parseCsvLine(line) {

    const fields = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {

        const char = line[i];

        if (insideQuotes) {

            if (char === '"') {

                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    insideQuotes = false;
                }

            } else {

                current += char;

            }

        } else {

            if (char === '"') {
                insideQuotes = true;
            } else if (char === ",") {
                fields.push(current);
                current = "";
            } else {
                current += char;
            }

        }

    }

    fields.push(current);

    return fields;

}

function parseCsvFile(filePath, campaignFallback) {

    console.log(`Citesc ${filePath}...`);

    const content = fs.readFileSync(filePath, "utf8");

    const lines = content.split("\n").filter(l => l.trim().length > 0);

    if (!lines.length) return [];

    const headers = parseCsvLine(lines[0]);

    console.log(`  ${lines.length - 1} produse găsite în total.`);

    const parsed = [];

    for (let i = 1; i < lines.length; i++) {

        const values = parseCsvLine(lines[i]);

        const fields = {};

        headers.forEach((h, idx) => {
            fields[h] = values[idx] || "";
        });

        const product = buildProduct(fields, campaignFallback);

        if (product) parsed.push(product);

    }

    console.log(`  ${parsed.length} produse relevante (active, cu preț, categorie mapată).`);

    return parsed;

}

function parseFeedFile(feed) {

    const filePath = path.join(__dirname, feed.file);

    if (!fs.existsSync(filePath)) {

        console.log(`⏭ ${filePath} nu există, sar peste.`);
        return [];

    }

    return feed.type === "csv"
        ? parseCsvFile(filePath, feed.campaignFallback)
        : parseXmlFile(filePath, feed.campaignFallback);

}

// ========================================
// MAIN
// ========================================

function main() {

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }

    const buckets = {};

    for (const feed of FEEDS) {

        const items = parseFeedFile(feed);

        for (const item of items) {

            if (!buckets[item.category]) buckets[item.category] = [];
            buckets[item.category].push(item);

        }

    }

    console.log("\n=== Rezultate finale ===\n");

    for (const [bucket, items] of Object.entries(buckets)) {

        // Daca exista deja un fisier <bucket>.json (in folderul curent
        // sau in output/, de la o rulare anterioara), adaugam produsele
        // noi peste cele vechi, nu suprascriem — util cand mai vine un
        // feed nou, fara sa pierdem ce era deja acolo. Deduplicare
        // dupa link-ul de afiliere (cel mai stabil identificator unic).
        const existingCandidates = [
            path.join(__dirname, `${bucket}.json`),
            path.join(OUTPUT_DIR, `${bucket}.json`)
        ];

        let existingItems = [];

        for (const candidate of existingCandidates) {

            if (fs.existsSync(candidate)) {

                try {
                    existingItems = JSON.parse(fs.readFileSync(candidate, "utf8"));
                } catch (e) {
                    existingItems = [];
                }

                break;

            }

        }

        // Merge: produsele din rularea curenta (items) sunt mereu mai
        // proaspete decat cele existente — daca acelasi produs (dupa
        // link de afiliere) apare in ambele, castiga versiunea noua
        // (poate corecta greseli gasite ulterior, ca domeniul de
        // imagine gresit). Produsele care nu mai apar in feed-ul curent
        // (au fost scoase de comerciant) raman din versiunea veche —
        // nu le stergem doar pentru ca lipsesc dintr-o rulare.
        const itemsByLink = new Map();

        existingItems.forEach(i => itemsByLink.set(i.affiliate, i));
        items.forEach(i => itemsByLink.set(i.affiliate, i));

        const mergedItems = Array.from(itemsByLink.values());
        const newUniqueItems = items.filter(i => !existingItems.some(e => e.affiliate === i.affiliate));

        const outputPath = path.join(OUTPUT_DIR, `${bucket}.json`);

        fs.writeFileSync(outputPath, JSON.stringify(mergedItems, null, 2));

        const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);

        console.log(
            `${bucket}.json`.padEnd(35),
            `${mergedItems.length}`.padStart(6), "produse",
            `(+${newUniqueItems.length} noi, ${existingItems.length} pastrate)`.padEnd(28),
            `(${sizeMb} MB)`
        );

    }

}

main();
