# Star Force Calculator — Design

Date: 2026-05-04
Status: Draft

## Goal

A static HTML/CSS/JS page that simulates GMS MapleStory star forcing via Monte Carlo. The user picks current ★, target ★, item level, modifiers, and trial count; the page reports cost statistics, boom counts, and a cost-distribution histogram. Modeled on https://brendonmay.github.io/starforceCalculator/, but GMS-only and without Chance Time.

## Scope

**In scope**
- GMS rates only (`kmsRates` table, 0★ → 30★)
- Regular items (no Tyrant)
- Star Catching, Safeguard, MVP discount, 5/10/15 and 30%-off events
- Cost statistics (mean, median, p25/p75/p95, min, max)
- Boom and attempt averages
- Histogram of cost distribution

**Out of scope (explicitly)**
- Chance Time mechanic (two consecutive fails → guaranteed success). User decision.
- Other servers (Pre-Savior, Savior, TMS, TMSR, KMS event variants)
- Tyrant items / AEE
- Multiple events stacked (single-select)
- Per-star detailed breakdown chart (just an aggregate histogram)
- Persistence / shareable URLs

## Files

```
index.html      Form, results panel, canvas
styles.css      Styling
rates.js        kmsRates table + per-star cost coefficients
simulator.js    Pure simulation: runTrials(input) -> stats
app.js          DOM wiring + histogram rendering
```

`simulator.js` is pure (no DOM access) so it can be unit-tested or driven from a console.

## Inputs

| Field | Type | Default | Notes |
|---|---|---|---|
| Item Level | int (1–300) | 160 | Used by cost formula |
| Current Star | int (0–29) | 0 | Must be < Target |
| Target Star | int (1–30) | 22 | Must be > Current |
| Star Catching | bool | off | +5% multiplicative success |
| Safeguard | bool | off | Active only on attempts at 15/16/17 |
| MVP Discount | enum: None / Silver 3% / Gold 5% / Diamond 10% | None | Only applies to attempts at ≤15★ |
| Event | enum: None / 5★/10★/15★ guaranteed / 30% off cost | None | Single-select |
| Trials | int (1–100000) | 1000 | Monte Carlo iteration count |

Form-level validation: Target > Current; trials within bounds; integer fields are integers.

## Outputs

Top-level metric cards:
- Average cost
- Median cost
- Average booms
- Average attempts

Distribution table:
- 25th / 50th / 75th / 95th percentile cost
- Min cost / Max cost

Histogram: 30 evenly-spaced cost buckets across [min, max], drawn on a `<canvas>` with vanilla 2D context — no chart library.

## Rates table (`rates.js`)

Per-star `[success, maintain, decrease, boom]`, summing to 1:

```
0:  [.95, .05, 0, 0]      15: [.30, .679, 0, .021]
1:  [.90, .10, 0, 0]      16: [.30, .679, 0, .021]
2:  [.85, .15, 0, 0]      17: [.15, .782, 0, .068]
3:  [.85, .15, 0, 0]      18: [.15, .782, 0, .068]
4:  [.80, .20, 0, 0]      19: [.15, .765, 0, .085]
5:  [.75, .25, 0, 0]      20: [.30, .595, 0, .105]
6:  [.70, .30, 0, 0]      21: [.15, .7225, 0, .1275]
7:  [.65, .35, 0, 0]      22: [.15, .68, 0, .17]
8:  [.60, .40, 0, 0]      23: [.10, .72, 0, .18]
9:  [.55, .45, 0, 0]      24: [.10, .72, 0, .18]
10: [.50, .50, 0, 0]      25: [.10, .72, 0, .18]
11: [.45, .55, 0, 0]      26: [.07, .744, 0, .186]
12: [.40, .60, 0, 0]      27: [.05, .76, 0, .19]
13: [.35, .65, 0, 0]      28: [.03, .776, 0, .194]
14: [.30, .70, 0, 0]      29: [.01, .792, 0, .198]
```

(Note: `decrease` is always 0 in current GMS rates — the column exists for symmetry / future extension.)

## Cost formula

Adapted verbatim from `kmsMesoFn` / `preSaviorMesoFn` / `makeMesoFn` in serverDiffs.js:

```js
baseCost(star, level) =
  100 * round( extraMult * (floor(level/10) * 10)^3 * (star+1)^expo / divisor + 10 )
```

Per-star coefficients (current → next):

| Star | divisor | expo | extraMult |
|---|---|---|---|
| 0–9  | 2500 | 1   | 1 |
| 10   | 40000 | 2.7 | 1 |
| 11   | 22000 | 2.7 | 1 |
| 12   | 15000 | 2.7 | 1 |
| 13   | 11000 | 2.7 | 1 |
| 14   | 7500  | 2.7 | 1 |
| 15–16 | 20000 | 2.7 | 1 |
| 17   | 20000 | 2.7 | 4/3 |
| 18   | 20000 | 2.7 | 20/7 |
| 19   | 20000 | 2.7 | 40/9 |
| 20   | 20000 | 2.7 | 1 |
| 21   | 20000 | 2.7 | 8/5 |
| 22–29 | 20000 | 2.7 | 1 |

