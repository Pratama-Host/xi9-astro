/* ================================================================
   halaman/keahlian/skrip.js — TKJ XI-9
   Animasi IntersectionObserver untuk skill cards (SSG-rendered)
   ================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initSkillAnimations();
});

// Animasi counter angka persentase
function animateCounter(el, target, duration = 1200) {
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.floor(easeProgress * target);
    
    el.textContent = currentVal + "%";
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target + "%";
    }
  }
  
  requestAnimationFrame(update);
}

function initSkillAnimations() {
  const cards = document.querySelectorAll(".skill-card");
  if (!cards.length) return;

  const ob = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const bar = card.querySelector(".bar-fill");
          const pct = card.querySelector(".skill-pct");
          
          if (bar && pct) {
            const targetW = bar.getAttribute("data-width") || "0%";
            const targetPct = parseInt(pct.getAttribute("data-target") || "0", 10);
            
            // Trigger bar animation
            requestAnimationFrame(() => {
              bar.style.width = targetW;
              setTimeout(() => bar.classList.add("filled"), 1200); // glow effect after animation
            });
            
            // Trigger counter animation
            animateCounter(pct, targetPct, 1200);
            
            // Set watermark level after animation completes
            setTimeout(() => {
              card.setAttribute("data-level", targetPct.toString());
            }, 1200);
          }
          
          observer.unobserve(card); // Animasi hanya sekali
        }
      });
    },
    { threshold: 0.15 }
  );

  cards.forEach((card) => {
    ob.observe(card);
  });
}
