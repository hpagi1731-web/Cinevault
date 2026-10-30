// ==========================================
// CINEVAULT — SUPABASE CONNECTED APPLICATION
// ==========================================

const SUPABASE_URL = "https://nurpfyozhtuirrkasadk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AHnmjArp9RZYcqymMp6F_A_guEVZFOn";
const ADMIN_EMAIL = "hitsnizam@gmail.com";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const WATCH_KEY = "cinevault-watchlist-v2";

let movies = [];
let activeGenre = "All";
let showingWatchlist = false;
let currentUser = null;

let watchlist = new Set(
  JSON.parse(localStorage.getItem(WATCH_KEY) || "[]")
);

const $ = id => document.getElementById(id);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function safeUrl(raw) {
  try {
    const u = new URL(raw);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function fromRow(r) {
  return {
    id: r.id,
    title: r.title,
    year: r.year || "",
    genre: r.genre || "",
    rating: r.rating ?? "",
    description: r.description || "",
    poster: r.poster_url || "",
    downloadUrl: r.download_url || ""
  };
}

function toRow(m) {
  return {
    title: m.title,
    year: m.year ? Number(m.year) : null,
    genre: m.genre || null,
    rating: m.rating === "" ? null : Number(m.rating),
    description: m.description || null,
    poster_url: safeUrl(m.poster) || null,
    download_url: safeUrl(m.downloadUrl) || null
  };
}

function setStatus(msg, bad = false) {
  const status = $("authStatus");
  if (!status) return;

  status.textContent = msg;
  status.classList.toggle("error", bad);
}

function isAdmin() {
  return !!currentUser &&
    currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// ==========================================
// AUTHENTICATION
// ==========================================

function updateAuthUI() {
  const ok = isAdmin();

  $("adminEditor").hidden = !ok;
  $("logoutButton").hidden = !currentUser;

  $("adminEmail").value = currentUser?.email || ADMIN_EMAIL;
  $("adminEmail").disabled = !!currentUser;
  $("adminPassword").disabled = !!currentUser;

  $("loginForm").querySelector(
    'button[type="submit"]'
  ).hidden = !!currentUser;

  if (currentUser && !ok) {
    setStatus("This account is not authorised to manage CineVault.", true);
  } else if (ok) {
    setStatus("Login successful! Admin editor unlocked.");
  } else {
    setStatus("Sign in to manage the shared catalogue.");
  }

  renderAdmin();
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;

  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    setStatus("Wrong admin email address.", true);
    return;
  }

  if (!password) {
    setStatus("Please enter your password.", true);
    return;
  }

  const loginButton = $("loginForm").querySelector(
    'button[type="submit"]'
  );

  loginButton.disabled = true;
  setStatus("Signing in...");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;

    if (!isAdmin()) {
      await supabase.auth.signOut();
      currentUser = null;
      throw new Error("This account is not authorised.");
    }

    $("adminPassword").value = "";

    updateAuthUI();

    setStatus("Login successful! Admin editor unlocked.");

    await loadMovies();

  } catch (err) {
    currentUser = null;
    updateAuthUI();
    setStatus("Login failed: " + err.message, true);
  } finally {
    loginButton.disabled = false;
  }
});

$("logoutButton").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus(error.message, true);
    return;
  }

  currentUser = null;
  updateAuthUI();
  setStatus("You have been logged out.");
});

// ==========================================
// MOVIE DATABASE
// ==========================================

