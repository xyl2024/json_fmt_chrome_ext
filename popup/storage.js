(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.storage = {
    readString,
    writeString,
    getHistory,
    saveToHistory
  };

  function readString(key) {
    return localStorage.getItem(key);
  }

  function writeString(key, value) {
    localStorage.setItem(key, value);
  }

  function getHistory(ctx) {
    const stored = readString(ctx.STORAGE_KEYS.history);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  function saveToHistory(ctx, content) {
    let history = getHistory(ctx);
    const newItem = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('zh-CN'),
      content
    };

    history.unshift(newItem);
    if (history.length > ctx.MAX_HISTORY) history = history.slice(0, ctx.MAX_HISTORY);
    writeString(ctx.STORAGE_KEYS.history, JSON.stringify(history));
  }
})();
