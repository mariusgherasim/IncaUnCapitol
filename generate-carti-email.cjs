#!/usr/bin/env node
// generate-carti-email.cjs
//
// Genereaza continutul (subiect + HTML) pentru o campanie MailerLite
// cu ofertele de carti ale zilei. Ruleaza LOCAL, in ziua trimiterii —
// rotatia pe categorie/pagina se calculeaza din data curenta, deci un
// fisier generat ieri nu mai reflecta corect rotatia de azi.
//
// Model: GHID-Email-Marketing-Newsletter.md (implementare validata pe
// shop.gherasimmarius.com), adaptat la structura books.json.
//
// Rulare:
//   node generate-carti-email.cjs
//
// Rezultat: fisier local "email-carti-AAAA-LL-ZZ.html" cu subiectul
// separat sus, si codul HTML de copiat in MailerLite (Custom HTML) sub
// o linie de separator.

const fs = require("fs");
const path = require("path");

// ========================================
// CONFIG
// ========================================

const MAX_PER_EMAIL = 8;
const COLUMNS = 2;

const SITE_URL = "https://carti.gherasimmarius.com";
const CATALOG_URL = SITE_URL + "/"; // "Vezi toate ofertele" -> catalogul complet de pe site

// TODO: inlocuieste cu link-ul real al formularului MailerLite dedicat
// grupului CROSS_BRAND_OPTIN, o data ce e creat (vezi nota din raspuns).
const CROSS_BRAND_SUBSCRIBE_URL = "https://dashboard.mailerlite.com/forms/PLACEHOLDER";

const CATEGORII_LABEL = {
    financiar: "educație financiară",
    dezvoltare: "dezvoltare personală",
    business: "antreprenoriat",
    leadership: "leadership",
    jurnale: "memorii și jurnale",
    "beletristică": "beletristică"
};

const CATEGORII = Object.keys(CATEGORII_LABEL);

// ========================================
// HELPERE
// ========================================

function hashSeed(str) {

    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }

    return Math.abs(hash);

}

function escapeHtml(value) {

    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

}

// Normalizeaza formatul de pret: unele surse (actsipoliton) nu includ
// "Lei" in valoare, altele (edituratrei, curteaveche) da.
function normalizePrice(value) {

    if (!value) return "";

    const trimmed = String(value).trim();

    return /lei\s*$/i.test(trimmed) ? trimmed : trimmed + " Lei";

}

// Normalizeaza reducerea: edituratrei stocheaza uneori "-30%", alteori
// alte surse stocheaza "30%" fara semn — evitam sa afisam "--30%".
function normalizeDiscountLabel(value) {

    if (!value) return "";

    const digits = String(value).match(/\d+/);

    return digits ? "-" + digits[0] + "%" : "";

}

function getDiscountPercent(book) {

    const digits = String(book.discount || "").match(/\d+/);

    return digits ? parseInt(digits[0], 10) : 0;

}

