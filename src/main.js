// 1. Grab your API Key from Vite's environment variables
const API_KEY = import.meta.env.VITE_BOOKS_API_KEY;
console.log("Your API Key is currently:", API_KEY);

const API_BASE = "https://www.googleapis.com/books/v1/volumes";

// State
let currentBook = null;

// Wrap in DOMContentLoaded to ensure elements exist before script runs
document.addEventListener("DOMContentLoaded", () => {
  // Fetch HTML elements
  const coverEl = document.getElementById("cover");
  const titleEl = document.getElementById("title");
  const authorEl = document.getElementById("author");
  const descEl = document.getElementById("description");
  const readLink = document.getElementById("readLink");
  const saveBtn = document.getElementById("saveBtn");
  const nextBtn = document.getElementById("nextBtn");
  const listContainer = document.getElementById("listContainer");

  // Safety check for critical elements
  if (!nextBtn || !saveBtn || !listContainer) {
    console.error(
      "Missing critical HTML elements. Double-check your HTML IDs!",
    );
    return;
  }

  async function fetchRandomBook() {
    const subjects = [
      "fiction",
      "classics",
      "fantasy",
      "mystery",
      "romance",
      "science fiction",
      "adventure",
      "historical",
      "thriller",
      "young adult",
      "poetry",
      "biography",
    ];

    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const startIndex = Math.floor(Math.random() * 20); // Keep it lower to avoid empty responses

    // Append your API key to the end of the URL string
    let url = `${API_BASE}?q=subject:${encodeURIComponent(subject)}&maxResults=10&startIndex=${startIndex}&orderBy=relevance`;
    if (API_KEY) url += `&key=${API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error (${res.status})`);
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      // Fallback URL with API key appended
      let fallbackUrl = `${API_BASE}?q=book&maxResults=10&startIndex=${Math.floor(Math.random() * 20)}`;
      if (API_KEY) fallbackUrl += `&key=${API_KEY}`;

      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) throw new Error("No books found");
      const fallbackData = await fallbackRes.json();
      if (!fallbackData.items || fallbackData.items.length === 0)
        throw new Error("No books found");
      return pickRandomItem(fallbackData.items);
    }

    return pickRandomItem(data.items);
  }

  function generateUUID() {
    // Safe fallback check if crypto.randomUUID isn't supported in localhost/unsecure testing
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
  }

  function pickRandomItem(items) {
    const raw = items[Math.floor(Math.random() * items.length)];
    const info = raw.volumeInfo || {};
    return {
      id: raw.id || generateUUID(),
      title: info.title || "Untitled",
      authors: info.authors ? info.authors.join(", ") : "Unknown author",
      description: info.description || "No description available.",
      cover:
        info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "",
      previewLink:
        info.previewLink || `https://books.google.com/books?id=${raw.id}`,
      raw,
    };
  }

  function renderBook(book) {
    currentBook = book;
    if (coverEl) {
      coverEl.src =
        book.cover ||
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"%3E%3Crect width="200" height="300" fill="%23e8ddd0"/%3E%3Ctext x="100" y="150" font-family="Inter, sans-serif" font-size="16" fill="%237a5f44" text-anchor="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';
      coverEl.alt = `Cover of ${book.title}`;
    }
    if (titleEl) titleEl.textContent = book.title;
    if (authorEl) authorEl.textContent = `by ${book.authors}`;
    if (descEl) {
      const desc = book.description;
      descEl.textContent = desc.length > 400 ? desc.slice(0, 400) + "…" : desc;
    }
    if (readLink) readLink.href = book.previewLink;
  }

  function getSavedList() {
    try {
      return JSON.parse(localStorage.getItem("readingList")) || [];
    } catch {
      return [];
    }
  }

  function saveToList(book) {
    const list = getSavedList();
    if (list.some((item) => item.id === book.id)) {
      alert("Already saved!");
      return;
    }
    list.push({ id: book.id, title: book.title, authors: book.authors });
    localStorage.setItem("readingList", JSON.stringify(list));
    renderSavedList();
  }

  function removeFromList(id) {
    let list = getSavedList();
    list = list.filter((item) => item.id !== id);
    localStorage.setItem("readingList", JSON.stringify(list));
    renderSavedList();
  }

  function renderSavedList() {
    const list = getSavedList();
    if (list.length === 0) {
      listContainer.innerHTML =
        '<li class="empty-message">✨ Your list is empty. Save a book!</li>';
      return;
    }
    listContainer.innerHTML = list
      .map(
        (item) => `
      <li>
        ${item.title} <span style="color:#7a5f44;font-size:0.8rem;">(${item.authors})</span>
        <button class="remove-btn" data-id="${item.id}" aria-label="Remove">✕</button>
      </li>
    `,
      )
      .join("");

    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeFromList(btn.dataset.id));
    });
  }

  async function loadNewBook() {
    // 1. If the button doesn't exist for some reason, bail out
    if (!nextBtn) return;

    try {
      // 2. Disable the button immediately so they can't click it again yet
      nextBtn.disabled = true;
      nextBtn.style.opacity = "0.5"; // Optional: make it look unclickable
      nextBtn.textContent = "Loading...";

      const cached = getCachedBook();
      if (cached) {
        renderBook(cached);
        return;
      }

      if (titleEl) titleEl.textContent = "Loading…";
      if (descEl) descEl.textContent = "Searching for your next read…";

      const book = await fetchRandomBook();
      renderBook(book);
      cacheBook(book);
    } catch (err) {
      if (titleEl) titleEl.textContent = "Oops!";
      if (descEl)
        descEl.textContent = `Couldn't fetch a book: ${err.message}. Try again.`;
      console.error(err);
    } finally {
      // 3. The FINALLY block ALWAYS runs, whether the try succeeds or the catch fails.
      // Re-enable the button here so they can click it for the next book.
      nextBtn.disabled = false;
      nextBtn.style.opacity = "1";
      nextBtn.textContent = "Next Book";
    }
  }

  function loadFreshBook() {
    localStorage.removeItem("cachedBook");
    loadNewBook();
  }

  function getCachedBook() {
    try {
      const cached = JSON.parse(localStorage.getItem("cachedBook"));
      if (cached && Date.now() - cached.timestamp < 3600000) {
        return cached.book;
      }
      return null;
    } catch {
      return null;
    }
  }

  function cacheBook(book) {
    localStorage.setItem(
      "cachedBook",
      JSON.stringify({
        book: book,
        timestamp: Date.now(),
      }),
    );
  }

  // Event listeners
  nextBtn.addEventListener("click", loadFreshBook);
  saveBtn.addEventListener("click", () => {
    if (currentBook) saveToList(currentBook);
  });

  // Init
  loadNewBook();
  renderSavedList();
});
