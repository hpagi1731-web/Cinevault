
"use strict";

// ==========================================
// CINEVAULT — SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = "https://nurpfyozhtuirrkasadk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AHnmjArp9RZYcqymMp6F_A_guEVZFOn";
const ADMIN_EMAIL = "hitsnizam@gmail.com";
const WATCH_KEY = "cinevault-watchlist-v2";

const $ = id => document.getElementById(id);

let supabaseClient;
let movies = [];
let currentUser = null;
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

function setStatus(message, isError = false) {
  $("authStatus").textContent = message;
  $("authStatus").classList.toggle("error", isError);
}

function isAdmin() {
  return Boolean(
    currentUser &&
    currentUser.email &&
    currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function fromRow(row) {
  return {
    id: row.id,
    title: row.title || "",
    year: row.year || "",
    genre: row.genre || "",
    rating: row.rating ?? "",
    description: row.description || "",
    poster: row.poster_url || "",
    downloadUrl: row.download_url || ""
  };
}

function toRow(movie) {
  return {
    title: movie.title,
    year: movie.year ? Number(movie.year) : null,
    genre: movie.genre || null,
    rating: movie.rating === "" ? null : Number(movie.rating),
    description: movie.description || null,
    poster_url: safeUrl(movie.poster) || null,
    download_url: safeUrl(movie.downloadUrl) || null
  };
}

function saveWatchlist() {
  localStorage.setItem(WATCH_KEY, JSON.stringify([...watchlist]));
}

// ==========================================
// AUTHENTICATION
// ==========================================

function updateAuthUI() {
  const authorised = isAdmin();

  $("adminEditor").hidden = !authorised;
  $("logoutButton").hidden = !currentUser;
  $("loginButton").hidden = Boolean(currentUser);

  $("adminEmail").value = currentUser?.email || ADMIN_EMAIL;
  $("adminEmail").disabled = Boolean(currentUser);
  $("adminPassword").disabled = Boolean(currentUser);

  if (authorised) {
    setStatus("Successfully signed in as CineVault administrator.");
  } else if (currentUser) {
    setStatus("This account is not authorised to manage CineVault.", true);
  } else {
    setStatus("Sign in to manage the shared catalogue.");
  }

  renderAdmin();
}

async function login(event) {
  event.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;

  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    setStatus("Please use the authorised admin email.", true);
    return;
  }

  if (!password) {
    setStatus("Please enter your password.", true);
    return;
  }

  $("loginButton").disabled = true;
  setStatus("Signing in...");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;
    $("adminPassword").value = "";
    updateAuthUI();

    if (!isAdmin()) {
      await supabaseClient.auth.signOut();
      currentUser = null;
      updateAuthUI();
    }
  } catch (error) {
    setStatus(error.message || "Login failed.", true);
  } finally {
    $("loginButton").disabled = false;
  }
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    setStatus(error.message, true);
    return;
  }

  currentUser = null;
  updateAuthUI();
}

// ==========================================
// DATABASE
// ==========================================

