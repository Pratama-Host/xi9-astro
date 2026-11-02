/* ================================================================
   halaman/pengembang/skrip.js — TKJ XI-9 | Developer Page Logic
   Optimized for Astro - Pre-rendered content
   ================================================================ */
"use strict";

import { initReveal, animateCounter } from "./alat.js";

document.addEventListener("DOMContentLoaded", () => {
  inisialisasiPengembang();
});

function inisialisasiPengembang() {
  initDeveloperTabs();
  initTimelineAnimation();
  initStatsAnimation();
  initSkillBars();
  initReveal();
}

function initDeveloperTabs() {
  const tabs = document.querySelectorAll(".dev-tab");
  const contents = document.querySelectorAll(".dev-content-item");
  if (!tabs.length || !contents.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const targetId = this.getAttribute("data-tab");
      if (!targetId) return;

      tabs.forEach((t) => {
        const active = t === this;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
        t.setAttribute("tabindex", active ? "0" : "-1");
      });

      contents.forEach((content) => {
        const active = content.getAttribute("data-content") === targetId;
        content.classList.toggle("active", active);
        content.setAttribute("aria-hidden", active ? "false" : "true");
        if (active && window.innerWidth < 768) {
          const container = document.querySelector(".developer-tabs");
          if (container) window.scrollTo({ top: container.offsetTop - 80, behavior: "smooth" });
        }
      });
    });

    tab.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.click(); }
    });
  });
}

function initTimelineAnimation() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".timeline-item").forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll(".timeline-item").forEach((item, index) => {
          setTimeout(() => item.classList.add("visible"), index * 150);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  const timeline = document.getElementById("dev-timeline");
  if (timeline) observer.observe(timeline);
}

function initStatsAnimation() {
  const statsGrid = document.querySelector(".stats-grid");
  if (!statsGrid) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll(".stat-number[data-target]").forEach((num) => {
          animateCounter(num, parseInt(num.getAttribute("data-target")), 2000);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  observer.observe(statsGrid);
}

function initSkillBars() {
  const skillSection = document.querySelector(".skill-bars-section");
  if (!skillSection) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll(".skill-bar-fill").forEach((bar) => {
          bar.style.width = (bar.getAttribute("data-pct") || "0") + "%";
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  observer.observe(skillSection);
}
