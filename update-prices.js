const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");

function calculateDiscount(oldPrice, newPrice) {

    const oldValue =
        parseFloat(
            oldPrice
                .replace(",", ".")
                .replace("Lei", "")
                .trim()
        );

    const newValue =
        parseFloat(
            newPrice
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

async function updatePrices() {

    const books =
        JSON.parse(
            fs.readFileSync(
                "books.json",
                "utf8"
            )
        );

    for (const book of books) {
            if (
                book.source &&
                ![
                    "actsipoliton",
                    "edituratrei",
                    "curteaveche"
                ].includes(
                    book.source
                )
            ) {

                console.log(
                    "⏭ Ignor:",
                    book.title
                );

                continue;

            }  
        try {

            const cleanUrl =
                book.affiliate
                    .split("?")[0];

            console.log(
                "Actualizez:",
                book.title
            );

            if (
                book.source ===
                "edituratrei"
            ) {

                const response =
                    await axios.get(
                        book.productUrl,
                        {
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0"
                            }
                        }
                    );

                const $ =
                    cheerio.load(
                        response.data
                    );

                const currentPrice =
                    $(".product-book-sale-price")
                        .first()
                        .text()
                        .trim();

                const oldPrice =
                    $(".product-book-regular-price")
                        .first()
                        .text()
                        .trim();

                const discount =
                    $(".product-book-discount-percentage")
                        .first()
                        .text()
                        .replace(
                            "Reducere:",
                            ""
                        )
                        .trim();

                if (currentPrice) {

                    book.price =
                        currentPrice
                            .replace(".", ",")
                            .replace("lei", "Lei");

                    if (oldPrice) {

                        book.oldPrice =
                            oldPrice
                                .replace(".", ",")
                                .replace("lei", "Lei");

                    }

                    if (discount) {

                        book.discount =
                            discount;

                    }

                    console.log(
                        "✔",
                        book.title,
                        book.price
                    );

                } else {

                    console.log(
                        "⚠ Nu am găsit prețul:",
                        book.title
                    );

                }

                continue;

            }

            if (
                book.source ===
                "curteaveche"
            ) {

                const response =
                    await axios.get(
                        book.productUrl,
                        {
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0"
                            }
                        }
                    );

                const $ =
                    cheerio.load(
                        response.data
                    );

                const currentPrice =
                    $(".price")
                        .first()
                        .text()
                        .trim();

                const oldPrice =
                    $(".old--price")
                        .first()
                        .text()
                        .trim();

                if (currentPrice) {

                    book.price =
                        currentPrice
                            .replace("lei", "Lei")
                            .trim();

                    if (oldPrice) {

                        book.oldPrice =
                            oldPrice
                                .replace("lei", "Lei")
                                .trim();

                        book.discount =
                            calculateDiscount(
                                book.oldPrice,
                                book.price
                            );

                    } else {

                        delete book.oldPrice;
                        delete book.discount;

                    }

                    console.log(
                        "✔",
                        book.title,
                        book.price
                    );

                } else {

                    console.log(
                        "⚠ Nu am găsit prețul:",
                        book.title
                    );

                }

                continue;

            }









            const response =
                await axios.get(
                    cleanUrl,
                    {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0"
                        }
                    }
                );

            const $ =
                cheerio.load(
                    response.data
                );

            const currentPrice =
                $(".product-main-type-item.active .product-main-type-item-price")
                    .first()
                    .clone()
                    .children()
                    .remove()
                    .end()
                    .text()
                    .trim();

            const oldPrice =
                $(".product-main-type-item-price-old")
                    .first()
                    .text()
                    .trim();

            if (currentPrice) {

                book.price = currentPrice;

                if (oldPrice && oldPrice !== currentPrice) {

                    book.oldPrice = oldPrice;

                    book.discount =
                        calculateDiscount(
                            oldPrice,
                            currentPrice
                        );

                } else {

                    delete book.oldPrice;
                    delete book.discount;
                    delete book.offerEnds;

                }

                console.log(
                    "✔",
                    book.title,
                    book.price
                );

            } else {

                console.log(
                    "⚠ Nu am găsit prețul:",
                    book.title
                );

            }

        }
        catch (error) {

            console.log(
                "❌ Eroare:",
                book.title
            );

        }

    }

    fs.writeFileSync(
        "books.json",
        JSON.stringify(
            books,
            null,
            2
        )
    );

    console.log(
        "\nToate prețurile au fost actualizate."
    );

}

updatePrices();