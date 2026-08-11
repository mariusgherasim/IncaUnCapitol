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
    "Carte copii & adolescenti": "carti-copii"

};

const FEEDS = [
    { file: "libris.xml", campaignFallback: "libris.ro" },
    { file: "librarie-net.xml", campaignFallback: "librarie.net" },
    { file: "humanitas.xml", campaignFallback: "libhumanitas.ro" },
    { file: "carturesti-scoala.xml", campaignFallback: "carturesti.ro" }
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
// PARSARE FEED
// ========================================

function parseFeedFile(filePath, campaignFallback) {

    if (!fs.existsSync(filePath)) {

        console.log(`⏭ ${filePath} nu există, sar peste.`);
        return [];

    }

    console.log(`Citesc ${filePath}...`);

    const content = fs.readFileSync(filePath, "utf8");

    const rawItems = content.split("<item>").slice(1);

    console.log(`  ${rawItems.length} produse găsite în total.`);

    const parsed = [];

    for (const raw of rawItems) {

        const itemStr = raw.split("</item>")[0];

        const category = extractField(itemStr, "category");
        const bucket = CATEGORY_MAP[category];

        if (!bucket) continue; // categorie irelevanta pentru initiativa asta

        const productActive = extractField(itemStr, "product_active");

        if (productActive === "false") continue;

        const priceRaw = extractField(itemStr, "price");
        const oldPriceRaw = extractField(itemStr, "old_price");

        const price = normalizePrice(priceRaw);

        if (!price) continue; // fara pret, nu are rost sa afisam produsul

        const oldPrice =
            oldPriceRaw && parseFloat(oldPriceRaw) > parseFloat(priceRaw)
                ? normalizePrice(oldPriceRaw)
                : null;

        const discount = oldPrice ? calculateDiscountPercent(oldPriceRaw, priceRaw) : null;

        const brand = extractField(itemStr, "brand");
        const campaignName = extractField(itemStr, "campaign_name") || campaignFallback;

        // unele feed-uri (ex. carturesti-scoala.xml) pun "Titlu | Autor"
        // direct in <title> — separam autorul, ca sa nu apara inghesuit
        // in titlu si sa avem un "brand" mai relevant decat editura
        let title = extractField(itemStr, "title");
        let titleAuthor = "";

        const pipeIndex = title.indexOf(" | ");

        if (pipeIndex !== -1) {
            titleAuthor = title.slice(pipeIndex + 3).trim();
            title = title.slice(0, pipeIndex).trim();
        }

        parsed.push({
            title,
            brand: titleAuthor || brand || campaignName.trim(),
            sourceSite: campaignName.trim(),
            productUrl: extractField(itemStr, "url"),
            affiliate: extractField(itemStr, "aff_code"),
            image: extractField(itemStr, "image_urls").split(",")[0].trim(),
            category: bucket,
            price,
            ...(oldPrice ? { oldPrice } : {}),
            ...(discount ? { discount } : {})
        });

    }

    console.log(`  ${parsed.length} produse relevante (active, cu preț, categorie mapată).`);

    return parsed;

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

        const filePath = path.join(__dirname, feed.file);
        const items = parseFeedFile(filePath, feed.campaignFallback);

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

        const seenLinks = new Set(existingItems.map(i => i.affiliate));
        const newUniqueItems = items.filter(i => !seenLinks.has(i.affiliate));

        const mergedItems = existingItems.concat(newUniqueItems);

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
