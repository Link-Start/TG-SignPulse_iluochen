---
name: TG SignPulse
description: Telegram 多账号签到与监控面板，“状态页”式界面：顶部色区报告今天的状态，下方卡片列出每个任务的 30 天记录
colors:
  field-danger: "#b73a43"
  field-ok: "#117453"
  field-warn: "#93500c"
  field-neutral: "#3c4b5e"
  field-danger-dark: "#9a2f37"
  field-ok-dark: "#0e5f45"
  field-warn-dark: "#7a430b"
  field-neutral-dark: "#243040"
  on-field: "#ffffff"
  on-field-2: "rgba(255, 255, 255, 0.88)"
  accent: "#1f6fd6"
  accent-soft: "#e7f0fc"
  accent-dark: "#2a74d6"
  accent-text-dark: "#6aa6f0"
  accent-soft-dark: "#16263b"
  on-accent: "#ffffff"
  up: "#22a562"
  down: "#e5484d"
  hole: "#e4e8ed"
  up-dark: "#2fbf71"
  down-dark: "#f0575c"
  hole-dark: "#262d36"
  success: "#157a47"
  success-soft: "rgba(34, 165, 98, 0.12)"
  danger: "#c1353b"
  danger-soft: "rgba(229, 72, 77, 0.11)"
  warning: "#9a4f00"
  warning-dot: "#e08a1e"
  warning-soft: "#fff1de"
  bg: "#f2f4f7"
  surface: "#ffffff"
  bg-dark: "#0c1014"
  surface-dark: "#151a20"
  sheet-surface-dark: "#1a2027"
  label: "#0f1720"
  label-2: "#5b6673"
  label-3: "#687382"
  faint: "#a3acb7"
  separator: "#e7eaef"
  fill: "rgba(15, 23, 32, 0.06)"
  pressed: "#eef1f5"
  label-dark: "#eef1f4"
  label-2-dark: "#9aa4af"
  separator-dark: "#232a33"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans SC\", Roboto, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "22px"
    letterSpacing: "-0.01em"
  row-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  group-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
  mono-figure:
    fontFamily: "ui-monospace, \"SF Mono\", SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "\"tnum\""
rounded:
  bar: "3px"
  chip: "10px"
  input: "12px"
  stat-cell: "12px"
  stat-group: "16px"
  lift-card: "16px"
  group: "18px"
  sheet: "22px"
  pill: "999px"
spacing:
  gutter: "16px"
  gutter-desktop: "32px"
  row-y: "11px"
  bar-gap: "3px"
  column-gap: "24px"
  container: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-sm:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "32px"
  button-tinted:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "32px"
  button-gray:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-danger-tinted:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  field-button:
    backgroundColor: "rgba(255, 255, 255, 0.16)"
    textColor: "{colors.on-field}"
    rounded: "{rounded.pill}"
    height: "36px"
  field-button-solid:
    backgroundColor: "{colors.on-field}"
    textColor: "{colors.field-danger}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  field-tab-active:
    backgroundColor: "{colors.on-field}"
    textColor: "{colors.field-danger}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-ok:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.chip}"
    padding: "0 9px"
    height: "26px"
  chip-bad:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.chip}"
    padding: "0 9px"
    height: "26px"
  chip-warn:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.chip}"
    padding: "0 9px"
    height: "26px"
  group-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.group}"
  lift-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lift-card}"
    padding: "12px 12px 12px 14px"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.label}"
    rounded: "{rounded.input}"
    padding: "12px 14px"
    height: "48px"
  task-row:
    backgroundColor: "{colors.surface}"
    padding: "14px 16px 12px"
---

# Design System: TG SignPulse

## Overview

**Creative North Star: "今天的状态页"（The Status Page）**

界面像一张公共服务状态页：进来第一眼先回答“今天怎么样”，再给出每个任务过去 30 天的记录。顶部是一整块通栏色区，颜色本身就是今天的结论：有失败是红，有账号待重新登录是橙，全部正常是绿，没有数据或加载中是中性蓝灰。色区里只有白字：一句带大号数字的结论、今日三格统计（兼作筛选），以及全站 30 天脉搏条。

