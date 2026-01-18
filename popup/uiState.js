(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.uiState = {
    setStatusReady,
    setStatusOk,
    setStatusError,
    setStatus,
    getReadyStatusColor,
    applyWrapState,
    applyReadOnlyState,
    applySplitState,
    applyThemeState
  };

  function setStatusReady(ctx) {
    setStatus(ctx, '就绪', getReadyStatusColor(ctx));
  }

  function setStatusOk(ctx, text) {
    setStatus(ctx, text, '#4caf50');
  }

  function setStatusError(ctx, text) {
    setStatus(ctx, text, '#f44336');
  }

  function setStatus(ctx, text, color) {
    ctx.els.status.textContent = text;
    ctx.els.status.style.color = color;
  }

  function getReadyStatusColor(ctx) {
    return ctx.state.theme === 'light' ? '#666' : '#888';
  }

  function applyWrapState(ctx) {
    const apply = (el) => {
      if (ctx.state.isWrap) {
        el.classList.remove('no-wrap');
        el.classList.add('wrap');
      } else {
        el.classList.remove('wrap');
        el.classList.add('no-wrap');
      }
    };

    [ctx.els.input1, ctx.els.input2, ctx.els.highlight1, ctx.els.highlight2].forEach(apply);
    ctx.els.toggleWrapBtn.textContent = ctx.state.isWrap ? '自动换行: 开启' : '自动换行: 关闭';
  }

  function applyReadOnlyState(ctx) {
    [ctx.els.input1, ctx.els.input2].forEach((el) => {
      el.readOnly = ctx.state.isReadOnly;
    });
    ctx.els.toggleReadOnlyBtn.textContent = ctx.state.isReadOnly ? '只读模式: 开启' : '只读模式: 关闭';
  }

  function applySplitState(ctx) {
    if (ctx.state.isSplit) {
      ctx.els.wrapper2.style.display = 'flex';
      ctx.els.splitBtn.textContent = '双栏对比: 开启';
      NS.jsonService.formatJsonInEditor(ctx, ctx.els.input2, ctx.els.highlight2, { force: true });
    } else {
      ctx.els.wrapper2.style.display = 'none';
      ctx.els.splitBtn.textContent = '双栏对比: 关闭';
    }

    if (NS.search.getSearchTerm(ctx)) NS.search.rebuildSearchMatches(ctx);
  }

  function applyThemeState(ctx) {
    NS.storage.writeString(ctx.STORAGE_KEYS.theme, ctx.state.theme);

    if (ctx.state.theme === 'light') {
      document.body.classList.add('light-theme');
      ctx.els.themeBtn.textContent = '切换主题: 亮色';
    } else {
      document.body.classList.remove('light-theme');
      ctx.els.themeBtn.textContent = '切换主题: 暗色';
    }

    if (ctx.els.status.textContent === '就绪' || ctx.els.status.textContent === 'Ready') {
      ctx.els.status.style.color = getReadyStatusColor(ctx);
    }
  }
})();
