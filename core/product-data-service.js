// 长腿欧巴 V2 - 核心数据处理模块
// 负责商品数据的获取、转换、筛选、计算

class ProductDataService {
  constructor() {
    this.products = [];
    this.config = window.CONFIG || {};
  }

  // ============ 数据获取 ============

  /**
   * 从 Ozon Seller API 批量获取商品数据
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 商品列表
   */
  async fetchFromSellerAPI(options = {}) {
    const {
      mode = 'hot',
      categories = [],
      offset = 0,
      limit = 50,
      shopId = null
    } = options;

    // 查找 seller.ozon.ru 标签页
    const [sellerTab] = await chrome.tabs.query({ url: '*://seller.ozon.ru/*' });
    if (!sellerTab || !sellerTab.id) {
      throw new Error('请先打开 seller.ozon.ru 并登录');
    }

    // 确定排序方式
    let sortKey = '';
    if (mode === 'newest') {
      sortKey = this.config.SORT_KEYS?.APPEARED_ASC || 'appeared_asc';
    } else if (mode === 'hot') {
      // 热销模式：随机选择排序方式
      const sortKeys = [
        'sum_gmv_desc',
        'avg_gmv_desc',
        'count_sold_desc',
        'views_desc'
      ];
      sortKey = sortKeys[Math.floor(Math.random() * sortKeys.length)];
    }

    // 发送消息到 seller-bridge.js
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        sellerTab.id,
        {
          type: 'OZON_BULK_PRODUCTS',
          offset,
          limit,
          categories,
          period: 'monthly',
          mode,
          sortKey,
          shopId
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response || !response.success) {
            reject(new Error(response?.error || '获取数据失败'));
            return;
          }
          resolve(response.items || []);
        }
      );
    });
  }

  /**
   * 从 Ozon 前台 API 获取商品详细信息（价格、图片、重量等）
   * @param {Array<string>} skus - 商品 SKU 列表
   * @param {number} tabId - Ozon 标签页 ID
   * @returns {Promise<Object>} SKU -> 详细信息映射
   */
  async fetchProductDetails(skus, tabId = null) {
    // 查找 ozon.ru 页面（排除 seller）
    const ozonTabs = await chrome.tabs.query({ url: '*://*.ozon.ru/*' });
    const ozonTab = tabId
      ? ozonTabs.find(t => t.id === tabId)
      : ozonTabs.find(t => t.url && !t.url.includes('seller.ozon.ru'));

    if (!ozonTab || !ozonTab.id) {
      throw new Error('请打开任意 ozon.ru 页面');
    }

    // 在页面中执行脚本获取详细信息
    const results = await chrome.scripting.executeScript({
      target: { tabId: ozonTab.id },
      func: this._fetchDetailsInPage,
      args: [skus]
    });

    return results?.[0]?.result || {};
  }

  /**
   * 在页面中执行的函数：批量获取商品详情
   * @private
   */
  static async _fetchDetailsInPage(skuList) {
    const resultMap = {};
    const batchSize = 5;
    const batchDelay = 300;

    // 批量翻译函数
    async function translateToZh(texts) {
      try {
        const q = texts.join('\n');
        const resp = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(q)}`
        );
        const data = await resp.json();
        const translated = data[0].map(s => s[0]).join('');
        return translated.split('\n');
      } catch (e) {
        return texts;
      }
    }

    // 批量获取商品信息
    for (let i = 0; i < skuList.length; i += batchSize) {
      const batch = skuList.slice(i, i + batchSize);
      const promises = batch.map(async (sku) => {
        try {
          const url = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/product/${sku}`;
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
          });

          if (!resp.ok) return;

          const data = await resp.json();
          const states = data.widgetStates || {};
          const info = {};

          // 解析各个 widget
          for (const [key, val] of Object.entries(states)) {
            try {
              const obj = typeof val === 'string' ? JSON.parse(val) : val;

              // 价格信息
              if (key.startsWith('webPrice-') && !key.includes('Stars')) {
                if (!info.cardPrice && obj.cardPrice) info.cardPrice = obj.cardPrice;
                if (!info.price && (obj.price || obj.originalPrice || obj.currentPrice)) {
                  info.price = obj.price || obj.originalPrice || obj.currentPrice;
                }
              }

              // 绿标最低价
              if (key.startsWith('webBestSeller-') && !info.bestSellerPrice) {
                const priceItem = (obj.textRs || []).find(t => t.type === 'textMediumBold');
                if (priceItem?.content) {
                  info.bestSellerPrice = priceItem.content;
                } else if (obj.price) {
                  info.bestSellerPrice = obj.price;
                } else if (obj.text) {
                  info.bestSellerPrice = obj.text;
                }
              }

              // 标题和品牌
              if (key.startsWith('webProductHeading') && !info.title) {
                info.title = obj.title || '';
                if (!info.brand && obj.brand) info.brand = obj.brand;
              }

              // 品牌备选
              if (key.startsWith('webBrand') && !info.brand) {
                info.brand = obj.name || obj.brand || obj.title || '';
              }

              // 主图
              if (key.startsWith('webGallery') && !info.mainImage) {
                const covers = obj.coverImage || obj.images || obj.covers || [];
                if (Array.isArray(covers) && covers.length > 0) {
                  info.mainImage = covers[0].src || covers[0].url || covers[0];
                } else if (typeof obj.coverImage === 'string') {
                  info.mainImage = obj.coverImage;
                }
              }

              // 重量和尺寸
              if ((key.startsWith('webShortCharacteristics') || key.startsWith('webCharacteristics')) &&
                  (!info.weight || !info.dimensions)) {
                const chars = obj.characteristics || obj.shortCharacteristics || [];
                for (const group of chars) {
                  const items = group.short || group.characteristics || [];
                  for (const ch of items) {
                    const k = (ch.key || ch.name || '').toLowerCase();
                    const v = ch.value || ch.values?.[0]?.text || '';
                    if ((k.includes('вес') || k.includes('weight')) && !info.weight) {
                      info.weight = v;
                    }
                    if ((k.includes('габарит') || k.includes('размер') || k.includes('dimension')) && !info.dimensions) {
                      info.dimensions = v;
                    }
                  }
                }
              }

              // 配送方式
              if (key.startsWith('webDelivery') && !info.delivery) {
                const parts = [];
                if (obj.deliveryText) parts.push(obj.deliveryText);
                if (obj.courierText) parts.push(obj.courierText);
                if (obj.pickupText) parts.push(obj.pickupText);
                if (obj.title) parts.push(obj.title);
                if (parts.length) info.delivery = parts.join(' | ');
              }
            } catch (e) {
              // 忽略解析错误
            }
          }

          if (info.cardPrice || info.price || info.title || info.mainImage) {
            resultMap[sku] = info;
          }
        } catch (e) {
          console.error('[ProductDataService] 获取商品详情失败:', sku, e);
        }
      });

      await Promise.all(promises);
      if (i + batchSize < skuList.length) {
        await new Promise(r => setTimeout(r, batchDelay));
      }
    }

    // 批量翻译标题
    const skusWithTitle = Object.entries(resultMap).filter(([k, v]) => v.title);
    for (let i = 0; i < skusWithTitle.length; i += 20) {
      const batch = skusWithTitle.slice(i, i + 20);
      const titles = batch.map(([k, v]) => v.title);
      try {
        const zhTitles = await translateToZh(titles);
        batch.forEach(([sku], idx) => {
          if (zhTitles[idx]) resultMap[sku].titleZh = zhTitles[idx];
        });
      } catch (e) {
        // 翻译失败不影响主流程
      }
    }

    return resultMap;
  }

  // ============ 数据转换 ============

  /**
   * 将 Seller API 返回的数据转换为标准格式
   * @param {Array} rawItems - 原始数据
   * @returns {Array} 标准化商品列表
   */
  normalizeFromSellerAPI(rawItems) {
    const mapper = this.config.FIELD_MAPPING?.fromSellerAPI;
    if (!mapper) {
      throw new Error('配置文件缺失：FIELD_MAPPING.fromSellerAPI');
    }
    return rawItems.map(item => mapper(item));
  }

  /**
   * 合并前台 API 的详细信息到商品数据
   * @param {Array} products - 商品列表
   * @param {Object} detailsMap - SKU -> 详细信息映射
   * @returns {Array} 合并后的商品列表
   */
  mergeProductDetails(products, detailsMap) {
    const mapper = this.config.FIELD_MAPPING?.fromPublicAPI;
    if (!mapper) {
      throw new Error('配置文件缺失：FIELD_MAPPING.fromPublicAPI');
    }

    return products.map(product => {
      const details = detailsMap[product.id];
      if (!details) return product;

      const mappedDetails = mapper(details);
      return { ...product, ...mappedDetails };
    });
  }

  // ============ 数据筛选 ============

  /**
   * 应用筛选规则
   * @param {Array} products - 商品列表
   * @param {Object} filters - 筛选条件
   * @returns {Array} 筛选后的商品列表
   */
  applyFilters(products, filters = {}) {
    const defaults = this.config.FILTER_DEFAULTS || {};
    const mergedFilters = { ...defaults, ...filters };

    return products.filter(product => {
      // FBS 发货筛选
      if (mergedFilters.requireFBS && !product.isFBS) {
        return false;
      }

      // 价格区间
      const price = parseFloat(product.avgPriceRub) || 0;
      if (mergedFilters.minPrice && price > 0 && price < mergedFilters.minPrice) {
        return false;
      }
      if (mergedFilters.maxPrice && price > 0 && price > mergedFilters.maxPrice) {
        return false;
      }

      // 月销量区间
      const sales = parseFloat(product.soldCount) || 0;
      if (mergedFilters.minMonthSales && sales < mergedFilters.minMonthSales) {
        return false;
      }
      if (mergedFilters.maxMonthSales && sales > mergedFilters.maxMonthSales) {
        return false;
      }

      // 无价格商品过滤
      if (price <= 0) {
        return false;
      }

      // 利润率筛选（如果已计算）
      if (product.profitRate !== undefined && product.profitRate !== null) {
        if (mergedFilters.minProfitRate && product.profitRate < mergedFilters.minProfitRate) {
          return false;
        }
      }

      return true;
    });
  }

  // ============ 定价计算 ============

  /**
   * 计算商品的推荐售价、成本、利润
   * @param {Array} products - 商品列表
   * @returns {Array} 计算后的商品列表
   */
  calculatePricing(products) {
    const pricing = this.config.PRICING;
    if (!pricing) {
      throw new Error('配置文件缺失：PRICING');
    }

    return products.map(product => {
      // 提取价格（去除货币符号和空格）
      const blackPrice = this._parsePrice(product.cardPrice);
      const greenPrice = this._parsePrice(product.bestSellerPrice);

      // 计算推荐售价
      let recommendedPrice = null;
      if (blackPrice && greenPrice) {
        recommendedPrice = pricing.calculateRecommendedPrice(blackPrice, greenPrice);
      }

      // 提取重量（kg）
      const weightKg = this._parseWeight(product.weight);

      // 计算运费
      const shipping = pricing.calculateShipping(weightKg);

      // 计算佣金
      const commissionRate = pricing.COMMISSION_BY_CATEGORY[product.categoryId] ||
                            pricing.DEFAULT_COMMISSION_RATE;
      const commission = recommendedPrice ? recommendedPrice * commissionRate : 0;

      // 计算杂费
      const miscFee = recommendedPrice ? recommendedPrice * pricing.MISC_FEE_RATE : 0;

      // 计算利润（暂不包含采购成本，等 1688 匹配后再计算）
      const profit = pricing.calculateProfit(
        recommendedPrice,
        commission,
        shipping,
        product.purchaseCost || 0
      );

      // 计算利润率
      const profitRate = pricing.calculateProfitRate(profit, recommendedPrice);

      return {
        ...product,
        recommendedPrice: recommendedPrice ? Math.round(recommendedPrice) : null,
        commission: Math.round(commission),
        shipping: Math.round(shipping),
        miscFee: Math.round(miscFee),
        profit: profit ? Math.round(profit) : null,
        profitRate: profitRate ? parseFloat(profitRate.toFixed(2)) : null,
      };
    });
  }

  /**
   * 解析价格字符串（支持卢布符号）
   * @private
   */
  _parsePrice(priceStr) {
    if (!priceStr) return null;
    const cleaned = String(priceStr).replace(/[^\d.,]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * 解析重量字符串（转换为 kg）
   * @private
   */
  _parseWeight(weightStr) {
    if (!weightStr) return null;
    const str = String(weightStr).toLowerCase();

    // 提取数字
    const match = str.match(/[\d.,]+/);
    if (!match) return null;

    const num = parseFloat(match[0].replace(',', '.'));
    if (isNaN(num)) return null;

    // 单位转换
    if (str.includes('г') || str.includes('g')) {
      return num / 1000; // 克转千克
    }
    if (str.includes('кг') || str.includes('kg')) {
      return num;
    }

    // 默认按克处理
    return num / 1000;
  }

  // ============ 工具方法 ============

  /**
   * 去重（按 SKU）
   * @param {Array} products - 商品列表
   * @returns {Array} 去重后的商品列表
   */
  deduplicateProducts(products) {
    const seen = new Set();
    return products.filter(product => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }

  /**
   * 按利润率排序（降序）
   * @param {Array} products - 商品列表
   * @returns {Array} 排序后的商品列表
   */
  sortByProfitRate(products) {
    return [...products].sort((a, b) => {
      const rateA = a.profitRate || 0;
      const rateB = b.profitRate || 0;
      return rateB - rateA;
    });
  }
}

// 导出服务类
if (typeof window !== 'undefined') {
  window.ProductDataService = ProductDataService;
}
