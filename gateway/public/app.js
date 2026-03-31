const API = "/api/v1";
const PREF_AUTO_REFRESH_KEY = "demo_pref_auto_refresh";
const PREF_PAYMENT_OUTCOME_KEY = "demo_pref_payment_outcome";
const PREF_LAST_PAGE_KEY = "demo_pref_last_page";
const PREF_FILTER_CITY_KEY = "demo_pref_filter_city";
const PREF_FILTER_FROM_KEY = "demo_pref_filter_from";
const PREF_FILTER_TO_KEY = "demo_pref_filter_to";
const PREF_FILTER_PRESET_KEY = "demo_pref_filter_preset";
const PREF_SHOWTIME_QUERY_KEY = "demo_pref_showtime_query";
const PREF_SHOWTIME_SORT_KEY = "demo_pref_showtime_sort";
const PREF_BOOKING_FILTER_KEY = "demo_pref_booking_filter";

function getBooleanPref(key, fallback = false) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

function getStringPref(key, fallback = "") {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

const state = {
  token: localStorage.getItem("demo_token") || "",
  user: JSON.parse(localStorage.getItem("demo_user") || "null"),
  showtimes: [],
  selectedShowtime: null,
  selectedSeats: [],
  movies: [],
  theaters: [],
  bookings: [],
  notifications: [],
  currentPage: "auth",
  autoRefresh: getBooleanPref(PREF_AUTO_REFRESH_KEY, false),
  autoRefreshTimer: null,
  paymentOutcome: getStringPref(PREF_PAYMENT_OUTCOME_KEY, "SUCCEEDED"),
  showtimeQuery: getStringPref(PREF_SHOWTIME_QUERY_KEY, ""),
  showtimeSort: getStringPref(PREF_SHOWTIME_SORT_KEY, "start-asc"),
  bookingStatusFilter: getStringPref(PREF_BOOKING_FILTER_KEY, "ALL"),
  filters: {
    city: getStringPref(PREF_FILTER_CITY_KEY, ""),
    from: getStringPref(PREF_FILTER_FROM_KEY, ""),
    to: getStringPref(PREF_FILTER_TO_KEY, ""),
    preset: getStringPref(PREF_FILTER_PRESET_KEY, "custom"),
  },
  kpiCounts: {
    total: 0,
    confirmed: 0,
    cancelled: 0,
    pending: 0,
  },
};

const PAGE_TO_ROUTE = {
  home: "/",
  auth: "/auth",
  catalog: "/catalog",
  bookings: "/bookings",
  notifications: "/notifications",
  admin: "/admin",
};

function getPageFromPathname(pathname) {
  const normalized = pathname === "/index.html" ? "/" : pathname;
  return (
    Object.entries(PAGE_TO_ROUTE).find(([, route]) => route === normalized)?.[0] ||
    "home"
  );
}

function getRouteFromPage(pageName) {
  return PAGE_TO_ROUTE[pageName] || "/";
}

function currentUserRole() {
  if (state.user?.role) return state.user.role;
  const payload = decodeJwtPayload(state.token);
  return payload?.role || "user";
}

function isAdminUser() {
  return currentUserRole() === "admin";
}

function updateUserInfoLabel() {
  const userInfo = document.getElementById("user-info");
  if (!userInfo) return;

  if (!state.token) {
    userInfo.textContent = "Guest";
    return;
  }

  const roleTag = isAdminUser() ? " (Admin)" : "";
  userInfo.textContent = `${state.user?.email || "unknown"}${roleTag}`;
}

function populateAdminEditForm(user) {
  if (!ui.adminEditForm) return;
  if (ui.adminEmail) ui.adminEmail.value = user?.email || "";
  if (ui.adminRole) ui.adminRole.value = user?.role || "user";
  if (ui.adminName) ui.adminName.value = user?.name || "";
  if (ui.adminCity) ui.adminCity.value = user?.city || "";
  if (ui.adminPhone) ui.adminPhone.value = user?.phone || "";
}

function resetMovieForm() {
  if (!ui.adminMovieForm) return;
  if (ui.adminMovieId) ui.adminMovieId.value = "";
  if (ui.adminMovieTitle) ui.adminMovieTitle.value = "";
  if (ui.adminMovieDuration) ui.adminMovieDuration.value = "";
  if (ui.adminMovieLanguage) ui.adminMovieLanguage.value = "";
  if (ui.adminMovieGenre) ui.adminMovieGenre.value = "";
  if (ui.adminMovieRating) ui.adminMovieRating.value = "";
}

function populateMovieForm(movie) {
  if (!ui.adminMovieForm || !movie) return;
  if (ui.adminMovieId) ui.adminMovieId.value = movie._id || "";
  if (ui.adminMovieTitle) ui.adminMovieTitle.value = movie.title || "";
  if (ui.adminMovieDuration) ui.adminMovieDuration.value = movie.durationMin || "";
  if (ui.adminMovieLanguage) ui.adminMovieLanguage.value = movie.language || "";
  if (ui.adminMovieGenre) ui.adminMovieGenre.value = movie.genre || "";
  if (ui.adminMovieRating) ui.adminMovieRating.value = movie.rating || "";
}

function syncShowtimeSelectOptions() {
  if (ui.adminShowtimeMovie) {
    const currentMovie = ui.adminShowtimeMovie.value;
    const options = ['<option value="">Select movie</option>'];
    for (const movie of state.movies) {
      options.push(`<option value="${movie._id}">${movie.title}</option>`);
    }
    ui.adminShowtimeMovie.innerHTML = options.join("");
    if (currentMovie && state.movies.some((movie) => movie._id === currentMovie)) {
      ui.adminShowtimeMovie.value = currentMovie;
    }
  }

  if (ui.adminShowtimeTheater) {
    const currentTheater = ui.adminShowtimeTheater.value;
    const options = ['<option value="">Select theater</option>'];
    for (const theater of state.theaters) {
      options.push(`<option value="${theater._id}">${theater.name}</option>`);
    }
    ui.adminShowtimeTheater.innerHTML = options.join("");
    if (currentTheater && state.theaters.some((theater) => theater._id === currentTheater)) {
      ui.adminShowtimeTheater.value = currentTheater;
    }
  }
}

function resetShowtimeForm() {
  if (!ui.adminShowtimeForm) return;
  if (ui.adminShowtimeId) ui.adminShowtimeId.value = "";
  syncShowtimeSelectOptions();
  if (ui.adminShowtimeMovie) ui.adminShowtimeMovie.value = "";
  if (ui.adminShowtimeTheater) ui.adminShowtimeTheater.value = "";
  if (ui.adminShowtimeScreen) ui.adminShowtimeScreen.value = "";
  if (ui.adminShowtimeStart) ui.adminShowtimeStart.value = "";
  if (ui.adminShowtimeEnd) ui.adminShowtimeEnd.value = "";
  if (ui.adminShowtimePrice) ui.adminShowtimePrice.value = "";
}

function populateShowtimeForm(showtime) {
  if (!ui.adminShowtimeForm || !showtime) return;
  syncShowtimeSelectOptions();
  if (ui.adminShowtimeId) ui.adminShowtimeId.value = showtime._id || "";
  if (ui.adminShowtimeMovie) {
    ui.adminShowtimeMovie.value = showtime.movieId?._id || showtime.movieId || "";
  }
  if (ui.adminShowtimeTheater) {
    ui.adminShowtimeTheater.value = showtime.theaterId?._id || showtime.theaterId || "";
  }
  if (ui.adminShowtimeScreen) ui.adminShowtimeScreen.value = showtime.screenName || "";
  if (ui.adminShowtimeStart) ui.adminShowtimeStart.value = toDateTimeLocalValue(showtime.startTime);
  if (ui.adminShowtimeEnd) ui.adminShowtimeEnd.value = toDateTimeLocalValue(showtime.endTime);
  if (ui.adminShowtimePrice) ui.adminShowtimePrice.value = Number(showtime.basePrice || 0) || "";
}

const ui = {
  pages: Array.from(document.querySelectorAll(".page")),
  pageLinks: Array.from(document.querySelectorAll(".page-link")),
  authedOnly: Array.from(document.querySelectorAll(".authed-only")),
  userEmail: document.getElementById("user-email") || document.getElementById("user-info"),
  statusPill: document.getElementById("status-pill"),
  selectionSummary: document.getElementById("selection-summary"),
  autoRefreshToggle: document.getElementById("auto-refresh-toggle"),
  filterCity: document.getElementById("filter-city"),
  filterFrom: document.getElementById("filter-from"),
  filterTo: document.getElementById("filter-to"),
  applyFilters: document.getElementById("apply-filters"),
  resetFilters: document.getElementById("reset-filters"),
  filterPresets: Array.from(document.querySelectorAll(".filter-preset")),
  showtimeSearch: document.getElementById("showtime-search"),
  showtimeSort: document.getElementById("showtime-sort"),
  clearSeatSelection: document.getElementById("clear-seat-selection"),
  bookingStatusFilter: document.getElementById("booking-status-filter"),
  kpiTotal: document.getElementById("kpi-total"),
  kpiConfirmed: document.getElementById("kpi-confirmed"),
  kpiCancelled: document.getElementById("kpi-cancelled"),
  kpiPending: document.getElementById("kpi-pending"),
  toastRoot: document.getElementById("toast-root"),
  showtimes: document.getElementById("showtimes"),
  seats: document.getElementById("seats"),
  seatMeta: document.getElementById("seat-meta"),
  bookings: document.getElementById("bookings"),
  notifications: document.getElementById("notifications"),
  adminRefresh: document.getElementById("admin-refresh"),
  adminTotalBookings: document.getElementById("admin-total-bookings"),
  adminTotalNotifications: document.getElementById("admin-total-notifications"),
  adminTotalShowtimes: document.getElementById("admin-total-showtimes"),
  adminHealthyServices: document.getElementById("admin-healthy-services"),
  adminServiceHealth: document.getElementById("admin-service-health"),
  adminActivity: document.getElementById("admin-activity"),
  adminEditForm: document.getElementById("admin-edit-form"),
  adminEmail: document.getElementById("admin-email"),
  adminRole: document.getElementById("admin-role"),
  adminName: document.getElementById("admin-name"),
  adminCity: document.getElementById("admin-city"),
  adminPhone: document.getElementById("admin-phone"),
  adminSaveProfile: document.getElementById("admin-save-profile"),
  adminMovieForm: document.getElementById("admin-movie-form"),
  adminMovieId: document.getElementById("admin-movie-id"),
  adminMovieTitle: document.getElementById("admin-movie-title"),
  adminMovieDuration: document.getElementById("admin-movie-duration"),
  adminMovieLanguage: document.getElementById("admin-movie-language"),
  adminMovieGenre: document.getElementById("admin-movie-genre"),
  adminMovieRating: document.getElementById("admin-movie-rating"),
  adminSaveMovie: document.getElementById("admin-save-movie"),
  adminResetMovie: document.getElementById("admin-reset-movie"),
  adminMoviesList: document.getElementById("admin-movies-list"),
  adminShowtimeForm: document.getElementById("admin-showtime-form"),
  adminShowtimeId: document.getElementById("admin-showtime-id"),
  adminShowtimeMovie: document.getElementById("admin-showtime-movie"),
  adminShowtimeTheater: document.getElementById("admin-showtime-theater"),
  adminShowtimeScreen: document.getElementById("admin-showtime-screen"),
  adminShowtimeStart: document.getElementById("admin-showtime-start"),
  adminShowtimeEnd: document.getElementById("admin-showtime-end"),
  adminShowtimePrice: document.getElementById("admin-showtime-price"),
  adminSaveShowtime: document.getElementById("admin-save-showtime"),
  adminResetShowtime: document.getElementById("admin-reset-showtime"),
  adminShowtimesList: document.getElementById("admin-showtimes-list"),
  homeSearch: document.getElementById("home-search"),
  homeSearchBtn: document.getElementById("home-search-btn"),
  homeGenreFilter: document.getElementById("home-genre-filter"),
  homeLanguageFilter: document.getElementById("home-language-filter"),
  homeResetFilters: document.getElementById("home-reset-filters"),
  guestAuthBtn: document.getElementById("guest-auth-btn"),
  quickActionCards: Array.from(document.querySelectorAll(".action-card[data-page-target]")),
  demoUserLogin: document.getElementById("demo-user-login"),
  demoAdminLogin: document.getElementById("demo-admin-login"),
  homeTotalBookings: document.getElementById("home-total-bookings"),
  homeConfirmedRate: document.getElementById("home-confirmed-rate"),
  homeTotalNotifications: document.getElementById("home-total-notifications"),
  loginForm: document.getElementById("login-form"),
  signupForm: document.getElementById("signup-form"),
  tabLogin: document.getElementById("tab-login"),
  tabSignup: document.getElementById("tab-signup"),
  refreshAll: document.getElementById("refresh-all"),
  runBooking: document.getElementById("run-booking"),
  logout: document.getElementById("logout"),
  paymentOutcome: () =>
    document.querySelector('input[name="payment-outcome"]:checked')?.value || "SUCCEEDED",
};

function skeletonRows(count = 3) {
  return Array.from({ length: count })
    .map(() => '<div class="skeleton"></div>')
    .join("");
}

function persistAutoRefreshPref(value) {
  localStorage.setItem(PREF_AUTO_REFRESH_KEY, String(Boolean(value)));
}

function persistPaymentOutcomePref(value) {
  localStorage.setItem(PREF_PAYMENT_OUTCOME_KEY, value);
}

function persistShowtimePrefs() {
  localStorage.setItem(PREF_SHOWTIME_QUERY_KEY, state.showtimeQuery || "");
  localStorage.setItem(PREF_SHOWTIME_SORT_KEY, state.showtimeSort || "start-asc");
}

function persistBookingFilterPref(value) {
  localStorage.setItem(PREF_BOOKING_FILTER_KEY, value || "ALL");
}

function persistLastPage(value) {
  localStorage.setItem(PREF_LAST_PAGE_KEY, value);
}

function getLastPagePref() {
  const value = getStringPref(PREF_LAST_PAGE_KEY, "catalog");
  return ["catalog", "bookings", "notifications", "admin"].includes(value)
    ? value
    : "catalog";
}

function defaultFilterWindow() {
  const from = new Date(Date.now() - 60 * 60 * 1000);
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function getPresetWindow(presetName) {
  const now = new Date();

  if (presetName === "today") {
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (presetName === "tonight") {
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(18, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (now > end) {
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);
    }

    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (presetName === "tomorrow") {
    const start = new Date(now);
    const end = new Date(now);
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (presetName === "weekend") {
    const start = new Date(now);
    const end = new Date(now);
    const day = now.getDay();
    const daysUntilSaturday = day === 6 ? 0 : (6 - day + 7) % 7;
    start.setDate(now.getDate() + daysUntilSaturday);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 1);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (presetName === "upcoming" || presetName === "next3days") {
    const start = new Date(now);
    const end = new Date(now);
    start.setDate(start.getDate() + 2);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (presetName === "later" || presetName === "latest") {
    const start = new Date(now);
    const end = new Date(now);
    start.setDate(start.getDate() + 7);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 30);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  return defaultFilterWindow();
}

function toDateTimeLocalValue(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function persistFilterPrefs() {
  localStorage.setItem(PREF_FILTER_CITY_KEY, state.filters.city || "");
  localStorage.setItem(PREF_FILTER_FROM_KEY, state.filters.from || "");
  localStorage.setItem(PREF_FILTER_TO_KEY, state.filters.to || "");
  localStorage.setItem(PREF_FILTER_PRESET_KEY, state.filters.preset || "custom");
}

function ensureFilterDefaults() {
  if (state.filters.from && state.filters.to) {
    return;
  }
  const defaults = defaultFilterWindow();
  state.filters.from = state.filters.from || defaults.from;
  state.filters.to = state.filters.to || defaults.to;
}

function syncFilterInputsFromState() {
  if (ui.filterCity) ui.filterCity.value = state.filters.city || "";
  if (ui.filterFrom) ui.filterFrom.value = toDateTimeLocalValue(state.filters.from);
  if (ui.filterTo) ui.filterTo.value = toDateTimeLocalValue(state.filters.to);
  const activePreset = state.filters.preset === "later" ? "latest" : state.filters.preset;
  ui.filterPresets.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === activePreset);
  });
}

function syncFilterStateFromInputs() {
  state.filters.city = ui.filterCity?.value.trim() || "";
  state.filters.from = fromDateTimeLocalValue(ui.filterFrom?.value || "");
  state.filters.to = fromDateTimeLocalValue(ui.filterTo?.value || "");
  state.filters.preset = "custom";
  ensureFilterDefaults();
  persistFilterPrefs();
  syncFilterInputsFromState();
}

async function applyPreset(presetName) {
  const allowed = ["today", "tonight", "tomorrow", "weekend", "upcoming", "later", "latest", "next3days"];
  if (!allowed.includes(presetName)) return;

  const normalizedPreset = presetName === "latest" ? "later" : presetName;

  const window = getPresetWindow(normalizedPreset);
  state.filters.from = window.from;
  state.filters.to = window.to;
  state.filters.preset = presetName;
  persistFilterPrefs();
  syncFilterInputsFromState();

  await loadShowtimes();
  logLine(`Applied ${presetName} preset`);
  toast(`Preset applied: ${presetName}`, "info");
}

function applyPaymentOutcomePreference() {
  const allowed = ["SUCCEEDED", "FAILED"];
  const selected = allowed.includes(state.paymentOutcome) ? state.paymentOutcome : "SUCCEEDED";
  const input = document.querySelector(`input[name="payment-outcome"][value="${selected}"]`);
  if (input) {
    input.checked = true;
  }
}

function logLine(message) {
  const now = new Date().toLocaleTimeString();
  const line = `[${now}] ${message}`;
  const logNode = document.getElementById("log");

  if (logNode) {
    logNode.textContent = `${line}\n${logNode.textContent}`.slice(0, 6000);
    return;
  }

  // Fallback when no in-page log panel exists.
  console.info(line);
}

function toast(message, kind = "info") {
  if (!ui.toastRoot) return;
  const node = document.createElement("div");
  node.className = `toast ${kind}`;
  node.textContent = message;
  ui.toastRoot.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function setBusy(button, busy, busyLabel = "Working...") {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.disabled = true;
    button.textContent = busyLabel;
    return;
  }

  button.disabled = false;
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
}

function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const node = document.getElementById(`${fieldId}-error`);
  if (!input || !node) return;
  input.classList.toggle("input-error", Boolean(message));
  node.textContent = message || "";
}

function clearFormErrors() {
  [
    "login-email",
    "login-password",
    "signup-name",
    "signup-email",
    "signup-password",
    "signup-city",
  ].forEach((id) => setFieldError(id, ""));
}

function validateLoginForm() {
  clearFormErrors();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  let valid = true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError("login-email", "Enter a valid email address.");
    valid = false;
  }

  if (!password || password.length < 6) {
    setFieldError("login-password", "Password must be at least 6 characters.");
    valid = false;
  }

  return valid;
}

function validateSignupForm() {
  clearFormErrors();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const cityInput = document.getElementById("signup-city");
  const city = cityInput ? cityInput.value.trim() : "Bengaluru";
  let valid = true;

  if (!name || name.length < 2) {
    setFieldError("signup-name", "Name must be at least 2 characters.");
    valid = false;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError("signup-email", "Enter a valid email address.");
    valid = false;
  }

  if (!password || password.length < 6) {
    setFieldError("signup-password", "Password must be at least 6 characters.");
    valid = false;
  }

  if (cityInput && (!city || city.length < 2)) {
    setFieldError("signup-city", "City is required.");
    valid = false;
  }

  return valid;
}

function authErrorHint(error) {
  const message = String(error?.message || "");
  if (/already in use/i.test(message)) {
    return "Email already registered. Switch to Sign In.";
  }
  if (/invalid credentials/i.test(message)) {
    return "Invalid email or password. Please try again.";
  }
  if (/required/i.test(message)) {
    return "Please fill all required fields.";
  }
  return message || "Authentication failed. Please try again.";
}

function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (!state.autoRefresh || !state.token) return;

  state.autoRefreshTimer = setInterval(async () => {
    try {
      await Promise.all([loadBookings(), loadNotifications()]);
    } catch (_error) {
      stopAutoRefresh();
      state.autoRefresh = false;
      if (ui.autoRefreshToggle) ui.autoRefreshToggle.checked = false;
      toast("Auto-refresh stopped due to a request error.", "error");
    }
  }, 8000);
}

function updateStatusPill() {
  if (!ui.statusPill) return;
  const isAuthed = Boolean(state.token);
  ui.statusPill.classList.toggle("ok", isAuthed);
  ui.statusPill.classList.toggle("warn", !isAuthed);
  ui.statusPill.textContent = isAuthed ? "Connected" : "Guest";
}

function renderSelectionSummary() {
  if (!ui.selectionSummary) return;

  if (!state.selectedShowtime) {
    ui.selectionSummary.textContent = "Choose a showtime and seats to view booking estimate.";
    return;
  }

  const movieTitle = state.selectedShowtime.movieId?.title || "Untitled";
  const selectedCount = state.selectedSeats.length;
  const estimated = currency(Number(state.selectedShowtime.basePrice || 0) * selectedCount);
  ui.selectionSummary.textContent = `Show: ${movieTitle} | Seats: ${selectedCount || 0} | Estimate: ${estimated}`;
}

function setSession(token, user) {
  state.token = token;
  state.user = user || null;
  localStorage.setItem("demo_token", token);
  localStorage.setItem("demo_user", JSON.stringify(state.user));
  updateStatusPill();
}

function clearSession() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("demo_token");
  localStorage.removeItem("demo_user");
  updateStatusPill();
}

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function idKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function setAuthMode(mode) {
  const loginActive = mode === "login";
  if (ui.tabLogin) ui.tabLogin.classList.toggle("is-active", loginActive);
  if (ui.tabSignup) ui.tabSignup.classList.toggle("is-active", !loginActive);
  if (ui.loginForm) ui.loginForm.classList.toggle("is-active", loginActive);
  if (ui.signupForm) ui.signupForm.classList.toggle("is-active", !loginActive);
}

