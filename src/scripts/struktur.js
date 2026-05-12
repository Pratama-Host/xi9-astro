/* ================================================================
   halaman/struktur/skrip.js — TKJ XI-9
   Optimized for Astro - Pre-rendered content
   ================================================================ */
"use strict";

import { initReveal, enableFocusTrap, disableFocusTrap } from "./alat.js";

document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  initStructureLightbox();
});

function initStructureLightbox() {
  const lightbox = document.getElementById("structure-photo-lightbox");
  const tutupBtn = document.getElementById("structure-photo-lightbox-tutup");
  const img = document.getElementById("structure-photo-lightbox-img");
  const wrap = document.getElementById("org-wrap");

  if (!lightbox || !tutupBtn || !img || !wrap) return;

  let captionDiv = document.getElementById("structure-lightbox-caption");
  if (!captionDiv) {
    captionDiv = document.createElement("div");
    captionDiv.id = "structure-lightbox-caption";
    captionDiv.className = "bilah-keterangan-jendela";
    captionDiv.style.textAlign = "center";
    captionDiv.style.padding = "16px";
    captionDiv.style.background = "rgba(0,0,0,0.85)";
    captionDiv.style.borderTop = "1px solid var(--border-mid)";
    lightbox.appendChild(captionDiv);
  }

  function terbukaLightboxStruktur(src, nama, jabatan, profil) {
    if (!src) return;
    img.src = src;
    captionDiv.innerHTML = `
      <div style="font-weight:700; font-size:1.25rem; color:white; margin-bottom:4px;">${nama}</div>
      <div style="color:var(--accent); font-family:monospace; font-size:0.9rem; margin-bottom:12px; letter-spacing:0.05em; text-transform:uppercase;">${jabatan}</div>
      ${profil ? `<div style="font-size:0.9rem; color:var(--text-2); max-width:500px; margin:0 auto; line-height:1.5;">${profil}</div>` : ""}
    `;
    lightbox.classList.add("terbuka");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    tutupBtn?.focus();
    enableFocusTrap(lightbox);
  }

  function tutupLightbox() {
    lightbox.classList.remove("terbuka");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    disableFocusTrap();
  }

  wrap.addEventListener("click", (e) => {
    const card = e.target.closest(".org-card");
    if (!card) return;
    const { nama, jabatan, foto, desc } = card.dataset;
    terbukaLightboxStruktur(foto, nama, jabatan, desc);
  });

  tutupBtn.addEventListener("click", tutupLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) tutupLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("terbuka")) tutupLightbox();
  });
}
