const {
    applyPriceToBook,
    logSuccess,
    logNotFound,
    waitPastVerificationPage,
    CHECK_PAGE_TITLE_MARKER
} = require("../helpers");

// Carturesti.ro are DOUA obstacole separate, descoperite la testare:
//
// 1. Protectie anti-bot care respinge cererile axios simple cu
//    "403 Forbidden" -> rezolvat folosind Playwright (browser real)
//    in loc de axios, ca la Humanitas.
//
// 2. Aceeasi pagina de verificare temporara "Doar un moment..." ca la
//    Humanitas (probabil aceeasi tehnologie anti-bot, ex. Cloudflare)
//    -> rezolvat cu waitPastVerificationPage(), extrasa acum ca
//    helper comun (era duplicata identic la Humanitas).
//
// Important: NU folosim waitUntil:"networkidle" la navigare — site-ul
// are trafic de fundal continuu (analytics/tracking), asa ca reteaua
// nu devine niciodata "idle" si goto() ar da mereu timeout (verificat
// direct: 60s epuizate constant). In loc sa asteptam toata reteaua,
// asteptam DOAR elementul de pret, explicit, cu timeout propriu.
//
// Structura pretului (verificata pe HTML real):
//
//   pret curent:  <span class="pret">20<span class="bani">50</span></span>
//                 -> "20" (text direct) + "50" (span.bani) = 20,50 Lei
//
//   pret vechi:   <span class="lei" style="text-decoration:line-through">41</span>
//                 <span style="...">.00</span>lei
//                 -> "41" (span.lei) + ".00" (span urmator) = 41,00 Lei
//
// Discount-ul e într-un div care conține și un tooltip cu text lung —
// nu folosim tot text()-ul, doar primul "NN%" găsit.

async function scrapeCarturesti(book, { cheerio, getBrowserContext }) {

    let page = null;

    try {

        console.log("🌐 Carturesti:", book.title);

        const context = await getBrowserContext();
        page = await context.newPage();

        const pageTitle =
            await waitPastVerificationPage(page, book.productUrl, "Carturesti");

        if (pageTitle.toLowerCase().includes(CHECK_PAGE_TITLE_MARKER)) {

            console.log("⏭ Carturesti indisponibil temporar:", book.title);
            console.log("   Păstrez prețul existent:", book.price);
            return;

        }

        // asteptam explicit elementul de pret (randat de Angular,
        // uneori dupa un apel separat catre server), nu un timp fix
        const pretGasit = await page
            .waitForSelector(".pret", { timeout: 20000 })
            .then(() => true)
            .catch(() => false);

        const html = await page.content();
        const $ = cheerio.load(html);

        const wholePart =
            $(".pret")
                .first()
                .clone()
                .children()
                .remove()
                .end()
                .text()
                .trim();

        const centsPart =
            $(".pret .bani").first().text().trim();

        const currentPrice =
            wholePart
                ? wholePart + "," + (centsPart || "00") + " Lei"
                : null;

        const oldWhole =
            $(".lei").first().text().trim();

        const oldCentsRaw =
            $(".lei").first().next("span").text().trim();

        const oldCents =
            oldCentsRaw.replace(/[.,]/g, "");

        const oldPrice =
            oldWhole
                ? oldWhole + "," + (oldCents || "00") + " Lei"
                : null;

        const discountText =
            $(".discount").first().text().trim();

        const discountMatch = discountText.match(/(\d+)%/);
        const discount = discountMatch ? discountMatch[1] + "%" : null;

        if (!currentPrice) {

            logNotFound(book);

            console.log(
                "   Element .pret " +
                (pretGasit ? "a apărut, dar textul era gol." : "nu a apărut deloc în 20s.")
            );
            console.log("   Titlu pagină:", await page.title());

            return;

        }

        const found = applyPriceToBook(book, {
            currentPrice,
            oldPrice,
            discount
        });

        if (found) logSuccess(book);

    } catch (error) {

        console.log("❌ Carturesti:", book.title);
        console.log(error.message);
        console.log("   Păstrez prețul existent:", book.price);

    } finally {

        if (page) await page.close();

    }

}

module.exports = scrapeCarturesti;
