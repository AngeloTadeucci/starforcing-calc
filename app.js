(function () {
  const $ = (id) => document.getElementById(id);

  // Which calculator tab is showing. "quick" drives the global mode slider +
  // safeguard checkbox; "perstar" sends a per-star plan (opts.starPlan) instead.
  let activeTab = "quick";

  // Stars where Enhancement Modes exist (15–21). Safeguard only applies to 15–17.
  const PLAN_STARS = [15, 16, 17, 18, 19, 20, 21];
  const PLAN_STORAGE_KEY = "sf-star-plan";
  const TAB_STORAGE_KEY = "sf-active-tab";
  const OPT_STORAGE_KEY = "sf-optimize";
  const FODDER_STORAGE_KEY = "sf-fodder";
  // Also read by the <head> bootstrap script that stamps data-theme pre-paint.
  const THEME_STORAGE_KEY = "sf-theme";

  // The plan produced by the last Optimize run, held so "Apply to Per-star
  // matrix" can write it into the editable matrix.
  let lastOptimizedPlan = null;
  // Stats from the last simulation, held so the histograms (canvas pixels, not
  // CSS) can be redrawn when the theme changes.
  let lastStats = null;
  // Default plan: safeguard 15–17, Mode 1 on 18–19, Mode 4 on 20–21.
  const DEFAULT_PLAN = {
    15: { mode: 1, safeguard: true },
    16: { mode: 1, safeguard: true },
    17: { mode: 1, safeguard: true },
    18: { mode: 1, safeguard: false },
    19: { mode: 1, safeguard: false },
    20: { mode: 4, safeguard: false },
    21: { mode: 4, safeguard: false },
  };

  function fmtMesos(n) {
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(2) + " T";
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + " B";
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + " M";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtInt(n) {
    if (!Number.isFinite(n)) return "—";
    return Math.round(n).toLocaleString("en-US");
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  // The <head> bootstrap script sets data-theme before first paint; from here
  // on this module owns it (toggle clicks + OS changes while no explicit pick).
  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  function parseHexColor(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function currentTheme() {
    return document.documentElement.dataset.theme === "light"
      ? "light"
      : "dark";
  }

  function applyTheme(theme, persist) {
    document.documentElement.dataset.theme = theme;
    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch (e) {}
    }
    const next = theme === "light" ? "dark" : "light";
    const btn = $("themeToggle");
    btn.setAttribute("aria-label", `Switch to ${next} theme`);
    btn.title = `Switch to ${next} theme`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = cssVar("--bg") || "#0d0e11";
    // Re-render everything that bakes theme colours into inline styles or
    // canvas pixels — CSS variables cover the rest.
    syncRateCostTable();
    redrawHistograms();
  }

  // Item level comes from the dropdown, except when "Custom…" is selected, in
  // which case the free-input field next to it is authoritative.
  function readItemLevel() {
    const sel = $("itemLevel");
    if (sel.value === "custom") return parseInt($("itemLevelCustom").value, 10);
    return parseInt(sel.value, 10);
  }

  function readInputs() {
    const input = {
      itemLevel: readItemLevel(),
      currentStar: parseInt($("currentStar").value, 10),
      targetStar: parseInt($("targetStar").value, 10),
      trials: parseInt($("trials").value, 10),
      mvp: $("mvp").value,
      event: $("event").value,
      starCatching: $("starCatching").checked,
      safeguard: $("safeguard").checked,
      enhanceMode: parseInt($("enhanceMode").value, 10),
    };
    // Per-star tab: a plan overrides the global mode/safeguard for stars 15–21.
    if (activeTab === "perstar") input.starPlan = readStarPlan();
    return input;
  }

  function validate(input) {
    if (
      !Number.isFinite(input.itemLevel) ||
      input.itemLevel < 1 ||
      input.itemLevel > 300
    )
      return "Item level must be between 1 and 300.";
    if (
      !Number.isFinite(input.currentStar) ||
      input.currentStar < 0 ||
      input.currentStar > 29
    )
      return "Current ★ must be between 0 and 29.";
    if (
      !Number.isFinite(input.targetStar) ||
      input.targetStar < 1 ||
      input.targetStar > 30
    )
      return "Target ★ must be between 1 and 30.";
    if (input.targetStar <= input.currentStar)
      return "Target ★ must be greater than Current ★.";
    if (
      !Number.isFinite(input.trials) ||
      input.trials < 1 ||
      input.trials > 100000
    )
      return "Trials must be between 1 and 100000.";
    return null;
  }

  function renderStatList(elId, rows) {
    const el = $(elId);
    el.innerHTML = rows
      .map(({ label, value, accent, divider }) => {
        const cls = [
          "stat-line",
          accent ? "stat-line--accent" : "",
          divider ? "stat-line--divider" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<div class="${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
      })
      .join("");
  }

  function renderResults(stats) {
    $("m-avg").textContent = fmtMesos(stats.avgCost);
    $("m-median").textContent = fmtMesos(stats.medianCost);
    $("m-booms").textContent = stats.avgBooms.toFixed(2);
    $("m-attempts").textContent = stats.medianAttempts.toFixed(1);

    renderStatList("cost-pct", [
      { label: "Min", value: fmtMesos(stats.minCost) },
      { label: "25th", value: fmtMesos(stats.p25) },
      { label: "Median", value: fmtMesos(stats.medianCost), accent: true },
      { label: "75th", value: fmtMesos(stats.p75) },
      { label: "95th", value: fmtMesos(stats.p95) },
      { label: "Max", value: fmtMesos(stats.maxCost), divider: true },
      { label: "Average", value: fmtMesos(stats.avgCost) },
    ]);

    renderStatList("booms-pct", [
      { label: "Min", value: fmtInt(stats.minBooms) },
      { label: "25th", value: fmtInt(stats.p25Booms) },
      { label: "Median", value: fmtInt(stats.medianBooms), accent: true },
      { label: "75th", value: fmtInt(stats.p75Booms) },
      { label: "95th", value: fmtInt(stats.p95Booms) },
      { label: "Max", value: fmtInt(stats.maxBooms), divider: true },
      { label: "Average", value: stats.avgBooms.toFixed(2) },
    ]);
  }

  function fmtAxis(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "k";
    return String(Math.round(n));
  }

  function drawHistogram(canvasId, buckets, formatX, opts = {}) {
    const canvas = $(canvasId);
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Get or create the tooltip element for this chart.
    let tooltip = canvas.parentElement.querySelector(".hist-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "hist-tooltip";
      canvas.parentElement.appendChild(tooltip);
    }
    tooltip.style.display = "none";

    if (!buckets || buckets.length === 0) return;

    const padL = 36,
      padR = 12,
      padT = 12,
      padB = 24;
    const w = cssW - padL - padR;
    const h = cssH - padT - padB;

    const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1;
    const barW = w / buckets.length;

    ctx.fillStyle = cssVar("--accent") || "#d4a259";
    for (let i = 0; i < buckets.length; i++) {
      const barH = (buckets[i].count / maxCount) * h;
      const x = padL + i * barW;
      const y = padT + (h - barH);
      ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
    }

    ctx.strokeStyle = cssVar("--border") || "#24272e";
    ctx.beginPath();
    ctx.moveTo(padL, padT + h + 0.5);
    ctx.lineTo(padL + w, padT + h + 0.5);
    ctx.stroke();

    ctx.fillStyle = cssVar("--muted") || "#8a8d96";
    ctx.font = '10.5px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(formatX(buckets[0].from), padL, padT + h + 6);
    ctx.textAlign = "right";
    ctx.fillText(
      formatX(buckets[buckets.length - 1].to),
      padL + w,
      padT + h + 6,
    );

    ctx.textAlign = "right";
    ctx.fillText(String(maxCount), padL - 6, padT);

    // Pre-compute prefix sums for cumulative percentages.
    const prefixSums = new Array(buckets.length + 1).fill(0);
    for (let k = 0; k < buckets.length; k++) {
      prefixSums[k + 1] = prefixSums[k] + buckets[k].count;
    }

    // Hover: show percentage for the bar under the cursor.
    canvas.onmousemove = (e) => {
      const i = Math.floor((e.offsetX - padL) / barW);
      if (i < 0 || i >= buckets.length) {
        tooltip.style.display = "none";
        return;
      }
      const b = buckets[i];
      const range =
        opts.singleValue || b.from === b.to
          ? formatX(b.from)
          : `${formatX(b.from)} – ${formatX(b.to)}`;
      const pct = ((b.count / opts.total) * 100).toFixed(1);
      const cumLeft = ((prefixSums[i + 1] / opts.total) * 100).toFixed(1);
      const cumRight = (
        ((opts.total - prefixSums[i]) / opts.total) *
        100
      ).toFixed(1);
      tooltip.textContent = `${range}: ${pct}%  ·  ≤${cumLeft}%  ·  ≥${cumRight}%`;
      tooltip.style.display = "block";
      const chartRect = canvas.parentElement.getBoundingClientRect();
      const tipW = tooltip.offsetWidth;
      const chartW = canvas.parentElement.clientWidth;
      let tipLeft = e.clientX - chartRect.left - tipW / 2;
      tipLeft = Math.max(4, Math.min(tipLeft, chartW - tipW - 4));
      tooltip.style.left = tipLeft + "px";
    };

    canvas.onmouseleave = () => {
      tooltip.style.display = "none";
    };
  }

  function drawHistograms(stats) {
    drawHistogram("histogram", stats.buckets, fmtAxis, {
      total: stats.trials,
    });
    drawHistogram(
      "histogram-booms",
      stats.boomBuckets,
      (n) => String(Math.round(n)),
      { total: stats.trials, singleValue: true },
    );
  }

  // Repaint the last run's histograms in the new theme's colours. Skipped when
  // the results panel is hidden — its canvases have zero client size there, so
  // a draw would blank them; the next run redraws from scratch anyway.
  function redrawHistograms() {
    if (!lastStats || $("results").classList.contains("hidden")) return;
    drawHistograms(lastStats);
  }

  // Run the simulation off the main thread via a Web Worker so the UI stays
  // fully responsive while it runs. Falls back to the in-page (time-sliced) path
  // if a Worker can't be created or fails to load — e.g. some browsers block
  // worker scripts under the file:// protocol. A fresh worker per run keeps the
  // routing simple and lets us terminate it cleanly when finished.
  function runSimulation(input, onProgress) {
    return new Promise((resolve) => {
      let worker;
      try {
        worker = new Worker("worker.js");
      } catch (e) {
        resolve(SF.runTrials(input, { onProgress }));
        return;
      }

      let settled = false;
      const fallback = () => {
        if (settled) return;
        settled = true;
        try {
          worker.terminate();
        } catch (e) {}
        resolve(SF.runTrials(input, { onProgress }));
      };

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === "progress") {
          onProgress(msg.done, msg.total);
        } else if (msg.type === "done") {
          settled = true;
          worker.terminate();
          resolve(msg.stats);
        }
      };
      worker.onerror = (err) => {
        // Worker failed to load or threw; recover by computing in-page.
        if (err && err.preventDefault) err.preventDefault();
        fallback();
      };

      worker.postMessage(input);
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    // No simulation runs from the Optimize tab — its Run button is hidden, but
    // pressing Enter in a field would still submit the form, so ignore it here.
    if (activeTab === "optimize") return;
    const errEl = $("error");
    errEl.textContent = "";

    const input = readInputs();
    const err = validate(input);
    if (err) {
      errEl.textContent = err;
      return;
    }

    const btn = $("calc");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add("is-running");
    btn.textContent = `Running 0 / ${input.trials.toLocaleString("en-US")}`;

    try {
      const stats = await runSimulation(input, (done, total) => {
        btn.textContent = `Running ${done.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}`;
      });
      lastStats = stats;
      $("results").classList.remove("hidden");
      renderResults(stats);
      drawHistograms(stats);
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-running");
      btn.textContent = originalLabel;
    }
  }

  const ENHANCE_MODE_LABELS = {
    1: "Mode 1 — 1× cost · baseline",
    2: "Mode 2 — 1.5× cost (15–17★) | 2× cost (18–21★)",
    3: "Mode 3 — 2.5× cost (15–17★) | 3.5× cost (18–21★)",
    4: "Mode 4 — 18–21★ only (6.5× cost · no boom); 15–17★ cap at Mode 3 — use Safeguard",
  };

  function syncRateCostTable() {
    const itemLevel = readItemLevel() || 200;

    // Success-% gradient endpoints: accent (good odds) → error (bad odds),
    // read from the active theme so the inline colours work in both modes.
    const gradHi = parseHexColor(cssVar("--accent")) || [212, 162, 89];
    const gradLo = parseHexColor(cssVar("--error")) || [201, 122, 122];

    const stars = [15, 16, 17, 18, 19, 20, 21];
    $("rate-cost-table-body").innerHTML = stars
      .map((star) => {
        const cols = [1, 2, 3, 4]
          .map((m) => {
            // Mode 4 doesn't exist on 15–17 (capped at 3; use Safeguard for 0% boom).
            if (m === 4 && star <= 17) {
              return `<td class="num" data-mode-col="${m}"><span class="zero">—</span></td>`;
            }
            const opts = {
              enhanceMode: m,
              mvp: $("mvp").value,
              event: $("event").value,
              safeguard: $("safeguard").checked,
              starCatching: $("starCatching").checked,
            };
            const [s] = SF.applyRateModifiers(star, opts);
            const cost = Math.round(
              SF.baseCost(star, itemLevel) * SF.costMultiplier(star, opts),
            );
            const pct = (s * 100).toFixed(1) + "%";
            // fmtMesos rolls over to "B" above 1000 M (and "T" above 1000 B).
            const costStr = fmtMesos(cost);
            // Gradient: accent (30%+) → error (8% and below)
            const t = Math.max(0, Math.min(1, (s - 0.08) / (0.3 - 0.08)));
            const pctColor = `rgb(${gradLo
              .map((lo, ch) => Math.round(lo + (gradHi[ch] - lo) * t))
              .join(",")})`;
            return `<td class="num" data-mode-col="${m}"><span style="color:${pctColor}">${pct}</span><br><span class="table-sub">${costStr}</span></td>`;
          })
          .join("");
        return `<tr><td>${star} → ${star + 1}</td>${cols}</tr>`;
      })
      .join("");

    // Re-apply column highlight after rebuilding the table body.
    const v = parseInt($("enhanceMode").value, 10) || 1;
    document.querySelectorAll("[data-mode-col]").forEach((el) => {
      el.classList.toggle("active-mode-col", el.dataset.modeCol === String(v));
    });
  }

  // Reveal the free-input field only when "Custom…" is picked.
  function syncItemLevelCustom() {
    const isCustom = $("itemLevel").value === "custom";
    const custom = $("itemLevelCustom");
    custom.hidden = !isCustom;
    if (isCustom) custom.focus();
  }

  function syncEnhanceMode() {
    const v = parseInt($("enhanceMode").value, 10) || 1;
    $("enhanceModeLabel").textContent =
      ENHANCE_MODE_LABELS[v] || ENHANCE_MODE_LABELS[1];

    // Safeguard is always available — in modes 2–4 it means "safeguard to 18".
    const sg = $("safeguard");
    sg.disabled = false;
    sg.closest(".check").classList.remove("is-disabled");

    syncRateCostTable();
  }

  function syncBoomTable() {
    const ev = $("event").value;
    const boomEventActive = ev === "boomReduction" || ev === "shiningStarForce";
    const safeguardChecked = $("safeguard").checked;
    document.querySelectorAll(".boom-cell").forEach((cell) => {
      const base = parseFloat(cell.dataset.base);
      const star = parseInt(cell.closest("tr").cells[0].textContent);
      // Safeguard to 18: stars 15–17 always have 0% boom when safeguard is on.
      if (safeguardChecked && star >= 15 && star <= 17) {
        cell.innerHTML = `<span class="boom-old">${base.toFixed(2)}%</span><span class="boom-new">0%</span>`;
        return;
      }
      // Boom reduction applies to every mode (confirmed: events affect the new
      // modes too). Mode 4 has no booms, so its cells are static and not .boom-cell.
      const reduced = boomEventActive;
      if (reduced) {
        const reducedVal = (base * 0.7).toFixed(2);
        cell.innerHTML = `<span class="boom-old">${base.toFixed(2)}%</span><span class="boom-new">${reducedVal}%</span>`;
      } else {
        cell.textContent = base.toFixed(2) + "%";
      }
    });
  }

  // ── Per-star strategy tab ───────────────────────────────────────────────
  // Read the saved plan from localStorage, falling back to DEFAULT_PLAN for any
  // missing/corrupt entry so a partial or stale payload can never break the page.
  function loadPlan() {
    let parsed = null;
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }
    const plan = {};
    PLAN_STARS.forEach((star) => {
      const p = parsed && parsed[star];
      plan[star] =
        p && typeof p.mode === "number"
          ? { mode: p.mode, safeguard: !!p.safeguard }
          : Object.assign({}, DEFAULT_PLAN[star]);
      // Sanitize stale payloads: 15–17 cap at Mode 3 (Mode 4 was removed in-game).
      if (star <= 17 && plan[star].mode > 3) plan[star].mode = 3;
    });
    return plan;
  }

  function savePlan(plan) {
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    } catch (e) {}
  }

  // Build the live plan from the matrix controls. Safeguard only counts when it's
  // a 15–17 star on Mode 1 (it doesn't stack on Modes 2–4), matching the engine.
  function readStarPlan() {
    const plan = {};
    PLAN_STARS.forEach((star) => {
      const sel = document.querySelector(`.plan-mode[data-star="${star}"]`);
      const mode = sel ? parseInt(sel.value, 10) : 1;
      const sgCb = document.querySelector(`.plan-sg[data-star="${star}"]`);
      const safeguard = !!(sgCb && sgCb.checked && mode === 1 && star <= 17);
      plan[star] = { mode, safeguard };
    });
    return plan;
  }

  function buildPlanTable() {
    const saved = loadPlan();
    $("plan-table-body").innerHTML = PLAN_STARS.map((star) => {
      const p = saved[star];
      // Stars 15–17 cap at Mode 3 in-game (Mode 4 was removed as redundant with
      // Safeguard, which reaches 0% boom there); 18–21 keep Mode 4.
      const modes = star <= 17 ? [1, 2, 3] : [1, 2, 3, 4];
      const modeOpts = modes
        .map(
          (m) =>
            `<option value="${m}"${m === p.mode ? " selected" : ""}>Mode ${m}</option>`,
        )
        .join("");
      const sgCell =
        star <= 17
          ? `<input type="checkbox" class="plan-sg" data-star="${star}"${p.safeguard ? " checked" : ""} aria-label="Safeguard ${star}★" />`
          : `<span class="num zero">—</span>`;
      return `<tr data-star="${star}">
        <td>${star} → ${star + 1}</td>
        <td><select class="plan-mode" data-star="${star}" aria-label="Mode for ${star}★">${modeOpts}</select></td>
        <td>${sgCell}</td>
        <td class="num plan-boom-cell"></td>
        <td class="num plan-cost-cell"></td>
      </tr>`;
    }).join("");

    $("plan-table-body")
      .querySelectorAll(".plan-mode, .plan-sg")
      .forEach((el) => el.addEventListener("change", onPlanChange));

    syncPlanTable();
  }

  function onPlanChange() {
    savePlan(readStarPlan());
    syncPlanTable();
  }

  // Refresh each row's derived UI: the safeguard checkbox is only enabled on Mode
  // 1, and the boom%/cost columns are computed through the same engine the
  // simulation uses. Rows outside the current → target range are greyed (off).
  function syncPlanTable() {
    const itemLevel = readItemLevel() || 200;
    const current = parseInt($("currentStar").value, 10);
    const target = parseInt($("targetStar").value, 10);
    const baseOpts = {
      mvp: $("mvp").value,
      event: $("event").value,
      starCatching: $("starCatching").checked,
    };

    PLAN_STARS.forEach((star) => {
      const row = document.querySelector(`tr[data-star="${star}"]`);
      if (!row) return;
      const mode = parseInt(row.querySelector(".plan-mode").value, 10);
      const sgCb = row.querySelector(".plan-sg");
      if (sgCb) sgCb.disabled = mode !== 1;
      const safeguard = !!(sgCb && sgCb.checked && mode === 1 && star <= 17);

      const opts = Object.assign({ enhanceMode: mode, safeguard }, baseOpts);
      const [, , boom] = SF.applyRateModifiers(star, opts);
      const cost = Math.round(
        SF.baseCost(star, itemLevel) * SF.costMultiplier(star, opts),
      );

      const boomPct = boom * 100;
      row.querySelector(".plan-boom-cell").innerHTML =
        `<span class="plan-boom${boomPct === 0 ? " zero" : ""}">${boomPct.toFixed(2)}%</span>`;
      row.querySelector(".plan-cost-cell").textContent = fmtMesos(cost);

      const off = !(
        Number.isFinite(current) &&
        Number.isFinite(target) &&
        star >= current &&
        star < target
      );
      row.classList.toggle("plan-row--off", off);
    });
  }

  function setTab(tab) {
    activeTab =
      tab === "perstar" || tab === "optimize" || tab === "fodder"
        ? tab
        : "quick";
    const quick = activeTab === "quick";
    const perStar = activeTab === "perstar";
    const optimize = activeTab === "optimize";
    const fodder = activeTab === "fodder";
    $("tab-quick").classList.toggle("is-active", quick);
    $("tab-perstar").classList.toggle("is-active", perStar);
    $("tab-optimize").classList.toggle("is-active", optimize);
    $("tab-fodder").classList.toggle("is-active", fodder);
    $("tab-quick").setAttribute("aria-selected", String(quick));
    $("tab-perstar").setAttribute("aria-selected", String(perStar));
    $("tab-optimize").setAttribute("aria-selected", String(optimize));
    $("tab-fodder").setAttribute("aria-selected", String(fodder));
    // The global mode slider + safeguard checkbox and the reference tables
    // belong to the Quick tab only; Per-star, Optimize and Fodder replace the
    // right column with their own panels.
    $("enhanceModeRow").classList.toggle("hidden", !quick);
    $("safeguardField").classList.toggle("hidden", !quick);
    $("referencePanels").classList.toggle("hidden", !quick);
    $("perStarPanel").classList.toggle("hidden", !perStar);
    $("optimizePanel").classList.toggle("hidden", !optimize);
    $("fodderPanel").classList.toggle("hidden", !fodder);
    // Simulation results belong to the Quick/Per-star runs; the Optimize and
    // Fodder tabs can't run a sim, so any results still on screen are from a
    // previous run under a different plan/mode. Leaving them up makes those
    // tabs look like they produced boom counts that contradict their own
    // recommendation (e.g. a 0-boom Mode 4 plan next to a histogram full of
    // booms), so clear the panel when landing there.
    if (optimize || fodder) $("results").classList.add("hidden");
    // The form's "Run simulation" button has no clear mode to run on the
    // Optimize/Fodder tabs (no global slider, no plan), so hide it there.
    $("formActions").classList.toggle("hidden", optimize || fodder);
    if (perStar) syncPlanTable();
    if (fodder) syncFodder();
    try {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch (e) {}
  }

  // ── Optimize tab ────────────────────────────────────────────────────────
  // Modifiers the optimizer scores against — the same form inputs the matrix
  // reads, minus the global mode/safeguard (the plan supplies those per star).
  function readOptBaseOpts() {
    return {
      mvp: $("mvp").value,
      event: $("event").value,
      starCatching: $("starCatching").checked,
      enhanceMode: 0,
      safeguard: false,
    };
  }

  function loadOptSettings() {
    let s = null;
    try {
      const raw = localStorage.getItem(OPT_STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {}
    if (!s) return;
    if (Number.isFinite(s.budget)) $("optBudget").value = s.budget;
    if (Number.isFinite(s.spares)) $("optSpares").value = s.spares;
  }

  function saveOptSettings() {
    try {
      localStorage.setItem(
        OPT_STORAGE_KEY,
        JSON.stringify({
          budget: parseFloat($("optBudget").value),
          spares: parseInt($("optSpares").value, 10),
        }),
      );
    } catch (e) {}
  }

  // Any change to the inputs the recommendation depends on makes the shown
  // result stale — hide it so a stale plan can't be applied by mistake.
  function clearOptResult() {
    lastOptimizedPlan = null;
    const el = $("optResult");
    el.classList.add("hidden");
    el.innerHTML = "";
  }

  async function runOptimize() {
    const errEl = $("optError");
    errEl.textContent = "";
    clearOptResult();

    const itemLevel = readItemLevel();
    const currentStar = parseInt($("currentStar").value, 10);
    const targetStar = parseInt($("targetStar").value, 10);
    if (!Number.isFinite(itemLevel) || itemLevel < 1 || itemLevel > 300) {
      errEl.textContent = "Item level must be between 1 and 300.";
      return;
    }
    if (
      !Number.isFinite(currentStar) ||
      !Number.isFinite(targetStar) ||
      currentStar < 0 ||
      targetStar > 30 ||
      targetStar <= currentStar
    ) {
      errEl.textContent = "Target ★ must be greater than Current ★.";
      return;
    }
    if (SF.optimizer.optimizableStars(targetStar).length === 0) {
      errEl.textContent =
        "No Enhancement-Mode stars (15–21) in this range to optimize.";
      return;
    }

    const opts = readOptBaseOpts();
    const budgetB = parseFloat($("optBudget").value);
    const spares = parseInt($("optSpares").value, 10) || 0;
    if (!Number.isFinite(budgetB) || budgetB < 0) {
      errEl.textContent = "Enter a meso budget (in billions).";
      return;
    }
    const budgetMesos = budgetB * 1e9;
    const params = { currentStar, targetStar, itemLevel, opts };

    // Maximize P(total cost ≤ budget AND booms ≤ spares). No closed form for the
    // joint distribution, so simulate — but only the plans on the analytic
    // mean-(cost, booms) Pareto frontier, where the optimum has to live.
    const btn = $("optimizeBtn");
    const label = btn.textContent;
    btn.disabled = true;
    btn.classList.add("is-running");
    try {
      const fr = SF.optimizer.optimizeFrontier(params, 24);
      // Heavier ranges (toward 30★) get fewer trials so the sweep stays snappy.
      const trials = targetStar <= 24 ? 5000 : 2500;
      const scored = [];
      for (let i = 0; i < fr.candidates.length; i++) {
        const cand = fr.candidates[i];
        const input = Object.assign(
          { currentStar, targetStar, itemLevel, starPlan: cand.plan },
          opts,
        );
        const prob = SF.optimizer.successProb(input, budgetMesos, spares, trials);
        scored.push(Object.assign({ prob }, cand));
        btn.textContent = `Optimizing ${i + 1} / ${fr.candidates.length}`;
        // Yield so the button text repaints between candidates.
        await new Promise((r) => setTimeout(r, 0));
      }
      // Pick the cheapest plan whose odds are within a tolerance of the best
      // odds, rather than the strict maximum. Chasing the last fraction of a
      // percent — often just Monte-Carlo noise — makes the optimizer overspend
      // (e.g. buying Mode 4 to go 99.9% → 100% when the budget is huge). When
      // several plans are effectively tied on odds, the player wants the cheapest.
      const ODDS_TOL = 0.01; // 1 percentage point
      const maxProb = scored.reduce((m, r) => Math.max(m, r.prob), 0);
      let best = null;
      for (const r of scored) {
        if (r.prob >= maxProb - ODDS_TOL && (!best || r.expCost < best.expCost)) {
          best = r;
        }
      }
      lastOptimizedPlan = best.plan;
      renderOptResult({
        result: best,
        budgetMesos,
        spares,
        prob: best.prob,
        trials,
        frontierSize: fr.frontierSize,
        currentStar,
        targetStar,
        itemLevel,
      });
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-running");
      btn.textContent = label;
    }
  }

  function renderOptResult(ctx) {
    const { result, budgetMesos, spares, currentStar, targetStar } = ctx;
    const plan = result.plan;
    const baseOpts = readOptBaseOpts();
    const planOpts = Object.assign({ starPlan: plan }, baseOpts);
    const stars = SF.optimizer.optimizableStars(targetStar);

    const rows = stars
      .map((star) => {
        const ch = plan[star];
        const [, , boom] = SF.applyRateModifiers(star, planOpts);
        const cost = Math.round(
          SF.baseCost(star, ctx.itemLevel) * SF.costMultiplier(star, planOpts),
        );
        const modeLabel =
          ch.mode === 1 && ch.safeguard ? "Mode 1 + SG" : "Mode " + ch.mode;
        const boomPct = boom * 100;
        // Rows below the current star never start in the run; they only matter
        // on a boom re-climb, so grey them like the matrix does.
        const off = star < currentStar;
        return `<tr${off ? ' class="plan-row--off"' : ""}>
          <td>${star} → ${star + 1}</td>
          <td>${modeLabel}</td>
          <td class="num"><span class="plan-boom${boomPct === 0 ? " zero" : ""}">${boomPct.toFixed(2)}%</span></td>
          <td class="num">${fmtMesos(cost)}</td>
        </tr>`;
      })
      .join("");

    const summaryItems = [
      { k: "Finish odds", v: (ctx.prob * 100).toFixed(1) + "%" },
      { k: "Expected cost", v: fmtMesos(result.expCost) },
      { k: "Expected booms", v: result.expBooms.toFixed(2) },
    ];
    const summary =
      '<div class="opt-summary">' +
      summaryItems
        .map(
          (s) =>
            `<div><span class="opt-k">${s.k}</span><span class="opt-v">${s.v}</span></div>`,
        )
        .join("") +
      "</div>";

    const spareLabel = spares === 1 ? "spare" : "spares";
    let note = `<p class="opt-note">≈${(ctx.prob * 100).toFixed(1)}% chance to reach ${targetStar}★ for ≤ ${fmtMesos(budgetMesos)} and ≤ ${spares} ${spareLabel}. Picked from ${ctx.frontierSize} cost/boom-efficient plans, ${ctx.trials.toLocaleString("en-US")} trials each.</p>`;
    // When even the best plan rarely finishes, the constraints — not the plan —
    // are the problem; say so rather than presenting a long-shot as "optimal".
    if (ctx.prob < 0.5) {
      note += `<p class="opt-note opt-warn">Even the best plan finishes under these limits only ${(ctx.prob * 100).toFixed(1)}% of the time — raise the budget or add spares for better odds.</p>`;
    }

    const table = `<table class="mode-table plan-table opt-table">
      <thead><tr><th>★</th><th>Mode</th><th>Boom</th><th>Cost</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

    const apply = `<div class="opt-apply"><button type="button" id="optApply">Apply to Per-star matrix</button></div>`;

    const el = $("optResult");
    el.innerHTML = summary + note + table + apply;
    el.classList.remove("hidden");
    $("optApply").addEventListener("click", applyOptimizedPlan);
  }

  function applyOptimizedPlan() {
    if (!lastOptimizedPlan) return;
    savePlan(lastOptimizedPlan);
    buildPlanTable();
    setTab("perstar");
  }

  // ── Fodder tab ──────────────────────────────────────────────────────────
  // Everything here is closed-form (SF.fodder → optimizer.planMetrics), so the
  // comparison recomputes live on any input change — no run button needed.

  function loadFodderSettings() {
    let s = null;
    try {
      const raw = localStorage.getItem(FODDER_STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {}
    if (!s) return;
    if (Number.isFinite(s.price)) $("fodderPrice").value = s.price;
    if (Number.isFinite(s.spare)) $("sparePrice").value = s.spare;
  }

  function saveFodderSettings() {
    try {
      localStorage.setItem(
        FODDER_STORAGE_KEY,
        JSON.stringify({
          price: parseFloat($("fodderPrice").value),
          spare: parseFloat($("sparePrice").value),
        }),
      );
    } catch (e) {}
  }

  // The fodder level tracks the item level at the maximum transfer gap (−10);
  // an explicit edit sticks until the item level changes again.
  function syncFodderLevelDefault() {
    const itemLevel = readItemLevel();
    if (Number.isFinite(itemLevel)) {
      $("fodderLevel").value = Math.max(1, itemLevel - SF.fodder.MAX_LEVEL_GAP);
    }
  }

  // Millions-denominated optional money field: blank/invalid reads as 0.
  function readMillions(id) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) && v > 0 ? v * 1e6 : 0;
  }

  function fodderError(msg) {
    $("fodderResult").innerHTML = msg
      ? `<p class="opt-note opt-warn">${msg}</p>`
      : "";
  }

  function syncFodder() {
    if (activeTab !== "fodder") return;

    const itemLevel = readItemLevel();
    const fodderLevel = parseInt($("fodderLevel").value, 10);
    const formTarget = parseInt($("targetStar").value, 10);
    if (!Number.isFinite(itemLevel) || itemLevel < 1 || itemLevel > 300) {
      fodderError("Item level must be between 1 and 300.");
      return;
    }
    if (!Number.isFinite(fodderLevel) || fodderLevel < 1 || fodderLevel > 300) {
      fodderError("Fodder item level must be between 1 and 300.");
      return;
    }
    if (!Number.isFinite(formTarget) || formTarget < 2 || formTarget > 30) {
      fodderError("Target ★ must be between 2 and 30.");
      return;
    }
    // Zero-boom finishing only exists through 21★, and past 22★ every
    // strategy taps the same item identically — so the comparison runs to 22★.
    const goalStar = Math.min(formTarget, 22);
    if (goalStar < 16) {
      fodderError(
        "Foddering only matters from 16★ up — below that there are no booms to avoid, so just tap the item.",
      );
      return;
    }

    const result = SF.fodder.compare({
      itemLevel,
      fodderLevel,
      goalStar,
      fodderPrice: readMillions("fodderPrice"),
      sparePrice: readMillions("sparePrice"),
      baseOpts: {
        mvp: $("mvp").value,
        event: $("event").value,
        starCatching: $("starCatching").checked,
      },
    });
    renderFodderResult(result, { goalStar, formTarget, itemLevel, fodderLevel });
  }

  function renderFodderResult(result, ctx) {
    const { rawCheap, rawZero, strategies, best } = result;

    const summaryItems = [
      { k: "Best transfer", v: `at ${best.transferAt}★` },
      { k: "Expected cost", v: fmtMesos(best.total) },
      { k: "Fodder copies", v: "~" + best.copies.toFixed(1) },
    ];
    const summary =
      '<div class="opt-summary">' +
      summaryItems
        .map(
          (s) =>
            `<div><span class="opt-k">${s.k}</span><span class="opt-v">${s.v}</span></div>`,
        )
        .join("") +
      "</div>";

    // Only conditional warnings — the cards and the table carry the verdict.
    let notes = "";
    if (!result.levelGapOk) {
      notes += `<p class="opt-note opt-warn">Transfers accept a fodder 1–${SF.fodder.MAX_LEVEL_GAP} levels below the target — level ${ctx.fodderLevel} fodder can't transfer onto a level ${ctx.itemLevel} item.</p>`;
    }
    if (ctx.formTarget > ctx.goalStar) {
      notes += `<p class="opt-note">Compared up to ${ctx.goalStar}★ — past that every plan taps the same item.</p>`;
    }

    const rawRows = [
      {
        label: "Raw tap, Mode 1",
        sub: "Cheapest, booms a lot. Duh.",
        total: rawCheap.total,
        spares: `~${rawCheap.spares.toFixed(1)}`,
        copies: "—",
        cls: "",
      },
      {
        label: "Raw tap, zero-boom",
        sub: "SG 15–17 · Mode 4 18–21",
        total: rawZero.total,
        spares: "0",
        copies: "—",
        cls: "",
      },
    ];

    // Transferring far below the goal is always dominated — the target still
    // pays the expensive Mode 4 stars the fodder was meant to absorb — so
    // collapse everything under (goal − 1) into a single dismissive row and
    // only itemize the transfer stars actually worth weighing.
    const shown = [];
    const collapsed = [];
    for (const s of strategies) {
      if (s.transferAt < ctx.goalStar - 1 && s !== best) collapsed.push(s);
      else shown.push(s);
    }
    // Name the modes the finish taps actually use, so "0 booms" reads as a
    // plan and not an assumption: Mode 4 covers 18–21★, Safeguard 15–17★.
    // No star range here — "Transfer at N★" plus the goal already implies it,
    // and the sub must stay one line so rows keep their height.
    const tapsLabel = (startStar) => {
      const lo = Math.max(15, startStar);
      const hi = ctx.goalStar - 1;
      if (lo > 17) return "Mode 4 taps";
      if (hi <= 17) return "SG taps";
      return "SG+M4 taps";
    };
    const fodderRow = (s) => ({
      label: `Transfer at ${s.transferAt}★`,
      sub:
        s.startStar >= ctx.goalStar
          ? `${fmtMesos(s.fodderMesos)} fodder · no taps`
          : `${fmtMesos(s.fodderMesos)} fodder · ${fmtMesos(s.finishMesos)} ${tapsLabel(s.startStar)}`,
      total: s.total,
      spares: "0",
      copies: "~" + s.copies.toFixed(1),
      cls: s === best ? " class=\"fodder-best\"" : "",
    });
    const fodderRows = shown.map(fodderRow);
    if (collapsed.length > 0) {
      const cheapest = collapsed.reduce((m, s) => (s.total < m.total ? s : m));
      const range =
        collapsed.length === 1
          ? `${collapsed[0].transferAt}★`
          : `${collapsed[0].transferAt}–${collapsed[collapsed.length - 1].transferAt}★`;
      fodderRows.unshift({
        label: `Transfer at ${range}`,
        sub: "Just don't — too expensive",
        total: null,
        totalText: `≥ ${fmtMesos(cheapest.total)}`,
        spares: "0",
        copies: "—",
        cls: ' class="fodder-dominated"',
      });
    }

    const rows = rawRows
      .concat(fodderRows)
      .map(
        (r) =>
          `<tr${r.cls}><td>${r.label}${r.sub ? `<br><span class="table-sub">${r.sub}</span>` : ""}</td><td class="num">${r.totalText || fmtMesos(r.total)}</td><td class="num">${r.spares}</td><td class="num">${r.copies}</td></tr>`,
      )
      .join("");

    const table = `<table class="mode-table plan-table opt-table fodder-table">
      <thead><tr><th>Plan</th><th>Cost</th><th title="Expected booms of the target item — each destroys it and costs a spare">Booms</th><th title="Fodder items consumed (1 + expected fodder booms)">Copies</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

    $("fodderResult").innerHTML = summary + notes + table;
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("sf-form").addEventListener("submit", onSubmit);
    $("enhanceMode").addEventListener("input", syncEnhanceMode);
    $("event").addEventListener("change", () => {
      syncBoomTable();
      syncRateCostTable();
    });
    $("mvp").addEventListener("change", syncRateCostTable);
    $("itemLevel").addEventListener("change", () => {
      syncItemLevelCustom();
      syncEnhanceMode();
      syncFodderLevelDefault();
    });
    $("itemLevelCustom").addEventListener("input", () => {
      syncEnhanceMode();
      syncFodderLevelDefault();
    });
    $("starCatching").addEventListener("change", syncEnhanceMode);
    $("safeguard").addEventListener("change", () => {
      syncEnhanceMode();
      syncBoomTable();
    });
    // Tabs + per-star matrix.
    $("tab-quick").addEventListener("click", () => setTab("quick"));
    $("tab-perstar").addEventListener("click", () => setTab("perstar"));
    $("tab-optimize").addEventListener("click", () => setTab("optimize"));
    $("tab-fodder").addEventListener("click", () => setTab("fodder"));
    // Inputs the matrix's boom%/cost and active-range shading depend on. (The
    // mode slider and safeguard checkbox are Quick-only and don't feed it.)
    // They also feed the optimizer, so clear any stale recommendation too.
    [
      "event",
      "mvp",
      "starCatching",
      "itemLevel",
      "itemLevelCustom",
      "currentStar",
      "targetStar",
    ].forEach((id) => {
      const el = $(id);
      const evt = el.tagName === "INPUT" && el.type === "number" ? "input" : "change";
      el.addEventListener(evt, () => {
        syncPlanTable();
        clearOptResult();
        syncFodder();
      });
    });

    // Optimize tab controls.
    ["optBudget", "optSpares"].forEach((id) =>
      $(id).addEventListener("input", () => {
        saveOptSettings();
        clearOptResult();
      }),
    );
    $("optimizeBtn").addEventListener("click", runOptimize);
    loadOptSettings();

    // Fodder tab controls — closed-form, so recompute live on every change.
    $("fodderLevel").addEventListener("input", syncFodder);
    ["fodderPrice", "sparePrice"].forEach((id) =>
      $(id).addEventListener("input", () => {
        saveFodderSettings();
        syncFodder();
      }),
    );
    loadFodderSettings();
    syncFodderLevelDefault();

    // Theme: the toggle stores an explicit pick; OS switches only follow
    // through while the user hasn't made one.
    $("themeToggle").addEventListener("click", () => {
      applyTheme(currentTheme() === "light" ? "dark" : "light", true);
    });
    const lightMq = window.matchMedia("(prefers-color-scheme: light)");
    if (lightMq.addEventListener) {
      lightMq.addEventListener("change", (e) => {
        let stored = null;
        try {
          stored = localStorage.getItem(THEME_STORAGE_KEY);
        } catch (err) {}
        if (stored !== "light" && stored !== "dark") {
          applyTheme(e.matches ? "light" : "dark", false);
        }
      });
    }
    // Sync the toggle's label and the theme-color meta with the theme the
    // bootstrap script picked (and repaint nothing — no results exist yet).
    applyTheme(currentTheme(), false);

    syncItemLevelCustom();
    syncEnhanceMode();
    syncBoomTable();

    buildPlanTable();
    let savedTab = "quick";
    try {
      savedTab = localStorage.getItem(TAB_STORAGE_KEY) || "quick";
    } catch (e) {}
    setTab(savedTab);
  });
})();
