/* ================================================================
   halaman/beranda/skrip.js — TKJ XI-9 | Homepage Scripts
   Optimized for Astro - Pre-rendered content
   ================================================================ */
"use strict";

import {
  initReveal,
  animateTyping,
  animateCounter,
  enableFocusTrap,
  disableFocusTrap,
} from './alat.js';

document.addEventListener("DOMContentLoaded", () => {
  mulaiHalamanIndeks();
});

function mulaiHalamanIndeks() {
  const intro = document.getElementById("intro");
  const main = document.getElementById("main-content");

  if (!intro) {
    tampilkanKontenIndeks();
    return;
  }

  if (sessionStorage.getItem("tkj-intro-done")) {
    intro.style.display = "none";
    if (main) main.style.visibility = "visible";
    tampilkanKontenIndeks();
    return;
  }

  jalankanIntroTerminal(intro, main);
}

function jalankanIntroTerminal(intro, main) {
  const bar = document.getElementById("intro-bar");
  const pct = document.getElementById("intro-pct");
  const sub = document.getElementById("intro-sub");

  const phrases = [
    "Initializing TKJ XI-9...",
    "Loading modules...",
    "Connecting network...",
    "Rendering interface...",
    "ACCESS GRANTED",
  ];

  let progress = 0;
  let phaseIdx = 0;
  document.body.style.overflow = "hidden";
  if (main) main.style.visibility = "hidden";

  const TOTAL_DURATION = 3500;
  const INTERVAL = 50;
  const startTime = Date.now();

  const timer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    let tp = (elapsed / TOTAL_DURATION) * 100;
    progress = Math.min(100, Math.max(progress, tp));

    if (bar) {
      bar.style.width = progress + "%";
      bar.setAttribute("aria-valuenow", Math.floor(progress));
    }
    if (pct) pct.textContent = Math.floor(progress) + "%";

    const nextPhase = Math.min(Math.floor((progress / 100) * phrases.length), phrases.length - 1);
    if (nextPhase !== phaseIdx) {
      phaseIdx = nextPhase;
      if (sub) sub.textContent = phrases[phaseIdx];
    }

    if (progress >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        intro.classList.add("out");
        if (main) main.style.visibility = "visible";
        sessionStorage.setItem("tkj-intro-done", "1");
        setTimeout(() => {
          intro.style.display = "none";
          document.body.style.overflow = "";
          tampilkanKontenIndeks();
        }, 800);
      }, 500);
    }
  }, INTERVAL);
}

function tampilkanKontenIndeks() {
  // Stats animation
  const stats = document.querySelectorAll(".stat-num[data-target]");
  stats.forEach(el => animateCounter(el, parseInt(el.dataset.target, 10)));

  // Slogan typing
  const slogan = document.getElementById("slogan-pahlawan");
  if (slogan) {
    const text = slogan.dataset.fallback || slogan.textContent || "";
    animateTyping(slogan, text);
  }

  // Teacher bars
  const bars = document.querySelectorAll(".bar-fill[data-level]");
  setTimeout(() => {
    bars.forEach(bar => bar.style.width = bar.dataset.level + "%");
  }, 400);

  initReveal();
  initKenaliKamiIntro();
}

function initKenaliKamiIntro() {
  const trigger = document.querySelector('.hero-cta a[href*="developer"]');
  const modal = document.getElementById("about-intro-modal");
  if (!trigger || !modal) return;

  const panel = modal.querySelector(".panel-modal-halaman");
  const confirmBtn = document.getElementById("about-intro-confirm");
  const dismissBtn = document.getElementById("about-intro-dismiss");
  const tutupBtn = modal.querySelector(".tutup-modal");

  const showModal = () => {
    modal.classList.add("terlihat");
    document.body.style.overflow = "hidden";
    enableFocusTrap(panel);
    confirmBtn?.focus();
  };

  const hideModal = () => {
    modal.classList.remove("terlihat");
    document.body.style.overflow = "";
    disableFocusTrap();
    trigger.focus();
  };

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    showModal();
  });

  [tutupBtn, dismissBtn, modal].forEach(el => {
    el?.addEventListener("click", (e) => {
      if (e.target === el || el === tutupBtn || el === dismissBtn) hideModal();
    });
  });

  confirmBtn?.addEventListener("click", () => {
    hideModal();
    window.location.href = trigger.href;
  });
}