## Modifier application order (per attempt)

Applied in `simulator.js` for each attempt at `currentStar`. Order matches the reference's `determineOutcome` and `attemptCost`.

**Outcome rates** (start with base `[s, m, d, b]` from `kmsRates[currentStar]`):

1. **Event guaranteed-success**: if event is `5/10/15` and `currentStar ∈ {5, 10, 15}`, return `Success` directly — no roll, no rate adjustment.
2. **Safeguard** (only if toggle on, only at `currentStar ∈ {15, 16, 17}`): `m += b; b = 0`. Skip if 5/10/15 event applies at this star.
3. **Star Catching** (last, after safeguard): `s = min(1, s * 1.05)`; let `left = 1 - s`; if `d > 0`: `d = d * left / (d + b); b = left - d`; else `m = m * left / (m + b); b = left - m`.

**Cost** — single multiplier, modifiers added (NOT chained):

```
mult = 1
if MVP=Silver  and currentStar <= 15: mult -= 0.03
if MVP=Gold    and currentStar <= 15: mult -= 0.05
if MVP=Diamond and currentStar <= 15: mult -= 0.10
if event = "30% off":                 mult -= 0.30
if Safeguard and currentStar in {15,16,17}
   and not (event=5/10/15 and currentStar=15):
                                       mult += 2     # adds, doesn't multiply
cost = round(baseCost(currentStar, level) * mult)
```

So Safeguard + 30% off at 15★ = `1 - 0.3 + 2 = 2.7×` cost (not `3 × 0.7 = 2.1×`).

## Simulation algorithm

```
function simulateOnce(currentStar, targetStar, level, opts):
  star = currentStar
  totalCost = 0
  attempts = 0
  booms = 0
  while star < targetStar:
    rates = applyModifiers(baseRates[star], opts, star)
    cost = applyCostModifiers(baseCost(star, level), opts, star)
    totalCost += cost
    attempts += 1
    r = random()
    if r < rates.s:        star += 1
    elif r < s+m:          // maintain — no change
    elif r < s+m+d:        star -= 1            // decrease (always 0 here)
    else:                  star = boomDropStar(star) // boom
                           booms += 1
  return { totalCost, attempts, booms }

runTrials(input):
  results = [simulateOnce(...) for _ in 0..trials-1]
  costs = sorted(results.totalCost)
  return {
    avgCost, medianCost, p25, p75, p95,
    minCost, maxCost,
    avgBooms, avgAttempts,
    histogramBuckets: bucketize(costs, 30)
  }
```

Boom drop level depends on the star you boomed at (from `getBoomStar` in main.js, GMS branch):

```
boomDropStar(star):
  star <  20: -> 12
  star == 20: -> 15
  star <  23: -> 17   (i.e., 21, 22)
  star <  26: -> 19   (i.e., 23, 24, 25)
  star >= 26: -> 20
```

## UI layout

Single-column responsive layout:

```
┌─────────────────────────────────┐
│  Star Force Calculator          │
├─────────────────────────────────┤
│  [Form: inputs above]           │
│  [Calculate button]             │
├─────────────────────────────────┤
│  Average     Median             │
│  XXX,XXX     XXX,XXX            │
│  Avg Booms   Avg Attempts       │
│  X.XX        XX.XX              │
├─────────────────────────────────┤
│  Percentiles table              │
├─────────────────────────────────┤
│  [Histogram canvas]             │
└─────────────────────────────────┘
```

Calculate is synchronous; for 100k trials it should still complete within a few hundred ms. If it ever feels slow we can move to a Web Worker, but not in v1.

## Edge cases

- Current ≥ Target: disable Calculate, show inline error.
- Trials = 0 or non-integer: validate, show error.
- Item level outside 1–300: clamp on submit, show warning.
- Boom at exactly 12★ (boomed item drops to 12★, then has to climb again — handled by the simulator loop naturally).
- 5/10/15 event at current ≥ target+1 (e.g. starting at 15 with event): event still applies, so first attempt is guaranteed; afterwards rates are normal.

## Testing

Manual smoke checks after build:
- 0 → 10 with default settings: should be cheap, ~zero booms.
- 17 → 22 with safeguard off: noticeable boom rate.
- 17 → 22 with safeguard on: ~zero booms but ~3× cost on the safeguarded rows.
- 5/10/15 event from 0 → 15: lower attempt count, no booms below 15.
- Compare a couple of values against the reference site for sanity (within Monte Carlo noise).

No automated tests in v1 — `simulator.js` is pure so they can be added later.

## Out-of-scope follow-ups (if user asks later)

- Chance Time mechanic
- Tyrant / AEE items
- Other servers
- Per-star attempt breakdown
- Web Worker for very large trial counts
- URL-encoded input state for shareable links
