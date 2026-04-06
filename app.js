const hijriMonthNames = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

const gregorianMonthNames = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const state = {
  mode: "hijri",
  selectedGregorianDate: new Date(),
  selectedHijriDate: new Date(),
  dayOffsetByMode: {
    gregorian: 0,
    hijri: 0,
  },
  hijriMonthLength: 30,
};

const daySelect = document.getElementById("daySelect");
const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const dayWheel = document.getElementById("dayWheel");
const monthWheel = document.getElementById("monthWheel");
const yearWheel = document.getElementById("yearWheel");
const weekdayText = document.getElementById("weekdayText");
const fullDateText = document.getElementById("fullDateText");
const monthNameText = document.getElementById("monthNameText");
const offsetText = document.getElementById("offsetText");
const editBtn = document.getElementById("editBtn");
const todayBtn = document.getElementById("todayBtn");
const editDialog = document.getElementById("editDialog");
const offsetInput = document.getElementById("offsetInput");
const cancelDialogBtn = document.getElementById("cancelDialogBtn");
const tabButtons = Array.from(document.querySelectorAll(".tab"));

const arabicWeekday = new Intl.DateTimeFormat("ar", { weekday: "long" });
const wheelTimers = new WeakMap();
const wheelScrollRaf = new WeakMap();
const STORAGE_KEY = "calendar_app_state_v1";

function toArabicDigits(value) {
  return new Intl.NumberFormat("ar").format(value);
}

function saveAppState() {
  const payload = {
    mode: state.mode,
    selectedGregorianDate: state.selectedGregorianDate.toISOString(),
    selectedHijriDate: state.selectedHijriDate.toISOString(),
    dayOffsetByMode: state.dayOffsetByMode,
    hijriMonthLength: state.hijriMonthLength,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadAppState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (parsed.mode === "gregorian" || parsed.mode === "hijri") {
      state.mode = parsed.mode;
    }

    const gregDate = new Date(parsed.selectedGregorianDate);
    if (!Number.isNaN(gregDate.getTime())) {
      state.selectedGregorianDate = gregDate;
    }

    const hijriDate = new Date(parsed.selectedHijriDate);
    if (!Number.isNaN(hijriDate.getTime())) {
      state.selectedHijriDate = hijriDate;
    }

    if (parsed.dayOffsetByMode && typeof parsed.dayOffsetByMode === "object") {
      if (Number.isFinite(parsed.dayOffsetByMode.gregorian)) {
        state.dayOffsetByMode.gregorian = Number(parsed.dayOffsetByMode.gregorian);
      }
      if (Number.isFinite(parsed.dayOffsetByMode.hijri)) {
        state.dayOffsetByMode.hijri = Number(parsed.dayOffsetByMode.hijri);
      }
    }

    if (parsed.hijriMonthLength === 29 || parsed.hijriMonthLength === 30) {
      state.hijriMonthLength = parsed.hijriMonthLength;
    }
  } catch {
    // Ignore corrupted storage and keep defaults.
  }
}

function getHijriParts(date) {
  return gregorianToHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function adjustDateWithOffset(baseDate, mode) {
  const adjusted = new Date(baseDate);
  adjusted.setDate(adjusted.getDate() + state.dayOffsetByMode[mode]);
  return adjusted;
}

function normalizeToUtcDay(date) {
  const normalized = createDateSafe(date.getFullYear(), date.getMonth(), date.getDate());
  return normalized.getTime();
}

function calculateDateDifferenceInDays(firstDate, secondDate) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const first = normalizeToUtcDay(firstDate);
  const second = normalizeToUtcDay(secondDate);
  return Math.round((first - second) / oneDayMs);
}

function getMonthWord(count) {
  if (count === 1) return "شهر";
  if (count === 2) return "شهرين";
  if (count <= 10) return "أشهر";
  return "شهرا";
}

function getYearWord(count) {
  if (count === 1) return "سنة";
  if (count === 2) return "سنتين";
  if (count <= 10) return "سنوات";
  return "سنة";
}

function getDayWord(count) {
  if (count === 1) return "يوم";
  if (count === 2) return "يومين";
  if (count <= 10) return "أيام";
  return "يوما";
}

