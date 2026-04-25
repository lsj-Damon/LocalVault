# 本地离线桌面笔记软件开源项目调研

更新日期：2026-04-24

## 1. 调研目标
围绕以下目标寻找相似开源项目：
- 桌面端可用
- 离线优先或本地优先
- 支持笔记整理与搜索
- 最好支持图片、附件或富内容
- 对隐私或本地数据保护有一定支持

## 2. 结论先行
如果本项目定位为“像普通笔记软件一样好用，但支持少量敏感信息的本地桌面笔记软件”，最值得优先参考的项目是：

1. `Joplin`
2. `TriliumNext Notes`
3. `TagSpaces`

其中：
- `Joplin` 最适合作为“成熟产品能力与桌面形态”的参考。
- `TriliumNext Notes` 最适合作为“层级组织、知识管理、富内容”的参考。
- `TagSpaces` 最适合作为“本地文件与附件管理、离线优先”的参考。

如果要重点研究隐私保护体验，可以额外参考：
- `Notesnook`

如果要研究更现代的块编辑或工作区交互，可以额外参考：
- `AFFiNE`

## 3. 候选项目清单

| 项目 | GitHub | 为什么相似 | 与本项目的差异 | 适合参考的方向 |
|---|---|---|---|---|
| Joplin | https://github.com/laurent22/joplin | 开源桌面笔记应用，支持离线使用、图片和附件、搜索、标签、插件 | 偏 Markdown 和知识管理，不是“隐私内容块”优先设计 | 桌面结构、数据组织、导入导出、插件扩展 |
| Trilium Notes | https://github.com/TriliumNext/Trilium | 层级笔记强，支持富内容、代码、图片、全文搜索与版本记录 | 产品形态更像个人知识库，学习成本略高 | 树形组织、富内容笔记、层级信息架构 |
| TagSpaces | https://github.com/tagspaces/tagspaces | 明显强调离线优先、本地文件、标签和内容整理 | 更偏“本地文件内容管理器”，不是纯数据库型笔记本 | 本地文件组织、标签体系、附件处理 |
| Notesnook | https://github.com/streetwriters/notesnook | 隐私和加密能力强，桌面端成熟 | 产品重心更偏安全和同步生态，安全权重高于轻量笔记 | 主密码、锁定、加密交互、隐私 UX |
| QOwnNotes | https://github.com/pbek/QOwnNotes | 本地优先、桌面端成熟、轻量、开源，也支持笔记加密 | 偏 Markdown 文件流，不像普通富文本笔记软件 | 文件型存储、轻量桌面体验 |
| AFFiNE | https://github.com/toeverything/AFFiNE | 现代化块编辑、页面组织和本地优先理念较接近 | 范围更大，更像工作区平台，不够聚焦“私密本地笔记” | 富文本交互、块结构、现代 UI 参考 |

## 3.1 技术栈速览

下面的技术栈信息以仓库 README、`package.json`、桌面端子包配置为主，重点看“桌面端怎么做、前端怎么写、数据怎么落地”。

| 项目 | 主要技术栈 | 备注 |
|---|---|---|
| Joplin | `TypeScript / JavaScript`、`Electron`、`React`、`Redux`、`styled-components`、`sqlite3`、`TinyMCE` | 桌面产品成熟，典型的 Electron + React + SQLite 路线 |
| Trilium Notes | `TypeScript`、`Electron`、`Vite`、`better-sqlite3`、`CKEditor 5` | 更偏知识库形态，编辑器和层级组织能力较强 |
| TagSpaces | `TypeScript`、`React`、`Electron`、`Material UI`、`Webpack`、`Cordova` | 同时覆盖桌面、Web、移动端，明显偏本地文件管理思路 |
| Notesnook | `TypeScript`、`Electron`、`React`、`better-sqlite3-multiple-ciphers`、`Kysely`、`TRPC`、`esbuild` | 很适合研究“本地加密 + 主密码 + 桌面应用”的实现路径 |
| QOwnNotes | `C++`、`Qt`、`QMake` | 不是 Web 技术栈，属于较传统的原生桌面路线 |
| AFFiNE | `TypeScript`、`React`、`Electron`、`Vite`、`Yarn Workspaces`、`Yjs` | 更现代的块编辑与协同文档技术路线，产品边界更大 |

