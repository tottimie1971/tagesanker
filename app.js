const STORAGE_KEY = "tagesanker.v1";
const DATABASE_NAME = "tagesanker";
const DATABASE_VERSION = 1;
const tips = [
  ["Klein anfangen zählt.", "Mach den ersten Schritt so klein, dass du ihn auch an einem zähen Tag schaffen kannst."],
  ["Pausen sind Teil des Plans.", "Eine Pause muss nicht verdient werden. Sie hilft deinem Kopf, wieder Platz zu bekommen."],
  ["Weniger ist ein echter Plan.", "Streich oder verschieb eine Aufgabe, wenn der Tag voller ist als gedacht."],
  ["Mach den nächsten Schritt sichtbar.", "Leg bereit, was du brauchst, oder notiere nur die allererste Handlung."],
  ["Ein Neustart ist jederzeit möglich.", "Du musst nicht auf morgen warten. Fang dort wieder an, wo du gerade bist."]
];
const responses = {
  overwhelmed: "Das klingt nach zu vielen offenen Dingen. Such dir nur eine Aufgabe aus oder teile sie in einen winzigen ersten Schritt.",
  distracted: "Ablenkung passiert. Wenn es geht, entferne eine Sache aus deiner Umgebung und bleib für zwei Minuten bei nur einem Schritt.",
  tired: "Wenig Energie ist eine wichtige Information. Mach die Aufgabe kleiner, wähle etwas Leichtes oder gönn dir erst eine Pause."
};

const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const dateLabel = document.querySelector("#today-label");
const tasksByTime = document.querySelector("#timed-tasks");
const flexibleTasks = document.querySelector("#flexible-tasks");
const responsePanel = document.querySelector("#support-response");
const toast = document.querySelector("#toast");

function defaultState() {
  return {
    points: 0,
    tasks: [
      { id: crypto.randomUUID(), date: todayKey, time: "09:00", title: "In Ruhe in den Tag starten", done: false, earned: false },
      { id: crypto.randomUUID(), date: todayKey, time: "", title: "Eine Sache beginnen, die mir wichtig ist", done: false, earned: false }
    ]
  };
}

function normalizeState(saved) {
  if (!saved || !Array.isArray(saved.tasks)) return defaultState();
  return { points: Number(saved.points) || 0, tasks: saved.tasks };
}

function loadLegacyState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch { /* Start with a fresh plan if saved data is unavailable. */ }
  return defaultState();
}

let state = loadLegacyState();
let tipIndex = Math.floor(Math.random() * tips.length);
let toastTimeout;
let timerInterval;
let installPrompt;
let database;
let storageReady;
let persistentStorage = false;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore("app");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readDatabaseState() {
  return new Promise((resolve, reject) => {
    const request = database.transaction("app", "readonly").objectStore("app").get("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeDatabaseState() {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("app", "readwrite");
    transaction.objectStore("app").put(state, "state");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function initializeStorage() {
  try {
    if (!("indexedDB" in window)) throw new Error("IndexedDB nicht verfügbar");
    database = await openDatabase();
    const saved = await readDatabaseState();
    if (saved) state = normalizeState(saved);
    else await writeDatabaseState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (navigator.storage?.persist) persistentStorage = await navigator.storage.persist();
    updateStorageStatus();
  } catch {
    database = null;
    updateStorageStatus();
  }
}

function updateStorageStatus() {
  document.querySelector("#storage-status").textContent = persistentStorage
    ? "Dauerhaft auf diesem Gerät gespeichert"
    : database ? "Auf diesem Gerät gespeichert" : "Im Browser gespeichert";
}

async function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    document.querySelector("#storage-status").textContent = "Speichern derzeit nicht verfügbar";
    return;
  }
  if (database) {
    try { await writeDatabaseState(); } catch { database = null; }
  }
  updateStorageStatus();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 3200);
}

function taskMarkup(task) {
  const time = task.time ? escapeHtml(task.time) : "Flexibel";
  const reward = task.earned ? '<span class="task-reward">+10 Punkte gesammelt</span>' : "";
  return `<article class="task-row${task.done ? " is-done" : ""}">
    <span class="task-time">${time}</span>
    <div class="task-main"><span class="task-title">${escapeHtml(task.title)}</span>${reward}</div>
    <div class="task-actions">
      <button class="task-toggle" type="button" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-label="${task.done ? "Als offen markieren" : "Als erledigt markieren"}" aria-pressed="${task.done}">${task.done ? "✓" : ""}</button>
      <button class="task-delete" type="button" data-action="delete" data-id="${escapeHtml(task.id)}" aria-label="Aufgabe entfernen" title="Aufgabe entfernen">×</button>
    </div>
  </article>`;
}

function render() {
  const todayTasks = state.tasks.filter((task) => task.date === todayKey);
  const timed = todayTasks.filter((task) => task.time).sort((a, b) => a.time.localeCompare(b.time));
  const flexible = todayTasks.filter((task) => !task.time);
  const renderGroup = (element, tasks, emptyText) => {
    element.innerHTML = tasks.length ? tasks.map(taskMarkup).join("") : `<p class="empty-list">${emptyText}</p>`;
  };
  renderGroup(tasksByTime, timed, "Noch keine Aufgaben mit Uhrzeit.");
  renderGroup(flexibleTasks, flexible, "Hier ist Platz für alles, was ohne feste Zeit passieren darf.");
  const done = todayTasks.filter((task) => task.done).length;
  const percent = todayTasks.length ? Math.round((done / todayTasks.length) * 100) : 0;
  document.querySelector("#progress-label").textContent = `${done} von ${todayTasks.length} erledigt`;
  document.querySelector("#progress-fill").style.width = `${percent}%`;
  document.querySelector("#progress-note").textContent = done === todayTasks.length && done > 0
    ? "Du hast deinen Plan bewegt. Was jetzt gut tut, entscheidest du."
    : "Du kannst Aufgaben jederzeit anpassen.";
  document.querySelector("#points-total").textContent = String(state.points);
}

function setTip(index) {
  tipIndex = (index + tips.length) % tips.length;
  document.querySelector("#tip-heading").textContent = tips[tipIndex][0];
  document.querySelector("#tip-copy").textContent = tips[tipIndex][1];
}

dateLabel.textContent = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(today);
render();
storageReady = initializeStorage();

document.querySelector("#task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await storageReady;
  const form = new FormData(event.currentTarget);
  const title = String(form.get("title") || "").trim();
  if (!title) return;
  state.tasks.push({ id: crypto.randomUUID(), date: todayKey, time: String(form.get("time") || ""), title, done: false, earned: false });
  await saveState();
  render();
  event.currentTarget.reset();
  document.querySelector("#task-title").focus();
  showToast("Aufgabe hinzugefügt. Du kannst sie jederzeit ändern.");
});

