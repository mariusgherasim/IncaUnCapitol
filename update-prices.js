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

    // Chromium pentru Humanitas se pornește o singură dată, lazy,
    // doar dacă apare efectiv o carte cu source "humanitas"
    let humanitasBrowser = null;
    let humanitasContext = null;

    async function getHumanitasContext() {

        if (!humanitasBrowser) {

            console.log("🌐 Pornesc Chromium pentru Humanitas...");

            humanitasBrowser = await chromium.launch({ headless: true });

            humanitasContext = await humanitasBrowser.newContext({
                userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
                locale: "ro-RO",
                viewport: { width: 1366, height: 768 }
            });

        }

        return humanitasContext;

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
                getHumanitasContext
            });

        } catch (error) {

            logError(book, error);

        }

    }

    if (humanitasBrowser) {

        await humanitasBrowser.close();
        console.log("🌐 Chromium Humanitas închis.");

    }

    fs.writeFileSync(
        "books.json",
        JSON.stringify(books, null, 2)
    );

    console.log("\nToate prețurile au fost actualizate.");

}

updatePrices();