## 4. 重点项目分析

### 4.0 GitHub 活跃度快照

以下信息基于 2026-04-24 在 GitHub 仓库页面看到的数据：

| 项目 | Stars | 最新版本 |
|---|---:|---|
| Joplin | 54.5k | v3.5.13，2026-02-25 |
| Trilium Notes | 35.7k | v0.102.2，2026-04-05；此前 `TriliumNext/Notes` 已在 2025-06-24 归档 |
| TagSpaces | 5.1k | v6.10.5，2026-04-08 |
| Notesnook | 14k | Desktop v3.3.15，2026-04-20 |
| QOwnNotes | 5.7k | v26.4.20，2026-04-23 |
| AFFiNE | 67.6k | v0.26.3，2026-02-25 |

### 4.1 Joplin

#### 为什么值得看
- 桌面产品成熟，长期活跃。
- 支持图片、附件、标签、搜索、笔记本等核心能力。
- 本地使用路径明确，适合研究“离线笔记软件”的基本盘。

#### 技术栈速览
- 仓库主语言是 `TypeScript / JavaScript`。
- 桌面端位于 `packages/app-desktop`，采用 `Electron + React + Redux + styled-components`。
- 本地数据层可见 `sqlite3` 依赖。
- 编辑器相关依赖里可见 `TinyMCE`。

#### 对本项目的启发
- 可参考它的三栏结构：导航、列表、内容。
- 可参考附件、资源文件与笔记正文的绑定方式。
- 可参考导入导出和备份恢复思路。

#### 不完全适合的地方
- 编辑体验长期带有 Markdown 思维。
- 对“在普通笔记中插入敏感字段块”的产品表达不够直接。

### 4.2 Trilium Notes

#### 为什么值得看
- 更接近个人知识库，支持丰富内容类型。
- 有强树形结构和跨笔记组织能力。
- 支持富文本、图片、代码、全文搜索和版本记录。

#### 技术栈速览
- 仓库主语言是 `TypeScript`。
- 根包和桌面端包可见 `Electron` 依赖。
- 构建工具里可见 `Vite`。
- 桌面端包中使用 `better-sqlite3`。
- 根包对 `CKEditor 5` 有补丁维护，说明富文本编辑器是其重要组成部分。

#### 对本项目的启发
- 可参考分类、层级结构、信息密度较高的笔记界面。
- 可参考图片、代码、嵌入内容混排的编辑方式。
- 可参考大型笔记集合下的树形导航与组织方式。

#### 不完全适合的地方
- 产品能力偏重，首版容易做复杂。
- 对普通用户来说，上手门槛高于轻量记事本。

### 4.3 TagSpaces

#### 为什么值得看
- 强调本地优先、离线优先，不依赖中心化服务。
- 对本地文件、媒体和标签管理的思路很清晰。
- 如果你的图片和附件较多，它的很多处理方式都值得参考。

#### 技术栈速览
- README 直接列出 `TypeScript`、`React`、`Electron`、`Material UI`、`Webpack`、`Cordova`。
- 这说明它不是单纯桌面应用，而是一个多端共享前端技术栈的产品。
- 其产品结构更接近“本地内容浏览器 + 标签系统”。

#### 对本项目的启发
- 可参考本地目录与应用内索引并存的方式。
- 可参考标签驱动的筛选体验。
- 可参考媒体和附件管理界面。

#### 不完全适合的地方
- 其核心心智更接近“本地内容管理”而非“单纯笔记本”。
- 如果你更想做数据库型笔记产品，它只适合作为局部参考。

### 4.4 Notesnook

#### 为什么值得看
- 很适合参考加密、锁定、主密码、私密内容显示/隐藏等体验。
- 产品成熟度较高，隐私表达清晰。