function setPage(pageName, options = {}) {
  const { updateUrl = false, replaceUrl = false } = options;
  state.currentPage = pageName;

  if (["home", "catalog", "bookings", "notifications", "admin"].includes(pageName)) {
    persistLastPage(pageName);
  }

  for (const page of ui.pages) {
    page.classList.toggle("is-active", page.id === `page-${pageName}`);
  }

  for (const link of ui.pageLinks) {
    link.classList.toggle("is-active", link.dataset.page === pageName);
  }

  // Hide/show guest message
  const guestMessage = document.querySelector(".guest-message");
  if (guestMessage) {
    guestMessage.hidden = Boolean(state.token);
  }

  // Show/hide authed sections
  const authedOnlyHidden = Array.from(document.querySelectorAll(".authed-only-hidden"));
  authedOnlyHidden.forEach(el => {
    el.hidden = Boolean(state.token);
  });

  // Load home movies when navigating to home
  if (pageName === "home" && state.token) {
    loadHomeMovies();
  }

  if (pageName === "admin" && state.token) {
    loadAdminDashboard();
  }

  if (updateUrl) {
    const route = getRouteFromPage(pageName);
    if (window.location.pathname !== route) {
      const method = replaceUrl ? "replaceState" : "pushState";
      window.history[method]({}, "", route);
    }
  }
}

