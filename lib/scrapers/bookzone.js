const { applyPriceToBook, logSuccess, logNotFound, getFirstText } = require("../helpers");

// Bookzone.ro — adăugat 03/07/2026
// Notă: pe 2Performant, Google Ads (search) e interzis ca sursă de
// promovare pentru afilierea cu Bookzone — nu are legătură cu acest
// script, dar e o regulă importantă de reținut la promovarea cărților
// de aici.
async function scrapeBookzone(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    const currentPrice =
        $(".details__info__price__new").first().text().trim();

    const oldPrice =
        getFirstText($, ["span.details__info__price__old"])
            .replace("PRP:", "")
            .trim();

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    const found = applyPriceToBook(book, {
        currentPrice: currentPrice.replace(".", ",").replace("lei", "Lei").trim(),
        oldPrice: oldPrice
            ? oldPrice.replace(".", ",").replace("lei", "Lei").trim()
            : null
    });

    if (found) logSuccess(book);

}

module.exports = scrapeBookzone;
