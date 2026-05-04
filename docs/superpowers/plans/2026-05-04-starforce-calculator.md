# Star Force Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static HTML/CSS/JS GMS Star Force calculator (Monte Carlo) modeled on brendonmay.github.io/starforceCalculator/, GMS-only, no Chance Time.

**Architecture:** Five static files served from the project root: `index.html` (form + results), `styles.css` (styling), `rates.js` (data), `simulator.js` (pure simulation logic), `app.js` (DOM wiring + canvas histogram). No build step, no dependencies. `simulator.js` is intentionally pure so it can be tested or driven from a console.

**Tech Stack:** Vanilla HTML5/CSS3/ES2017 JavaScript, Canvas 2D API.

**Note on testing:** The approved spec explicitly defers automated tests ("No automated tests in v1 — `simulator.js` is pure so they can be added later"). Verification in this plan is manual: each task ends with running the page in a browser and confirming behavior in the dev console or UI. This is a deliberate user decision, not a skill skip.

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Markup: form fields, results panel, histogram `<canvas>`. Includes the three JS files in order: rates → simulator → app. |
| `styles.css` | Layout (single column, responsive), metric cards, button, form field styling. |
| `rates.js` | Two exports on `window`: `KMS_RATES` (per-star `[s, m, d, b]` array) and `COST_COEFS` (per-star `{divisor, expo, mult}`). |
| `simulator.js` | Pure functions on `window`: `baseCost`, `applyRateModifiers`, `costMultiplier`, `boomDropStar`, `simulateOnce`, `runTrials`. |
| `app.js` | DOM wiring: read form, validate, call `runTrials`, render metrics + percentiles + histogram. |

All files live at the project root.

---

### Task 0: Initialize git repo

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Confirm we're in the project root**

Run: `pwd` (PowerShell: `Get-Location`)
Expected: `D:\Projetos\GitHub\sf-test`

- [ ] **Step 2: Initialize git**

Run:
```
git init -b main
```
Expected: "Initialized empty Git repository in D:/Projetos/GitHub/sf-test/.git/"

- [ ] **Step 3: Create `.gitignore`**

```
# OS
Thumbs.db
.DS_Store

# Editor
.vscode/
.idea/
*.swp
```

- [ ] **Step 4: Initial commit (spec + plan + gitignore)**

```
git add .gitignore docs/
git commit -m "chore: initial commit with spec and plan"
```
Expected: commit succeeds.

---

### Task 1: Create `rates.js` (data module)

**Files:**
- Create: `rates.js`

- [ ] **Step 1: Write `rates.js`**

