# 本地离线桌面笔记软件实施架构文档

更新日期：2026-04-24

## 1. 文档目标

这份文档将已确认的产品需求落到实施层，重点回答三件事：

1. 项目目录结构应该怎么划分
2. Electron 的主进程、Preload、渲染进程分别负责什么
3. SQLite 表结构、搜索、加密、回收站、历史版本如何设计

当前已确认前提：

- 技术栈采用 `Electron`
- 编辑器采用富文本优先，不兼容 Markdown 编辑模式
- 搜索需要覆盖敏感字段
- 导出优先支持 `Markdown / HTML`
- 首版需要回收站和历史版本
- 产品只支持 Windows

## 2. 推荐技术栈

### 2.1 核心栈
- 桌面壳：`Electron`
- UI：`React + TypeScript + Vite`
- 编辑器：`TipTap + ProseMirror`
- 本地数据库：`SQLite + FTS5`
- 数据访问：`better-sqlite3`
- 加密：`Argon2id + AES-256-GCM`
- 状态管理：`Zustand`
- 路由：`React Router`
- IPC 约束：`contextIsolation + preload bridge`

### 2.2 选型理由
- `Electron` 不依赖系统 `WebView2`，运行环境可控。
- `TipTap` 更适合实现图片块、敏感字段块、导出转换。
- `SQLite + FTS5` 足够支撑本地离线搜索。
- `better-sqlite3` 同步 API 简单稳定，适合桌面本地应用。
- `AES-256-GCM` 适合字段级加密，`Argon2id` 适合主密码派生。

## 3. 推荐目录结构

建议采用单仓库、单桌面应用结构，先不要为了单机产品过早拆成复杂 monorepo。

```text
secure/
├─ docs/
│  ├─ plans/
│  └─ research/
├─ scripts/
│  ├─ dev/
│  └─ build/
├─ resources/
│  ├─ icons/
│  └─ templates/
├─ src/
│  ├─ main/
│  │  ├─ bootstrap/
│  │  ├─ windows/
│  │  ├─ tray/
│  │  ├─ ipc/
│  │  ├─ services/
│  │  ├─ db/
│  │  ├─ security/
│  │  ├─ search/
│  │  ├─ files/
│  │  └─ exports/
│  ├─ preload/
│  │  ├─ index.ts
│  │  ├─ api/
│  │  └─ types/
│  ├─ renderer/
│  │  ├─ app/
│  │  ├─ routes/
│  │  ├─ layouts/
│  │  ├─ features/
│  │  │  ├─ notes/
│  │  │  ├─ editor/
│  │  │  ├─ search/
│  │  │  ├─ secrets/
│  │  │  ├─ trash/
│  │  │  ├─ history/
│  │  │  ├─ settings/
│  │  │  └─ export/
│  │  ├─ components/
│  │  ├─ stores/
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  ├─ styles/
│  │  └─ types/
│  └─ shared/
│     ├─ contracts/
│     ├─ constants/
│     ├─ schemas/
│     └─ types/
├─ package.json
├─ tsconfig.json
└─ electron-builder.yml
```

## 4. 进程边界与职责

### 4.1 Main Process

Main 进程只负责桌面能力、数据库、文件系统和安全敏感逻辑，不负责页面 UI。

主要职责：
- 创建主窗口、锁屏窗口、设置窗口
- 管理系统托盘和应用生命周期
- 初始化数据库连接和应用数据目录
- 执行 IPC 请求
- 处理导入导出、备份恢复
- 负责主密码校验、密钥派生和敏感字段加解密
- 维护解锁后的敏感字段搜索索引

不应放在 Main 中的内容：
- 复杂页面状态
- 编辑器视图逻辑
- 普通组件交互

### 4.2 Preload

Preload 是安全桥，不承载业务决策。

主要职责：
- 通过 `contextBridge` 暴露最小 API
- 对 IPC 参数做初步格式约束
- 屏蔽 Electron/Node 原生对象，避免直接注入到 Renderer

典型 API：
- `window.notesApi.note.list()`
- `window.notesApi.note.saveDraft()`
- `window.notesApi.search.query()`
- `window.notesApi.secret.reveal()`
- `window.notesApi.export.toMarkdown()`

### 4.3 Renderer

Renderer 负责整个可视化产品体验。

主要职责：
- 三栏笔记布局
- TipTap 编辑器
- 全局搜索 UI
- 敏感字段显示/隐藏交互
- 回收站和历史版本页面
- 设置页和导出界面

### 4.4 Shared

