const { applyPriceToBook, logSuccess, logNotFound } = require("../helpers");

// Curtea Veche — .price / .old--price
async function scrapeCurteaVeche(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    const currentPrice = $(".price").first().text().trim();
    const oldPrice = $(".old--price").first().text().trim();

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    const found = applyPriceToBook(book, {
        currentPrice: currentPrice.replace("lei", "Lei").trim(),
        oldPrice: oldPrice ? oldPrice.replace("lei", "Lei").trim() : null
    });

    if (found) logSuccess(book);

}

module.exports = scrapeCurteaVeche;
