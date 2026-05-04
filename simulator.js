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

  function applyRateModifiers(currentStar, opts) {
    const base = global.KMS_RATES[currentStar];
    let s = base[0], m = base[1], d = base[2], b = base[3];

    // Boom reduction (Shining Star Force or standalone): 30% of boom moves to maintain, at <= 21 stars.
    if (
      (opts.event === "boomReduction" || opts.event === "shiningStarForce") &&
      currentStar <= 21
    ) {
      m += b * 0.3;
      b *= 0.7;
    }

    const sgActive =
      opts.safeguard &&
      currentStar >= 15 && currentStar <= 17 &&
      !(opts.event === "fivetenfifteen" && currentStar === 15);
    if (sgActive) {
      m += b;
      b = 0;
    }

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

  function costMultiplier(currentStar, opts) {
    let mult = 1;

    if (currentStar <= 15) {
      if (opts.mvp === "silver")  mult -= 0.03;
      if (opts.mvp === "gold")    mult -= 0.05;
      if (opts.mvp === "diamond") mult -= 0.10;
    }
    if (opts.event === "thirtyOff" || opts.event === "shiningStarForce") mult -= 0.30;

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

  global.SF = global.SF || {};
  global.SF.baseCost = baseCost;
  global.SF.boomDropStar = boomDropStar;
  global.SF.applyRateModifiers = applyRateModifiers;
  global.SF.costMultiplier = costMultiplier;
  global.SF.simulateOnce = simulateOnce;
  global.SF.runTrials = runTrials;
})(window);
