const { applyPriceToBook, logSuccess, logNotFound } = require("../helpers");

// Editura Trei — preț curent/vechi/reducere afișate direct în clase dedicate
async function scrapeEdituraTrei(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    const currentPrice =
        $(".product-book-sale-price").first().text().trim();

    const oldPriceRaw =
        $(".product-book-regular-price").first().text().trim();

    const discount =
        $(".product-book-discount-percentage")
            .first()
            .text()
            .replace("Reducere:", "")
            .trim();

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    const found = applyPriceToBook(book, {
        currentPrice: currentPrice.replace(".", ",").replace("lei", "Lei"),
        oldPrice: oldPriceRaw
            ? oldPriceRaw.replace(".", ",").replace("lei", "Lei")
            : null,
        discount: discount || null
    });

    if (found) logSuccess(book);

}

module.exports = scrapeEdituraTrei;