```js
// GMS Star Force rates and cost coefficients.
// Rates: per current star, [success, maintain, decrease, boom]. Sum to 1.
// Cost coefficients: parameters for the meso cost formula.
// Source: serverDiffs.js from brendonmay/brendonmay.github.io.

(function (global) {
  const KMS_RATES = {
    0:  [0.95, 0.05, 0, 0],
    1:  [0.90, 0.10, 0, 0],
    2:  [0.85, 0.15, 0, 0],
    3:  [0.85, 0.15, 0, 0],
    4:  [0.80, 0.20, 0, 0],
    5:  [0.75, 0.25, 0, 0],
    6:  [0.70, 0.30, 0, 0],
    7:  [0.65, 0.35, 0, 0],
    8:  [0.60, 0.40, 0, 0],
    9:  [0.55, 0.45, 0, 0],
    10: [0.50, 0.50, 0, 0],
    11: [0.45, 0.55, 0, 0],
    12: [0.40, 0.60, 0, 0],
    13: [0.35, 0.65, 0, 0],
    14: [0.30, 0.70, 0, 0],
    15: [0.30, 0.679, 0, 0.021],
    16: [0.30, 0.679, 0, 0.021],
    17: [0.15, 0.782, 0, 0.068],
    18: [0.15, 0.782, 0, 0.068],
    19: [0.15, 0.765, 0, 0.085],
    20: [0.30, 0.595, 0, 0.105],
    21: [0.15, 0.7225, 0, 0.1275],
    22: [0.15, 0.68, 0, 0.17],
    23: [0.10, 0.72, 0, 0.18],
    24: [0.10, 0.72, 0, 0.18],
    25: [0.10, 0.72, 0, 0.18],
    26: [0.07, 0.744, 0, 0.186],
    27: [0.05, 0.76, 0, 0.19],
    28: [0.03, 0.776, 0, 0.194],
    29: [0.01, 0.792, 0, 0.198],
  };

  // {divisor, expo, mult} per current star (the star you're attempting from).
  const COST_COEFS = {};
  // 0..9 use the linear formula
  for (let s = 0; s <= 9; s++) COST_COEFS[s] = { divisor: 2500,  expo: 1,   mult: 1 };
  COST_COEFS[10] = { divisor: 40000, expo: 2.7, mult: 1 };
  COST_COEFS[11] = { divisor: 22000, expo: 2.7, mult: 1 };
  COST_COEFS[12] = { divisor: 15000, expo: 2.7, mult: 1 };
  COST_COEFS[13] = { divisor: 11000, expo: 2.7, mult: 1 };
  COST_COEFS[14] = { divisor: 7500,  expo: 2.7, mult: 1 };
  COST_COEFS[15] = { divisor: 20000, expo: 2.7, mult: 1 };
  COST_COEFS[16] = { divisor: 20000, expo: 2.7, mult: 1 };
  COST_COEFS[17] = { divisor: 20000, expo: 2.7, mult: 4 / 3 };
  COST_COEFS[18] = { divisor: 20000, expo: 2.7, mult: 20 / 7 };
  COST_COEFS[19] = { divisor: 20000, expo: 2.7, mult: 40 / 9 };
  COST_COEFS[20] = { divisor: 20000, expo: 2.7, mult: 1 };
  COST_COEFS[21] = { divisor: 20000, expo: 2.7, mult: 8 / 5 };
  for (let s = 22; s <= 29; s++) COST_COEFS[s] = { divisor: 20000, expo: 2.7, mult: 1 };

  global.KMS_RATES = KMS_RATES;
  global.COST_COEFS = COST_COEFS;
})(window);
```

- [ ] **Step 2: Verify each rates row sums to ~1.0**

Open a temporary `node` REPL or browser console (after creating a stub `test.html`), or use this PowerShell one-liner via Node if installed; otherwise skip and rely on the smoke test in Task 9. The rates were copied verbatim from the audited source — this is a sanity check.

If you have Node:
```
node -e "const f=require('fs');const s=f.readFileSync('rates.js','utf8');eval(s.replace(/window/g,'global'));for(let i=0;i<=29;i++){const t=KMS_RATES[i].reduce((a,b)=>a+b,0);console.log(i,t)}"
```
Expected: every line shows a value within 0.001 of 1.0.

If Node is unavailable, skip and proceed.

- [ ] **Step 3: Commit**

```
git add rates.js
git commit -m "feat: add GMS rates and cost coefficient tables"
```

---

### Task 2: Create `simulator.js` — `baseCost` and `boomDropStar`

**Files:**
- Create: `simulator.js`

- [ ] **Step 1: Write the initial `simulator.js`**

```js
// Pure simulation logic. No DOM access. Uses KMS_RATES and COST_COEFS from rates.js.

(function (global) {
  function baseCost(currentStar, itemLevel) {
    const c = global.COST_COEFS[currentStar];
    if (!c) throw new Error("No cost coefficient for star " + currentStar);
    const levelTier = Math.floor(itemLevel / 10) * 10;
    const raw = c.mult * Math.pow(levelTier, 3) * Math.pow(currentStar + 1, c.expo) / c.divisor + 10;
    return 100 * Math.round(raw);
  }

  function boomDropStar(star) {
    if (star < 20) return 12;
    if (star === 20) return 15;
    if (star < 23) return 17;
    if (star < 26) return 19;
    return 20;
  }

  global.SF = global.SF || {};
  global.SF.baseCost = baseCost;
  global.SF.boomDropStar = boomDropStar;
})(window);
```

- [ ] **Step 2: Manual verify `baseCost` against a known reference value**

