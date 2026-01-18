(() => {
  const NS = (window.JsonFmt = window.JsonFmt || {});

  NS.highlight = {
    updateHighlightForEditor,
    syntaxHighlight,
    applySearchHighlight
  };

  function updateHighlightForEditor(ctx, editor, highlight, matchStartIndex) {
    const text = editor.value || '';
    const term = NS.search.getSearchTerm(ctx);

    if (term && text.length > ctx.PERF.maxSearchHighlightChars) {
      highlight.dataset.perfNote = '大文件：已关闭搜索高亮';
      highlight.textContent = text;
      return;
    }

    if (!term && text.length > ctx.PERF.maxSyntaxHighlightChars) {
      highlight.dataset.perfNote = '大文件：已关闭语法高亮';
      highlight.textContent = text;
      return;
    }

    delete highlight.dataset.perfNote;

    let html = syntaxHighlight(text);
    if (term) {
      html = applySearchHighlight(ctx, html, term, {
        matchStartIndex,
        currentMatchIndex: ctx.searchState.currentIndex,
        maxMatchIndexExclusive: ctx.PERF.maxSearchMatches
      });
    }

    highlight.innerHTML = html;
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

  function applySearchHighlight(ctx, html, term, { matchStartIndex, currentMatchIndex, maxMatchIndexExclusive }) {
    const div = document.createElement('div');
    div.innerHTML = html;

    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    const regex = new RegExp(NS.utils.escapeRegExp(term), 'gi');
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
        newHtml += NS.utils.escapeHtml(text.slice(lastIndex, match.index));

        const isCurrent = matchCounter === currentMatchIndex;
        const className = isCurrent ? 'search-match current' : 'search-match';
        newHtml += `<span class="${className}" data-match-index="${matchCounter}">${NS.utils.escapeHtml(match[0])}</span>`;

        lastIndex = regex.lastIndex;
        matchCounter++;
      }

      if (hasMatch) {
        newHtml += NS.utils.escapeHtml(text.slice(lastIndex));
        const span = document.createElement('span');
        span.innerHTML = newHtml;
        textNode.parentNode.replaceChild(span, textNode);
      }

      if (matchCounter >= maxMatchIndexExclusive) break;
    }

    return div.innerHTML;
  }
})();
