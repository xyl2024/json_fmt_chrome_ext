(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.editor = {
    setupGlobalShortcuts,
    setupSearchControls,
    setupMenuButtons,
    setupEditorListeners,
    setupEditorSync,
    renderHistory
  };

  function setupGlobalShortcuts(ctx) {
    document.addEventListener('keydown', (e) => {
      if (NS.utils.isShortcutFormat(e)) {
        if (document.activeElement !== ctx.els.input1 && document.activeElement !== ctx.els.input2) {
          e.preventDefault();
          NS.jsonService.formatJsonInEditor(ctx, ctx.els.input1, ctx.els.highlight1, { force: true });
          if (ctx.state.isSplit) NS.jsonService.formatJsonInEditor(ctx, ctx.els.input2, ctx.els.highlight2, { force: true });
        }
        return;
      }

      if (NS.utils.isShortcutFocusSearch(e)) {
        e.preventDefault();
        ctx.els.searchInputBox.focus();
        ctx.els.searchInputBox.select();
      }
    });
  }

  function setupSearchControls(ctx) {
    ctx.els.searchInputBox.addEventListener('input', () => {
      NS.search.scheduleSearchRebuild(ctx, ctx.PERF.searchDebounceMs);
    });

    ctx.els.searchInputBox.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      NS.search.runSearchRebuildNow(ctx);
      NS.search.navigateSearch(ctx, e.shiftKey ? 'prev' : 'next');
    });

    ctx.els.prevBtn.addEventListener('click', () => NS.search.navigateSearch(ctx, 'prev'));
    ctx.els.nextBtn.addEventListener('click', () => NS.search.navigateSearch(ctx, 'next'));
  }

  function setupMenuButtons(ctx) {
    ctx.els.toggleWrapBtn.addEventListener('click', () => {
      ctx.state.isWrap = !ctx.state.isWrap;
      NS.uiState.applyWrapState(ctx);
    });

    ctx.els.toggleReadOnlyBtn.addEventListener('click', () => {
      ctx.state.isReadOnly = !ctx.state.isReadOnly;
      NS.uiState.applyReadOnlyState(ctx);
    });

    ctx.els.splitBtn.addEventListener('click', () => {
      ctx.state.isSplit = !ctx.state.isSplit;
      NS.uiState.applySplitState(ctx);
    });

    ctx.els.themeBtn.addEventListener('click', () => {
      ctx.state.theme = ctx.state.theme === 'dark' ? 'light' : 'dark';
      NS.uiState.applyThemeState(ctx);
    });

    ctx.els.saveBtn.addEventListener('click', () => {
      const text = ctx.els.input1.value.trim();
      if (!text) return;

      NS.storage.saveToHistory(ctx, text);
      NS.uiState.setStatusOk(ctx, '已保存到历史记录');
      window.setTimeout(() => NS.uiState.setStatusReady(ctx), 2000);
    });

    ctx.els.historyBtn.addEventListener('click', () => {
      renderHistory(ctx);
      ctx.els.historyOverlay.style.display = 'flex';
    });

    ctx.els.closeHistoryBtn.addEventListener('click', () => {
      ctx.els.historyOverlay.style.display = 'none';
    });
  }

  function setupEditorListeners(ctx, editor, { storageKey, highlight }) {
    let pendingValidateTimer = null;
    let pendingHighlightTimer = null;
    let pendingStorageTimer = null;

    editor.addEventListener('paste', (e) => {
      if (editor.readOnly) return;

      const pastedText = NS.utils.getClipboardText(e);
      if (!pastedText) return;

      const chars = pastedText.length;
      const lines = NS.utils.countTextLines(pastedText);

      if (chars > ctx.PERF.pasteWarnChars || lines > ctx.PERF.pasteWarnLines) {
        const ok = window.confirm(
          `当前文本过长（${NS.utils.formatCount(lines)} 行 / ${NS.utils.formatCount(chars)} 字符），粘贴可能造成卡顿，确定粘贴吗？`
        );
        if (!ok) e.preventDefault();
      }
    });

    editor.addEventListener('input', (e) => {
      if (storageKey) {
        if (pendingStorageTimer) window.clearTimeout(pendingStorageTimer);
        pendingStorageTimer = window.setTimeout(() => {
          try {
            NS.storage.writeString(storageKey, editor.value);
          } catch {
          }
        }, ctx.PERF.storageDebounceMs);
      }

      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        NS.jsonService.formatJsonInEditor(ctx, editor, highlight);
        return;
      }

      if (pendingValidateTimer) window.clearTimeout(pendingValidateTimer);
      pendingValidateTimer = window.setTimeout(() => {
        NS.jsonService.validateJsonIntoStatus(ctx, editor.value);
      }, ctx.PERF.inputDebounceMs);

      if (NS.search.getSearchTerm(ctx)) {
        if (ctx.timers.pendingSearchRebuildTimer) window.clearTimeout(ctx.timers.pendingSearchRebuildTimer);
        ctx.timers.pendingSearchRebuildTimer = window.setTimeout(() => {
          NS.search.rebuildSearchMatches(ctx);
        }, ctx.PERF.inputDebounceMs);
      } else {
        if (pendingHighlightTimer) window.clearTimeout(pendingHighlightTimer);
        pendingHighlightTimer = window.setTimeout(() => {
          NS.highlight.updateHighlightForEditor(ctx, editor, highlight, 0);
        }, ctx.PERF.inputDebounceMs);
      }
    });

    editor.addEventListener('keydown', (e) => {
      if (!NS.utils.isShortcutFormat(e)) return;
      e.preventDefault();
      NS.jsonService.formatJsonInEditor(ctx, editor, highlight, { force: true });
    });
  }

  function setupEditorSync(ctx, editor, highlight) {
    editor.addEventListener('scroll', () => {
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    });
    NS.highlight.updateHighlightForEditor(ctx, editor, highlight, 0);
  }

  function renderHistory(ctx) {
    const history = NS.storage.getHistory(ctx);
    ctx.els.historyList.innerHTML = '';

    if (history.length === 0) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.textContent = '暂无历史记录';
      ctx.els.historyList.appendChild(li);
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
        ctx.els.input1.value = item.content;
        NS.jsonService.formatJsonInEditor(ctx, ctx.els.input1, ctx.els.highlight1, { force: true });
        ctx.els.historyOverlay.style.display = 'none';
        NS.uiState.setStatusOk(ctx, '已从历史记录加载');
      });

      ctx.els.historyList.appendChild(li);
    });
  }
})();
