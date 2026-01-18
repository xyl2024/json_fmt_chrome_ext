(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.search = {
    getSearchTerm,
    scheduleSearchRebuild,
    runSearchRebuildNow,
    rebuildSearchMatches,
    navigateSearch
  };

  function getSearchTerm(ctx) {
    return ctx.els.searchInputBox.value;
  }

  function scheduleSearchRebuild(ctx, delayMs) {
    if (ctx.timers.pendingSearchRebuildTimer) window.clearTimeout(ctx.timers.pendingSearchRebuildTimer);
    ctx.timers.pendingSearchRebuildTimer = window.setTimeout(() => {
      rebuildSearchMatches(ctx);
    }, delayMs);
  }

  function runSearchRebuildNow(ctx) {
    if (ctx.timers.pendingSearchRebuildTimer) window.clearTimeout(ctx.timers.pendingSearchRebuildTimer);
    ctx.timers.pendingSearchRebuildTimer = null;
    rebuildSearchMatches(ctx);
  }

  function rebuildSearchMatches(ctx) {
    const term = getSearchTerm(ctx);

    ctx.searchState.matches = [];
    ctx.searchState.currentIndex = -1;
    ctx.searchState.offsetInput2 = 0;
    ctx.searchState.isCapped = false;

    if (!term) {
      ctx.els.searchCount.textContent = '';
      NS.highlight.updateHighlightForEditor(ctx, ctx.els.input1, ctx.els.highlight1, 0);
      if (ctx.state.isSplit) NS.highlight.updateHighlightForEditor(ctx, ctx.els.input2, ctx.els.highlight2, 0);
      return;
    }

    findMatchesInText(ctx, ctx.els.input1.value, term, 'input');
    ctx.searchState.offsetInput2 = ctx.searchState.matches.length;

    if (ctx.state.isSplit && !ctx.searchState.isCapped) {
      findMatchesInText(ctx, ctx.els.input2.value, term, 'input2');
    }

    updateSearchCountUI(ctx);
    NS.highlight.updateHighlightForEditor(ctx, ctx.els.input1, ctx.els.highlight1, 0);
    if (ctx.state.isSplit) NS.highlight.updateHighlightForEditor(ctx, ctx.els.input2, ctx.els.highlight2, ctx.searchState.offsetInput2);
  }

  function navigateSearch(ctx, direction) {
    if (ctx.searchState.matches.length === 0) return;

    const prevIndex = ctx.searchState.currentIndex;
    if (direction === 'next') {
      ctx.searchState.currentIndex = (ctx.searchState.currentIndex + 1) % ctx.searchState.matches.length;
    } else {
      ctx.searchState.currentIndex = (ctx.searchState.currentIndex - 1 + ctx.searchState.matches.length) % ctx.searchState.matches.length;
    }

    updateSearchCountUI(ctx);

    const match = ctx.searchState.matches[ctx.searchState.currentIndex];
    const target = match.source === 'input2' ? ctx.els.input2 : ctx.els.input1;
    const targetHighlight = match.source === 'input2' ? ctx.els.highlight2 : ctx.els.highlight1;

    target.focus();
    target.setSelectionRange(match.start, match.end);
    ctx.els.searchInputBox.focus();

    updateCurrentMatchDom(ctx, prevIndex, ctx.searchState.currentIndex);

    window.setTimeout(() => {
      const currentSpan = targetHighlight.querySelector(`[data-match-index="${ctx.searchState.currentIndex}"]`);
      if (currentSpan) currentSpan.scrollIntoView({ block: 'center', inline: 'nearest' });
      targetHighlight.scrollTop = target.scrollTop;
      targetHighlight.scrollLeft = target.scrollLeft;
    }, 0);
  }

  function updateCurrentMatchDom(ctx, prevIndex, nextIndex) {
    if (prevIndex >= 0) {
      const prevMatch = ctx.searchState.matches[prevIndex];
      const prevHighlight = prevMatch?.source === 'input2' ? ctx.els.highlight2 : ctx.els.highlight1;
      const prevSpan = prevHighlight.querySelector(`[data-match-index="${prevIndex}"]`);
      if (prevSpan) prevSpan.classList.remove('current');
    }

    if (nextIndex >= 0) {
      const nextMatch = ctx.searchState.matches[nextIndex];
      const nextHighlight = nextMatch?.source === 'input2' ? ctx.els.highlight2 : ctx.els.highlight1;
      const nextSpan = nextHighlight.querySelector(`[data-match-index="${nextIndex}"]`);
      if (nextSpan) nextSpan.classList.add('current');
    }
  }

  function updateSearchCountUI(ctx) {
    if (ctx.searchState.matches.length === 0) {
      ctx.els.searchCount.textContent = '0/0';
      return;
    }
    const displayIndex = ctx.searchState.currentIndex >= 0 ? ctx.searchState.currentIndex + 1 : 0;
    const totalText = ctx.searchState.isCapped ? `${ctx.PERF.maxSearchMatches}+` : String(ctx.searchState.matches.length);
    ctx.els.searchCount.textContent = `${displayIndex}/${totalText}`;
  }

  function findMatchesInText(ctx, text, term, source) {
    const regex = new RegExp(NS.utils.escapeRegExp(term), 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (ctx.searchState.matches.length >= ctx.PERF.maxSearchMatches) {
        ctx.searchState.isCapped = true;
        break;
      }
      ctx.searchState.matches.push({
        start: match.index,
        end: match.index + term.length,
        source
      });
    }
  }
})();
