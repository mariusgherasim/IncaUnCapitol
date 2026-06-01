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
                    ${monthlyBook.description}
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

                    ${book.description}

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

                    <span class="old-price">

                        ${book.oldPrice}

                    </span>

                    <span class="new-price">

                        ${book.price}

                    </span>

                    <span class="discount">

                        ${book.discount}

                    </span>

                </div>

                <a
                    href="${book.affiliate}"
                    target="_blank"
                    class="buy-btn"
                >

                    Cumpără acum

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

        renderBooks(books);
      

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