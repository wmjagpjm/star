// 哨兵 - 智能选品助手
let extractedProducts = [];

// 安全的公式求值器（替代 eval）
function safeEvalFormula(formula, variables) {
  const tokens = tokenize(formula);
  let pos = 0;
  
  function tokenize(expr) {
    const result = [];
    let i = 0;
    while (i < expr.length) {
      if (/\s/.test(expr[i])) { i++; continue; }
      if (expr[i] === '(' || expr[i] === ')') { result.push({type: 'paren', value: expr[i]}); i++; continue; }
      if (expr[i] === '!' && expr[i+1] !== '=') { result.push({type: 'op', value: '!'}); i++; continue; }
      if (expr.slice(i, i+2) === '&&') { result.push({type: 'op', value: '&&'}); i+=2; continue; }
      if (expr.slice(i, i+2) === '||') { result.push({type: 'op', value: '||'}); i+=2; continue; }
      if (expr.slice(i, i+2) === '<=') { result.push({type: 'op', value: '<='}); i+=2; continue; }
      if (expr.slice(i, i+2) === '>=') { result.push({type: 'op', value: '>='}); i+=2; continue; }
      if (expr.slice(i, i+2) === '==') { result.push({type: 'op', value: '=='}); i+=2; continue; }
      if (expr.slice(i, i+2) === '!=') { result.push({type: 'op', value: '!='}); i+=2; continue; }
      if (expr[i] === '<') { result.push({type: 'op', value: '<'}); i++; continue; }
      if (expr[i] === '>') { result.push({type: 'op', value: '>'}); i++; continue; }
      if (/[0-9.]/.test(expr[i])) {
        let num = '';
        while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
        result.push({type: 'num', value: parseFloat(num)});
        continue;
      }
      if (/[a-zA-Z_]/.test(expr[i])) {
        let id = '';
        while (i < expr.length && /[a-zA-Z_0-9]/.test(expr[i])) { id += expr[i]; i++; }
        if (id === 'true') result.push({type: 'bool', value: true});
        else if (id === 'false') result.push({type: 'bool', value: false});
        else result.push({type: 'id', value: id});
        continue;
      }
      throw new Error('未知字符: ' + expr[i]);
    }
    return result;
  }
  
  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }
  
  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'op' && peek().value === '||') {
      consume();
      const right = parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }
  
  function parseAnd() {
    let left = parseComparison();
    while (peek() && peek().type === 'op' && peek().value === '&&') {
      consume();
      const right = parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }
  
  function parseComparison() {
    let left = parseUnary();
    if (peek() && peek().type === 'op' && ['<','<=','>','>=','==','!='].includes(peek().value)) {
      const op = consume().value;
      const right = parseUnary();
      switch(op) {
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        case '==': return left == right;
        case '!=': return left != right;
      }
    }
    return left;
  }
  
  function parseUnary() {
    if (peek() && peek().type === 'op' && peek().value === '!') {
      consume();
      return !parseUnary();
    }
    return parsePrimary();
  }
  
  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('表达式不完整');
    if (t.type === 'paren' && t.value === '(') {
      consume();
      const val = parseOr();
      if (!peek() || peek().value !== ')') throw new Error('缺少右括号');
      consume();
      return val;
    }
    if (t.type === 'num') { consume(); return t.value; }
    if (t.type === 'bool') { consume(); return t.value; }
    if (t.type === 'id') {
      consume();
      if (!(t.value in variables)) throw new Error('未知变量: ' + t.value);
      return variables[t.value];
    }
    throw new Error('意外的标记: ' + JSON.stringify(t));
  }
  
  const result = parseOr();
  if (pos < tokens.length) throw new Error('多余的内容: ' + tokens[pos].value);
  return result;
}

// ============================================================
// 按类目模块初始化 - 支持 3 种输入格式：
//   ① 纯数字 ID:   10515
//   ② slug-id:     posudomoechnye-mashiny-10515   (推荐，避免 Ozon 重定向)
//   ③ 完整 URL:    https://www.ozon.ru/category/posudomoechnye-mashiny-10515/
// ============================================================

/**
 * 解析用户输入的类目条目，返回 { id, slug, path } 或 null
 *   id:   类目数字 ID（例 "10515"）
 *   slug: 类目 URL slug 段（例 "posudomoechnye-mashiny-10515" 或 "-10515" 无 slug 时）
 *   path: 用于拼 URL 的路径片段（等价于 slug，但保证有值）
 */
function parseCategoryEntry(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/^[\s,，]+|[\s,，]+$/g, '');
  if (!s) return null;

  // 格式 ③：完整 URL
  //   https://www.ozon.ru/category/posudomoechnye-mashiny-10515/?sorting=popular
  //   → path = posudomoechnye-mashiny-10515
  const urlMatch = s.match(/ozon\.ru\/category\/([^/?#]+)/i);
  if (urlMatch) {
    const seg = urlMatch[1];
    const idMatch = seg.match(/-(\d+)$/) || seg.match(/^(\d+)$/);
    if (idMatch) return { id: idMatch[1], slug: seg, path: seg };
    return null;
  }

  // 格式 ②：slug-id，形如 posudomoechnye-mashiny-10515
  const slugIdMatch = s.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d+)$/i);
  if (slugIdMatch) {
    return { id: slugIdMatch[2], slug: s, path: s };
  }

  // 格式 ①：纯数字 ID
  if (/^\d+$/.test(s)) {
    // 用 /-<id>/ 形式，Ozon 会自动重定向；虽然绝对能解析，但新代码会等待重定向稳定
    return { id: s, slug: '-' + s, path: '-' + s };
  }

  return null;
}