`shared` 目录只放跨进程稳定契约：
- DTO
- IPC channel 常量
- zod 校验 schema
- 枚举和常量

不要放：
- 数据库访问
- Electron 运行时对象
- React 组件

## 5. 业务模块拆分

### 5.1 note_service
- 新建、编辑、删除、收藏、归档
- 自动保存
- 最近编辑/最近打开

### 5.2 editor_service
- TipTap 文档结构转换
- HTML / Markdown 导出序列化
- 图片块和敏感字段块转换

### 5.3 search_service
- 普通正文全文搜索
- 敏感字段搜索合并
- 搜索结果排序和掩码处理

### 5.4 secret_service
- 主密码派生
- 会话解锁
- 字段加解密
- 显示/隐藏控制

### 5.5 attachment_service
- 图片导入、复制、缩略图生成
- 附件元数据维护
- 删除与回收站联动

### 5.6 history_service
- 版本快照生成
- 版本列表查询
- 版本对比与恢复

### 5.7 trash_service
- 软删除
- 恢复
- 彻底删除

### 5.8 export_service
- 单条笔记导出
- 批量导出
- `Markdown / HTML` 资源打包

## 6. 数据流设计

### 6.1 普通编辑保存流
1. Renderer 中编辑器内容变化
2. 本地 store 标记脏状态
3. 节流后通过 preload 调用 `note.saveDraft`
4. Main 进程保存当前文档、生成纯文本摘要、更新 FTS
5. 满足版本策略时写入 `note_versions`

### 6.2 敏感字段查看流
1. 用户点击显示敏感字段
2. Renderer 调用 `secret.reveal(fieldId)`
3. Main 校验当前会话是否已解锁
4. Main 解密字段并返回给 Renderer
5. Renderer 仅在当前视图中短时显示，不入全局 store 持久缓存

### 6.3 搜索流
1. Renderer 输入搜索关键字
2. Main 先查 `FTS5`
3. 若当前为解锁状态，再查询内存中的敏感字段索引
4. Main 合并普通结果和敏感字段命中结果
5. 返回给 Renderer 时，对敏感字段结果默认做掩码处理

## 7. 数据库设计

## 7.1 表设计原则
- 当前数据和历史数据分开存储
- 普通正文与敏感字段分开存储
- 附件只存元数据，文件本体放到应用数据目录
- 回收站采用软删除，不直接物理删除笔记

## 7.2 建议表清单

### `folders`
用于分类或笔记本层级。

字段建议：
- `id`
- `parent_id`
- `name`
- `sort_order`
- `created_at`
- `updated_at`

### `notes`
保存笔记主记录。

字段建议：
- `id`
- `folder_id`
- `title`
- `status` (`active` / `archived` / `trashed`)
- `is_favorite`
- `summary_text`
- `current_version_no`
- `created_at`
- `updated_at`
- `last_opened_at`
- `trashed_at`

### `note_documents`
保存当前版本的编辑器文档内容。

字段建议：
- `note_id`
- `doc_json`
- `plain_text`
- `html_cache`
- `updated_at`

说明：
- `doc_json` 保存 TipTap/ProseMirror JSON
- `plain_text` 用于普通搜索摘要和导出辅助
- `html_cache` 可选，便于快速导出和预览

### `secret_fields`
保存敏感字段。

字段建议：
- `id`
- `note_id`
- `block_id`
- `label`
- `field_type`
- `ciphertext`
- `iv`
- `meta_json`
- `created_at`
- `updated_at`

说明：
- `block_id` 对应编辑器中的自定义节点
- `meta_json` 可保存显示策略、字段顺序、是否允许复制等

### `attachments`
保存图片和附件元数据。

字段建议：
- `id`
- `note_id`
- `block_id`
- `storage_key`
- `original_name`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `caption`
- `sha256`
- `created_at`
- `deleted_at`

### `tags`
- `id`
- `name`
- `color`
- `created_at`

### `note_tags`
- `note_id`
- `tag_id`

### `note_versions`
保存历史版本快照。

字段建议：
- `id`
- `note_id`
- `version_no`
- `title_snapshot`
- `doc_json_snapshot`
- `plain_text_snapshot`
- `secret_snapshot_ciphertext`
- `created_at`
- `reason`

说明：
- 采用快照模型，MVP 实现最简单
- `secret_snapshot_ciphertext` 保存当次版本对应的敏感字段快照
- `reason` 可标注 `autosave`、`manual`、`restore`

### `app_settings`
保存应用配置。

字段建议：
- `key`
- `value_json`
- `updated_at`

