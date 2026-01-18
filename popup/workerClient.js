(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.workerClient = {
    initWorker,
    callJsonWorker
  };

  function initWorker(ctx) {
    try {
      const workerUrl =
        typeof chrome !== 'undefined' && chrome?.runtime?.getURL ? chrome.runtime.getURL('jsonWorker.js') : 'jsonWorker.js';
      ctx.workerState.worker = new Worker(workerUrl);
    } catch {
      ctx.workerState.worker = null;
      return;
    }

    ctx.workerState.worker.addEventListener('message', (event) => {
      const data = event.data || {};
      const id = data.id;
      if (!ctx.workerState.pending.has(id)) return;
      const entry = ctx.workerState.pending.get(id);
      ctx.workerState.pending.delete(id);
      if (data.ok) {
        entry.resolve(data);
      } else {
        entry.reject(new Error(data.error || 'worker error'));
      }
    });

    ctx.workerState.worker.addEventListener('error', () => {
      ctx.workerState.worker = null;
      for (const entry of ctx.workerState.pending.values()) entry.reject(new Error('worker error'));
      ctx.workerState.pending.clear();
    });
  }

  function callJsonWorker(ctx, type, text) {
    if (!ctx.workerState.worker) return null;
    return new Promise((resolve, reject) => {
      const id = ctx.workerState.nextId++;
      ctx.workerState.pending.set(id, { resolve, reject });
      ctx.workerState.worker.postMessage({ id, type, text });
    });
  }
})();