Create a temporary `test.html` at the project root:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>SF tests</title></head>
<body><pre id="out"></pre>
<script src="rates.js"></script>
<script src="simulator.js"></script>
<script>
  const log = (...a) => document.getElementById("out").textContent += a.join(" ") + "\n";
  // 17->18 at level 160. Using the source formula:
  // mult=4/3, levelTier=160, expo=2.7, divisor=20000
  // raw = (4/3) * 160^3 * 18^2.7 / 20000 + 10
  // baseCost should be 100 * round(raw)
  log("baseCost(17, 160):", SF.baseCost(17, 160));
  log("baseCost(0, 160):", SF.baseCost(0, 160));
  log("boomDropStar(22):", SF.boomDropStar(22));   // 17
  log("boomDropStar(20):", SF.boomDropStar(20));   // 15
  log("boomDropStar(15):", SF.boomDropStar(15));   // 12
  log("boomDropStar(26):", SF.boomDropStar(26));   // 20
</script>
</body></html>
```

Open `test.html` in a browser. Confirm:
- `baseCost(17, 160)` is a positive 7+ digit number ending in 00 (because of `100 * round(...)`).
- `baseCost(0, 160)` is much smaller than `baseCost(17, 160)`.
- `boomDropStar` returns 17, 15, 12, 20 respectively.

- [ ] **Step 3: Commit**

```
git add simulator.js test.html
git commit -m "feat: add baseCost and boomDropStar to simulator"
```

---

### Task 3: Add `applyRateModifiers` to `simulator.js`

**Files:**
- Modify: `simulator.js`

- [ ] **Step 1: Append `applyRateModifiers` to `simulator.js`** (inside the IIFE, before the `global.SF.baseCost = ...` assignments)

Replace the IIFE body so it ends like this (full updated `simulator.js`):

```js
(function (global) {
  function baseCost(currentStar, itemLevel) {
    const c = global.COST_COEFS[currentStar];
    if (!c) throw new Error("No cost coefficient for star " + currentStar);
    const levelTier = Math.floor(itemLevel / 10) * 10;
    const raw = c.mult * Math.pow(levelTier, 3) * Math.pow(currentStar + 1, c.expo) / c.divisor + 10;
    return 100 * Math.round(raw);
  }

  function boomDropStar(star) {
    if (star < 20) return 12;
    if (star === 20) return 15;
    if (star < 23) return 17;
    if (star < 26) return 19;
    return 20;
  }

  // Returns adjusted [s, m, d, b] for one attempt. Does NOT handle the
  // 5/10/15 guaranteed-success short-circuit — the caller does that
  // before rolling.
  function applyRateModifiers(currentStar, opts) {
    const base = global.KMS_RATES[currentStar];
    let s = base[0], m = base[1], d = base[2], b = base[3];

    // Safeguard: convert boom -> maintain at 15/16/17.
    // Skip if 5/10/15 event applies at this exact star (caller already
    // short-circuits success on those, but we mirror reference logic for
    // the cost path).
    const sgActive =
      opts.safeguard &&
      currentStar >= 15 && currentStar <= 17 &&
      !(opts.event === "fivetenfifteen" && currentStar === 15);
    if (sgActive) {
      m += b;
      b = 0;
    }

    // Star Catching: success *= 1.05, redistribute leftover.
    if (opts.starCatching) {
      s = Math.min(1, s * 1.05);
      const left = 1 - s;
      if (d > 0) {
        const denom = d + b;
        d = denom > 0 ? d * left / denom : 0;
        b = left - d;
      } else {
        const denom = m + b;
        m = denom > 0 ? m * left / denom : left;
        b = left - m;
      }
    }

    return [s, m, d, b];
  }

  global.SF = global.SF || {};
  global.SF.baseCost = baseCost;
  global.SF.boomDropStar = boomDropStar;
  global.SF.applyRateModifiers = applyRateModifiers;
})(window);
```

- [ ] **Step 2: Append checks to `test.html`**

Add inside the existing `<script>` block, after the existing logs:

```js
log("---");
const r0 = SF.applyRateModifiers(15, {});
log("15 base:", r0.map(x => x.toFixed(4)).join(", "));
// Expect: 0.3000, 0.6790, 0.0000, 0.0210

const r1 = SF.applyRateModifiers(15, { safeguard: true });
log("15 safeguard:", r1.map(x => x.toFixed(4)).join(", "));
// Expect: 0.3000, 0.7000, 0.0000, 0.0000

