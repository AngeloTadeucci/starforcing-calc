// Fodder / star-transfer strategy comparison. Pure logic, no DOM. Sits on the
// optimizer's closed-form planMetrics, so every number is an exact expectation
// under the same rates/costs the simulator uses.
//
// The strategy modeled: star force a cheap fodder item of a lower level with
// plain Mode 1, transfer its stars onto the clean target (the transfer eats
// STAR_LOSS stars), then finish the remaining stars on the target with the
// zero-boom plan — Safeguard 15–17★, Mode 4 18–21★ — so the rare item can
// never be destroyed. Booms during the fodder climb destroy the fodder
// instead; reviving costs one fodder copy per boom, reported separately as
// expected copies (1 initial + expected booms). Compared against raw-tapping
// baselines on the target itself: cheapest (all Mode 1, booms cost target
// spares) and zero-boom (no fodder, no spares, but Mode 4 prices).

(function (global) {
  const SF = global.SF;

  // Stars removed by the transfer: fodder at T★ leaves the target at (T-1)★.
  const STAR_LOSS = 1;
  // Transfers only accept a fodder within this many levels below the target.
  const MAX_LEVEL_GAP = 10;

  // The safest plan the game offers: 0% boom on every star up to 22.
  function zeroBoomPlan() {
    const plan = {};
    for (const s of [15, 16, 17]) plan[s] = { mode: 1, safeguard: true };
    for (const s of [18, 19, 20, 21]) plan[s] = { mode: 4, safeguard: false };
    return plan;
  }

  function metrics(currentStar, targetStar, itemLevel, baseOpts, plan) {
    const opts = Object.assign({}, baseOpts, {
      enhanceMode: 0,
      safeguard: false,
      starPlan: plan,
    });
    return SF.optimizer.planMetrics(currentStar, targetStar, itemLevel, opts);
  }

  // params: { itemLevel, fodderLevel, goalStar, fodderPrice, sparePrice,
  //           baseOpts: { mvp, event, starCatching } }
  // goalStar must be ≤ 22 — the zero-boom plan doesn't exist past 21★, and
  // beyond 22★ every strategy taps the same item identically anyway.
  // fodderPrice / sparePrice are mesos (0 to exclude). The transfer itself is
  // free — its only price is the STAR_LOSS star.
  function compare(params) {
    const { itemLevel, fodderLevel, goalStar, baseOpts } = params;
    const fodderPrice = params.fodderPrice || 0;
    const sparePrice = params.sparePrice || 0;

    // Raw baselines on the target item, from clean. Cheapest tapping pays for
    // its booms in target spares; the zero-boom plan pays in Mode 4 premiums.
    const cheap = metrics(0, goalStar, itemLevel, baseOpts, null);
    const zero = metrics(0, goalStar, itemLevel, baseOpts, zeroBoomPlan());
    const rawCheap = {
      mesos: cheap.expCost,
      spares: cheap.expBooms,
      total: cheap.expCost + cheap.expBooms * sparePrice,
    };
    const rawZero = { mesos: zero.expCost, spares: 0, total: zero.expCost };

    // One row per transfer star. T = goalStar + STAR_LOSS overshoots on the
    // fodder so the transfer alone reaches the goal with zero taps on the
    // target (the fodder climbs past 21★ at vanilla rates — no modes there).
    const strategies = [];
    for (let T = 16; T <= goalStar + STAR_LOSS; T++) {
      const fodder = metrics(0, T, fodderLevel, baseOpts, null);
      const startStar = T - STAR_LOSS;
      const finish =
        startStar >= goalStar
          ? { expCost: 0, expBooms: 0 }
          : metrics(startStar, goalStar, itemLevel, baseOpts, zeroBoomPlan());
      const copies = 1 + fodder.expBooms;
      strategies.push({
        transferAt: T,
        startStar,
        fodderMesos: fodder.expCost,
        finishMesos: finish.expCost,
        copies,
        total: fodder.expCost + finish.expCost + fodderPrice * copies,
      });
    }

    let best = strategies[0];
    for (const s of strategies) if (s.total < best.total) best = s;

    return {
      rawCheap,
      rawZero,
      strategies,
      best,
      levelGapOk:
        itemLevel - fodderLevel <= MAX_LEVEL_GAP && fodderLevel <= itemLevel,
    };
  }

  SF.fodder = { compare, zeroBoomPlan, STAR_LOSS, MAX_LEVEL_GAP };
})(window);
