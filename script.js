// ========================================
// VARIABILE GLOBALE
// ========================================

let books = [];

let monthlyBook = {};

// ========================================
// UTILITARE
// ========================================

// Scapă textul pentru a putea fi inserat în siguranță în HTML
// (evită ruperea marcajului dacă un titlu conține <, >, &, " sau ')
function escapeHtml(value) {

    if (value === null || value === undefined)
        return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

// Generează un id valid de element HTML dintr-un titlu de carte
// (înlocuiește orice caracter care nu e literă/cifră, nu doar spațiul)
function slugifyForId(title) {

    return String(title)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // elimină diacriticele
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

}

// ========================================
// RECOMANDAREA LUNII
// ========================================

function renderMonthlyBook() {

    const container =
        document.getElementById(
            "monthlyBookContainer"
        );

    if (!container || !monthlyBook.title)
        return;

    container.innerHTML = `

        <div class="monthly-book">

            <div class="monthly-book-image">

                <img
                    src="${escapeHtml(monthlyBook.image)}"
                    alt="${escapeHtml(monthlyBook.title)}"
                    loading="lazy"
                    decoding="async"
                >

            </div>

            <div class="monthly-book-content">

                <span class="badge">
                    Recomandarea mea
                </span>

                <h3 class="book-title">
                    ${escapeHtml(monthlyBook.title)}
                </h3>

                <p class="book-author">
                    ${escapeHtml(monthlyBook.author)}
                </p>

                <div class="book-score">
                    Scor ÎncăUnCapitol:
                    ${escapeHtml(monthlyBook.score)}
                </div>

                <p>

                <em>
                    ${escapeHtml(monthlyBook.description).replace(/\n\n/g, "<br><br>")}
                </em>

                </p>

                <br>

                <a
                    href="${escapeHtml(monthlyBook.affiliate)}"
                    target="_blank"
                    rel="noopener sponsored"
                    class="cta-btn"
                    data-track="monthly"
                    data-title="${escapeHtml(monthlyBook.title)}"
                    data-author="${escapeHtml(monthlyBook.author)}"
                >

                    Cumpără acum

                </a>

            </div>

        </div>

    `;
}

// ========================================
// CARD CARTE
// ========================================

function createBookCard(book) {

    return `

        <div class="book-card">

            <img
                src="${escapeHtml(book.image)}"
                alt="${escapeHtml(book.title)}"
                loading="lazy"
                decoding="async"
            >

            <div class="book-content">

                 <h3 class="book-title">

                    ${escapeHtml(book.title)}

                </h3>

                <p class="book-author">

                    ${escapeHtml(book.author)}

                </p>

                <div class="book-score">

                    Scor ÎncăUnCapitol:
                    ${escapeHtml(book.score)}

                </div>

                ${
                    book.publisher
                    ?
                    `
                    <p>
                    <strong>Editura:</strong>
                    ${escapeHtml(book.publisher)}
                    </p>
                    `
                    :
                    ""
                }

                ${
                    book.pages
                    ?
                    `
                    <p>
                    <strong>Pagini:</strong>
                    ${escapeHtml(book.pages)}
                    </p>
                    `
                    :
                    ""
                }

                ${
                    book.format
                    ?
                    `
                    <p>
                    <strong>Format:</strong>
                    ${escapeHtml(book.format)}
                    </p>
                    `
                    :
                    ""
                }

                <p class="book-description">

                <em>

                    ${escapeHtml(book.description)}

                </em>    

                </p>

                ${
                    book.why
                    ?
                    `
                    <div class="why-read">

                        <strong>
                        De ce o recomand:
                        </strong>

                        <br>

                        ${escapeHtml(book.why)}

                    </div>
                    `
                    :
                    ""
                }

                <div class="price-box">

                    ${
                        book.oldPrice
                        ?
                        `
                        <span class="old-price">
                            ${escapeHtml(book.oldPrice)}
                        </span>
                        `
                        :
                        ""
                    }

                    <span class="new-price">
                        ${escapeHtml(book.price)}
                    </span>

                    ${
                        book.discount
                        ?
                        `
                        <span class="discount">
                            ${escapeHtml(book.discount)}
                        </span>
                        `
                        :
                        ""
                    }

                </div>

                ${
                    book.offerEnds
                    ?
                    `
                    <div class="countdown-wrapper">

                    <div class="countdown-labels">

                    <span>ZILE</span>

                    <span>ORE</span>

                    <span>MINUTE</span>

                    <span>SECUNDE</span>

                    </div>

                    <div
                    class="countdown-time"
                    id="countdown-${slugifyForId(book.title)}"
                    >

                    00 : 00 : 00 : 00

                    </div>

                    </div>
                    `
                    :
                    ""
                }

                <a
                    href="${escapeHtml(book.affiliate)}"
                    target="_blank"
                    rel="noopener sponsored"
                    class="buy-btn"
                    data-track="book"
                    data-title="${escapeHtml(book.title)}"
                    data-author="${escapeHtml(book.author)}"
                    data-source="${escapeHtml(book.source)}"
                >

                    Cumpără

                </a>

            </div>

        </div>

    `;
}

// ========================================
// AFIȘARE CĂRȚI + PAGINARE
// ========================================

const PAGE_SIZE = 12;

let currentBookList = [];
let currentPage = 1;

// Punctul de intrare folosit de filtrare/căutare: primește lista
// (deja filtrată/căutată) și resetează mereu la pagina 1.
function renderBooks(bookList) {

    currentBookList = bookList;
    currentPage = 1;

    renderCurrentPage();

}

function renderCurrentPage() {

    const container =
        document.getElementById(
            "booksContainer"
        );

    if (!container)
        return;

    const totalPages =
        Math.max(
            1,
            Math.ceil(currentBookList.length / PAGE_SIZE)
        );

    if (currentPage > totalPages)
        currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;

    const pageBooks =
        currentBookList.slice(start, start + PAGE_SIZE);

    container.innerHTML =
        pageBooks.length
        ?
        pageBooks
            .map(book =>
                createBookCard(book)
            )
            .join("")
        :
        `<p class="load-error">Nicio carte găsită.</p>`;

    injectBooksSchema(currentBookList);

    renderPagination(totalPages);

    stopCountdowns();

    startCountdowns(pageBooks);

}

function renderPagination(totalPages) {

    const container =
        document.getElementById(
            "paginationContainer"
        );

    if (!container)
        return;

    if (totalPages <= 1) {

        container.innerHTML = "";
        return;

    }

    let html = `
        <button
            type="button"
            class="page-btn"
            data-page="${currentPage - 1}"
            ${currentPage === 1 ? "disabled" : ""}
        >&laquo; Anterior</button>
    `;

    for (let i = 1; i <= totalPages; i++) {

        html += `
            <button
                type="button"
                class="page-btn ${i === currentPage ? "active" : ""}"
                data-page="${i}"
            >${i}</button>
        `;

    }

    html += `
        <button
            type="button"
            class="page-btn"
            data-page="${currentPage + 1}"
            ${currentPage === totalPages ? "disabled" : ""}
        >Următor &raquo;</button>
    `;

    container.innerHTML = html;

}

function goToPage(page) {

    currentPage = page;

    renderCurrentPage();

    const catalogSection =
        document.getElementById("carti");

    if (catalogSection) {

        catalogSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

}

function initializePaginationDelegation() {

    document.addEventListener("click", function (e) {

        const btn = e.target.closest(".page-btn");

        if (!btn || btn.disabled)
            return;

        const page = parseInt(btn.dataset.page, 10);

        if (!page || page < 1)
            return;

        goToPage(page);

    });

}

// ========================================
// FILTRARE
// ========================================

function filterBooks(category) {

    if (category === "all") {

        renderBooks(books);

        return;

    }

    const filteredBooks =
        books.filter(book =>
            book.category === category
        );

    renderBooks(filteredBooks);

}

// ========================================
// CĂUTARE
// ========================================

function initializeSearch() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (!searchInput)
        return;

    searchInput.addEventListener(
        "keyup",
        function () {

            const value =
                this.value.toLowerCase();

            const filteredBooks =
                books.filter(book =>

                    book.title
                        .toLowerCase()
                        .includes(value)

                    ||

                    book.author
                        .toLowerCase()
                        .includes(value)

                );

            renderBooks(
                filteredBooks
            );

        }
    );

}

// ========================================
// ÎNCĂRCARE BOOKS.JSON
// ========================================

async function loadBooks() {

    try {

        // cache-busting: evită servirea unei versiuni vechi din
        // cache-ul browserului/CDN-ului după actualizarea automată de preț
        const response =
            await fetch(
                "books.json?v=" + Date.now(),
                { cache: "no-store" }
            );

        books =
            await response.json();

        // cartile marcate indisponibile de update-prices.js (pret
        // negasit dupa o incarcare reusita a paginii, nu blocaj
        // anti-bot temporar) nu se afiseaza pe site — dar raman in
        // books.json neatinse, ca sa poata reveni automat daca
        // produsul e din nou pe stoc la o rulare viitoare
        books = books.filter(book =>
            book.price !== null && book.available !== false
        );

        books.reverse();

        renderBooks(books);

    }
    catch (error) {

        console.error(
            "Eroare încărcare books.json:",
            error
        );

        const container =
            document.getElementById(
                "booksContainer"
            );

        if (container) {

            container.innerHTML =
                `<p class="load-error">Catalogul de cărți nu a putut fi încărcat momentan. Reîncearcă mai târziu.</p>`;

        }

    }

}

// ========================================
// ÎNCĂRCARE MONTHLY-BOOK.JSON
// ========================================

async function loadMonthlyBook() {

    try {

        const response =
            await fetch(
                "monthly-book.json?v=" + Date.now(),
                { cache: "no-store" }
            );

        monthlyBook =
            await response.json();

        renderMonthlyBook();

    }
    catch (error) {

        console.error(
            "Eroare încărcare monthly-book.json:",
            error
        );

    }

}

// ========================================
// INITIALIZARE
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        loadPromos(); // cardurile de promotie (promo.json) — nu asteptam, nu blocheaza restul

        await loadMonthlyBook();

        await loadBooks();

        await loadBanner();

        initializeSearch();

        initializeTrackingDelegation();

        initializeCookieBanner();

        initializePaginationDelegation();

        await initGenericCatalogPage();

    }
);