const r2 = SF.applyRateModifiers(15, { starCatching: true });
log("15 starCatching:", r2.map(x => x.toFixed(4)).join(", "));
// Expect s=0.315, sum still ~1.0

const r3 = SF.applyRateModifiers(15, { safeguard: true, starCatching: true });
log("15 sg+sc:", r3.map(x => x.toFixed(4)).join(", "));
// Expect s=0.315, m=0.685, b=0
```

Reload `test.html` in the browser, confirm the values match the comments.

- [ ] **Step 3: Commit**

```
git add simulator.js test.html
git commit -m "feat: add applyRateModifiers (safeguard, star catching)"
```

---

### Task 4: Add `costMultiplier` and `simulateOnce` to `simulator.js`

**Files:**
- Modify: `simulator.js`

- [ ] **Step 1: Add `costMultiplier` and `simulateOnce` functions**

Insert these functions inside the IIFE, after `applyRateModifiers`:

```js
  // Returns the additive cost multiplier for one attempt.
  function costMultiplier(currentStar, opts) {
    let mult = 1;

    if (currentStar <= 15) {
      if (opts.mvp === "silver")  mult -= 0.03;
      if (opts.mvp === "gold")    mult -= 0.05;
      if (opts.mvp === "diamond") mult -= 0.10;
    }
    if (opts.event === "thirtyOff") mult -= 0.30;

    const sgActive =
      opts.safeguard &&
      currentStar >= 15 && currentStar <= 17 &&
      !(opts.event === "fivetenfifteen" && currentStar === 15);
    if (sgActive) mult += 2;

    return mult;
  }

  function simulateOnce(currentStar, targetStar, itemLevel, opts) {
    let star = currentStar;
    let totalCost = 0;
    let attempts = 0;
    let booms = 0;

    while (star < targetStar) {
      // 5/10/15 guaranteed success short-circuit
      const guaranteed =
        opts.event === "fivetenfifteen" &&
        (star === 5 || star === 10 || star === 15);

      const cost = Math.round(baseCost(star, itemLevel) * costMultiplier(star, opts));
      totalCost += cost;
      attempts += 1;

      if (guaranteed) {
        star += 1;
        continue;
      }

      const [s, m, d /*, b */] = applyRateModifiers(star, opts);
      const r = Math.random();
      if (r < s) {
        star += 1;
      } else if (r < s + m) {
        // maintain
      } else if (r < s + m + d) {
        star = Math.max(0, star - 1);
      } else {
        star = boomDropStar(star);
        booms += 1;
      }
    }

    return { totalCost, attempts, booms };
  }
```

And add the exports at the bottom of the IIFE:

```js
  global.SF.costMultiplier = costMultiplier;
  global.SF.simulateOnce = simulateOnce;
```

- [ ] **Step 2: Append checks to `test.html`**

```js
log("---");
log("costMult(15, {}):", SF.costMultiplier(15, {}));                                  // 1
log("costMult(15, mvp=diamond):", SF.costMultiplier(15, { mvp: "diamond" }));         // 0.9
log("costMult(16, mvp=diamond):", SF.costMultiplier(16, { mvp: "diamond" }));         // 1 (cap is 15)
log("costMult(15, sg):", SF.costMultiplier(15, { safeguard: true }));                 // 3
log("costMult(15, sg+30off):", SF.costMultiplier(15, { safeguard: true, event: "thirtyOff" })); // 2.7

