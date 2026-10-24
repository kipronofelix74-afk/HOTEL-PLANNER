const API_URL = "json-server --watch db.json --port 3000";
const ROOM_MULTIPLIERS = {
  standard: 1,
  deluxe: 1.3, 
  suite: 1.8, 
};
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

let hotels = [];
let selectedHotel = null;

const hotelList = document.getElementById("hotel-list");
const bookingsList = document.getElementById("bookings-list");
const loading = document.getElementById("loading");
const alertArea = document.getElementById("alert-area");
const searchInput = document.getElementById("search");
const cityFilter = document.getElementById("city-filter");
const priceFilter = document.getElementById("price-filter");
const selectedHotelText = document.getElementById("selected-hotel");
const checkIn = document.getElementById("check-in");
const checkOut = document.getElementById("check-out");
const guestsInput = document.getElementById("guests");
const roomType = document.getElementById("room-type");
const estimate = document.getElementById("estimate");
const estimatedTotal = document.getElementById("estimatedTotal");
const form = document.getElementById("plan-form");
const sortSelect = document.getElementById("sort");
const priceValue = document.getElementById("price-value");
const saveBtn =document.getElementById("save-btn");

const guestNameInput = document.getElementById("guest-name");
const notesInput = document.getElementById("notes");
function showAlert(message, type = "danger") {
  alertArea.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;

  alertArea.querySelector(".btn-close").addEventListener("click", () => {
    alertArea.innerHTML = "";
  });
  if (type === "success") {
    setTimeout(() => (alertArea.innerHTML = ""), 4000);
  }
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function nightsBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    throw new Error(
      "Cannot reach the server. Make sure the API is running (npm run api) and try again."
    );
  }
  if (!response.ok) {
    throw new Error(`The server returned an error (status ${response.status}). Please try again.`);
  }
  return response.json().catch(() => ({}));
}

async function loadHotels() {
  loading.classList.remove("d-none");
  try {
    hotels = await request("/hotels");
    populateAvailableCities();
    renderHotels();
  } catch (error) {
    hotelList.innerHTML = "";
    showAlert(error.message);
  } finally {
    loading.classList.add("d-none");
  }
}

