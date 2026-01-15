## JSON Formatter Lite

一个用于快速查看和格式化 JSON 的轻量级浏览器扩展，基于 Manifest V3。

主要特性：
- 粘贴 JSON 一键格式化（Alt+Shift+F）
- 语法高亮显示键名、字符串、数字、布尔和 null
- 支持双栏对比查看 / 编辑
- 内联搜索与高亮，支持上一个 / 下一个（Ctrl+Shift+F 聚焦搜索框）
- 自动换行开关、只读模式切换
- 暗色 / 亮色主题切换，记忆最近使用主题
- 本地草稿保存与最近历史记录（存储在浏览器 localStorage）

项目结构（核心文件）：
- `manifest.json`：扩展清单（Manifest V3），配置入口与图标
- `popup.html`：弹出页界面结构
- `popup.css`：弹出页样式，包括主题与布局
- `popup.js`：JSON 格式化、语法高亮、搜索、历史等核心逻辑
- `json.png`：扩展图标

---

## 安装与使用

### 1. 以「加载已解压的扩展程序」方式安装（推荐）

适用于 Chrome / Edge 等基于 Chromium 的浏览器。

1. 将本项目文件夹（包含 `manifest.json` 等文件）放在本地固定位置  
2. 打开浏览器扩展管理页面：
   - Chrome：地址栏输入 `chrome://extensions/`
   - Edge：地址栏输入 `edge://extensions/`
3. 在右上角打开「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本项目所在文件夹 `json_fmt_chrome_ext`

加载成功后，工具栏中会出现本扩展图标（`json.png`）。点击图标即可打开 JSON 格式化弹窗。

### 2. 打包为 ZIP 安装包

如果需要一个可分发的安装包（例如上传到 Chrome Web Store 或发送给他人），可以将核心文件打包为 ZIP：

需要包含的文件：
- `manifest.json`
- `popup.html`
- `popup.css`
- `popup.js`
- `json.png`

在操作系统中选择以上文件，使用右键菜单「发送到 → 压缩(zipped)文件夹」或类似功能，生成 `json_fmt_chrome_ext.zip`。  
该压缩包即可用于分发或上传到浏览器扩展商店。

---

## 基本使用说明

1. 点击浏览器工具栏中的扩展图标，打开弹出页
2. 将 JSON 文本粘贴到左侧编辑框中，自动或快捷键格式化
3. 可使用：
   - Alt+Shift+F：格式化当前编辑器中的 JSON
   - Ctrl+Shift+F：聚焦搜索框，输入关键词后回车在匹配项之间跳转
4. 如需对比两个 JSON，可打开「双栏对比」并在右侧编辑
5. 可通过「保存」按钮将当前 JSON 保存到本地历史记录，并通过「历史」弹层快速恢复

扩展所有数据均存储在浏览器本地（localStorage），不会上传到网络。

