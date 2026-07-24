const { applyPriceToBook, logSuccess, logNotFound } = require("../helpers");

// Libris.ro — atentie: clasa "price-discount-containerx" e refolosita
// ambiguu in HTML-ul lor (o data pe eticheta de discount, o data pe
// containerul cu pretul redus + intreg), asa ca ne bazam pe clasele
// mai specifice .pr-pret-redus / .pr-pret-intreg / .pr-discaunt-icon,
// nu pe .price-discount-containerx.
//
// Nota: PRP ("Pretul Recomandat de Producator", clasa .pr-pret-prp) NU
// e acelasi lucru cu pretul vechi/intreg de dinainte de reducere — sunt
// doua concepte diferite pe libris.ro. Pentru oldPrice folosim explicit
// .pr-pret-intreg, nu PRP.

// normalizeaza "28.01Lei" sau "69.67 Lei" -> "28,01 Lei"
function normalizeLibrisPrice(raw) {

    if (!raw) return null;

    return raw
        .replace(/(\d)\s*Lei/i, "$1 Lei")
        .replace(".", ",")
        .trim();

}

async function scrapeLibris(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    const currentPriceRaw =
        $(".pr-pret-redus").first().text().trim();

    const oldPriceRaw =
        $(".pr-pret-intreg").first().text().trim();

    const discountRaw =
        $(".pr-discaunt-icon").first().text().trim();

    if (!currentPriceRaw) {
        logNotFound(book);
        return;
    }

    const currentPrice = normalizeLibrisPrice(currentPriceRaw);
    const oldPrice = oldPriceRaw ? normalizeLibrisPrice(oldPriceRaw) : null;

    const found = applyPriceToBook(book, {
        currentPrice,
        oldPrice,
        discount: discountRaw || null
    });

    if (found) logSuccess(book);

}

module.exports = scrapeLibris;
