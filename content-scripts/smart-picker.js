// 哨兵 - 智能选品功能
// 这个脚本会在 Ozon 网站上运行，提供智能选品功能

(function() {
  'use strict';
  
  // 创建浮动按钮
  function createFloatingButton() {
    // 检查是否已经存在
    if (document.getElementById('ozon-smart-picker-btn')) {
      return;
    }
    
    // 创建按钮容器
    const btn = document.createElement('div');
    btn.id = 'ozon-smart-picker-btn';
    btn.innerHTML = '🛒';
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: #2d8f4e;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 999999;
      transition: all 0.3s;
    `;
    
    btn.addEventListener('mouseenter', function() {
      btn.style.transform = 'scale(1.1)';
    });
    
    btn.addEventListener('mouseleave', function() {
      btn.style.transform = 'scale(1)';
    });
    
    btn.addEventListener('click', function() {
      showSmartPickerPanel();
    });
    
    document.body.appendChild(btn);
  }
  
  // 显示智能选片面板
  function showSmartPickerPanel() {
    // 检查是否已经存在
    if (document.getElementById('ozon-smart-picker-panel')) {
      document.getElementById('ozon-smart-picker-panel').remove();
      return;
    }
    
    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'ozon-smart-picker-panel';
    panel.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 500px;
        max-height: 80vh;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 9999999;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: #2d8f4e;
          color: white;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="margin: 0; font-size: 16px;">🛡️ 哨兵</h3>
          <button id="close-panel" style="
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
          ">×</button>
        </div>
        <div style="padding: 15px; max-height: 60vh; overflow-y: auto;">
          <div style="margin-bottom: 15px;">
            <label style="font-size: 12px; color: #333; display: block; margin-bottom: 5px;">筛选公式：</label>
            <input type="text" id="formula-input" value="isFBS" style="
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 12px;
            ">
            <div style="font-size: 10px; color: #666; margin-top: 5px;">
              可用变量: discountPrice（折扣价）, promoPrice（优惠价）, isFBS（是否FBS发货）
            </div>
          </div>
          <button id="pick-products-btn" style="
            width: 100%;
            padding: 10px;
            background: #2d8f4e;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            margin-bottom: 10px;
          ">🎲 随机挑选商品</button>
          <button id="export-results-btn" style="
            width: 100%;
            padding: 10px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            margin-bottom: 10px;
          " disabled>📥 导出结果</button>
          <div id="status" style="
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 10px;
            display: none;
          "></div>
          <div id="results" style="
            font-size: 12px;
          ">
            <div style="text-align: center; color: #999; padding: 20px;">
              点击"随机挑选商品"开始选品
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // 绑定事件
    document.getElementById('close-panel').addEventListener('click', function() {
      panel.remove();
    });
    
    document.getElementById('pick-products-btn').addEventListener('click', pickRandomProducts);
    document.getElementById('export-results-btn').addEventListener('click', exportResults);
  }
  
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
        left = left || right;
      }
      return left;
    }
    
    function parseAnd() {
      let left = parseComparison();
      while (peek() && peek().type === 'op' && peek().value === '&&') {
        consume();
        const right = parseComparison();
        left = left && right;
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

  // 提取的商品数据
  let extractedProducts = [];
  
  // 随机挑选商品
  function pickRandomProducts() {
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const formulaInput = document.getElementById('formula-input');
    const exportBtn = document.getElementById('export-results-btn');
    
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#fff3cd';
    statusDiv.style.color = '#856404';
    statusDiv.textContent = '正在随机挑选商品...';
    
    resultsDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">正在提取商品数据...</div>';
    
    try {
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
        
        extractedProducts = [{
          id: productId,
          title: title,
          platform: 'Ozon',
          discountPrice: discountPrice,
          promoPrice: promoPrice,
          isFBS: isFBS,
          url: url
        }];
        
      } else {
        // ===== 商品列表页/主页 =====
        const seen = new Set();
        extractedProducts = [];
        
        // 基于 tile-root 卡片结构提取商品
        const tiles = document.querySelectorAll('[class*="tile-root"]');
        
        // 随机打乱卡片顺序
        const tilesArray = Array.from(tiles).sort(() => 0.5 - Math.random());
        
        tilesArray.forEach(tile => {
          if (extractedProducts.length >= 10) return;
          
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
          
          extractedProducts.push({
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
          statusDiv.style.background = '#f8d7da';
          statusDiv.style.color = '#721c24';
          statusDiv.textContent = '❌ 公式错误: ' + e.message;
          return;
        }
      }
      
      statusDiv.style.background = '#d4edda';
      statusDiv.style.color = '#155724';
      statusDiv.textContent = `✅ 成功提取 ${extractedProducts.length} 个符合要求的商品`;
      exportBtn.disabled = extractedProducts.length === 0;
      
      // 显示结果
      if (extractedProducts.length > 0) {
        resultsDiv.innerHTML = extractedProducts.map(item => `
          <div style="
            padding: 10px;
            border: 1px solid #eee;
            border-radius: 4px;
            margin-bottom: 10px;
            background: #fafafa;
          ">
            <div style="font-size: 12px; color: #333; margin-bottom: 5px; word-break: break-all;">${item.title}</div>
            <div style="font-size: 11px; margin-bottom: 3px;">
              <span style="color: #2d8f4e; font-weight: bold;">折扣价: ${item.discountPrice} ¥</span>
              <span style="color: #333;"> | 优惠价: ${item.promoPrice} ¥</span>
            </div>
            <div style="font-size: 10px; color: #999;">商品ID: ${item.id}</div>
            <div style="font-size: 10px; color: ${item.isFBS ? '#2d8f4e' : '#999'}; font-weight: ${item.isFBS ? 'bold' : 'normal'};">
              ${item.isFBS ? '✅ FBS发货' : '❌ 非FBS发货'}
            </div>
          </div>
        `).join('');
      } else {
        resultsDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">没有找到符合要求的商品</div>';
      }
      
    } catch (error) {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.color = '#721c24';
      statusDiv.textContent = '❌ 错误: ' + error.message;
    }
  }
  
  // 导出结果
  function exportResults() {
    if (extractedProducts.length === 0) {
      return;
    }
    
    // 创建 HTML 表格内容
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>哨兵 - 选品结果</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    tr:hover { background-color: #ddd; }
    .discount-price { color: #2d8f4e; font-weight: bold; }
    .promo-price { color: #333; }
    .product-id { font-family: monospace; }
    .product-link { color: #0066cc; text-decoration: none; }
    .product-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>哨兵 - 选品结果</h1>
  <p>导出时间: ${new Date().toLocaleString('zh-CN')}</p>
  <p>商品数量: ${extractedProducts.length}</p>
  <table>
    <thead>
      <tr>
        <th>商品ID</th>
        <th>名称</th>
        <th>平台</th>
        <th>折扣价（绿色）</th>
        <th>优惠价（浅黑色）</th>
        <th>FBS发货</th>
        <th>链接</th>
      </tr>
    </thead>
    <tbody>
      ${extractedProducts.map(item => {
        const shortTitle = item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title;
        const shortUrl = `https://www.ozon.ru/product/${item.id}/`;
        return `
          <tr>
            <td class="product-id">${item.id}</td>
            <td>${shortTitle}</td>
            <td>${item.platform}</td>
            <td class="discount-price">${item.discountPrice} ¥</td>
            <td class="promo-price">${item.promoPrice} ¥</td>
            <td>${item.isFBS ? '✅ 是' : '❌ 否'}</td>
            <td><a href="${shortUrl}" class="product-link" target="_blank">查看商品</a></td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>
</body>
</html>
    `;
    
    // 创建下载链接
    const blob = new Blob([htmlContent], {type: 'text/html;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ozon_smart_picker_${new Date().toISOString().slice(0,10)}.html`;
    link.click();
    URL.revokeObjectURL(url);
    
    const statusDiv = document.getElementById('status');
    statusDiv.style.background = '#d4edda';
    statusDiv.style.color = '#155724';
    statusDiv.textContent = `✅ 已导出 ${extractedProducts.length} 个商品到 HTML 文件`;
  }
  
  // 监听来自 popup 的批量价格查询请求
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'BATCH_FETCH_PRICES') {
      batchFetchPrices(request.skus).then(sendResponse);
      return true; // async
    }
  });

  // 批量获取商品实时价格（通过 Ozon 前台 API）
  async function batchFetchPrices(skus) {
    const results = {};
    // 每次并发 5 个，避免触发限流
    for (let i = 0; i < skus.length; i += 5) {
      const batch = skus.slice(i, i + 5);
      const promises = batch.map(async (sku) => {
        try {
          const resp = await fetch(`https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/product/${sku}`, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
          });
          if (!resp.ok) return;
          const data = await resp.json();
          const states = data.widgetStates || {};
          for (const [key, val] of Object.entries(states)) {
            if (key.startsWith('webPrice-') && !key.includes('Stars')) {
              try {
                const priceObj = typeof val === 'string' ? JSON.parse(val) : val;
                results[sku] = {
                  price: priceObj.price || '',
                  originalPrice: priceObj.originalPrice || '',
                  isAvailable: priceObj.isAvailable !== false
                };
              } catch(e) {}
              break;
            }
          }
        } catch(e) {}
      });
      await Promise.all(promises);
      // 每批间隔 300ms
      if (i + 5 < skus.length) await new Promise(r => setTimeout(r, 300));
    }
    return results;
  }

  // 页面加载完成后创建浮动按钮
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }
  
})();