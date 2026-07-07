const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

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

async function updatePrices() {

    const books =
        JSON.parse(
            fs.readFileSync(
                "books.json",
                "utf8"
            )
        );

    let humanitasBrowser = null;
    let humanitasContext = null;

    async function getHumanitasContext() {
        if (!humanitasBrowser) {
            console.log("🌐 Pornesc Chromium pentru Humanitas...");

            humanitasBrowser = await chromium.launch({
                headless: true
            });

            humanitasContext = await humanitasBrowser.newContext({
                userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
                locale: "ro-RO",
                viewport: {
                    width: 1366,
                    height: 768
                }
            });
        }

        return humanitasContext;
    }

    for (const book of books) {
            if (
                book.source &&
                ![
                    "actsipoliton",
                    "edituratrei",
                    "curteaveche",
                    "bookzone",
                    "humanitas"
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
                /* Adăugat toată sintaxa if, in data de 03/07/2026, pentru editura bookzone  */
            if (
                book.source ===
                "bookzone"
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
                    $(".details__info__price__new")
                        .first()
                        .text()
                        .trim();

                const oldPrice =
                    getFirstText($, [
                        "span.details__info__price__old"
                    ])
                    .replace("PRP:", "")
                    .trim();
                                  
                    /*$(".details__info__price__old")
                        .first()
                        .text()
                        .replace("PRP:", "")
                        .trim();*/

                if (currentPrice) {

                    book.price =
                        currentPrice
                            .replace(".", ",")
                            .replace("lei", "Lei")
                            .trim();

                    if (
                        oldPrice &&
                        oldPrice !== book.price
                    ) {

                        book.oldPrice =
                            oldPrice
                                .replace(".", ",")
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

                continue;

            }

            if (
                book.source ===
                "humanitas"
            ) {

                let page = null;

                try {

                    console.log(
                        "🌐 Humanitas:",
                        book.title
                    );


                    const context =
                        await getHumanitasContext();


                    page =
                        await context.newPage();


                    // =====================================
                    // FUNCȚIE ÎNCĂRCARE PAGINĂ
                    // =====================================

                    const loadHumanitasPage =
                        async () => {

                            await page.goto(
                                book.productUrl,
                                {
                                    waitUntil:
                                        "domcontentloaded",

                                    timeout:
                                        60000
                                }
                            );


                            await page.waitForTimeout(
                                3000
                            );


                            return await page.title();

                        };


                    // =====================================
                    // PRIMA ÎNCERCARE
                    // =====================================

                    let pageTitle =
                        await loadHumanitasPage();


                    // =====================================
                    // DETECTARE PAGINĂ DE VERIFICARE
                    // =====================================

                    if (
                        pageTitle
                            .toLowerCase()
                            .includes(
                                "doar un moment"
                            )
                    ) {

                        console.log(
                            "⏳ Verificare temporară:",
                            book.title
                        );


                        // Așteptăm ca pagina reală să apară

                        await page.waitForTimeout(
                            8000
                        );


                        pageTitle =
                            await page.title();


                        // Dacă verificarea este încă activă,
                        // facem un singur retry controlat

                        if (
                            pageTitle
                                .toLowerCase()
                                .includes(
                                    "doar un moment"
                                )
                        ) {

                            console.log(
                                "🔄 Retry Humanitas:",
                                book.title
                            );


                            await page.waitForTimeout(
                                5000
                            );


                            pageTitle =
                                await loadHumanitasPage();

                        }

                    }


                    // =====================================
                    // VERIFICARE FINALĂ
                    // =====================================

                    if (
                        pageTitle
                            .toLowerCase()
                            .includes(
                                "doar un moment"
                            )
                    ) {

                        console.log(
                            "⏭ Humanitas indisponibil temporar:",
                            book.title
                        );


                        console.log(
                            "   Păstrez prețul existent:",
                            book.price
                        );


                        continue;

                    }


                    // =====================================
                    // PREȚ ACTUAL
                    // =====================================

                    let currentPrice = null;

                    let oldPrice = null;


                    // 1. data-price-amount

                    currentPrice =
                        await page
                            .locator(
                                '[data-price-type="finalPrice"]'
                            )
                            .first()
                            .getAttribute(
                                "data-price-amount"
                            )
                            .catch(
                                () => null
                            );


                    // =====================================
                    // 2. FALLBACK META PRICE
                    // =====================================

                    if (!currentPrice) {

                        currentPrice =
                            await page
                                .locator(
                                    'meta[itemprop="price"]'
                                )
                                .first()
                                .getAttribute(
                                    "content"
                                )
                                .catch(
                                    () => null
                                );

                    }


                    // =====================================
                    // 3. FALLBACK TEXT PREȚ
                    // =====================================

                    if (!currentPrice) {

                        currentPrice =
                            await page
                                .locator(
                                    ".product-info-price .price"
                                )
                                .first()
                                .textContent()
                                .catch(
                                    () => null
                                );

                    }


                    // =====================================
                    // PREȚ VECHI
                    // =====================================

                    oldPrice =
                        await page
                            .locator(
                                '[data-price-type="oldPrice"]'
                            )
                            .first()
                            .getAttribute(
                                "data-price-amount"
                            )
                            .catch(
                                () => null
                            );


                    // FALLBACK PREȚ VECHI

                    if (!oldPrice) {

                        oldPrice =
                            await page
                                .locator(
                                    ".old-price .price"
                                )
                                .first()
                                .textContent()
                                .catch(
                                    () => null
                                );

                    }


                    // =====================================
                    // NORMALIZARE PREȚ
                    // =====================================

                    const formatHumanitasPrice =
                        (value) => {

                            if (!value) {

                                return null;

                            }


                            const cleanedValue =
                                String(value)

                                    .replace(
                                        ",",
                                        "."
                                    )

                                    .replace(
                                        /[^\d.]/g,
                                        ""
                                    );


                            const numericValue =
                                parseFloat(
                                    cleanedValue
                                );


                            if (
                                Number.isNaN(
                                    numericValue
                                )
                            ) {

                                return null;

                            }


                            return (

                                numericValue

                                    .toFixed(2)

                                    .replace(
                                        ".",
                                        ","
                                    )

                                +

                                " Lei"

                            );

                        };


                    // =====================================
                    // SALVARE PREȚ
                    // =====================================

                    if (currentPrice) {


                        const formattedCurrentPrice =

                            formatHumanitasPrice(
                                currentPrice
                            );


                        const formattedOldPrice =

                            formatHumanitasPrice(
                                oldPrice
                            );


                        if (formattedCurrentPrice) {


                            book.price =
                                formattedCurrentPrice;


                            // =============================
                            // PREȚ VECHI + DISCOUNT
                            // =============================

                            if (

                                formattedOldPrice &&

                                formattedOldPrice !==
                                formattedCurrentPrice

                            ) {


                                book.oldPrice =
                                    formattedOldPrice;


                                book.discount =

                                    calculateDiscount(

                                        book.oldPrice,

                                        book.price

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


                            if (book.oldPrice) {


                                console.log(

                                    "   Preț vechi:",

                                    book.oldPrice

                                );


                                console.log(

                                    "   Reducere:",

                                    book.discount

                                );

                            }

                        }


                    } else {


                        console.log(

                            "⚠ Nu am găsit prețul:",

                            book.title

                        );


                        console.log(

                            "   Păstrez prețul existent:",

                            book.price

                        );


                        console.log(

                            "   URL final:",

                            page.url()

                        );


                        console.log(

                            "   Titlu pagină:",

                            await page.title()

                        );

                    }


                } catch (error) {


                    console.log(

                        "❌ Humanitas:",

                        book.title

                    );


                    console.log(

                        error.message

                    );


                    console.log(

                        "   Păstrez prețul existent:",

                        book.price

                    );


                } finally {


                    if (page) {

                        await page.close();

                    }

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
                getFirstText($, [

                    ".product-main-type-item.active .product-main-type-item-price",

                    ".pp-action-price-value",

                    ".product-price",

                    ".price"

                ]);

            const oldPrice =
                getFirstText($, [

                    ".product-main-type-item-price-old",

                    ".pp-action-price-old-value"

                ]);

            const discountText =
                getFirstText($, [

                    ".pp-action-price-old-title"

                ]);

            if (currentPrice) {

                book.price =
                    currentPrice
                        .replace(/\s+/g, " ")
                        .trim();

                if (oldPrice) {

                    book.oldPrice =
                        oldPrice
                            .replace(/\s+/g, " ")
                            .trim();

                    if (
                        discountText &&
                        discountText.includes("Economisești")
                    ) {

                        book.discount =
                            discountText
                                .replace("Economisești", "")
                                .trim();

                    } else {

                        book.discount =
                            calculateDiscount(
                                book.oldPrice,
                                book.price
                            );

                    }

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
            /* Am scos asta in data de 03/07/2026 si am inlocuit cu ce este mai jos,pentru -Astfel, dacă Bookzone schimbă vreodată selectorii sau apare o eroare HTTP (403, 404 etc.), vei vedea imediat cauza exactă.
            console.log(
                "❌ Eroare:",
                book.title
            );
            */
            /* am adăugat in data de 03/07/2026: console.log( "\n❌", book.title ); +  console.log(error.message); pentru a vedea ce eroare este:403, 404 sau Cannot read property... */
            
            console.log( "\n❌", book.title );
                        
            console.log(
                error.message
            );
        }
    }

    if (humanitasBrowser) {
        await humanitasBrowser.close();

        console.log(
            "🌐 Chromium Humanitas închis."
        );
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