function resolveImageUrl(imagePath) {

    if (!imagePath) return "";

    if (/^https?:\/\//i.test(imagePath)) return imagePath;

    return SITE_URL + "/" + imagePath.replace(/^\/+/, "");

}

function loadBooks() {

    const raw = fs.readFileSync(
        path.join(__dirname, "books.json"),
        "utf8"
    );

    return JSON.parse(raw);

}

// ========================================
// SELECTIE: categorie + pagina, rotite pe zi
// ========================================

function selectTodaysBooks(allBooks, todayStr) {

    const withOffers = allBooks.filter(book =>
        book.oldPrice && book.category
    );

    const categoriiActive = CATEGORII.filter(cat =>
        withOffers.some(book => book.category === cat)
    );

    if (!categoriiActive.length) {
        return null;
    }

    const categoryIndex =
        hashSeed(todayStr + "-categorie") % categoriiActive.length;

    const category = categoriiActive[categoryIndex];

    const booksInCategory =
        withOffers.filter(book => book.category === category);

    const totalPages =
        Math.max(1, Math.ceil(booksInCategory.length / MAX_PER_EMAIL));

    const pageIndex =
        hashSeed(todayStr + "-pagina") % totalPages;

    const start = pageIndex * MAX_PER_EMAIL;

    return {
        category,
        pageBooks: booksInCategory.slice(start, start + MAX_PER_EMAIL),
        pageNumber: pageIndex + 1,
        totalPages
    };

}

// ========================================
// SUBIECT (hook cu cifre concrete)
// ========================================

// Unele carti sunt de fapt pachete ("Pachet 10 cărți de leadership"),
// cu mai multi autori inghesuiti intr-un singur string, separati prin
// virgula. Pentru hook, folosim doar primul nume + "și alții" in acel caz.
function shortAuthor(book) {

    const author = String(book.author || "").trim();

    if (author.includes(",")) {
        return author.split(",")[0].trim() + " și alții";
    }

    return author;

}

function buildSubject(selection) {

    const { pageBooks, category } = selection;

    const autori = [...new Set(pageBooks.map(shortAuthor))].slice(0, 2);
    const maxDiscount = Math.max(...pageBooks.map(getDiscountPercent));
    const nr = pageBooks.length;
    const categoriaLabel = CATEGORII_LABEL[category] || category;

    const separator =
        autori.some(a => a.includes("și alții")) ? ", " : " și ";

    const autoriText =
        autori.length === 2
            ? autori.join(separator)
            : autori[0] || "";

    return `${nr} cărți de ${categoriaLabel} reduse azi cu până la ${maxDiscount}% — printre ele ${autoriText}`;

}

// ========================================
// HTML — layout pe tabel (compatibil email)
// ========================================

function buildProductCell(book) {

    const price = normalizePrice(book.price);
    const oldPrice = normalizePrice(book.oldPrice);
    const discount = normalizeDiscountLabel(book.discount);
    const imageUrl = resolveImageUrl(book.image);

    return `
<td width="50%" valign="top" style="padding:8px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">
    <tr>
      <td align="center" style="padding:16px 16px 0;">
        <a href="${escapeHtml(book.affiliate)}" target="_blank" style="text-decoration:none;">
          <img src="${escapeHtml(imageUrl)}" width="130" alt="${escapeHtml(book.title)}" style="display:block;margin:0 auto;max-height:190px;object-fit:contain;">
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 16px 18px;font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:4px;line-height:1.3;">${escapeHtml(book.title)}</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:10px;">${escapeHtml(book.author)}</div>
        <div style="margin-bottom:12px;">
          ${oldPrice ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:13px;margin-right:6px;">${escapeHtml(oldPrice)}</span>` : ""}
          <span style="font-size:17px;font-weight:700;color:#111827;">${escapeHtml(price)}</span>
          ${discount ? `<span style="background:#dc2626;color:#ffffff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;margin-left:6px;">${escapeHtml(discount)}</span>` : ""}
        </div>
        <a href="${escapeHtml(book.affiliate)}" target="_blank" style="display:block;text-align:center;background:#f59e0b;color:#000000;font-weight:700;padding:11px;border-radius:8px;text-decoration:none;font-size:14px;">Cumpără</a>
      </td>
    </tr>
  </table>
</td>`;

}

function buildProductRows(pageBooks) {

    const rows = [];

    for (let i = 0; i < pageBooks.length; i += COLUMNS) {

        const chunk = pageBooks.slice(i, i + COLUMNS);

        while (chunk.length < COLUMNS) {
            chunk.push(null); // umplutura, ca sa nu se intinda ultimul card
        }

        const cellsHtml = chunk
            .map(book =>
                book
                    ? buildProductCell(book)
                    : `<td width="${Math.floor(100 / COLUMNS)}%">&nbsp;</td>`
            )
            .join("");

        rows.push(`<tr>${cellsHtml}</tr>`);

    }

    return rows.join("\n");

}

function buildHtml(selection) {

    const { pageBooks, category } = selection;

    const categoriaLabel = CATEGORII_LABEL[category] || category;
    const maxDiscount = Math.max(...pageBooks.map(getDiscountPercent));

    const hookLine =
        `${pageBooks.length} cărți de ${categoriaLabel}, reduse azi cu până la ${maxDiscount}%`;

    const productRowsHtml = buildProductRows(pageBooks);

    return `<!-- Generat automat de generate-carti-email.cjs — nu edita direct in MailerLite fara sa regenerezi -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;font-family:Arial,Helvetica,sans-serif;">

<tr>
<td colspan="${COLUMNS}" style="background:#111827;padding:22px 24px;text-align:center;">
<span style="color:#ffffff;font-size:22px;font-weight:700;">Încă<span style="color:#f59e0b;">UnCapitol</span></span>
</td>
</tr>

<tr>
<td colspan="${COLUMNS}" style="padding:26px 24px 10px;">
<p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px;">${escapeHtml(hookLine)}</p>
<p style="font-size:14px;color:#6b7280;margin:0;">Prețuri actualizate azi, direct de la comercianți.</p>
</td>
</tr>

${productRowsHtml}

<tr>
<td colspan="${COLUMNS}" align="center" style="padding:22px 24px 26px;">
<a href="${CATALOG_URL}" style="font-size:14px;font-weight:700;color:#f59e0b;text-decoration:none;">Vezi toate ofertele &rarr;</a>
</td>
</tr>

<tr>
<td colspan="${COLUMNS}" style="background:#111827;padding:26px 24px;text-align:center;">
<p style="color:rgba(255,255,255,.85);font-size:13px;margin:0 0 14px;line-height:1.5;">
Vrei să primești și noutăți din alte proiecte Marius Gherasim (asigurări, health &amp; beauty)?<br>
<a href="${CROSS_BRAND_SUBSCRIBE_URL}" style="color:#f59e0b;text-decoration:underline;">Abonează-te aici &rarr;</a>
</p>
<p style="color:rgba(255,255,255,.5);font-size:12px;margin:0;line-height:1.6;">
ÎncăUnCapitol &middot; office@gherasimmarius.com<br>
{$unsubscribe}
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>`;

}

// ========================================
// MAIN
// ========================================

function main() {

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // "2026-07-22"

    const books = loadBooks();
    const selection = selectTodaysBooks(books, todayStr);

    if (!selection) {

        console.log("Nicio carte cu ofertă reală (oldPrice) găsită azi — nu generez email.");
        return;

    }

    const subject = buildSubject(selection);
    const html = buildHtml(selection);

    const outputPath = path.join(__dirname, `email-carti-${todayStr}.html`);

    fs.writeFileSync(
        outputPath,
        `SUBIECT:\n${subject}\n\n${"=".repeat(60)}\n(copiază codul HTML de mai jos în MailerLite, editorul Custom HTML)\n${"=".repeat(60)}\n\n${html}`
    );

    console.log("Categorie aleasă azi:", selection.category);
    console.log("Pagina:", selection.pageNumber, "din", selection.totalPages);
    console.log("Cărți incluse:", selection.pageBooks.length);
    console.log("Subiect:", subject);
    console.log("Fișier generat:", outputPath);

}

main();
