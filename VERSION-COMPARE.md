# 版本对比说明

## 三个版本对比

| 特性 | ozon-picker-clean | ozon-smart-picker | ozonv2 (合并版) |
|------|-------------------|-------------------|-----------------|
| **版本号** | 1.0.0 | 1.0.0 | 2.0.0 |
| **文件数量** | 13 | 19 | 13 |
| **总大小** | ~130KB | ~150KB | ~140KB |

---

## 功能对比

### ✅ 核心功能

| 功能 | clean | smart-picker | ozonv2 |
|------|-------|--------------|--------|
| 智能选品 | ✅ | ✅ | ✅ |
| FBS 筛选 | ✅ | ✅ | ✅ |
| 双价格提取 | ✅ | ✅ | ✅ |
| 公式筛选 | ✅ | ✅ | ✅ |
| 导出 HTML | ✅ | ✅ | ✅ |
| 1688 匹配 | ✅ | ✅ | ✅ |
| 批量价格查询 | ✅ | ✅ | ✅ |
| 分类抓取 | ✅ | ❌ | ✅ |
| 分类树 | ✅ | ❌ | ✅ |
| 卖家后台桥接 | ✅ | ✅ | ✅ |

### 🆕 增强功能

| 功能 | clean | smart-picker | ozonv2 |
|------|-------|--------------|--------|
| AI 图像识别 | ❌ | ✅ | ❌ (已移除) |
| 拼多多数据提取 | ❌ | ✅ | ❌ (已移除) |
| 1688 自动对比增强版 | ❌ (33KB) | ✅ (47KB) | ✅ (47KB) |
| Bug 修复补丁 | ❌ | ✅ (3个) | ✅ (3个) |
| 测试脚本 | ❌ | ✅ (2个) | ❌ (已移除) |

### 🔧 修复补丁详情

**ozonv2 包含的修复：**
1. `fix-button.js` (573字节) - 修复按钮问题
2. `fix-1688-button.js` (1.5KB) - 修复 1688 按钮
3. `fix-category-type.js` (689字节) - 修复分类类型

---

## 文件对比

### 根目录 JS 文件

| 文件名 | clean | smart-picker | ozonv2 | 说明 |
|--------|-------|--------------|--------|------|
| background.js | 5.0KB | 5.0KB | 5.0KB | 相同 |
| popup.js | 57KB | 50KB | 57KB | 使用 clean 版本 |
| 1688-api.js | 11KB | - | 11KB | 保留 |
| 1688-addon.js | - | 11KB | - | 未使用 |
| 1688-auto-compare-v3.js | 33KB | - | - | 已替换 |
| 1688-auto-compare.js | - | 47KB | 47KB | ✅ 使用增强版 |
| content-1688.js | 8.9KB | - | 8.9KB | 保留 |
| inject.js | - | 1.1KB | - | 拼多多相关，已移除 |
| ai-image-search.js | - | 8.9KB | - | AI 功能，已移除 |
| fix-button.js | - | 573B | 573B | ✅ 新增 |
| fix-1688-button.js | - | 1.5KB | 1.5KB | ✅ 新增 |
| fix-category-type.js | - | 689B | 689B | ✅ 新增 |
| test-*.js | - | 6KB | - | 测试脚本，已移除 |

### content-scripts 目录

| 文件名 | clean | smart-picker | ozonv2 |
|--------|-------|--------------|--------|
| content.js | ✅ | ✅ | ✅ |
| content.css | ✅ | ✅ | ✅ |
| hide-maozierp.css | ✅ | ❌ | ✅ |
| smart-picker.js | ✅ | ✅ | ✅ |
| 1688-matcher.js | ✅ | ✅ | ✅ |
| seller-bridge.js | ✅ | ✅ | ✅ |
| category-scraper.js | ✅ | ❌ | ✅ |
| category-tree.js | ✅ | ❌ | ✅ |

---

## manifest.json 差异

### ozonv2 的改进

1. **版本号**: 1.0.0 → 2.0.0
2. **名称**: "长腿欧巴" → "长腿欧巴 V2"
3. **描述**: 添加了 "1688同款匹配" 说明
4. **权限**: 移除了拼多多相关域名
   - ❌ `https://mobile.yangkeduo.com/*`
   - ❌ `http://*.yangkeduo.com/*`
   - ❌ `https://*.pinduoduo.com/*`

---

## 优势总结

### ozonv2 的优势

✅ **功能最全面**
- 保留了 clean 版本的分类抓取和分类树
- 集成了 smart-picker 的增强版 1688 对比功能
- 包含所有 bug 修复补丁

✅ **代码最优化**
- 移除了 AI 功能（需要外部 API Key）
- 移除了拼多多功能（不常用）
- 移除了测试脚本（生产环境不需要）

✅ **体积适中**
- 比 smart-picker 小 10KB
- 比 clean 版本多了增强功能

✅ **稳定性最好**
- 包含 3 个 bug 修复补丁
- 使用更完善的 1688 对比功能（47KB vs 33KB）

---

## 推荐使用场景

- **ozon-picker-clean**: 只需要基础选品功能，追求极简
- **ozon-smart-picker**: 需要 AI 图像识别和拼多多支持
- **ozonv2**: ⭐ 推荐！功能全面、稳定性好、体积适中

---

## 升级建议

如果你正在使用：
- **clean 版本** → 升级到 ozonv2，获得增强的 1688 对比和 bug 修复
- **smart-picker 版本** → 如果不需要 AI 和拼多多，可以换到 ozonv2 减少体积

---

生成时间: 2026-04-29
