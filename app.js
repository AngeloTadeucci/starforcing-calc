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

  function drawHistogram(buckets) {
    const canvas = $("histogram");
    const ctx = canvas.getContext("2d");

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

    ctx.fillStyle = "#f5b454";
    for (let i = 0; i < buckets.length; i++) {
      const barH = (buckets[i].count / maxCount) * h;
      const x = padL + i * barW;
      const y = padT + (h - barH);
      ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
    }

    ctx.strokeStyle = "#262c38";
    ctx.beginPath();
    ctx.moveTo(padL, padT + h + 0.5);
    ctx.lineTo(padL + w, padT + h + 0.5);
    ctx.stroke();

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

    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(String(maxCount), padL - 6, padT);
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
    drawHistogram(stats.buckets);
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("sf-form").addEventListener("submit", onSubmit);
  });
})();
