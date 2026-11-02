/* ================================================================
   halaman/galeri/skrip.js — TKJ XI-9
   Optimized for Astro - Pre-rendered content
   ================================================================ */
"use strict";

import { initReveal, enableFocusTrap, disableFocusTrap } from "./alat.js";

document.addEventListener("DOMContentLoaded", () => {
  initGalleryImageLoading();
  initGallery();
  initReveal();
  initGalleryLightbox();
});

let carouselIndex = 0;
let carouselItemsData = [];

function initGalleryImageLoading() {
  const images = document.querySelectorAll(".item-galeri img");
  images.forEach((img) => {
    const show = () => img.classList.add("loaded");

    if (img.complete && img.naturalWidth > 0) {
      show();
    } else {
      img.addEventListener("load", show, { once: true });
      img.addEventListener("error", () => img.classList.add("loaded"), { once: true });
    }
  });
}

function initGallery() {
  const carousel = document.getElementById("carousel-3d");
  const dotsContainer = document.getElementById("carousel-3d-dots");
  if (!carousel || !dotsContainer) return;

  const items = carousel.querySelectorAll(".carousel-item");
  carouselItemsData = Array.from(items).map(item => ({
    src: item.querySelector("img").src,
    caption: item.querySelector("img").alt
  }));

  if (carouselItemsData.length === 0) return;

  updateCarousel();

  document.getElementById("carousel-3d-prev")?.addEventListener("click", () => moveCarousel(-1));
  document.getElementById("carousel-3d-next")?.addEventListener("click", () => moveCarousel(1));
  
  dotsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("carousel-dot")) {
      carouselIndex = parseInt(e.target.dataset.index);
      updateCarousel();
    }
  });

  let autoPlay = setInterval(() => moveCarousel(1), 3500);
  const wrapper = document.querySelector('.carousel-3d-wrapper');
  if (wrapper) {
    wrapper.addEventListener('mouseenter', () => clearInterval(autoPlay));
    wrapper.addEventListener('mouseleave', () => { autoPlay = setInterval(() => moveCarousel(1), 3500); });
  }
  
  carousel.addEventListener('click', (e) => {
    const item = e.target.closest('.carousel-item');
    if (item && item.classList.contains('active')) {
      const idx = parseInt(item.dataset.index);
      const data = carouselItemsData[idx];
      if (data && typeof window.terbukaLightbox === 'function') {
        window.terbukaLightbox(data.src, data.caption);
      }
    } else if (item) {
      carouselIndex = parseInt(item.dataset.index);
      updateCarousel();
    }
  });
}

function moveCarousel(direction) {
  const max = carouselItemsData.length;
  if (max === 0) return;
  carouselIndex = (carouselIndex + direction + max) % max;
  updateCarousel();
}

function updateCarousel() {
  const items = document.querySelectorAll(".carousel-item");
  const dots = document.querySelectorAll(".carousel-dot");
  const max = items.length;

  items.forEach((item, idx) => {
    item.className = "carousel-item";
    if (idx === carouselIndex) item.classList.add("active");
    else if (idx === (carouselIndex - 1 + max) % max) item.classList.add("prev");
    else if (idx === (carouselIndex + 1) % max) item.classList.add("next");
    else if (idx === (carouselIndex - 2 + max) % max) item.classList.add("prev-hidden");
    else item.classList.add("next-hidden");
  });

  dots.forEach((dot, idx) => {
    const active = idx === carouselIndex;
    dot.classList.toggle("active", active);
    dot.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function initGalleryLightbox() {
  const grid = document.getElementById("grid-galeri");
  const lightbox = document.getElementById("jendela-gambar");
  const tutupBtn = document.getElementById("tutup-jendela");
  const img = document.getElementById("lightbox-img");
  const caption = document.getElementById("lb-caption-bar");

  if (!grid || !lightbox || !tutupBtn || !img || !caption) return;

  window.terbukaLightbox = function(src, text) {
    if (!src) return;
    img.src = src;
    caption.textContent = text || "";
    lightbox.classList.add("terbuka");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    tutupBtn?.focus();
    enableFocusTrap(lightbox);
  };

  function tutupLightbox() {
    lightbox.classList.remove("terbuka");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    disableFocusTrap();
  }

  grid.addEventListener("click", (e) => {
    const item = e.target.closest(".item-galeri");
    if (!item) return;
    const image = item.querySelector("img");
    const text = item.querySelector(".keterangan-galeri span")?.textContent || "";
    if (image && image.src) window.terbukaLightbox(image.src, text);
  });
  
  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const item = e.target.closest(".item-galeri");
      if (!item) return;
      e.preventDefault();
      const image = item.querySelector("img");
      const text = item.querySelector(".keterangan-galeri span")?.textContent || "";
      if (image && image.src) window.terbukaLightbox(image.src, text);
    }
  });

  tutupBtn.addEventListener("click", tutupLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) tutupLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("terbuka")) tutupLightbox();
  });
}
