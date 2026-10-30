
"use strict";

// ==========================================
// CINEVAULT — PUBLIC CATALOGUE
// ==========================================

const SUPABASE_URL = "https://nurpfyozhtuirrkasadk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AHnmjArp9RZYcqymMp6F_A_guEVZFOn";
const WATCH_KEY = "cinevault-watchlist-v2";

const $ = id => document.getElementById(id);

let supabaseClient;
let movies = [];
let activeGenre = "All";
let showingWatchlist = false;

let watchlist;

try {
  watchlist = new Set(JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"));
} catch {
  watchlist = new Set();
}

// ==========================================
// HELPERS
// ==========================================

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function fromRow(row) {
  return {
    id: row.id,
    title: row.title || "",
    year: row.year || "",
    genre: row.genre || "",
    rating: row.rating ?? "",
    description: row.description || "",
    poster: row.poster_url || ""
  };
}

function saveWatchlist() {
  localStorage.setItem(WATCH_KEY, JSON.stringify([...watchlist]));
}

// ==========================================
// DATABASE
// ==========================================

async function loadMovies() {
  $("emptyState").textContent = "Loading movies...";
  $("emptyState").hidden = false;

  const { data, error } = await supabaseClient
    .from("movies")
    .select("id,title,year,genre,rating,description,poster_url")
    .order("created_at", { ascending: false });

  if (error) throw error;

  movies = (data || []).map(fromRow);

  renderMovies();
}

// ==========================================
// MOVIE POSTERS
// ==========================================

function posterMarkup(movie) {
  const url = safeUrl(movie.poster);

  if (!url) {
    return '<div class="poster-placeholder">CV</div>';
  }

  return `
    <img
      loading="lazy"
      src="${escapeHtml(url)}"
      alt="Poster for ${escapeHtml(movie.title)}"
      onerror="this.style.display='none';this.nextElementSibling.hidden=false"
    >
    <div class="poster-placeholder" hidden>CV</div>
  `;
}

// ==========================================
// GENRES AND FILTERS
// ==========================================

function renderGenres() {
  const genres = [
    "All",
    ...new Set(movies.map(movie => movie.genre).filter(Boolean).sort())
  ];

  $("genreFilters").innerHTML = genres.map(genre => `
    <button
      type="button"
      class="filter-chip ${genre === activeGenre ? "active" : ""}"
      data-genre="${escapeHtml(genre)}"
    >
      ${escapeHtml(genre)}
    </button>
  `).join("");
}

function getVisibleMovies() {
  let result = movies.filter(movie => {
    const genreMatches =
      activeGenre === "All" || movie.genre === activeGenre;

    const watchMatches =
      !showingWatchlist || watchlist.has(movie.id);

    return genreMatches && watchMatches;
  });

  const query = $("searchInput").value.trim().toLowerCase();

  if (query) {
    result = result.filter(movie => {
      const content = [
        movie.title,
        movie.genre,
        movie.description,
        movie.year
      ].join(" ").toLowerCase();

      return content.includes(query);
    });
  }

  const sort = $("sortSelect").value;

  if (sort === "title") {
    result.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "year") {
    result.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (sort === "rating") {
    result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  return result;
}

// ==========================================
// MOVIE GRID
// ==========================================

function renderMovies() {
  renderGenres();

  const visible = getVisibleMovies();

  $("collectionTitle").textContent =
    showingWatchlist ? "Your watchlist" : "Featured titles";

  $("movieGrid").innerHTML = visible.map(movie => `
    <article class="movie-card">
      <div class="poster-wrap">
        ${posterMarkup(movie)}

        ${movie.rating !== "" && movie.rating !== null
          ? `<span class="rating">★ ${escapeHtml(movie.rating)}</span>`
          : ""}
      </div>

      <div class="card-body">
        <h3 class="card-title" title="${escapeHtml(movie.title)}">
          ${escapeHtml(movie.title)}
        </h3>

        <p class="card-meta">
          ${escapeHtml(movie.year || "Year n/a")} ·
          ${escapeHtml(movie.genre || "Uncategorised")}
        </p>

        <div class="card-actions">
          <button
            class="details-button"
            type="button"
            data-details="${escapeHtml(movie.id)}"
          >Details</button>
        </div>
      </div>
    </article>
  `).join("");

  $("emptyState").hidden = visible.length > 0;

  if (!visible.length) {
    $("emptyState").textContent = movies.length
      ? "No titles found. Try another search or genre."
      : "No movies have been added yet.";
  }

  $("watchlistCount").textContent = watchlist.size;
}

// ==========================================
// WATCHLIST
// ==========================================

function toggleWatchlist(id) {
  if (watchlist.has(id)) {
    watchlist.delete(id);
  } else {
    watchlist.add(id);
  }

  saveWatchlist();
  renderMovies();

  if (!$("detailModal").hidden) {
    showDetails(id);
  }
}

// ==========================================
// MOVIE DETAILS
// ==========================================

function showDetails(id) {
  const movie = movies.find(item => String(item.id) === String(id));
  if (!movie) return;

  $("detailPoster").src = safeUrl(movie.poster) || "";
  $("detailPoster").alt = "Poster for " + movie.title;

  $("detailMeta").textContent = [
    movie.year,
    movie.genre,
    movie.rating !== "" ? "★ " + movie.rating : ""
  ].filter(Boolean).join(" · ");

  $("detailTitle").textContent = movie.title;

  $("detailDescription").textContent =
    movie.description || "No description provided.";

  $("detailActions").innerHTML = `
    <button
      type="button"
      class="outline-button"
      id="detailWatchlist"
    >
      ${watchlist.has(movie.id) ? "♥ In watchlist" : "♡ Add to watchlist"}
    </button>
  `;

  $("detailWatchlist").addEventListener("click", () => {
    toggleWatchlist(movie.id);
  });

  $("detailModal").hidden = false;
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEvents() {
  $("searchInput").addEventListener("input", renderMovies);

  $("sortSelect").addEventListener("change", renderMovies);

  $("genreFilters").addEventListener("click", event => {
    const button = event.target.closest("[data-genre]");
    if (!button) return;

    activeGenre = button.dataset.genre;
    renderMovies();
  });

  $("movieGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-details]");
    if (button) showDetails(button.dataset.details);
  });

  $("watchlistToggle").addEventListener("click", () => {
    showingWatchlist = !showingWatchlist;

    $("watchlistToggle").innerHTML = `
      ${showingWatchlist ? "▣ All titles" : "♡ Watchlist"}
      <span id="watchlistCount">${watchlist.size}</span>
    `;

    renderMovies();
  });

  document.querySelectorAll("[data-close-modal]").forEach(element => {
    element.addEventListener("click", () => {
      $("detailModal").hidden = true;
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $("detailModal").hidden = true;
    }
  });
}

// ==========================================
// START APPLICATION
// ==========================================

async function startApp() {
  try {
    if (!window.supabase) {
      throw new Error(
        "Supabase library did not load. Check your internet connection."
      );
    }

    const requiredIds = [
      "searchInput",
      "sortSelect",
      "genreFilters",
      "movieGrid",
      "emptyState",
      "collectionTitle",
      "watchlistToggle",
      "watchlistCount",
      "detailModal",
      "detailPoster",
      "detailMeta",
      "detailTitle",
      "detailDescription",
      "detailActions",
      "yearNow"
    ];

    const missing = requiredIds.filter(id => !$(id));

    if (missing.length) {
      throw new Error("Missing HTML elements: " + missing.join(", "));
    }

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    setupEvents();

    $("yearNow").textContent = new Date().getFullYear();

    await loadMovies();

    console.log("CineVault public catalogue started successfully.");

  } catch (error) {
    console.error("CineVault error:", error);

    const empty = $("emptyState");

    if (empty) {
      empty.hidden = false;
      empty.textContent = "Could not load CineVault: " + error.message;
    }
  }
}

startApp();