// ========================================
// NEWSLETTER
// ========================================
// Abonarea e gestionată acum nativ de formularul MailerLite (embed
// direct în index.html) — nu mai are nevoie de cod aici. Evenimentul
// GA4 "newsletter_signup" e trimis din callback-ul de succes al
// MailerLite (ml_webform_success_44026818), definit inline lângă embed.

// ========================================
// Footer cu Contact
// ========================================

function toggleContact(){

const box =
document.getElementById(
"contactBox"
);

box.style.display =
box.style.display==="block"
?
"none"
:
"block";

}

// ========================================
// startCountdowns / stopCountdowns
// ========================================
// La fiecare schimbare de pagină/filtru se randează doar un subset de
// cărți — countdown-urile trebuie pornite doar pentru cărțile vizibile
// acum, iar cele de la randarea anterioară trebuie oprite explicit
// (altfel se acumulează interval-uri fantomă care rulează pe elemente
// care nu mai există în DOM).

let activeCountdownIntervals = [];

function stopCountdowns(){

activeCountdownIntervals.forEach(id => clearInterval(id));

activeCountdownIntervals = [];

}

function startCountdowns(visibleBooks){

visibleBooks.forEach(book=>{

if(!book.offerEnds)
return;

const element =
document.getElementById(
`countdown-${slugifyForId(book.title)}`
);

if(!element)
return;

const interval =
setInterval(()=>{

const now =
new Date().getTime();

const endDate =
new Date(
book.offerEnds
).getTime();

const distance =
endDate - now;

if(distance <= 0){

clearInterval(interval);

const card =
element.closest(
".book-card"
);

if(card){

card.remove();

}

return;

}

const days =
Math.floor(
distance /
(1000*60*60*24)
);

const hours =
Math.floor(
(distance %
(1000*60*60*24))
/
(1000*60*60)
);

const minutes =
Math.floor(
(distance %
(1000*60*60))
/
(1000*60)
);

const seconds =
Math.floor(
(distance %
(1000*60))
/
1000
);

element.innerHTML =

String(days)
.padStart(2,'0')

+

' : '

+

String(hours)
.padStart(2,'0')

+

' : '

+

String(minutes)
.padStart(2,'0')

+

' : '

+

String(seconds)
.padStart(2,'0');

},1000);

activeCountdownIntervals.push(interval);

});

}

