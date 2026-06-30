# Fitness Record

> Obsidian 健身记录插件。一个视图，记录训练、整理动作库、顺手看肌群热力图。

## 功能特色

### 🏋️ 动作库
按板块管理训练动作，支持新建、编辑、收起和展开。每个动作可绑定多个目标肌群，并填写简要说明；动作库卡片会单行显示说明，超出部分省略，悬停可查看完整内容。

### 📋 健身记录
主展示区按日期分组展示训练记录，支持搜索、编辑和删除。每个动作单独成条，日期标题后会显示当天最新体重。

### 🔥 肌肉热力图
根据记录中选择的动作，自动统计肌群出现次数，并在正面 / 背面视图中展示热力强度。热力图支持时间范围切换，包含“全部”。

### 📈 体重变化
右侧热力图下方会同步展示体重折线图，时间范围与肌肉热力图一致。

### 🧩 可配置视图
支持自定义数据文件路径、视图标题，以及启动时自动打开健身记录视图。

### ⚡ 快捷操作
支持功能区按钮、命令面板打开视图，也可以直接新增一条健身记录。

## 设置选项

- **数据文件** - 保存健身记录数据的 Markdown 文件路径
- **视图标题** - 健身记录标签页显示名称
- **启动时打开** - 打开 Vault 时自动打开健身记录视图

## 安装

### 手动安装
1. 下载或自行构建本项目。
2. 将 `main.js`、`styles.css` 和 `manifest.json` 放入 Vault 的 `.obsidian/plugins/fitness-record/` 目录。
3. 打开 设置 > 第三方插件，启用 "Fitness Record"。

## 使用方法

1. 点击左侧功能区的哑铃图标，或使用命令面板执行 `打开健身记录`
2. 首次打开时，插件会自动创建默认数据文件 `fitness-record.md`
3. 在视图中维护动作库、填写训练记录，数据会直接写回 Markdown 文件
4. 可使用 `新增健身记录` 命令快速打开添加记录弹窗
5. 右侧热力图侧边栏可固定、收起并手动拖拽宽度

## 数据格式

插件会在数据文件中维护一个 `fitness-record` YAML 数据块。你可以手动编辑，但请保持格式有效。

默认数据文件示例：

```markdown
# 健身记录

该文件由 Fitness Record 插件维护。可以手动编辑下方数据块，但请保持 YAML 格式有效。

```fitness-record
schemaVersion: 1
sections:
  - id: chest
    name: 胸
    collapsed: false
    actions:
      - id: bench-press
        name: 卧推
        muscles:
          - pectoralis-major
          - triceps-brachii
          - anterior-deltoid
        description: 杠铃或哑铃卧推。
columns:
  - id: date
    title: 日期
    type: date
    wrap: false
    sort: none
    suffix: ""
    locked: true
records: []
ui:
  leftCollapsed: false
  rightCollapsed: false
  heatmapDays: 90
```
```

## 兼容性

- Obsidian v1.0.0+
- 桌面端和移动端

## 开发

```bash
npm install
npm run build
```

## 许可证

0BSD