function initCategoryModule(callbacks) {
  // callbacks = { showStatus, renderResults }（由 DOMContentLoaded 注入）
  const _showStatus = (callbacks && callbacks.showStatus) || function(msg, t) { console.log('[catModule]', t, msg); };
  const _renderResults = (callbacks && callbacks.renderResults) || function(p) { console.log('[catModule] products:', p.length); };
  // 覆盖模块内 showStatus/renderResults 引用
  // （用局部变量代替，避免 let showStatus = ... 覆盖全局）

  const categoryIdsInput = document.getElementById('categoryIds');

  // 快选按钮（data-id 现在是 slug-id，例如 posudomoechnye-mashiny-10515）
  document.querySelectorAll('.cat-quick-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.dataset.id;
      const name = this.dataset.name;
      const existing = (categoryIdsInput.value || '').trim();
      const ids = existing ? existing.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
      if (!ids.includes(id)) {
        ids.push(id);
        categoryIdsInput.value = ids.join(', ');
      }
      _showStatus('已选: ' + name + ' (' + id + ')', 'success');
    });
  });

  // ============================================================
  // 核心：批量抓取类目商品
  // ============================================================
  const searchBtn = document.getElementById('ozonPublicSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', async function() {
      const rawInput = (categoryIdsInput ? categoryIdsInput.value : '').trim();
      if (!rawInput) {
        _showStatus('请输入类目 ID / slug-id / URL', 'error');
        return;
      }

      // 按逗号分隔后逐项解析（支持 ID / slug-id / 完整 URL 混用）
      const entries = rawInput
        .split(/[,，\n]+/)
        .map(s => parseCategoryEntry(s))
        .filter(Boolean);

      if (entries.length === 0) {
        _showStatus('输入格式不正确。请填写纯数字 ID、slug-id（如 holodilniki-10502）或完整 URL', 'error');
        return;
      }

      const limitEl = document.getElementById('catMaxCount');
      const sortEl = document.getElementById('catSortBy');
      const maxItems = limitEl ? parseInt(limitEl.value) : 100;
      const sortMode = sortEl ? sortEl.value : 'popular';

      // 进度条
      const progressBar = document.getElementById('catProgressBar');
      const progressFill = document.getElementById('catProgressFill');
      const progressText = document.getElementById('catProgressText');
      const setProgress = (pct, text) => {
        if (progressBar) progressBar.style.display = 'block';
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressText) { progressText.style.display = 'block'; progressText.textContent = text; }
      };

      searchBtn.disabled = true;
      searchBtn.textContent = '⏳ 正在抓取...';
      setProgress(5, '准备中...');
      _showStatus('开始抓取 ' + entries.length + ' 个类目商品...', 'loading');

      let allProducts = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const catId = entry.id;
        const pctBase = Math.round((i / entries.length) * 90);
        setProgress(pctBase + 5, '正在打开类目 ' + catId + ' (' + (i + 1) + '/' + entries.length + ')...');

        try {
          // 直接跳到 slug-id 终点 URL；纯 ID 情况下用 /-<id>/ 并在下面等待重定向稳定
          const url = 'https://www.ozon.ru/category/' + entry.path + '/?sorting=' + sortMode;

          // 打开或复用已有 tab（必须激活标签页，否则滚动加载无法触发）
          let tab = null;
          const existingTabs = await chrome.tabs.query({ url: '*://www.ozon.ru/category/*' });
          if (existingTabs.length > 0) {
            tab = existingTabs[0];
            await chrome.tabs.update(tab.id, { url: url, active: true });
          } else {
            tab = await chrome.tabs.create({ url: url, active: true });
          }

          // 等待 tab URL 稳定（处理 Ozon 自动重定向），再等 status=complete
          //   轮询 tab.url：连续 1s 不变即认为重定向结束
          const finalUrl = await waitForTabUrlStable(tab.id, 15000, 1000);
          console.log('[CategoryScraper] 类目', catId, '最终 URL:', finalUrl);

          // 再等一次 complete（兜底）
          await waitForTabComplete(tab.id, 5000);

          // 额外等待 JS 渲染
          await new Promise(r => setTimeout(r, 1500));

          setProgress(pctBase + 15, '正在抓取类目 ' + catId + ' 商品列表...');

          // 发消息给 content script
          const resp = await new Promise((resolve) => {
            const tid = setTimeout(() => resolve({ success: false, error: 'content script 超时未响应' }), 60000);
            chrome.tabs.sendMessage(tab.id, {
              type: 'SCRAPE_CATEGORY_PAGE',
              categoryId: catId,
              maxItems: maxItems,
              sortMode: sortMode
            }, (r) => {
              clearTimeout(tid);
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(r || { success: false, error: '无响应' });
              }
            });
          });

          if (resp && resp.success && resp.products && resp.products.length > 0) {
            allProducts = allProducts.concat(resp.products);
            setProgress(pctBase + 20, '类目 ' + catId + ' 获取 ' + resp.products.length + ' 个商品');
          } else {
            const errMsg = resp ? resp.error : '无响应';
            _showStatus('类目 ' + catId + ' 抓取失败: ' + errMsg, 'error');
            console.warn('[CategoryScraper] 类目', catId, '失败:', errMsg);
          }
        } catch (err) {
          _showStatus('类目 ' + catId + ' 发生错误: ' + err.message, 'error');
          console.error('[CategoryScraper] 类目', catId, '错误:', err);
        }
      }

      // 完成
      setProgress(100, '抓取完成！共 ' + allProducts.length + ' 个商品');
      searchBtn.disabled = false;
      searchBtn.textContent = '🚀 批量抓取该类目商品';

      if (allProducts.length > 0) {
        _showStatus('✅ 成功抓取 ' + allProducts.length + ' 个商品', 'success');
        _renderResults(allProducts);
      } else {
        _showStatus('未获取到任何商品，请检查类目 ID 是否正确或确认页面可以访问', 'error');
      }
    });
  }
}

// 等待指定 tab 的 URL 稳定（连续 stableMs 毫秒不再变化），处理 Ozon 301/302 重定向链
// 返回最终稳定的 URL。超时则返回当前 URL
function waitForTabUrlStable(tabId, timeoutMs, stableMs) {
  return new Promise((resolve) => {
    const startTs = Date.now();
    let lastUrl = '';
    let lastChangeTs = Date.now();

    const tick = async () => {
      try {
        const t = await chrome.tabs.get(tabId);
        const url = t && t.url ? t.url : '';
        if (url !== lastUrl) {
          lastUrl = url;
          lastChangeTs = Date.now();
        }
        const stable = Date.now() - lastChangeTs >= stableMs;
        const timedOut = Date.now() - startTs >= timeoutMs;
        if ((stable && lastUrl) || timedOut) {
          resolve(lastUrl);
          return;
        }
      } catch (e) {
        // tab 可能暂时不可访问，继续轮询
      }
      setTimeout(tick, 200);
    };
    tick();
  });
}

// 等待指定 tab 的 status=complete，超时也 resolve
function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        finish();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    // 立刻检查一次当前状态
    chrome.tabs.get(tabId).then(t => {
      if (t && t.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        finish();
      }
    }).catch(() => {});
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      finish();
    }, timeoutMs);
  });
}

// （保留空函数以防历史引用）
function initCategoryTree() { initCategoryModule(); }
function buildTreeOptions(selectEl, treeData) {
  // 旧接口保留，已不使用
  if (!selectEl) return;
  void treeData;
  selectEl.innerHTML = '<option value="">-- 已停用 --</option>';
}