色区之下是浅灰底上的白色卡片，密度偏高但留有呼吸：每个任务一行，行里是名称、成功率、30 根日状态条和一句最近结果。蓝色只属于“可以按的东西”，状态颜色只属于“发生了什么”，两套语义不混用。字体使用系统字体栈，中文为主要界面语言，英文同等支持；等宽字体只出现在百分比与时间上。

动效只为状态服务：运行中的今日状态条自下而上填满后呼吸，结束时以一次回弹落定为绿或红；色区换色用 0.6s 渐变；尊重 `prefers-reduced-motion`。

**Key Characteristics:**
- 通栏状态色区，颜色跟随今天的状态，并同步到浏览器 / PWA 的 theme-color
- 色区上只放白色文字与白色半透明控件
- 灰底 + 白卡片；桌面端卡片上移压住色区下沿
- 每个任务都有 30 天日状态条：绿 = 成功，红 = 失败，斜纹 = 无数据，描边 = 今天待执行
- 蓝色专供操作；状态色专供结果
- 系统字体；等宽只用于百分比和时间
- 手机底部 Tab 栏，桌面色区内顶部导航；详情一律用 Sheet

## Colors

调色策略是“一块状态色 + 一种操作蓝 + 一对结果色”，其余全部是冷灰中性色。

### Primary
- **状态色区四色**（`field-danger` / `field-ok` / `field-warn` / `field-neutral`，深色模式各有更深的一版）：通栏色区与吸顶导航的底色，由页面状态决定（首页：失败 > 待重新登录 > 正常 > 中性；账号页：有失效账号为 warn，否则 ok；设置页：必须改密码时为 warn）。取值比设计稿刻意压暗，确保 88% 白的次级文字在四种底色上均不低于 4.5:1（实测浅色最低 4.73:1，深色最低 6.09:1）。
- **色区白**（`on-field` / `on-field-2`）：色区上唯一允许的文字颜色。主文字纯白，日期行、说明、统计标签用 88% 白。

### Secondary
- **操作蓝**（`accent`，深色下文字用 `accent-text-dark`）：主按钮、Tinted 按钮、焦点环、输入光标、选中行底色、时间线“现在”节点、运行中状态条。**不**用于表达任何结果。

### Tertiary
- **状态条绿 / 红**（`up` / `down`）：30 天日状态条、任务状态圆点、底部 Tab 的计数角标（红）。
- **结果文字色**（`success` / `danger` / `warning` 及其 `-soft`）：状态 Chip、行内结果文字、提醒卡片图标底。文字色比状态条色更深，以保证小字对比度。
- **无数据斜纹**（`hole`）：没有记录的日子用 135° 斜纹 + 1px 描边表示。

### Neutral
- **冷灰底**（`bg`）：色区之下的页面底色，也是 Sheet 底色。
- **卡片白**（`surface`）：所有卡片与列表行；深色 Sheet 内的分组再亮一级（`sheet-surface-dark`）。
- **文字三级**（`label` / `label-2` / `label-3`）与 **弱化灰**（`faint`，只用于箭头、空心状态圈等非文字元素）。
- **分隔线**（`separator`）、**填充**（`fill`，灰按钮与 Chip 底）、**按下态**（`pressed`）。
- **头像色**：六个中饱和色（#2b7fc6、#7c5cd6、#c46f16、#16877a、#c24b6e、#4f6fcf）按账号名哈希分配，仅用于首字母头像。

### Named Rules
**The Field Speaks Rule.** 色区的颜色就是页面结论，不能用作装饰色，也不能在卡片区里复用。新页面必须选定一个 `data-tone`，没有明确状态时使用 neutral。

**The White-Only Field Rule.** 色区上只出现白字、白色半透明底（16% / 26% 悬停）或白色实底控件；实底控件的文字取当前色区色。色区上不放蓝色按钮、不放状态色文字。

**The Blue Means Press Rule.** 蓝色只标记可操作元素。首屏最多一个实心蓝按钮（通常是提醒卡片里的“重新登录”）；任务行内的操作一律用 Tinted 按钮。

## Typography

**Display Font:** 系统字体栈（-apple-system / SF Pro Text / Segoe UI / PingFang SC / Microsoft YaHei / Noto Sans SC，回退 sans-serif）
**Body Font:** 同上
**Label/Mono Font:** ui-monospace / SF Mono / Menlo / Consolas

