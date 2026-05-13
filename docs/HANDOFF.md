# 🚀 会话交接档 · 长腿欧巴 V2 Chrome 扩展

> 新会话请先读完本文件再动手。记忆全在这里，本地可能已失忆。
> 最近更新：2026-05-10
> 本文件位置：`docs/HANDOFF.md`（enhance-product-details 分支）

---

## 📦 项目基本信息

- **仓库**：[wmjagpjm/star](https://github.com/wmjagpjm/star)
- **下载最新代码**：https://github.com/wmjagpjm/star/archive/refs/heads/enhance-product-details.zip
- **仓库本地路径（沙箱）**：`/projects/sandbox/star/`
- **性质**：Chrome 扩展（Manifest V3）
- **业务**：Ozon 俄罗斯电商选品助手 + 1688 同款匹配
- **用户**：自称"长腿欧巴"，中文交流，俄罗斯电商卖家
- **宿主站点**：ozon.ru、seller.ozon.ru、1688.com、taobao/tmall、Amazon

---

## 🌿 分支状态（2026-05-10）

**当前工作分支**：`enhance-product-details`

最近提交：
```
60f50a3 Revert "Plan A: DOM scraper"          ← 当前头，= e10287d 昨晚基线
044f48e Plan A: DOM scraper                   ← 已被撤回
22de6be Revert "Anti-scrape: masked headers"  ← 之前
c1e9d20 Revert "Preserve list-page prices"    ← 之前
e10287d Default to no sorting param + data-completeness diagnostic in export
9635408 Remove references to non-existent core/ozon-product-fetcher.js
b77b9c5 Adaptive product feature extraction across categories
```

**关键：`popup.js` 内容 = `e10287d` 快照**。中间几次尝试全部被 revert，等于回到"方案选择之前"的干净起点。4 个 revert commit 两两抵消。

**打开的 PR**（main 分支上，旧的，都未合并）：
- #1 `remove-popup-new`：删除 popup-new 文件
- #2 `docs-archive`：归档 md 文档
- #3 `fix-category-search`：类目搜索优化
- #4 `enhance-product-details`：当前工作 PR

---

## 🎯 当前任务：老板贴了三个文件（main 分支 `自动化流程任务/`）

### 文件清单

| 文件 | 性质 | 关键内容 |
|---|---|---|
| `自动化流程.docx` | 业务老板原始需求 | 短，核心清晰 |
| `openclaw给出的任务划分...md` | 6 模块开发任务书（P0-P3） | 8KB，理想化 |
| `梁生定价模板.html` | **已能用的定价计算器单页应用** | **6745 行 · 最大资产** |

### 梁生定价模板 html 核心资产

- `ZTORFBSCarrier` class：中通跨境 rFBS v6.3 完整运费引擎
  - 5×4 货件分组矩阵（Extra Small / Budget / Small / Big / Premium Small / Premium Big）
  - 三档运费（express 空运 / standard 陆空 / economy 陆运）
  - 密度校验（Extra Small 55 kg/m³）、计抛规则、尺寸限制
- `FreightEngine` class：插件化多物流商架构（可扩展 SF、速卖通等）
- `doCalculate()` 完整公式链
- 13 项增值服务 VAS 费率表 + 4 个中通集货仓地址

### 关键公式（**有冲突**，必须先问老板）

**md 说的**：
```
推荐售价 = (黑标 - 绿标) × 2.2 + 黑标 - 1
```

**html 实际实现**（见模板 6456 行）：
```js
realRMB = (black - green) * 2.24 + black;           // 2.24 不是 2.2
recommendPrice = realRMB * 0.95;                     // 多了 5% 让利

commission = price * (comm_r / 100);
misc = price * 0.04;                                 // 4% 杂费（md 说 5%）
profit = price - cost - freight - label_fee - commission - misc;
profitRate = (profit / (cost + freight)) * 100;      // 分母是成本，不是售价！
```

**两边对不上**：系数（2.2/2.24）、是否 ×0.95、杂费比例（4%/5%）、利润率分母（售价/成本）全都不一样。

**必须让老板确认。** 倾向听 html（是活跑着的），但以老板拍板为准。

---

## 📊 当前插件 vs 需求：差距矩阵

| 功能 | 现状 | 需求 | 缺口 |
|---|---|---|---|
| Ozon 类目/批量/店铺抓取 | ✅ 有 | Seerfar 热销/最新/类目/店铺 | 🟡 数据源不同 |
| 6 项筛选条件 | ✅ 部分（价格/销量/FBS） | + 跟卖数/创建天数/重量区间 | 🟢 补 3 项 |
| 绿标/黑标价区分 | ❌ 无 | 必须 | 🔴 依赖毛子 ERP（未定） |
| 重量/尺寸/佣金/运费 | ⚠️ 仅规格 | 必须 | 🟡 佣金要爬，运费用模板 |
| 1688 比价 | ✅ 有（`1688-api.js` + `1688-auto-compare.js` 1090 行） | 要 | 🟢 已覆盖 |
| 拼多多比价 | ❌ 无 | 可选 | 🟡 PDD 反爬凶 |
| 推荐售价公式 | ❌ 无 | 有 | 🔴 公式版本冲突 |
| 运费引擎 | ❌ 无 | 要 | 🟢 **模板可直接移植** |
| 利润/利润率/≥22% 过滤 | ❌ 无 | 要 | 🟡 公式明确，易实现 |
| 结果表 10 列 | ⚠️ 部分 | 要 | 🟢 扩表即可 |
| 人工勾选 + 一键上架 | ❌ 无 | 要 | 🔴 依赖 Ozon Seller API（未申请） |
| 定价计算器 UI | ❌ 无 | 模板可提供 | 🟢 **直接集成梁生模板** |

---

## ⚠️ 6 个关键决策点（等老板确认）

1. **推荐售价公式** —— md 版 `*2.2+黑标-1` vs html 版 `*2.24 再 *0.95`？倾向 html（活跑的）
2. **毛子 ERP** —— 具体哪家？有 API 吗？能给文档吗？（这是绿标价的关键依赖）
3. **Seerfar vs Ozon** —— 用哪个做数据源？Seerfar 账号有没有？
4. **拼多多比价** —— 要不要做？1688 已够？
5. **Ozon Seller API** —— 申请了没？没申请 P2 阶段做不了"一键上架"
6. **定价模板集成方式** —— 整个 html 作为独立页？还是拆进 popup？

---

## 🚧 核心困难（必读）

### 困难 1：Ozon 反爬（贯穿始终）

- 详情 API `entrypoint-api.bx/page/json/v2` 返回 **HTTP 403 + HTML challenge 页面**（`<title>Доступ ограничен</title>`）
- 用户诊断已确认（SKU=1519107271 Weissgauff 冰箱在商品页 F12 跑脚本）
- 昨晚尝试的 B 方案（header 伪装 + 预检）失败
- 昨天的用户日志显示：`composer-api.bx` / `pdpGetButtonTexts` / **甚至商品页 HTML 本身**都 403
- 发现重要信号："**一打开 F12 就断开**" → Ozon 有 DevTools 检测，触发反爬升级
- 浏览器 agent 验证：无 `__NEXT_DATA__` 内嵌 JSON，所有数据都在 SPA 渲染后的 DOM 里（51 个 data-widget）

**结论**：
- 不能 fetch API → 403
- 不能 fetch HTML → 403
- 只能打开 tab 让浏览器自己渲染，再读 DOM（方案 A/A3）

### 困难 2：方案 A 尝试过但被用户撤回

- `044f48e` 写过一版：pinned 后台 tab，逐 SKU 导航，等 Vue 渲染，用 `scrapeProductDom()` 读 DOM
- 选择器是基于浏览器 agent 给的真实 DOM 写的（见下节 DOM 知识库）
- **用户撤回了**，没说原因，疑似觉得有问题。**新会话如果要重做方案 A，务必先问用户原因**
- 撤回的 diff 可在 `044f48e` 和 `60f50a3`（revert）的 git history 里找回

### 困难 3：批量模式强制过滤器有"擦价格"bug（历史教训）

- 老代码（`popup.js` 当前版本 919-921 行附近）：`product.cardPrice = info.cardPrice || ''` —— API 失败时会把**列表页已抓到的价格擦成空字符串**
- 过滤器 `if (!product.bestSellerPrice) return` —— 反爬时 bestSellerPrice 为空，所有商品被**直接丢弃**
- 这两个 bug 合起来导致反爬时 UI 里**商品图+价格全空**
- 修法：`if (info.cardPrice) product.cardPrice = info.cardPrice;`（有值才覆盖）+ 放宽过滤为"只要有任一价格就保留"
- 曾经写过修复 commit（`7248eda`），后来也被 revert 回退

---

## 📐 Ozon 商品页 DOM 知识库（来自浏览器 agent 诊断，2026-05-10）

**测试 URL**：`https://www.ozon.ru/product/1519107271/` (Weissgauff 冰箱)

**关键观察**：
- ❌ 无 `<script id="__NEXT_DATA__">`
- ❌ 同源 XHR `fetch('/product/.../')` 也返回 403
- ✅ 浏览器渲染后 DOM 里所有数据都在，51 个 `data-widget`

**选择器映射表**（已验证可用）：

| 字段 | 选择器 | 示例值 |
|---|---|---|
| 银行卡价（С банками） | `[data-widget="webPrice"] .tsHeadline600Large` | `3 563,67 ¥` |
| 其他银行价（С другими банками） | `[data-widget="webPrice"] .pdp_bj.tsHeadline500Medium` | `3 818,73 ¥` |
| 标题 | `[data-widget="webProductHeading"] h1` | 完整俄文标题 |
| 主图 | `[data-widget="webGallery"] img:first` | `https://ir-2.ozonstatic.cn/...` |
| 评分 | `[data-widget="webSingleProductScore"]` innerText 正则 `\d+\.\d+` | `4.7` |
| 评论数 | 同上 innerText 正则 `\d+\s*отзыв` | `238` |
| 品牌 | **h1 首个大写词**（webBrand widget 只有"原装"徽章无品牌名） | `Weissgauff` |
| 规格表 | `[data-widget="webShortCharacteristics"] .pdp_b7p.pdp_b3p` 每行 | key→value |
| 规格行 key | `.pdp_bp4 span span` | `Размеры, мм (ШхГхВ)` |
| 规格行 value | `.pdp_p4b .pdp_p5b` 或 `.pdp_p4b a` 或 `.pdp_p4b span` | `780х713х1714` |

反爬 challenge 页特征：**无 h1 + body 包含 "Доступ"**。

---

## 💡 推荐的分阶段落地计划

### Phase 0：决策不动代码（1-2 天）
用户去问老板 6 个决策点，等回话。

### Phase 1：把梁生定价模板作为独立页集成（3-4 天，最低风险）
不碰 ERP、不碰反爬、不碰 Seerfar，纯粹移植定价计算器：

```
pricing/
  carriers/zto-rfbs.js     ← 从模板拆出 ZTORFBSCarrier
  freight-engine.js        ← 拆出 FreightEngine
  calculator.html          ← UI
  calculator.js            ← doCalculate() 等
```

- `manifest.json` 注册独立页
- `popup.html` 加按钮"打开定价计算器"
- 现有商品卡片加"发送到定价计算器"按钮，预填参数

**价值**：即使所有其他功能都黄了，这一块独立可用。

### Phase 2：Ozon 选品 → 10 列表格 → 手动跳定价（5-7 天）
前提：Phase 0 答案明确。暂时用"黑标 = 页面爬价格"，绿标手动填。

### Phase 3：全自动化（ERP + Seller API 解决后）
自动填绿标 / 自动过滤 22% 利润率 / 一键上架。

### Phase X（横切）：反爬治理
降并发、"人类节奏"、失败降级不丢数据（部分已做）。

---

## 🛠️ 代码结构速览

```
star/
├── manifest.json              # MV3，default_popup: popup.html
├── popup.html                 # 弹窗 UI（按类目/热销/店铺 5 种模式）
├── popup.js                   # 弹窗主逻辑（~1635 行）
│                              # 核心：fetchRealTimePrices (809 行起)
├── background.js              # service worker
├── content-scripts/
│   ├── category-scraper.js    # 类目模式：Ozon 前台 DOM 抓商品
│   ├── seller-bridge.js       # 批量模式：seller.ozon.ru Analytics API
│   ├── smart-picker.js        # Ozon 页面浮动选品按钮
│   ├── 1688-matcher.js        # 1688 同款匹配
│   └── content.js             # 通用压缩 content script（1.25MB）
├── 1688-api.js                # 1688 API 封装（346 行）
├── 1688-auto-compare.js       # 1688 自动比价（1090 行）
├── config.js                  # 佣金表、1688 API key 等
├── core/                      # ⚠️ 仓库里这个目录曾被用，后来删了引用。
│                              # 用户本地有 core/ozon-product-fetcher.js 但仓库没。
│                              # **不要再加回引用**，会加载失败。
├── 自动化流程任务/             # (main 分支) 老板需求文件
│   ├── openclaw...md
│   ├── 自动化流程.docx
│   └── 梁生定价模板.html       # ⭐ 最大资产
└── docs/
    └── HANDOFF.md             # 本文件
```

---

## 🔧 两条现有选品链路

### A. 按类目搜索（当前工作方案）

```
popup.js initCategoryModule
  → 用户输入类目 ID/slug-id/URL
  → chrome.tabs 打开 www.ozon.ru/category/<slug-id>/
  → 等 tab URL 稳定（处理 301 重定向）
  → content script SCRAPE_CATEGORY_PAGE
  → category-scraper 从类目页 DOM 抓 (SKU/标题/价格/评分/评论/主图)
  → 归一化 → 调 fetchRealTimePrices 补全详情
```

### B. 批量获取（通过 seller API）

```
popup.js bulkFetchBtn
  → 找 seller.ozon.ru tab
  → content script OZON_BULK_PRODUCTS
  → seller-bridge 调 what_to_sell/data/v3
  → 拿到含月销额/销量/品牌/FBS 的商品列表
  → 调 fetchRealTimePrices 补全详情
```

**两者共用 `fetchRealTimePrices()` 函数（popup.js:809）**。当前这个函数尝试走反爬 API（会 403）—— 下一步方向待用户决定。

---

## ⚠️ 绝对注意事项（新会话必读）

1. **不要帮用户"破解"Ozon 人机校验**，"伪装 header" 是软对抗（让正常请求看起来更像浏览），不是破解
2. **不要处理 Ozon cookie**（用户曾发过本地 cookie 我劝退了，让他注销重登）
3. **manifest.json 不要加回 `core/ozon-product-fetcher.js` 的引用** —— 仓库里没这文件，用户本地有，但加了引用仓库构建就挂
4. **不要盲目信 md 里的公式**（2.2 vs 2.24）—— 实际跑的是 html 里的 2.24
5. **沙箱测试限制**：
   - 沙箱里没 `cd` 命令，用 `cwd` 参数
   - 沙箱无法真机测试扩展效果，只能 `node --check` 语法
   - 沙箱里 web_fetch 访问 ozon.ru 会被反爬拦，无法在沙箱里验证反爬相关方案
   - **用户是唯一能真机测试的人**
6. **用户工作流**：改完代码推 enhance-product-details → 用户下载 zip → Chrome "加载已解压"
7. **用户曾明确**：做事要"想明白再开工"、"避免试错触发更严反爬"、"不写代码前先让浏览器 agent 帮拿真实数据"

---

## 📞 本次会话尾声状态

- ✅ 代码已回到昨晚基线（`60f50a3`，= `e10287d`）
- ✅ 三个文件已完整分析（本档整理了精华）
- ✅ 给出分阶段落地建议
- ⏳ **正在等用户/老板对 6 个决策点的回答**
- ⏳ 用户可以选：A 等老板回话 / B 先做 Phase 1（定价模板集成）/ C 调整分析

---

## 🎯 新会话进来后第一步该做什么

1. **先读本文件**（你已经在读了 ✅）
2. **切到分支**：`git checkout enhance-product-details`（在沙箱中用 `mcp_sandbox_github_repo_set_up` 指定 branch）
3. **确认代码基线**：当前 HEAD 应该是 `60f50a3`，`popup.js` = `e10287d` 昨晚基线
4. **问用户**：你这边决定走哪条路了吗？A/B/C（见本文档 Phase 部分），或者老板给答复了吗？
5. **不要直接开码** —— 几个核心决策没定之前动手都可能被推翻

---

## 📝 如何更新本交接档

每次会话结束前，把重要变更追加到本文件底部（或修改相应章节），commit 到 enhance-product-details 分支。新会话第一件事就是读这个。

---

*本档末次更新：2026-05-10 · 交接人：前一轮对话的 Kiro*



---

## 🆕 2026-05-13 更新：本轮对话的关键进展

### ✅ 用户已拍板的决策（对前一版 "6 个决策点" 的回答）

| # | 决策点 | 用户答复 |
|---|---|---|
| 1 | 推荐售价公式 | **听 html 的**（`×2.24` + `×0.95`），不要 md 那个 `×2.2-1` |
| 2 | 数据源 | **继续用 Ozon 本站**（不换 Seerfar） |
| 3 | 1688 / PDD 比价 | **全部去掉**，前面功能完善后再集成 |
| 4 | 毛子 ERP | **没有 / 暂不做**（绿标/黑标只能先用人工或页面上的价格） |
| 5 | Ozon Seller API / 一键上架 | 未提及，**不做** |
| 6 | 定价模板集成方式 | **作为独立页嵌入插件** |

**用户原话**：
> 路线 A，继续用 Ozon 本站。听 html 的（html 是梁生做的活计算器）。目前批量获取商品后返回的三个价格标签都是 ok 的不需要动（通过 Ozon Seller API 获取），然后也不做 PDD 和 1688，目前的接口还没实现，把相关去掉，前面的功能完善后这个后续再集成。把定价模板作为独立页嵌入插件。目前最重要的导出数据后，html 里面返回的那三个价格的逻辑不要动，可以利用这个。

### ⚠️ 一个非常重要的细节更正

用户说"**批量获取的三个价格标签是通过 Ozon Seller API 获取**"——这点和我的理解不完全一致，新会话注意：
- 批量获取（`bulkFetchBtn`）走的是 `seller-bridge.js` 的 `OZON_BULK_PRODUCTS` → seller.ozon.ru 的 `what_to_sell/data/v3` API（这才是用户说的 Seller API）
- 这条路是好使的，返回带 `avgPrice / avgGmv / 月销额 / 月销量 / 品牌 / FBS` 等字段
- 但是**三个价格标签（cardPrice / discountPrice / bestSellerPrice）不是从 Seller API 来的**，而是 `fetchRealTimePrices` 调 `entrypoint-api.bx/page/json/v2` 来的（这个才是反爬那个 API）
- **新会话要和用户再核实一下**：用户看到的"好使的三个价格"到底是哪里来的？如果真是 Seller API 那反爬就绕过去了（天大好事）；如果是前台 API 那反爬问题还在

### ⏳ 用户尚未回答、我已追问但未得到答复的 4 个细问题（新会话进来要优先问）

**Q1（最关键）**：**黑标 / 绿标 到底怎么对应到页面上的三个价格？**

`webPrice` widget 显示的三个值：
```
3 563,67 ¥    С банками（Ozon 银行卡价）   ← 最低
3 818,73 ¥    С другими банками（其他银行卡价）
9 193 ¥       (划掉价) ← 划线原价/标价
```

`cardPrice` = С банками，`discountPrice` = С другими银行价，`bestSellerPrice` = 某个"低价推荐"（不一定存在）。

**但"绿标/黑标"不是 Ozon 官方术语**（卖家圈术语）。必须确认：
- 甲：绿标=С банками(3563)，黑标=С другими банками(3818)？
- 乙：绿标=С банками(3563)，黑标=划线原价(9193)？
- 丙：都不是？是 ERP 后台才能看到的批发/跟卖最低价？

这个不定，公式 `(黑标-绿标)*2.24+黑标` 就是错的，**整个定价模块全废**。

**Q2**：1688/PDD "去掉" 的力度？
- A. 仅 UI 禁用（按钮隐藏，代码保留）← 建议
- B. 文件全删（`1688-api.js` / `1688-auto-compare.js` / `content-scripts/1688-matcher.js` / `content-1688.js`）

**Q3**：定价模板独立页怎么打开？
- I. popup 里加按钮"🧮 打开定价计算器" → 新标签页
- II. 每个商品卡片加小图标"发送到定价计算器"
- III. popup 顶部 tab 切换

建议 **I + II 组合**。

**Q4**：定价模板跟商品数据怎么对接？
- X. 点"发送到定价计算器" → 三个价格自动填（依赖 Q1 答案）← 建议
- Y. 在定价计算器里下拉选商品
- Z. 只显示参考，不自动填

### 🆘 用户最新的额外问题：Selenium / 其他绕反爬方案

用户在最后一轮又问了：
> 如果 selenium 浏览器自动化获取数据呢，这个方法获取的数据是否完整并且，较为快速，或者你还有哪些方法，在前端有防爬机制和无公开接口地址的情况下

我的回答要点：

| 方案 | 能否获取完整数据 | 速度 | 适配难度 | 致命问题 |
|---|---|---|---|---|
| ① **Selenium/Puppeteer/Playwright** | ✅ 完整 | 🐢 2-5s/页 | 中 | **不能跑在 Chrome 扩展里**，必须独立后端（本机 Node.js 或 VPS） |
| ② **Chrome 扩展内开 tab 读 DOM**（方案 A，曾尝试，被撤回） | ✅ 完整 | 🐢 3-4s/条 | 低 | 上次做过用户撤回，不知原因 |
| ③ **被动采集**（用户浏览时自动存） | ✅ 完整 | ⚡ 零等待 | 低 | 数据**只有用户看过的商品才有** |
| ④ **Ozon 移动端 API** | ✅ 基本完整 | ⚡ 快 | 高 | 需逆向 app，反爬也猛 |
| ⑤ **第三方数据源**（Seerfar / MPSTATS） | ✅ 完整 + 历史 | ⚡ 快 | 低 | 💰 付费 |

**我给用户的建议**：方案 A 最合适 —— 不用部署、用用户自己的浏览器会话（已登录、IP 正常，反爬基本绕过）、数据和 Selenium 一样完整、不需要装 Node.js。

**但有个前提要用户验证**：请用户手动打开 `https://www.ozon.ru/product/1519107271/`（别开 F12）看能否正常显示。能正常看 → 方案 A 可行；不能看 → 浏览器已被标记，需清 cookie。

**用户还没回答这个验证问题 + 上次撤回方案 A 的原因。新会话进来要问。**

### 🗂️ 当前确认要做的任务清单（等 Q1/Q2/Q3/Q4 + 反爬状态确认后开工）

- [ ] 1. Popup UI 去掉 1688/PDD 相关按钮（代码保留）
- [ ] 2. 新建 `pricing/` 独立页
  - `pricing/carriers/zto-rfbs.js` — 从梁生模板拆出 ZTORFBSCarrier（5×4 货件矩阵 / 三档运费 / 密度校验）
  - `pricing/freight-engine.js` — 拆出 FreightEngine（插件化架构，可扩展多物流商）
  - `pricing/calculator.html` — UI
  - `pricing/calculator.js` — doCalculate() 公式链
- [ ] 3. `manifest.json` 注册独立页
- [ ] 4. Popup 加"打开定价计算器"按钮（Q3 方式 I）
- [ ] 5. 商品卡片加"发送到定价计算器"按钮（Q3 方式 II + Q4 方式 X）
- [ ] 6. 定价模板公式用 html 版（`×2.24` / `×0.95` / 4% 杂费 / 利润率 = 利润 / 成本）

**不做的事情**（用户明确说了）：
- 换数据源（保持 Ozon）
- 对接 ERP
- 1688 同款匹配（保留代码、禁用 UI）
- 拼多多比价
- 一键上架
- 碰现有"三个价格"的抓取逻辑

### 🎯 新会话进来后的第一步（更新版）

1. **先读本文件**（你已经在读了 ✅）
2. **确认代码基线**：`git checkout enhance-product-details`，HEAD 应该是 `65580b5` 或更新；`popup.js` 保持昨晚 `e10287d` 基线
3. **向用户同时问这几个问题**（**别一条一条问，一次性问完**）：
   - **Q1（最关键）**：黑标/绿标对应页面上哪两个价格？甲 / 乙 / 丙？
   - **Q2**：1688/PDD 去除力度？仅 UI 禁用 / 文件全删？
   - **Q3**：定价计算器入口方式？popup 按钮 / 卡片按钮 / popup tab 切换 / 组合？
   - **Q4**：抓到的价格自动填进计算器，还是人工选？
   - **Q5（方案 A 可行性前提）**：现在你浏览器能正常看 ozon.ru 商品页吗（别开 F12）？上次撤回方案 A 的原因是什么？
4. **用户答完，才能开工**（特别是 Q1 定错整个定价模块全废）
5. **如果用户同意方案 A + Q1 确认**，第一步就做"Phase 1：定价模板独立页移植"，不碰抓取逻辑

---

*本次追加时间：2026-05-13 · 追加人：前一轮 Kiro*
