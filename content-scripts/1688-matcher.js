// 1688-matcher.js - 1688同款匹配模块
(function() {
  'use strict';

  const chrome = globalThis.chrome;

  // 提取关键词（简化版）
  function extractKeywords(title) {
    // 去除常见的无用词
    const stopWords = ['新款', '热销', '批发', '厂家', '直销', '现货', '包邮', '跨境', '外贸'];
    let keywords = title;
    
    // 去除停用词
    stopWords.forEach(word => {
      keywords = keywords.replace(new RegExp(word, 'g'), '');
    });
    
    // 去除数字+单位（如 30cm, 11寸）
    keywords = keywords.replace(/\d+[a-zA-Z\u4e00-\u9fa5]+/g, '');
    
    // 去除特殊字符
    keywords = keywords.replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, ' ');
    
    // 去除多余空格
    keywords = keywords.trim().replace(/\s+/g, ' ');
    
    // 取前3-5个词
    const words = keywords.split(' ').filter(w => w.length > 1);
    return words.slice(0, Math.min(5, words.length)).join(' ');
  }

  // 搜索1688商品
  async function search1688(keyword, limit = 10) {
    try {
      const url = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(keyword)}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html'
        },
        credentials: 'include'
      });
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      
      const html = await resp.text();
      
      // 解析HTML提取商品信息
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const products = [];
      const items = doc.querySelectorAll('.offer-item, .sm-offer-item, [class*="offer"]');
      
      for (let i = 0; i < Math.min(items.length, limit); i++) {
        const item = items[i];
        
        // 提取商品链接
        const link = item.querySelector('a[href*="detail.1688.com"]');
        if (!link) continue;
        
        const href = link.href;
        const offerIdMatch = href.match(/offer[\/](\d+)/);
        if (!offerIdMatch) continue;
        
        const offerId = offerIdMatch[1];
        
        // 提取标题
        const titleEl = item.querySelector('.title, [class*="title"]');
        const title = titleEl ? titleEl.textContent.trim() : '';
        
        // 提取价格
        const priceEl = item.querySelector('.price, [class*="price"]');
        const priceText = priceEl ? priceEl.textContent.trim() : '';
        const priceMatch = priceText.match(/[\d.]+/);
        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
        
        // 提取图片
        const imgEl = item.querySelector('img');
        const image = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';
        
        // 提取供应商
        const shopEl = item.querySelector('.company, [class*="company"], [class*="shop"]');
        const shop = shopEl ? shopEl.textContent.trim() : '';
        
        products.push({
          offerId,
          title,
          price,
          image: image.startsWith('//') ? 'https:' + image : image,
          shop,
          url: `https://detail.1688.com/offer/${offerId}.html`
        });
      }
      
      return products;
    } catch (e) {
      console.error('[1688匹配] 搜索失败:', e);
      return [];
    }
  }

  // 计算文本相似度（简化版 - Jaccard相似度）
  function calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // 匹配1688同款
  async function findSimilarProducts(ozonProduct) {
    try {
      // 提取关键词
      const keywords = extractKeywords(ozonProduct.title);
      console.log('[1688匹配] 关键词:', keywords);
      
      if (!keywords || keywords.length < 2) {
        return { success: false, error: '关键词提取失败' };
      }
      
      // 搜索1688
      const results = await search1688(keywords, 20);
      console.log('[1688匹配] 搜索结果:', results.length);
      
      if (results.length === 0) {
        return { success: false, error: '未找到相关商品' };
      }
      
      // 计算相似度
      const scored = results.map(item => {
        const textSim = calculateTextSimilarity(ozonProduct.title, item.title);
        
        // 简单评分：文本相似度为主
        const score = textSim * 100;
        
        return {
          ...item,
          similarity: score,
          textSimilarity: textSim
        };
      });
      
      // 排序（相似度从高到低）
      scored.sort((a, b) => b.similarity - a.similarity);
      
      // 返回前5个最相似的
      return {
        success: true,
        matches: scored.slice(0, 5),
        keyword: keywords
      };
    } catch (e) {
      console.error('[1688匹配] 匹配失败:', e);
      return { success: false, error: e.message };
    }
  }

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'FIND_1688_SIMILAR') {
      findSimilarProducts(request.product).then(sendResponse);
      return true; // 异步响应
    }
  });

  console.log('[哨兵] 1688匹配模块已加载');
})();