#### 技术栈速览
- 仓库是 `TypeScript` monorepo。
- 桌面端位于 `apps/desktop`，采用 `Electron + React`。
- 数据库层可见 `better-sqlite3-multiple-ciphers` 和 `Kysely`。
- 通信层可见 `electron-trpc`，构建使用 `esbuild`。
- 整体明显是“Electron 桌面端 + 加密 SQLite + 类型安全数据层”的路线。

#### 对本项目的启发
- 可研究敏感内容默认隐藏、复制、短时查看等交互。
- 可研究主密码和自动锁定策略。

#### 不完全适合的地方
- 安全导向更强，未必符合“普通笔记一样顺手”的核心定位。
- 若照搬其安全模型，可能让首版过重。

### 4.5 QOwnNotes

#### 为什么值得看
- 本地优先、轻量、桌面成熟。
- 非常适合作为“文件型笔记软件”的实现参考。
- 自带笔记加密能力，适合参考“适度安全”的轻量实现。

#### 技术栈速览
- README 直接说明它是用 `C++` 编写，并且是 `Qt` 应用。
- 构建方式使用 `QMake`。
- 这类路线比 Electron 更原生，但开发和 UI 生态与前端栈差异很大。

#### 对本项目的启发
- 可研究轻量级桌面信息架构。
- 可研究文件存储与编辑器解耦思路。

#### 不完全适合的地方
- 更适合 Markdown 用户。
- 对图片附件和私密块体验不是核心卖点。

### 4.6 AFFiNE

#### 为什么值得看
- 现代块编辑、页面组织、白板和文档融合体验较强。
- 适合参考“现代桌面笔记软件”的交互和视觉组织。

#### 技术栈速览
- 仓库采用 `TypeScript` monorepo。
- 根包可见 `Electron`、`Vite`、`Yarn Workspaces`、`React` 相关依赖。
- 协同层可见 `Yjs` 补丁与相关依赖。
- 很适合参考现代编辑器、块结构和多端共享前端架构。

#### 对本项目的启发
- 可研究更现代的编辑器与多视图表达。
- 可借鉴其页面结构与内容组织方式。

#### 不完全适合的地方
- 产品边界更大，超出“本地私密记事本”的 MVP。
- 不是首版最直接的对标对象。

## 5. 推荐对标策略

建议不要只选一个项目做完全对标，而是拆分参考：

- 产品骨架参考 `Joplin`
- 富内容与层级组织参考 `Trilium Notes`
- 本地附件和标签组织参考 `TagSpaces`
- 敏感信息交互参考 `Notesnook`

这种组合更贴近你的目标，因为你的产品是一个“易用优先的本地笔记软件”，而不是现成某个开源项目的直接缩小版。

## 6. 对当前需求最接近的开源项目排序

按“本地桌面 + 普通笔记体验 + 图片/附件 + 一定隐私能力”的综合匹配度排序：

1. Joplin
2. Trilium Notes
3. TagSpaces
4. Notesnook
5. AFFiNE
6. QOwnNotes

## 7. 下一步建议

如果继续往下推进，建议做以下三件事：

1. 从 `Joplin / TriliumNext / TagSpaces / Notesnook` 各截取一个最值得借鉴的页面流。
2. 基于当前需求文档定义 MVP 页面列表与字段模型。
3. 再确定技术路线，例如 `Electron + React + SQLite` 或 `WPF + CefSharp + SQLite`。

## 8. 适合当前项目的技术栈与技术架构

### 8.1 选型原则

基于当前需求，技术选型应优先满足以下几点：

- 桌面端体验稳定，Windows 优先
- 不依赖系统 `Edge / WebView2`
- 离线可用，本地数据可控
- 富文本编辑、图片插入、敏感字段块易于实现
- 搜索、自动保存、导出备份实现成本可控
- 搜索需要覆盖敏感字段
- 导出需要优先支持可读性较强的 `Markdown / HTML`
- 需要回收站和历史版本
- 不要求跨平台