function navigate(pageName) {
  setPage(pageName, { updateUrl: true });
}

function syncAuthUI() {
  const isAuthed = Boolean(state.token);
  for (const section of ui.authedOnly) {
    section.hidden = !isAuthed;
  }

  if (ui.logout) {
    ui.logout.hidden = !isAuthed;
  }

  const adminLinks = document.querySelectorAll('.page-link[data-page="admin"]');
  adminLinks.forEach((link) => {
    link.hidden = !isAuthed || !isAdminUser();
  });

  const adminOnlyNodes = document.querySelectorAll(".admin-only");
  adminOnlyNodes.forEach((node) => {
    node.hidden = !isAuthed || !isAdminUser();
  });

  if (!isAuthed && !["auth", "home"].includes(state.currentPage)) {
    setPage("auth");
    return;
  }

  if (isAuthed && state.currentPage === "admin" && !isAdminUser()) {
    setPage("home", { updateUrl: true, replaceUrl: true });
    toast("Admin access is restricted by role.", "error");
  }
}

function getShowtimeCategory(showtimeDate) {
  const showStart = new Date(showtimeDate);
  const showDay = new Date(showStart);
  showDay.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const upcomingEnd = new Date(today);
  upcomingEnd.setDate(upcomingEnd.getDate() + 6);

  const laterStart = new Date(today);
  laterStart.setDate(laterStart.getDate() + 7);

  if (showDay.getTime() === today.getTime()) {
    return showStart.getHours() >= 18 ? "tonight" : "today";
  }

  if (showDay.getTime() === tomorrow.getTime()) {
    return "tomorrow";
  }

  const dayOfWeek = showStart.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return "weekend";
  }

  if (showDay <= upcomingEnd) {
    return "upcoming";
  }

  if (showDay >= laterStart) {
    return "later";
  }

  return "later";
}

