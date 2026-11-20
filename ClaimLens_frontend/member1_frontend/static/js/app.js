/* ClaimLens frontend */
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------- Dark mode ---------- */
(function () {
  const btn = $("themeBtn"); if (!btn) return;
  const root = document.documentElement;
  const sync = () => (btn.innerHTML = root.dataset.theme === "dark" ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>');
  sync();
  btn.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    sync();
  });
})();

/* ---------- Home page: form, validation, loading animation ---------- */
(function () {
  const form = $("claimForm"); if (!form) return;
  const ta = $("claimText"), msg = $("formMsg");
  const count = () => { $("charCount").textContent = ta.value.length; $("charCount").classList.toggle("warn", ta.value.length > 4500); };

  function showMsg(title, text, kind) {
    msg.className = "msg " + (kind === "warn" ? "msg-warn" : "msg-error");
    msg.querySelector("i").className = "bi " + (kind === "warn" ? "bi-info-circle-fill" : "bi-exclamation-triangle-fill");
    $("formMsgTitle").textContent = title; $("formMsgText").textContent = text;
    msg.classList.remove("d-none");
  }
  function hideMsg() { msg.classList.add("d-none"); ta.classList.remove("invalid"); $("inputHint").textContent = ""; }
  function setLoading(on) {
    $("overlay").classList.toggle("show", on);
    $("spinner").classList.toggle("d-none", !on);
    $("searchIcon").classList.toggle("d-none", on);
    $("analyseLabel").textContent = on ? "Analysing…" : "Analyse claim";
    $("analyseBtn").disabled = on;
  }

  count();
  ta.addEventListener("input", () => { count(); if (ta.classList.contains("invalid")) hideMsg(); });

  document.querySelectorAll("[data-sample]").forEach((b) => b.addEventListener("click", () => {
    ta.value = b.dataset.sample; count(); hideMsg(); ta.focus();
  }));

  $("clearBtn").addEventListener("click", () => { ta.value = ""; count(); hideMsg(); ta.focus(); });

  let timer;
  form.addEventListener("submit", (e) => {
    const text = ta.value.trim();
    if (!text) {
      e.preventDefault(); ta.classList.remove("invalid"); void ta.offsetWidth; ta.classList.add("invalid");
      showMsg("Your claim is empty", "Please type or paste a headline, statement or paragraph before analysing.", "warn"); ta.focus(); return;
    }
    if (text.length < 10) {
      e.preventDefault(); ta.classList.remove("invalid"); void ta.offsetWidth; ta.classList.add("invalid");
      showMsg("That's a bit short", "Please enter at least 10 characters so there is enough to analyse.", "warn"); ta.focus(); return;
    }
    hideMsg();
    const steps = ["Extracting keywords and entities…", "Searching the FEVER dataset for evidence…", "Comparing and classifying the claim…", "Preparing your results…"];
    let i = 0; $("overlayStep").textContent = steps[0];
    timer = setInterval(() => { i = (i + 1) % steps.length; $("overlayStep").textContent = steps[i]; }, 1000);
    setTimeout(() => setLoading(true), 0);      // let the form submit first
  });

  /* Back button restores the page from cache: make sure the overlay is gone */
  window.addEventListener("pageshow", () => { clearInterval(timer); setLoading(false); });

  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = +el.dataset.count, t0 = performance.now();
    const tick = (t) => { const p = Math.min((t - t0) / 1200, 1); el.textContent = Math.round(end * p).toLocaleString(); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
})();

/* ---------- Entity highlighting ---------- */
function normaliseLabel(l) {
  l = String(l || "").toUpperCase();
  if (["PERSON", "PER"].includes(l)) return "person";
  if (["GPE", "LOC", "LOCATION", "FAC", "NORP"].includes(l)) return "location";
  if (["ORG", "ORGANIZATION", "ORGANISATION"].includes(l)) return "org";
  if (["DATE", "TIME"].includes(l)) return "date";
  return "other";
}

function renderHighlights() {
  const dataEl = $("resultData"), box = $("highlightedText");
  if (!dataEl || !box) return;
  const { claim, entities, keywords } = JSON.parse(dataEl.textContent);
  const terms = new Map();
  (keywords || []).forEach((k) => terms.set(k.toLowerCase(), "keyword"));
  (entities || []).forEach((e) => terms.set(e.text.toLowerCase(), normaliseLabel(e.label)));   // entities win over keywords
  if (!terms.size) box.textContent = claim;
  else {
    const pattern = [...terms.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
    box.innerHTML = claim.split(new RegExp(`(${pattern})`, "gi")).map((part, i) => {
      if (i % 2 === 0) return escapeHtml(part);
      const cls = terms.get(part.toLowerCase()) || "keyword";
      return `<mark class="ent ent-${cls}" title="${cls}">${escapeHtml(part)}</mark>`;
    }).join("");
  }
  document.querySelectorAll(".legend [data-type]").forEach((btn) => {      // legend counts + toggles
    const t = btn.dataset.type;
    btn.querySelector(".count").textContent = box.querySelectorAll("mark.ent-" + t).length;
    btn.addEventListener("click", () => {
      const on = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", String(!on));
      box.classList.toggle("hide-" + t, on);
    });
  });
}

/* ---------- Results: score ring + copy ---------- */
function initGauge() {
  const g = document.querySelector(".gauge"); if (!g) return;
  const pct = +g.dataset.score, bar = g.querySelector(".bar"), num = $("scoreNum"), C = 326.7;
  requestAnimationFrame(() => (bar.style.strokeDashoffset = C * (1 - pct / 100)));
  const t0 = performance.now();
  const tick = (t) => { const p = Math.min((t - t0) / 1200, 1); num.textContent = Math.round(pct * p); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function initCopy() {
  const b = $("copyBtn"); if (!b) return;
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("claimCopy").textContent); } catch (e) {}
    let t = document.querySelector(".toast-copy");
    if (!t) { t = document.createElement("div"); t.className = "toast-copy"; t.textContent = "Claim copied"; document.body.appendChild(t); }
    t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1500);
  });
}

/* ---------- History: filters + search ---------- */
(function () {
  const rows = [...document.querySelectorAll(".history-table tbody tr")]; if (!rows.length) return;
  let filter = "all", q = "";
  const apply = () => {
    let shown = 0;
    rows.forEach((r) => {
      const ok = (filter === "all" || r.dataset.verdict === filter) && r.dataset.claim.includes(q);
      r.classList.toggle("d-none", !ok); shown += ok;
    });
    $("noMatch").classList.toggle("d-none", shown > 0);
  };
  document.querySelectorAll(".pill").forEach((p) => p.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach((x) => x.classList.remove("active"));
    p.classList.add("active"); filter = p.dataset.filter; apply();
  }));
  $("historySearch").addEventListener("input", (e) => { q = e.target.value.toLowerCase(); apply(); });
})();
