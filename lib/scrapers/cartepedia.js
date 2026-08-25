const { applyPriceToBook, logSuccess, logNotFound, formatPriceLei } = require("../helpers");

// Cartepedia.ro — spre deosebire de majoritatea surselor, pretul nu e
// text simplu de citit din HTML afisat, ci e disponibil curat, ca
// atribute pe butonul de adaugare in cos (#addtobasket):
//   data-price="24.5"  -> pretul curent de vanzare
//   price="49.00"      -> pretul de lista (RRP), inainte de reducere
// Mult mai fiabil decat parsarea span-urilor fragmentate afisate
// vizual (.top_price / .top_price_discount), care despart cifrele
// intregi de "bani" in elemente HTML separate.

async function scrapeCartepedia(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    const button = $("#addtobasket").first();

    const dataPriceRaw = button.attr("data-price"); // pret curent, ex "24.5"
    const priceAttrRaw = button.attr("price");       // pret de lista, ex "49.00"

    const currentPrice = formatPriceLei(dataPriceRaw);

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    const oldPrice =
        priceAttrRaw && parseFloat(priceAttrRaw) > parseFloat(dataPriceRaw)
            ? formatPriceLei(priceAttrRaw)
            : null;

    const discountText =
        $(".discount_percentage p").first().text().trim();

    const found = applyPriceToBook(book, {
        currentPrice,
        oldPrice,
        discount: discountText || null
    });

    if (found) logSuccess(book);

}

module.exports = scrapeCartepedia;
