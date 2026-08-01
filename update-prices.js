const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const scrapers = require("./lib/scrapers");
const { logError } = require("./lib/helpers");

const ALLOWED_SOURCES = Object.keys(scrapers);

// Fisierele de date procesate: catalogul de carti + cel de
// rechizite/manuale/articole scolare. Ambele folosesc EXACT aceleasi
// scrapere (lib/scrapers/) — logica de citire a pretului e generica,
// nu conteaza daca produsul e o carte sau un ghiozdan.
const DATA_FILES = ["books.json", "rechizite.json"];

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

            console.log("⏭ Ignor:", item.title);
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

    console.log("\nToate prețurile au fost actualizate (cărți + rechizite).");

}

updatePrices();