// simulateOnce: 0->5, no booms possible, attempts >= 5
const trial = SF.simulateOnce(0, 5, 160, {});
log("simulateOnce(0->5):", JSON.stringify(trial));
// Expect attempts >= 5 and booms == 0
```

Reload `test.html`, confirm values match comments.

- [ ] **Step 3: Commit**

```
git add simulator.js test.html
git commit -m "feat: add costMultiplier and simulateOnce"
```

---

### Task 5: Add `runTrials` (statistics aggregation) to `simulator.js`

**Files:**
- Modify: `simulator.js`

- [ ] **Step 1: Add `runTrials` and helpers**

Insert inside the IIFE, after `simulateOnce`:

```js
  function percentile(sortedAsc, p) {
    if (sortedAsc.length === 0) return 0;
    const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
    return sortedAsc[idx];
  }

  function bucketize(sortedAsc, bucketCount) {
    if (sortedAsc.length === 0) return [];
    const min = sortedAsc[0];
    const max = sortedAsc[sortedAsc.length - 1];
    if (max === min) return [{ from: min, to: max, count: sortedAsc.length }];
    const width = (max - min) / bucketCount;
    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
      buckets.push({ from: min + i * width, to: min + (i + 1) * width, count: 0 });
    }
    for (const v of sortedAsc) {
      let i = Math.floor((v - min) / width);
      if (i >= bucketCount) i = bucketCount - 1;
      buckets[i].count += 1;
    }
    return buckets;
  }

  function runTrials(input) {
    const { currentStar, targetStar, itemLevel, trials } = input;
    const opts = {
      starCatching: !!input.starCatching,
      safeguard:    !!input.safeguard,
      mvp:          input.mvp || "none",
      event:        input.event || "none",
    };

    const costs = new Array(trials);
    let sumCost = 0, sumBooms = 0, sumAttempts = 0;

    for (let i = 0; i < trials; i++) {
      const t = simulateOnce(currentStar, targetStar, itemLevel, opts);
      costs[i] = t.totalCost;
      sumCost += t.totalCost;
      sumBooms += t.booms;
      sumAttempts += t.attempts;
    }

    costs.sort((a, b) => a - b);

    return {
      trials,
      avgCost:     sumCost / trials,
      medianCost:  percentile(costs, 0.5),
      p25:         percentile(costs, 0.25),
      p75:         percentile(costs, 0.75),
      p95:         percentile(costs, 0.95),
      minCost:     costs[0],
      maxCost:     costs[costs.length - 1],
      avgBooms:    sumBooms / trials,
      avgAttempts: sumAttempts / trials,
      buckets:     bucketize(costs, 30),
    };
  }

  global.SF.runTrials = runTrials;
