// ========================================
// HELPERE COMUNE — folosite de toate scraperele
// ========================================

// Calculează procentul de reducere pornind de la două prețuri text
// (ex: "120,00 Lei" și "99,00 Lei" -> "18%")
function calculateDiscount(oldPrice, newPrice) {

    const oldValue =
        parseFloat(
            String(oldPrice)
                .replace(",", ".")
                .replace("Lei", "")
                .trim()
        );

    const newValue =
        parseFloat(
            String(newPrice)
                .replace(",", ".")
                .replace("Lei", "")
                .trim()
        );

    if (!oldValue || !newValue) {
        return "";
    }

    const discount =
        Math.round(
            ((oldValue - newValue) / oldValue) * 100
        );

    return discount + "%";

}

// Extrage textul primului selector care se potrivește dintr-o listă
// de selectori candidați (utilizat pentru site-uri unde structura
// HTML diferă ușor de la pagină la pagină)
function getFirstText($, selectors) {

    for (const selector of selectors) {

        const value =
            $(selector)
                .first()
                .clone()
                .children()
                .remove()
                .end()
                .text()
                .trim();

        if (value) {
            return value;
        }

    }

    return "";

}

// Normalizează un preț text la formatul "123,45 Lei"
// Acceptă orice separator zecimal și orice text în jurul cifrelor
// (ex: "123.45 lei", "123,45RON", "  123.45  " -> "123,45 Lei")
function formatPriceLei(value) {

    if (!value) {
        return null;
    }

    const cleaned =
        String(value)
            .replace(",", ".")
            .replace(/[^\d.]/g, "");

    const numeric = parseFloat(cleaned);

    if (Number.isNaN(numeric)) {
        return null;
    }

    return (
        numeric
            .toFixed(2)
            .replace(".", ",")
        + " Lei"
    );

}

// Aplică pe `book` prețul curent + (opțional) prețul vechi/reducerea,
// cu aceeași logică repetată în toate scraperele: dacă nu mai există
// preț vechi, se șterg oldPrice/discount/offerEnds rămase dintr-o
// ofertă anterioară.
function applyPriceToBook(book, { currentPrice, oldPrice, discount }) {

    if (!currentPrice) {
        return false;
    }

    book.price = currentPrice;
    book.available = true;

    if (oldPrice && oldPrice !== currentPrice) {

        book.oldPrice = oldPrice;

        book.discount =
            discount ||
            calculateDiscount(oldPrice, currentPrice);

    } else {

        delete book.oldPrice;
        delete book.discount;
        delete book.offerEnds;

    }

    return true;

}

function logSuccess(book) {

    console.log("✔", book.title, book.price);

    if (book.oldPrice) {

        console.log("   Preț vechi:", book.oldPrice);
        console.log("   Reducere:", book.discount);

    }

}

// Apelata cand pagina s-a incarcat cu succes (nu e blocata de
// verificare anti-bot), dar nu s-a gasit niciun element de pret —
// semn puternic ca produsul nu mai e pe stoc/nu mai e vandut.
// Marcheaza cartea ca indisponibila (price:null), astfel incat site-ul
// sa o poata ascunde automat de pe homepage, dar ramane in books.json
// (nu se sterge din fisier) — daca produsul revine pe stoc, urmatoarea
// rulare cu succes o reactiveaza automat (applyPriceToBook seteaza din
// nou book.price la o valoare reala).
//
// Important: NU se apeleaza cand pagina a fost blocata de o verificare
// anti-bot temporara (Cloudflare etc.) — acolo nu stim starea reala a
// produsului, doar ca nu am putut verifica acum; codul pastreaza deja
// corect pretul vechi in acel caz, separat de aceasta functie.
function logNotFound(book) {

    console.log("⚠ Nu am găsit prețul (marchez indisponibil):", book.title);

    book.price = null;
    book.available = false;

    delete book.oldPrice;
    delete book.discount;
    delete book.offerEnds;

}

function logError(book, error) {

    console.log("\n❌", book.title);
    console.log(error.message);

}

// ========================================
// PLAYWRIGHT: trecere peste pagina de verificare anti-bot
// (ex: Cloudflare "Doar un moment...") — folosita de orice sursa
// care are nevoie de browser real, nu doar de Humanitas.
// ========================================

const CHECK_PAGE_TITLE_MARKER = "doar un moment";

async function loadPageAndGetTitle(page, url, waitAfterLoad) {

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
    });

    await page.waitForTimeout(waitAfterLoad);

    return await page.title();

}

// Unele site-uri (Humanitas, Carturesti) pun uneori o pagina de
// verificare temporara ("Doar un moment...") inaintea paginii reale
// de produs. Asteptam si reincercam o singura data inainte de a
// renunta, ca sa nu blocam la nesfarsit restul rularii.
async function waitPastVerificationPage(page, url, sourceLabel) {

    let title = await loadPageAndGetTitle(page, url, 3000);

    if (!title.toLowerCase().includes(CHECK_PAGE_TITLE_MARKER)) {
        return title;
    }

    console.log(`⏳ Verificare temporară ${sourceLabel}...`);

    await page.waitForTimeout(8000);
    title = await page.title();

    if (title.toLowerCase().includes(CHECK_PAGE_TITLE_MARKER)) {

        console.log(`🔄 Retry ${sourceLabel}...`);
        await page.waitForTimeout(5000);
        title = await loadPageAndGetTitle(page, url, 3000);

    }

    return title;

}

module.exports = {
    calculateDiscount,
    getFirstText,
    formatPriceLei,
    applyPriceToBook,
    logSuccess,
    logNotFound,
    logError,
    CHECK_PAGE_TITLE_MARKER,
    waitPastVerificationPage
};
