/* ================================================================
   halaman/tkj/skrip.js — TKJ XI-9
   Alat Bantu Jaringan (TKJ Tools) — konten halaman di-render oleh Astro SSG
   ================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initTkjTools();
});

/**
 * Menginisialisasi Alat Bantu TKJ (Subnet & Ping)
 */
function initTkjTools() {
  // Helper IP Functions
  const ipToInt = (ip) =>
    ip
      .split(".")
      .map(Number)
      .reduce(
        (acc, n) =>
          (acc << 8) + (n & 255),
        0,
      ) >>> 0;
  const intToIp = (int) =>
    [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255,
    ].join(".");
  const maskFromCidr = (cidr) =>
    cidr === 0
      ? 0
      : ~(
          (1 << (32 - cidr)) -
          1
        ) >>> 0;

  // --- Subnet Calculator ---
  const subInput = document.getElementById("subnet-input");
  const subBtn = document.getElementById("subnet-calc-tombol");
  const subResult = document.getElementById("subnet-result");

  if (subBtn && subInput && subResult) {
    subBtn.addEventListener("click", () => {
      const val = subInput.value.trim();
      const parts = val.split("/");
      
      if (parts.length !== 2) {
        subResult.innerHTML = '<span style="color:var(--accent)">Format salah! Gunakan: IP/CIDR (e.g. 192.168.1.1/24)</span>';
        return;
      }

      try {
        const ip = parts[0];
        const cidr = parseInt(parts[1], 10);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) throw new Error("CIDR tidak valid");

        const ipInt = ipToInt(ip);
        const mask = maskFromCidr(cidr);
        const network = ipInt & mask;
        const broadcast = network | (~mask >>> 0);
        const first = network + (cidr === 32 ? 0 : 1);
        const last = broadcast - (cidr === 32 ? 0 : 1);

        subResult.innerHTML = `
          <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border-mid)">
            Network: <span class="hl">${intToIp(network)}</span><br>
            Netmask: <span class="hl">${intToIp(mask)}</span>
          </div>
          <div>
            Broadcast: <span class="hl">${intToIp(broadcast)}</span><br>
            Host Range: <span class="hl">${intToIp(first)} - ${intToIp(last)}</span>
          </div>
        `;
      } catch (err) {
        subResult.innerHTML = `<span style="color:var(--accent)">Error: ${err.message}</span>`;
      }
    });
  }

  // --- Ping Simulator ---
  const pingBtn = document.getElementById("ping-tombol");
  const pingHost = document.getElementById("ping-host");
  const pingLog = document.getElementById("ping-log");

  if (pingBtn && pingHost && pingLog) {
    pingBtn.addEventListener("click", () => {
      const host = pingHost.value.trim() || "tkj-xi9.local";
      pingBtn.disabled = true;
      pingBtn.textContent = "Pinging...";
      pingLog.innerHTML = '<span class="typing">Connecting to ' + host + '...</span>';

      setTimeout(() => {
        const success = Math.random() > 0.15;
        const latency = Math.floor(Math.random() * 150) + 5;
        
        if (success) {
          pingLog.innerHTML = `
            <div style="color:var(--accent-2)">Reply from ${host}: bytes=32 time=${latency}ms TTL=64</div>
            <div style="font-size:0.8rem; margin-top:4px">Packets: Sent = 1, Received = 1, Lost = 0 (0% loss)</div>
          `;
        } else {
          pingLog.innerHTML = `<div style="color:var(--accent)">Request timed out. Unable to reach ${host}.</div>`;
        }
        
        pingBtn.disabled = false;
        pingBtn.textContent = "Ping";
      }, 1200 + Math.random() * 1000);
    });
  }
}