**Character:** 一套系统字体靠字重和字号拉开层级；大号结论字紧字距、粗体，读起来像一句播报。所有数字开启等宽数字（tabular-nums）。

### Hierarchy
- **Display**（700，桌面 40px，行高 1.14，字距 -0.02em）：色区里的页面结论 / 一级标题。结论中的数字放大到 1.5em。
- **Headline**（700，手机 26px（首页）/ 30px（一级页面），行高 1.14）：同一角色的手机尺寸。
- **Stat**（700，24px / 28px）：今日三格的数字；桌面脉搏的成功率用 28px 同风格。
- **Title**（700，17px / 22px，-0.01em）：账号名等卡片级标题；Sheet 标题用 20px / 600。
- **Row title**（600，16px / 22px）：任务名；侧栏条目为 14.5px / 600。
- **Body**（400，16px / 22px）：正文与输入框（输入框不小于 16px，避免 iOS 自动缩放）。
- **Meta**（400，13–13.5px / 18px）：结果说明、账号备注、日期行；最小 11.5px 只用于脉搏条下的日期刻度。
- **Group label**（600，13px，`label-2`，不大写、不加字距）：卡片内的分组名，如“接下来”“账号”。
- **Mono figure**（13px 等宽）：只用于百分比（92.5%）与时刻（07:30），以及日志视图（12.5px / 19px）。

### Named Rules
**The Mono Is For Numbers Rule.** 等宽字体只给百分比、时刻和原始日志；日期、计数、说明文字一律用系统字体。

**The Sentence Headline Rule.** 页面结论是一句完整的话（“2 个任务今天失败”），不是标签式短语；数字放大，文字不另加装饰。

## Layout

- **容器**：最大宽度 1200px 居中；左右内边距手机 16px（并尊重安全区），≥1024px 为 32px。
- **色区结构**：上方是吸顶导航条（手机 56px / 桌面 64px），下方是随页面滚走的内容区。手机上色区滚出后，导航条里的品牌名切换为页面标题，并加上一道轻阴影。
- **首页桌面**：色区内左右两栏（左：日期行 + 结论 + 今日三格，最大 470px；右：520px 大号脉搏条 92px 高）。色区下方为 `主栏 + 360px 侧栏` 两栏，间距 24px；主体整体上移 36px 压住色区下沿。
- **首页手机**：单栏；色区内依次为结论、三格、30px 高的细脉搏条；主体不上移，距色区 14px。
- **压边规则**：凡是压在色区边缘上的元素一定是卡片。因此桌面上账号标题收在卡片内部；手机上账号标题（头像 + 名称 + 状态 Chip）浮在灰底上，下方卡片只装任务行。
- **一级页面**（账号、设置）：色区内放大标题与副标题，底部留 48px（桌面 64px）让卡片压上来。
- **二级页面**（新建 / 编辑任务）：手机上导航条为返回 + 标题，隐藏底部 Tab，改用底部操作栏；桌面在色区内显示返回链接与大标题。
- **节奏**：卡片之间 16–20px；行内左右 16px（侧栏 18px）；列表行最小高度 48px；状态条之间 3px（桌面全站脉搏 5px）。
- **断点**：640px（Sheet 由底部抽屉变为居中对话框）、1024px（切换桌面布局与顶部导航）。

## Elevation & Depth

整体是“平面 + 一层浮起”。普通卡片几乎不投影，只用 1px 描边式阴影与底色区分；需要从色区上浮起来、或需要被注意到的卡片（失效提醒、登录表单）使用柔和的下投影。色区本身靠右下角一层 10% 白的径向光避免大面积纯色发闷。

### Shadow Vocabulary
- **Card hairline**（`box-shadow: 0 1px 0 var(--separator), 0 0 0 1px var(--separator)`）：所有分组卡片。
- **Lift**（`box-shadow: 0 1px 0 var(--separator), 0 10px 28px -14px rgba(15, 23, 32, 0.3)`）：提醒卡片、登录表单卡片。
- **Float**（`box-shadow: 0 12px 32px -8px rgba(15,23,32,0.28), 0 1px 3px rgba(15,23,32,0.08)`）：Sheet 面板。
- **Raised bar**（`box-shadow: 0 1px 0 rgba(0,0,0,0.14), 0 6px 16px -10px rgba(0,0,0,0.4)`）：色区滚出后吸顶导航条。
- **Material**（92% 表面色 + `saturate(180%) blur(20px)`）：底部 Tab 栏与底部操作栏。

