# 🚀 BCS 逆向功能 - 快速实施指南

## 📋 3 步完成集成

### 第 1 步：今天（2-3 小时）

#### 任务 A：创建 Ozon 商品数据采集模块

**文件**: `core/ozon-product-fetcher.js`

**复制以下代码**:
```javascript
// 长腿欧巴 V2 - Ozon 商品数据采集模块
// 基于 BCS 插件逆向分析

class OzonProductFetcher {
  constructor() {
    this.host = "https://www.ozon.ru";
    this.apiBase = "/api/entrypoint-api.bx/page/json/v2";
  }

  /**
   * 递归解析 widgetStates（关键函数！）
   * Ozon 的数据可能是多层嵌套的 JSON 字符串
   */
  parseStateValue(raw) {
    let current = raw;
    for (let i = 0; i < 3; i++) {
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

  /**
   * 获取单个商品的完整数据
   */
  async fetchProductData(sku) {
    try {
      // 构建 API URL
      const url = `${this.host}${this.apiBase}?url=${encodeURIComponent("/product/" + sku + "/")}`;
      
      // 获取 Page 1（基础数据）
      const response1 = await fetch(url);
      const data1 = await response1.json();
      
      // 获取 Page 2（详细数据）
      let data2 = null;
      if (data1.nextPage) {
        const response2 = await fetch(this.host + data1.nextPage);
        data2 = await response2.json();
      }
      
      // 合并 widgetStates
      const widgetStates = {
        ...data1.widgetStates,
        ...(data2 ? data2.widgetStates : {})
      };
      
      // 解析数据
      return this.parseWidgetStates(sku, widgetStates);
      
    } catch (error) {
      console.error(`[OzonProductFetcher] 获取商品 ${sku} 失败:`, error);
      return null;
    }
  }

  /**
   * 解析 widgetStates 为标准格式
   */
  parseWidgetStates(sku, widgetStates) {
    const product = {
      sku: sku,
      title: "",
      price: "",
      oldPrice: "",
      images: [],
      videos: [],
      videoPosters: [],
      variants: [],
      attributes: [],
      description: "",
      category: []
    };

    Object.keys(widgetStates).forEach(key => {
      const value = this.parseStateValue(widgetStates[key]);
      if (!value) return;

      // 解析图片和视频
      if (key.includes("webGallery")) {
        product.images = (value.images || []).map(img => img.src || img.url).filter(Boolean);
        product.videos = (value.videos || []).map(v => v.url || v.src).filter(Boolean);
        product.videoPosters = (value.videos || []).map(v => 
          v.cover || v.preview || v.poster || v.thumbnail || ""
        ).filter(Boolean);
      }

      // 解析变体
      if (key.includes("webAspects")) {
        (value.aspects || []).forEach(aspect => {
          // 提取规格类型名称
          const rs = aspect.descriptionRs || [];
          let typeName = "";
          rs.forEach(item => {
            if (item.type === "textGray") {
              typeName = (item.content || "").replace(/[:：]\s*$/, "").trim();
            }
          });

          // 提取变体数据
          (aspect.variants || []).forEach(variant => {
            const data = variant.data || {};
            const textRs = data.textRs || [];
            const attrValue = textRs.map(it => it && it.content).filter(Boolean).join(" ");

            product.variants.push({
              sku: variant.sku,
              price: data.price || "",
              oldPrice: data.originalPrice || "",
              title: data.title || "",
              image: data.image || "",
              variantAttr: typeName ? [{ name: typeName, value: attrValue }] : []
            });
          });
        });
      }

      // 解析公共属性
      if (key.includes("webCharacteristics")) {
        (value.characteristics || []).forEach(c => {
          // short 属性
          (c.short || []).forEach(item => {
            product.attributes.push({
              name: item.name || "",
              value: (item.values || []).map(v => v.text).filter(Boolean)
            });
          });
          // long 属性
          (c.long || []).forEach(item => {
            product.attributes.push({
              name: item.name || "",
              value: (item.values || []).map(v => v.text).filter(Boolean)
            });
          });
        });
      }

      // 解析描述
      if (key.includes("webDescription")) {
        product.description = value.richAnnotation || "";
      }
    });

    return product;
  }

  /**
   * 批量获取商品数据
   */
  async batchFetch(skus, progressCallback) {
    const results = [];
    const batchSize = 5;
    const delay = 300;

    for (let i = 0; i < skus.length; i += batchSize) {
      const batch = skus.slice(i, i + batchSize);
      
      // 并行请求
      const promises = batch.map(sku => this.fetchProductData(sku));
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
}

// 导出
if (typeof window !== 'undefined') {
  window.OzonProductFetcher = OzonProductFetcher;
}
```