### `search_notes_fts`
FTS5 虚拟表，用于普通内容检索。

索引内容：
- 标题
- 普通正文
- 标签文本

## 7.3 建议的物理目录

```text
%AppData%/<app-name>/
├─ app.db
├─ attachments/
├─ thumbnails/
├─ exports/
└─ backups/
```

## 8. 搜索设计

### 8.1 普通内容搜索
- 使用 `SQLite FTS5`
- 索引标题、普通正文、标签
- 搜索结果按命中位置、最近更新时间、收藏状态综合排序

### 8.2 敏感字段搜索

推荐方案：`仅在解锁会话中建立内存索引`

实现方式：
1. 用户输入主密码解锁
2. Main 进程解密所有敏感字段或按需解密当前批次
3. 将可搜索 token 构建为内存索引
4. 搜索时与 FTS5 结果合并
5. 锁定时销毁内存索引

推荐该方案的原因：
- 不需要把敏感内容可搜索信息落盘
- 实现复杂度明显低于 blind index / searchable encryption
- 对个人离线应用已经足够实用

结果返回策略：
- 不直接返回明文命中片段
- 仅返回 `note_id + field_label + field_type + masked_preview`
- 用户进入笔记后再单独显示

## 9. 加密与会话设计

### 9.1 主密码
- 首次启动设置主密码
- 使用 `Argon2id` 派生主密钥
- 不保存明文密码

### 9.2 加密范围
- `secret_fields.ciphertext`
- `note_versions.secret_snapshot_ciphertext`
- 可选：导出包中的敏感部分

普通正文默认不整体加密，原因：
- 需要良好的全文搜索
- 需要顺畅的编辑和导出
- 当前产品是“笔记优先，隐私辅助”，不是密码保险箱

### 9.3 会话状态
- 应用启动后进入锁定态
- 解锁后建立会话密钥和敏感字段内存索引
- 自动锁定或手动锁定时，清空内存中敏感明文和搜索索引

## 10. 回收站与历史版本

### 10.1 回收站
- 删除笔记时，仅将 `notes.status` 改为 `trashed`
- 记录 `trashed_at`
- 回收站支持恢复和彻底删除
- 彻底删除时同步清理附件和历史版本

### 10.2 历史版本
- 采用快照模型，不做操作事件流
- 触发时机建议：
  - 手动保存
  - 编辑停止超过一定时间
  - 从当前页切换到其他笔记前
  - 恢复历史版本前

版本保留建议：
- 默认保留最近 `50` 个版本
- 同时支持按时间清理，例如 `90` 天前的自动快照

## 11. 导出设计

### 11.1 Markdown 导出
- 普通段落转标准 Markdown
- 图片导出为相对路径资源
- 敏感字段块转为自定义 fenced block 或 masked placeholder
- 对复杂富文本允许降级

示例：

````md
## API Notes

Service: payment-sandbox

```secret
label: API Key
value: ********
```
````

### 11.2 HTML 导出
- 优先保留富文本布局
- 图片直接引用导出目录中的资源
- 敏感字段可选择：
  - 掩码导出
  - 明文导出
  - 不导出

## 12. IPC 契约建议

建议按领域拆 channel，不要做一个大而全的 `invoke("app:call")`。

建议命名：
- `note:list`
- `note:get`
- `note:create`
- `note:saveDraft`
- `note:moveToTrash`
- `note:restore`
- `search:query`
- `secret:unlock`
- `secret:reveal`
- `secret:hide`
- `history:list`
- `history:restore`
- `export:markdown`
- `export:html`

## 13. MVP 实现顺序

### Phase 1
- 初始化 Electron + React + Vite 工程
- 建立 `main / preload / renderer / shared` 目录
- 打通基础 IPC

### Phase 2
- 建立 SQLite 和基础表
- 完成笔记 CRUD、文件夹、标签
- 接入 TipTap 编辑器

### Phase 3
- 完成图片附件导入
- 完成敏感字段块和加密存储
- 完成普通搜索与敏感字段搜索

### Phase 4
- 完成回收站和历史版本
- 完成 Markdown / HTML 导出
- 完成设置页与自动锁定

### Phase 5
- 做稳定性测试
- 优化启动速度、搜索速度、导出一致性
- 补齐打包与安装流程

## 14. 当前最重要的未决点

1. 敏感字段内存索引是全量建立还是按需懒加载
2. Markdown 导出里，敏感字段块最终采用哪种自定义格式
3. 历史版本是按数量保留、按时间保留，还是两者结合