### Named Rules
**The One Lift Rule.** 一屏里只有需要立刻处理的东西浮起来；其余卡片保持描边式平面。

## Shapes

圆角由外向内递减：Sheet 22px → 分组卡片 18px → 浮起卡片 / 三格外框 16px → 输入框、三格单元、分段控件 12px → Chip 10px → 日状态条 3px（全站脉搏手机 2px）。所有按钮、Tab、色区按钮都是胶囊形（999px）；状态标记、头像、时间线节点都是正圆。品牌标记是圆角方块（边长 × 0.29），内含一条白色脉冲折线。卡片 `overflow: hidden` 裁切行的按下态。

## Components

### Buttons
干净的胶囊，按下时轻微缩小（0.97，色区按钮 0.94）。
- **Shape:** 胶囊（999px）；常规 44px 高，大号 52px，小号 32px（点按热区外扩至 44px）。
- **Primary:** 操作蓝底白字，600 字重；悬停混入 10% 黑，按下混入 14% 黑。
- **Tinted:** 浅蓝底 + 蓝字，任务行内的“重试”“重新登录”固定使用它。
- **Gray / Plain / Danger tinted:** 灰填充 + 主文字；透明底蓝字（悬停出浅蓝底）；浅红底红字用于危险操作。
- **Hover / Focus:** 悬停只在精确指针设备上生效；焦点环为 2px 蓝色、偏移 2px（色区上改为白色）。
- **Disabled:** 40% 透明度。
- **Icon button:** 32px（大号 36px）圆形，热区不小于 44px。

### Field controls（色区上的控件）
- **色区按钮：** 36px 圆形，16% 白底，悬停 26%；带文字时左右 14px。实底版本为白底 + 当前色区色文字（桌面“新建任务”）。
- **顶部导航 Tab（桌面）：** 36px 胶囊，默认 88% 白字；当前页为白底 + 色区色文字；悬停 14% 白底。账号 Tab 带计数角标（白底色区字，当前页时反转）。
- **今日三格：** 16px 圆角的 16% 黑底容器，内含三个可按单元（失败 / 待执行 / 成功），数字 24px 粗体，标签前带 7px 浅色圆点；按下后变白底色区字、圆点换回真实状态色；数值为 0 时数字降为 60% 白。

### Chips
- **Style:** 26px 高、10px 圆角、12.5px / 600，前置 6px 当前色圆点。
- **State:** 正常（绿 soft）、N 个失败（红 soft）、需重新登录（橙 soft）；默认灰填充；蓝色版本只用于操作相关标注。

### Cards / Containers
- **Corner Style:** 分组卡片 18px，浮起卡片 16px。
- **Background:** 卡片白；深色 Sheet 内提亮一级。
- **Shadow Strategy:** 见 Elevation（hairline / lift）。
- **Border:** 无实线边框，靠阴影描边；行之间 1px 分隔线，从左 16px 缩进开始。
- **Internal Padding:** 行 11px 16px；侧栏卡片标题 16px 18px 6px。
- **提醒卡片：** 浮起卡片，左侧 36px 橙色 soft 圆角方块内放实心警告图标，中间两行文字，右侧小号实心蓝按钮。

### Inputs / Fields
- **分组内输入行：** 48px 高，无边框透明输入，文字右对齐；聚焦时行左侧出现 3px 蓝色内描边。
- **独立输入框：** 48px 高、12px 圆角、卡片白底 + 1px 分隔线色描边；聚焦时描边变蓝并加 3px 浅蓝外环；错误态描边变红。等宽变体（15px）用于 Token、Session 等机器字符串。
- **下拉：** 去掉原生外观，右侧叠加 caret 图标。
- **分段控件：** 12px 圆角灰填充轨道，白色滑块 0.3s out-expo 平移。