#### 任务 B：更新 manifest.json

**添加新文件引用**:
```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": [
      "config.js",
      "core/ozon-product-fetcher.js",  // 新增
      "content-scripts/content.js",
      "content-1688.js"
    ]
  }
]
```

#### 任务 C：集成到主控制器

**编辑**: `core/main-controller.js`

**在构造函数中添加**:
```javascript
constructor() {
  this.config = window.CONFIG;
  this.productService = new window.ProductDataService();
  this.match1688Service = new window.Match1688Service();
  this.ozonFetcher = new window.OzonProductFetcher();  // 新增
  
  this.products = [];
  this.currentMode = 'hot';
  this.isProcessing = false;
}
```

**添加新方法**:
```javascript
/**
 * 获取商品完整数据（使用 BCS 逆向的接口）
 */
async fetchOzonProductDetails(skus, progressCallback) {
  return await this.ozonFetcher.batchFetch(skus, progressCallback);
}
```

---

### 第 2 步：明天（3-4 小时）

#### 任务 A：手动逆向 Ozon Seller 上架接口

**操作步骤**:

1. **打开 Ozon Seller 后台**
   ```
   https://seller.ozon.ru/app/products/add
   ```

2. **打开开发者工具**
   - 按 F12
   - 切换到 Network 标签
   - 勾选 "Preserve log"
   - 过滤器选择 "XHR"

3. **手动创建测试商品**
   - 填写商品标题
   - 选择类目
   - 上传图片
   - 填写价格
   - 填写属性
   - 点击"保存"或"发布"

4. **记录所有请求**

   **创建表格记录**:
   ```
   | 序号 | 接口 URL | 方法 | 请求头 | 请求体 | 响应 |
   |------|---------|------|--------|--------|------|
   | 1    | ...     | POST | ...    | ...    | ...  |
   | 2    | ...     | PUT  | ...    | ...    | ...  |
   ```

   **重点关注**:
   - 包含 "product"、"import"、"create"、"upload" 的接口
   - 请求体中包含商品数据的接口
   - Authorization header 的格式

5. **截图保存**
   - 右键点击关键请求 → Copy → Copy as cURL
   - 保存到文本文件

6. **测试接口**
   - 使用 Postman 或 curl 重放请求
   - 验证接口是否可用
   - 记录必需的参数

#### 任务 B：整理接口文档

**创建文件**: `OZON-SELLER-API.md`

**格式**:
```markdown
# Ozon Seller 上架接口文档

## 接口 1：创建商品

**URL**: `POST https://seller.ozon.ru/api/v1/product/import`

**Headers**:
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "x-o3-company-id": "{company_id}"
}
```

**Request Body**:
```json
{
  "items": [
    {
      "name": "商品标题",
      "category_id": 12345,
      "price": "1000",
      "old_price": "1500",
      "images": ["图片URL"],
      "attributes": [...]
    }
  ]
}
```

**Response**:
```json
{
  "result": {
    "task_id": 123456
  }
}
```

## 接口 2：查询上架状态

...
```

---

### 第 3 步：后天（4-5 小时）

#### 任务 A：实现上架模块

**文件**: `core/ozon-uploader.js`

