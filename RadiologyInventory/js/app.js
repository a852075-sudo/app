import { createUI } from "./ui.js";

const now = new Date();
const state = {
  roomId: null,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  viewMode: readViewMode()
};

let deferredInstallPrompt = null;
const installBtn = document.querySelector("#installBtn");

const ui = createUI(state, {
  openRoom(roomId) {
    state.roomId = roomId;
    history.pushState({ roomId }, "", `#/${roomId}`);
    ui.render();
  },
  setMonth(month) {
    state.month = month;
    ui.render();
  },
  changeYear(delta) {
    state.year += delta;
    ui.render();
  },
  setViewMode(mode) {
    state.viewMode = mode;
    localStorage.setItem("radiology_inventory_view_mode", mode);
    ui.render();
  }
});

document.querySelector("#backBtn").addEventListener("click", () => {
  state.roomId = null;
  history.pushState({}, "", location.pathname);
  ui.render();
});

document.querySelector("#settingsBtn").addEventListener("click", () => ui.openSettings());
document.querySelector("#syncBtn").addEventListener("click", () => ui.syncCurrentRoom());

window.addEventListener("popstate", () => {
  state.roomId = location.hash.replace("#/", "") || null;
  ui.render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.classList.remove("is-hidden");
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.classList.add("is-hidden");
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, .app-card");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height);
  ripple.className = "ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
  target.append(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("./sw.js");
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          const toast = document.querySelector("#toast");
          toast.textContent = "新版本已快取，重新開啟即可更新";
          toast.classList.add("show");
          setTimeout(() => toast.classList.remove("show"), 3600);
        }
      });
    });
  });
}

state.roomId = location.hash.replace("#/", "") || null;
ui.render();

function readViewMode() {
  try {
    return localStorage.getItem("radiology_inventory_view_mode") || "mobile";
  } catch {
    return "mobile";
  }
}
