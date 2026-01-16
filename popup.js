document.addEventListener('DOMContentLoaded', () => {
  const els = {
    input1: document.getElementById('jsonInput'),
    highlight1: document.getElementById('highlight1'),
    input2: document.getElementById('jsonInput2'),
    highlight2: document.getElementById('highlight2'),
    wrapper2: document.getElementById('wrapper2'),

    toggleWrapBtn: document.getElementById('toggleWrap'),
    toggleReadOnlyBtn: document.getElementById('toggleReadOnly'),
    splitBtn: document.getElementById('splitBtn'),
    themeBtn: document.getElementById('themeBtn'),
    saveBtn: document.getElementById('saveBtn'),
    historyBtn: document.getElementById('historyBtn'),

    status: document.getElementById('status'),
    historyOverlay: document.getElementById('historyOverlay'),
    historyList: document.getElementById('historyList'),
    closeHistoryBtn: document.getElementById('closeHistory'),

    searchInputBox: document.getElementById('searchInputBox'),
    searchCount: document.getElementById('searchCount'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn')
  };

  const STORAGE_KEYS = {
    theme: 'json_fmt_theme',
    draft: 'json_fmt_draft',
    history: 'json_fmt_history'
  };
  const MAX_HISTORY = 10;

  const state = {
    isWrap: true,
    isReadOnly: false,
    isSplit: false,
    theme: readString(STORAGE_KEYS.theme) || 'dark'
  };

  const searchState = {
    matches: [],
    currentIndex: -1,
    offsetInput2: 0,
    isCapped: false
  };

  const PERF = {
    inputDebounceMs: 150,
    storageDebounceMs: 500,
    maxSyntaxHighlightChars: 50_000,
    maxSearchHighlightChars: 50_000,
    searchDebounceMs: 120,
    maxSearchMatches: 5000,
    pasteWarnChars: 50_000,
    pasteWarnLines: 2000
  };

  let pendingSearchRebuildTimer = null;
  const workerState = {
    worker: null,
    nextId: 1,
    pending: new Map(),
    formatSeqByEditor: new WeakMap()
  };

  init();

  function init() {
    initWorker();
    applyWrapState();
    applyReadOnlyState();
    applyThemeState();

    const draft = readString(STORAGE_KEYS.draft);
    if (draft) {
      els.input1.value = draft;
      updateHighlightForEditor(els.input1, els.highlight1, 0);
      validateJsonIntoStatus(els.input1.value);
    } else {
      setStatusReady();
    }

    setupEditorSync(els.input1, els.highlight1);
    setupEditorSync(els.input2, els.highlight2);

    setupGlobalShortcuts();
    setupSearchControls();
    setupMenuButtons();
    setupEditorListeners(els.input1, { storageKey: STORAGE_KEYS.draft, highlight: els.highlight1 });
    setupEditorListeners(els.input2, { storageKey: null, highlight: els.highlight2 });
  }

  function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (isShortcutFormat(e)) {
        if (document.activeElement !== els.input1 && document.activeElement !== els.input2) {
          e.preventDefault();
          formatJsonInEditor(els.input1, els.highlight1, { force: true });
          if (state.isSplit) formatJsonInEditor(els.input2, els.highlight2, { force: true });
        }
        return;
      }

      if (isShortcutFocusSearch(e)) {
        e.preventDefault();
        els.searchInputBox.focus();
        els.searchInputBox.select();
      }
    });
  }

  function initWorker() {
    try {
      const workerUrl =
        typeof chrome !== 'undefined' && chrome?.runtime?.getURL ? chrome.runtime.getURL('jsonWorker.js') : 'jsonWorker.js';
      workerState.worker = new Worker(workerUrl);
    } catch {
      workerState.worker = null;
      return;
    }

    workerState.worker.addEventListener('message', (event) => {
      const data = event.data || {};
      const id = data.id;
      if (!workerState.pending.has(id)) return;
      const entry = workerState.pending.get(id);
      workerState.pending.delete(id);
      if (data.ok) {
        entry.resolve(data);
      } else {
        entry.reject(new Error(data.error || 'worker error'));
      }
    });

    workerState.worker.addEventListener('error', () => {
      workerState.worker = null;
      for (const entry of workerState.pending.values()) entry.reject(new Error('worker error'));
      workerState.pending.clear();
    });
  }

  function callJsonWorker(type, text) {
    if (!workerState.worker) return null;
    return new Promise((resolve, reject) => {
      const id = workerState.nextId++;
      workerState.pending.set(id, { resolve, reject });
      workerState.worker.postMessage({ id, type, text });
    });
  }

  function setupSearchControls() {
    els.searchInputBox.addEventListener('input', () => {
      scheduleSearchRebuild(PERF.searchDebounceMs);
    });

    els.searchInputBox.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      runSearchRebuildNow();
      navigateSearch(e.shiftKey ? 'prev' : 'next');
    });

    els.prevBtn.addEventListener('click', () => navigateSearch('prev'));
    els.nextBtn.addEventListener('click', () => navigateSearch('next'));
  }

  function setupMenuButtons() {
    els.toggleWrapBtn.addEventListener('click', () => {
      state.isWrap = !state.isWrap;
      applyWrapState();
    });

    els.toggleReadOnlyBtn.addEventListener('click', () => {
      state.isReadOnly = !state.isReadOnly;
      applyReadOnlyState();
    });

    els.splitBtn.addEventListener('click', () => {
      state.isSplit = !state.isSplit;
      applySplitState();
    });

    els.themeBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyThemeState();
    });

    els.saveBtn.addEventListener('click', () => {
      const text = els.input1.value.trim();
      if (!text) return;

      saveToHistory(text);
      setStatusOk('已保存到历史记录');
      window.setTimeout(() => setStatusReady(), 2000);
    });

    els.historyBtn.addEventListener('click', () => {
      renderHistory();
      els.historyOverlay.style.display = 'flex';
    });

    els.closeHistoryBtn.addEventListener('click', () => {
      els.historyOverlay.style.display = 'none';
    });
  }

  function setupEditorListeners(editor, { storageKey, highlight }) {
    let pendingValidateTimer = null;
    let pendingHighlightTimer = null;
    let pendingStorageTimer = null;

    editor.addEventListener('paste', (e) => {
      if (editor.readOnly) return;

      const pastedText = getClipboardText(e);
      if (!pastedText) return;

      const chars = pastedText.length;
      const lines = countTextLines(pastedText);

      if (chars > PERF.pasteWarnChars || lines > PERF.pasteWarnLines) {
        const ok = window.confirm(
          `当前文本过长（${formatCount(lines)} 行 / ${formatCount(chars)} 字符），粘贴可能造成卡顿，确定粘贴吗？`
        );
        if (!ok) e.preventDefault();
      }
    });

    editor.addEventListener('input', (e) => {
      if (storageKey) {
        if (pendingStorageTimer) window.clearTimeout(pendingStorageTimer);
        pendingStorageTimer = window.setTimeout(() => {
          try {
            writeString(storageKey, editor.value);
          } catch {
          }
        }, PERF.storageDebounceMs);
      }

      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        formatJsonInEditor(editor, highlight);
        return;
      }

      if (pendingValidateTimer) window.clearTimeout(pendingValidateTimer);
      pendingValidateTimer = window.setTimeout(() => {
        validateJsonIntoStatus(editor.value);
      }, PERF.inputDebounceMs);

      if (getSearchTerm()) {
        if (pendingSearchRebuildTimer) window.clearTimeout(pendingSearchRebuildTimer);
        pendingSearchRebuildTimer = window.setTimeout(() => {
          rebuildSearchMatches();
        }, PERF.inputDebounceMs);
      } else {
        if (pendingHighlightTimer) window.clearTimeout(pendingHighlightTimer);
        pendingHighlightTimer = window.setTimeout(() => {
          updateHighlightForEditor(editor, highlight, 0);
        }, PERF.inputDebounceMs);
      }
    });

    editor.addEventListener('keydown', (e) => {
      if (!isShortcutFormat(e)) return;
      e.preventDefault();
      formatJsonInEditor(editor, highlight, { force: true });
    });
  }

  function setupEditorSync(editor, highlight) {
    editor.addEventListener('scroll', () => {
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    });
    updateHighlightForEditor(editor, highlight, 0);
  }

  function rebuildSearchMatches() {
    const term = getSearchTerm();

    searchState.matches = [];
    searchState.currentIndex = -1;
    searchState.offsetInput2 = 0;
    searchState.isCapped = false;

    if (!term) {
      els.searchCount.textContent = '';
      updateHighlightForEditor(els.input1, els.highlight1, 0);
      if (state.isSplit) updateHighlightForEditor(els.input2, els.highlight2, 0);
      return;
    }

    findMatchesInText(els.input1.value, term, 'input');
    searchState.offsetInput2 = searchState.matches.length;

    if (state.isSplit && !searchState.isCapped) {
      findMatchesInText(els.input2.value, term, 'input2');
    }

    updateSearchCountUI();
    updateHighlightForEditor(els.input1, els.highlight1, 0);
    if (state.isSplit) updateHighlightForEditor(els.input2, els.highlight2, searchState.offsetInput2);
  }

  function scheduleSearchRebuild(delayMs) {
    if (pendingSearchRebuildTimer) window.clearTimeout(pendingSearchRebuildTimer);
    pendingSearchRebuildTimer = window.setTimeout(() => {
      rebuildSearchMatches();
    }, delayMs);
  }

  function runSearchRebuildNow() {
    if (pendingSearchRebuildTimer) window.clearTimeout(pendingSearchRebuildTimer);
    pendingSearchRebuildTimer = null;
    rebuildSearchMatches();
  }

  function navigateSearch(direction) {
    if (searchState.matches.length === 0) return;

    const prevIndex = searchState.currentIndex;
    if (direction === 'next') {
      searchState.currentIndex = (searchState.currentIndex + 1) % searchState.matches.length;
    } else {
      searchState.currentIndex = (searchState.currentIndex - 1 + searchState.matches.length) % searchState.matches.length;
    }

    updateSearchCountUI();

    const match = searchState.matches[searchState.currentIndex];
    const target = match.source === 'input2' ? els.input2 : els.input1;
    const targetHighlight = match.source === 'input2' ? els.highlight2 : els.highlight1;

    target.focus();
    target.setSelectionRange(match.start, match.end);
    els.searchInputBox.focus();

    updateCurrentMatchDom(prevIndex, searchState.currentIndex);

    window.setTimeout(() => {
      const currentSpan = targetHighlight.querySelector(`[data-match-index="${searchState.currentIndex}"]`);
      if (currentSpan) currentSpan.scrollIntoView({ block: 'center', inline: 'nearest' });
      targetHighlight.scrollTop = target.scrollTop;
      targetHighlight.scrollLeft = target.scrollLeft;
    }, 0);
  }

  function updateCurrentMatchDom(prevIndex, nextIndex) {
    if (prevIndex >= 0) {
      const prevMatch = searchState.matches[prevIndex];
      const prevHighlight = prevMatch?.source === 'input2' ? els.highlight2 : els.highlight1;
      const prevSpan = prevHighlight.querySelector(`[data-match-index="${prevIndex}"]`);
      if (prevSpan) prevSpan.classList.remove('current');
    }

    if (nextIndex >= 0) {
      const nextMatch = searchState.matches[nextIndex];
      const nextHighlight = nextMatch?.source === 'input2' ? els.highlight2 : els.highlight1;
      const nextSpan = nextHighlight.querySelector(`[data-match-index="${nextIndex}"]`);
      if (nextSpan) nextSpan.classList.add('current');
    }
  }

  function updateSearchCountUI() {
    if (searchState.matches.length === 0) {
      els.searchCount.textContent = '0/0';
      return;
    }
    const displayIndex = searchState.currentIndex >= 0 ? searchState.currentIndex + 1 : 0;
    const totalText = searchState.isCapped ? `${PERF.maxSearchMatches}+` : String(searchState.matches.length);
    els.searchCount.textContent = `${displayIndex}/${totalText}`;
  }

  function findMatchesInText(text, term, source) {
    const regex = new RegExp(escapeRegExp(term), 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (searchState.matches.length >= PERF.maxSearchMatches) {
        searchState.isCapped = true;
        break;
      }
      searchState.matches.push({
        start: match.index,
        end: match.index + term.length,
        source
      });
    }
  }

  function updateHighlightForEditor(editor, highlight, matchStartIndex) {
    const text = editor.value || '';
    const term = getSearchTerm();

    if (term && text.length > PERF.maxSearchHighlightChars) {
      highlight.dataset.perfNote = '大文件：已关闭搜索高亮';
      highlight.textContent = text;
      return;
    }

    if (!term && text.length > PERF.maxSyntaxHighlightChars) {
      highlight.dataset.perfNote = '大文件：已关闭语法高亮';
      highlight.textContent = text;
      return;
    }

    delete highlight.dataset.perfNote;

    let html = syntaxHighlight(text);
    if (term) {
      html = applySearchHighlight(html, term, {
        matchStartIndex,
        currentMatchIndex: searchState.currentIndex,
        maxMatchIndexExclusive: PERF.maxSearchMatches
      });
    }

    highlight.innerHTML = html;
  }

  function applyWrapState() {
    const apply = (el) => {
      if (state.isWrap) {
        el.classList.remove('no-wrap');
        el.classList.add('wrap');
      } else {
        el.classList.remove('wrap');
        el.classList.add('no-wrap');
      }
    };

    [els.input1, els.input2, els.highlight1, els.highlight2].forEach(apply);
    els.toggleWrapBtn.textContent = state.isWrap ? '自动换行: 开启' : '自动换行: 关闭';
  }

  function applyReadOnlyState() {
    [els.input1, els.input2].forEach((el) => {
      el.readOnly = state.isReadOnly;
    });
    els.toggleReadOnlyBtn.textContent = state.isReadOnly ? '只读模式: 开启' : '只读模式: 关闭';
  }

  function applySplitState() {
    if (state.isSplit) {
      els.wrapper2.style.display = 'flex';
      els.splitBtn.textContent = '双栏对比: 开启';
      formatJsonInEditor(els.input2, els.highlight2, { force: true });
    } else {
      els.wrapper2.style.display = 'none';
      els.splitBtn.textContent = '双栏对比: 关闭';
    }

    if (getSearchTerm()) rebuildSearchMatches();
  }

  function applyThemeState() {
    writeString(STORAGE_KEYS.theme, state.theme);

    if (state.theme === 'light') {
      document.body.classList.add('light-theme');
      els.themeBtn.textContent = '切换主题: 亮色';
    } else {
      document.body.classList.remove('light-theme');
      els.themeBtn.textContent = '切换主题: 暗色';
    }

    if (els.status.textContent === '就绪' || els.status.textContent === 'Ready') {
      els.status.style.color = getReadyStatusColor();
    }
  }

  function validateJsonIntoStatus(text) {
    if (!text.trim()) {
      setStatusReady();
      return true;
    }

    try {
      JSON.parse(text);
      setStatusOk('JSON 有效');
      return true;
    } catch {
      setStatusError('JSON 格式错误');
      return false;
    }
  }

  function formatJsonInEditor(editor, highlight, { force = false, useWorker = true } = {}) {
    const text = editor.value;
    if (!text.trim()) return;

    if (useWorker) {
      const promise = callJsonWorker('format', text);
      if (promise) {
        const seq = (workerState.formatSeqByEditor.get(editor) || 0) + 1;
        workerState.formatSeqByEditor.set(editor, seq);
        setStatus('格式化中...', getReadyStatusColor());
        promise
          .then(({ formatted }) => {
            if (workerState.formatSeqByEditor.get(editor) !== seq) return;
            if (editor.value !== text) return;

            if (editor.value !== formatted || force) {
              editor.value = formatted;
              if (editor === els.input1) {
                try {
                  writeString(STORAGE_KEYS.draft, formatted);
                } catch {
                }
              }
            }

            if (getSearchTerm()) {
              runSearchRebuildNow();
            } else {
              updateHighlightForEditor(editor, highlight, 0);
            }

            setStatusOk('JSON 已格式化');
          })
          .catch(() => {
            if (workerState.formatSeqByEditor.get(editor) !== seq) return;
            setStatusError('JSON 格式错误');
          });
        return;
      }
    }

    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);

      if (editor.value !== formatted || force) {
        editor.value = formatted;
        if (editor === els.input1) writeString(STORAGE_KEYS.draft, formatted);
      }

      if (getSearchTerm()) {
        rebuildSearchMatches();
      } else {
        updateHighlightForEditor(editor, highlight, 0);
      }

      setStatusOk('JSON 已格式化');
    } catch {
      setStatusError('JSON 格式错误');
    }
  }

  function renderHistory() {
    const history = getHistory();
    els.historyList.innerHTML = '';

    if (history.length === 0) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.textContent = '暂无历史记录';
      els.historyList.appendChild(li);
      return;
    }

    history.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const timeDiv = document.createElement('div');
      timeDiv.className = 'history-time';
      timeDiv.textContent = item.timestamp;

      const previewDiv = document.createElement('div');
      previewDiv.className = 'history-preview';
      previewDiv.textContent = item.content.substring(0, 100).replace(/\n/g, ' ');

      li.appendChild(timeDiv);
      li.appendChild(previewDiv);

      li.addEventListener('click', () => {
        els.input1.value = item.content;
        formatJsonInEditor(els.input1, els.highlight1, { force: true });
        els.historyOverlay.style.display = 'none';
        setStatusOk('已从历史记录加载');
      });

      els.historyList.appendChild(li);
    });
  }

  function saveToHistory(content) {
    let history = getHistory();
    const newItem = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('zh-CN'),
      content
    };

    history.unshift(newItem);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    writeString(STORAGE_KEYS.history, JSON.stringify(history));
  }

  function getHistory() {
    const stored = readString(STORAGE_KEYS.history);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  function setStatusReady() {
    setStatus('就绪', getReadyStatusColor());
  }

  function setStatusOk(text) {
    setStatus(text, '#4caf50');
  }

  function setStatusError(text) {
    setStatus(text, '#f44336');
  }

  function setStatus(text, color) {
    els.status.textContent = text;
    els.status.style.color = color;
  }

  function getReadyStatusColor() {
    return state.theme === 'light' ? '#666' : '#888';
  }

  function getSearchTerm() {
    return els.searchInputBox.value;
  }

  function readString(key) {
    return localStorage.getItem(key);
  }

  function writeString(key, value) {
    localStorage.setItem(key, value);
  }

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

  function syntaxHighlight(json) {
    if (!json) return '';
    const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'key' : 'string';
        } else if (/true|false/.test(match)) {
          cls = 'boolean';
        } else if (/null/.test(match)) {
          cls = 'null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  function applySearchHighlight(html, term, { matchStartIndex, currentMatchIndex, maxMatchIndexExclusive }) {
    const div = document.createElement('div');
    div.innerHTML = html;

    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    const regex = new RegExp(escapeRegExp(term), 'gi');
    let matchCounter = matchStartIndex;

    for (const textNode of textNodes) {
      const text = textNode.nodeValue;
      let newHtml = '';
      let lastIndex = 0;
      let match;

      regex.lastIndex = 0;
      let hasMatch = false;

      while ((match = regex.exec(text)) !== null) {
        if (matchCounter >= maxMatchIndexExclusive) break;
        hasMatch = true;
        newHtml += escapeHtml(text.slice(lastIndex, match.index));

        const isCurrent = matchCounter === currentMatchIndex;
        const className = isCurrent ? 'search-match current' : 'search-match';
        newHtml += `<span class="${className}" data-match-index="${matchCounter}">${escapeHtml(match[0])}</span>`;

        lastIndex = regex.lastIndex;
        matchCounter++;
      }

      if (hasMatch) {
        newHtml += escapeHtml(text.slice(lastIndex));
        const span = document.createElement('span');
        span.innerHTML = newHtml;
        textNode.parentNode.replaceChild(span, textNode);
      }

      if (matchCounter >= maxMatchIndexExclusive) break;
    }

    return div.innerHTML;
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
});
