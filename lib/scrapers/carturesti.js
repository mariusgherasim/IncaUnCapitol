const { applyPriceToBook, logSuccess, logNotFound } = require("../helpers");

// Carturesti.ro — atenție: prețul e împărțit ciudat pe elemente HTML
// separate, atât la prețul curent cât și la cel vechi (nu e text
// simplu într-un singur element, ca la majoritatea celorlalte surse):
//
//   pret curent:  <span class="pret">20<span class="bani">50</span></span>
//                 -> "20" (text direct) + "50" (span.bani) = 20,50 Lei
//
//   pret vechi:   <span class="lei" style="text-decoration:line-through">41</span>
//                 <span style="...">.00</span>lei
//                 -> "41" (span.lei) + ".00" (span urmator) = 41,00 Lei
//
// Discount-ul e într-un div care conține și un tooltip cu text lung
// ("Discountul se acordă de la...") — nu folosim tot text()-ul, doar
// primul "NN%" găsit, ca să nu prindem accidental alt număr din tooltip.

async function scrapeCarturesti(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    // preț curent: partea întreagă e text direct în .pret, banii sunt
    // în span.bani, imbricat în interior
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

    // preț vechi: span.lei (partea întreagă, tăiată) + span-ul următor
    // (care conține deja punctul, ex. ".00")
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

    // discount: primul "NN%" din text, ignorând tooltip-ul care urmează
    const discountText =
        $(".discount").first().text().trim();

    const discountMatch = discountText.match(/(\d+)%/);
    const discount = discountMatch ? discountMatch[1] + "%" : null;

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    const found = applyPriceToBook(book, {
        currentPrice,
        oldPrice,
        discount
    });

    if (found) logSuccess(book);

}

module.exports = scrapeCarturesti;
