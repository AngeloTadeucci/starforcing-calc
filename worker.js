// Runs the Monte Carlo simulation off the main thread so the UI never blocks.
// rates.js and simulator.js attach their exports to `window`; inside a worker
// the global object is `self`, so alias it before importing them.
self.window = self;
importScripts("rates.js", "simulator.js");

self.onmessage = function (e) {
  const input = e.data;
  self.SF.runTrials(input, {
    // Blocking the worker thread is harmless (it isn't the UI thread), so use a
    // larger time slice than the main-thread default — fewer scheduling hops,
    // while still posting progress several times a second.
    sliceMs: 80,
    onProgress: function (done, total) {
      self.postMessage({ type: "progress", done: done, total: total });
    },
  }).then(function (stats) {
    self.postMessage({ type: "done", stats: stats });
  });
};
