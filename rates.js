// GMS Star Force rates and cost coefficients.
// Rates: per current star, [success, maintain, boom]. Sum to 1.
// Cost coefficients: parameters for the meso cost formula.
// Source: serverDiffs.js from brendonmay/brendonmay.github.io.
//
// Star Catching was removed from the game. Nexon folded its +5% relative
// success bonus into the displayed rates, so every triple below is the
// post-removal in-game rate. Success is the old base times 1.05. The
// remainder splits across maintain and boom in their old proportion.
// Confirmed 1:1 against the in-game panel at 18 stars on a level 160 item,
// across all four Enhancement Modes: 15.75/77.51/6.74, 12.60/83.03/4.37,
// 10.50/87.71/1.79 and 8.40/91.60/0.00.

(function (global) {
  const GMS_RATES = {
    0: [0.9975, 0.0025, 0],
    1: [0.945, 0.055, 0],
    2: [0.8925, 0.1075, 0],
    3: [0.8925, 0.1075, 0],
    4: [0.84, 0.16, 0],
    5: [0.7875, 0.2125, 0],
    6: [0.735, 0.265, 0],
    7: [0.6825, 0.3175, 0],
    8: [0.63, 0.37, 0],
    9: [0.5775, 0.4225, 0],
    10: [0.525, 0.475, 0],
    11: [0.4725, 0.5275, 0],
    12: [0.42, 0.58, 0],
    13: [0.3675, 0.6325, 0],
    14: [0.315, 0.685, 0],
    15: [0.315, 0.66445, 0.02055],
    16: [0.315, 0.66445, 0.02055],
    17: [0.1575, 0.7751, 0.0674],
    18: [0.1575, 0.7751, 0.0674],
    19: [0.1575, 0.75825, 0.08425],
    20: [0.315, 0.58225, 0.10275],
    21: [0.1575, 0.716125, 0.126375],
    22: [0.1575, 0.674, 0.1685],
    23: [0.105, 0.716, 0.179],
    24: [0.105, 0.716, 0.179],
    25: [0.105, 0.716, 0.179],
    26: [0.0735, 0.7412, 0.1853],
    27: [0.0525, 0.758, 0.1895],
    28: [0.0315, 0.7748, 0.1937],
    29: [0.0105, 0.7916, 0.1979],
  };

  const COST_COEFS = {};
  for (let s = 0; s <= 9; s++)
    COST_COEFS[s] = { divisor: 2500, expo: 1, mult: 1 };
  COST_COEFS[10] = { divisor: 40000, expo: 2.7, mult: 1 };
  COST_COEFS[11] = { divisor: 22000, expo: 2.7, mult: 1 };
  COST_COEFS[12] = { divisor: 15000, expo: 2.7, mult: 1 };
  COST_COEFS[13] = { divisor: 11000, expo: 2.7, mult: 1 };
  COST_COEFS[14] = { divisor: 7500, expo: 2.7, mult: 1 };
  COST_COEFS[15] = { divisor: 20000, expo: 2.7, mult: 1 };
  COST_COEFS[16] = { divisor: 20000, expo: 2.7, mult: 1 };
  COST_COEFS[17] = { divisor: 20000, expo: 2.7, mult: 4 / 3 };
  COST_COEFS[18] = { divisor: 20000, expo: 2.7, mult: 20 / 7 };
  COST_COEFS[19] = { divisor: 20000, expo: 2.7, mult: 40 / 9 };
  COST_COEFS[20] = { divisor: 20000, expo: 2.7, mult: 1 };
  COST_COEFS[21] = { divisor: 20000, expo: 2.7, mult: 8 / 5 };
  for (let s = 22; s <= 29; s++)
    COST_COEFS[s] = { divisor: 20000, expo: 2.7, mult: 1 };

  // Enhancement Mode — the newer GMS star-force system (replaces the Safeguard
  // model in-game for stars 15→21). A 1–4 slider trades higher meso cost for a
  // lower destroy chance. Modes do not exist below 15★ (no boom) or at 22★+.
  //
  // Each entry, indexed by (mode - 1), carries:
  //   mult:    cost multiplier applied on top of the unchanged baseCost formula
  //   success: success chance, as the game displays it now
  //   boom:    destroy chance. maintain = 1 - success - boom
  //
  // Mode 1 reproduces the vanilla GMS_RATES and base cost exactly (verified
  // against in-game values at item levels 160 and 200). Values 2–4 are measured.
  // Cost multipliers cluster into two tiers: 1/1.5/2.5/3 (15–17) and
  // 1/2/3.5/6.5 (18–21). Rates are stored verbatim — the per-mode reductions are
  // not a clean closed form, so a lookup table is the accurate representation.
  //
  // These are post-Star-Catching-removal rates, same as GMS_RATES above.
  const ENHANCE_MODE = {
    15: [
      { mult: 1, success: 0.315, boom: 0.02055 },
      { mult: 1.5, success: 0.315, boom: 0.0137 },
      { mult: 2.5, success: 0.315, boom: 0.00685 },
      { mult: 3, success: 0.315, boom: 0 },
    ],
    16: [
      { mult: 1, success: 0.315, boom: 0.02055 },
      { mult: 1.5, success: 0.315, boom: 0.0137 },
      { mult: 2.5, success: 0.315, boom: 0.00685 },
      { mult: 3, success: 0.315, boom: 0 },
    ],
    17: [
      { mult: 1, success: 0.1575, boom: 0.0674 },
      { mult: 1.5, success: 0.1575, boom: 0.042125 },
      { mult: 2.5, success: 0.1575, boom: 0.01685 },
      { mult: 3, success: 0.1575, boom: 0 },
    ],
    18: [
      { mult: 1, success: 0.1575, boom: 0.0674 },
      { mult: 2, success: 0.126, boom: 0.0437 },
      { mult: 3.5, success: 0.105, boom: 0.0179 },
      { mult: 6.5, success: 0.084, boom: 0 },
    ],
    19: [
      { mult: 1, success: 0.1575, boom: 0.08425 },
      { mult: 2, success: 0.126, boom: 0.06118 },
      { mult: 3.5, success: 0.105, boom: 0.0358 },
      { mult: 6.5, success: 0.084, boom: 0 },
    ],
    20: [
      { mult: 1, success: 0.315, boom: 0.10275 },
      { mult: 2, success: 0.2625, boom: 0.07375 },
      { mult: 3.5, success: 0.21, boom: 0.0395 },
      { mult: 6.5, success: 0.1575, boom: 0 },
    ],
    21: [
      { mult: 1, success: 0.1575, boom: 0.126375 },
      { mult: 2, success: 0.126, boom: 0.0874 },
      { mult: 3.5, success: 0.105, boom: 0.04475 },
      { mult: 6.5, success: 0.084, boom: 0 },
    ],
  };

  global.GMS_RATES = GMS_RATES;
  global.COST_COEFS = COST_COEFS;
  global.ENHANCE_MODE = ENHANCE_MODE;
})(window);
