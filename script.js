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

        await loadMonthlyBook();

        await loadBooks();

        await loadBanner();

        initializeSearch();

        initializeTrackingDelegation();

        initializeCookieBanner();

        initializePaginationDelegation();

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

async function loadBanner(){

    const container = document.getElementById("bannerSlot");

    if (!container) return;

    try {

        const response = await fetch(
            "banners.json?v=" + Date.now(),
            { cache: "no-store" }
        );

        const allBanners = await response.json();

        const today = new Date().toISOString().slice(0, 10);

        const siteBanners = allBanners.filter(b =>
            Array.isArray(b.channels) &&
            b.channels.includes("site") &&
            isBannerActive(b, today)
        );

        if (!siteBanners.length) return;

        const index = hashSeed(today + "-banner-site") % siteBanners.length;
        const banner = siteBanners[index];

        container.innerHTML = `
            <span class="banner-label">Publicitate</span>
            <a
                href="${escapeHtml(banner.link)}"
                target="_blank"
                rel="nofollow sponsored noopener"
                data-track="banner"
                data-merchant="${escapeHtml(banner.merchant)}"
            >
                <img src="${escapeHtml(banner.image)}" alt="${escapeHtml(banner.alt || banner.merchant)}" loading="lazy">
            </a>
        `;

    } catch (error) {

        console.error("Eroare încărcare banners.json:", error);


    }

}
