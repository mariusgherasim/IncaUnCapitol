const { applyPriceToBook, logSuccess, logNotFound, getFirstText } = require("../helpers");

// Act și Politon — foloseste link-ul de afiliere curățat de query params
// (?tracking=...) în loc de un productUrl separat, ca celelalte scrapere
async function scrapeActsiPoliton(book, { axios, cheerio }) {

    const cleanUrl = book.affiliate.split("?")[0];

    const response =
        await axios.get(cleanUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    const currentPrice = getFirstText($, [

        ".product-main-type-item.active .product-main-type-item-price",
        ".pp-action-price-value",
        ".product-price",
        ".price"

    ]);

    const oldPrice = getFirstText($, [

        ".product-main-type-item-price-old",
        ".pp-action-price-old-value"

    ]);

    const discountText = getFirstText($, [
        ".pp-action-price-old-title"
    ]);

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    let discount = null;

    if (discountText && discountText.includes("Economisești")) {
        discount = discountText.replace("Economisești", "").trim();
    }

    const found = applyPriceToBook(book, {
        currentPrice: currentPrice.replace(/\s+/g, " ").trim(),
        oldPrice: oldPrice ? oldPrice.replace(/\s+/g, " ").trim() : null,
        discount
    });

    if (found) logSuccess(book);

}

module.exports = scrapeActsiPoliton;
