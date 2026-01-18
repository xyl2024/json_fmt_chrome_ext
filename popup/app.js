document.addEventListener('DOMContentLoaded', () => {
  const NS = window.JsonFmt;

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

  const ctx = {
    els,
    STORAGE_KEYS,
    MAX_HISTORY: 10,
    PERF: {
      inputDebounceMs: 150,
      storageDebounceMs: 500,
      maxSyntaxHighlightChars: 50_000,
      maxSearchHighlightChars: 50_000,
      searchDebounceMs: 120,
      maxSearchMatches: 5000,
      pasteWarnChars: 50_000,
      pasteWarnLines: 2000
    },
    state: {
      isWrap: true,
      isReadOnly: false,
      isSplit: false,
      theme: NS.storage.readString(STORAGE_KEYS.theme) || 'dark'
    },
    searchState: {
      matches: [],
      currentIndex: -1,
      offsetInput2: 0,
      isCapped: false
    },
    workerState: {
      worker: null,
      nextId: 1,
      pending: new Map(),
      formatSeqByEditor: new WeakMap()
    },
    timers: {
      pendingSearchRebuildTimer: null
    }
  };

  init(ctx);

  function init(ctx) {
    NS.workerClient.initWorker(ctx);
    NS.uiState.applyWrapState(ctx);
    NS.uiState.applyReadOnlyState(ctx);
    NS.uiState.applyThemeState(ctx);

    const draft = NS.storage.readString(ctx.STORAGE_KEYS.draft);
    if (draft) {
      ctx.els.input1.value = draft;
      NS.highlight.updateHighlightForEditor(ctx, ctx.els.input1, ctx.els.highlight1, 0);
      NS.jsonService.validateJsonIntoStatus(ctx, ctx.els.input1.value);
    } else {
      NS.uiState.setStatusReady(ctx);
    }

    NS.editor.setupEditorSync(ctx, ctx.els.input1, ctx.els.highlight1);
    NS.editor.setupEditorSync(ctx, ctx.els.input2, ctx.els.highlight2);

    NS.editor.setupGlobalShortcuts(ctx);
    NS.editor.setupSearchControls(ctx);
    NS.editor.setupMenuButtons(ctx);
    NS.editor.setupEditorListeners(ctx, ctx.els.input1, { storageKey: ctx.STORAGE_KEYS.draft, highlight: ctx.els.highlight1 });
    NS.editor.setupEditorListeners(ctx, ctx.els.input2, { storageKey: null, highlight: ctx.els.highlight2 });
  }
});
