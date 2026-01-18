(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.utils = {
    getClipboardText,
    countTextLines,
    formatCount,
    isShortcutFormat,
    isShortcutFocusSearch,
    escapeRegExp,
    escapeHtml
  };

  function getClipboardText(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData || typeof clipboardData.getData !== 'function') return '';
    try {
      return clipboardData.getData('text') || '';
    } catch {
      return '';
    }
  }

  function countTextLines(text) {
    if (!text) return 0;
    let lines = 1;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code === 10) {
        lines++;
        continue;
      }
      if (code === 13) {
        lines++;
        if (text.charCodeAt(i + 1) === 10) i++;
      }
    }
    return lines;
  }

  function formatCount(n) {
    return String(n);
  }

  function isShortcutFormat(e) {
    return e.altKey && e.shiftKey && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F');
  }

  function isShortcutFocusSearch(e) {
    return e.ctrlKey && e.shiftKey && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F');
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