**基础框架**:
```javascript
class OzonUploader {
  constructor() {
    this.apiBase = "https://seller.ozon.ru/api";  // 根据逆向结果修改
  }

  /**
   * 获取 Seller Token
   */
  async getSellerToken() {
    // 从 seller.ozon.ru 页面获取 token
    // 或从 localStorage/cookie 读取
  }

  /**
   * 上传单个商品
   */
  async uploadProduct(productData) {
    const token = await this.getSellerToken();
    
    // 根据逆向结果构建请求
    const response = await fetch(`${this.apiBase}/v1/product/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [this.formatProductData(productData)]
      })
    });
    
    return await response.json();
  }

  /**
   * 格式化商品数据
   */
  formatProductData(product) {
    return {
      name: product.title,
      category_id: product.categoryId,
      price: product.recommendedPrice,
      old_price: product.cardPrice,
      images: product.images,
      attributes: product.attributes,
      description: product.description
    };
  }

  /**
   * 批量上架
   */
  async batchUpload(products, progressCallback) {
    const results = [];
    
    for (let i = 0; i < products.length; i++) {
      try {
        const result = await this.uploadProduct(products[i]);
        results.push({ success: true, data: result });
        
        if (progressCallback) {
          progressCallback(i + 1, products.length);
        }
        
        // 延迟避免限流
        await new Promise(r => setTimeout(r, 500));
        
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }
}

if (typeof window !== 'undefined') {
  window.OzonUploader = OzonUploader;
}
```

#### 任务 B：集成到主控制器

**编辑**: `core/main-controller.js`

```javascript
constructor() {
  // ...
  this.ozonUploader = new window.OzonUploader();  // 新增
}

/**
 * 一键上架商品
 */
async uploadToOzon(products, progressCallback) {
  return await this.ozonUploader.batchUpload(products, progressCallback);
}
```

#### 任务 C：更新 UI

**编辑**: `popup-new.html`

**添加上架按钮**:
```html
<button class="btn btn-hot" id="uploadToOzon" disabled>🚀 一键上架到 Ozon</button>
```

**编辑**: `popup-new.js`

**添加事件处理**:
```javascript
const uploadToOzonBtn = document.getElementById('uploadToOzon');

uploadToOzonBtn.addEventListener('click', async function() {
  if (products.length === 0) {
    showStatus('没有可上架的商品', 'error');
    return;
  }
  
  uploadToOzonBtn.disabled = true;
  uploadToOzonBtn.textContent = '⏳ 上架中...';
  
  try {
    const results = await controller.uploadToOzon(
      products,
      (current, total) => {
        showStatus(`正在上架 ${current}/${total}...`, 'loading');
        updateProgress((current / total) * 100);
      }
    );
    
    const successCount = results.filter(r => r.success).length;
    showStatus(`✅ 成功上架 ${successCount}/${products.length} 个商品`, 'success');
    
  } catch (error) {
    showStatus(`❌ 上架失败: ${error.message}`, 'error');
  } finally {
    uploadToOzonBtn.disabled = false;
    uploadToOzonBtn.textContent = '🚀 一键上架到 Ozon';
  }
});
```

---

## 🎯 完成标准

### 第 1 步完成标志
- [ ] `core/ozon-product-fetcher.js` 文件已创建
- [ ] 可以成功获取单个商品数据
- [ ] 可以批量获取商品数据
- [ ] 数据格式正确（包含图片、变体、属性）

### 第 2 步完成标志
- [ ] 已记录至少 3 个 Ozon Seller API 接口
- [ ] 已保存关键请求的 cURL 命令
- [ ] 已创建 `OZON-SELLER-API.md` 文档
- [ ] 已用 Postman 验证接口可用

### 第 3 步完成标志
- [ ] `core/ozon-uploader.js` 文件已创建
- [ ] 可以成功上架单个商品
- [ ] 可以批量上架商品
- [ ] UI 显示上架进度和结果
- [ ] 错误处理完善

---

## 📞 遇到问题？

### 问题 1：无法获取商品数据

**检查**:
- 网络连接是否正常
- SKU 是否正确
- 是否被 Ozon 限流（返回 429 错误）

**解决**:
- 增加请求延迟（delay 从 300ms 改为 500ms）
- 减少批量大小（batchSize 从 5 改为 3）

### 问题 2：widgetStates 解析失败

**检查**:
- 是否使用了 `parseStateValue()` 递归解析
- 是否处理了 JSON.parse 异常

**解决**:
- 打印原始数据查看结构
- 增加解析层数（从 3 改为 5）

### 问题 3：找不到上架接口

**检查**:
- 是否在 seller.ozon.ru 登录
- 是否有商品上架权限
- Network 标签是否勾选 "Preserve log"

**解决**:
- 尝试不同的上架入口（批量导入、单个创建）
- 查看 Ozon 官方 API 文档
- 使用 Ozon 官方 API（需要 Client-Id 和 Api-Key）

---

## 🎉 预期效果

**完成后，插件将具备**:
1. ✅ 从 Ozon 获取完整商品数据（图片、变体、属性、描述）
2. ✅ 自动组装变体数据
3. ✅ 一键批量上架到 Ozon
4. ✅ 实时显示上架进度
5. ✅ 完善的错误处理

**数据流程**:
```
用户选择商品
  ↓
OzonProductFetcher 获取完整数据
  ↓
VariantBuilder 组装变体数据
  ↓
用户预览和筛选
  ↓
OzonUploader 批量上架
  ↓
显示上架结果
```

---

**开始时间**: 现在  
**预计完成**: 3 天后  
**总工时**: 10-12 小时

**加油！** 🚀
