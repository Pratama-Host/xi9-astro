/* ================================================================
   halaman/anggota/skrip.js — TKJ XI-9
   Optimized for Astro - Pre-rendered content
   ================================================================ */
"use strict";

import G from '../data/G.json';
import {
  initReveal,
  enableFocusTrap,
  disableFocusTrap,
  renderAvatar,
  URLValidator,
} from "./alat.js";

document.addEventListener("DOMContentLoaded", () => {
  initReveal();
  initMembersInteractions();
});

function initMembersInteractions() {
  const grid = document.getElementById("members-grid");
  const search = document.getElementById("member-search");
  const clearBtn = document.getElementById("hapus-pencarian");
  const countEl = document.getElementById("member-count");
  const modal = document.getElementById("member-modal");
  const modalClose = document.getElementById("member-modal-tutup");
  
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".member-card"));
  const totalSiswa = G?.namaSiswa?.length || 0;

  // Search Logic
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.toLowerCase().trim();
      let matchCount = 0;
      cards.forEach(card => {
        const name = card.querySelector(".member-card-name")?.textContent.toLowerCase() || "";
        const match = !q || name.includes(q);
        card.style.display = match ? "" : "none";
        if (match) matchCount++;
      });
      if (countEl) countEl.textContent = q ? `Menampilkan ${matchCount} dari ${totalSiswa} anggota` : `Semua ${totalSiswa} anggota`;
      clearBtn?.classList.toggle("terlihat", search.value.length > 0);
    });

    document.addEventListener("keydown", (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        search.focus();
      }
    });
  }

  clearBtn?.addEventListener("click", () => {
    if (search) { search.value = ""; search.dispatchEvent(new Event("input")); search.focus(); }
  });

  // Slider Logic — passive:true agar tidak menghalangi scroll browser
  grid.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    grid.scrollBy({ left: e.deltaY > 0 ? 80 : -80, behavior: "smooth" });
  }, { passive: true });

  document.querySelector(".members-prev")?.addEventListener("click", () => grid.scrollBy({ left: -200, behavior: "smooth" }));
  document.querySelector(".members-next")?.addEventListener("click", () => grid.scrollBy({ left: 200, behavior: "smooth" }));

  // Modal Logic
  let currentAudioInstance = null;

  function terbukaMemberModal(nis) {
    const data = G.namaSiswa.find((s) => s.nis === nis);
    if (!data || !modal) return;

    if (currentAudioInstance) { currentAudioInstance.pause(); currentAudioInstance = null; }

    document.getElementById("modal-name").textContent = data.nama || "—";
    document.getElementById("modal-nis").textContent = `NIS: ${data.nis || ""}`;
    
    const roleEl = document.getElementById("modal-role");
    if (roleEl) {
      const org = G.strukturOrg?.find(s => s.nama === data.nama);
      roleEl.textContent = org?.jabatan || "Anggota";
    }

    const avatarEl = document.getElementById("modal-avatar");
    avatarEl.innerHTML = renderAvatar(data, "lg");
    avatarEl.style.cursor = data.foto ? "pointer" : "default";

    document.getElementById("modal-desc").textContent = data.desc || "";
    
    const socialEl = document.getElementById("modal-social");
    socialEl.innerHTML = "";
    if (data.social) {
      Object.entries(data.social).forEach(([p, url]) => {
        if (!url || url === "#") return;
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.innerHTML = `<i class="fab fa-${p}" aria-hidden="true"></i>`;
        socialEl.appendChild(a);
      });
    }

    const audioEl = document.getElementById("modal-audio");
    audioEl.innerHTML = buildAudioPlayer(data);
    initAudioPlayer(audioEl, (audio) => currentAudioInstance = audio);

    modal.classList.add("terbuka");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    enableFocusTrap(modal);
    modalClose?.focus();
  }

  function tutupMemberModal() {
    if (currentAudioInstance) { currentAudioInstance.pause(); currentAudioInstance = null; }
    modal?.classList.remove("terbuka");
    modal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    disableFocusTrap();
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".member-card");
    if (card) terbukaMemberModal(card.dataset.nis);
  });

  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".member-card");
      if (card) { e.preventDefault(); terbukaMemberModal(card.dataset.nis); }
    }
  });

  modalClose?.addEventListener("click", tutupMemberModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) tutupMemberModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const lb = document.getElementById("member-photo-lightbox");
      if (lb?.classList.contains("terbuka")) {
        lb.classList.remove("terbuka");
        document.body.style.overflow = "";
      } else {
        tutupMemberModal();
      }
    }
  });

  // Avatar Click to Lightbox
  document.getElementById("modal-avatar")?.addEventListener("click", () => {
    const name = document.getElementById("modal-name").textContent;
    const data = G.namaSiswa.find(s => s.nama === name);
    if (data?.foto) {
      const lb = document.getElementById("member-photo-lightbox");
      const lbImg = document.getElementById("member-photo-lightbox-img");
      if (lb && lbImg) {
        lbImg.src = data.foto;
        lb.classList.add("terbuka");
        document.body.style.overflow = "hidden";
      }
    }
  });
  
  document.getElementById("member-photo-lightbox-tutup")?.addEventListener("click", () => {
    document.getElementById("member-photo-lightbox").classList.remove("terbuka");
    document.body.style.overflow = "hidden"; // Keep hidden because modal is still open
  });
}