function getCategoryLabel(category) {
  const labels = {
    "today": { label: "Today", icon: "📅", priority: 1 },
    "tonight": { label: "Tonight", icon: "🌙", priority: 2 },
    "tomorrow": { label: "Tomorrow", icon: "➡️", priority: 3 },
    "weekend": { label: "Weekend", icon: "🎉", priority: 4 },
    "upcoming": { label: "Upcoming", icon: "⏰", priority: 5 },
    "later": { label: "Latest", icon: "📍", priority: 6 }
  };
  return labels[category] || { label: "Other", icon: "📽️", priority: 7 };
}

function getAvailableSeats(showtime) {
  const totalSeats = showtime.totalSeats || 70;
  const bookedSeats = showtime.bookedSeats || 0;
  const available = totalSeats - bookedSeats;
  const capacity = Math.round((available / totalSeats) * 100);
  return { available, totalSeats, capacity };
}

function renderShowtimes() {
  ui.showtimes.innerHTML = "";

  const query = (state.showtimeQuery || "").trim().toLowerCase();
  let showtimeList = [...state.showtimes];

  if (query) {
    showtimeList = showtimeList.filter((showtime) => {
      const movieTitle = (showtime.movieId?.title || "").toLowerCase();
      const theaterName = (showtime.theaterId?.name || "").toLowerCase();
      return movieTitle.includes(query) || theaterName.includes(query);
    });
  }

  if (state.showtimeSort === "start-desc") {
    showtimeList.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  } else if (state.showtimeSort === "price-asc") {
    showtimeList.sort((a, b) => Number(a.basePrice || 0) - Number(b.basePrice || 0));
  } else if (state.showtimeSort === "price-desc") {
    showtimeList.sort((a, b) => Number(b.basePrice || 0) - Number(a.basePrice || 0));
  } else {
    showtimeList.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  if (!showtimeList.length) {
    ui.showtimes.innerHTML = '<p class="item">No showtimes found. Seed movie-service first.</p>';
    return;
  }

  // Group by category
  const grouped = {};
  for (const showtime of showtimeList) {
    const category = getShowtimeCategory(showtime.startTime);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(showtime);
  }

  // Render by category
  const categories = ["today", "tonight", "tomorrow", "weekend", "upcoming", "later"];
  for (const category of categories) {
    if (!grouped[category] || grouped[category].length === 0) continue;

    const categoryInfo = getCategoryLabel(category);
    
    // Add category header
    const header = document.createElement("div");
    header.className = "showtime-category-header";
    header.innerHTML = `
      <span class="category-badge">
        <span class="category-icon">${categoryInfo.icon}</span>
        <span class="category-name">${categoryInfo.label}</span>
      </span>
      <span class="category-count">${grouped[category].length} shows</span>
    `;
    ui.showtimes.appendChild(header);

    // Render showtimes in category
    for (const showtime of grouped[category]) {
      const el = document.createElement("button");
      const isSelected = state.selectedShowtime?._id === showtime._id;
      el.className = `item showtime-item ${isSelected ? "is-selected" : ""}`;
      el.type = "button";

      const movieTitle = showtime.movieId?.title || "Untitled";
      const theater = showtime.theaterId?.name || "Unknown theater";
      const startTime = new Date(showtime.startTime);
      const timeStr = startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = startTime.toLocaleDateString([], { month: "short", day: "numeric" });
      const basePrice = currency(showtime.basePrice);
      const seatInfo = getAvailableSeats(showtime);
      const availabilityClass = seatInfo.capacity > 50 ? "high-availability" : seatInfo.capacity > 20 ? "medium-availability" : "low-availability";

      el.innerHTML = `
        <div class="showtime-header">
          <h4 class="movie-title">${movieTitle}</h4>
          <span class="selected-badge" style="display: ${isSelected ? 'inline' : 'none'};">✓ Selected</span>
        </div>
        <div class="showtime-details">
          <div class="detail-group">
            <span class="label">Theater:</span>
            <span class="value">${theater}</span>
          </div>
          <div class="detail-group">
            <span class="label">Time:</span>
            <span class="value time">${timeStr}</span>
            <span class="date">${dateStr}</span>
          </div>
          <div class="detail-group">
            <span class="label">Price:</span>
            <span class="value price">${basePrice}</span>
          </div>
        </div>
        <div class="availability-section">
          <div class="availability-bar ${availabilityClass}">
            <div class="availability-fill" style="width: ${seatInfo.capacity}%"></div>
          </div>
          <span class="availability-text">${seatInfo.available}/${seatInfo.totalSeats} seats available</span>
        </div>
      `;

      el.addEventListener("click", async () => {
        state.selectedShowtime = showtime;
        state.selectedSeats = [];
        renderShowtimes();
        await loadSeats(showtime._id);
        renderSelectionSummary();
        logLine(`Selected showtime: ${movieTitle} at ${timeStr}`);
      });

      ui.showtimes.appendChild(el);
    }
  }
}

function renderSeats(layout) {
  ui.seats.innerHTML = "";

  if (!layout.length) {
    ui.seats.innerHTML = '<p class="item">No seats for this showtime.</p>';
    return;
  }

  for (const seat of layout) {
    const seatId = seat.seatId;
    const el = document.createElement("button");
    const selected = state.selectedSeats.includes(seatId);
    el.className = `seat ${selected ? "is-selected" : ""}`;
    el.type = "button";
    el.textContent = seatId;

    el.addEventListener("click", () => {
      const idx = state.selectedSeats.indexOf(seatId);
      if (idx >= 0) {
        state.selectedSeats.splice(idx, 1);
      } else {
        if (state.selectedSeats.length >= 6) {
          logLine("You can select up to 6 seats");
          return;
        }
        state.selectedSeats.push(seatId);
      }
      renderSeats(layout);
      ui.seatMeta.textContent = `Selected seats: ${state.selectedSeats.join(", ") || "none"}`;
      renderSelectionSummary();
    });

    ui.seats.appendChild(el);
  }
}

function statusChip(status) {
  const ok = ["CONFIRMED", "CANCELLED"].includes(status);
  const klass = ok ? "ok" : "warn";
  return `<span class="chip ${klass}">${status}</span>`;
}

function animateKpiValue(node, from, to) {
  if (!node) return;

  const startValue = Number.isFinite(from) ? from : 0;
  const endValue = Number.isFinite(to) ? to : 0;

  if (startValue === endValue) {
    node.textContent = String(endValue);
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    node.textContent = String(endValue);
    return;
  }

  const card = node.closest(".kpi-card");
  if (card) {
    card.classList.add("is-updating");
  }

  const durationMs = 380;
  const startedAt = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - startedAt) / durationMs, 1);
    const eased = 1 - (1 - progress) ** 3;
    const current = Math.round(startValue + (endValue - startValue) * eased);
    node.textContent = String(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    node.textContent = String(endValue);
    if (card) {
      card.classList.remove("is-updating");
    }
  };

  requestAnimationFrame(tick);
}

function renderKpis(nextCounts) {
  const prev = state.kpiCounts;

  animateKpiValue(ui.kpiTotal, prev.total, nextCounts.total);
  animateKpiValue(ui.kpiConfirmed, prev.confirmed, nextCounts.confirmed);
  animateKpiValue(ui.kpiCancelled, prev.cancelled, nextCounts.cancelled);
  animateKpiValue(ui.kpiPending, prev.pending, nextCounts.pending);

  state.kpiCounts = { ...nextCounts };
}

