const cheerio = require("cheerio");

const htmlBySource = {

    edituratrei: `<div class="product-book-sale-price">45,00 lei</div>
                  <div class="product-book-regular-price">60,00 lei</div>
                  <div class="product-book-discount-percentage">Reducere: 25%</div>`,

    curteaveche: `<span class="price">39,90 lei</span>
                  <span class="old--price">49,90 lei</span>`,

    bookzone: `<span class="details__info__price__new">55.00 lei</span>
               <span class="details__info__price__old">PRP: 70.00 lei</span>`,

    actsipoliton: `<div class="product-price">99,00 Lei</div>`,

    librarienet: `<table class="css_box_pret">
                    <tr><td>Pret de lista</td><td>10000</td></tr>
                    <tr><td>Preț</td><td>8500</td></tr>
                    <tr><td>Reducere</td><td>(15%)</td></tr>
                  </table>`,

    nemira: `<meta itemprop="price" content="42.5">
             <div class="old-price"><span class="price">55.00</span></div>`,

    libris: `<p class="pr-discaunt-icon price-discount-containerx">-60%</p>
             <p class="pr-pret-redus">28.01<span>Lei</span></p>
             <span class="pr-pret-intreg">69.67 Lei</span>`,

    carturesti: `<span class="pret">20<span class="bani">50</span></span>
                 <div><span class="lei" style="text-decoration: line-through">41</span><span>.00</span>lei</div>
                 <div class="discount pull-right">50% reducere<span class="tt">i<div class="toolTip">text tooltip</div></span></div>`

};

const fakeAxios = {
    async get(url) {
        const source = url.split("://")[1].split(".")[0]; // ex: "edituratrei.ro/..." -> "edituratrei"
        return { data: htmlBySource[source] };
    }
};

const scrapers = require("./lib/scrapers");

async function run() {

    const cases = [
        { source: "edituratrei", productUrl: "https://edituratrei.ro/carte" },
        { source: "curteaveche", productUrl: "https://curteaveche.ro/carte" },
        { source: "bookzone", productUrl: "https://bookzone.ro/carte" },
        { source: "actsipoliton", affiliate: "https://actsipoliton.ro/carte?tracking=abc" },
        { source: "librarienet", productUrl: "https://librarienet.ro/carte" },
        { source: "nemira", productUrl: "https://nemira.ro/carte" },
        { source: "libris", productUrl: "https://libris.ro/carte" },
        { source: "carturesti", productUrl: "https://carturesti.ro/carte" }
    ];

    for (const testBook of cases) {

        const book = { title: "Test " + testBook.source, price: "0 Lei", ...testBook };

        await scrapers[book.source](book, {
            axios: fakeAxios,
            cheerio
        });

        console.log(
            book.source.padEnd(14),
            "price=" + book.price,
            "oldPrice=" + (book.oldPrice || "-"),
            "discount=" + (book.discount || "-")
        );

    }

}

run();
