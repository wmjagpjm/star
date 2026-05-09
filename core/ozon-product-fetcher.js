// 长腿欧巴 V2 - Ozon 商品数据采集模块
// 基于 BCS 插件逆向分析
// 功能：从 Ozon 官方 API 获取完整商品数据

class OzonProductFetcher {
  constructor() {
    this.host = "https://www.ozon.ru";
    this.apiBase = "/api/entrypoint-api.bx/page/json/v2";
    this.cache = new Map(); // 缓存已获取的商品数据
  }

  /**
   * 递归解析 widgetStates（关键函数！）
   * Ozon 的数据可能是多层嵌套的 JSON 字符串
   * 例如: "value": "{\"data\": \"{\\\"price\\\": 1000}\"}"
   * 需要递归 JSON.parse 才能得到最终对象
   */
  parseStateValue(raw) {
    let current = raw;
    // 最多尝试 3 层解析
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
   * @param {string} sku - 商品 SKU
   * @returns {Object|null} 商品数据对象
   */
  async fetchProductData(sku) {
    // 检查缓存
    if (this.cache.has(sku)) {
      console.log(`[OzonProductFetcher] 从缓存读取商品 ${sku}`);
      return this.cache.get(sku);
    }

    try {
      console.log(`[OzonProductFetcher] 开始获取商品 ${sku}`);

      // 构建 API URL
      const url = `${this.host}${this.apiBase}?url=${encodeURIComponent("/product/" + sku + "/")}`;

      // 获取 Page 1（基础数据：图片、价格、变体）
      const response1 = await fetch(url);
      if (!response1.ok) {
        throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
      }
      const data1 = await response1.json();

      // 获取 Page 2（详细数据：属性、描述、标签）
      let data2 = null;
      if (data1.nextPage) {
        console.log(`[OzonProductFetcher] 获取 Page 2: ${data1.nextPage}`);
        const response2 = await fetch(this.host + data1.nextPage);
        if (response2.ok) {
          data2 = await response2.json();
        }
      }

      // 合并 widgetStates
      const widgetStates = {
        ...data1.widgetStates,
        ...(data2 ? data2.widgetStates : {})
      };

      // 解析数据
      const productData = this.parseWidgetStates(sku, widgetStates);

      // 缓存结果
      this.cache.set(sku, productData);

      console.log(`[OzonProductFetcher] 成功获取商品 ${sku}`);
      return productData;

    } catch (error) {
      console.error(`[OzonProductFetcher] 获取商品 ${sku} 失败:`, error);
      return null;
    }
  }

  /**
   * 解析 widgetStates 为标准格式
   * @param {string} sku - 商品 SKU
   * @param {Object} widgetStates - API 返回的 widgetStates 对象
   * @returns {Object} 标准化的商品数据
   */
  parseWidgetStates(sku, widgetStates) {
    const product = {
      sku: sku,
      title: "",
      price: "",
      oldPrice: "",
      coverImage: "",
      images: [],
      videos: [],
      videoPosters: [],
      variants: [],
      attributes: [],
      description: "",
      descriptionHtml: "",
      category: [],
      tags: []
    };

    Object.keys(widgetStates).forEach(key => {
      const value = this.parseStateValue(widgetStates[key]);
      if (!value) return;

      // 解析图片和视频
      if (key.includes("webGallery")) {
        product.coverImage = value.coverImage || "";
        product.images = (value.images || [])
          .map(img => img.src || img.url)
          .filter(Boolean);
        product.videos = (value.videos || [])
          .map(v => v.url || v.src)
          .filter(Boolean);
        product.videoPosters = (value.videos || [])
          .map(v => v.cover || v.preview || v.poster || v.thumbnail || "")
          .filter(Boolean);
      }

      // 解析变体
      if (key.includes("webAspects")) {
        (value.aspects || []).forEach(aspect => {
          // 提取规格类型名称（如 "颜色:"、"尺码:"）
          const rs = aspect.descriptionRs || [];
          let typeName = "";
          rs.forEach(item => {
            if (item.type === "textGray") {
              // 去掉末尾的冒号
              typeName = (item.content || "").replace(/[:：]\s*$/, "").trim();
            }
          });

          // 提取变体数据
          (aspect.variants || []).forEach(variant => {
            const data = variant.data || {};
            const textRs = data.textRs || [];
            const attrValue = textRs
              .map(it => it && it.content)
              .filter(Boolean)
              .join(" ");

            // 查找是否已存在该变体
            let existingVariant = product.variants.find(v => v.sku === variant.sku);

            if (!existingVariant) {
              existingVariant = {
                sku: variant.sku,
                price: data.price || "",
                oldPrice: data.originalPrice || "",
                title: data.title || "",
                image: data.image || "",
                variantAttr: []
              };
              product.variants.push(existingVariant);
            }

            // 追加变体属性（去重）
            if (typeName && attrValue) {
              const existingAttr = existingVariant.variantAttr.find(a => a.name === typeName);
              if (!existingAttr) {
                existingVariant.variantAttr.push({
                  name: typeName,
                  value: attrValue
                });
              }
            }

            // 更新主商品信息（如果是主 SKU）
            if (variant.sku === sku) {
              if (data.price) product.price = data.price;
              if (data.originalPrice) product.oldPrice = data.originalPrice;
              if (data.title) product.title = data.title;
            }
          });
        });
      }

      // 解析公共属性
      if (key.includes("webCharacteristics")) {
        (value.characteristics || []).forEach(c => {
          // short 属性（简要属性）
          (c.short || []).forEach(item => {
            const attrValues = (item.values || [])
              .map(v => v.text)
              .filter(Boolean);
            if (item.name && attrValues.length > 0) {
              product.attributes.push({
                name: item.name,
                value: attrValues
              });
            }
          });

          // long 属性（详细属性）
          (c.long || []).forEach(item => {
            const attrValues = (item.values || [])
              .map(v => v.text)
              .filter(Boolean);
            if (item.name && attrValues.length > 0) {
              product.attributes.push({
                name: item.name,
                value: attrValues
              });
            }
          });
        });
      }

      // 解析描述
      if (key.includes("webDescription")) {
        product.descriptionHtml = value.richAnnotation || "";
        // 提取纯文本（去除 HTML 标签）
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = product.descriptionHtml;
        product.description = tempDiv.textContent || tempDiv.innerText || "";
      }

      // 解析标签
      if (key.includes("webHashtags") || key.includes("webBadges")) {
        const badges = value.badges || value.tags || [];
        product.tags = badges
          .map(badge => badge.text || badge.title)
          .filter(Boolean);
      }
    });

    // 如果没有变体，创建一个主商品变体
    if (product.variants.length === 0) {
      product.variants.push({
        sku: sku,
        price: product.price,
        oldPrice: product.oldPrice,
        title: product.title,
        image: product.coverImage || (product.images[0] || ""),
        variantAttr: []
      });
    }

    return product;
  }

  /**
   * 批量获取商品数据
   * @param {Array<string>} skus - 商品 SKU 数组
   * @param {Function} progressCallback - 进度回调函数 (current, total)
   * @returns {Array<Object>} 商品数据数组
   */
  async batchFetch(skus, progressCallback) {
    const results = [];
    const batchSize = 5;  // 每批 5 个
    const delay = 300;    // 延迟 300ms

    console.log(`[OzonProductFetcher] 开始批量获取 ${skus.length} 个商品`);

    for (let i = 0; i < skus.length; i += batchSize) {
      const batch = skus.slice(i, i + batchSize);

      console.log(`[OzonProductFetcher] 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(skus.length / batchSize)}`);

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

    console.log(`[OzonProductFetcher] 批量获取完成，成功 ${results.length}/${skus.length} 个`);
    return results;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('[OzonProductFetcher] 缓存已清除');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      skus: Array.from(this.cache.keys())
    };
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.OzonProductFetcher = OzonProductFetcher;
  console.log('[OzonProductFetcher] 模块已加载');
}