async function loadMovies() {
  const { data, error } = await supabase
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

function posterMarkup(m) {
  const u = safeUrl(m.poster || "");

  return u
    ? `<img loading="lazy"
        src="${escapeHtml(u)}"
        alt="Poster for ${escapeHtml(m.title)}"
        onerror="this.remove();this.parentElement.innerHTML='<div class=&quot;poster-placeholder&quot;>CV</div>'">`
    : `<div class="poster-placeholder">CV</div>`;
}

function renderGenres() {
  const genres = [
    "All",
    ...new Set(
      movies.map(m => m.genre).filter(Boolean).sort()
    )
  ];

  $("genreFilters").innerHTML = genres.map(g => `
    <button type="button"
      class="filter-chip ${g === activeGenre ? "active" : ""}"
      data-genre="${escapeHtml(g)}">
      ${escapeHtml(g)}
    </button>
  `).join("");
}

function visibleMovies() {
  let list = movies.filter(m =>
    (activeGenre === "All" || m.genre === activeGenre) &&
    (!showingWatchlist || watchlist.has(m.id))
  );

  const q = $("searchInput").value.trim().toLowerCase();

  if (q) {
    list = list.filter(m =>
      [
        m.title,
        m.genre,
        m.description,
        String(m.year)
      ].join(" ").toLowerCase().includes(q)
    );
  }

  const sort = $("sortSelect").value;

  if (sort === "title") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (sort === "year") {
    list.sort((a, b) => (b.year || 0) - (a.year || 0));
  }

  if (sort === "rating") {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  return list;
}

function downloadLink(m) {
  const url = safeUrl(m.downloadUrl || "");

  return url
    ? `<a class="download-button"
        href="${escapeHtml(url)}"
        target="_blank"
        rel="noopener noreferrer">
        ↗ Get / Download
      </a>`
    : "";
}

function renderMovies() {
  renderGenres();

  const list = visibleMovies();

  $("collectionTitle").textContent =
    showingWatchlist ? "Your watchlist" : "Featured titles";

  $("movieGrid").innerHTML = list.map(m => `
    <article class="movie-card">

      <div class="poster-wrap">
        ${posterMarkup(m)}

        ${m.rating !== "" && m.rating !== null
          ? `<span class="rating">★ ${escapeHtml(m.rating)}</span>`
          : ""}
      </div>

      <div class="card-body">

        <h3 class="card-title" title="${escapeHtml(m.title)}">
          ${escapeHtml(m.title)}
        </h3>

        <p class="card-meta">
          ${escapeHtml(m.year || "Year n/a")}
          ·
          ${escapeHtml(m.genre || "Uncategorised")}
        </p>

        <div class="card-actions">
          <button class="details-button"
            type="button"
            data-details="${escapeHtml(m.id)}">
            Details
          </button>

          ${downloadLink(m)}
        </div>

      </div>
    </article>
  `).join("");

  $("emptyState").hidden = list.length > 0;
  $("watchlistCount").textContent = watchlist.size;
}

// ==========================================
// ADMIN MOVIE LIST
// ==========================================

function renderAdmin() {
  if (!$("adminList")) return;

  $("adminList").innerHTML = movies.map(m => `
    <div class="admin-item">

      <img src="${escapeHtml(safeUrl(m.poster) || "")}"
        alt=""
        onerror="this.style.visibility='hidden'">

      <div class="admin-item-text">
        <strong>${escapeHtml(m.title)}</strong>

        <small>
          ${escapeHtml(m.year || "")}
          · ${escapeHtml(m.genre || "")}
          · ${safeUrl(m.downloadUrl) ? "Download link set" : "No download link"}
        </small>
      </div>

      <div class="admin-item-actions">
        ${isAdmin() ? `
          <button type="button" data-edit="${escapeHtml(m.id)}">Edit</button>
          <button type="button" data-delete="${escapeHtml(m.id)}">Delete</button>
        ` : ""}
      </div>

    </div>
  `).join("") || "<p>No titles yet. Sign in and add your first title.</p>";
}

// ==========================================
// ADD / EDIT MOVIES
// ==========================================

function resetForm() {
  $("movieForm").reset();
  $("editId").value = "";
  $("saveMovieButton").textContent = "Save title";
}

function editMovie(id) {
  if (!isAdmin()) return;

  const m = movies.find(x => String(x.id) === String(id));
  if (!m) return;

  $("editId").value = m.id;
  $("movieTitle").value = m.title || "";
  $("movieYear").value = m.year || "";
  $("movieGenre").value = m.genre || "";
  $("movieRating").value = m.rating ?? "";
  $("moviePoster").value = m.poster || "";
  $("movieDescription").value = m.description || "";
  $("movieDownload").value = m.downloadUrl || "";

  $("saveMovieButton").textContent = "Update title";

  $("adminPanel").scrollIntoView({ behavior: "smooth" });
}

$("movieForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!isAdmin()) {
    alert("Please sign in with the CineVault admin account.");
    return;
  }

  const title = $("movieTitle").value.trim();
  const downloadRaw = $("movieDownload").value.trim();
  const posterRaw = $("moviePoster").value.trim();

  if (!title) {
    alert("Please enter a movie title.");
    return;
  }

  if (downloadRaw && !safeUrl(downloadRaw)) {
    alert("Enter a valid http or https download page URL.");
    return;
  }

  if (posterRaw && !safeUrl(posterRaw)) {
    alert("Enter a valid http or https poster URL.");
    return;
  }

  const id = $("editId").value;

  const movie = {
    title,
    year: $("movieYear").value,
    genre: $("movieGenre").value.trim(),
    rating: $("movieRating").value,
    poster: posterRaw,
    description: $("movieDescription").value.trim(),
    downloadUrl: downloadRaw
  };

  const result = id
    ? await supabase.from("movies").update(toRow(movie)).eq("id", id)
    : await supabase.from("movies").insert(toRow(movie));

  if (result.error) {
    alert("Could not save: " + result.error.message);
    return;
  }

  resetForm();
  await loadMovies();

  alert("Saved to the shared CineVault database.");
});

// ==========================================
// DELETE MOVIES
// ==========================================

$("adminList").addEventListener("click", async e => {
  if (!isAdmin()) return;

  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");

  if (edit) {
    editMovie(edit.dataset.edit);
  }

  if (del && confirm("Delete this title from the shared catalogue?")) {
    const { error } = await supabase
      .from("movies")
      .delete()
      .eq("id", del.dataset.delete);

    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }

    watchlist.delete(del.dataset.delete);

    localStorage.setItem(
      WATCH_KEY,
      JSON.stringify([...watchlist])
    );

    await loadMovies();
  }
});

