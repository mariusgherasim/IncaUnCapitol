const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const scrapers = require("./lib/scrapers");
const { logError } = require("./lib/helpers");

const ALLOWED_SOURCES = Object.keys(scrapers);

async function updatePrices() {

    const books =
        JSON.parse(
            fs.readFileSync("books.json", "utf8")
        );

    // Chromium se pornește o singură dată, lazy, doar dacă apare
    // efectiv o carte de la o sursă care are nevoie de browser real
    // (nu doar axios) — momentan: humanitas, carturesti. Ambele au
    // protecție anti-bot care respinge cererile axios simple cu 403,
    // chiar cu User-Agent setat corect.
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

    for (const book of books) {

        if (book.source && !ALLOWED_SOURCES.includes(book.source)) {

            console.log("⏭ Ignor:", book.title);
            continue;

        }

        const scrape = scrapers[book.source];

        if (!scrape) {

            console.log("⏭ Sursă necunoscută, ignor:", book.title);
            continue;

        }

        try {

            console.log("Actualizez:", book.title);

            await scrape(book, {
                axios,
                cheerio,
                getBrowserContext
            });

        } catch (error) {

            logError(book, error);

        }

    }

    if (sharedBrowser) {

        await sharedBrowser.close();
        console.log("🌐 Chromium închis.");

    }

    fs.writeFileSync(
        "books.json",
        JSON.stringify(books, null, 2)
    );

    console.log("\nToate prețurile au fost actualizate.");

}

updatePrices();
