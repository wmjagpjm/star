# 🔍 BCS 插件逆向分析 - 完整实现方案

## 📊 核心发现总结

### ✅ 已破解的关键技术

#### 1. 商品数据获取接口（100% 可用）

**Ozon 官方 API**（无需认证）:
```javascript
GET https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url={encoded_url}

// 示例
url = encodeURIComponent("/product/1234567890/")
完整URL: https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=%2Fproduct%2F1234567890%2F
```

**返回数据结构**:
```json
{
  "widgetStates": {
    "webGallery-xxx": {
      "coverImage": "主图URL",
      "images": [{"src": "图片URL"}],
      "videos": [{"url": "视频URL", "cover": "封面URL"}]
    },
    "webAspects-xxx-default-1": {
      "aspects": [
        {
          "descriptionRs": [{"type": "textGray", "content": "颜色:"}],
          "variants": [
            {
              "sku": "变体SKU",
              "data": {
                "price": "价格",
                "originalPrice": "原价",
                "title": "标题",
                "textRs": [{"content": "红色"}],
                "image": "图片URL"
              }
            }
          ]
        }
      ]
    },
    "webCharacteristics-xxx": {
      "characteristics": [
        {
          "short": [{"name": "品牌", "values": [{"text": "Nike"}]}],
          "long": [{"name": "材质", "values": [{"text": "棉"}]}]
        }
      ]
    },
    "webDescription-xxx": {
      "richAnnotation": "商品描述HTML"
    }
  },
  "nextPage": "/api/entrypoint-api.bx/page/json/v2?url=..."
}
```

#### 2. 变体数据组装算法（100% 可移植）

**核心逻辑**:
```javascript
// 1. 确保每个 SKU 都有对应的行数据
function ensureRow(retData, sku) {
  if (!retData.rows) retData.rows = [];
  var row = retData.rows.find(r => r && r.sku === sku);
  if (!row) {
    row = {
      cover_image: "",
      title: "",
      sku: sku,
      price: "",
      old_price: "",
      images: [],
      video_cover: [],
      variantAttr: []
    };
    retData.rows.push(row);
  }
  return row;
}

// 2. 追加变体属性（自动去重）
function appendVariantAttr(row, typeName, valueText) {
  if (!typeName) return;
  if (!row.variantAttr) row.variantAttr = [];
  
  var attr = row.variantAttr.find(a => a && a.name === typeName);
  if (!attr) {
    attr = { name: typeName, value: [] };
    row.variantAttr.push(attr);
  }
  
  if (valueText && attr.value.indexOf(valueText) === -1) {
    attr.value.push(valueText);
  }
}

// 3. 递归解析 widgetStates（关键！）
function parseStateValue(raw) {
  var current = raw;
  // Ozon 的数据可能是多层嵌套的 JSON 字符串
  for (var i = 0; i < 3; i++) {
    if (current && typeof current === "object") {
      return current;
    }
    if (typeof current !== "string") {
      return null;
    }
    current = JSON.parse(current);
  }
  return current && typeof current === "object" ? current : null;
}
```

#### 3. 数据分页处理

**问题**: Ozon 将数据分为 Page 1（基础）和 Page 2（详细）

**解决方案**:
```javascript
// 1. 第一次请求获取基础数据
var response1 = await fetch(apiUrl);
var data1 = await response1.json();

// 2. 从 nextPage 获取详细数据
if (data1.nextPage) {
  var nextUrl = "https://www.ozon.ru" + data1.nextPage;
  var response2 = await fetch(nextUrl);
  var data2 = await response2.json();
  
  // 合并 widgetStates
  Object.assign(data1.widgetStates, data2.widgetStates);
}
```

---

## 🚀 立即可实现的功能

### 功能 1：商品完整数据采集

**实现难度**: ⭐ 简单  
**依赖**: 无（纯前端）

**代码示例**:
```javascript
async function fetchOzonProductData(sku) {
  const host = "https://www.ozon.ru";
  const apiUrl = `${host}/api/entrypoint-api.bx/page/json/v2?url=${encodeURIComponent("/product/" + sku + "/")}`;
  
  try {
    // 获取 Page 1
    const response1 = await fetch(apiUrl);
    const data1 = await response1.json();
    
    // 获取 Page 2（如果有）
    let data2 = null;
    if (data1.nextPage) {
      const response2 = await fetch(host + data1.nextPage);
      data2 = await response2.json();
    }
    
    // 合并数据
    const widgetStates = {
      ...data1.widgetStates,
      ...(data2 ? data2.widgetStates : {})
    };
    
    // 解析数据
    const productData = {
      sku: sku,
      title: "",
      price: "",
      oldPrice: "",
      images: [],
      videos: [],
      variants: [],
      attributes: [],
      description: ""
    };
    
    // 解析 widgetStates
    Object.keys(widgetStates).forEach(key => {
      const value = parseStateValue(widgetStates[key]);
      
      // 解析图片
      if (key.includes("webGallery")) {
        productData.images = (value.images || []).map(img => img.src).filter(Boolean);
        productData.videos = (value.videos || []).map(v => v.url).filter(Boolean);
      }
      
      // 解析变体
      if (key.includes("webAspects")) {
        (value.aspects || []).forEach(aspect => {
          (aspect.variants || []).forEach(variant => {
            productData.variants.push({
              sku: variant.sku,
              price: variant.data?.price,
              title: variant.data?.title,
              image: variant.data?.image
            });
          });
        });
      }
      
      // 解析属性
      if (key.includes("webCharacteristics")) {
        (value.characteristics || []).forEach(c => {
          (c.short || []).forEach(item => {
            productData.attributes.push({
              name: item.name,
              value: (item.values || []).map(v => v.text)
            });
          });
        });
      }
      
      // 解析描述
      if (key.includes("webDescription")) {
        productData.description = value.richAnnotation || "";
      }
    });
    
    return productData;
    
  } catch (error) {
    console.error("获取商品数据失败:", error);
    return null;
  }
}
```

