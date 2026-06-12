// ========================================
// VARIABILE GLOBALE
// ========================================

let books = [];

let monthlyBook = {};

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
                    src="${monthlyBook.image}"
                    alt="${monthlyBook.title}"
                >

            </div>

            <div class="monthly-book-content">

                <span class="badge">
                    Recomandarea mea
                </span>

                <h3 class="book-title">
                    ${monthlyBook.title}
                </h3>

                <p class="book-author">
                    ${monthlyBook.author}
                </p>

                <div class="book-score">
                    Scor ÎncăUnCapitol:
                    ${monthlyBook.score}
                </div>

                <p>

                <em>
                    ${monthlyBook.description}

                </em>

                </p>

                <br>

                <a
                    href="${monthlyBook.affiliate}"
                    target="_blank"
                    class="cta-btn"
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
                src="${book.image}"
                alt="${book.title}"
            >

            <div class="book-content">

                 <h3 class="book-title">

                    ${book.title}

                </h3>

                <p class="book-author">

                    ${book.author}

                </p>

                <div class="book-score">

                    Scor ÎncăUnCapitol:
                    ${book.score}

                </div>

                ${
                    book.publisher
                    ?
                    `
                    <p>
                    <strong>Editura:</strong>
                    ${book.publisher}
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
                    ${book.pages}
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
                    ${book.format}
                    </p>
                    `
                    :
                    ""
                }

                <p class="book-description">

                <em>

                    ${book.description}

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

                        ${book.why}

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
                            ${book.oldPrice}
                        </span>
                        `
                        :
                        ""
                    }

                    <span class="new-price">
                        ${book.price}
                    </span>

                    ${
                        book.discount
                        ?
                        `
                        <span class="discount">
                            ${book.discount}
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
                    id="countdown-${book.title.replaceAll(' ','-')}"
                    >

                    00 : 00 : 00 : 00

                    </div>

                    </div>
                    `
                    :
                    ""
                }

                <a
                    href="${book.affiliate}"
                    target="_blank"
                    class="buy-btn"
                    onclick="trackBookClick('${book.title}','${book.author}','${book.category}')"
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

        const response =
            await fetch(
                "books.json"
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

    }

}

// ========================================
// ÎNCĂRCARE MONTHLY-BOOK.JSON
// ========================================

async function loadMonthlyBook() {

    try {

        const response =
            await fetch(
                "monthly-book.json"
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
`countdown-${book.title.replaceAll(' ','-')}`
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

window.trackBookClick = function(bookTitle, author, category){

    if(typeof gtag === "function"){

        gtag("event","click_cumpara",{
            book_title: bookTitle,
            author: author,
            category: category,
            value: 1
        });

        console.log(
            "Click înregistrat:",
            bookTitle
        );

    }

};