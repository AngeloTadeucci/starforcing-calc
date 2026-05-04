// GMS Star Force rates and cost coefficients.
// Rates: per current star, [success, maintain, boom]. Sum to 1.
// Cost coefficients: parameters for the meso cost formula.
// Source: serverDiffs.js from brendonmay/brendonmay.github.io.

(function (global) {
  const GMS_RATES = {
    0:  [0.95, 0.05, 0],
    1:  [0.90, 0.10, 0],
    2:  [0.85, 0.15, 0],
    3:  [0.85, 0.15, 0],
    4:  [0.80, 0.20, 0],
    5:  [0.75, 0.25, 0],
    6:  [0.70, 0.30, 0],
    7:  [0.65, 0.35, 0],
    8:  [0.60, 0.40, 0],
    9:  [0.55, 0.45, 0],
    10: [0.50, 0.50, 0],
    11: [0.45, 0.55, 0],
    12: [0.40, 0.60, 0],
    13: [0.35, 0.65, 0],
    14: [0.30, 0.70, 0],
    15: [0.30, 0.679, 0.021],
    16: [0.30, 0.679, 0.021],
    17: [0.15, 0.782, 0.068],
    18: [0.15, 0.782, 0.068],
    19: [0.15, 0.765, 0.085],
    20: [0.30, 0.595, 0.105],
    21: [0.15, 0.7225, 0.1275],
    22: [0.15, 0.68, 0.17],
    23: [0.10, 0.72, 0.18],
    24: [0.10, 0.72, 0.18],
    25: [0.10, 0.72, 0.18],
    26: [0.07, 0.744, 0.186],
    27: [0.05, 0.76, 0.19],
    28: [0.03, 0.776, 0.194],
    29: [0.01, 0.792, 0.198],
  };

  const COST_COEFS = {};
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

  global.GMS_RATES = GMS_RATES;
  global.COST_COEFS = COST_COEFS;
})(window);
