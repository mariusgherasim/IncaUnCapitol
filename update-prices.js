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

        try {

            const cleanUrl =
                book.affiliate
                    .split("?")[0];

            console.log(
                "Actualizez:",
                book.title
            );

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