function buildAudioPlayer(member) {
  if (!member.audio) return "";
  const safe = URLValidator.sanitize(member.audio);
  if (!safe) return "";
  const bars = Array.from({ length: 20 }, () => `<span style="height:${20 + Math.random() * 80}%"></span>`).join("");
  return `
    <div class="whatsapp-audio-player" data-src="${safe}">
      <div class="audio-track-info">
        <div class="player-track-title">${member.namaAudio || member.nama}</div>
        <p class="player-track-artist">${member.descAudio || member.desc || ""}</p>
      </div>
      <div class="audio-controls">
        <button class="audio-play-btn" type="button"><span class="play-icon">▶</span></button>
        <div class="audio-waveform">${bars}</div>
        <div class="audio-info"><span class="audio-duration">0:00</span> <span class="audio-speed">1x</span></div>
      </div>
      <div class="audio-progress"><div class="progress-bar"><div class="progress-fill"></div></div></div>
      <div class="audio-speed-controls">
        <button class="speed-btn" data-speed="1" type="button">1x</button>
        <button class="speed-btn" data-speed="1.5" type="button">1.5x</button>
        <button class="speed-btn" data-speed="2" type="button">2x</button>
      </div>
    </div>`;
}

function initAudioPlayer(container, setAudio) {
  const player = container.querySelector(".whatsapp-audio-player");
  if (!player) return;
  const audio = new Audio(player.dataset.src);
  setAudio(audio);

  const playBtn = player.querySelector(".audio-play-btn");
  const playIcon = player.querySelector(".play-icon");
  const durEl = player.querySelector(".audio-duration");
  const speedEl = player.querySelector(".audio-speed");
  const fill = player.querySelector(".progress-fill");

  audio.addEventListener("loadedmetadata", () => durEl.textContent = formatTime(audio.duration));
  audio.addEventListener("timeupdate", () => {
    fill.style.width = (audio.currentTime / audio.duration * 100) + "%";
    durEl.textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener("ended", () => { playIcon.textContent = "▶"; player.classList.remove("playing"); });

  playBtn.addEventListener("click", () => {
    if (audio.paused) { audio.play(); playIcon.textContent = "❚❚"; player.classList.add("playing"); }
    else { audio.pause(); playIcon.textContent = "▶"; player.classList.remove("playing"); }
  });

  player.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      audio.playbackRate = parseFloat(btn.dataset.speed);
      speedEl.textContent = btn.dataset.speed + "x";
    });
  });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
