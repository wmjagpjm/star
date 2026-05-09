// 长腿欧巴 V2 - 主控制器
// 整合所有服务模块，提供统一的业务流程接口

class MainController {
  constructor() {
    this.config = window.CONFIG;
    this.productService = new window.ProductDataService();
    this.match1688Service = new window.Match1688Service();
    this.ozonFetcher = new window.OzonProductFetcher();  // 新增：BCS 逆向的数据采集器

    this.products = [];
    this.currentMode = 'hot';
    this.isProcessing = false;
  }

  // ============ 完整选品流程 ============

  /**
   * 执行完整的选品流程
   * @param {Object} options - 选项
   * @param {Function} progressCallback - 进度回调
   * @returns {Promise<Array>} 最终商品列表
   */
  async executeFullPipeline(options = {}, progressCallback = null) {
    if (this.isProcessing) {
      throw new Error('正在处理中，请稍候');
    }

    this.isProcessing = true;

    try {
      const {
        mode = 'hot',
        categories = [],
        filters = {},
        enable1688Match = true,
        targetCount = 50,
        maxRawItems = 1000
      } = options;

      this.currentMode = mode;

      // 阶段 1: 批量获取商品数据
      this._updateProgress(progressCallback, '正在获取商品数据...', 10);
      const rawProducts = await this._fetchProductsUntilTarget(
        mode,
        categories,
        targetCount,
        maxRawItems,
        (current, total) => {
          const progress = 10 + (current / total) * 20;
          this._updateProgress(progressCallback, `正在获取商品 ${current}/${total}...`, progress);
        }
      );

      this._updateProgress(progressCallback, `已获取 ${rawProducts.length} 个商品`, 30);

      // 阶段 2: 标准化数据
      this._updateProgress(progressCallback, '正在标准化数据...', 35);
      let products = this.productService.normalizeFromSellerAPI(rawProducts);

      // 阶段 3: 应用基础筛选（FBS、价格区间等）
      this._updateProgress(progressCallback, '正在应用筛选规则...', 40);
      products = this.productService.applyFilters(products, filters);
      this._updateProgress(progressCallback, `筛选后剩余 ${products.length} 个商品`, 45);

      if (products.length === 0) {
        throw new Error('筛选后无商品，请调整筛选条件');
      }

      // 阶段 4: 获取商品详细信息（价格、图片、重量等）
      this._updateProgress(progressCallback, '正在获取商品详细信息...', 50);
      const skus = products.map(p => p.id).slice(0, 50); // 限制50个
      const detailsMap = await this.productService.fetchProductDetails(skus);
      products = this.productService.mergeProductDetails(products, detailsMap);
      this._updateProgress(progressCallback, '商品详细信息已获取', 65);

      // 阶段 5: 计算定价和利润
      this._updateProgress(progressCallback, '正在计算定价和利润...', 70);
      products = this.productService.calculatePricing(products);

      // 阶段 6: 筛选有绿标价格的商品
      products = products.filter(p => p.bestSellerPrice && p.cardPrice);
      this._updateProgress(progressCallback, `有绿标价格的商品: ${products.length} 个`, 75);

      if (products.length === 0) {
        throw new Error('无商品有绿标价格，请重试');
      }

      // 阶段 7: 1688 同款匹配（可选）
      if (enable1688Match) {
        this._updateProgress(progressCallback, '正在匹配 1688 同款...', 80);
        products = await this.match1688Service.batchMatch(
          products,
          (current, total) => {
            const progress = 80 + (current / total) * 15;
            this._updateProgress(progressCallback, `正在匹配 1688 同款 ${current}/${total}...`, progress);
          }
        );
      }

      // 阶段 8: 按利润率筛选
      this._updateProgress(progressCallback, '正在按利润率筛选...', 95);
      const minProfitRate = filters.minProfitRate || this.config.FILTER_DEFAULTS.minProfitRate;
      products = products.filter(p => p.profitRate >= minProfitRate);

      // 阶段 9: 排序和去重
      products = this.productService.deduplicateProducts(products);
      products = this.productService.sortByProfitRate(products);

      this._updateProgress(progressCallback, `完成！共 ${products.length} 个符合条件的商品`, 100);

      this.products = products;
      return products;

    } catch (error) {
      console.error('[MainController] 执行流程失败:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 循环获取商品，直到达到目标数量（有绿标价格）
   * @private
   */
  async _fetchProductsUntilTarget(mode, categories, targetCount, maxRawItems, progressCallback) {
    const allProducts = [];
    let offset = 0;
    const limit = 50;

    while (allProducts.length < maxRawItems) {
      const batch = await this.productService.fetchFromSellerAPI({
        mode,
        categories,
        offset,
        limit
      });

      if (batch.length === 0) {
        break; // 没有更多数据
      }

      allProducts.push(...batch);
      offset += limit;

      if (progressCallback) {
        progressCallback(allProducts.length, maxRawItems);
      }

      // 如果是热销模式，随机偏移避免重复
      if (mode === 'hot') {
        offset = Math.floor(Math.random() * 500);
      }

      // 延迟避免请求过快
      await new Promise(r => setTimeout(r, 300));
    }

    return allProducts;
  }

  /**
   * 更新进度
   * @private
   */
  _updateProgress(callback, message, percent) {
    if (callback) {
      callback({ message, percent });
    }
  }

  // ============ 单独功能接口 ============

  /**
   * 仅获取商品列表（不计算定价）
   */
  async fetchProductsOnly(options = {}) {
    const { mode = 'hot', categories = [], filters = {} } = options;

    const rawProducts = await this.productService.fetchFromSellerAPI({
      mode,
      categories,
      offset: 0,
      limit: 100
    });

    let products = this.productService.normalizeFromSellerAPI(rawProducts);
    products = this.productService.applyFilters(products, filters);

    return products;
  }

  /**
   * 为已有商品补充详细信息
   */
  async enrichProductDetails(products) {
    const skus = products.map(p => p.id);
    const detailsMap = await this.productService.fetchProductDetails(skus);
    return this.productService.mergeProductDetails(products, detailsMap);
  }

  /**
   * 为已有商品计算定价
   */
  calculatePricingForProducts(products) {
    return this.productService.calculatePricing(products);
  }

  /**
   * 为已有商品匹配 1688 同款
   */
  async match1688ForProducts(products, progressCallback = null) {
    return await this.match1688Service.batchMatch(products, progressCallback);
  }

  // ============ BCS 逆向功能 ============

  /**
   * 使用 BCS 逆向的接口获取商品完整数据
   * @param {Array<string>} skus - 商品 SKU 数组
   * @param {Function} progressCallback - 进度回调
   * @returns {Promise<Array>} 商品完整数据数组
   */
  async fetchOzonProductDetails(skus, progressCallback = null) {
    console.log('[MainController] 使用 BCS 逆向接口获取商品详细数据');
    return await this.ozonFetcher.batchFetch(skus, progressCallback);
  }

  /**
   * 获取单个商品的完整数据
   * @param {string} sku - 商品 SKU
   * @returns {Promise<Object>} 商品数据
   */
  async fetchSingleOzonProduct(sku) {
    return await this.ozonFetcher.fetchProductData(sku);
  }

  /**
   * 清除 Ozon 数据采集器的缓存
   */
  clearOzonFetcherCache() {
    this.ozonFetcher.clearCache();
  }

  /**
   * 获取 Ozon 数据采集器的缓存统计
   */
  getOzonFetcherCacheStats() {
    return this.ozonFetcher.getCacheStats();
  }

  // ============ 导出功能 ============

  /**
   * 导出商品数据为 Excel/CSV
   */
  exportToExcel(products, filename = 'ozon_products.csv') {
    const fields = this.config.EXPORT_FIELDS;

    // 生成 CSV 表头
    const headers = fields.map(f => f.label).join(',');

    // 生成数据行
    const rows = products.map(product => {
      return fields.map(field => {
        let value = this._getNestedValue(product, field.key);

        // 格式化
        if (field.type === 'percent' && value !== null) {
          value = `${value}%`;
        } else if (field.type === 'number' && value !== null) {
          value = Math.round(value);
        } else if (field.type === 'link' && value) {
          value = `"${value}"`;
        } else if (!value) {
          value = '-';
        }

        return value;
      }).join(',');
    });

    const csv = [headers, ...rows].join('\n');

    // 下载文件
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  /**
   * 导出为 HTML 报告
   */
  exportToHTML(products, filename = 'ozon_products.html') {
    const html = this._generateHTMLReport(products);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  /**
   * 生成 HTML 报告
   * @private
   */
  _generateHTMLReport(products) {
    const rows = products.map((p, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><img src="${p.mainImage}" style="width:80px;height:80px;object-fit:cover;"></td>
        <td>${p.titleZh || p.title}</td>
        <td><a href="${p.url}" target="_blank">查看</a></td>
        <td>${p.recommendedPrice || '-'} ₽</td>
        <td>${p.cardPrice || '-'} ₽</td>
        <td>${p.bestSellerPrice || '-'} ₽</td>
        <td>${p.purchaseCost || '-'} ₽</td>
        <td>${p.profit || '-'} ₽</td>
        <td style="color:${p.profitRate >= 30 ? 'green' : p.profitRate >= 22 ? 'orange' : 'red'}">${p.profitRate || '-'}%</td>
        <td>${p.soldCount || '-'}</td>
        <td>${p.brand || '-'}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Ozon 选品报告 - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #667eea; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #667eea; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    img { border-radius: 4px; }
  </style>
</head>
<body>
  <h1>🛒 Ozon 选品报告</h1>
  <p>生成时间：${new Date().toLocaleString()}</p>
  <p>商品数量：${products.length}</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>主图</th>
        <th>商品标题</th>
        <th>链接</th>
        <th>推荐售价</th>
        <th>黑标价格</th>
        <th>绿标价格</th>
        <th>采购成本</th>
        <th>利润</th>
        <th>利润率</th>
        <th>月销量</th>
        <th>品牌</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
    `;
  }

  /**
   * 获取嵌套对象的值
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ============ 状态管理 ============

  /**
   * 获取当前商品列表
   */
  getProducts() {
    return this.products;
  }

  /**
   * 清空商品列表
   */
  clearProducts() {
    this.products = [];
  }

  /**
   * 获取处理状态
   */
  isProcessingNow() {
    return this.isProcessing;
  }
}

// 导出控制器类
if (typeof window !== 'undefined') {
  window.MainController = MainController;
}