async function loadMovies() {
  $("emptyState").textContent = "Loading movies...";
  $("emptyState").hidden = false;

  const { data, error } = await supabaseClient
    .from("movies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  movies = (data || []).map(fromRow);
  renderMovies();
  renderAdmin();
}

// ==========================================
// MOVIE DISPLAY
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

function downloadLink(movie) {
  const url = safeUrl(movie.downloadUrl);

  if (!url) return "";

  return `
    <a
      class="download-button"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
    >↗ Get / Download</a>
  `;
}

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

          ${downloadLink(movie)}
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
// ADMIN MOVIE LIST
// ==========================================

function renderAdmin() {
  const list = $("adminList");
  if (!list) return;

  list.innerHTML = movies.map(movie => `
    <div class="admin-item">
      <img
        src="${escapeHtml(safeUrl(movie.poster) || "")}"
        alt=""
        onerror="this.style.visibility='hidden'"
      >

      <div class="admin-item-text">
        <strong>${escapeHtml(movie.title)}</strong>
        <small>
          ${escapeHtml(movie.year || "")} ·
          ${escapeHtml(movie.genre || "")}
        </small>
      </div>

      ${isAdmin() ? `
        <div class="admin-item-actions">
          <button type="button" data-edit="${escapeHtml(movie.id)}">Edit</button>
          <button type="button" data-delete="${escapeHtml(movie.id)}">Delete</button>
        </div>
      ` : ""}
    </div>
  `).join("") || "<p>No titles yet. Add your first title.</p>";
}

// ==========================================
// ADD AND EDIT MOVIES
// ==========================================

function resetForm() {
  $("movieForm").reset();
  $("editId").value = "";
  $("saveMovieButton").textContent = "Save title";
}

function editMovie(id) {
  const movie = movies.find(item => String(item.id) === String(id));
  if (!movie) return;

  $("editId").value = movie.id;
  $("movieTitle").value = movie.title;
  $("movieYear").value = movie.year || "";
  $("movieGenre").value = movie.genre || "";
  $("movieRating").value = movie.rating ?? "";
  $("moviePoster").value = movie.poster || "";
  $("movieDescription").value = movie.description || "";
  $("movieDownload").value = movie.downloadUrl || "";

  $("saveMovieButton").textContent = "Update title";
  $("adminPanel").scrollIntoView({ behavior: "smooth" });
}

async function saveMovie(event) {
  event.preventDefault();

  if (!isAdmin()) {
    alert("Please sign in with the administrator account.");
    return;
  }

  const title = $("movieTitle").value.trim();
  const poster = $("moviePoster").value.trim();
  const download = $("movieDownload").value.trim();
  const rating = $("movieRating").value;

  if (!title) {
    alert("Please enter a movie title.");
    return;
  }

  if (poster && !safeUrl(poster)) {
    alert("Please enter a valid poster URL.");
    return;
  }

  if (download && !safeUrl(download)) {
    alert("Please enter a valid download page URL.");
    return;
  }

  if (rating !== "" && (Number(rating) < 0 || Number(rating) > 10)) {
    alert("Rating must be between 0 and 10.");
    return;
  }

  const movie = {
    title,
    year: $("movieYear").value,
    genre: $("movieGenre").value.trim(),
    rating,
    poster,
    description: $("movieDescription").value.trim(),
    downloadUrl: download
  };

  const id = $("editId").value;
  const button = $("saveMovieButton");

  button.disabled = true;
  button.textContent = "Saving...";

  try {
    let result;

    if (id) {
      result = await supabaseClient
        .from("movies")
        .update(toRow(movie))
        .eq("id", id);
    } else {
      result = await supabaseClient
        .from("movies")
        .insert(toRow(movie));
    }

    if (result.error) throw result.error;

    resetForm();
    await loadMovies();

    alert("Saved successfully. The shared catalogue has been updated.");
  } catch (error) {
    alert("Could not save movie: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = $("editId").value ? "Update title" : "Save title";
  }
}

async function deleteMovie(id) {
  if (!isAdmin()) return;

  if (!confirm("Delete this movie from the shared catalogue?")) return;

  const { error } = await supabaseClient
    .from("movies")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }

  watchlist.delete(id);
  saveWatchlist();
  await loadMovies();
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
    ${downloadLink(movie)}
  `;

  $("detailWatchlist").addEventListener("click", () => {
    toggleWatchlist(movie.id);
  });

  $("detailModal").hidden = false;
}

// ==========================================
// EXPORT AND IMPORT
// ==========================================

function exportCatalogue() {
  const blob = new Blob(
    [JSON.stringify(movies, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cinevault-catalogue.json";
  link.click();

  URL.revokeObjectURL(url);
}

async function importCatalogue(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!isAdmin()) {
    alert("Please sign in as administrator first.");
    event.target.value = "";
    return;
  }

  try {
    const imported = JSON.parse(await file.text());

    if (!Array.isArray(imported)) {
      throw new Error("The JSON file must contain a movie list.");
    }

    for (const item of imported) {
      const movie = {
        title: String(item.title || "Untitled"),
        year: item.year || "",
        genre: String(item.genre || ""),
        rating: item.rating ?? "",
        poster: item.poster || item.poster_url || "",
        description: String(item.description || ""),
        downloadUrl: item.downloadUrl || item.download_url || ""
      };

      const { error } = await supabaseClient
        .from("movies")
        .insert(toRow(movie));

      if (error) throw error;
    }

    await loadMovies();
    alert("Catalogue imported successfully.");
  } catch (error) {
    alert("Import failed: " + error.message);
  }

  event.target.value = "";
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEvents() {
  $("adminToggle").addEventListener("click", () => {
    $("adminPanel").hidden = !$("adminPanel").hidden;

    if (!$("adminPanel").hidden) {
      $("adminPanel").scrollIntoView({ behavior: "smooth" });
    }
  });

  $("closeAdmin").addEventListener("click", () => {
    $("adminPanel").hidden = true;
  });

  $("loginForm").addEventListener("submit", login);
  $("logoutButton").addEventListener("click", logout);
  $("movieForm").addEventListener("submit", saveMovie);
  $("cancelEdit").addEventListener("click", resetForm);

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

  $("adminList").addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) editMovie(editButton.dataset.edit);
    if (deleteButton) deleteMovie(deleteButton.dataset.delete);
  });

  $("exportButton").addEventListener("click", exportCatalogue);
  $("importFile").addEventListener("change", importCatalogue);

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
      throw new Error("Supabase library did not load. Check your internet connection.");
    }

    const requiredIds = [
      "adminToggle", "adminPanel", "closeAdmin",
      "loginForm", "adminEmail", "adminPassword",
      "loginButton", "logoutButton", "authStatus",
      "adminEditor", "movieForm", "adminList",
      "movieTitle", "movieYear", "movieGenre",
      "movieRating", "moviePoster", "movieDescription",
      "movieDownload", "saveMovieButton", "cancelEdit",
      "editId", "searchInput", "sortSelect",
      "genreFilters", "movieGrid", "emptyState",
      "collectionTitle", "watchlistToggle",
      "watchlistCount", "detailModal", "detailPoster",
      "detailMeta", "detailTitle", "detailDescription",
      "detailActions", "exportButton", "importFile", "yearNow"
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

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    currentUser = data.session?.user || null;
    updateAuthUI();

    await loadMovies();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateAuthUI();
    });

    console.log("CineVault started successfully.");
  } catch (error) {
    console.error("CineVault error:", error);

    const status = $("authStatus");
    if (status) {
      status.textContent = "Error: " + error.message;
      status.classList.add("error");
    }

    const empty = $("emptyState");
    if (empty) {
      empty.hidden = false;
      empty.textContent = "Could not load CineVault: " + error.message;
    }
  }
}

startApp();