function renderBookings() {
  ui.bookings.innerHTML = "";

  const counts = {
    total: state.bookings.length,
    confirmed: state.bookings.filter((booking) => booking.status === "CONFIRMED").length,
    cancelled: state.bookings.filter((booking) => booking.status === "CANCELLED").length,
    pending: state.bookings.filter((booking) => ["PENDING_PAYMENT", "CANCEL_REQUESTED"].includes(booking.status)).length,
  };

  renderKpis(counts);

  let bookingsList = [...state.bookings];
  if (state.bookingStatusFilter !== "ALL") {
    bookingsList = bookingsList.filter((booking) => booking.status === state.bookingStatusFilter);
  }

  if (!bookingsList.length) {
    ui.bookings.innerHTML = '<p class="item">No bookings yet.</p>';
    return;
  }

  for (const booking of bookingsList) {
    const row = document.createElement("div");
    row.className = "item";

    const seats = (booking.seats || []).join(", ");
    row.innerHTML = `
      <div class="booking-row">
        <div>
          <h4>${booking.bookingId}</h4>
          <p>Seats: ${seats || "-"}</p>
          <p>Amount: ${currency(booking.amount)}</p>
        </div>
        <div>${statusChip(booking.status)}</div>
      </div>
    `;

    if (["CONFIRMED", "PENDING_PAYMENT"].includes(booking.status)) {
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn ghost";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => cancelBooking(booking.bookingId));
      row.appendChild(cancelBtn);
    }

    ui.bookings.appendChild(row);
  }
}

function renderNotifications() {
  ui.notifications.innerHTML = "";

  if (!state.notifications.length) {
    ui.notifications.innerHTML = '<p class="item">No notification logs yet.</p>';
    return;
  }

  for (const entry of state.notifications.slice(0, 40)) {
    const row = document.createElement("div");
    row.className = "item";

    const createdAt = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-";
    const bookingId = entry.payload?.bookingId || "-";

    row.innerHTML = `
      <h4>${bookingId}</h4>
      <p>${createdAt}</p>
      <span class="event-type">${entry.eventType || "UNKNOWN_EVENT"}</span>
    `;

    ui.notifications.appendChild(row);
  }
}

function renderHomeInsights() {
  if (!ui.homeTotalBookings || !ui.homeConfirmedRate || !ui.homeTotalNotifications) return;

  const totalBookings = state.bookings.length;
  const confirmedBookings = state.bookings.filter((item) => item.status === "CONFIRMED").length;
  const confirmationRate = totalBookings ? Math.round((confirmedBookings / totalBookings) * 100) : 0;

  ui.homeTotalBookings.textContent = String(totalBookings);
  ui.homeConfirmedRate.textContent = `${confirmationRate}%`;
  ui.homeTotalNotifications.textContent = String(state.notifications.length);
}

async function checkServiceHealth() {
  const host = window.location.hostname || "localhost";
  const protocol = window.location.protocol;
  const targets = [
    { name: "Gateway", url: `${protocol}//${host}:4000/api/v1/health`, isGateway: true },
    { name: "User Service", url: `${protocol}//${host}:5001/health` },
    { name: "Movie Service", url: `${protocol}//${host}:5002/health` },
    { name: "Booking Service", url: `${protocol}//${host}:5003/health` },
    { name: "Payment Service", url: `${protocol}//${host}:5004/health` },
    { name: "Notification Service", url: `${protocol}//${host}:5005/health` },
  ];

  const checks = await Promise.all(
    targets.map(async (target) => {
      try {
        const response = await fetch(target.url, { method: "GET" });
        return { name: target.name, ok: response.ok };
      } catch {
        return { name: target.name, ok: false };
      }
    })
  );

  return checks;
}

function renderServiceHealth(health) {
  if (!ui.adminServiceHealth) return;

  ui.adminServiceHealth.innerHTML = health
    .map(
      (item) => `
        <div class="admin-service-card ${item.ok ? "is-ok" : "is-bad"}">
          <h4>${item.name}</h4>
          <span class="chip ${item.ok ? "ok" : "warn"}">${item.ok ? "Healthy" : "Down"}</span>
        </div>
      `
    )
    .join("");
}

function renderAdminActivity(items) {
  if (!ui.adminActivity) return;

  if (!items.length) {
    ui.adminActivity.innerHTML = '<p class="item">No recent activity yet.</p>';
    return;
  }

  ui.adminActivity.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <h4>${item.title}</h4>
      <p>${item.time}</p>
      <span class="event-type">${item.type}</span>
    `;
    ui.adminActivity.appendChild(row);
  }
}

function renderAdminMovies() {
  if (!ui.adminMoviesList) return;

  if (!state.movies.length) {
    ui.adminMoviesList.innerHTML = '<p class="item">No movies available.</p>';
    return;
  }

  ui.adminMoviesList.innerHTML = "";
  for (const movie of state.movies) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="booking-row">
        <div>
          <h4>${movie.title}</h4>
          <p>${movie.language || "-"} | ${movie.genre || "-"} | ${movie.durationMin || "-"} min</p>
        </div>
        <div class="admin-movie-actions">
          <button class="btn ghost" type="button" data-action="edit">Edit</button>
          <button class="btn ghost" type="button" data-action="delete">Delete</button>
        </div>
      </div>
    `;

    row.querySelector('[data-action="edit"]').addEventListener("click", () => {
      populateMovieForm(movie);
      toast(`Editing ${movie.title}`, "info");
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!isAdminUser()) {
        toast("Only admin can delete movies.", "error");
        return;
      }

      try {
        await api(`/catalog/movies/${movie._id}`, { method: "DELETE" });
        state.movies = state.movies.filter((item) => item._id !== movie._id);
        renderAdminMovies();
        toast("Movie deleted", "success");
      } catch (error) {
        toast(`Delete failed: ${error.message}`, "error");
      }
    });

    ui.adminMoviesList.appendChild(row);
  }
}

function renderAdminShowtimes() {
  if (!ui.adminShowtimesList) return;

  if (!state.showtimes.length) {
    ui.adminShowtimesList.innerHTML = '<p class="item">No showtimes available.</p>';
    return;
  }

  const sorted = [...state.showtimes].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  ui.adminShowtimesList.innerHTML = "";

  for (const showtime of sorted) {
    const row = document.createElement("div");
    row.className = "item";

    const movieTitle = showtime.movieId?.title || "Untitled";
    const theaterName = showtime.theaterId?.name || "Unknown theater";
    const start = new Date(showtime.startTime).toLocaleString();
    const end = new Date(showtime.endTime).toLocaleString();

    row.innerHTML = `
      <div class="booking-row">
        <div>
          <h4>${movieTitle} • ${theaterName}</h4>
          <p>${showtime.screenName || "Screen"} | ${start} - ${end}</p>
          <p>${currency(showtime.basePrice)} | ${showtime.cityName || "-"}</p>
        </div>
        <div class="admin-showtime-actions">
          <button class="btn ghost" type="button" data-action="edit">Edit</button>
          <button class="btn ghost" type="button" data-action="delete">Delete</button>
        </div>
      </div>
    `;

    row.querySelector('[data-action="edit"]').addEventListener("click", () => {
      populateShowtimeForm(showtime);
      toast("Editing showtime", "info");
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!isAdminUser()) {
        toast("Only admin can delete showtimes.", "error");
        return;
      }

      try {
        await api(`/catalog/showtimes/${showtime._id}`, { method: "DELETE" });
        state.showtimes = state.showtimes.filter((item) => item._id !== showtime._id);
        renderAdminShowtimes();
        toast("Showtime deleted", "success");
      } catch (error) {
        toast(`Delete failed: ${error.message}`, "error");
      }
    });

    ui.adminShowtimesList.appendChild(row);
  }
}