/* ========================================
   GOOGLE ANALYTICS
======================================== */

function trackEvent(eventName, parameters = {}) {

    if (typeof gtag === "function") {

        gtag("event", eventName, parameters);

        console.log("GA4:", eventName, parameters);

    }

}


function trackBookClick(title, author, source){

    trackEvent("click_cumpara",{
        title: title,
        author: author,
        source: source
    });

    trackEvent("affiliate_click",{
        title: title,
        author: author,
        source: source
    });

    console.log("Click înregistrat:", title);

};

function trackMonthlyBook(title, author){

    trackEvent("featured_book_click",{

        book_title:title,

        author:author

    });

};

// Delegare de evenimente pe container-ele care se re-randează
// (books.json/monthly-book.json) — evită onclick inline cu string-uri
// interpolate, care se pot rupe dacă titlul conține apostrof/ghilimele.
function initializeTrackingDelegation(){

    document.addEventListener("click", function(e){

        const link = e.target.closest("[data-track]");

        if (!link) return;

        if (link.dataset.track === "book") {

            trackBookClick(
                link.dataset.title,
                link.dataset.author,
                link.dataset.source
            );

        } else if (link.dataset.track === "monthly") {

            trackMonthlyBook(
                link.dataset.title,
                link.dataset.author
            );

        } else if (link.dataset.track === "banner") {

            trackEvent("banner_click", {
                merchant: link.dataset.merchant
            });

        } else if (link.dataset.track === "promo") {

            trackEvent("promo_click", {
                promo: link.dataset.promo
            });

        } else if (link.dataset.track === "rechizita") {

            trackEvent("click_cumpara_rechizita", {
                title: link.dataset.title,
                brand: link.dataset.brand,
                source: link.dataset.source
            });

        }

    });

}

