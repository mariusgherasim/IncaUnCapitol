// ========================================
// HELPERE COMUNE — folosite de toate scraperele
// ========================================

// Calculează procentul de reducere pornind de la două prețuri text
// (ex: "120,00 Lei" și "99,00 Lei" -> "18%")
function calculateDiscount(oldPrice, newPrice) {

    const oldValue =
        parseFloat(
            String(oldPrice)
                .replace(",", ".")
                .replace("Lei", "")
                .trim()
        );

    const newValue =
        parseFloat(
            String(newPrice)
                .replace(",", ".")
                .replace("Lei", "")
                .trim()
        );

    if (!oldValue || !newValue) {
        return "";
    }

    const discount =
        Math.round(
            ((oldValue - newValue) / oldValue) * 100
        );

    return discount + "%";

}

// Extrage textul primului selector care se potrivește dintr-o listă
// de selectori candidați (utilizat pentru site-uri unde structura
// HTML diferă ușor de la pagină la pagină)
function getFirstText($, selectors) {

    for (const selector of selectors) {

        const value =
            $(selector)
                .first()
                .clone()
                .children()
                .remove()
                .end()
                .text()
                .trim();

        if (value) {
            return value;
        }

    }

    return "";

}

// Normalizează un preț text la formatul "123,45 Lei"
// Acceptă orice separator zecimal și orice text în jurul cifrelor
// (ex: "123.45 lei", "123,45RON", "  123.45  " -> "123,45 Lei")
function formatPriceLei(value) {

    if (!value) {
        return null;
    }

    const cleaned =
        String(value)
            .replace(",", ".")
            .replace(/[^\d.]/g, "");

    const numeric = parseFloat(cleaned);

    if (Number.isNaN(numeric)) {
        return null;
    }

    return (
        numeric
            .toFixed(2)
            .replace(".", ",")
        + " Lei"
    );

}

// Aplică pe `book` prețul curent + (opțional) prețul vechi/reducerea,
// cu aceeași logică repetată în toate scraperele: dacă nu mai există
// preț vechi, se șterg oldPrice/discount/offerEnds rămase dintr-o
// ofertă anterioară.
function applyPriceToBook(book, { currentPrice, oldPrice, discount }) {

    if (!currentPrice) {
        return false;
    }

    book.price = currentPrice;

    if (oldPrice && oldPrice !== currentPrice) {

        book.oldPrice = oldPrice;

        book.discount =
            discount ||
            calculateDiscount(oldPrice, currentPrice);

    } else {

        delete book.oldPrice;
        delete book.discount;
        delete book.offerEnds;

    }

    return true;

}

function logSuccess(book) {

    console.log("✔", book.title, book.price);

    if (book.oldPrice) {

        console.log("   Preț vechi:", book.oldPrice);
        console.log("   Reducere:", book.discount);

    }

}

function logNotFound(book) {

    console.log("⚠ Nu am găsit prețul:", book.title);
    console.log("   Păstrez prețul existent:", book.price);

}

function logError(book, error) {

    console.log("\n❌", book.title);
    console.log(error.message);

}

module.exports = {
    calculateDiscount,
    getFirstText,
    formatPriceLei,
    applyPriceToBook,
    logSuccess,
    logNotFound,
    logError
};