### 8.2 三条可行路线

#### 方案 A：Electron + React + TipTap + SQLite

这是当前最适合本项目的方案。

适合原因：
- 完全不依赖系统 `WebView2`，运行环境可预测。
- 富文本优先、图片、自定义敏感字段块、`HTML/Markdown` 导出都更自然。
- 与 `Joplin / Notesnook / TagSpaces / AFFiNE` 的成功路径最接近。
- 整个 UI 使用一套前端技术栈，复杂度低于“原生壳 + 嵌入式编辑器”。

代价：
- 安装包和内存占用会高于纯原生桌面壳。
- 需要认真控制主进程与渲染进程边界。

#### 方案 B：WPF + CefSharp + TipTap + SQLite

这是保留 `.NET` 的次优方案。

适合原因：
- 可以绕开 `WebView2`，仍然使用现代 Web 富文本编辑器。
- 保留 `WPF` 在窗口、系统托盘、原生文件访问上的优势。
- 如果团队已有 `.NET` 经验，这条路可以接受。

代价：
- 要同时维护 `WPF UI + Chromium 编辑器 + JS/.NET 桥接`。
- 使用嵌入式 Chromium 后，轻量化优势会明显缩小。

#### 方案 C：纯 WPF / WinUI 富文本控件 + SQLite

这是保底方案，但不推荐作为首选。

适合原因：
- 不依赖浏览器运行时。
- 原生桌面壳最轻。
- 数据访问和系统能力调用最直接。

代价：
- `WPF RichTextBox` 和 `WinUI RichEditBox` 更适合传统富文本，不适合现代块式编辑。
- 自定义敏感字段块、复杂图片混排、稳定的 `HTML/Markdown` 导出实现成本高。
- 很容易在编辑器能力上陷入长期自研。

### 8.3 推荐结论

推荐采用：

- 桌面壳：`Electron`
- 前端：`React + TypeScript + Vite`
- 编辑器：`TipTap`
- 本地数据：`SQLite + FTS5`
- 服务层：`Main / Renderer / Preload`
- 安全：`Argon2id + AES-256-GCM`

这套组合本质上是：

- 用 `Electron` 取代不可用的 `WebView2` / `Tauri` 路线
- 借鉴 `Trilium Notes` 的“富内容与层级组织”
- 借鉴 `TagSpaces` 的“本地附件管理”
- 借鉴 `Notesnook` 的“主密码和敏感内容保护”
- 用 Web 编辑器吸收 `Joplin / AFFiNE` 这类成熟编辑交互思路

但不照搬它们偏重的部分，例如：
- 不走纯原生富文本控件路线
- 不走 Trilium 的重知识库路线
- 不走 Notesnook 的强安全产品路线

### 8.4 推荐技术栈明细

#### 桌面层
- `Electron`
- `Main / Renderer / Preload`

说明：
- `Main` 负责窗口、文件系统、数据库连接、托盘与应用生命周期。
- `Preload` 负责安全桥接。
- `Renderer` 负责主界面、列表、设置、回收站和历史版本面板。

#### 编辑器层
- `TipTap`
- `ProseMirror`
- 可选：`Lexical`

说明：
- 相比原生富文本控件，更适合实现现代富文本交互。
- 可以扩展自定义节点，适合实现图片块、代码块、敏感字段块、引用块。
- 对 `HTML` 导出天然更友好，`Markdown` 导出也更容易做降级转换。

#### 数据层
- `SQLite`
- `FTS5`
- `better-sqlite3`

说明：
- `SQLite` 足够覆盖单机本地应用的数据量级。
- `FTS5` 用于标题、正文、标签搜索。
- 敏感字段搜索建议在解锁后建立受控索引，避免默认暴露明文。
- 不建议首版引入过重 ORM，优先选择轻量、可控的数据访问层。

#### 安全层
- 主密码派生：`Argon2id`
- 内容加密：`AES-256-GCM`
- 会话管理：内存中缓存会话密钥