/* ========================================
   JSON-LD (SEO) — ItemList de cărți
======================================== */

function injectBooksSchema(bookList){

    const existing =
        document.getElementById("books-schema");

    if (existing) existing.remove();

    if (!bookList || !bookList.length) return;

    const schema = {

        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": bookList.slice(0, 50).map((book, index) => ({

            "@type": "ListItem",
            "position": index + 1,
            "item": {

                "@type": "Book",
                "name": book.title,
                "author": {
                    "@type": "Person",
                    "name": book.author
                },
                "image": book.image
                    ? new URL(book.image, window.location.href).href
                    : undefined,
                "offers": book.price
                    ? {
                        "@type": "Offer",
                        "price": String(book.price).replace(/[^\d.,]/g, "").replace(",", "."),
                        "priceCurrency": "RON",
                        "url": book.affiliate
                    }
                    : undefined

            }

        }))

    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "books-schema";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

}

/* ========================================
   COOKIE BANNER (informativ, non-blocant —
   consecvent cu shop.gherasimmarius.com)
======================================== */

function initializeCookieBanner(){

    const STORAGE_KEY = "cookie-consent-dismissed";

    const banner = document.getElementById("cookie-banner");
    const dismissBtn = document.getElementById("cookie-banner-dismiss");

    if (!banner || !dismissBtn) return;

    if (!localStorage.getItem(STORAGE_KEY)) {

        banner.hidden = false;

    }

    dismissBtn.addEventListener("click", () => {

        localStorage.setItem(STORAGE_KEY, "1");
        banner.hidden = true;

    });

}

/* ========================================
   BANNER-SLOT (bannere-imagine de afiliere)
   — rotatie pe zi, fara server, acelasi hash
   folosit si la generate-carti-email.cjs
======================================== */

function hashSeed(str){

    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }

    return Math.abs(hash);

}

// Un banner e valabil daca data de azi cade in intervalul
// startDate..endDate. Ambele campuri sunt optionale si independente:
// - startDate lipsa/gol -> nu are prag de inceput (valabil de oricand)
// - endDate lipsa/gol -> nu are prag de sfarsit (valabil la nesfarsit)
// Nu exista countdown vizual pentru bannere (spre deosebire de
// offerEnds la carti) — doar se ascunde/arata in functie de interval.
function isBannerActive(banner, todayStr){

    if (banner.startDate && todayStr < banner.startDate) return false;

    if (banner.endDate && todayStr > banner.endDate) return false;

    return true;

}

// La cât timp se schimbă bannerul vizibil, cât timp pagina rămâne
// deschisă (nu doar o dată pe zi la încărcare, ci și în timp real).
const BANNER_ROTATION_INTERVAL_MS = 2 * 60 * 1000; // 2 minute

// Inaltimea maxima a unui banner pe site (px). Bannerele mai mari se
// micsoreaza proportional, ca sa nu mai ocupe tot ecranul.
const BANNER_MAX_HEIGHT_PX = 250;

let activeBanners = [];       // bannerele active azi (fara duplicare)
let bannerPool = [];          // acelasi banner apare de "weight" ori aici
let currentBannerIndex = 0;   // index in bannerPool, nu in activeBanners
let bannerRotationTimer = null;