document.querySelector(".task-groups").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  await storageReady;
  const task = state.tasks.find((item) => item.id === button.dataset.id);
  if (!task) return;
  if (button.dataset.action === "delete") {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
  } else {
    task.done = !task.done;
    if (task.done && !task.earned) {
      task.earned = true;
      state.points += 10;
      showToast("Erledigt. 10 Punkte für deinen Schritt!");
    }
  }
  await saveState();
  render();
});

document.querySelector("#new-tip-button").addEventListener("click", () => setTip(tipIndex + 1));

document.querySelector(".need-options").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-need]");
  if (!button) return;
  document.querySelectorAll(".need-option").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
  document.querySelector("#response-copy").textContent = responses[button.dataset.need];
  responsePanel.hidden = false;
  document.querySelector("#timer").hidden = true;
});

document.querySelector("#two-minute-button").addEventListener("click", (event) => {
  clearInterval(timerInterval);
  const button = event.currentTarget;
  const timer = document.querySelector("#timer");
  let remaining = 120;
  button.disabled = true;
  button.textContent = "Läuft …";
  timer.hidden = false;
  const update = () => {
    timer.textContent = remaining > 0 ? `Zwei Minuten für deinen Schritt: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "Zeit ist um. Gut, dass du angefangen hast. Du kannst weitergehen oder hier aufhören.";
    if (remaining <= 0) {
      clearInterval(timerInterval);
      button.disabled = false;
      button.textContent = "Noch einmal starten";
    }
    remaining -= 1;
  };
  update();
  timerInterval = setInterval(update, 1000);
});

const checkinButton = document.querySelector("#checkin-button");
checkinButton.addEventListener("click", () => {
  const active = checkinButton.getAttribute("aria-pressed") !== "true";
  checkinButton.setAttribute("aria-pressed", String(active));
  const feedback = document.querySelector("#checkin-feedback");
  feedback.hidden = !active;
  feedback.textContent = active
    ? "Danke, dass du es bemerkst. Du musst nichts erklären. Vielleicht hilft ein kleiner Schritt, eine Pause oder Kontakt zu einer vertrauten Person."
    : "Alles klar. Du kannst jederzeit wieder einchecken.";
  document.querySelector("#checkin-label").textContent = active ? "Ich habe eingecheckt" : "Ich ziehe mich gerade eher zurück";
});

function scheduleReminder(reminderAt) {
  const delay = Math.max(0, reminderAt - Date.now());
  setTimeout(() => {
    if (Number(localStorage.getItem("tagesanker.reminder")) !== reminderAt) return;
    const message = "Kurzer Check-in: Was wäre jetzt hilfreich? Eine Aufgabe, eine Pause oder Unterstützung?";
    showToast(message);
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("Tagesanker", { body: message, icon: "icon.svg" });
    }
    localStorage.removeItem("tagesanker.reminder");
  }, delay);
}

document.querySelector("#reminder-button").addEventListener("click", async () => {
  const reminderAt = Date.now() + 30 * 60 * 1000;
  localStorage.setItem("tagesanker.reminder", String(reminderAt));
  scheduleReminder(reminderAt);
  showToast("Erinnerung gespeichert. Sie erscheint, wenn die App wieder geöffnet ist.");
  if ("Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* In-app reminder remains available. */ }
  }
});

const savedReminder = Number(localStorage.getItem("tagesanker.reminder"));
if (savedReminder) scheduleReminder(savedReminder);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#install-button").hidden = false;
});
document.querySelector("#install-button").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.querySelector("#install-button").hidden = true;
});

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    document.querySelector("#storage-status").textContent = "Offline-Installation nicht verfügbar";
  });
}