document.addEventListener('DOMContentLoaded', function() {
  const pickProductsBtn = document.getElementById('pickProducts');
  const bulkFetchBtn = document.getElementById('bulkFetch');
  const exportResultsBtn = document.getElementById('exportResults');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  const formulaInput = document.getElementById('formula');
  const sellerStatusDiv = document.getElementById('sellerStatus');

  // 显示状态
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }

  // 统一的结果渲染函数（前向声明引用，实际定义在下方，但 function 会被 hoisted）
  // 初始化按类目模块（注入 showStatus / renderResults 回调，避免作用域问题）
  initCategoryModule({
    showStatus: showStatus,
    renderResults: function(p) {
      // 将类目抓取的字段归一化为与批量获取一致的格式
      extractedProducts = p.map(item => ({
        id:             item.id || item.sku || item.product_id || '',
        title:          item.title || item.name || '',
        platform:       'Ozon',
        cardPrice:      item.cardPrice || item.discountPrice || '',
        discountPrice:  item.discountPrice || item.cardPrice || '',
        bestSellerPrice:'',
        promoPrice:     '-',
        avgPriceRub:    item.price ? String(Math.round(item.price)) : '',
        isFBS:          false,
        salesSchema:    '-',
        url:            item.url || '',
        soldSum:        '-',
        soldCount:      '-',
        views:          '-',
        brand:          '-',
        category:       '-',
        rating:         item.rating  || '',
        comments:       item.reviewCount || '',
        mainImage:      item.imageUrl || item.image || '',
        weight:         '',
        dimensions:     '',
        delivery:       ''
      }));
      exportResultsBtn.disabled = extractedProducts.length === 0;
      // 显示右下角「导出」小链接
      const catExportLink = document.getElementById('catExportLink');
      if (catExportLink) catExportLink.style.display = 'inline';
      renderResults(extractedProducts);
      // 补全价格/品牌/重量/尺寸/配送等详情
      //   - 按用户选择的"抓取数量"为上限（#catMaxCount: 50/100/200/500）
      //   - skipFilter=true：类目模式不强制要求有低价推荐才保留（类目页本就只卖某些价格区间）
      const catMaxEl = document.getElementById('catMaxCount');
      const catMax = catMaxEl ? Math.min(parseInt(catMaxEl.value, 10) || 100, extractedProducts.length) : extractedProducts.length;
      fetchRealTimePrices(null, true, catMax).then(() => {
        const catExportLink2 = document.getElementById('catExportLink');
        if (catExportLink2) catExportLink2.style.display = 'inline';
      });
    }
  });
  
  // 检测 seller.ozon.ru 是否打开
  function checkSellerTab() {
    chrome.runtime.sendMessage({ type: 'CHECK_SELLER_TAB' }, (resp) => {
      if (resp && resp.hasSellerTab) {
        sellerStatusDiv.style.display = 'block';
        sellerStatusDiv.style.background = '#d4edda';
        sellerStatusDiv.style.color = '#155724';
        sellerStatusDiv.textContent = '✅ 已连接 seller.ozon.ru，可使用批量获取';
        bulkFetchBtn.disabled = false;
      } else {
        sellerStatusDiv.style.display = 'block';
        sellerStatusDiv.style.background = '#fff3cd';
        sellerStatusDiv.style.color = '#856404';
        sellerStatusDiv.textContent = '⚠️ 请先打开 seller.ozon.ru 并登录，才能使用批量获取';
        bulkFetchBtn.disabled = true;
      }
    });
  }
  checkSellerTab();

  // 选品模式切换
  let currentMode = 'hot';
  const modeTabs = document.querySelectorAll('#modeTabs .mode-tab');
  const categoryModePanel = document.getElementById('categoryModePanel');
  const shopModePanel = document.getElementById('shopModePanel');
  modeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      modeTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentMode = this.dataset.mode;
      categoryModePanel.style.display = currentMode === 'category' ? 'block' : 'none';
      shopModePanel.style.display = currentMode === 'shop' ? 'block' : 'none';
    });
  });

  // 读取所有筛选条件
  function getFilters() {
    function val(id) {
      const el = document.getElementById(id);
      return el ? parseFloat(el.value) || null : null;
    }
    return {
      priceMin: val('filterPriceMin'),
      priceMax: val('filterPriceMax'),
      salesMin: val('filterSalesMin'),
      salesMax: val('filterSalesMax'),
      gmvMin:   val('filterGmvMin'),
      gmvMax:   val('filterGmvMax')
    };
  }

  // 应用筛选条件
  function applyFilters(products, filters) {
    return products.filter(p => {
      // 价格区间（用 avgPriceRub）
      const price = parseFloat(p.avgPriceRub) || 0;
      if (filters.priceMin !== null && price > 0 && price < filters.priceMin) return false;
      if (filters.priceMax !== null && price > 0 && price > filters.priceMax) return false;

      // 销量
      const sales = parseFloat(p.soldCount) || 0;
      if (filters.salesMin !== null && sales < filters.salesMin) return false;
      if (filters.salesMax !== null && sales > filters.salesMax) return false;

      // 销售额
      const gmv = parseFloat(p.soldSum) || 0;
      if (filters.gmvMin !== null && gmv < filters.gmvMin) return false;
      if (filters.gmvMax !== null && gmv > filters.gmvMax) return false;

      return true;
    });
  }
  // （fetchCategoryBtn 和旧 ozonPublicSearchBtn 监听器已迁移到 initCategoryModule，此处已清理）


