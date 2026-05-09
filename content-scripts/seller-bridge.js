// seller-bridge.js - seller.ozon.ru content script
(function() {
  'use strict';
  const chrome = globalThis.chrome;

  function getCompanyId() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'sc_company_id') {
        console.log('[Seller Bridge] companyId from cookie:', value);
        return value;
      }
    }
    const fromLs = localStorage.getItem('ozon_company_id') || '';
    console.log('[Seller Bridge] companyId from localStorage:', fromLs);
    return fromLs;
  }

  const HARDCODED_API_CREDS = {
    clientId: '3368249',
    apiKey: '2f802af9-437d-42ce-b29f-e76c895437f9'
  };

  function getPublicApiCredentials() {
    if (HARDCODED_API_CREDS.clientId && HARDCODED_API_CREDS.apiKey) {
      return HARDCODED_API_CREDS;
    }
    try {
      const clientId = localStorage.getItem('ozon_api_client_id') || localStorage.getItem('clientId');
      const apiKey = localStorage.getItem('ozon_api_key') || localStorage.getItem('apiKey');
      if (clientId && apiKey) return { clientId, apiKey };
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') {
        const cid = window.__OZON_CLIENT_ID__ || window.clientId || window.ozonClientId;
        const key = window.__OZON_API_KEY__ || window.apiKey || window.ozonApiKey;
        if (cid && key) return { clientId: cid, apiKey: key };
      }
    } catch (e) {}
    return null;
  }

  // Description Category Tree (公共API)
  function handleDescriptionCategoryTree(request, sendResponse) {
    const creds = getPublicApiCredentials();
    const lang = request.language || 'ZH_HANS';
    const companyId = getCompanyId();

    if (!creds) {
      if (!companyId) {
        sendResponse({ success: false, error: 'Failed to get company ID' });
        return;
      }
      fetch('https://seller.ozon.ru/api/v1/seller-tree/get-seller-tree-filtered-by-products-existence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-o3-company-id': companyId, 'x-o3-language': 'zh-Hans' },
        body: JSON.stringify({ company_id: companyId }),
        credentials: 'include'
      })
      .then(resp => { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
      .then(data => { sendResponse({ success: true, data: data.result || {}, source: 'internal' }); })
      .catch(e => { sendResponse({ success: false, error: e.message }); });
      return;
    }

    fetch('https://seller.ozon.ru/api/v1/description-category/tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Id': creds.clientId, 'Api-Key': creds.apiKey },
      body: JSON.stringify({ language: lang }),
      credentials: 'include'
    })
    .then(resp => { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
    .then(data => {
      const arr = Array.isArray(data) ? data : (data.result || []);
      sendResponse({ success: true, data: arr, source: 'public' });
    })
    .catch(e => {
      if (!companyId) { sendResponse({ success: false, error: 'Public API failed: ' + e.message }); return; }
      fetch('https://seller.ozon.ru/api/v1/seller-tree/get-seller-tree-filtered-by-products-existence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-o3-company-id': companyId, 'x-o3-language': 'zh-Hans' },
        body: JSON.stringify({ company_id: companyId }),
        credentials: 'include'
      })
      .then(resp => { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
      .then(data => { sendResponse({ success: true, data: data.result || {}, source: 'internal-fallback' }); })
      .catch(e2 => { sendResponse({ success: false, error: 'Public API failed: ' + e.message + '; Internal API also failed: ' + e2.message }); });
    });
  }

  // 从卖家已有商品中提取真实 category3Id
  function handleGetSellerCategories(request, sendResponse) {
    const companyId = getCompanyId();
    console.log('[Seller Bridge] GET_SELLER_CATEGORIES, companyId:', companyId);
    if (!companyId) {
      sendResponse({ success: false, error: 'Failed to get company ID' });
      return;
    }
    fetch('https://seller.ozon.ru/api/site/seller-analytics/what_to_sell/data/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-o3-company-id': companyId, 'x-o3-language': 'zh-Hans' },
      body: JSON.stringify({ limit: '500', offset: '0', filter: { stock: 'any_stock', period: 'monthly', categories: [] }, sort: { key: 'sum_gmv_desc' } }),
      credentials: 'include'
    })
    .then(resp => { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
    .then(data => {
      const seen = new Set();
      const categories = [];
      for (const item of (data.items || [])) {
        const id = item.category3Id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        categories.push({
          id: String(id),
          name: item.category3 || item.category2 || item.category1 || String(id),
          path: [item.category1, item.category2, item.category3].filter(Boolean).join(' > ') || String(id)
        });
      }
      categories.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      sendResponse({ success: true, categories });
    })
    .catch(e => { sendResponse({ success: false, error: e.message }); });
  }

  // 批量获取商品 what_to_sell/data/v3
  function handleBulkProducts(request, sendResponse) {
    const companyId = getCompanyId();
    console.log('[Seller Bridge] handleBulkProducts called, companyId:', companyId);
    if (!companyId) {
      sendResponse({ success: false, error: 'Failed to get Ozon company ID' });
      return;
    }
    const { offset = 0, limit = 50, categories = [], period = 'monthly', mode = 'hot', sortKey = '', shopId = null } = request;
    console.log('[Seller Bridge] categories received:', categories, 'mode:', mode);

    let finalSortKey = sortKey;
    if (!finalSortKey || finalSortKey === 'default') {
      if (mode === 'newest') {
        finalSortKey = 'appeared_asc';
      } else {
        const sortKeys = ['sum_gmv_desc', 'avg_gmv_desc', 'count_sold_desc', 'views_desc'];
        finalSortKey = sortKeys[Math.floor(Math.random() * sortKeys.length)];
      }
    }

    const finalOffset = mode === 'hot' ? Math.floor(Math.random() * 500) + offset : offset;
    const body = {
      limit: String(limit),
      offset: String(finalOffset),
      filter: {
        stock: 'any_stock',
        period,
        categories: categories.map(id => String(id)),
        ...(shopId ? { shop_id: shopId } : {})
      },
      sort: { key: finalSortKey }
    };
    console.log('[Seller Bridge] Request body:', JSON.stringify(body));

    fetch('https://seller.ozon.ru/api/site/seller-analytics/what_to_sell/data/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-o3-company-id': companyId, 'x-o3-language': 'zh-Hans' },
      body: JSON.stringify(body),
      credentials: 'include'
    })
    .then(resp => {
      console.log('[Seller Bridge] HTTP status:', resp.status);
      if (!resp.ok) return resp.text().then(text => { throw new Error('HTTP ' + resp.status + ': ' + text.substring(0, 200)); });
      return resp.json();
    })
    .then(data => {
      console.log('[Seller Bridge] API response items:', (data.items || []).length, 'totals:', JSON.stringify(data.totals || {}).substring(0, 100));
      sendResponse({ success: true, data: data, items: data.items || [], totals: data.totals || {} });
    })
    .catch(e => { console.error('[Seller Bridge] API error:', e.message); sendResponse({ success: false, error: e.message }); });
  }

  // SKU 查询
  function handleSkuRequest(request, sendResponse) {
    const companyId = getCompanyId();
    if (!companyId) {
      sendResponse({ success: false, error: 'Failed to get company ID' });
      return;
    }
    const { sku } = request;
    fetch('https://seller.ozon.ru/api/site/seller-analytics/what_to_sell/data/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-o3-company-id': companyId, 'x-o3-language': 'zh-Hans' },
      body: JSON.stringify({ limit: '1', offset: '0', filter: { stock: 'any_stock', period: 'monthly', categories: [], sku: sku }, sort: { key: 'sum_gmv_desc' } }),
      credentials: 'include'
    })
    .then(resp => { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
    .then(data => { sendResponse({ success: true, items: data.items || [], totals: data.totals || {} }); })
    .catch(e => { sendResponse({ success: false, error: e.message }); });
  }

  // 1688 图片搜索 via background
  function handleOneBoundImageSearch(request, sendResponse) {
    var imageUrl = request.imageUrl;
    var base64Data = request.base64Data;
    if (!imageUrl && !base64Data) {
      sendResponse({ success: false, error: 'No image data' });
      return;
    }
    var imgParam = base64Data || imageUrl;
    var url = 'https://api-gw.onebound.cn/1688/item_search_img/?key=t3246573992&secret=39922f40&imgid=' + encodeURIComponent(imgParam) + '&lang=cn';
    chrome.runtime.sendMessage({ type: 'ONEBOUND_IMAGE_SEARCH', url: url }, function(resp) {
      if (!resp) { sendResponse({ success: false, error: 'Background script not responding' }); return; }
      if (!resp.success) { sendResponse({ success: false, error: resp.error }); return; }
      var data = resp.data;
      if (data.error_code === '0000') {
        sendResponse({ success: true, items: (data.items && data.items.item) || [], total: (data.items && data.items.item || []).length, error_code: '0000' });
      } else if (data.error_code === '2000') {
        sendResponse({ success: true, items: [], total: 0, error_code: '2000', error: 'No similar products found' });
      } else if (data.error_code === '4005') {
        sendResponse({ success: false, error: 'No permission. Contact OneBound (QQ: 3142401606)' });
      } else {
        sendResponse({ success: false, error: (data.error || '') + (data.reason ? ' (' + data.reason + ')' : ''), error_code: data.error_code });
      }
    });
  }

  // 消息分发
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'OZON_BULK_PRODUCTS') { handleBulkProducts(request, sendResponse); return true; }
    if (request.type === 'OZON_DESC_CATEGORY_TREE') { handleDescriptionCategoryTree(request, sendResponse); return true; }
    if (request.type === 'GET_SELLER_CATEGORIES') { handleGetSellerCategories(request, sendResponse); return true; }
    if (request.type === 'SKU_REQUEST') { handleSkuRequest(request, sendResponse); return true; }
    if (request.type === 'ONEBOUND_IMAGE_SEARCH') { handleOneBoundImageSearch(request, sendResponse); return true; }
    if (request.type === 'PING_TEST') { sendResponse({ pong: true, timestamp: request.timestamp }); return true; }
    return false;
  });

  console.log('[seller-bridge] loaded');
})();
