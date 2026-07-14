const { applyPriceToBook, logSuccess, formatPriceLei } = require("../helpers");

const CHECK_PAGE_TITLE_MARKER = "doar un moment";

async function loadHumanitasPage(page, url) {

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
    });

    await page.waitForTimeout(3000);

    return await page.title();

}

// Humanitas.ro pune uneori o pagină de verificare temporară
// ("Doar un moment...") înaintea paginii reale de produs.
// Așteptăm și reîncercăm o singură dată înainte de a renunța.
async function waitPastVerificationPage(page, url) {

    let title = await loadHumanitasPage(page, url);

    if (!title.toLowerCase().includes(CHECK_PAGE_TITLE_MARKER)) {
        return title;
    }

    console.log("⏳ Verificare temporară Humanitas...");

    await page.waitForTimeout(8000);
    title = await page.title();

    if (title.toLowerCase().includes(CHECK_PAGE_TITLE_MARKER)) {

        console.log("🔄 Retry Humanitas...");
        await page.waitForTimeout(5000);
        title = await loadHumanitasPage(page, url);

    }

    return title;

}

async function readHumanitasPrices(page) {

    let currentPrice =
        await page
            .locator('[data-price-type="finalPrice"]')
            .first()
            .getAttribute("data-price-amount")
            .catch(() => null);

    if (!currentPrice) {

        currentPrice =
            await page
                .locator('meta[itemprop="price"]')
                .first()
                .getAttribute("content")
                .catch(() => null);

    }

    if (!currentPrice) {

        currentPrice =
            await page
                .locator(".product-info-price .price")
                .first()
                .textContent()
                .catch(() => null);

    }

    let oldPrice =
        await page
            .locator('[data-price-type="oldPrice"]')
            .first()
            .getAttribute("data-price-amount")
            .catch(() => null);

    if (!oldPrice) {

        oldPrice =
            await page
                .locator(".old-price .price")
                .first()
                .textContent()
                .catch(() => null);

    }

    return { currentPrice, oldPrice };

}

// `getHumanitasContext` e injectat de orchestrator: pornește Chromium
// o singură dată (lazy) și reutilizează același context pentru toate
// cărțile Humanitas, nu doar pentru una.
async function scrapeHumanitas(book, { getHumanitasContext }) {

    let page = null;

    try {

        console.log("🌐 Humanitas:", book.title);

        const context = await getHumanitasContext();
        page = await context.newPage();

        const pageTitle =
            await waitPastVerificationPage(page, book.productUrl);

        if (pageTitle.toLowerCase().includes(CHECK_PAGE_TITLE_MARKER)) {

            console.log("⏭ Humanitas indisponibil temporar:", book.title);
            console.log("   Păstrez prețul existent:", book.price);
            return;

        }

        const { currentPrice: rawCurrent, oldPrice: rawOld } =
            await readHumanitasPrices(page);

        const currentPrice = formatPriceLei(rawCurrent);
        const oldPrice = formatPriceLei(rawOld);

        const found = applyPriceToBook(book, { currentPrice, oldPrice });

        if (found) {

            logSuccess(book);

        } else {

            console.log("⚠ Nu am găsit prețul:", book.title);
            console.log("   Păstrez prețul existent:", book.price);
            console.log("   URL final:", page.url());
            console.log("   Titlu pagină:", await page.title());

        }

    } catch (error) {

        console.log("❌ Humanitas:", book.title);
        console.log(error.message);
        console.log("   Păstrez prețul existent:", book.price);

    } finally {

        if (page) await page.close();

    }

}

module.exports = scrapeHumanitas;