// Construieste "bazinul" de rotatie: un banner cu weight:3 apare de 3
// ori in bannerPool, deci are de 3 ori mai multe sanse sa fie ales la
// fiecare pas, fara sa schimbam deloc mecanismul de rotatie secvential
// deja existent (doar lista din care alegem e mai lunga pentru cele
// cu prioritate).
function buildBannerPool(banners){

    const pool = [];

    banners.forEach(banner => {

        const weight = Math.max(1, parseInt(banner.weight, 10) || 1);

        for (let i = 0; i < weight; i++) {
            pool.push(banner);
        }

    });

    return pool;

}

// Randeaza bannerul curent in TOATE sloturile gasite pe pagina (nu
// doar unul) — homepage poate avea 2 sloturi, fiecare pagina de
// subcategorie are propriul slot; toate arata acelasi banner curent
// din rotatie in acelasi moment.
function renderCurrentBanner(){

    const containers = document.querySelectorAll(".banner-mount");

    if (!containers.length || !bannerPool.length) return;

    const banner = bannerPool[currentBannerIndex];

    const html = `
        <span class="banner-label">Publicitate</span>
        <a
            href="${escapeHtml(banner.link)}"
            target="_blank"
            rel="nofollow sponsored noopener"
            data-track="banner"
            data-merchant="${escapeHtml(banner.merchant)}"
        >
            <img src="${escapeHtml(banner.image)}" alt="${escapeHtml(banner.alt || banner.merchant)}" loading="lazy" style="display:block;width:auto;height:auto;max-width:100%;max-height:${BANNER_MAX_HEIGHT_PX}px;margin:0 auto;">
        </a>
    `;

    containers.forEach(container => {
        container.innerHTML = html;
    });

}

async function loadBanner(){

    const containers = document.querySelectorAll(".banner-mount");

    if (!containers.length) return;

    try {

        const response = await fetch(
            "banners.json?v=" + Date.now(),
            { cache: "no-store" }
        );

        const allBanners = await response.json();

        const today = new Date().toISOString().slice(0, 10);

        activeBanners = allBanners.filter(b =>
            Array.isArray(b.channels) &&
            b.channels.includes("site") &&
            isBannerActive(b, today)
        );

        // niciun banner activ -> ascunde sectiunile de banner (fara spatiu gol pe pagina)
        if (!activeBanners.length) {
            containers.forEach(c => {
                const section = c.closest(".banner-section");
                if (section) section.hidden = true;
            });
            return;
        }

        bannerPool = buildBannerPool(activeBanners);

        // bannerul de pornire ramane ales prin hash-ul zilei (acelasi
        // banner "de baza" in aceeasi zi, pentru toti vizitatorii),
        // apoi rotatia de mai jos avanseaza secvential de-acolo, prin
        // bazinul ponderat
        currentBannerIndex = hashSeed(today + "-banner-site") % bannerPool.length;

        renderCurrentBanner();

        if (bannerRotationTimer) {
            clearInterval(bannerRotationTimer);
        }

        // rotatia in timp real nu are sens cu un singur banner activ
        if (bannerPool.length > 1) {

            bannerRotationTimer = setInterval(() => {

                currentBannerIndex = (currentBannerIndex + 1) % bannerPool.length;
                renderCurrentBanner();

            }, BANNER_ROTATION_INTERVAL_MS);

        }

    } catch (error) {

        console.error("Eroare încărcare banners.json:", error);

    }

}

/* ========================================
   CARDURI DE PROMOTIE (promo.json)
   — carduri mici cu ofertele active, pe toate paginile care
   incarca script.js. Pe homepage stau in .promo-mount; pe
   celelalte pagini se insereaza automat sub header. Fiecare
   card are pages ("all" / "home") si interval start/end
   optional; dupa end dispare singur, fara alta modificare.
======================================== */

function isPromoActive(promo, now){

    if (promo.start && now < new Date(promo.start).getTime()) return false;
    if (promo.end && now > new Date(promo.end).getTime()) return false;
    return true;

}

