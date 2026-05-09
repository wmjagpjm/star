// 长腿欧巴 V2 - 1688 同款匹配服务
// 负责 1688 商品搜索、采购价比对、利润核算

class Match1688Service {
  constructor() {
    this.config = window.CONFIG || {};
    this.cache = new Map(); // 图片搜索缓存
  }

  // ============ 图片搜索 ============

  /**
   * 使用 OneBound API 通过图片搜索 1688 同款
   * @param {string} imageUrl - 商品图片 URL
   * @param {number} page - 页码
   * @returns {Promise<Array>} 1688 商品列表
   */
  async searchByImage(imageUrl, page = 1) {
    if (!imageUrl) return [];

    // 检查缓存
    const cacheKey = `${imageUrl}_${page}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // 下载图片并转为 Base64 JPEG
      let imgid = imageUrl.trim();
      if (!imgid.startsWith('data:')) {
        imgid = await this._downloadImageAsBase64(imgid);
      }

      // 调用 OneBound API
      const apiConfig = this.config.API;
      const url = `${apiConfig.ONEBOUND_BASE}${apiConfig.ONEBOUND_IMAGE_SEARCH}?key=${apiConfig.ONEBOUND_KEY}&secret=${apiConfig.ONEBOUND_SECRET}&imgid=${encodeURIComponent(imgid)}&lang=zh-CN&page=${page}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error_code === '0000') {
        const items = (data.items?.item || []).map(item => this._normalize1688Item(item));
        this.cache.set(cacheKey, items);
        return items;
      } else if (data.error_code === '2000') {
        // 未找到同款
        return [];
      } else {
        throw new Error(data.error || data.reason || '搜索失败');
      }
    } catch (error) {
      console.error('[Match1688Service] 图片搜索失败:', error);
      return [];
    }
  }

  /**
   * 下载图片并转为 Base64 JPEG
   * @private
   */
  async _downloadImageAsBase64(imageUrl) {
    const response = await fetch(imageUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;

          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          URL.revokeObjectURL(url);

          canvas.toBlob((jpegBlob) => {
            if (!jpegBlob) {
              reject(new Error('Canvas 转 JPEG 失败'));
              return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(jpegBlob);
          }, 'image/jpeg', 0.85);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败'));
      };

      img.src = url;
    });
  }

  /**
   * 标准化 1688 商品数据
   * @private
   */
  _normalize1688Item(item) {
    return {
      id: item.num_iid || '',
      title: item.title || '',
      price: parseFloat(item.price) || 0,
      priceRange: item.price_range || '',
      url: item.detail_url || '',
      image: item.pic_url || '',
      shopName: item.nick || '',
      shopUrl: item.shop_url || '',
      location: item.location || '',
      sales: parseInt(item.sold_quantity) || 0,
      minOrder: parseInt(item.min_order_quantity) || 1,
    };
  }

  // ============ 同款匹配 ============

  /**
   * 为商品列表批量匹配 1688 同款
   * @param {Array} products - Ozon 商品列表
   * @param {Function} progressCallback - 进度回调 (current, total)
   * @returns {Promise<Array>} 匹配后的商品列表
   */
  async batchMatch(products, progressCallback = null) {
    const results = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      if (progressCallback) {
        progressCallback(i + 1, products.length);
      }

      try {
        // 使用主图搜索 1688 同款
        if (product.mainImage) {
          const matches = await this.searchByImage(product.mainImage, 1);

          if (matches.length > 0) {
            // 选择最佳匹配（价格最低）
            const bestMatch = matches.reduce((best, current) =>
              current.price < best.price ? current : best
            );

            // 更新商品数据
            product.match1688 = bestMatch;
            product.purchaseCost = this._convertCNYtoRUB(bestMatch.price);

            // 重新计算利润和利润率
            const pricing = this.config.PRICING;
            if (product.recommendedPrice && pricing) {
              product.profit = pricing.calculateProfit(
                product.recommendedPrice,
                product.commission,
                product.shipping,
                product.purchaseCost
              );

              product.profitRate = pricing.calculateProfitRate(
                product.profit,
                product.recommendedPrice
              );
            }
          }
        }

        results.push(product);

        // 延迟避免请求过快
        if (i < products.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        console.error('[Match1688Service] 匹配失败:', product.id, error);
        results.push(product);
      }
    }

    return results;
  }

  /**
   * 人民币转卢布（简化汇率：1 CNY ≈ 13 RUB）
   * @private
   */
  _convertCNYtoRUB(cny) {
    const exchangeRate = 13; // 可配置
    return Math.round(cny * exchangeRate);
  }

  // ============ 标题匹配（备用方案）============

  /**
   * 通过标题关键词搜索 1688（备用方案，需要 1688 API）
   * @param {string} title - 商品标题
   * @returns {Promise<Array>} 1688 商品列表
   */
  async searchByTitle(title) {
    // TODO: 实现标题搜索（需要 1688 开放平台 API）
    console.warn('[Match1688Service] 标题搜索功能待实现');
    return [];
  }

  /**
   * 计算标题相似度（简单实现）
   * @private
   */
  _calculateTitleSimilarity(title1, title2) {
    const words1 = new Set(title1.toLowerCase().split(/\s+/));
    const words2 = new Set(title2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}

// 导出服务类
if (typeof window !== 'undefined') {
  window.Match1688Service = Match1688Service;
}
