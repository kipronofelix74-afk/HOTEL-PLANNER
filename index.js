const API_URL = "db.json";
const ROOM_MULTIPLIERS = { standard: 1, deluxe: 1.3, suite: 1.8 };

let hotels = [];
let selectedHotel = null;

// ---------- DOM references ----------
const hotelList = document.getElementById("hotel-list");
const bookingsList = document.getElementById("bookings-list");
const loading = document.getElementById("loading");
const alertArea = document.getElementById("alert-area");
const searchInput = document.getElementById("search");
const cityFilter = document.getElementById("city-filter");
const priceFilter = document.getElementById("price-filter");
const priceValue = document.getElementById("price-value");
const sortSelect = document.getElementById("sort");
const selectedHotelText = document.getElementById("selected-hotel");
const form = document.getElementById("plan-form");
const saveBtn = document.getElementById("save-btn");
const estimate = document.getElementById("estimate");
const checkIn = document.getElementById("check-in");
const checkOut = document.getElementById("check-out");
const guestsInput = document.getElementById("guests");
const roomType = document.getElementById("room-type");

// ---------- Helpers ----------
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

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

// Wrapper around fetch with friendly error messages
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
  // DELETE returns an empty-ish JSON object, so guard parsing
  return response.json().catch(() => ({}));
}

// ---------- GET: hotels ----------
async function loadHotels() {
  loading.classList.remove("d-none");
  try {
    hotels = await request("/hotels");
    populateCities();
    renderHotels();
  } catch (error) {
    hotelList.innerHTML = "";
    showAlert(error.message);
  } finally {
    loading.classList.add("d-none");
  }
}

function populateCities() {
  const cities = [...new Set(hotels.map((h) => h.city))].sort();
  cityFilter.innerHTML =
    `<option value="all">All cities</option>` +
    cities.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function getVisibleHotels() {
  const term = searchInput.value.trim().toLowerCase();
  const city = cityFilter.value;
  const maxPrice = Number(priceFilter.value);

  let result = hotels.filter((h) => {
    const matchesTerm =
      !term ||
      h.name.toLowerCase().includes(term) ||
      h.amenities.some((a) => a.toLowerCase().includes(term));
    const matchesCity = city === "all" || h.city === city;
    return matchesTerm && matchesCity && h.pricePerNight <= maxPrice;
  });

  switch (sortSelect.value) {
    case "price-asc":
      result.sort((a, b) => a.pricePerNight - b.pricePerNight);
      break;
    case "price-desc":
      result.sort((a, b) => b.pricePerNight - a.pricePerNight);
      break;
    case "rating":
      result.sort((a, b) => b.rating - a.rating);
      break;
  }
  return result;
}

function renderHotels() {
  const visible = getVisibleHotels();
  if (visible.length === 0) {
    hotelList.innerHTML = `<div class="col-12"><div class="alert alert-info">No hotels match your filters. Try widening your search.</div></div>`;
    return;
  }

  hotelList.innerHTML = visible
    .map(
      (h) => `
    <div class="col-md-6">
      <div class="card hotel-card ${selectedHotel && selectedHotel.id === h.id ? "selected" : ""}">
        <div class="hotel-banner">${h.emoji}</div>
        <div class="card-body">
          <div class="d-flex justify-content-between">
            <h3 class="h6 mb-1">${escapeHtml(h.name)}</h3>
            <span class="badge bg-warning text-dark">★ ${h.rating}</span>
          </div>
          <p class="text-muted small mb-2">${escapeHtml(h.city)}</p>
          <p class="small">${escapeHtml(h.description)}</p>
          <div class="mb-3">
            ${h.amenities.map((a) => `<span class="badge bg-light text-dark border amenity">${escapeHtml(a)}</span>`).join(" ")}
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <strong>$${h.pricePerNight}<small class="text-muted fw-normal"> / night</small></strong>
            <button class="btn btn-outline-primary btn-sm" data-plan="${h.id}">Plan stay</button>
          </div>
        </div>
      </div>
    </div>`
    )
    .join("");
}

// ---------- Planner ----------
function selectHotel(id) {
  selectedHotel = hotels.find((h) => h.id === id) || null;
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
  const total = nights * selectedHotel.pricePerNight * ROOM_MULTIPLIERS[roomType.value] * rooms;
  return { nights, rooms, total: Math.round(total) };
}

function updateEstimate() {
  const result = calculateTotal();
  estimate.textContent = result
    ? `Estimated total: $${result.total} (${result.nights} night${result.nights > 1 ? "s" : ""}, ${result.rooms} room${result.rooms > 1 ? "s" : ""})`
    : "Estimated total: —";
}

function validateForm() {
  const name = document.getElementById("guest-name").value.trim();
  if (!selectedHotel) return "Please choose a hotel first.";
  if (!name) return "Please enter your name.";
  if (!checkIn.value || !checkOut.value) return "Please select both check-in and check-out dates.";
  if (checkIn.value < today()) return "Check-in date cannot be in the past.";
  if (nightsBetween(checkIn.value, checkOut.value) <= 0) return "Check-out must be after check-in.";
  const guests = Number(guestsInput.value);
  if (!Number.isInteger(guests) || guests < 1 || guests > 10) return "Guests must be between 1 and 10.";
  return null;
}
async function saveBooking(event) {
  event.preventDefault();
  const problem = validateForm();
  if (problem) {
    showAlert(problem, "warning");
    return;
  }

  const { nights, rooms, total } = calculateTotal();
  const booking = {
    hotelId: selectedHotel.id,
    hotelName: selectedHotel.name,
    city: selectedHotel.city,
    guestName: document.getElementById("guest-name").value.trim(),
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    guests: Number(guestsInput.value),
    roomType: roomType.value,
    notes: document.getElementById("notes").value.trim(),
    nights,
    rooms,
    total,
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
      </di
    </div>`v>
    )
    .join("");
}

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
  if (btn) selectHotel(Number(btn.dataset.plan));
});
bookingsList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delete]");
  if (btn) deleteBooking(btn.dataset.delete);
});
searchInput.addEventListener("input", renderHotels);
[checkIn, checkOut, guestsInput, roomType].forEach((el) =>
  el.addEventListener("change", updateEstimate)
);

form.addEventListener("submit", saveBooking);

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
checkIn.min = today();
checkOut.min = today();
loadHotels();
loadBookings();