```

- [ ] **Step 2: Append a small Monte Carlo sanity check to `test.html`**

```js
log("---");
const t0 = performance.now();
const stats = SF.runTrials({
  currentStar: 0, targetStar: 17, itemLevel: 160, trials: 5000,
});
const t1 = performance.now();
log("0->17, 5000 trials in", (t1 - t0).toFixed(0), "ms");
log("avgCost:", stats.avgCost.toFixed(0));
log("medianCost:", stats.medianCost);
log("avgBooms:", stats.avgBooms.toFixed(3));
log("avgAttempts:", stats.avgAttempts.toFixed(2));
log("p95/min/max:", stats.p95, stats.minCost, stats.maxCost);
log("buckets:", stats.buckets.length);
```

Reload `test.html`. Sanity:
- Run completes in < 2 seconds.
- `avgBooms` is small but nonzero (a couple of attempts at 15→16, 16→17 with ~2% boom each).
- `avgAttempts` > 17 (some maintains and the rare boom).
- `buckets.length` is 30 (or 1 if all costs identical, won't happen here).

- [ ] **Step 3: Commit**

```
git add simulator.js test.html
git commit -m "feat: add runTrials with percentiles and histogram buckets"
```

---

### Task 6: Create `index.html` (form + results scaffolding)

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Star Force Calculator (GMS)</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="container">
    <h1>Star Force Calculator <span class="badge">GMS</span></h1>
    <p class="subtitle">Monte Carlo simulator. Rates and cost formula match the current GMS Star Force.</p>

    <form id="sf-form" class="form">
      <div class="row">
        <label>Item Level
          <input type="number" id="itemLevel" min="1" max="300" value="160" />
        </label>
        <label>Trials
          <input type="number" id="trials" min="1" max="100000" value="1000" />
        </label>
      </div>

      <div class="row">
        <label>Current ★
          <input type="number" id="currentStar" min="0" max="29" value="0" />
        </label>
        <label>Target ★
          <input type="number" id="targetStar" min="1" max="30" value="22" />
        </label>
      </div>

      <div class="row">
        <label>MVP Discount
          <select id="mvp">
            <option value="none">None</option>
            <option value="silver">Silver (3%)</option>
            <option value="gold">Gold (5%)</option>
            <option value="diamond">Diamond (10%)</option>
          </select>
        </label>
        <label>Event
          <select id="event">
            <option value="none">None</option>
            <option value="fivetenfifteen">5/10/15★ guaranteed</option>
            <option value="thirtyOff">30% off cost</option>
          </select>
        </label>
      </div>

      <div class="row checks">
        <label><input type="checkbox" id="starCatching" /> Star Catching (+5%)</label>
        <label><input type="checkbox" id="safeguard" /> Safeguard (15→18)</label>
      </div>

      <div class="row">
        <button type="submit" id="calc">Calculate</button>
        <span id="error" class="error" role="alert" aria-live="polite"></span>
      </div>
    </form>

    <section id="results" class="results hidden">
      <div class="metrics">
        <div class="card"><div class="label">Average cost</div><div class="value" id="m-avg">—</div></div>
        <div class="card"><div class="label">Median cost</div><div class="value" id="m-median">—</div></div>
        <div class="card"><div class="label">Avg booms</div><div class="value" id="m-booms">—</div></div>
        <div class="card"><div class="label">Avg attempts</div><div class="value" id="m-attempts">—</div></div>
      </div>

      <table class="percentiles">
        <thead><tr><th>Percentile</th><th>Cost</th></tr></thead>
        <tbody id="pct-body"></tbody>
      </table>

      <h2>Cost distribution</h2>
      <canvas id="histogram" width="800" height="240"></canvas>
    </section>
  </main>

  <script src="rates.js"></script>
  <script src="simulator.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open in browser to confirm markup loads**

Open `index.html`. Expected: form renders even without `styles.css` and `app.js` (those are next). No console errors except a 404 for `app.js` and `styles.css` until those exist. Acceptable for now.

- [ ] **Step 3: Commit**

```
git add index.html
git commit -m "feat: add index.html with form and results scaffold"
```

---

### Task 7: Create `styles.css`

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Write `styles.css`**

```css
:root {
  --bg: #0f1115;
  --panel: #161a21;
  --panel-2: #1d222b;
  --text: #e7ebf3;
  --muted: #8b94a7;
  --accent: #f5b454;
  --accent-2: #ffd591;
  --error: #ff6b6b;
  --border: #262c38;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.container {
  max-width: 880px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}

h1 {
  font-size: 28px;
  margin: 0 0 4px;
}

.badge {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--accent);
  color: #1c1304;
  border-radius: 999px;
  vertical-align: middle;
  margin-left: 8px;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 24px;
}

.form {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}

.row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.row:last-child { margin-bottom: 0; }

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 200px;
  font-size: 13px;
  color: var(--muted);
}

input[type="number"], select {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
}

input[type="number"]:focus, select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.checks label {
  flex: 0 1 auto;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  color: var(--text);
}

button {
  background: var(--accent);
  color: #1c1304;
  border: 0;
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

button:hover { background: var(--accent-2); }

.error {
  color: var(--error);
  align-self: center;
}

.results { margin-top: 24px; }
.results.hidden { display: none; }

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
}

.card .label {
  font-size: 12px;
  color: var(--muted);
}

.card .value {
  font-size: 20px;
  font-weight: 600;
  margin-top: 2px;
}

.percentiles {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 16px;
}

.percentiles th, .percentiles td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.percentiles tr:last-child td { border-bottom: 0; }

h2 {
  font-size: 16px;
  margin: 16px 0 8px;
  color: var(--muted);
  font-weight: 500;
}

