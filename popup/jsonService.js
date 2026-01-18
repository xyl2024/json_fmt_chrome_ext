(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.jsonService = {
    validateJsonIntoStatus,
    formatJsonInEditor
  };

  function validateJsonIntoStatus(ctx, text) {
    if (!text.trim()) {
      NS.uiState.setStatusReady(ctx);
      return true;
    }

    try {
      JSON.parse(text);
      NS.uiState.setStatusOk(ctx, 'JSON 有效');
      return true;
    } catch {
      NS.uiState.setStatusError(ctx, 'JSON 格式错误');
      return false;
    }
  }

  function formatJsonInEditor(ctx, editor, highlight, { force = false, useWorker = true } = {}) {
    const text = editor.value;
    if (!text.trim()) return;

    if (useWorker) {
      const promise = NS.workerClient.callJsonWorker(ctx, 'format', text);
      if (promise) {
        const seq = (ctx.workerState.formatSeqByEditor.get(editor) || 0) + 1;
        ctx.workerState.formatSeqByEditor.set(editor, seq);
        NS.uiState.setStatus(ctx, '格式化中...', NS.uiState.getReadyStatusColor(ctx));
        promise
          .then(({ formatted }) => {
            if (ctx.workerState.formatSeqByEditor.get(editor) !== seq) return;
            if (editor.value !== text) return;

            if (editor.value !== formatted || force) {
              editor.value = formatted;
              if (editor === ctx.els.input1) {
                try {
                  NS.storage.writeString(ctx.STORAGE_KEYS.draft, formatted);
                } catch {
                }
              }
            }

            if (NS.search.getSearchTerm(ctx)) {
              NS.search.runSearchRebuildNow(ctx);
            } else {
              NS.highlight.updateHighlightForEditor(ctx, editor, highlight, 0);
            }

            NS.uiState.setStatusOk(ctx, 'JSON 已格式化');
          })
          .catch(() => {
            if (ctx.workerState.formatSeqByEditor.get(editor) !== seq) return;
            NS.uiState.setStatusError(ctx, 'JSON 格式错误');
          });
        return;
      }
    }

    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);

      if (editor.value !== formatted || force) {
        editor.value = formatted;
        if (editor === ctx.els.input1) NS.storage.writeString(ctx.STORAGE_KEYS.draft, formatted);
      }

      if (NS.search.getSearchTerm(ctx)) {
        NS.search.rebuildSearchMatches(ctx);
      } else {
        NS.highlight.updateHighlightForEditor(ctx, editor, highlight, 0);
      }

      NS.uiState.setStatusOk(ctx, 'JSON 已格式化');
    } catch {
      NS.uiState.setStatusError(ctx, 'JSON 格式错误');
    }
  }
})();