### Navigation
- **手机：** 底部 Tab 栏（任务 / 账号 / 设置），高 54px + 安全区，毛玻璃材质 + 顶部分隔线；图标 26px（当前页实心、蓝色），标签 10.5px / 600；账号 Tab 在有失效账号时显示红色计数角标（白色 2px 描边）。二级页面隐藏 Tab 栏。
- **桌面：** 色区顶部导航条：品牌标记 + 名称、导航 Tab、右侧操作。
- **图标：** 统一使用 Phosphor 图标库（regular / bold / fill 三种字重表达状态）。

### Sheets
- **手机：** 底部抽屉，顶部 22px 圆角、36×5 抓手，可下拉关闭（拖动超过 110px 或快速下滑），0.42s `cubic-bezier(0.32, 0.72, 0, 1)`。
- **≥640px：** 居中对话框（420 / 540 / 680 / 880px 四档），缩放 0.97→1 淡入。
- **结构：** 标题（20px / 600）+ 副标题 + 圆形灰色关闭按钮；可选固定底部操作区（顶部分隔线）。遮罩 40% 黑（深色 60%）。任务详情、账号详情、设置子项都走 Sheet。

### Task Row（签名组件）
整行可点开详情，行内按钮浮在上层。
- 第一行：18px 状态圆点（成功绿底白勾 / 失败红底白叹号 / 待执行空心灰圈 / 已暂停灰圈暂停符 / 运行中蓝色旋转弧）+ 任务名 + 右侧等宽成功率（桌面追加“· 30 天”）。
- 第二行：30 根日状态条，高 30px。
- 第三行：一句结果文字（成功绿、失败红、运行中蓝色并以推入动画滚动最新日志行），右侧为 Tinted 操作按钮或“今天”刻度。
- 已暂停的任务状态条降到 40% 透明度。

### 30-Day Status Bars（签名组件）
- **单任务版：** 等宽柱，3px 圆角；绿 = 当日成功，红 = 失败，135° 斜纹 = 无记录，1.6px 灰描边空心 = 今天待执行。
- **运行中：** 今日柱底色浅蓝，蓝色实心自下而上填满（1.4s `cubic-bezier(0.22, 1, 0.36, 1)`），之后 1.6s 呼吸；结束后换成绿或红并以 0.6s 回弹（从 35% 高度）落定。
- **全站脉搏（色区内）：** 92% 白柱，失败比例以深色顶段表示（最少 12%），无数据为 20% 白；今天这根外加一圈白色描边。手机 30px 高，桌面 92px 高、柱距 5px，下方为日期刻度与“今天”。

### Timeline（桌面侧栏“接下来”）
64px 等宽时刻列 + 10px 空心节点 + 竖线；“现在”节点为浅蓝底蓝环，会被跳过的时段为橙环并以橙字说明原因。

## Do's and Don'ts

### Do:
- **Do** 为每个页面选定色区 tone（danger / ok / warn / neutral），并让 theme-color 跟随它。
- **Do** 在色区上只用白字；次级文字用 88% 白，新增色区色值前先验证与 88% 白的对比度不低于 4.5:1。
- **Do** 让压在色区下沿的元素永远是卡片；手机上首页不做上移，账号标题浮在灰底上。
- **Do** 用 30 天日状态条表达任何“按天”的历史，沿用绿 / 红 / 斜纹 / 空心描边四种状态。
- **Do** 把行内操作做成 32px Tinted 胶囊按钮，首屏只保留一个实心蓝按钮。
- **Do** 所有数字开启 tabular-nums；百分比和时刻用等宽字体。
- **Do** 详情与编辑优先用 Sheet，手机为底部抽屉，桌面为居中对话框。
- **Do** 中文文案优先，同时保证英文文案在同样宽度下不溢出（截断或换行）。

### Don't:
- **Don't** 在色区上放蓝色按钮、状态色文字或卡片以外的浅色块。
- **Don't** 用蓝色表示成功、失败或任何结果，也不要用绿 / 红表示可点击。
- **Don't** 在正文、日期或计数上使用等宽字体。
- **Don't** 把色区颜色当成装饰色用在卡片区。
- **Don't** 给普通分组卡片加 lift 阴影；浮起只留给需要立即处理的内容。
- **Don't** 在分组标题上使用全大写、加宽字距的小标签；分组名就是 13px / 600 的普通灰字。
- **Don't** 用文字符号或 emoji 充当图标，统一使用 Phosphor 图标。