async function loadAdminDashboard() {
  if (!state.token) return;

  if (ui.adminActivity) {
    ui.adminActivity.innerHTML = skeletonRows(4);
  }

  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [bookings, notifications, showtimes, health, movies, theaters] = await Promise.all([
    api("/bookings/me").catch(() => state.bookings),
    api("/notifications/logs").catch(() => state.notifications),
    api(`/catalog/showtimes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).catch(() =>
      state.showtimes
    ),
    checkServiceHealth(),
    api("/catalog/movies").catch(() => state.movies),
    api("/catalog/theaters").catch(() => state.theaters),
  ]);

  state.bookings = Array.isArray(bookings) ? bookings : state.bookings;
  state.notifications = Array.isArray(notifications) ? notifications : state.notifications;
  state.showtimes = Array.isArray(showtimes) ? showtimes : state.showtimes;
  state.movies = Array.isArray(movies) ? movies : state.movies;
  state.theaters = Array.isArray(theaters) ? theaters : state.theaters;

  if (ui.adminTotalBookings) ui.adminTotalBookings.textContent = String(state.bookings.length);
  if (ui.adminTotalNotifications) {
    ui.adminTotalNotifications.textContent = String(state.notifications.length);
  }
  if (ui.adminTotalShowtimes) ui.adminTotalShowtimes.textContent = String(state.showtimes.length);

  const healthyCount = health.filter((item) => item.ok).length;
  if (ui.adminHealthyServices) {
    ui.adminHealthyServices.textContent = `${healthyCount}/${health.length}`;
  }

  renderServiceHealth(health);

  const recentEvents = (state.notifications || []).slice(0, 8).map((entry) => ({
    title: entry.payload?.bookingId || "System Event",
    time: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-",
    type: entry.eventType || "UNKNOWN_EVENT",
  }));

  renderAdminActivity(recentEvents);
  renderHomeInsights();
  populateAdminEditForm(state.user);
  syncShowtimeSelectOptions();
  renderAdminMovies();
  renderAdminShowtimes();
}

function searchMovies() {
  const query = (document.getElementById("home-search")?.value || "").trim().toLowerCase();
  if (!query) {
    loadHomeMovies();
    return;
  }

  const grid = document.getElementById("home-movies-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".movie-card"));
  let visible = 0;
  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    const match = text.includes(query);
    card.style.display = match ? "block" : "none";
    if (match) visible += 1;
  });

  if (!visible) {
    toast("No matching movies found", "info");
  }
}

function applyHomeFilters() {
  const genre = (document.getElementById("home-genre-filter")?.value || "").toLowerCase();
  const language = (document.getElementById("home-language-filter")?.value || "").toLowerCase();
  const grid = document.getElementById("home-movies-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".movie-card"));
  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    const genreMatch = !genre || text.includes(genre);
    const languageMatch = !language || text.includes(language);
    card.style.display = genreMatch && languageMatch ? "block" : "none";
  });
}

function resetHomeFilters() {
  const search = document.getElementById("home-search");
  const genre = document.getElementById("home-genre-filter");
  const language = document.getElementById("home-language-filter");
  if (search) search.value = "";
  if (genre) genre.value = "";
  if (language) language.value = "";
  loadHomeMovies();
}

function getPosterTheme(movie, index) {
  const genre = String(movie?.genre || "").toLowerCase();
  if (genre.includes("action")) return "theme-action";
  if (genre.includes("drama")) return "theme-drama";
  if (genre.includes("comedy")) return "theme-comedy";
  if (genre.includes("thriller")) return "theme-thriller";
  if (genre.includes("rom")) return "theme-romance";
  return index % 2 === 0 ? "theme-cobalt" : "theme-ember";
}

function getPosterGlyph(movie) {
  const title = String(movie?.title || "Movie").trim();
  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return title.slice(0, 2).toUpperCase();
}

async function loadHomeMovies() {
  const grid = document.getElementById("home-movies-grid");
  if (!grid) return;
  
  grid.innerHTML = skeletonRows(6);
  try {
    const params = new URLSearchParams();
    params.set("from", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    params.set("to", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    const qs = `?${params.toString()}`;
    const showtimes = await api(`/catalog/showtimes${qs}`);
    
    // Group showtimes by movie
    const movieMap = {};
    for(const showtime of showtimes || []) {
      const movieId = showtime.movieId;
      if (movieId && movieId._id) {
        if (!movieMap[movieId._id]) {
          movieMap[movieId._id] = movieId;
        }
      }
    }
    
    const movies = Object.values(movieMap).slice(0, 8);
    
    if (!movies.length) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No movies available. Please seed the catalog.</p>';
      return;
    }
    
    grid.innerHTML = "";
    for (const [index, movie] of movies.entries()) {
      const posterTheme = getPosterTheme(movie, index);
      const posterGlyph = getPosterGlyph(movie);
      const duration = movie.durationMin ? `${movie.durationMin} min` : "Runtime TBA";
      const rating = movie.rating || "UA";

      const card = document.createElement("div");
      card.className = "movie-card cinematic-card";
      card.style.setProperty("--stagger", String(index));
      card.innerHTML = `
        <div class="movie-poster ${posterTheme}">
          <div class="poster-sheen"></div>
          <span class="poster-glyph">${posterGlyph}</span>
          <span class="poster-rating">${rating}</span>
          <h4>${movie.title}</h4>
        </div>
        <div class="movie-info">
          <h5>${movie.title}</h5>
          <div class="movie-meta">
            <p class="genre">${movie.genre || "Cinema"}</p>
            <p class="language">${movie.language || "English"}</p>
            <p class="runtime">${duration}</p>
          </div>
          <button class="btn btn-primary btn-block" type="button">Book Now</button>
        </div>
      `;

      card.addEventListener("click", () => selectHomeMovie(movie._id));
      const bookBtn = card.querySelector("button");
      if (bookBtn) {
        bookBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          selectHomeMovie(movie._id);
        });
      }

      grid.appendChild(card);
    }
  } catch (err) {
    console.error("Error loading home movies:", err);
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--bad);">Error loading movies</p>';
  }
}

function selectHomeMovie(movieId) {
  localStorage.setItem("selectedMovieId", movieId);
  navigate("catalog");
}

async function loadShowtimes() {
  ui.showtimes.innerHTML = skeletonRows(4);
  ensureFilterDefaults();
  const params = new URLSearchParams();
  params.set("from", state.filters.from);
  params.set("to", state.filters.to);
  if (state.filters.city) {
    params.set("cityName", state.filters.city);
  }
  const qs = `?${params.toString()}`;
  state.showtimes = await api(`/catalog/showtimes${qs}`);
  renderShowtimes();
}

async function loadSeats(showtimeId) {
  ui.seats.innerHTML = skeletonRows(6);
  const payload = await api(`/catalog/showtimes/${showtimeId}/seats`);
  renderSeats(payload.seatLayout || []);
  ui.seatMeta.textContent = "Select up to 6 seats.";
}

async function loadBookings() {
  ui.bookings.innerHTML = skeletonRows(3);
  state.bookings = await api("/bookings/me");
  renderBookings();
}

async function loadNotifications() {
  ui.notifications.innerHTML = skeletonRows(3);
  state.notifications = await api("/notifications/logs");
  renderNotifications();
}

async function refreshAll() {
  await Promise.all([loadShowtimes(), loadBookings(), loadNotifications()]);
  renderHomeInsights();
}

async function waitForBookingStatus(bookingId, expectedStatus) {
  for (let i = 0; i < 20; i += 1) {
    const bookings = await api("/bookings/me");
    const target = bookings.find((item) => item.bookingId === bookingId);
    if (target && target.status === expectedStatus) {
      return target;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Booking did not reach ${expectedStatus}`);
}

async function lockBookPay() {
  if (!state.selectedShowtime) {
    throw new Error("Select a showtime first");
  }

  if (!state.selectedSeats.length) {
    throw new Error("Select at least one seat");
  }

  const showtimeId = state.selectedShowtime._id;
  const amount = Number(state.selectedShowtime.basePrice || 0) * state.selectedSeats.length;

  await api("/bookings/locks", {
    method: "POST",
    body: { showtimeId, seatIds: state.selectedSeats },
  });
  logLine(`Seats locked: ${state.selectedSeats.join(", ")}`);

  const booking = await api("/bookings", {
    method: "POST",
    body: {
      showtimeId,
      seats: state.selectedSeats,
      amount,
      idempotencyKey: idKey("booking"),
    },
  });
  logLine(`Booking created: ${booking.bookingId}`);

  const payment = await api("/payments/intents", {
    method: "POST",
    body: {
      bookingId: booking.bookingId,
      amount,
      currency: "INR",
      idempotencyKey: idKey("payment"),
    },
  });
  logLine(`Payment intent: ${payment.paymentId}`);

  await api("/payments/webhook", {
    method: "POST",
    body: {
      paymentId: payment.paymentId,
      status: ui.paymentOutcome(),
    },
  });
  const expectedStatus = ui.paymentOutcome() === "SUCCEEDED" ? "CONFIRMED" : "CANCELLED";
  logLine(`Payment webhook sent (${ui.paymentOutcome()})`);

  await waitForBookingStatus(booking.bookingId, expectedStatus);
  logLine(`Booking moved to ${expectedStatus}: ${booking.bookingId}`);

  state.selectedSeats = [];
  renderSelectionSummary();
  await refreshAll();
  setPage("bookings");
  toast(`Booking ${expectedStatus.toLowerCase()}: ${booking.bookingId}`, "success");
}

async function cancelBooking(bookingId) {
  await api(`/bookings/${bookingId}/cancel`, { method: "POST" });
  logLine(`Cancellation requested: ${bookingId}`);

  try {
    await waitForBookingStatus(bookingId, "CANCELLED");
    logLine(`Booking cancelled: ${bookingId}`);
    toast(`Booking cancelled: ${bookingId}`, "success");
  } catch {
    logLine(`Cancellation pending for ${bookingId}. Refresh to check status.`);
    toast("Cancellation requested. Waiting for saga completion.", "info");
  }

  await loadBookings();
}

async function handleAuthSuccess(payload) {
  setSession(payload.token, payload.user);
  updateUserInfoLabel();
  syncAuthUI();

  const requestedPage = getPageFromPathname(window.location.pathname);
  if (requestedPage === "admin") {
    if (isAdminUser()) {
      setPage("admin", { updateUrl: true, replaceUrl: true });
    } else {
      setPage("home", { updateUrl: true, replaceUrl: true });
      toast("Admin access is restricted by role.", "error");
    }
  } else {
    setPage("catalog", { updateUrl: true });
  }

  logLine(`Authenticated as ${payload.user?.email || "unknown user"}`);
  toast("Welcome back. Loading dashboard...", "success");
  await refreshAll();
}

function bindEvents() {
  if (ui.tabLogin) ui.tabLogin.addEventListener("click", () => setAuthMode("login"));
  if (ui.tabSignup) ui.tabSignup.addEventListener("click", () => setAuthMode("signup"));

  for (const link of ui.pageLinks) {
    link.addEventListener("click", (event) => {
      const targetPage = link.dataset.page;
      if (!targetPage) return;

      event.preventDefault();

      if (!state.token && targetPage !== "auth" && targetPage !== "home") {
        logLine("Please login to access this page");
        toast("Please login to continue", "info");
        setPage("auth", { updateUrl: true });
        return;
      }

      if (targetPage === "admin" && !isAdminUser()) {
        toast("Admin access is restricted by role.", "error");
        setPage("home", { updateUrl: true });
        return;
      }

      setPage(targetPage, { updateUrl: true });
    });
  }

  window.addEventListener("popstate", () => {
    const targetPage = getPageFromPathname(window.location.pathname);
    if (!state.token && targetPage !== "auth" && targetPage !== "home") {
      setPage("auth", { updateUrl: false });
      return;
    }

    if (targetPage === "admin" && !isAdminUser()) {
      setPage("home", { updateUrl: false });
      return;
    }

    setPage(targetPage, { updateUrl: false });
  });

  if (ui.loginForm) {
    ui.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateLoginForm()) {
      toast("Please fix the highlighted fields.", "error");
      return;
    }
    const button = ui.loginForm.querySelector('button[type="submit"]');
    setBusy(button, true, "Signing in...");
    try {
      const payload = await api("/auth/login", {
        method: "POST",
        body: {
          email: document.getElementById("login-email").value.trim(),
          password: document.getElementById("login-password").value,
        },
      });
      await handleAuthSuccess(payload);
    } catch (error) {
      const hint = authErrorHint(error);
      logLine(`Login failed: ${hint}`);
      toast(`Login failed: ${hint}`, "error");
    } finally {
      setBusy(button, false);
    }
  });
  }

  if (ui.signupForm) {
    ui.signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateSignupForm()) {
      toast("Please fix the highlighted fields.", "error");
      return;
    }
    const button = ui.signupForm.querySelector('button[type="submit"]');
    setBusy(button, true, "Creating account...");
    try {
      const payload = await api("/auth/signup", {
        method: "POST",
        body: {
          name: document.getElementById("signup-name").value.trim(),
          email: document.getElementById("signup-email").value.trim(),
          password: document.getElementById("signup-password").value,
          city: document.getElementById("signup-city")?.value.trim() || "Bengaluru",
        },
      });
      await handleAuthSuccess(payload);
    } catch (error) {
      const hint = authErrorHint(error);
      logLine(`Signup failed: ${hint}`);
      toast(`Signup failed: ${hint}`, "error");
    } finally {
      setBusy(button, false);
    }
  });
  }

  if (ui.demoUserLogin) {
    ui.demoUserLogin.addEventListener("click", () => {
      setAuthMode("login");
      const email = document.getElementById("login-email");
      const password = document.getElementById("login-password");
      if (email) email.value = "demo.user@login.local";
      if (password) password.value = "Pass@12345";
      toast("Demo user credentials filled. Click Sign In.", "info");
    });
  }

  if (ui.demoAdminLogin) {
    ui.demoAdminLogin.addEventListener("click", () => {
      setAuthMode("login");
      const email = document.getElementById("login-email");
      const password = document.getElementById("login-password");
      if (email) email.value = "admin@demo.local";
      if (password) password.value = "Admin#12345";
      toast("Demo admin credentials filled. Click Sign In.", "info");
    });
  }

  if (ui.refreshAll) {
    ui.refreshAll.addEventListener("click", async () => {
      setBusy(ui.refreshAll, true, "Refreshing...");
      try {
        await refreshAll();
        logLine("Refreshed showtimes and bookings");
        toast("Data refreshed", "info");
      } catch (error) {
        logLine(`Refresh failed: ${error.message}`);
        toast(`Refresh failed: ${error.message}`, "error");
      } finally {
        setBusy(ui.refreshAll, false);
      }
    });
  }

  if (ui.homeSearchBtn) {
    ui.homeSearchBtn.addEventListener("click", searchMovies);
  }

  if (ui.homeSearch) {
    ui.homeSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchMovies();
      }
    });
  }

  if (ui.homeGenreFilter) {
    ui.homeGenreFilter.addEventListener("change", applyHomeFilters);
  }

  if (ui.homeLanguageFilter) {
    ui.homeLanguageFilter.addEventListener("change", applyHomeFilters);
  }

  if (ui.homeResetFilters) {
    ui.homeResetFilters.addEventListener("click", resetHomeFilters);
  }

  if (ui.guestAuthBtn) {
    ui.guestAuthBtn.addEventListener("click", () => navigate("auth"));
  }

  ui.quickActionCards.forEach((card) => {
    const targetPage = card.dataset.pageTarget;
    if (!targetPage) return;

    const openTarget = () => {
      if (!state.token) {
        toast("Please login to continue", "info");
        setPage("auth", { updateUrl: true });
        return;
      }

      if (targetPage === "admin" && !isAdminUser()) {
        toast("Admin access is restricted by role.", "error");
        setPage("home", { updateUrl: true });
        return;
      }

      setPage(targetPage, { updateUrl: true });
    };

    card.addEventListener("click", openTarget);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openTarget();
      }
    });
  });

  if (ui.runBooking) {
    ui.runBooking.addEventListener("click", async () => {
      setBusy(ui.runBooking, true, "Processing booking...");
      try {
        await lockBookPay();
      } catch (error) {
        logLine(`Booking flow failed: ${error.message}`);
        toast(`Booking flow failed: ${error.message}`, "error");
      } finally {
        setBusy(ui.runBooking, false);
      }
    });
  }

  if (ui.adminRefresh) {
    ui.adminRefresh.addEventListener("click", async () => {
      setBusy(ui.adminRefresh, true, "Refreshing...");
      try {
        await loadAdminDashboard();
        toast("Admin dashboard updated", "success");
      } catch (error) {
        toast(`Admin refresh failed: ${error.message}`, "error");
      } finally {
        setBusy(ui.adminRefresh, false);
      }
    });
  }

  if (ui.adminEditForm) {
    ui.adminEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!isAdminUser()) {
        toast("Only admin can edit details here.", "error");
        return;
      }

      setBusy(ui.adminSaveProfile, true, "Saving...");
      try {
        const updatedUser = await api("/users/me", {
          method: "PUT",
          body: {
            name: ui.adminName?.value.trim(),
            city: ui.adminCity?.value.trim(),
            phone: ui.adminPhone?.value.trim(),
          },
        });

        setSession(state.token, updatedUser);
        updateUserInfoLabel();
        populateAdminEditForm(updatedUser);
        toast("Admin details updated", "success");
      } catch (error) {
        toast(`Update failed: ${error.message}`, "error");
      } finally {
        setBusy(ui.adminSaveProfile, false);
      }
    });
  }

  if (ui.adminMovieForm) {
    ui.adminMovieForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!isAdminUser()) {
        toast("Only admin can manage movies.", "error");
        return;
      }

      const movieId = ui.adminMovieId?.value || "";
      const payload = {
        title: ui.adminMovieTitle?.value.trim(),
        durationMin: ui.adminMovieDuration?.value ? Number(ui.adminMovieDuration.value) : undefined,
        language: ui.adminMovieLanguage?.value.trim(),
        genre: ui.adminMovieGenre?.value.trim(),
        rating: ui.adminMovieRating?.value.trim(),
      };

      setBusy(ui.adminSaveMovie, true, movieId ? "Updating..." : "Creating...");
      try {
        if (movieId) {
          const updated = await api(`/catalog/movies/${movieId}`, {
            method: "PUT",
            body: payload,
          });
          state.movies = state.movies.map((item) => (item._id === movieId ? updated : item));
          toast("Movie updated", "success");
        } else {
          const created = await api("/catalog/movies", {
            method: "POST",
            body: payload,
          });
          state.movies = [created, ...state.movies];
          toast("Movie created", "success");
        }

        renderAdminMovies();
        resetMovieForm();
      } catch (error) {
        toast(`Save failed: ${error.message}`, "error");
      } finally {
        setBusy(ui.adminSaveMovie, false);
      }
    });
  }

  if (ui.adminResetMovie) {
    ui.adminResetMovie.addEventListener("click", () => {
      resetMovieForm();
      toast("Movie form cleared", "info");
    });
  }

  if (ui.adminShowtimeForm) {
    ui.adminShowtimeForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!isAdminUser()) {
        toast("Only admin can manage showtimes.", "error");
        return;
      }

      const showtimeId = ui.adminShowtimeId?.value || "";
      const payload = {
        movieId: ui.adminShowtimeMovie?.value,
        theaterId: ui.adminShowtimeTheater?.value,
        screenName: ui.adminShowtimeScreen?.value.trim(),
        startTime: fromDateTimeLocalValue(ui.adminShowtimeStart?.value),
        endTime: fromDateTimeLocalValue(ui.adminShowtimeEnd?.value),
        basePrice: ui.adminShowtimePrice?.value ? Number(ui.adminShowtimePrice.value) : undefined,
      };

      setBusy(ui.adminSaveShowtime, true, showtimeId ? "Updating..." : "Creating...");
      try {
        if (showtimeId) {
          const updated = await api(`/catalog/showtimes/${showtimeId}`, {
            method: "PUT",
            body: payload,
          });
          state.showtimes = state.showtimes.map((item) => (item._id === showtimeId ? updated : item));
          toast("Showtime updated", "success");
        } else {
          const created = await api("/catalog/showtimes", {
            method: "POST",
            body: payload,
          });
          state.showtimes = [created, ...state.showtimes];
          toast("Showtime created", "success");
        }

        await loadShowtimes();
        await loadAdminDashboard();
        resetShowtimeForm();
      } catch (error) {
        toast(`Save failed: ${error.message}`, "error");
      } finally {
        setBusy(ui.adminSaveShowtime, false);
      }
    });
  }

  if (ui.adminResetShowtime) {
    ui.adminResetShowtime.addEventListener("click", () => {
      resetShowtimeForm();
      toast("Showtime form cleared", "info");
    });
  }

  if (ui.autoRefreshToggle) {
    ui.autoRefreshToggle.addEventListener("change", () => {
      state.autoRefresh = ui.autoRefreshToggle.checked;
      persistAutoRefreshPref(state.autoRefresh);
      if (state.autoRefresh) {
        toast("Auto-refresh enabled (8s)", "info");
        startAutoRefresh();
      } else {
        toast("Auto-refresh disabled", "info");
        stopAutoRefresh();
      }
    });
  }

  if (ui.applyFilters) {
    ui.applyFilters.addEventListener("click", async () => {
      try {
        syncFilterStateFromInputs();
        await loadShowtimes();
        logLine("Applied showtime filters");
        toast("Filters applied", "info");
      } catch (error) {
        logLine(`Filter apply failed: ${error.message}`);
        toast(`Filter apply failed: ${error.message}`, "error");
      }
    });
  }

  if (ui.showtimeSearch) {
    ui.showtimeSearch.addEventListener("input", () => {
      state.showtimeQuery = ui.showtimeSearch.value;
      persistShowtimePrefs();
      renderShowtimes();
    });
  }

  if (ui.showtimeSort) {
    ui.showtimeSort.addEventListener("change", () => {
      state.showtimeSort = ui.showtimeSort.value;
      persistShowtimePrefs();
      renderShowtimes();
    });
  }

  if (ui.clearSeatSelection) {
    ui.clearSeatSelection.addEventListener("click", () => {
      state.selectedSeats = [];
      ui.seatMeta.textContent = "Selected seats: none";
      renderSelectionSummary();
      if (state.selectedShowtime) {
        loadSeats(state.selectedShowtime._id).catch(() => {});
      } else {
        ui.seats.innerHTML = "";
      }
      toast("Seat selection cleared", "info");
    });
  }

  if (ui.bookingStatusFilter) {
    ui.bookingStatusFilter.addEventListener("change", () => {
      state.bookingStatusFilter = ui.bookingStatusFilter.value;
      persistBookingFilterPref(state.bookingStatusFilter);
      renderBookings();
    });
  }

  ui.filterPresets.forEach((button) => {
    button.addEventListener("click", async () => {
      const presetName = button.dataset.preset;
      try {
        await applyPreset(presetName);
      } catch (error) {
        logLine(`Preset apply failed: ${error.message}`);
        toast(`Preset apply failed: ${error.message}`, "error");
      }
    });
  });

  if (ui.resetFilters) {
    ui.resetFilters.addEventListener("click", async () => {
      const defaults = defaultFilterWindow();
      state.filters.city = "";
      state.filters.from = defaults.from;
      state.filters.to = defaults.to;
      state.filters.preset = "custom";
      persistFilterPrefs();
      syncFilterInputsFromState();

      try {
        await loadShowtimes();
        logLine("Reset showtime filters");
        toast("Filters reset", "info");
      } catch (error) {
        logLine(`Filter reset failed: ${error.message}`);
        toast(`Filter reset failed: ${error.message}`, "error");
      }
    });
  }

  document.querySelectorAll('input[name="payment-outcome"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.paymentOutcome = input.value;
      persistPaymentOutcomePref(state.paymentOutcome);
      toast(`Payment mode: ${state.paymentOutcome}`, "info");
    });
  });

  if (ui.logout) {
    ui.logout.addEventListener("click", () => {
    clearSession();
    updateUserInfoLabel();
    state.showtimes = [];
    state.bookings = [];
    state.notifications = [];
    state.selectedShowtime = null;
    state.selectedSeats = [];
    syncAuthUI();
    setPage("auth", { updateUrl: true });
    renderShowtimes();
    renderBookings();
    renderNotifications();
    ui.seats.innerHTML = "";
    renderSelectionSummary();
    logLine("Logged out");
    toast("You have been logged out", "info");
    stopAutoRefresh();
  });
  }
}