function formatDifferenceAsMonthsAndDays(totalDays) {
  const absDays = Math.abs(totalDays);
  const monthLength = state.hijriMonthLength;
  const totalMonths = Math.floor(absDays / monthLength);
  const days = absDays % monthLength;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];

  if (years > 0) {
    if (years === 2) {
      parts.push("سنتين");
    } else {
      parts.push(`${toArabicDigits(years)} ${getYearWord(years)}`);
    }
  }

  if (months > 0) {
    if (months === 2) {
      parts.push("شهرين");
    } else {
      parts.push(`${toArabicDigits(months)} ${getMonthWord(months)}`);
    }
  }

  if (days > 0 || (years === 0 && months === 0)) {
    if (days === 2) {
      parts.push("يومين");
    } else {
      parts.push(`${toArabicDigits(days)} ${getDayWord(days)}`);
    }
  }

  return parts.join(" و");
}

function getDaysInGregorianMonth(year, monthIndex) {
  return createDateSafe(year, monthIndex + 1, 0).getDate();
}

function createDateSafe(year, monthIndex, day) {
  const date = new Date(0);
  date.setFullYear(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDaysInCurrentSelection() {
  if (state.mode === "gregorian") {
    const y = Number(yearSelect.value);
    const m = Number(monthSelect.value);
    return getDaysInGregorianMonth(y, m - 1);
  }
  return state.hijriMonthLength;
}

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);

  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function hijriToJdn(year, month, day) {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    1948440 -
    1
  );
}

function jdnToHijri(jdn) {
  const year = Math.floor((30 * (jdn - 1948439) + 10646) / 10631);
  const month = Math.min(
    12,
    Math.ceil((jdn - (29 + hijriToJdn(year, 1, 1))) / 29.5) + 1,
  );
  const day = jdn - hijriToJdn(year, month, 1) + 1;
  return { year, month, day };
}

function gregorianToHijri(year, month, day) {
  return jdnToHijri(gregorianToJdn(year, month, day));
}

function hijriToGregorianDate(year, month, day) {
  const g = jdnToGregorian(hijriToJdn(year, month, day));
  return createDateSafe(g.year, g.month - 1, g.day);
}

function getTodayPartsForCurrentMode() {
  const today = new Date();
  if (state.mode === "gregorian") {
    return {
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    };
  }
  return getHijriParts(today);
}

function renderWheelFromSelect(selectEl, wheelEl, fieldName) {
  const selectedValue = selectEl.value;
  const todayParts = getTodayPartsForCurrentMode();
  wheelEl.innerHTML = "";

  Array.from(selectEl.options).forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wheel-option";
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    if (option.value === selectedValue) {
      button.classList.add("selected");
    }
    if (Number(option.value) === todayParts[fieldName]) {
      button.classList.add("today");
    }
    wheelEl.appendChild(button);
  });

  syncWheelPosition(wheelEl, false);
}

function syncWheelPosition(wheelEl, smooth = true) {
  const selected = wheelEl.querySelector(".wheel-option.selected");
  if (!selected) return;
  const top = selected.offsetTop - wheelEl.clientHeight / 2 + selected.clientHeight / 2;
  wheelEl.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}

function syncAllWheels() {
  renderWheelFromSelect(daySelect, dayWheel, "day");
  renderWheelFromSelect(monthSelect, monthWheel, "month");
  renderWheelFromSelect(yearSelect, yearWheel, "year");
}

