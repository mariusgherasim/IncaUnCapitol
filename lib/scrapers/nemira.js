const { applyPriceToBook, logSuccess, logNotFound, formatPriceLei } = require("../helpers");

// Nemira — prețul e de obicei în meta[itemprop="price"], cu fallback
// pe elementul afișat vizual dacă meta tag-ul lipsește
async function scrapeNemira(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    let currentPriceRaw = $('meta[itemprop="price"]').attr("content");

    if (!currentPriceRaw) {

        currentPriceRaw =
            $(".final-price .price").first().text().trim();

    }

    const oldPriceRaw =
        $(".old-price .price").first().text().trim();

    const currentPrice = formatPriceLei(currentPriceRaw);
    const oldPrice = formatPriceLei(oldPriceRaw);

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    const found = applyPriceToBook(book, { currentPrice, oldPrice });

    if (found) logSuccess(book);

}

module.exports = scrapeNemira;