// ==========================================
// WATCHLIST
// ==========================================

function toggleWatchlist(id) {
  if (watchlist.has(id)) {
    watchlist.delete(id);
  } else {
    watchlist.add(id);
  }

  localStorage.setItem(
    WATCH_KEY,
    JSON.stringify([...watchlist])
  );

  renderMovies();

  if (!$("detailModal").hidden) {
    showDetails(id);
  }
}

$("watchlistToggle").addEventListener("click", () => {
  showingWatchlist = !showingWatchlist;

  $("watchlistToggle").innerHTML = `
    ${showingWatchlist ? "▣ All titles" : "♡ Watchlist"}
    <span id="watchlistCount">${watchlist.size}</span>
  `;

  renderMovies();
});

// ==========================================
// MOVIE DETAILS
// ==========================================

function showDetails(id) {
  const m = movies.find(x => String(x.id) === String(id));
  if (!m) return;

  $("detailPoster").src = safeUrl(m.poster) || "";
  $("detailPoster").alt = `Poster for ${m.title}`;

  $("detailMeta").textContent = [
    m.year,
    m.genre,
    m.rating !== "" ? `★ ${m.rating}` : ""
  ].filter(Boolean).join(" · ");

  $("detailTitle").textContent = m.title;

  $("detailDescription").textContent =
    m.description || "No description provided.";

  $("detailActions").innerHTML = `
    <button type="button"
      class="outline-button"
      id="detailWatchlist">
      ${watchlist.has(m.id) ? "♥ In watchlist" : "♡ Add to watchlist"}
    </button>

    ${downloadLink(m)}
  `;

  $("detailWatchlist").onclick = () => toggleWatchlist(m.id);

  $("detailModal").hidden = false;
}

// ==========================================
// SEARCH AND FILTERS
// ==========================================

$("searchInput").addEventListener("input", renderMovies);
$("sortSelect").addEventListener("change", renderMovies);

$("genreFilters").addEventListener("click", e => {
  const button = e.target.closest("[data-genre]");

  if (button) {
    activeGenre = button.dataset.genre;
    renderMovies();
  }
});

$("movieGrid").addEventListener("click", e => {
  const button = e.target.closest("[data-details]");

  if (button) {
    showDetails(button.dataset.details);
  }
});

// ==========================================
// ADMIN PANEL CONTROLS
// ==========================================

$("adminToggle").addEventListener("click", () => {
  $("adminPanel").hidden = !$("adminPanel").hidden;

  if (!$("adminPanel").hidden) {
    renderAdmin();
    $("adminPanel").scrollIntoView({ behavior: "smooth" });
  }
});

$("closeAdmin").addEventListener("click", () => {
  $("adminPanel").hidden = true;
});

$("cancelEdit").addEventListener("click", resetForm);

// ==========================================
// EXPORT CATALOGUE
// ==========================================

$("exportButton").addEventListener("click", () => {
  const blob = new Blob(
    [JSON.stringify(movies, null, 2)],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cinevault-catalogue.json";
  a.click();

  URL.revokeObjectURL(a.href);
});

// ==========================================
// IMPORT CATALOGUE
// ==========================================

$("importFile").addEventListener("change", async e => {
  const file = e.target.files[0];

  if (!file) return;

  if (!isAdmin()) {
    alert("Sign in as admin first.");
    e.target.value = "";
    return;
  }

  try {
    const arr = JSON.parse(await file.text());

    if (!Array.isArray(arr)) {
      throw new Error("JSON must contain a list of movies");
    }

    for (const x of arr) {
      const row = toRow({
        title: String(x.title || "Untitled"),
        year: x.year || "",
        genre: String(x.genre || ""),
        rating: x.rating ?? "",
        poster: x.poster || x.poster_url || "",
        description: String(x.description || ""),
        downloadUrl: x.downloadUrl || x.download_url || ""
      });

      const { error } = await supabase
        .from("movies")
        .insert(row);

      if (error) throw error;
    }

    await loadMovies();

    alert("Catalogue imported into the shared database.");

  } catch (err) {
    alert("Could not import catalogue: " + err.message);
  }

  e.target.value = "";
});

// ==========================================
// MODAL CONTROLS
// ==========================================

document.querySelectorAll("[data-close-modal]").forEach(el => {
  el.addEventListener("click", () => {
    $("detailModal").hidden = true;
  });
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    $("detailModal").hidden = true;
  }
});

// ==========================================
// START APPLICATION
// ==========================================

$("yearNow").textContent = new Date().getFullYear();

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
});

(async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    updateAuthUI();

    await loadMovies();

  } catch (err) {
    console.error("CineVault startup error:", err);

    $("emptyState").hidden = false;
    $("emptyState").textContent =
      "Could not load catalogue. Check Supabase connection and table setup.";

    setStatus(err.message, true);
  }
})();