#histogram {
  width: 100%;
  max-width: 800px;
  height: 240px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: block;
}
```

- [ ] **Step 2: Reload `index.html` in the browser**

Confirm: form has dark theme, fields are styled, button is amber. Results section is hidden (`.results.hidden`).

- [ ] **Step 3: Commit**

```
git add styles.css
git commit -m "feat: add styles.css with dark theme"
```

---

### Task 8: Create `app.js` (DOM wiring + metric/percentile rendering)

**Files:**
- Create: `app.js`

- [ ] **Step 1: Write `app.js` (without histogram yet)**

```js
(function () {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  function readInputs() {
    return {
      itemLevel:    parseInt($("itemLevel").value, 10),
      currentStar:  parseInt($("currentStar").value, 10),
      targetStar:   parseInt($("targetStar").value, 10),
      trials:       parseInt($("trials").value, 10),
      mvp:          $("mvp").value,
      event:        $("event").value,
      starCatching: $("starCatching").checked,
      safeguard:    $("safeguard").checked,
    };
  }

  function validate(input) {
    if (!Number.isFinite(input.itemLevel) || input.itemLevel < 1 || input.itemLevel > 300)
      return "Item level must be between 1 and 300.";
    if (!Number.isFinite(input.currentStar) || input.currentStar < 0 || input.currentStar > 29)
      return "Current ★ must be between 0 and 29.";
    if (!Number.isFinite(input.targetStar) || input.targetStar < 1 || input.targetStar > 30)
      return "Target ★ must be between 1 and 30.";
    if (input.targetStar <= input.currentStar)
      return "Target ★ must be greater than Current ★.";
    if (!Number.isFinite(input.trials) || input.trials < 1 || input.trials > 100000)
      return "Trials must be between 1 and 100000.";
    return null;
  }

  function renderMetrics(stats) {
    $("m-avg").textContent      = fmt(stats.avgCost);
    $("m-median").textContent   = fmt(stats.medianCost);
    $("m-booms").textContent    = stats.avgBooms.toFixed(2);
    $("m-attempts").textContent = stats.avgAttempts.toFixed(1);

    const rows = [
      ["25th percentile", stats.p25],
      ["Median (50th)",   stats.medianCost],
      ["75th percentile", stats.p75],
      ["95th percentile", stats.p95],
      ["Min",             stats.minCost],
      ["Max",             stats.maxCost],
    ];
    $("pct-body").innerHTML = rows
      .map(([label, val]) => `<tr><td>${label}</td><td>${fmt(val)}</td></tr>`)
      .join("");
  }

  function onSubmit(e) {
    e.preventDefault();
    const errEl = $("error");
    errEl.textContent = "";

    const input = readInputs();
    const err = validate(input);
    if (err) {
      errEl.textContent = err;
      return;
    }

    const stats = SF.runTrials(input);
    $("results").classList.remove("hidden");
    renderMetrics(stats);
    // Histogram drawing comes in Task 9.
    if (typeof drawHistogram === "function") drawHistogram(stats.buckets);
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("sf-form").addEventListener("submit", onSubmit);
  });
})();
```

- [ ] **Step 2: Reload `index.html`, click Calculate**

Default input is 0★→22★, 1000 trials. Expected:
- Results panel becomes visible.
- "Average cost" and "Median cost" show large numbers.
- "Avg booms" is a small fractional number (~1–3 booms across 17→22 attempts).
- Percentiles table populated.
- Console shows no errors.
- Histogram canvas visible but blank (drawn next task).

Try also: set Current ★ = 25, Target ★ = 22 → click Calculate → inline error appears, results don't update.

- [ ] **Step 3: Commit**

```
git add app.js
git commit -m "feat: wire form, validation, and metric rendering"
```

---

### Task 9: Add histogram canvas rendering to `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add `drawHistogram` function**

Add this function inside the existing IIFE in `app.js`, after `renderMetrics`:

```js
  function drawHistogram(buckets) {
    const canvas = $("histogram");
    const ctx = canvas.getContext("2d");

    // High-DPI: scale backing store to device pixels.
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (!buckets || buckets.length === 0) return;

    const padL = 36, padR = 12, padT = 12, padB = 24;
    const w = cssW - padL - padR;
    const h = cssH - padT - padB;

    const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1;
    const barW = w / buckets.length;

    // Bars
    ctx.fillStyle = "#f5b454";
    for (let i = 0; i < buckets.length; i++) {
      const barH = (buckets[i].count / maxCount) * h;
      const x = padL + i * barW;
      const y = padT + (h - barH);
      ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
    }

    // Axis line
    ctx.strokeStyle = "#262c38";
    ctx.beginPath();
    ctx.moveTo(padL, padT + h + 0.5);
    ctx.lineTo(padL + w, padT + h + 0.5);
    ctx.stroke();

    // X-axis labels: min and max bucket values
    ctx.fillStyle = "#8b94a7";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "top";
    const fmtShort = (n) => {
      if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
      if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(0) + "k";
      return String(Math.round(n));
    };
    ctx.textAlign = "left";
    ctx.fillText(fmtShort(buckets[0].from), padL, padT + h + 6);
    ctx.textAlign = "right";
    ctx.fillText(fmtShort(buckets[buckets.length - 1].to), padL + w, padT + h + 6);

    // Y-axis label: max count
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(String(maxCount), padL - 6, padT);
  }
```