function populateAvailableCities() {
  const cities = [...new Set(hotels.map((h) => h.city))].sort();
  cityFilter.innerHTML =
    `<option value="all">All cities</option>` +
    cities.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function getVisibleHotels() {
  const term = searchInput.value.trim().toLowerCase();
  const city = cityFilter.value;
  const maxPrice = Number(priceFilter.value) || Infinity;

  const result = hotels.filter((h) => {
    const matchesTerm =
      !term ||
      h.name.toLowerCase().includes(term) ||
      (h.amenities || []).some((a) => a.toLowerCase().includes(term));
    const matchesCity = city === "all" || h.city === city;
    return matchesTerm && matchesCity && h.pricePerNight <= maxPrice;
  });

  const sort = sortSelect.value;
  if (sort === "price-asc") result.sort((a, b) => a.pricePerNight - b.pricePerNight);
  if (sort === "price-desc") result.sort((a, b) => b.pricePerNight - a.pricePerNight);
  if (sort === "rating") result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return result;
}

function renderHotels() {
  const visible = getVisibleHotels();
  if (visible.length === 0) {
    hotelList.innerHTML = `<div class="col-12"><div class="alert alert-info">No hotels match your filters. Try widening your search.</div></div>`;
    return;
  }

  hotelList.innerHTML = visible
    .map((h) => {
      const isSelected = selectedHotel && String(selectedHotel.id) === String(h.id);
      return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 ${isSelected ? "border-primary" : ""}">
          <div class="card-body">
            <h3 class="h6">${escapeHtml(h.name)} <small class="text-muted">· ${escapeHtml(h.city)}</small></h3>
            <p class="small mb-1">$${h.pricePerNight}/night</p>
            <p class="small text-muted mb-2">${(h.amenities || []).map(escapeHtml).join(", ")}</p>
            <button class="btn btn-primary btn-sm" data-plan="${h.id}">
              ${isSelected ? "Selected" : "Plan a stay"}
            </button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

// ---------- Planner ----------
function selectHotel(id) {
  selectedHotel = hotels.find((h) => String(h.id) === String(id)) || null;
  if (!selectedHotel) return;
  selectedHotelText.innerHTML = `<strong>${escapeHtml(selectedHotel.name)}</strong> · ${escapeHtml(selectedHotel.city)} · $${selectedHotel.pricePerNight}/night`;
  saveBtn.disabled = false;
  renderHotels();
  updateEstimate();
  document.getElementById("planner").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function calculateTotal() {
  if (!selectedHotel || !checkIn.value || !checkOut.value) return null;
  const nights = nightsBetween(checkIn.value, checkOut.value);
  const guests = Number(guestsInput.value);
  if (nights <= 0 || !guests || guests < 1) return null;
  const rooms = Math.ceil(guests / 2);
  const multiplier = ROOM_MULTIPLIERS[roomType.value] ?? 1;
  const total = nights * selectedHotel.pricePerNight * multiplier * rooms;
  return { nights, rooms, total: Math.round(total) };
}

function updateEstimate() {
  const result = calculateTotal();
  estimate.textContent = result
    ? `Estimated total: $${result.total} (${result.nights} night${result.nights > 1 ? "s" : ""}, ${result.rooms} room${result.rooms > 1 ? "s" : ""})`
    : "Estimated total: —";
}

function validateForm() {
  if (!selectedHotel) return "Please pick a hotel first.";
  if (guestNameInput && !guestNameInput.value.trim()) return "Please enter the guest name.";
  if (!checkIn.value || !checkOut.value) return "Please choose check-in and check-out dates.";
  if (checkIn.value < today()) return "Check-in cannot be in the past.";
  if (nightsBetween(checkIn.value, checkOut.value) <= 0) return "Check-out must be after check-in.";
  if (!Number(guestsInput.value) || Number(guestsInput.value) < 1) return "Guests must be at least 1.";
  return null;
}
async function saveBooking(event) {
  event.preventDefault();
  const problem = validateForm();
  if (problem) {
    showAlert(problem, "warning");
    return;
  }

  const calc = calculateTotal();
  const booking = {
    hotelId: selectedHotel.id,
    hotelName: selectedHotel.name,
    city: selectedHotel.city,
    guestName: guestNameInput ? guestNameInput.value.trim() : "",
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    nights: calc.nights,
    guests: Number(guestsInput.value),
    rooms: calc.rooms,
    roomType: roomType.value,
    notes: notesInput ? notesInput.value.trim() : "",
    total: calc.total,
  };

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    await request("/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    showAlert(`Stay at ${booking.hotelName} saved!`, "success");
    form.reset();
    guestsInput.value = 2;
    updateEstimate();
    await loadBookings();
  } catch (error) {
    showAlert(error.message);
  } finally {
    saveBtn.disabled = !selectedHotel;
    saveBtn.textContent = "Save planned stay";
  }
}

async function loadBookings() {
  try {
    const bookings = await request("/bookings");
    renderBookings(bookings);
  } catch (error) {
    bookingsList.innerHTML = "";
    showAlert(error.message);
  }
}

function renderBookings(bookings) {
  if (bookings.length === 0) {
    bookingsList.innerHTML = `<div class="col-12"><p class="text-muted">No stays planned yet. Pick a hotel to get started.</p></div>`;
    return;
  }
  bookingsList.innerHTML = bookings
    .map(
      (b) => `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <h3 class="h6">${escapeHtml(b.hotelName)} <small class="text-muted">· ${escapeHtml(b.city)}</small></h3>
          <p class="small mb-1">👤 ${escapeHtml(b.guestName)} · ${b.guests} guest${b.guests > 1 ? "s" : ""}</p>
          <p class="small mb-1">📅 ${escapeHtml(b.checkIn)} → ${escapeHtml(b.checkOut)} (${b.nights} nights)</p>
          <p class="small mb-1">🛏️ ${escapeHtml(b.roomType)} × ${b.rooms}</p>
          ${b.notes ? `<p class="small text-muted mb-1">📝 ${escapeHtml(b.notes)}</p>` : ""}
          <div class="d-flex justify-content-between align-items-center mt-2">
            <strong>$${b.total}</strong>
            <button class="btn btn-outline-danger btn-sm" data-delete="${b.id}">Remove</button>
          </div>
        </div>
      </div>
    </div>`
    )
    .join("");
}

// ---------- DELETE ----------
async function deleteBooking(id) {
  try {
    await request(`/bookings/${id}`, { method: "DELETE" });
    showAlert("Planned stay removed.", "success");
    await loadBookings();
  } catch (error) {
    showAlert(error.message);
  }
}


hotelList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-plan]");
  if (btn) selectHotel(btn.dataset.plan);
});
bookingsList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delete]");
  if (btn) deleteBooking(btn.dataset.delete);
});
searchInput.addEventListener("input", renderHotels);
cityFilter.addEventListener("change", renderHotels);
priceFilter.addEventListener("input", () => {
  priceValue.textContent = priceFilter.value;
  renderHotels();
});
document.addEventListener("DOMContentLoaded", () => {
  const checkIn = document.getElementById("checkIn");
  const checkOut = document.getElementById("checkOut");
  const nightlyPrice = document.getElementById("nightlyPrice");
  const stayNights = document.getElementById("stayNights");

  const estimatedTotal = document.getElementById("estimatedTotal");

  if (!checkIn || !checkOut || !nightlyPrice ||
      !stayNights || !estimatedTotal) {
    console.error("Hotel price calculator: required HTML elements are missing.");
    return;
  }

  const money = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2
  });

  // Use UTC dates to avoid daylight-saving and time-zone
  // differences affecting the number of nights.
  function parseDate(value) {
    if (!value) return null;

    const date = new Date(`${value}T00:00:00Z`);

    return Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
      ? null
      : date;
  }

  function calculateTotal() {
    const start = parseDate(checkIn.value);
    const end = parseDate(checkOut.value);
    const price = nightlyPrice.value.trim() === ""
      ? NaN
      : Number(nightlyPrice.value);

    // Clear the estimate until valid details are provided.
    estimatedTotal.textContent = "Estimated total: —";

    if (!start || !end) {
      stayNights.textContent =
        "Select check-in and check-out dates.";
      return;
    }

    if (end <= start) {
      stayNights.textContent =
        "Check-out must be after check-in.";
      return;
    }

    const nights = Math.round(
      (end.getTime() - start.getTime()) / 86400000
    );

    stayNights.textContent =
      `${nights} night${nights === 1 ? "" : "s"}`;

    if (!Number.isFinite(price) || price < 0) {
      stayNights.textContent +=
        " — enter a valid nightly price.";
      return;
    }

    const total = nights * price;

    estimatedTotal.textContent =
      `Estimated total: ${money.format(total)}`;
  }

  [checkIn, checkOut, nightlyPrice].forEach(input => {
    input.addEventListener("input", calculateTotal);
    input.addEventListener("change", calculateTotal);
  });
  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  checkIn.min = localToday;

  checkIn.addEventListener("change", () => {
    checkOut.min = checkIn.value || localToday;

    if (checkOut.value && checkOut.value <= checkIn.value) {
      checkOut.value = "";
    }

    calculateTotal();
  });

  checkOut.min = checkIn.value || localToday;
  calculateTotal();
});
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
checkIn.min = today();
checkOut.min = today();
loadHotels();
loadBookings();