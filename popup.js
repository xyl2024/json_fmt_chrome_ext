document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('jsonInput');
  const highlight1 = document.getElementById('highlight1');
  const input2 = document.getElementById('jsonInput2');
  const highlight2 = document.getElementById('highlight2');
  const wrapper2 = document.getElementById('wrapper2');
  
  const toggleWrapBtn = document.getElementById('toggleWrap');
  const toggleReadOnlyBtn = document.getElementById('toggleReadOnly');
  const splitBtn = document.getElementById('splitBtn');
  const themeBtn = document.getElementById('themeBtn');
  const saveBtn = document.getElementById('saveBtn');
  const historyBtn = document.getElementById('historyBtn');
  const status = document.getElementById('status');
  const historyOverlay = document.getElementById('historyOverlay');
  const historyList = document.getElementById('historyList');
  const closeHistoryBtn = document.getElementById('closeHistory');
  
  // Search elements
  const searchInputBox = document.getElementById('searchInputBox');
  const searchCount = document.getElementById('searchCount'); // New
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  let isWrap = true;
  let isReadOnly = false;
  let isSplit = false;
  let currentTheme = localStorage.getItem('json_fmt_theme') || 'dark';
  const MAX_HISTORY = 10;
  
  let searchMatches = []; // Store match indices {start, end}
  let currentMatchIndex = -1;

  // Initialize
  updateWrapState();
  updateReadOnlyState();
  updateThemeState();
  
  // Load draft
  const savedDraft = localStorage.getItem('json_fmt_draft');
  if (savedDraft) {
    input.value = savedDraft;
    updateHighlight(input, highlight1);
    validateJSON(input);
  }

  // Setup Editor Sync
  setupEditorSync(input, highlight1);
  setupEditorSync(input2, highlight2);

  // --- Event Listeners ---
  
  // Global Shortcut: Ctrl+Shift+F to Focus Search
  document.addEventListener('keydown', (e) => {
    // Existing Alt+Shift+F logic
    if (e.altKey && e.shiftKey && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F')) {
      if (document.activeElement !== input && document.activeElement !== input2) {
        e.preventDefault();
        formatJSON(input, highlight1, true);
        if (isSplit) formatJSON(input2, highlight2, true);
      }
    }
    // New: Ctrl+Shift+F for Search
    if (e.ctrlKey && e.shiftKey && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        searchInputBox.focus();
        searchInputBox.select();
    }
  });

  // Search Input Listeners
  searchInputBox.addEventListener('input', () => {
      handleSearchInput();
  });

  searchInputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Keep focus in search box
      if (e.shiftKey) {
        navigateSearch('prev');
      } else {
        navigateSearch('next');
      }
    }
  });

  prevBtn.addEventListener('click', () => navigateSearch('prev'));
  nextBtn.addEventListener('click', () => navigateSearch('next'));

  // Toggle Wrap
  toggleWrapBtn.addEventListener('click', () => {
    isWrap = !isWrap;
    updateWrapState();
  });

  // Toggle ReadOnly
  toggleReadOnlyBtn.addEventListener('click', () => {
    isReadOnly = !isReadOnly;
    updateReadOnlyState();
  });

  // Toggle Split
  splitBtn.addEventListener('click', () => {
    isSplit = !isSplit;
    updateSplitState();
  });

  // Toggle Theme
  themeBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    updateThemeState();
  });

  // Save History
  saveBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (text) {
      saveToHistory(text);
      status.textContent = '已保存到历史记录';
      status.style.color = '#4caf50';
      setTimeout(() => status.textContent = '就绪', 2000);
    }
  });

  // Show History
  historyBtn.addEventListener('click', () => {
    renderHistory();
    historyOverlay.style.display = 'flex';
  });

  // Close History
  closeHistoryBtn.addEventListener('click', () => {
    historyOverlay.style.display = 'none';
  });

  // Setup editor listeners
  setupEditorListeners(input, 'json_fmt_draft', highlight1);
  setupEditorListeners(input2, null, highlight2);

  // Global shortcut (fallback)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F')) {
      if (document.activeElement !== input && document.activeElement !== input2) {
        e.preventDefault();
        formatJSON(input, highlight1, true);
        if (isSplit) formatJSON(input2, highlight2, true);
      }
    }
  });

  // --- Functions ---

  function handleSearchInput() {
    const term = searchInputBox.value;
    
    // Clear previous state
    searchMatches = [];
    currentMatchIndex = -1;
    
    if (!term) {
        searchCount.textContent = '';
        updateHighlight(input, highlight1);
        if (isSplit) updateHighlight(input2, highlight2);
        return;
    }
    
    // Helper to find matches in a specific text and add to global list
    const findMatches = (text, source) => {
        const regex = new RegExp(escapeRegExp(term), 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
            searchMatches.push({
                start: match.index,
                end: match.index + term.length,
                source: source
            });
        }
    };

    // Find matches in primary editor
    findMatches(input.value, 'input');
    const count1 = searchMatches.length;

    // Find matches in secondary editor if split is active
    if (isSplit) {
        findMatches(input2.value, 'input2');
    }
    
    // Update Count
    updateSearchCountUI();
    
    // Highlight
    updateHighlight(input, highlight1, 0);
    if (isSplit) updateHighlight(input2, highlight2, count1);
  }

  function updateSearchCountUI() {
      if (searchMatches.length === 0) {
          searchCount.textContent = '0/0';
      } else {
          // Display 1-based index
          const displayIndex = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0;
          searchCount.textContent = `${displayIndex}/${searchMatches.length}`;
      }
  }

  function navigateSearch(direction) {
      if (searchMatches.length === 0) return;
      
      if (direction === 'next') {
          currentMatchIndex++;
          if (currentMatchIndex >= searchMatches.length) currentMatchIndex = 0;
      } else {
          currentMatchIndex--;
          if (currentMatchIndex < 0) currentMatchIndex = searchMatches.length - 1;
      }
      
      updateSearchCountUI();
      
      const match = searchMatches[currentMatchIndex];
      // Determine target editor based on match source
      const target = match.source === 'input2' ? input2 : input;
      const targetHighlight = match.source === 'input2' ? highlight2 : highlight1;
      
      // Select text in textarea
      target.focus();
      target.setSelectionRange(match.start, match.end);
      
      // Keep focus on search box
      searchInputBox.focus();
      
      // Update Highlights to show "current" style
      // We need to re-render both to ensure the previous "current" is cleared
      // and the new "current" is applied.
      // Re-calculating the split index for highlights
      const matchesInInput1 = searchMatches.filter(m => m.source === 'input').length;
      updateHighlight(input, highlight1, 0);
      if (isSplit) updateHighlight(input2, highlight2, matchesInInput1);
      
      // Scroll Sync Logic
      setTimeout(() => {
         const currentSpan = targetHighlight.querySelector('.search-match.current');
         if (currentSpan) {
             // Scroll the specific span into view
             currentSpan.scrollIntoView({ block: 'center', inline: 'nearest' });
             
             // Sync textarea scroll to match highlight layer
             target.scrollTop = targetHighlight.scrollTop;
             target.scrollLeft = targetHighlight.scrollLeft;
         }
      }, 0);
  }

  function setupEditorListeners(editor, storageKey, highlight) {
    editor.addEventListener('input', (e) => {
      if (storageKey) localStorage.setItem(storageKey, editor.value);
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        formatJSON(editor, highlight);
      } else {
        validateJSON(editor);
        if (searchInputBox.value) {
            handleSearchInput();
        } else {
            updateHighlight(editor, highlight);
        }
      }
    });

    editor.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && (e.code === 'KeyF' || e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        formatJSON(editor, highlight, true);
      }
    });
  }

  function setupEditorSync(editor, highlight) {
    // Sync scrolling
    editor.addEventListener('scroll', () => {
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    });
    // Initial sync
    updateHighlight(editor, highlight);
  }

  function updateHighlight(editor, highlight, matchStartIndex = 0) {
    let html = syntaxHighlight(editor.value);
    
    // Apply search highlight if search box has content
    if (searchInputBox.value) {
        html = applySearchHighlight(html, searchInputBox.value, matchStartIndex);
    }
    
    highlight.innerHTML = html;
  }

  function syntaxHighlight(json) {
    if (!json) return '';
    
    // Basic escape
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
  }
  
  function applySearchHighlight(html, term, matchStartIndex = 0) {
    // Create a temporary container to traverse text nodes
    const div = document.createElement('div');
    div.innerHTML = html;
    
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) textNodes.push(node);
    
    const regex = new RegExp(escapeRegExp(term), 'gi');
    let matchCounter = matchStartIndex;
    
    // Use the global searchMatches array to determine if a match corresponds to the current one?
    // Actually, simpler to just count matches as we traverse.
    // NOTE: This assumes DOM traversal order matches string regex order.
    // Since syntax highlighting just wraps text in spans, the text content order is preserved.
    
    for (const textNode of textNodes) {
        const text = textNode.nodeValue;
        let newHtml = '';
        let lastIndex = 0;
        let match;
        
        // Reset regex for each node (we only match within nodes for simplicity)
        regex.lastIndex = 0;
        let hasMatch = false;
        
        while ((match = regex.exec(text)) !== null) {
            hasMatch = true;
            newHtml += escapeHtml(text.slice(lastIndex, match.index));
            
            const isCurrent = matchCounter === currentMatchIndex;
            const className = isCurrent ? 'search-match current' : 'search-match';
            
            newHtml += `<span class="${className}">${escapeHtml(match[0])}</span>`;
            
            lastIndex = regex.lastIndex;
            matchCounter++;
        }
        
        if (hasMatch) {
            newHtml += escapeHtml(text.slice(lastIndex));
            const span = document.createElement('span');
            span.innerHTML = newHtml;
            textNode.parentNode.replaceChild(span, textNode);
        }
    }
    
    return div.innerHTML;
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
  }

  function updateWrapState() {
    const editors = [input, input2];
    const highlights = [highlight1, highlight2];
    
    const applyWrap = (el) => {
      if (isWrap) {
        el.classList.remove('no-wrap');
        el.classList.add('wrap');
      } else {
        el.classList.remove('wrap');
        el.classList.add('no-wrap');
      }
    };

    editors.forEach(applyWrap);
    highlights.forEach(applyWrap);
    
    toggleWrapBtn.textContent = isWrap ? '自动换行: 开启' : '自动换行: 关闭';
  }

  function updateReadOnlyState() {
    const editors = [input, input2];
    editors.forEach(el => {
      el.readOnly = isReadOnly;
    });
    toggleReadOnlyBtn.textContent = isReadOnly ? '只读模式: 开启' : '只读模式: 关闭';
  }

  function updateSplitState() {
    if (isSplit) {
      wrapper2.style.display = 'flex'; // Use flex for wrapper
      splitBtn.textContent = '双栏对比: 开启';
      // Sync layout
      formatJSON(input2, highlight2, true);
    } else {
      wrapper2.style.display = 'none';
      splitBtn.textContent = '双栏对比: 关闭';
    }
    
    // Refresh search results if active
    if (searchInputBox.value) {
        handleSearchInput();
    }
  }

  function updateThemeState() {
    localStorage.setItem('json_fmt_theme', currentTheme);
    if (currentTheme === 'light') {
      document.body.classList.add('light-theme');
      themeBtn.textContent = '切换主题: 亮色';
    } else {
      document.body.classList.remove('light-theme');
      themeBtn.textContent = '切换主题: 暗色';
    }
    // Refresh status color based on theme if it's "Ready"
    if (status.textContent === '就绪' || status.textContent === 'Ready') {
       status.style.color = currentTheme === 'light' ? '#666' : '#888';
    }
  }

  function validateJSON(target) {
    const text = target.value;
    if (!text.trim()) {
      status.textContent = '就绪';
      status.style.color = currentTheme === 'light' ? '#666' : '#888';
      return;
    }

    try {
      JSON.parse(text);
      status.textContent = 'JSON 有效';
      status.style.color = '#4caf50';
    } catch (e) {
      status.textContent = 'JSON 格式错误';
      status.style.color = '#f44336';
    }
  }

  function formatJSON(target, highlight, force = false) {
    const text = target.value;
    if (!text.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);
      
      // Update if different or forced
      if (target.value !== formatted || force) {
         target.value = formatted;
         if (target === input) localStorage.setItem('json_fmt_draft', formatted);
      }
      
      if (searchInputBox.value) {
          handleSearchInput();
      } else {
          updateHighlight(target, highlight);
      }
      
      status.textContent = 'JSON 已格式化';
      status.style.color = '#4caf50';
    } catch (e) {
      status.textContent = 'JSON 格式错误';
      status.style.color = '#f44336';
    }
  }

  function saveToHistory(content) {
    let history = getHistory();
    // Add new item at the beginning
    const newItem = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('zh-CN'), // Use Chinese locale
      content: content
    };
    
    history.unshift(newItem);
    
    // Limit to MAX_HISTORY
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    
    localStorage.setItem('json_fmt_history', JSON.stringify(history));
  }

  function getHistory() {
    const stored = localStorage.getItem('json_fmt_history');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function renderHistory() {
    const history = getHistory();
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.textContent = '暂无历史记录';
      historyList.appendChild(li);
      return;
    }

    history.forEach(item => {
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
        input.value = item.content;
        formatJSON(input, highlight1, true); // Re-format/validate upon load
        historyOverlay.style.display = 'none';
        status.textContent = '已从历史记录加载';
      });
      
      historyList.appendChild(li);
    });
  }
});