- [ ] **Step 2: Reload `index.html`, click Calculate**

Expected:
- A histogram of amber bars fills the canvas.
- Bars show a right-skewed distribution typical for SF cost (long tail toward expensive trials with multiple booms).
- X-axis shows min and max cost (formatted as `XXXk` or `X.XB`).
- Y-axis shows the peak bucket count.

- [ ] **Step 3: Commit**

```
git add app.js
git commit -m "feat: add histogram rendering on canvas"
```

---

### Task 10: Final smoke test and cleanup

**Files:**
- (No code changes unless smoke test surfaces a bug.)

- [ ] **Step 1: Run all five smoke checks from the spec**

In `index.html`:

1. **0 → 10, defaults**: Click Calculate. Expected: low cost (under ~10M for level 160), `avg booms ≈ 0`, `avg attempts ≈ 12–14`.
2. **17 → 22, safeguard off**: Expected: noticeable booms (typical: 0.5–1.5), high cost.
3. **17 → 22, safeguard on**: Booms drop sharply (only 18→19, 19→20, 20→21, 21→22 can boom). Cost rises noticeably on the safeguarded rows.
4. **0 → 15, event = 5/10/15**: `avg booms = 0`, attempts roughly = (5 + 5 + 5) minus some discount because the 5★/10★/15★ attempts always succeed.
5. **0 → 22, event = 30% off**: `avg cost` should be lower than the same run without the event, by roughly 30%.

If any smoke check fails (e.g., cost off by 10×), open `test.html`, narrow down the failing helper, fix, re-test.

- [ ] **Step 2: Compare one configuration against the reference site**

Open https://brendonmay.github.io/starforceCalculator/ in another tab, enter:
- Item Level 160, Item Type Regular, Server GMS, Event "No Event"
- Star Catching off, Safeguard off
- Current 17, Target 22
- 1000 trials

Run it. Run the same on our calculator. Average cost should be within ~10% (Monte Carlo noise on 1000 trials is ~3-5% but compounded by simulation variance, 10% is a safe band). Average booms should be within ±0.3.

If they're far apart, check `costMultiplier` and the cost coefficient table — those are the most likely culprits.

- [ ] **Step 3: Remove or commit `test.html`**

Decide: keep it (useful for debugging) or remove it. If keeping, commit; if removing:
```
git rm test.html
git commit -m "chore: remove dev test page"
```

If keeping (recommended):
```
git add test.html
git commit -m "chore: keep dev test page for future debugging"
```

(If `test.html` is already committed and unchanged, this step is a no-op.)

- [ ] **Step 4: Final tag commit**

```
git add -A
git status
```
If clean: done. If anything is uncommitted (e.g., minor smoke-test fixes), commit with a descriptive message before declaring done.

---

## Self-Review Notes

**Spec coverage:** Each spec section maps to tasks: rates table → Task 1; cost formula → Tasks 1+2; modifier rules → Tasks 3+4; simulation algorithm → Tasks 4+5; UI layout → Tasks 6+7; outputs → Tasks 8+9; edge cases → Task 8 validation; testing smoke checks → Task 10.

**Type consistency:** `applyRateModifiers` is referenced in Tasks 3, 4, 5 with the same signature. `runTrials` returns the object consumed in `renderMetrics` and `drawHistogram` — fields match (`avgCost`, `medianCost`, `avgBooms`, `avgAttempts`, `p25/p75/p95`, `minCost`, `maxCost`, `buckets`).

**No placeholders:** All steps include exact code or exact commands. The "verify" steps describe expected output; if a tester sees something else, the spec hands them where to look.

**Deferred:** Automated tests are deliberately deferred per the approved spec. Verification is manual via `test.html` and the smoke checks in Task 10.