// 批量获取商品
  bulkFetchBtn.addEventListener('click', async function() {
    const modeLabel = currentMode === 'hot' ? '热销榜单' : currentMode === 'newest' ? '最新上架' : currentMode === 'shop' ? '店铺商品' : '按类目';
    showStatus(`正在从 seller.ozon.ru 获取「${modeLabel}」数据...`, 'loading');
    resultsDiv.innerHTML = '<div class="empty-state">正在连接 seller API...</div>';
    bulkFetchBtn.disabled = true;
    
    try {
      // 查店铺模式：先从 ozon.ru 店铺页面抓取商品ID列表
      if (currentMode === 'shop') {
        const shopInput = (document.getElementById('shopId').value || '').trim();
        if (!shopInput) {
          showStatus('❌ 请输入店铺 ID 或链接', 'error');
          bulkFetchBtn.disabled = false;
          return;
        }
        
        // 提取店铺ID
        let shopId = shopInput;
        const urlMatch = shopInput.match(/seller\/(\d+)/);
        if (urlMatch) shopId = urlMatch[1];
        
        showStatus(`正在抓取店铺 ${shopId} 的商品列表...`, 'loading');
        
        // 查找或打开 ozon.ru 页面
        let ozonTabs = await chrome.tabs.query({ url: '*://*.ozon.ru/*' });
        let ozonTab = ozonTabs.find(t => t.url && !t.url.includes('seller.ozon.ru'));
        
        if (!ozonTab) {
          // 打开新标签页
          ozonTab = await chrome.tabs.create({ url: `https://www.ozon.ru/seller/${shopId}/`, active: false });
          await new Promise(r => setTimeout(r, 3000)); // 等待页面加载
        } else {
          // 导航到店铺页面
          await chrome.tabs.update(ozonTab.id, { url: `https://www.ozon.ru/seller/${shopId}/` });
          await new Promise(r => setTimeout(r, 3000));
        }
        
        // 从店铺页面提取商品ID
        const shopResults = await chrome.scripting.executeScript({
          target: { tabId: ozonTab.id },
          func: () => {
            const productLinks = document.querySelectorAll('a[href*="/product/"]');
            const skus = [];
            const seen = new Set();
            productLinks.forEach(link => {
              const match = link.href.match(/-(\d+)\/$/) || link.href.match(/\/(\d+)\/$/);
              if (match && match[1] && !seen.has(match[1])) {
                seen.add(match[1]);
                skus.push(match[1]);
              }
            });
            return skus;
          }
        });
        
        const shopSkus = shopResults && shopResults[0] && shopResults[0].result;
        if (!shopSkus || shopSkus.length === 0) {
          showStatus('❌ 未能从店铺页面提取到商品，请确认店铺ID正确', 'error');
          bulkFetchBtn.disabled = false;
          return;
        }
        
        showStatus(`已提取 ${shopSkus.length} 个商品ID，正在获取详细数据...`, 'loading');
        
        // 通过 seller API 批量查询这些商品的销售数据
        const [sellerTab] = await chrome.tabs.query({ url: '*://seller.ozon.ru/*' });
        if (!sellerTab || !sellerTab.id) {
          showStatus('❌ 请先打开 seller.ozon.ru 并登录', 'error');
          bulkFetchBtn.disabled = false;
          return;
        }
        
        let allItems = [];
        // 分批查询（每次10个SKU）
        for (let i = 0; i < shopSkus.length; i += 10) {
          const batch = shopSkus.slice(i, i + 10);
          showStatus(`正在查询第 ${i + 1}-${Math.min(i + 10, shopSkus.length)} 个商品...`, 'loading');
          
          for (const sku of batch) {
            const resp = await new Promise((resolve) => {
              chrome.tabs.sendMessage(sellerTab.id, {
                type: 'OZON_SKU_API_REQUEST',
                sku: sku,
                apiType: 'sales'
              }, resolve);
            });
            
            if (resp && resp.success && resp.data) {
              const items = resp.data.items || resp.data.result?.items || [];
              allItems = allItems.concat(items);
            }
            
            await new Promise(r => setTimeout(r, 200)); // 避免请求过快
          }
        }
        
        if (allItems.length === 0) {
          showStatus('❌ 未获取到商品数据', 'error');
          bulkFetchBtn.disabled = false;
          return;
        }
        
        // 转换为统一格式 + 去重
        const seenIds = new Set();
        extractedProducts = [];
        for (const item of allItems) {
          const sku = String(item.sku || item.product_id || item.id || '');
          if (!sku || seenIds.has(sku)) continue;
          seenIds.add(sku);
          
          const title = item.name || item.skuName || item.title || '未知商品';
          const avgPrice = item.avgPrice || item.avgGmv || 0;
          
          // 只保留纯 FBS 发货
          const salesSchema = (item.salesSchema || '').toUpperCase();
          const sources = (item.sources || []).map(s => s.toUpperCase());
          const isFBS = salesSchema === 'FBS' || (sources.length === 1 && sources[0] === 'FBS');
          if (!isFBS) continue;
          
          // 过滤无价格商品
          if (!avgPrice || avgPrice <= 0) continue;
          
          extractedProducts.push({
            id: sku,
            title: title,
            platform: 'Ozon',
            discountPrice: '',
            promoPrice: '-',
            avgPriceRub: String(Math.round(avgPrice)),
            isFBS: true,
            salesSchema: salesSchema || 'FBS',
            url: item.link || `https://www.ozon.ru/product/${sku}/`,
            soldSum: item.soldSum || '-',
            soldCount: item.soldCount || '-',
            views: item.views || '-',
            brand: item.brand || '-',
            category: item.category1 ? `${item.category1}/${item.category3 || ''}` : '-'
          });
        }
        
        const fbsCount = extractedProducts.length;
        const filters = getFilters();
        extractedProducts = applyFilters(extractedProducts, filters);
        
        showStatus(`✅ 店铺共 ${allItems.length} 个商品→ FBS纯发货 ${fbsCount} 个→ 筛选后 ${extractedProducts.length} 个，正在验证商品状态...`, 'loading');
        exportResultsBtn.disabled = extractedProducts.length === 0;
        
        // 先显示结果（无价格）
        renderResults(extractedProducts);
        
        // 获取实时价格（复用现有逻辑）
        await fetchRealTimePrices(ozonTab.id);
        
        bulkFetchBtn.disabled = false;
        checkSellerTab();
        return;
      }
      
      // 其他模式：通过 seller API 直接获取
      const [sellerTab] = await chrome.tabs.query({ url: '*://seller.ozon.ru/*' });
      if (!sellerTab || !sellerTab.id) {
        showStatus('❌ 请先打开 seller.ozon.ru 并登录', 'error');
        bulkFetchBtn.disabled = false;
        return;
      }
      
      // 根据模式构建请求参数
      let categories = [];
      if (currentMode === 'category') {
        const catInput = (document.getElementById('categoryIds').value || '').trim();
        if (catInput) {
          categories = catInput.split(',').map(c => parseInt(c.trim())).filter(n => !isNaN(n));
        }
      }
      
      // 根据模式选择排序方式
      let sortKey = '';
      if (currentMode === 'newest') {
        sortKey = 'appeared_asc'; // 最新上架
      } else if (currentMode === 'hot') {
        sortKey = ''; // 热销用随机排序（seller-bridge 处理）
      }
      
      // 循环获取，直到达到50个有低价推荐的商品
      const targetCount = 50; // 目标数量
      const maxItems = 1000; // 最多获取1000个原始数据
      let allItems = [];
      let offset = 0;
      const batchSize = 50;
      
      while (offset < maxItems) {
        showStatus(`正在获取第 ${offset + 1}-${offset + batchSize} 条数据...`, 'loading');
        
        const resp = await new Promise((resolve, reject) => {
          const tid = setTimeout(() => reject(new Error('seller tab timeout (10s) - content script not responding')), 10000);
          chrome.tabs.sendMessage(sellerTab.id, {
            type: 'OZON_BULK_PRODUCTS',
            offset: offset,
            limit: batchSize,
            period: 'monthly',
            mode: currentMode,
            sortKey: sortKey,
            categories: categories
          }, (r) => { clearTimeout(tid); if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(r); });
        });
        
        if (!resp || !resp.success) {
          if (offset === 0) {
            showStatus('❌ 获取失败: ' + (resp?.error || '未知错误，请确认已登录seller.ozon.ru'), 'error');
            bulkFetchBtn.disabled = false;
            return;
          }
          break; // 已获取了部分数据
        }
        
        const items = resp.data?.items || resp.data?.result?.items || [];
        if (items.length === 0) break;
        
        allItems = allItems.concat(items);
        offset += batchSize;
        
        if (items.length < batchSize) break; // 没有更多数据
      }
      
      if (allItems.length === 0) {
        showStatus('❌ 未获取到商品数据', 'error');
        bulkFetchBtn.disabled = false;
        return;
      }
      
      // 转换为统一格式 + 去重
      const seenIds = new Set();
      extractedProducts = [];
      for (const item of allItems) {
        const sku = String(item.sku || item.product_id || item.id || '');
        if (!sku || seenIds.has(sku)) continue;
        seenIds.add(sku);
        
        const title = item.name || item.skuName || item.title || '未知商品';
        const avgPrice = item.avgPrice || item.avgGmv || 0;
        
        // 只保留纯 FBS 发货
        const salesSchema = (item.salesSchema || '').toUpperCase();
        const sources = (item.sources || []).map(s => s.toUpperCase());
        const isFBS = salesSchema === 'FBS' || (sources.length === 1 && sources[0] === 'FBS');
        if (!isFBS) continue;
        
        // 过滤无价格商品
        if (!avgPrice || avgPrice <= 0) continue;
        
        extractedProducts.push({
          id: sku,
          title: title,
          platform: 'Ozon',
          discountPrice: '',
          promoPrice: '-',
          avgPriceRub: String(Math.round(avgPrice)),
          isFBS: true,
          salesSchema: salesSchema || 'FBS',
          url: item.link || `https://www.ozon.ru/product/${sku}/`,
          soldSum: item.soldSum || '-',
          soldCount: item.soldCount || '-',
          views: item.views || '-',
          brand: item.brand || '-',
          category: item.category1 ? `${item.category1}/${item.category3 || ''}` : '-'
        });
      }
      
      const fbsCount = extractedProducts.length;
      const filters = getFilters();
      extractedProducts = applyFilters(extractedProducts, filters);
      
      showStatus(`✅ 获取 ${allItems.length} 个→ FBS纯发货 ${fbsCount} 个→ 筛选后 ${extractedProducts.length} 个，正在获取实时价格...`, 'loading');
      exportResultsBtn.disabled = extractedProducts.length === 0;
      
      // 先显示结果（无价格）
      renderResults(extractedProducts);
      
      // 获取实时价格（提取为独立函数）
      await fetchRealTimePrices();
      
    } catch (error) {
      showStatus('❌ 错误: ' + error.message, 'error');
    }
    bulkFetchBtn.disabled = false;
    checkSellerTab();
  });
  
  // 获取实时价格的独立函数
  //   maxDetailFetch:
  //     undefined → 默认 50（批量获取模式）
  //     number    → 按类目等需要更多详情的场景，由调用方指定（上限 500 防止过慢 / 触发限流）
  async function fetchRealTimePrices(targetTabId = null, skipFilter = false, maxDetailFetch = 50) {
    try {
      // 限制：最多补全 500 条详情（Ozon 限流保护）
      const detailLimit = Math.min(Math.max(1, maxDetailFetch | 0), 500);
      const skus = extractedProducts.map(p => p.id).slice(0, detailLimit);
      // 查找任何 ozon.ru 页面（排除 seller）
      const ozonTabs = await chrome.tabs.query({ url: '*://*.ozon.ru/*' });
      const ozonTab = targetTabId ? ozonTabs.find(t => t.id === targetTabId) : ozonTabs.find(t => t.url && !t.url.includes('seller.ozon.ru'));
      
      if (ozonTab && ozonTab.id) {
        showStatus(`正在获取 ${skus.length} 个商品的详细信息（价格/重量/尺寸）...`, 'loading');
          
          console.log('[Price Fetch] 开始获取价格，商品数量:', skus.length);
          console.log('[Price Fetch] 商品ID列表:', skus);
          
          const results = await chrome.scripting.executeScript({
            target: { tabId: ozonTab.id },
            func: async (skuList) => {
              console.log('[Price API] 开始处理', skuList.length, '个商品');
              const resultMap = {};
              
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
                } catch(e) { return texts; }
              }
              
              // 获取价格和标题
              for (let i = 0; i < skuList.length; i += 5) {
                const batch = skuList.slice(i, i + 5);
                const promises = batch.map(async (sku) => {
                  try {
                    const url = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/product/${sku}`;
                    console.log('[Price API] 请求:', url);
                    const resp = await fetch(url, { 
                      headers: { 'Accept': 'application/json' }, 
                      credentials: 'include' 
                    });
                    if (!resp.ok) {
                      console.warn('[Price API] 请求失败:', sku, resp.status);
                      return;
                    }
                    const data = await resp.json();
                    const states = data.widgetStates || {};
                    const info = {};
                    for (const [key, val] of Object.entries(states)) {
                      // 提取价格（改进：尝试所有 webPrice widget，提取更多字段）
                      if (key.startsWith('webPrice-') && !key.includes('Stars')) {
                        try {
                          const obj = typeof val === 'string' ? JSON.parse(val) : val;
                          // 提取银行卡价格
                          if (!info.cardPrice && obj.cardPrice) {
                            info.cardPrice = obj.cardPrice;
                          }
                          // 提取平台折扣价
                          if (!info.price && obj.price) {
                            info.price = obj.price;
                          }
                          // 备选：从 originalPrice 提取
                          if (!info.price && obj.originalPrice) {
                            info.price = obj.originalPrice;
                          }
                          // 备选：从 currentPrice 提取
                          if (!info.price && obj.currentPrice) {
                            info.price = obj.currentPrice;
                          }
                          // 调试日志
                          console.log('[Price API] webPrice widget:', key, obj);
                        } catch(e) {
                          console.error('[Price API] 解析 webPrice 失败:', key, e);
                        }
                      }
                      // 提取低价推荐（改进：添加更多提取路径和调试日志）
                      if (key.startsWith('webBestSeller-') && !info.bestSellerPrice) {
                        try {
                          const obj = typeof val === 'string' ? JSON.parse(val) : val;
                          console.log('[Price API] webBestSeller widget:', key, obj);
                          
                          // 方法1：从 textRs 数组中提取
                          const priceItem = (obj.textRs || []).find(t => t.type === 'textMediumBold');
                          if (priceItem && priceItem.content) {
                            info.bestSellerPrice = priceItem.content;
                          }
                          
                          // 方法2：从 price 字段提取
                          if (!info.bestSellerPrice && obj.price) {
                            info.bestSellerPrice = obj.price;
                          }
                          
                          // 方法3：从 text 字段提取
                          if (!info.bestSellerPrice && obj.text) {
                            info.bestSellerPrice = obj.text;
                          }
                          
                          // 方法4：从 title 字段提取（可能包含价格）
                          if (!info.bestSellerPrice && obj.title) {
                            const priceMatch = obj.title.match(/([\d\s,]+[,.]\d+\s*₽)/);
                            if (priceMatch) info.bestSellerPrice = priceMatch[1];
                          }
                        } catch(e) {
                          console.error('[Price API] 解析 webBestSeller 失败:', key, e);
                        }
                      }
                      // 提取标题 + 品牌
                      if (key.startsWith('webProductHeading') && !info.title) {
                        try {
                          const obj = typeof val === 'string' ? JSON.parse(val) : val;
                          info.title = obj.title || '';
                          if (!info.brand && obj.brand) info.brand = obj.brand;
                        } catch(e) {}
                      }
                      // 品牌备选：webBrand widget
                      if (key.startsWith('webBrand') && !info.brand) {
                        try {
                          const obj = typeof val === 'string' ? JSON.parse(val) : val;
                          info.brand = obj.name || obj.brand || obj.title || '';
                        } catch(e) {}
                      }
                      // 提取主图
                      if (key.startsWith('webGallery') && !info.mainImage) {
                        try {
                          const obj = typeof val === 'string' ? JSON.parse(val) : val;
                          const covers = obj.coverImage || obj.images || obj.covers || [];
                          if (Array.isArray(covers) && covers.length > 0) {
                            info.mainImage = covers[0].src || covers[0].url || covers[0];
                          } else if (obj.coverImage && typeof obj.coverImage === 'string') {
                            info.mainImage = obj.coverImage;
                          }
                        } catch(e) {}
                      }
                      // 提取商品规格 —— 按类目自适应抓取所有特征维度
                      //   1. info.specs: 保留全部原始 key→value，类目无关
                      //   2. 按规则归一化到命名字段（weight / size / color / material / ...）
                      //   3. 每个命名字段只接受第一次命中的值；规则按优先级排序（更具体的正则在前）
                      if (key.startsWith('webShortCharacteristics') || key.startsWith('webCharacteristics')) {
                        try {
                          const obj = typeof val === 'string' ? JSON.parse(val) : val;
                          const chars = obj.characteristics || obj.shortCharacteristics || [];
                          info.specs = info.specs || {};
                          // 规则顺序很关键：先匹配更具体的（"размер упаковки" → dimensions），
                          // 否则会被通用的 "размер" → size 抢先吃掉
                          const SPEC_RULES = [
                            ['weight',     /(^|\b)(вес|масса|weight|net\s*weight|重量|净重|毛重)(\b|$)/i],
                            ['dimensions', /(габарит|размер\s*упаковки|размеры\s*товара|dimension|尺寸|规格|外形)/i],
                            ['volume',     /(^|\b)(объ[её]м|capacity|volume|容量|净含量|容积)(\b|$)/i],
                            ['power',      /(^|\b)(мощность|wattage|power|功率)(\b|$)/i],
                            ['material',   /(^|\b)(материал|состав|material|composition|fabric|面料|材质|成分)(\b|$)/i],
                            ['color',      /(^|\b)(цвет|colou?r|颜色|色彩|色调)(\b|$)/i],
                            ['size',       /(^|\b)(размер|size|尺码|码数|鞋码|服装尺码)(\b|$)/i],
                            ['shelfLife',  /(срок\s*годности|срок\s*хранения|shelf\s*life|expir|保质期|保存期)/i],
                            ['origin',     /(страна[\s-]*производ|country\s*of\s*origin|производство|made\s*in|产地|原产国)/i],
                            ['season',     /(^|\b)(сезон|season|季节|季)(\b|$)/i],
                            ['ageGroup',   /(возраст|age\s*group|适用年龄|年龄段)/i],
                            ['brandOrig',  /(бренд|brand|торговая\s*марка|品牌)/i], // 备用，常已从 webBrand 拿到
                            ['model',      /(^|\b)(модель|model|型号)(\b|$)/i],
                          ];
                          for (const group of chars) {
                            const items = group.short || group.characteristics || [];
                            for (const ch of items) {
                              const rawKey = String(ch.key || ch.name || '').trim();
                              if (!rawKey) continue;
                              const v = ch.value || (ch.values && ch.values[0] && ch.values[0].text) || '';
                              if (!v) continue;
                              // 1) 全量保留
                              if (!info.specs[rawKey]) info.specs[rawKey] = String(v);
                              // 2) 归一化
                              const keyLower = rawKey.toLowerCase();
                              for (const [field, re] of SPEC_RULES) {
                                if (!info[field] && re.test(keyLower)) {
                                  info[field] = String(v);
                                  break;
                                }
                              }
                            }
                          }
                        } catch(e) { console.warn('[Price API] 解析规格失败:', key, e); }
                      }
                      // 提取配送方式
                      if (key.startsWith('webDelivery') && !info.delivery) {
                        try {
                          const obj = typeof val === 'string' ? JSON.parse(val) : val;
                          const parts = [];
                          if (obj.deliveryText) parts.push(obj.deliveryText);
                          if (obj.courierText) parts.push(obj.courierText);
                          if (obj.pickupText) parts.push(obj.pickupText);
                          if (obj.title) parts.push(obj.title);
                          if (parts.length) info.delivery = parts.join(' | ');
                        } catch(e) {}
                      }
                    }
                    if (info.cardPrice || info.price || info.title || info.mainImage) {
                      console.log('[Price API] 成功获取商品信息:', sku, info);
                      resultMap[sku] = info;
                    } else {
                      console.warn('[Price API] 商品信息不完整:', sku, info);
                    }
                  } catch(e) {
                    console.error('[Price API] 处理商品出错:', sku, e);
                  }
                });
                await Promise.all(promises);
                if (i + 5 < skuList.length) await new Promise(r => setTimeout(r, 300));
              }
              
              // 批量翻译所有标题为中文（每次20个一组）
              const skusWithTitle = Object.entries(resultMap).filter(([k, v]) => v.title);
              for (let i = 0; i < skusWithTitle.length; i += 20) {
                const batch = skusWithTitle.slice(i, i + 20);
                const titles = batch.map(([k, v]) => v.title);
                try {
                  const zhTitles = await translateToZh(titles);
                  batch.forEach(([sku], idx) => {
                    if (zhTitles[idx]) resultMap[sku].titleZh = zhTitles[idx];
                  });
                } catch(e) {}
              }
              
              console.log('[Price API] 完成，成功获取', Object.keys(resultMap).length, '个商品信息');
              console.log('[Price API] 结果:', resultMap);
              return resultMap;
            },
            args: [skus]
          });
          
          console.log('[Price Fetch] 脚本执行结果:', results);
          console.log('[Price Fetch] results 类型:', typeof results);
          console.log('[Price Fetch] results 是否为数组:', Array.isArray(results));
          console.log('[Price Fetch] results.length:', results ? results.length : 'undefined');
          console.log('[Price Fetch] results[0]:', results && results[0]);
          console.log('[Price Fetch] results[0].result:', results && results[0] && results[0].result);
          
          const priceData = results && results[0] && results[0].result;
          console.log('[Price Fetch] 价格数据:', priceData);
          console.log('[Price Fetch] 价格数据类型:', typeof priceData);
          console.log('[Price Fetch] 数据条数:', priceData ? Object.keys(priceData).length : 0);
          
          if (priceData && Object.keys(priceData).length > 0) {
            // 过滤已下架和无价格商品，去除重复
            const validProducts = [];
            const seenPriceIds = new Set();
            extractedProducts.forEach(product => {
              const info = priceData[product.id];
              if (info) {
                product.cardPrice = info.cardPrice || '';
                product.discountPrice = info.price || '';
                product.bestSellerPrice = info.bestSellerPrice || '';
                if (info.titleZh) product.title = info.titleZh;
                if (info.mainImage) product.mainImage = info.mainImage;
                // 归一化规格字段（只有在 info 里命中才覆盖，保留原值）
                const SPEC_FIELDS = ['weight','dimensions','volume','power','material','color','size','shelfLife','origin','season','ageGroup','model'];
                for (const f of SPEC_FIELDS) {
                  if (info[f]) product[f] = info[f];
                }
                if (info.specs && Object.keys(info.specs).length) product.specs = info.specs;
                if (info.delivery) {
                  product.delivery = info.delivery;
                  product.isFBS = /FBS|Ozon\s*доставка|Продавец\s*хранит/i.test(info.delivery);
                  product.salesSchema = product.isFBS ? 'FBS' : 'FBO';
                }
                if (info.brand) product.brand = info.brand;
              }
              // 过滤：skipFilter=true 时（类目模式）只去重，不强制要求低价推荐
              if (!skipFilter && !product.bestSellerPrice) return; // 批量模式必须有低价推荐
              const hasPrice = product.cardPrice || product.discountPrice || product.bestSellerPrice;
              if (!hasPrice) return;
              if (seenPriceIds.has(product.id)) return;
              
              // 排除电脑和手机类商品
              const title = (product.title || '').toLowerCase();
              const category = (product.category || '').toLowerCase();
              const excludeKeywords = ['电脑', '笔记本', '台式机', 'laptop', 'computer', 'pc', '手机', 'phone', 'iphone', 'smartphone', '平板', 'tablet', 'ipad'];
              const shouldExclude = excludeKeywords.some(keyword => 
                title.includes(keyword) || category.includes(keyword)
              );
              if (shouldExclude) return;
              
              seenPriceIds.add(product.id);
              validProducts.push(product);
            });
            extractedProducts = validProducts.slice(0, detailLimit); // 批量模式默认 50，类目按用户指定
            exportResultsBtn.disabled = extractedProducts.length === 0;
            renderResults(extractedProducts);
            showStatus(`✅ 完成！${extractedProducts.length} 个有低价推荐的FBS商品（已过滤电脑/手机）`, 'success');
          } else {
            showStatus(`✅ ${extractedProducts.length} 个商品（价格接口未返回数据）`, 'success');
          }
        } else {
          showStatus(`✅ ${extractedProducts.length} 个商品（请打开 ozon.ru 任意页面以获取实时价格）`, 'success');
        }
    } catch (error) {
      showStatus('❌ 错误: ' + error.message, 'error');
    }
  }
  
  // HTML 转义工具函数，防止 XSS
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // 商品特征（规格）维度处理
  //   归一化字段：product.weight / dimensions / volume / power / material /
  //              color / size / shelfLife / origin / season / ageGroup / model
  //   原始字典：  product.specs = { "俄语原字段名": "值", ... }
  // ============================================================

  // 命名字段 → 中文标签 + emoji（弹窗卡片与 HTML 导出共用）
  const SPEC_LABELS = {
    weight:     { emoji: '⚖️',  label: '重量' },
    dimensions: { emoji: '📐',  label: '尺寸' },
    size:       { emoji: '👕',  label: '尺码' },
    color:      { emoji: '🎨',  label: '颜色' },
    material:   { emoji: '🧵',  label: '材质' },
    volume:     { emoji: '🧴',  label: '容量' },
    power:      { emoji: '⚡',   label: '功率' },
    shelfLife:  { emoji: '⏰',  label: '保质期' },
    origin:     { emoji: '🌍',  label: '产地' },
    season:     { emoji: '🍂',  label: '季节' },
    ageGroup:   { emoji: '👶',  label: '适用年龄' },
    model:      { emoji: '🏷️',  label: '型号' },
  };
  const SPEC_FIELD_ORDER = ['weight','dimensions','size','color','material','volume','power','shelfLife','origin','season','ageGroup','model'];

  // 渲染单商品的"特征 tags"行（弹窗卡片用）
  function renderSpecTags(item) {
    const tags = [];
    for (const f of SPEC_FIELD_ORDER) {
      if (item[f]) {
        const meta = SPEC_LABELS[f];
        tags.push(meta.emoji + ' ' + meta.label + ': ' + escapeHtml(String(item[f])));
      }
    }
    if (tags.length === 0) return '';
    return '<div style="font-size:10px;color:#6b46c1;line-height:1.6;">' + tags.join(' &nbsp;|&nbsp; ') + '</div>';
  }

  // 自适应导出：扫描所有商品，找出实际出现过值的特征列
  //   返回 [{key, label}, ...]，按 SPEC_FIELD_ORDER 排序
  function collectSpecColumns(products) {
    const present = new Set();
    for (const p of products) {
      for (const f of SPEC_FIELD_ORDER) {
        if (p[f]) present.add(f);
      }
    }
    return SPEC_FIELD_ORDER
      .filter(f => present.has(f))
      .map(f => ({ key: f, label: SPEC_LABELS[f].emoji + ' ' + SPEC_LABELS[f].label }));
  }

  // 统一的结果渲染函数
  function renderResults(products) {
    if (products.length > 0) {
      resultsDiv.innerHTML = products.map(item => `
        <div class="product-item">
          <div class="product-title">${escapeHtml(item.title)}</div>
          <div class="product-price">
            ${item.cardPrice ? `<div style="font-size:11px;"><span style="color:#10c44c;font-weight:bold;">🎳 银行卡价: ${escapeHtml(item.cardPrice)}</span></div>` : ''}
            ${item.discountPrice ? `<div style="font-size:11px;"><span style="color:#333;font-weight:bold;">🌟 平台折扣价: ${escapeHtml(item.discountPrice)}</span></div>` : ''}
            ${item.bestSellerPrice ? `<div style="font-size:11px;"><span style="color:#e67e22;font-weight:bold;">💲 低价推荐: ${escapeHtml(item.bestSellerPrice)}</span></div>` : ''}
            ${!item.cardPrice && !item.discountPrice && item.avgPriceRub ? `<div style="font-size:11px;color:#667eea;">月均价: ₽${Number(item.avgPriceRub).toLocaleString()}</div>` : ''}
          </div>
          <div class="product-id">商品ID: ${escapeHtml(item.id)} <a href="${escapeHtml(item.url)}" target="_blank" style="color:#667eea;text-decoration:none;font-size:10px;">查看↗</a></div>
          <div class="product-fbs ${item.isFBS ? '' : 'no'}">
            ${item.isFBS ? '✅ FBS发货' : '❌ 非FBS'}
            ${item.salesSchema && item.salesSchema !== '-' ? ' (' + escapeHtml(item.salesSchema) + ')' : ''}
          </div>
          ${item.soldSum && item.soldSum !== '-' ? '<div style="font-size:10px;color:#667eea;">月销额: ₽' + Number(item.soldSum).toLocaleString() + (item.soldCount && item.soldCount !== '-' ? ' | 销量: ' + Number(item.soldCount).toLocaleString() + '件' : '') + '</div>' : ''}
          ${item.brand && item.brand !== '-' ? '<div style="font-size:10px;color:#999;">品牌: ' + escapeHtml(item.brand) + '</div>' : ''}
          ${item.category && item.category !== '-' ? '<div style="font-size:10px;color:#999;">品类: ' + escapeHtml(item.category) + '</div>' : ''}
          ${renderSpecTags(item)}
          ${item.delivery ? '<div style="font-size:10px;color:#0891b2;">🚚 ' + escapeHtml(String(item.delivery)) + '</div>' : ''}
          ${item.rating || item.comments ? '<div style="font-size:10px;color:#f39c12;">' + (item.rating ? '⭐ ' + escapeHtml(String(item.rating)) : '') + (item.comments ? ' | 💬 ' + escapeHtml(String(item.comments)) : '') + '</div>' : ''}
        </div>
      `).join('');
    } else {
      resultsDiv.innerHTML = '<div class="empty-state">没有找到符合要求的商品</div>';
    }
  }
  
  // 随机挑选商品按钮点击事件
  pickProductsBtn.addEventListener('click', async function() {
    showStatus('正在随机挑选商品...', 'loading');
    resultsDiv.innerHTML = '<div class="empty-state">正在提取商品数据...</div>';
    
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (!tab) {
        showStatus('❌ 错误: 无法获取当前标签页', 'error');
        return;
      }
      
      if (!tab.url || !tab.url.includes('ozon.ru')) {
        showStatus('❌ 错误: 请在 Ozon 网站上使用此插件', 'error');
        return;
      }
      
      // 使用 scripting API 注入脚本
      const results = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: pickRandomProducts
      });
      
      if (results && results[0] && results[0].result) {
        const data = results[0].result;
        
        if (data.success) {
          extractedProducts = data.products || [];
          
          // 应用筛选公式（安全解析，不使用 eval）
          const formula = formulaInput.value.trim();
          if (formula) {
            try {
              extractedProducts = extractedProducts.filter(product => {
                const dp = parseFloat(String(product.discountPrice).replace(',', '.')) || 0;
                const pp = parseFloat(String(product.promoPrice).replace(',', '.')) || 0;
                return safeEvalFormula(formula, {
                  discountPrice: dp,
                  promoPrice: pp,
                  isFBS: product.isFBS
                });
              });
            } catch (e) {
              showStatus('❌ 公式错误: ' + e.message, 'error');
              return;
            }
          }
          
          showStatus(`✅ 成功提取 ${extractedProducts.length} 个符合要求的商品`, 'success');
          exportResultsBtn.disabled = extractedProducts.length === 0;
          
          // 显示结果
          renderResults(extractedProducts);
        } else {
          showStatus('❌ 错误: ' + data.error, 'error');
        }
      } else {
        showStatus('❌ 错误: 脚本执行失败', 'error');
      }
    } catch (error) {
      showStatus('❌ 错误: ' + error.message, 'error');
    }
  });
  
  // 结果区右下角「导出」小链接（类目搜索专用，带筛选）
  const catExportLink = document.getElementById('catExportLink');
  catExportLink.addEventListener('click', function(e) {
    e.preventDefault();
    if (extractedProducts.length === 0) {
      showStatus('❌ 没有数据可导出', 'error');
      return;
    }
    // 按当前筛选条件过滤后导出
    const filters = getFilters();
    const toExport = applyFilters(extractedProducts, filters);
    if (toExport.length === 0) {
      showStatus('❌ 筛选后没有符合条件的商品', 'error');
      return;
    }
    doExportHtml(toExport);
    showStatus(`✅ 已导出 ${toExport.length} 个商品到 HTML 文件`, 'success');
  });

  // 通用导出函数
  function doExportHtml(products) {
    // 自适应特征列：只导出实际有数据的维度
    const specCols = collectSpecColumns(products);
    const specHeaderCells = specCols.map(c => '<th>' + c.label + '</th>').join('');
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>哨兵 - 选品结果</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1800px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #667eea; margin-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; font-size: 14px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; font-size: 13px; vertical-align: top; }
    th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: bold; white-space: nowrap; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    tr:hover { background-color: #f0f0f0; }
    .discount-price { color: #2d8f4e; font-weight: bold; }
    .promo-price { color: #333; }
    .product-id { font-family: monospace; }
    .product-link { color: #667eea; text-decoration: none; }
    .product-link:hover { text-decoration: underline; }
    .fbs-yes { color: #2d8f4e; font-weight: bold; }
    .fbs-no { color: #999; }
    .thumb { width: 60px; height: 60px; object-fit: contain; border-radius: 4px; background: #f5f5f5; }
    td.name-col { max-width: 260px; word-break: break-word; }
    td.spec-col { max-width: 160px; word-break: break-word; color: #444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛡️ 哨兵 - 选品结果</h1>
    <div class="meta">
      <p>导出时间: ${new Date().toLocaleString('zh-CN')}</p>
      <p>商品数量: ${products.length}</p>
      <p>特征维度（自适应）: ${specCols.length ? specCols.map(c => c.label).join(' · ') : '无'}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>主图</th>
          <th>商品ID</th>
          <th>商品名称</th>
          <th>🎳 银行卡价</th>
          <th>🌟 平台折扣价</th>
          <th>💲 低价推荐</th>
          <th>发货模式</th>
          <th>月销额</th>
          ${specHeaderCells}
          <th>物流配送</th>
          <th>品牌</th>
          <th>评分</th>
          <th>评论数</th>
          <th>链接</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(item => {
          const shortUrl = item.url || `https://www.ozon.ru/product/${item.id}/`;
          const specCells = specCols.map(c => '<td class="spec-col">' + (item[c.key] ? escapeHtml(String(item[c.key])) : '-') + '</td>').join('');
          return `
            <tr>
              <td>${item.mainImage ? '<img src="' + escapeHtml(item.mainImage) + '" class="thumb" loading="lazy">' : '-'}</td>
              <td class="product-id">${escapeHtml(item.id)}</td>
              <td class="name-col">${escapeHtml(item.title)}</td>
              <td class="discount-price">${escapeHtml(item.cardPrice || '-')}</td>
              <td class="promo-price">${escapeHtml(item.discountPrice || '-')}</td>
              <td style="color:#e67e22;font-weight:bold;">${escapeHtml(item.bestSellerPrice || '-')}</td>
              <td class="${item.isFBS ? 'fbs-yes' : 'fbs-no'}">${item.isFBS ? '✅ FBS' : '❌ ' + escapeHtml(item.salesSchema || '')}</td>
              <td>${item.soldSum && item.soldSum !== '-' ? '₽' + Number(item.soldSum).toLocaleString() : '-'}</td>
              ${specCells}
              <td>${escapeHtml(item.delivery || (item.isFBS ? 'FBS (Ozon配送)' : (item.salesSchema || '-')))}</td>
              <td>${escapeHtml(item.brand || '-')}</td>
              <td>${escapeHtml(String(item.rating || '-'))}</td>
              <td>${escapeHtml(String(item.comments || '-'))}</td>
              <td><a href="${escapeHtml(shortUrl)}" class="product-link" target="_blank">查看</a></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;
    const blob = new Blob([htmlContent], {type: 'text/html;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `哨兵_选品结果_${new Date().toISOString().slice(0,10)}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // 导出结果按钮点击事件
  exportResultsBtn.addEventListener('click', function() {
    if (extractedProducts.length === 0) {
      showStatus('❌ 没有数据可导出', 'error');
      return;
    }
    doExportHtml(extractedProducts);
    showStatus(`✅ 已导出 ${extractedProducts.length} 个商品到 HTML 文件`, 'success');
  });
});

// 提取商品的函数（将在页面上下文中执行）
function pickRandomProducts() {
  try {
    const products = [];
    const url = window.location.href;
    
    // 判断是商品详情页还是列表页
    const productPageMatch = url.match(/\/product\/[\w-]+-(\d+)/) || url.match(/\/product\/(\d+)/);
    
    if (productPageMatch) {
      // ===== 商品详情页 =====
      const productId = productPageMatch[1];
      
      // 获取标题
      const titleElement = document.querySelector('h1');
      const title = titleElement ? titleElement.textContent.trim() : '未知商品';
      
      // 获取价格
      let discountPrice = '未知';
      let promoPrice = '未知';
      let isFBS = false;
      
      // 提取平台折扣价（绿色，Ozon Bank/卡价格）
      const ozonBankBtn = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent.includes('Ozon Банком') || btn.textContent.includes('Ozon Bank') || btn.textContent.includes('Ozon Картой')
      );
      
      if (ozonBankBtn) {
        const btnText = ozonBankBtn.textContent.trim();
        const priceMatch = btnText.match(/([\d\s]+,\d+)\s*¥/);
        if (priceMatch) {
          discountPrice = priceMatch[1].replace(/\s/g, '');
        }
      }
      
      // 提取优惠价（浅黑色）
      const promoPriceSpan = document.querySelector('span.pdp_bj.tsHeadline500Medium');
      if (promoPriceSpan) {
        const text = promoPriceSpan.textContent.trim();
        const priceMatch = text.match(/([\d\s]+,\d+)\s*¥/);
        if (priceMatch) {
          promoPrice = priceMatch[1].replace(/\s/g, '');
        }
      }
      
      // 检查是否FBS发货
      const pageText = document.body.innerText;
      if (pageText.includes('FBS') || pageText.includes('Ozon delivers')) {
        isFBS = true;
      }
      
      products.push({
        id: productId,
        title: title,
        platform: 'Ozon',
        discountPrice: discountPrice,
        promoPrice: promoPrice,
        isFBS: isFBS,
        url: url
      });
      
    } else {
      // ===== 商品列表页/主页 =====
      const seen = new Set();
      
      // 基于 tile-root 卡片结构提取商品
      const tiles = document.querySelectorAll('[class*="tile-root"]');
      
      // 随机打乱卡片顺序
      const tilesArray = Array.from(tiles).sort(() => 0.5 - Math.random());
      
      tilesArray.forEach(tile => {
        if (products.length >= 10) return;
        
        // 提取商品链接和ID
        const productLink = tile.querySelector('a[href*="/product/"]');
        if (!productLink) return;
        
        const linkUrl = productLink.href;
        const idMatch = linkUrl.match(/-(\d+)\//) || linkUrl.match(/\/(\d+)\//);
        const id = idMatch ? idMatch[1] : null;
        if (!id || seen.has(id)) return;
        seen.add(id);
        
        // 提取标题（从 tsBody500Medium span 或带文字的链接）
        const titleSpan = tile.querySelector('span.tsBody500Medium');
        const title = titleSpan ? titleSpan.textContent.trim() : '';
        if (!title || title.length < 5) return;
        
        // 提取价格（主价格在 tsHeadline500Medium span）
        let discountPrice = '未知';
        let promoPrice = '-';
        
        // 折扣价（彩色/渐变，最低价）
        const mainPriceSpan = tile.querySelector('span.tsHeadline500Medium');
        if (mainPriceSpan) {
          const priceText = mainPriceSpan.textContent.trim();
          const priceMatch = priceText.match(/([\d\s,]+[,.]\d+)/);
          if (priceMatch) {
            discountPrice = priceMatch[1].replace(/\s/g, '');
          }
        }
        
        // 优惠价（黑色常规售价，列表页通常不单独显示，留空）
        // 注意：不提取划线原价，那是原价不是优惠价
        
        // 检测 FBS（从卡片文本中查找配送标识）
        const tileText = tile.textContent;
        const isFBS = tileText.includes('FBS') || 
                      tileText.includes('Ozon доставит') || 
                      tileText.includes('Ozon delivers') ||
                      tileText.includes('доставка Ozon');
        
        products.push({
          id: id,
          title: title,
          platform: 'Ozon',
          discountPrice: discountPrice,
          promoPrice: promoPrice,
          isFBS: isFBS,
          url: linkUrl
        });
      });
    }
    
    return {success: true, products: products};
  } catch (error) {
    return {success: false, error: error.message};
  }
}

// 图片上传搜索1688功能
document.getElementById('uploadImageSearch')?.addEventListener('click', function() {
  const fileInput = document.getElementById('singleImageInput');
  if (!fileInput) {
    showStatus('文件输入框未找到', 'error');
    return;
  }

  // 触发文件选择
  fileInput.click();
});

// 文件选择后自动搜索
document.getElementById('singleImageInput')?.addEventListener('change', async function(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  showStatus('🔍 正在搜索1688同款...', 'loading');

  try {
    // 将图片转为 base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // 调用1688图片搜索API
    const apiUrl = 'https://api-gw.onebound.cn/1688/item_search_img/';
    const params = new URLSearchParams({
      key: 't3246573992',
      secret: '39922f40',
      pic_path: base64,
      start_price: '0',
      end_price: '999999',
      page: '1',
      cat: 'all',
      discount_only: 'false',
      sort: 'renqi',
      page_size: '20',
      is_promotion: 'false'
    });

    const response = await fetch(apiUrl + '?' + params.toString());
    const data = await response.json();

    if (data.error_code === 0 && data.items && data.items.length > 0) {
      // 转换为统一格式
      const products = data.items.map(item => ({
        id: item.num_iid || item.id,
        title: item.title,
        price: parseFloat(item.price) || 0,
        imageUrl: item.pic_url || item.image,
        url: item.detail_url || item.url,
        platform: '1688',
        soldCount: parseInt(item.sold) || 0,
        shopName: item.nick || item.shop_name || ''
      }));

      extractedProducts = products;
      renderResults(products);
      showStatus(`✅ 找到 ${products.length} 个1688同款商品`, 'success');

      // 启用导出按钮
      document.getElementById('exportResults').disabled = false;
    } else {
      showStatus('未找到相似商品，请尝试其他图片', 'error');
    }
  } catch (error) {
    console.error('图片搜索失败:', error);
    showStatus('搜索失败: ' + error.message, 'error');
  }

  // 清空文件输入，允许重复选择同一文件
  e.target.value = '';
});