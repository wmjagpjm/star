# 长腿欧巴 V2 - 智能选品助手

## 版本信息
- **版本号**: 2.0.0
- **更新日期**: 2026-04-29
- **基于**: ozon-picker-clean + ozon-smart-picker 合并优化版

## 功能特性

### ✅ 核心功能
1. **智能选品**
   - 自动筛选 FBS 发货商品
   - 提取双价格（折扣价 + 优惠价）
   - 自定义公式筛选
   - 随机挑选商品
   - 导出 HTML 报告

2. **1688 同款匹配**
   - 自动搜索 1688 同款商品
   - 关键词智能提取
   - 价格对比
   - 供应商信息展示

3. **批量价格查询**
   - 通过 Ozon 前台 API 批量获取实时价格
   - 并发控制避免限流
   - 支持商品详情页和列表页

4. **分类管理**
   - 分类抓取（category-scraper）
   - 分类树展示（category-tree）
   - 卖家后台桥接（seller-bridge）

5. **Bug 修复**
   - 按钮修复（fix-button.js）
   - 1688 按钮修复（fix-1688-button.js）
   - 分类类型修复（fix-category-type.js）

### ❌ 已移除功能
- AI 图像识别（智谱AI）
- 拼多多数据提取
- 测试脚本

## 文件结构

```
ozonv2/
├── manifest.json              # 插件配置文件
├── background.js              # 后台服务
├── popup.html                 # 弹窗界面
├── popup.js                   # 弹窗逻辑
├── content-1688.js            # 1688 页面脚本
├── 1688-api.js                # 1688 API 接口
├── 1688-auto-compare.js       # 1688 自动对比（增强版）
├── fix-button.js              # 按钮修复
├── fix-1688-button.js         # 1688 按钮修复
├── fix-category-type.js       # 分类类型修复
├── _locales/zh_CN/            # 中文国际化
├── test/                      # 测试页面
├── docs/archive/              # 历史归档文档
├── assets/                    # 图标资源
└── content-scripts/           # 内容脚本
    ├── content.js             # 通用内容脚本
    ├── content.css            # 样式文件
    ├── hide-maozierp.css      # 隐藏毛子ERP样式
    ├── smart-picker.js        # 智能选品核心
    ├── 1688-matcher.js        # 1688 匹配器
    ├── seller-bridge.js       # 卖家后台桥接
    ├── category-scraper.js    # 分类抓取
    └── category-tree.js       # 分类树
```

## 支持平台
- Ozon.ru（主要）
- 1688.com（同款匹配）
- Taobao / Tmall（商品信息）
- JD.com（商品信息）
- AliExpress / Amazon / Wildberries（扩展支持）

## 安装方法
1. 打开 Chrome 浏览器
2. 进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `ozonv2` 文件夹

## 使用说明
1. 访问 Ozon.ru 商品页面或列表页
2. 点击右下角的 🛒 浮动按钮
3. 设置筛选公式（如 `isFBS` 只筛选 FBS 商品）
4. 点击"随机挑选商品"
5. 查看结果并导出

## 更新日志

### V2.0.0 (2026-04-29)
- ✅ 合并 ozon-picker-clean 和 ozon-smart-picker 两个版本
- ✅ 保留所有核心选品功能
- ✅ 升级 1688 自动对比功能（33K → 47K）
- ✅ 添加多个 bug 修复补丁
- ✅ 保留分类抓取和分类树功能
- ❌ 移除 AI 图像识别功能
- ❌ 移除拼多多数据提取功能
- ❌ 移除测试脚本
- 🔧 优化代码结构，提升性能

## 技术栈
- Manifest V3
- Chrome Extension API
- Fetch API
- DOM Parser
- 安全公式求值器（无 eval）

## 注意事项
- 请勿滥用批量查询功能，避免触发 Ozon 限流
- 1688 匹配功能需要登录 1688 账号
- 部分功能需要访问卖家后台（seller.ozon.ru）

## 文档

常用文档（仓库根目录）：
- [QUICKSTART.md](QUICKSTART.md) — 快速启动
- [TESTING.md](TESTING.md) — 测试指南
- [DEVELOPMENT.md](DEVELOPMENT.md) — 开发说明
- [TODO.md](TODO.md) — 待办事项

历史资料（阶段性报告、逆向分析、问题修复记录等）已归档到 [docs/archive/](docs/archive/README.md)。

## 许可证
仅供学习和个人使用
