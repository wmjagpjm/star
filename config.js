// 长腿欧巴 V2 - 全局配置文件
// 集中管理所有配置项、常量、公式

const CONFIG = {
  // ============ 版本信息 ============
  VERSION: '2.1.0',
  NAME: '长腿欧巴 V2 - 智能选品助手',

  // ============ 筛选规则默认值 ============
  FILTER_DEFAULTS: {
    // 店铺筛选
    minShopRating: 4.5,        // 店铺评分 ≥4.5
    minReviewCount: 100,       // 评论数 ≥100
    minOrderCount: 200,        // 订单数 ≥200

    // 商品筛选
    minMonthSales: null,       // 月销量最小值（可选）
    maxMonthSales: null,       // 月销量最大值（可选）
    minPrice: null,            // 售价最小值（可选）
    maxPrice: null,            // 售价最大值（可选）
    maxFollowSellers: null,    // 最大跟卖数（可选）
    maxProductAge: null,       // 商品创建天数（可选）
    maxWeight: null,           // 最大重量 kg（可选）

    // 发货方式
    requireFBS: true,          // 必须 FBS 发货

    // 利润率筛选
    minProfitRate: 22,         // 最低利润率 22%
  },

  // ============ 定价公式 ============
  PRICING: {
    // 推荐售价公式：(黑标 - 绿标) × 2.2 + 黑标 - 1
    calculateRecommendedPrice: (blackPrice, greenPrice) => {
      if (!blackPrice || !greenPrice) return null;
      return (blackPrice - greenPrice) * 2.2 + blackPrice - 1;
    },

    // Ozon 成本计算
    MISC_FEE_RATE: 0.05,       // 5% 杂费

    // 佣金计算（按类目，默认值）
    DEFAULT_COMMISSION_RATE: 0.15,  // 默认 15%

    // 佣金表（按类目 ID）
    COMMISSION_BY_CATEGORY: {
      '10500': 0.12,  // 家用电器 12%
      '10515': 0.13,  // 洗碗机 13%
      '10502': 0.12,  // 冰箱 12%
      '31635': 0.12,  // 双门冰箱 12%
      // 更多类目佣金待补充
    },

    // 运费计算（按重量，单位：卢布）
    calculateShipping: (weightKg) => {
      if (!weightKg || weightKg <= 0) return 0;
      if (weightKg <= 1) return 150;
      if (weightKg <= 5) return 250;
      if (weightKg <= 10) return 400;
      if (weightKg <= 20) return 600;
      return 600 + (weightKg - 20) * 30; // 超过20kg，每kg加30卢布
    },

    // 利润计算：推荐售价 - 5%杂费 - 佣金 - 运费 - 采购成本
    calculateProfit: (recommendedPrice, commission, shipping, purchaseCost) => {
      if (!recommendedPrice) return null;
      const miscFee = recommendedPrice * CONFIG.PRICING.MISC_FEE_RATE;
      return recommendedPrice - miscFee - (commission || 0) - (shipping || 0) - (purchaseCost || 0);
    },

    // 利润率计算：利润 / 推荐售价
    calculateProfitRate: (profit, recommendedPrice) => {
      if (!profit || !recommendedPrice || recommendedPrice <= 0) return null;
      return (profit / recommendedPrice) * 100;
    }
  },

  // ============ API 配置 ============
  API: {
    // Ozon Seller API
    OZON_SELLER_BASE: 'https://seller.ozon.ru/api',
    OZON_SELLER_ANALYTICS: '/site/seller-analytics/what_to_sell/data/v3',

    // Ozon 前台 API
    OZON_PUBLIC_BASE: 'https://www.ozon.ru/api',
    OZON_PRODUCT_DETAIL: '/entrypoint-api.bx/page/json/v2',

    // 1688 API (OneBound)
    ONEBOUND_BASE: 'https://api-gw.onebound.cn/1688',
    ONEBOUND_IMAGE_SEARCH: '/item_search_img/',
    ONEBOUND_KEY: 't3246573992',
    ONEBOUND_SECRET: '39922f40',

    // 请求限流配置
    RATE_LIMIT: {
      batchSize: 5,           // 每批处理数量
      batchDelay: 300,        // 批次间延迟（毫秒）
      requestTimeout: 30000,  // 请求超时（毫秒）
    }
  },

  // ============ 批量获取配置 ============
  BULK_FETCH: {
    targetCount: 50,          // 目标商品数量（有低价推荐）
    maxRawItems: 1000,        // 最多获取原始数据数量
    defaultLimit: 50,         // 每次请求数量
  },

  // ============ 选品模式 ============
  MODES: {
    HOT: 'hot',               // 热销榜单
    NEWEST: 'newest',         // 最新上架
    CATEGORY: 'category',     // 按类目
    SHOP: 'shop',             // 查店铺
    RANDOM: 'random'          // 完全随机
  },

  // ============ 排序方式 ============
  SORT_KEYS: {
    SUM_GMV_DESC: 'sum_gmv_desc',       // 销售额降序
    AVG_GMV_DESC: 'avg_gmv_desc',       // 平均价格降序
    COUNT_SOLD_DESC: 'count_sold_desc', // 销量降序
    VIEWS_DESC: 'views_desc',           // 浏览量降序
    APPEARED_ASC: 'appeared_asc',       // 上架时间升序（最新）
  },

  // ============ 数据字段映射 ============
  FIELD_MAPPING: {
    // Ozon Seller API 返回字段 -> 内部标准字段
    fromSellerAPI: (item) => ({
      id: String(item.sku || item.product_id || item.id || ''),
      title: item.name || item.skuName || item.title || '未知商品',
      titleZh: '',  // 待翻译
      platform: 'Ozon',

      // 价格相关
      avgPriceRub: String(Math.round(item.avgPrice || item.avgGmv || 0)),
      cardPrice: '',           // 黑标价格（需从前台API获取）
      discountPrice: '',       // 折扣价
      bestSellerPrice: '',     // 绿标最低价（需从前台API获取）
      promoPrice: '-',
      recommendedPrice: '',    // 推荐售价（待计算）

      // 销售数据
      soldSum: item.soldSum || '-',
      soldCount: item.soldCount || '-',
      views: item.views || '-',

      // 商品属性
      brand: item.brand || '-',
      category: item.category1 ? `${item.category1}/${item.category3 || ''}` : '-',
      categoryId: item.category3Id || '',

      // 发货方式
      isFBS: (item.salesSchema || '').toUpperCase() === 'FBS' ||
             ((item.sources || []).length === 1 && (item.sources[0] || '').toUpperCase() === 'FBS'),
      salesSchema: (item.salesSchema || 'FBS').toUpperCase(),

      // 链接和图片
      url: item.link || `https://www.ozon.ru/product/${item.sku || item.product_id || ''}/`,
      mainImage: '',           // 主图（需从前台API获取）

      // 物流信息
      weight: '',              // 重量（需从前台API获取）
      dimensions: '',          // 尺寸（需从前台API获取）
      delivery: '',            // 配送方式（需从前台API获取）

      // 成本和利润（待计算）
      commission: 0,           // 佣金
      shipping: 0,             // 运费
      miscFee: 0,              // 杂费
      purchaseCost: 0,         // 1688采购成本
      profit: 0,               // 利润
      profitRate: 0,           // 利润率

      // 1688 同款信息
      match1688: null,         // 1688同款数据

      // 元数据
      createdAt: item.appeared || '',
      rating: '',
      comments: '',
    }),

    // Ozon 前台 API 返回字段 -> 补充字段
    fromPublicAPI: (info) => ({
      cardPrice: info.cardPrice || '',
      bestSellerPrice: info.bestSellerPrice || '',
      discountPrice: info.price || '',
      mainImage: info.mainImage || '',
      brand: info.brand || '',
      weight: info.weight || '',
      dimensions: info.dimensions || '',
      delivery: info.delivery || '',
      titleZh: info.titleZh || '',
    })
  },

  // ============ 表格导出字段 ============
  EXPORT_FIELDS: [
    { key: 'mainImage', label: '主图', type: 'image' },
    { key: 'titleZh', label: '商品标题（中文）', type: 'text' },
    { key: 'url', label: 'Ozon链接', type: 'link' },
    { key: 'match1688.url', label: '1688链接', type: 'link' },
    { key: 'recommendedPrice', label: '推荐售价（₽）', type: 'number' },
    { key: 'cardPrice', label: '黑标价格（₽）', type: 'number' },
    { key: 'bestSellerPrice', label: '绿标价格（₽）', type: 'number' },
    { key: 'purchaseCost', label: '采购成本（¥）', type: 'number' },
    { key: 'profit', label: '利润（₽）', type: 'number' },
    { key: 'profitRate', label: '利润率（%）', type: 'percent' },
    { key: 'weight', label: '重量', type: 'text' },
    { key: 'dimensions', label: '尺寸', type: 'text' },
    { key: 'commission', label: '佣金（₽）', type: 'number' },
    { key: 'shipping', label: '运费（₽）', type: 'number' },
    { key: 'miscFee', label: '杂费（₽）', type: 'number' },
    { key: 'soldCount', label: '月销量', type: 'number' },
    { key: 'views', label: '浏览量', type: 'number' },
    { key: 'brand', label: '品牌', type: 'text' },
    { key: 'category', label: '类目', type: 'text' },
  ],

  // ============ UI 配置 ============
  UI: {
    maxResultsDisplay: 50,    // 最多显示结果数
    progressUpdateInterval: 100, // 进度条更新间隔（毫秒）
  }
};

// 导出配置（浏览器环境）
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
