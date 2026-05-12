/* ================================================================
   pokok/skrip/utama.js — TKJ XI-9 | Main Entry Point (ESM)
   Optimized for Astro - Zero Injection UI
   ================================================================ */
"use strict";

import { mulaiTema, pasangPendengarTema } from "./tema.js";
import { tampilkanStatusKanvasJaringan, aturStatusKanvas, ambilStatusKanvas } from "./kanvas.js";
import { inisialisasiAudio, tampilkanStatusAudio, aturStatusAudio, ambilStatusAudio } from "./audio.js";
import { 
  initReveal, 
  mulaiProgresGulir, 
  mulaiKodeRahasia, 
  initProgressBar, 
  mulaiJam, 
  showNotification,
  enableFocusTrap,
  disableFocusTrap
} from "./alat.js";

document.addEventListener("DOMContentLoaded", () => {
  inisialisasiUtama();
});

function inisialisasiUtama() {
  // 1. Theme
  mulaiTema();
  pasangPendengarTema();

  // 2. Canvas
  tampilkanStatusKanvasJaringan();
  const btnKanvas = document.getElementById("tombol-kanvas");
  if (btnKanvas) {
    btnKanvas.addEventListener("click", () => {
      const enabled = !ambilStatusKanvas();
      aturStatusKanvas(enabled);
      tampilkanStatusKanvasJaringan();
    });
  }

  // 3. Audio
  inisialisasiAudio();
  const btnAudio = document.getElementById("tombol-audio");
  if (btnAudio) {
    btnAudio.addEventListener("click", () => {
      const enabled = !ambilStatusAudio();
      aturStatusAudio(enabled);
      tampilkanStatusAudio();
    });
  }

  // 4. Global UI
  initHamburger();
  initReveal();
  mulaiProgresGulir();
  mulaiKodeRahasia();
  initProgressBar();
  mulaiJam();
  initBackToTop();
  initNetworkStatus();
  initLogoLightbox();
  initKeyboardShortcuts();

  console.log("🚀 TKJ XI-9 (Astro) Initialized");
}

function initHamburger() {
  const btn = document.getElementById("hamburger-tombol");
  const menu = document.getElementById("menu-navigasi");
  const overlay = document.getElementById("menu-overlay");
  if (!btn || !menu || !overlay) return;

  function toggle() {
    const active = btn.classList.toggle("aktif");
    menu.classList.toggle("terbuka");
    overlay.classList.toggle("terbuka");
    btn.setAttribute("aria-expanded", active);
    document.body.style.overflow = active ? "hidden" : "";
    if (active) enableFocusTrap(menu); else disableFocusTrap();
  }

  btn.addEventListener("click", toggle);
  overlay.addEventListener("click", toggle);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("terbuka")) toggle();
  });
}

function initBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  window.addEventListener("scroll", () => btn.classList.toggle("terlihat", window.scrollY > 300), { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function initNetworkStatus() {
  const badge = document.getElementById("offline-badge");
  if (!badge) return;
  const update = () => badge.classList.toggle("terlihat", !navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function initLogoLightbox() {
  const logo = document.getElementById("brand-logo");
  const lightbox = document.getElementById("logo-jendela");
  const closeBtn = document.getElementById("tutup-logo-jendela");
  if (!logo || !lightbox || !closeBtn) return;

  const open = () => {
    lightbox.classList.add("terbuka");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
    enableFocusTrap(lightbox);
  };
  const close = () => {
    lightbox.classList.remove("terbuka");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    disableFocusTrap();
  };

  logo.addEventListener("click", open);
  logo.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && lightbox.classList.contains("terbuka")) close(); });
}

function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "t" && !e.ctrlKey && !e.metaKey) document.getElementById("tombol-tema")?.click();
  });
}
