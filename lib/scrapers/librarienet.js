const { applyPriceToBook, logSuccess, logNotFound } = require("../helpers");

// Librarie.net — prețurile sunt într-un tabel (table.css_box_pret),
// nu în clase CSS dedicate, așa că le citim rând cu rând după etichetă
async function scrapeLibrarienet(book, { axios, cheerio }) {

    const response =
        await axios.get(book.productUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

    const $ = cheerio.load(response.data);

    const rows = $("table.css_box_pret tr");

    let currentPrice = "";
    let oldPrice = "";
    let discount = "";

    rows.each((i, row) => {

        const label = $(row).find("td").first().text().trim();
        const value = $(row).find("td").last();

        if (label.includes("Pret de lista")) {

            const parts =
                value.text().replace(/\s+/g, "").match(/(\d+)(\d{2})/);

            if (parts) oldPrice = parts[1] + "," + parts[2] + " Lei";

        }

        if (label.includes("Preț")) {

            const parts =
                value.text().replace(/\s+/g, "").match(/(\d+)(\d{2})/);

            if (parts) currentPrice = parts[1] + "," + parts[2] + " Lei";

        }

        if (label.includes("Reducere")) {

            const match = value.text().match(/\((.*?)\)/);

            if (match) discount = match[1];

        }

    });

    if (!currentPrice) {
        logNotFound(book);
        return;
    }

    const found = applyPriceToBook(book, {
        currentPrice,
        oldPrice: oldPrice || null,
        discount: discount || null
    });

    if (found) logSuccess(book);

}

module.exports = scrapeLibrarienet;
