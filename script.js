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
// AFIȘARE CĂRȚI
// ========================================

function renderBooks(bookList) {

    const container =
        document.getElementById(
            "booksContainer"
        );

    if (!container)
        return;

    container.innerHTML =
        bookList
            .map(book =>
                createBookCard(book)
            )
            .join("");

    injectBooksSchema(bookList);

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

        startCountdowns();      

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

        initializeSearch();

        initializeTrackingDelegation();

    }
);

// ========================================
// NEWSLETTER
// ========================================

const newsletterForm =
document.getElementById(
"newsletterForm"
);

if(newsletterForm){

newsletterForm.addEventListener(
"submit",
async function(e){

e.preventDefault();

const formData =
new FormData(
newsletterForm
);

const response =
await fetch(
newsletterForm.action,
{
method:"POST",
body:formData
}
);

const result =
await response.json();

if(result.success){

document
.getElementById(
"successMessage"
)
.innerHTML = `

<h3>
Bine ai venit la ÎncăUnCapitol!
</h3>

<p>
Abonarea a fost înregistrată cu succes.
</p>

<p>
În curând vei primi recomandările mele de cărți și promoțiile disponibile.
</p>

`;

document
.getElementById(
"successMessage"
)
.style.display =
"block";

newsletterForm.reset();

trackEvent("newsletter_signup",{

    source:"newsletter",

    site:"carti"

});

}

}
);

}

// ========================================
// Footer cu Politica GDPR si Contact
// ========================================

function togglePrivacy(){

const box =
document.getElementById(
"privacyBox"
);

box.style.display =
box.style.display==="block"
?
"none"
:
"block";

}

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
// startCountdowns
// ========================================

function startCountdowns(){

books.forEach(book=>{

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