function createPromoCard(promo){

    const style = [
        promo.accent ? `--promo-accent:${promo.accent}` : "",
        promo.tagBg ? `--promo-tag-bg:${promo.tagBg}` : "",
        promo.tagColor ? `--promo-tag-color:${promo.tagColor}` : "",
        promo.tagSmallColor ? `--promo-tag-small:${promo.tagSmallColor}` : ""
    ].filter(Boolean).join(";");

    const external = promo.external
        ? ` target="_blank" rel="nofollow sponsored noopener"`
        : "";

    return `
        <div class="promo-card"${style ? ` style="${escapeHtml(style)}"` : ""}>
            <div class="promo-tag" aria-hidden="true">${escapeHtml(promo.tag)}${promo.tagSmall ? `<small>${escapeHtml(promo.tagSmall)}</small>` : ""}</div>
            <div class="promo-text">
                ${promo.kicker ? `<p class="promo-kicker">${escapeHtml(promo.kicker)}</p>` : ""}
                <h2 class="promo-title">${escapeHtml(promo.title)}</h2>
                ${promo.text ? `<p class="promo-sub">${escapeHtml(promo.text)}</p>` : ""}
            </div>
            <a class="promo-btn" href="${escapeHtml(promo.link)}"${external} data-track="promo" data-promo="${escapeHtml(promo.id || "")}">${escapeHtml(promo.button || "Vezi oferta")}</a>
        </div>
    `;

}

async function loadPromos(){

    try {

        const response = await fetch("promo.json?v=" + Date.now(), { cache: "no-store" });
        const all = await response.json();

        const mount = document.querySelector(".promo-mount");
        const isHome = !!mount;
        const now = Date.now();

        const active = all.filter(p =>
            p.title && p.link &&
            (p.pages === "all" || (p.pages === "home" && isHome)) &&
            isPromoActive(p, now)
        );

        if (!active.length) {
            if (mount) {
                const section = mount.closest(".promo-strip");
                if (section) section.hidden = true;
            }
            return;
        }

        const html = active.map(createPromoCard).join("");

        if (mount) {
            mount.innerHTML = html;
            return;
        }

        // pagini fara loc rezervat: sectiune noua imediat sub header
        const header = document.querySelector("header");
        if (!header) return;

        const section = document.createElement("section");
        section.className = "promo-strip promo-strip-auto";
        section.setAttribute("aria-label", "Reduceri active");
        section.innerHTML = `<div class="container">${html}</div>`;
        header.insertAdjacentElement("afterend", section);

    } catch (error) {

        console.error("Eroare încărcare promo.json:", error);

    }

}

/* ========================================
   PAGINA GENERICA DE SUBCATEGORIE
   — folosita de paginile separate (manuale-scolare.html,
   carti-copii.html, etc). Fiecare pagina indica propriul
   fisier JSON prin atributul data-json-file de pe
   #catalogContainer; restul e identic pe toate paginile.
   Nu are butoane de filtrare pe categorie — fiecare pagina
   reprezinta deja o singura subcategorie.
======================================== */

const GENERIC_CATALOG_PAGE_SIZE = 12;

let genericCatalogAll = [];
let genericCatalogFiltered = [];
let genericCatalogPage = 1;
let genericCountdownIntervals = [];

function createGenericProductCard(item){

    return `
        <div class="book-card">
            <img
                src="${escapeHtml(item.image)}"
                alt="${escapeHtml(item.title)}"
                loading="lazy"
                decoding="async"
            >
            <div class="book-content">
                <h3 class="book-title">${escapeHtml(item.title)}</h3>
                ${item.brand ? `<p class="book-author">${escapeHtml(item.brand)}</p>` : ""}
                ${item.genre || item.vinyl ? `<p class="product-tags">${item.genre ? `<span class="product-tag">${escapeHtml(item.genre)}</span>` : ""}${item.vinyl ? `<span class="product-tag is-vinyl">Vinil</span>` : ""}</p>` : ""}
                <div class="price-box">
                    ${item.oldPrice ? `<span class="old-price">${escapeHtml(item.oldPrice)}</span>` : ""}
                    <span class="new-price">${escapeHtml(item.price)}</span>
                    ${item.discount ? `<span class="discount">-${escapeHtml(item.discount)}</span>` : ""}
                </div>
                <a
                    href="${escapeHtml(item.affiliate)}"
                    target="_blank"
                    rel="noopener sponsored"
                    class="buy-btn"
                    data-track="rechizita"
                    data-title="${escapeHtml(item.title)}"
                    data-brand="${escapeHtml(item.brand || item.sourceSite)}"
                    data-source="${escapeHtml(item.sourceSite)}"
                >
                    Cumpără
                </a>
            </div>
        </div>
    `;

}

