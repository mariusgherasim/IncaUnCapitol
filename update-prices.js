const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const scrapers = require("./lib/scrapers");
const { logError } = require("./lib/helpers");

// Din 20.10.2026 acest script actualizeaza DOAR cartile din books.json care vin de la surse
// FARA feed 2Performant (acum: actsipoliton). Toate celelalte surse (libris, humanitas, curteaveche,
// edituratrei, librarie.net, carturesti, cartepedia, nemira, corint) sunt actualizate local de
// sync-carti-feeds.cjs, din feed-uri. Inainte, cele doua scripturi se contraziceau (ex. o carte
// readusa de sync era ascunsa din nou aici). Sursa noua fara feed = o adaugi in lista de mai jos
// (si scraper-ul ei in lib/scrapers/).
// 03.11.2026: humanitas scos inapoi — libhumanitas.ro blocheaza scraperul („indisponibil temporar" la fiecare carte).
// Cartile Humanitas sunt tratate acum de sync-carti-feeds.cjs (regula „cel mai bun pret": trec pe alta librarie
// cand acolo sunt mai ieftine cu peste 5%).
const SURSE_FARA_FEED = ["actsipoliton"];
const ALLOWED_SOURCES = Object.keys(scrapers).filter((s) => SURSE_FARA_FEED.includes(s));

// rechizite.json nu mai e folosit de nicio pagina (produsele scolare stau acum in fisierele de catalog,
// actualizate de sync) -> a fost scos din lista.
const DATA_FILES = ["books.json"];

async function updatePricesInFile(filePath, getBrowserContext) {

    if (!fs.existsSync(filePath)) {

        console.log(`⏭ ${filePath} nu există, sar peste.`);
        return;

    }

    const items =
        JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );

    console.log(`\n=== ${filePath} (${items.length} intrări) ===\n`);

    for (const item of items) {

        // intrarile "_readme" (fara source) sunt ignorate silentios
        if (!item.source) {
            continue;
        }

        if (!ALLOWED_SOURCES.includes(item.source)) {

            // actualizata de sync-carti-feeds.cjs (local, din feed-uri) — nu o atingem aici
            continue;

        }

        const scrape = scrapers[item.source];

        try {

            console.log("Actualizez:", item.title);

            await scrape(item, {
                axios,
                cheerio,
                getBrowserContext
            });

        } catch (error) {

            logError(item, error);

        }

    }

    fs.writeFileSync(
        filePath,
        JSON.stringify(items, null, 2)
    );

}

async function updatePrices() {

    // Chromium se pornește o singură dată, lazy, partajat între toate
    // sursele care au nevoie de browser real (humanitas, carturesti),
    // indiferent din care fișier de date vine produsul.
    let sharedBrowser = null;
    let sharedContext = null;

    async function getBrowserContext() {

        if (!sharedBrowser) {

            console.log("🌐 Pornesc Chromium (folosit de humanitas/carturesti)...");

            sharedBrowser = await chromium.launch({ headless: true });

            sharedContext = await sharedBrowser.newContext({
                userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
                locale: "ro-RO",
                viewport: { width: 1366, height: 768 }
            });

        }

        return sharedContext;

    }

    for (const filePath of DATA_FILES) {

        await updatePricesInFile(filePath, getBrowserContext);

    }

    if (sharedBrowser) {

        await sharedBrowser.close();
        console.log("\n🌐 Chromium închis.");

    }

    const lipsa = SURSE_FARA_FEED.filter((s) => !ALLOWED_SOURCES.includes(s));
    if (lipsa.length) console.log(`\n⚠️  Nu există scraper în lib/scrapers pentru: ${lipsa.join(", ")} — prețurile lor NU s-au actualizat.`);
    console.log(`\nPrețurile au fost actualizate pentru: ${ALLOWED_SOURCES.join(", ")}.`);

}

updatePrices();