function setSelectedOptionFromWheel(wheelEl, selectEl, triggerChange) {
  const options = Array.from(wheelEl.querySelectorAll(".wheel-option"));
  if (options.length === 0) return;

  const center = wheelEl.scrollTop + wheelEl.clientHeight / 2;
  let best = options[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  options.forEach((option) => {
    const itemCenter = option.offsetTop + option.clientHeight / 2;
    const distance = Math.abs(itemCenter - center);
    if (distance < bestDistance) {
      best = option;
      bestDistance = distance;
    }
  });

  options.forEach((option) => option.classList.remove("selected"));
  best.classList.add("selected");

  const nextValue = best.dataset.value;
  const changed = selectEl.value !== nextValue;
  selectEl.value = nextValue;
  syncWheelPosition(wheelEl, false);

  if (triggerChange && changed) {
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function markNearestOptionOnly(wheelEl) {
  const options = Array.from(wheelEl.querySelectorAll(".wheel-option"));
  if (options.length === 0) return;
  const center = wheelEl.scrollTop + wheelEl.clientHeight / 2;
  let nearest = options[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  options.forEach((option) => {
    const itemCenter = option.offsetTop + option.clientHeight / 2;
    const distance = Math.abs(itemCenter - center);
    if (distance < bestDistance) {
      nearest = option;
      bestDistance = distance;
    }
  });

  options.forEach((option) => option.classList.remove("selected"));
  nearest.classList.add("selected");
}

function setupWheelEvents(wheelEl, selectEl) {
  wheelEl.addEventListener("click", (event) => {
    const clicked = event.target.closest(".wheel-option");
    if (!clicked) return;
    selectEl.value = clicked.dataset.value;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  });

  wheelEl.addEventListener("scroll", () => {
    if (!wheelScrollRaf.get(wheelEl)) {
      const rafId = requestAnimationFrame(() => {
        markNearestOptionOnly(wheelEl);
        wheelScrollRaf.delete(wheelEl);
      });
      wheelScrollRaf.set(wheelEl, rafId);
    }

    const oldTimer = wheelTimers.get(wheelEl);
    if (oldTimer) window.clearTimeout(oldTimer);

    const newTimer = window.setTimeout(() => {
      setSelectedOptionFromWheel(wheelEl, selectEl, true);
      wheelTimers.delete(wheelEl);
    }, 180);
    wheelTimers.set(wheelEl, newTimer);
  });
}

function refillDayOptions() {
  const current = Number(daySelect.value || 1);
  const maxDays = getDaysInCurrentSelection();
  daySelect.innerHTML = "";
  for (let i = 1; i <= maxDays; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = toArabicDigits(i);
    daySelect.appendChild(option);
  }
  daySelect.value = String(Math.min(current, maxDays));
  renderWheelFromSelect(daySelect, dayWheel, "day");
}

function fillMonthOptions() {
  monthSelect.innerHTML = "";
  const names = state.mode === "gregorian" ? gregorianMonthNames : hijriMonthNames;
  names.forEach((name, idx) => {
    const option = document.createElement("option");
    option.value = String(idx + 1);
    if (state.mode === "gregorian") {
      option.textContent = `${name} ${toArabicDigits(idx + 1)}`;
    } else {
      option.textContent = name;
    }
    monthSelect.appendChild(option);
  });
  renderWheelFromSelect(monthSelect, monthWheel, "month");
}

function fillYearOptions() {
  yearSelect.innerHTML = "";
  let from;
  let to;

  if (state.mode === "gregorian") {
    from = 1;
    to = 2222;
  } else {
    from = 1;
    to = 2222;
  }

  for (let y = from; y <= to; y += 1) {
    const option = document.createElement("option");
    option.value = String(y);
    option.textContent = toArabicDigits(y);
    yearSelect.appendChild(option);
  }
  renderWheelFromSelect(yearSelect, yearWheel, "year");
}

function loadSelectorsFromCurrentDate() {
  const selectedDate =
    state.mode === "gregorian" ? state.selectedGregorianDate : state.selectedHijriDate;

  if (state.mode === "gregorian") {
    yearSelect.value = String(selectedDate.getFullYear());
    monthSelect.value = String(selectedDate.getMonth() + 1);
    refillDayOptions();
    daySelect.value = String(selectedDate.getDate());
  } else {
    const hijri = getHijriParts(selectedDate);
    yearSelect.value = String(hijri.year);
    monthSelect.value = String(hijri.month);
    refillDayOptions();
    daySelect.value = String(Math.min(hijri.day, state.hijriMonthLength));
  }
}

function getDateFromSelectors() {
  const day = Number(daySelect.value);
  const month = Number(monthSelect.value);
  const year = Number(yearSelect.value);

  if (state.mode === "gregorian") {
    return createDateSafe(year, month - 1, day);
  }

  // Resolve exact Hijri date; if selected day is invalid for the month,
  // clamp to nearest valid day to keep calculation continuous.
  const maxHijriDay = state.hijriMonthLength;
  for (let tryDay = day; tryDay >= 1; tryDay -= 1) {
    if (tryDay <= maxHijriDay) {
      return hijriToGregorianDate(year, month, tryDay);
    }
  }
  return new Date(state.selectedHijriDate);
}

function renderResult() {
  const picked = getDateFromSelectors();
  const adjusted = adjustDateWithOffset(picked, state.mode);
  const hijri = getHijriParts(adjusted);
  const weekday = arabicWeekday.format(adjusted);
  const today = new Date();
  const dateDiffInDays = calculateDateDifferenceInDays(adjusted, today);

  if (state.mode === "gregorian") {
    state.selectedGregorianDate = picked;
  } else {
    state.selectedHijriDate = picked;
  }

  weekdayText.textContent = weekday;
  if (state.mode === "hijri") {
    fullDateText.textContent = `${toArabicDigits(adjusted.getFullYear())}/${toArabicDigits(
      adjusted.getMonth() + 1,
    )}/${toArabicDigits(adjusted.getDate())}`;
    monthNameText.textContent = gregorianMonthNames[adjusted.getMonth()] || "-";
  } else {
    fullDateText.textContent = `${toArabicDigits(hijri.year)}/${toArabicDigits(hijri.month)}/${toArabicDigits(hijri.day)}`;
    monthNameText.textContent = hijriMonthNames[hijri.month - 1] || "-";
  }
  const diffText = formatDifferenceAsMonthsAndDays(dateDiffInDays);
  if (dateDiffInDays < 0) {
    offsetText.textContent = `مضى ${diffText}`;
  } else if (dateDiffInDays > 0) {
    offsetText.textContent = `متبقي ${diffText}`;
  } else {
    offsetText.textContent = "اليوم";
  }
}

function setupSelectors() {
  fillYearOptions();
  fillMonthOptions();
  loadSelectorsFromCurrentDate();
  syncAllWheels();
  renderResult();
}

function switchMode(mode) {
  state.mode = mode;
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
  setupSelectors();
  saveAppState();
}

function resetToToday() {
  const now = new Date();
  state.selectedGregorianDate = new Date(now);
  state.selectedHijriDate = new Date(now);
  setupSelectors();
  saveAppState();
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});

monthSelect.addEventListener("change", () => {
  refillDayOptions();
  renderResult();
  saveAppState();
});
yearSelect.addEventListener("change", () => {
  refillDayOptions();
  renderResult();
  saveAppState();
});
daySelect.addEventListener("change", () => {
  renderResult();
  saveAppState();
});

setupWheelEvents(dayWheel, daySelect);
setupWheelEvents(monthWheel, monthSelect);
setupWheelEvents(yearWheel, yearSelect);

editBtn.addEventListener("click", () => {
  offsetInput.value = String(state.dayOffsetByMode[state.mode]);
  const target = document.querySelector(`input[name="monthLength"][value="${state.hijriMonthLength}"]`);
  if (target) target.checked = true;
  const monthLengthInputs = document.querySelectorAll('input[name="monthLength"]');
  monthLengthInputs.forEach((input) => {
    input.disabled = state.mode !== "hijri";
  });
  editDialog.showModal();
});

todayBtn.addEventListener("click", () => {
  resetToToday();
});

cancelDialogBtn.addEventListener("click", () => {
  editDialog.close();
});

editDialog.addEventListener("close", () => {
  refillDayOptions();
  renderResult();
});

editDialog.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.dayOffsetByMode[state.mode] = Number(offsetInput.value || 0);
  if (state.mode === "hijri") {
    const selectedMonthLength = document.querySelector('input[name="monthLength"]:checked');
    state.hijriMonthLength = Number(selectedMonthLength?.value || 30);
  }
  saveAppState();
  editDialog.close();
});

loadAppState();
switchMode(state.mode);