function renderGenericCatalogPage(){

    const container = document.getElementById("catalogContainer");

    if (!container) return;

    const totalPages =
        Math.max(1, Math.ceil(genericCatalogFiltered.length / GENERIC_CATALOG_PAGE_SIZE));

    if (genericCatalogPage > totalPages) genericCatalogPage = totalPages;

    const start = (genericCatalogPage - 1) * GENERIC_CATALOG_PAGE_SIZE;
    const pageItems = genericCatalogFiltered.slice(start, start + GENERIC_CATALOG_PAGE_SIZE);

    container.innerHTML =
        pageItems.length
        ? pageItems.map(item => createGenericProductCard(item)).join("")
        : `<p class="load-error">Niciun produs găsit.</p>`;

    renderGenericPagination(totalPages);

    stopGenericCountdowns();
    startGenericCountdowns(pageItems);

}

function renderGenericPagination(totalPages){

    const container = document.getElementById("catalogPagination");

    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    // pentru cataloage mari (sute de pagini), afisam un numar limitat
    // de butoane in jurul paginii curente, nu toate deodata
    const WINDOW = 2;
    let html = `<button type="button" class="page-btn" data-generic-page="${genericCatalogPage - 1}" ${genericCatalogPage === 1 ? "disabled" : ""}>&laquo; Anterior</button>`;

    const start = Math.max(1, genericCatalogPage - WINDOW);
    const end = Math.min(totalPages, genericCatalogPage + WINDOW);

    if (start > 1) {
        html += `<button type="button" class="page-btn" data-generic-page="1">1</button>`;
        if (start > 2) html += `<span class="pagination-ellipsis">…</span>`;
    }

    for (let i = start; i <= end; i++) {
        html += `<button type="button" class="page-btn ${i === genericCatalogPage ? "active" : ""}" data-generic-page="${i}">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="pagination-ellipsis">…</span>`;
        html += `<button type="button" class="page-btn" data-generic-page="${totalPages}">${totalPages}</button>`;
    }

    html += `<button type="button" class="page-btn" data-generic-page="${genericCatalogPage + 1}" ${genericCatalogPage === totalPages ? "disabled" : ""}>Următor &raquo;</button>`;

    container.innerHTML = html;

}

function initializeGenericPaginationDelegation(){

    document.addEventListener("click", function(e){

        const btn = e.target.closest(".page-btn[data-generic-page]");

        if (!btn || btn.disabled) return;

        const page = parseInt(btn.dataset.genericPage, 10);

        if (!page || page < 1) return;

        genericCatalogPage = page;
        renderGenericCatalogPage();

        const container = document.getElementById("catalogContainer");
        if (container) container.scrollIntoView({ behavior: "smooth", block: "start" });

    });

}

// Starea filtrelor de pe paginile de subcategorie: cautare + (optional)
// filtru pe un camp (ex. genre la muzica-film.html) + (optional) „Doar vinil".
// Filtrele apar doar daca #catalogContainer are data-filter-field.
const genericFilterState = { search: "", value: "all", vinyl: false };

function applyGenericFilters(){

    const container = document.getElementById("catalogContainer");
    const field = container ? container.dataset.filterField : "";
    const q = genericFilterState.search;

    genericCatalogFiltered = genericCatalogAll.filter(item =>
        (!q ||
            (item.title || "").toLowerCase().includes(q) ||
            (item.brand || "").toLowerCase().includes(q)) &&
        (!field || genericFilterState.value === "all" || item[field] === genericFilterState.value) &&
        (!genericFilterState.vinyl || item.vinyl === true)
    );

    genericCatalogPage = 1;
    renderGenericCatalogPage();

}

function initializeGenericCatalogSearch(){

    const input = document.getElementById("catalogSearchInput");

    if (!input) return;

    input.addEventListener("keyup", function(){

        genericFilterState.search = this.value.toLowerCase();
        applyGenericFilters();

    });

}

