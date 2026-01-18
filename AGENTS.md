# AGENTS.md

本文档为在此 JSON 格式化浏览器扩展项目中工作的智能编程智能体提供指南。

## 项目概述

一个轻量级的 Chrome 扩展（Manifest V3），用于格式化和查看 JSON。核心文件：
- `manifest.json` - 扩展配置
- `popup.js` - 主要应用逻辑（DOM 操作、JSON 格式化、语法高亮）
- `popup.css` - 样式，支持暗色/亮色主题
- `jsonWorker.js` - 用于异步 JSON 解析的 Web Worker
- `tools/check.mjs` - 语法验证脚本

## 构建/检查/测试命令

```bash
# 验证语法（提交前自动运行）
npm run check

# 手动语法检查
node tools/check.mjs

# 验证内容：
# - manifest.json 是有效的 JSON
# - popup.js 具有有效的 JavaScript 语法
```

**目前未配置测试框架。** 添加测试时：
- 使用 Node.js `vm` 模块进行 JS 语法验证（参见 `tools/check.mjs`）
- 测试 JSON 格式化的边界情况
- 测试 Worker 消息传递

## 代码风格指南

### 基本原则

- 编写简洁、可读的原生 JavaScript（ES6+）
- 使用 ES 模块（package.json 中的 `"type": "module"`）
- 无外部依赖 - 保持轻量
- 所有数据存储在本地 `localStorage` 中

### 命名规范

- **常量**：`UPPER_SNAKE_CASE`（例如 `STORAGE_KEYS`、`MAX_HISTORY`）
- **配置对象**：`UpperCamelCase`（例如 `PERF`）
- **状态对象**：`lowerCamelCase`（例如 `state`、`searchState`）
- **DOM 元素对象**：`els` 前缀（例如 `els.input1`、`els.toggleWrapBtn`）
- **Worker 状态**：`workerState` 对象
- **函数**：`lowerCamelCase`（例如 `formatJsonInEditor`、`applyThemeState`）
- **布尔状态变量**：`is*` 或 `has*` 前缀（例如 `isWrap`、`isSplit`）

### 文件结构

- 保持 `popup.js` 在 800 行以内 - 如需扩展应重构为独立模块
- 将相关函数分组放在一起
- 将常量和配置放在文件顶部
- 辅助工具函数放在底部
- 入口点（`init()`）放在靠近顶部的位置

### JavaScript 模式

```javascript
// 常量优先
const STORAGE_KEYS = {
  theme: 'json_fmt_theme',
  draft: 'json_fmt_draft',
  history: 'json_fmt_history'
};
const MAX_HISTORY = 10;

// 然后是状态
const state = {
  isWrap: true,
  isReadOnly: false,
  theme: readString(STORAGE_KEYS.theme) || 'dark'
};

// 然后是配置
const PERF = {
  inputDebounceMs: 150,
  storageDebounceMs: 500,
  maxSyntaxHighlightChars: 50_000
};

// 然后是 init 调用
init();

// 然后是函数定义
function init() { ... }
```

### 错误处理

- 对 JSON 解析和存储操作使用 `try/catch`
- 空的 `catch` 块应该是隐式的或最小的
- 对于面向用户的错误，使用 `setStatusError()` 函数
- 对于静默失败（例如 localStorage 满），允许静默捕获
- Worker 错误：拒绝 Promise 并附带描述性错误消息

### DOM 操作

- 在初始化时将 DOM 元素缓存在 `els` 对象中
- 对所有事件绑定使用 `addEventListener`
- 使用 `dataset` 获取数据属性
- 避免直接操作样式 - 使用 CSS 类

```javascript
const els = {
  input1: document.getElementById('jsonInput'),
  highlight1: document.getElementById('highlight1'),
  toggleWrapBtn: document.getElementById('toggleWrap')
};
```

### 性能

- 对输入处理器进行防抖（使用 `PERF` 配置中的值）
- 对繁重的 JSON 解析使用 Web Worker（`jsonWorker.js`）
- 对大文件限制语法高亮（检查 `PERF.maxSyntaxHighlightChars`）
- 使用 `WeakMap` 进行编辑器到序列号的跟踪

### CSS/样式

- 使用 CSS 自定义属性（`:root`）实现主题切换
- 默认定义暗色主题，亮色主题作为 `.light-theme` 覆盖
- 使用一致的颜色变量（`--bg`、`--text`、`--muted` 等）
- 保持选择器的特异性低
- 使用 flexbox 进行布局

### Web Worker 模式

- Worker 处理 JSON 的 `parse` 和 `format` 操作
- 使用消息 ID 跟踪以实现 Promise 解析
- 在 Worker 错误时拒绝 Promise

### 存储

- 使用带前缀的键（`json_fmt_*`）使用 `localStorage`
- 将存储封装在辅助函数中（`readString`、`writeString`）
- 在历史记录检索中优雅地处理 `JSON.parse` 错误

### 键盘快捷键

- 在注释中记录快捷键：`Alt+Shift+F` 格式化，`Ctrl+Shift+F` 搜索
- 使用 `e.code`（例如 `KeyF`）以获得可靠的按键检测

## 重要说明

- 这是一个 Chrome 扩展 - 代码在浏览器上下文中运行
- `popup.js` 中没有 `import`/`require`（在页面上下文中运行）
- Worker 使用 `self` 而不是 `window`
- 在 Chrome/Edge 中使用"加载已解压的扩展程序"进行测试
- 代码更改后重新加载扩展（chrome://extensions → 刷新图标）