说明：
- 主密码只用于派生密钥，不明文存储。
- 敏感字段单独加密，不默认加密全部正文，避免搜索和编辑体验明显变差。
- 如果必须搜索敏感字段，建议仅在解锁后建立受控索引，并在结果中默认掩码显示。
- 锁屏后清理内存中的敏感解密态。

#### 附件与图片层
- 应用数据目录托管附件
- 数据库保存附件元数据与关联关系
- 可选生成缩略图缓存目录

说明：
- 不依赖用户原始文件路径。
- 避免原图被移动或删除后笔记失效。

### 8.5 推荐技术架构

建议采用“前端渲染层 + 原生命令层 + 本地数据层”的三层结构。

```text
Electron Desktop App
├─ Main Process
│  ├─ Window / Tray / Lifecycle
│  ├─ File System / Export / Import
│  └─ Database / Crypto
├─ Preload Bridge
│  └─ Secure IPC APIs
├─ Renderer App
│  ├─ Navigation / Note List / Settings / Trash / History
│  ├─ Lock Screen
│  └─ TipTap Editor
├─ Application Services
│  ├─ note_service
│  ├─ category_tag_service
│  ├─ search_service
│  ├─ attachment_service
│  ├─ secret_service
│  ├─ history_service
│  ├─ trash_service
│  └─ backup_service
└─ Local Storage
   ├─ SQLite
   ├─ attachments/
   ├─ thumbnails/
   └─ exports/
```

### 8.6 关键模块设计

#### 笔记模块
- 负责笔记 CRUD、自动保存、归档、收藏、最近编辑排序。

#### 编辑器模块
- 负责正文渲染、格式化、图片插入、敏感字段块插入。

#### 搜索模块
- 使用 `SQLite FTS5` 建立索引。
- 默认索引标题、普通正文、标签。
- 敏感字段在解锁后建立受控索引，搜索结果默认掩码显示。

#### 敏感内容模块
- 负责主密码校验、密钥派生、字段加解密、显示/隐藏控制。

#### 附件模块
- 负责图片复制到应用目录、元数据记录、缩略图生成、删除清理。

#### 备份恢复模块
- 负责整库导出、导入校验、版本兼容和恢复流程。

### 8.7 数据存储建议

建议采用“数据库 + 托管文件目录”的混合模型：

- `notes`：基础笔记信息
- `note_blocks`：正文块或编辑器结构数据
- `secret_fields`：加密存储的敏感字段
- `note_versions`：笔记历史版本
- `trash_items`：回收站记录
- `attachments`：附件元数据
- `tags` / `note_tags`：标签关系
- `app_settings`：主密码参数、自动锁定时间、界面设置

目录建议：

- `%AppData%/<app-name>/app.db`
- `%AppData%/<app-name>/attachments/`
- `%AppData%/<app-name>/thumbnails/`
- `%AppData%/<app-name>/backups/`

### 8.8 关于 `.NET WPF / WinUI` 是否更轻更快

结论：

- 如果只看桌面壳，通常是。
- 但在 `WebView2` 不可用的前提下，这个优势会显著缩水。
- 对当前需求来说，决定体验上限的关键不是 `WPF` 还是 `WinUI 3`，而是“如何获得现代富文本编辑器”。

具体判断：

- 如果采用纯 `WPF RichTextBox / WinUI RichEditBox`，桌面壳最轻，但编辑器能力会明显受限。
- 如果改用 `WPF + CefSharp`，因为要自带 Chromium，和 `Electron` 的体积与内存差距会缩小很多。
- `WinUI 3` 不会天然比 `WPF` 更快；它更现代，但在当前项目里不一定比 WPF 更省事。

推荐结论：

- 如果你更重视交付效率和编辑器能力，优先选 `Electron`。
- 如果你坚持 `.NET` 路线，选 `WPF + CefSharp`。
- 不建议首版直接押 `WinUI 3`。
- 不建议首版使用纯原生富文本控件来实现这个编辑器。