// Butoanele de filtrare se construiesc din date (genurile existente, cu numarul
// de produse), deci apar automat genuri noi venite din feed. Selectia ramane in
// adresa paginii (?gen=Rock&vinil=1), ca sa poata fi trimisa ca link.
function initializeGenericFilters(){

    const container = document.getElementById("catalogContainer");
    const box = document.getElementById("catalogFilters");
    const field = container ? container.dataset.filterField : "";

    if (!box || !field) return;

    const counts = {};
    genericCatalogAll.forEach(item => {
        if (item[field]) counts[item[field]] = (counts[item[field]] || 0) + 1;
    });

    const last = ["Altele", "Filme"]; // la final, dupa genurile muzicale
    const values = Object.keys(counts).sort((a, b) =>
        (last.indexOf(a) - last.indexOf(b)) || (counts[b] - counts[a])
    );
    const nVinyl = genericCatalogAll.filter(i => i.vinyl === true).length;
    const fmt = n => n.toLocaleString("ro-RO");

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("gen");
    if (fromUrl && counts[fromUrl]) genericFilterState.value = fromUrl;
    genericFilterState.vinyl = params.get("vinil") === "1" && nVinyl > 0;

    let html = `<button type="button" data-filter-value="all">Toate <small>${fmt(genericCatalogAll.length)}</small></button>`;
    values.forEach(v => {
        html += `<button type="button" data-filter-value="${escapeHtml(v)}">${escapeHtml(v)} <small>${fmt(counts[v])}</small></button>`;
    });
    if (nVinyl) {
        html += `<button type="button" class="filter-toggle" data-filter-vinyl="1" aria-pressed="false">Doar vinil <small>${fmt(nVinyl)}</small></button>`;
    }
    box.innerHTML = html;

    const syncButtons = () => {
        box.querySelectorAll("[data-filter-value]").forEach(b =>
            b.classList.toggle("active", b.dataset.filterValue === genericFilterState.value)
        );
        const t = box.querySelector("[data-filter-vinyl]");
        if (t) {
            t.classList.toggle("active", genericFilterState.vinyl);
            t.setAttribute("aria-pressed", String(genericFilterState.vinyl));
        }
        const p = new URLSearchParams(window.location.search);
        genericFilterState.value === "all" ? p.delete("gen") : p.set("gen", genericFilterState.value);
        genericFilterState.vinyl ? p.set("vinil", "1") : p.delete("vinil");
        const qs = p.toString();
        history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
    };

    box.addEventListener("click", e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.filterVinyl) genericFilterState.vinyl = !genericFilterState.vinyl;
        else genericFilterState.value = b.dataset.filterValue;
        syncButtons();
        applyGenericFilters();
        trackEvent("filtru_catalog", { valoare: genericFilterState.value, vinil: genericFilterState.vinyl });
    });

    syncButtons();

}

function stopGenericCountdowns(){

    genericCountdownIntervals.forEach(id => clearInterval(id));
    genericCountdownIntervals = [];

}

function startGenericCountdowns(visibleItems){

    visibleItems.forEach(item => {

        if (!item.offerEnds) return;

        const element = document.getElementById(`countdown-generic-${slugifyForId(item.title)}`);

        if (!element) return;

        const interval = setInterval(() => {

            const now = new Date().getTime();
            const endDate = new Date(item.offerEnds).getTime();
            const distance = endDate - now;

            if (distance <= 0) {
                clearInterval(interval);
                const card = element.closest(".book-card");
                if (card) card.remove();
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            element.innerHTML =
                String(days).padStart(2, '0') + ' : ' +
                String(hours).padStart(2, '0') + ' : ' +
                String(minutes).padStart(2, '0') + ' : ' +
                String(seconds).padStart(2, '0');

        }, 1000);

        genericCountdownIntervals.push(interval);

    });

}

async function initGenericCatalogPage(){

    const container = document.getElementById("catalogContainer");

    if (!container) return;

    // Unele cataloage (ex. carti-copii, prea mare pentru limita de
    // 25MB per fisier de pe GitHub) sunt impartite in mai multe
    // fisiere JSON, listate separat prin virgula in data-json-files.
    // Restul paginilor folosesc in continuare un singur fisier, prin
    // data-json-file (fara "s") — neschimbat, compatibil cu ce era.
    const multiFiles = container.dataset.jsonFiles;
    const singleFile = container.dataset.jsonFile;

    const files =
        multiFiles
            ? multiFiles.split(",").map(f => f.trim()).filter(Boolean)
            : (singleFile ? [singleFile] : []);

    if (!files.length) return;

    try {

        const responses = await Promise.all(
            files.map(file =>
                fetch(file + "?v=" + Date.now(), { cache: "no-store" })
                    .then(r => r.json())
            )
        );

        genericCatalogAll = responses.flat();
        genericCatalogFiltered = genericCatalogAll;

        initializeGenericFilters();
        applyGenericFilters();
        initializeGenericCatalogSearch();
        initializeGenericPaginationDelegation();

    } catch (error) {

        console.error("Eroare încărcare catalog:", error);
        container.innerHTML = `<p class="load-error">Catalogul nu a putut fi încărcat momentan.</p>`;

    }

}