### 功能 2：批量商品数据采集

**实现难度**: ⭐⭐ 中等  
**依赖**: 无

**代码示例**:
```javascript
async function batchFetchOzonProducts(skus, progressCallback) {
  const results = [];
  const batchSize = 5;  // 每批 5 个
  const delay = 300;    // 延迟 300ms
  
  for (let i = 0; i < skus.length; i += batchSize) {
    const batch = skus.slice(i, i + batchSize);
    
    // 并行请求
    const promises = batch.map(sku => fetchOzonProductData(sku));
    const batchResults = await Promise.all(promises);
    
    results.push(...batchResults.filter(Boolean));
    
    // 进度回调
    if (progressCallback) {
      progressCallback(results.length, skus.length);
    }
    
    // 延迟避免限流
    if (i + batchSize < skus.length) {
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  return results;
}
```

### 功能 3：变体数据组装

**实现难度**: ⭐⭐ 中等  
**依赖**: 无

**完整实现**（直接复制到我们的插件）:
```javascript
// 已在 variant-upload-builder.js 中完整实现
// 可以直接复制以下函数：
// - ensureRow()
// - appendVariantAttr()
// - parseStateValue()
// - parseGalleryFromWidgetStates()
// - parseAspectsFromWidgetStates()
// - parseCommonAttributesFromCharacteristics()
```

---

## ⚠️ 需要额外工作的功能

### 功能 4：一键上架

**实现难度**: ⭐⭐⭐⭐ 困难  
**依赖**: Ozon Seller API（未在 BCS 插件中找到）

**问题**:
- BCS 插件的上架功能代码被严重混淆
- 未找到直接调用 Ozon Seller API 的明确接口
- 可能通过 BCS 后端代理上架

**可能的解决方案**:

#### 方案 A：逆向 Ozon Seller 网页

1. 打开 `https://seller.ozon.ru/app/products/add`
2. 打开浏览器开发者工具 → Network 标签
3. 手动创建一个商品
4. 查看所有 XHR 请求，找到上架接口

**预期接口格式**:
```javascript
POST https://seller.ozon.ru/api/v1/product/import
Headers:
  Authorization: Bearer {seller_token}
  Content-Type: application/json

Body:
{
  "items": [
    {
      "name": "商品标题",
      "category_id": 12345,
      "price": "1000",
      "old_price": "1500",
      "images": ["图片URL"],
      "attributes": [
        {"id": 123, "values": [{"value": "红色"}]}
      ],
      "description": "商品描述"
    }
  ]
}
```

#### 方案 B：使用 Ozon API（官方）

**Ozon 提供了官方 API**:
```
文档: https://docs.ozon.ru/api/seller/
需要: Client ID + API Key（在 seller.ozon.ru 后台获取）
```

**商品上架接口**:
```javascript
POST https://api-seller.ozon.ru/v2/product/import
Headers:
  Client-Id: {your_client_id}
  Api-Key: {your_api_key}
  Content-Type: application/json

Body:
{
  "items": [
    {
      "name": "商品标题",
      "offer_id": "唯一标识",
      "category_id": 12345,
      "price": "1000",
      "old_price": "1500",
      "vat": "0",
      "images": [
        {"file_name": "图片URL"}
      ],
      "attributes": [
        {
          "complex_id": 0,
          "id": 4180,
          "values": [{"value": "红色"}]
        }
      ]
    }
  ]
}
```

**获取 API 凭证**:
1. 登录 `https://seller.ozon.ru`
2. 进入"设置" → "API 密钥"
3. 创建新的 API 密钥
4. 保存 Client-Id 和 Api-Key

#### 方案 C：通过 BCS 后端代理（不推荐）

**问题**: 需要 BCS 的 Token，且依赖第三方服务

**BCS 后端 API**:
```
Base URL: https://ozon.bcserp.com/prod-api
需要: Authorization: Bearer {bcs_token}
```

---

## 📝 立即行动计划

### 第 1 步：集成商品数据采集（今天完成）

**文件**: `core/ozon-product-fetcher.js`