async function bootstrap() {
  bindEvents();
  applyPaymentOutcomePreference();
  setAuthMode("login");
  clearFormErrors();
  updateStatusPill();
  syncAuthUI();
  const routePage = getPageFromPathname(window.location.pathname);
  const initialTarget =
    routePage === "auth" && state.token
      ? "home"
      : !state.token && routePage !== "auth" && routePage !== "home"
        ? "auth"
        : routePage;
  setPage(initialTarget, { updateUrl: true, replaceUrl: true });
  if (ui.autoRefreshToggle) {
    ui.autoRefreshToggle.checked = state.autoRefresh;
  }
  if (ui.showtimeSearch) {
    ui.showtimeSearch.value = state.showtimeQuery;
  }
  if (ui.showtimeSort) {
    ui.showtimeSort.value = state.showtimeSort;
  }
  if (ui.bookingStatusFilter) {
    ui.bookingStatusFilter.value = state.bookingStatusFilter;
  }
  ensureFilterDefaults();
  syncFilterInputsFromState();
  renderSelectionSummary();

  if (!state.token) {
    updateUserInfoLabel();
    syncAuthUI();
    logLine("Ready. Login or signup to begin.");
    return;
  }

  try {
    const me = await api("/users/me");
    setSession(state.token, me);
    updateUserInfoLabel();
    syncAuthUI();
    setPage(initialTarget === "auth" ? "home" : initialTarget, {
      updateUrl: true,
      replaceUrl: true,
    });
    await refreshAll();
    startAutoRefresh();
    logLine("Session restored from local storage");
  } catch {
    clearSession();
    syncAuthUI();
    setPage("auth", { updateUrl: true, replaceUrl: true });
    logLine("Session expired. Please login again.");
  }
}

bootstrap();