```javascript
// 创建新模块
class OzonProductFetcher {
  async fetchProductData(sku) {
    // 实现上面的 fetchOzonProductData 函数
  }
  
  async batchFetch(skus, progressCallback) {
    // 实现上面的 batchFetchOzonProducts 函数
  }
}

// 导出
window.OzonProductFetcher = OzonProductFetcher;
```

**集成到主控制器**:
```javascript
// main-controller.js
this.ozonFetcher = new OzonProductFetcher();

// 在 executeFullPipeline 中使用
const ozonData = await this.ozonFetcher.batchFetch(skus, progressCallback);
```

### 第 2 步：复制变体数据组装逻辑（今天完成）

**文件**: `core/variant-builder.js`

直接从 BCS 插件复制以下函数：
- `ensureRow()`
- `appendVariantAttr()`
- `parseStateValue()`
- `parseGalleryFromWidgetStates()`
- `parseAspectsFromWidgetStates()`

### 第 3 步：逆向 Ozon Seller 上架接口（明天）

**操作步骤**:
1. 打开 `https://seller.ozon.ru/app/products/add`
2. 打开开发者工具 → Network → XHR
3. 手动填写商品信息并提交
4. 查看所有请求，找到上架接口
5. 记录：
   - 接口 URL
   - 请求方法（POST/PUT）
   - 请求头（特别是 Authorization）
   - 请求体格式
   - 响应格式

### 第 4 步：实现一键上架功能（后天）

**文件**: `core/ozon-uploader.js`

```javascript
class OzonUploader {
  constructor() {
    this.apiBase = "https://seller.ozon.ru/api";  // 待确认
  }
  
  async uploadProduct(productData) {
    // 根据逆向结果实现
  }
  
  async batchUpload(products, progressCallback) {
    // 批量上架
  }
}
```

---

## 🎯 最终数据流程

```
用户操作
  ↓
选择商品（从筛选结果）
  ↓
OzonProductFetcher.batchFetch()  ← 使用 BCS 逆向的接口
  ↓
获取完整商品数据（图片、变体、属性、描述）
  ↓
VariantBuilder.buildUploadData()  ← 使用 BCS 的算法
  ↓
组装上架数据结构
  ↓
用户预览和筛选
  ↓
OzonUploader.batchUpload()  ← 需要逆向 Seller API
  ↓
上架到 Ozon
```

---

## 💡 关键技术要点

### 1. widgetStates 递归解析（必须实现）

```javascript
function parseStateValue(raw) {
  var current = raw;
  for (var i = 0; i < 3; i++) {
    if (current && typeof current === "object") {
      return current;
    }
    if (typeof current !== "string") {
      return null;
    }
    try {
      current = JSON.parse(current);
    } catch (e) {
      return null;
    }
  }
  return current && typeof current === "object" ? current : null;
}
```

### 2. 变体属性去重（必须实现）

```javascript
function appendVariantAttr(row, typeName, valueText) {
  if (!typeName) return;
  if (!row.variantAttr) row.variantAttr = [];
  
  var attr = row.variantAttr.find(a => a && a.name === typeName);
  if (!attr) {
    attr = { name: typeName, value: [] };
    row.variantAttr.push(attr);
  }
  
  if (valueText && attr.value.indexOf(valueText) === -1) {
    attr.value.push(valueText);
  }
}
```

### 3. 数据分页处理（必须实现）

```javascript
// 获取 Page 1
const data1 = await fetch(apiUrl).then(r => r.json());

// 获取 Page 2
let data2 = null;
if (data1.nextPage) {
  data2 = await fetch(host + data1.nextPage).then(r => r.json());
}

// 合并
const allWidgets = {
  ...data1.widgetStates,
  ...(data2 ? data2.widgetStates : {})
};
```

---

## 📊 进度追踪

| 功能 | 状态 | 难度 | 预计时间 |
|------|------|------|---------|
| 商品数据采集 | ⏳ 待实现 | ⭐ | 2 小时 |
| 变体数据组装 | ⏳ 待实现 | ⭐⭐ | 3 小时 |
| 批量数据处理 | ⏳ 待实现 | ⭐⭐ | 2 小时 |
| 逆向上架接口 | ⏳ 待实现 | ⭐⭐⭐⭐ | 4 小时 |
| 一键上架功能 | ⏳ 待实现 | ⭐⭐⭐ | 4 小时 |

**总预计时间**: 15 小时（2 个工作日）

---

## 🎉 总结

### ✅ 已破解
- Ozon 商品数据获取接口（100% 可用）
- 变体数据组装算法（100% 可移植）
- 数据分页处理机制（100% 可移植）

### ⏳ 待完成
- 逆向 Ozon Seller 上架接口（需要手动操作）
- 实现一键上架功能（基于逆向结果）

### 🚀 下一步
1. 立即集成商品数据采集功能
2. 复制变体数据组装逻辑
3. 手动逆向 Ozon Seller 上架接口
4. 实现完整的一键上架流程

---

**最后更新**: 2026-04-29  
**分析者**: Claude (Kiro)
