// category-scraper.js - 从 Ozon 类目页面直接提取商品数据
(function() {
  'use strict';

  const chrome = globalThis.chrome;

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SCRAPE_CATEGORY_PAGE') {
      scrapeCategoryPage(request, sendResponse);
      return true;
    }
  });

  // 从当前类目页面提取商品数据
  async function scrapeCategoryPage(request, sendResponse) {
    try {
      const limit = request.maxItems || request.limit || 50;
      
      console.log('[Category Scraper] 开始提取商品，目标数量:', limit);
      
      // 等待页面加载完成
      await waitForProducts();
      
      // 自动滚动加载更多商品
      await autoScrollAndLoad(limit);
      
      // 提取商品数据
      const products = extractProducts(limit);
      
      if (products.length === 0) {
        sendResponse({ 
          success: false, 
          error: '未找到商品数据，请确认页面已加载完成（选择器可能需要更新）' 
        });
        return;
      }
      
      console.log('[Category Scraper] 成功提取', products.length, '个商品');
      
      sendResponse({ 
        success: true, 
        products: products,
        count: products.length
      });
      
    } catch (error) {
      console.error('[Category Scraper] 提取失败:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // 等待商品加载
  function waitForProducts(timeout = 20000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const check = () => {
        // 优先用 tileGridDesktop（当前 Ozon DOM），兜底用 .tile-root
        const selectors = [
          '[data-widget="tileGridDesktop"] .tile-root',
          '[data-widget="tileGridDesktop"] > div',
          '.tile-root',
        ];
        let found = 0;
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) { found = els.length; break; }
        }
        
        if (found > 0) {
          console.log('[Category Scraper] 找到', found, '个商品卡片');
          resolve();
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          console.log('[Category Scraper] 等待超时，继续提取已加载内容');
          resolve();
          return;
        }
        
        setTimeout(check, 200);
      };
      
      check();
    });
  }

  // 获取商品卡片列表
  function getProductCards() {
    // 优先 tileGridDesktop（当前 Ozon DOM），兜底 .tile-root
    const selectors = [
      '[data-widget="tileGridDesktop"] .tile-root',
      '[data-widget="tileGridDesktop"] > div',
      '.tile-root',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 2) return Array.from(els);
    }
    return [];
  }

  // 自动滚动加载更多商品
  async function autoScrollAndLoad(targetCount) {
    console.log('[Category Scraper] 开始自动滚动加载，目标数量:', targetCount);
    
    let lastCount = 0;
    let stableCount = 0;
    const maxScrolls = 20;
    const stableLimit = 3;
    let scrollCount = 0;
    
    while (scrollCount < maxScrolls) {
      const cards = getProductCards();
      const currentCount = cards.length;
      console.log('[Category Scraper] 当前商品数量:', currentCount);
      
      if (currentCount >= targetCount) {
        console.log('[Category Scraper] 已达到目标数量，停止滚动');
        break;
      }
      
      if (currentCount <= lastCount) {
        stableCount++;
        if (stableCount >= stableLimit) {
          console.log('[Category Scraper] 商品数量不再增加，停止');
          break;
        }
      } else {
        stableCount = 0;
        lastCount = currentCount;
      }
      
      // 滚动到最后一张卡片（后台标签页也能触发虚拟滚动）
      if (cards.length > 0) {
        cards[cards.length - 1].scrollIntoView({ behavior: 'instant', block: 'end' });
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
      scrollCount++;
      
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const finalCount = getProductCards().length;
    console.log('[Category Scraper] 滚动完成，最终商品数量:', finalCount);
  }

  // 提取商品数据
  function extractProducts(limit) {
    const products = [];
    
    const productCards = getProductCards();
    
    for (let i = 0; i < Math.min(productCards.length, limit); i++) {
      const card = productCards[i];
      
      try {
        // 提取链接（去掉 ?at=... 参数再匹配 sku）
        const link = card.querySelector('a[href*="/product/"]');
        if (!link) continue;
        
        const href = link.getAttribute('href');
        const cleanHref = href.split('?')[0];
        const skuMatch = cleanHref.match(/-(\d+)\/?$/);
        if (!skuMatch) continue;
        const sku = skuMatch[1];
        
        // 用 innerText 按行解析（class 名全部混淆，不可靠）
        const lines = card.innerText.split('\n').map(s => s.trim()).filter(Boolean);
        
        // 标题：最长且不含 ¥ % 关键词的行
        const title = lines.find(l =>
          l.length > 20 &&
          !l.includes('¥') &&
          !l.includes('%') &&
          !/отзыв|дней|Послезавтра|Оригинал|Реклама|\d+:\d+/.test(l)
        ) || '';
        
        // 价格：第一个含 ¥ 的行
        const priceLine = lines.find(l => l.includes('¥')) || '';
        // 提取纯数字（去掉空格和逗号）
        const priceNum = parseFloat(priceLine.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        
        // 评分：形如 4.8
        const ratingLine = lines.find(l => /^\d\.\d$/.test(l)) || '';
        const rating = parseFloat(ratingLine) || 0;
        
        // 评论数：含 отзыв 的行提取数字
        const reviewLine = lines.find(l => /отзыв/.test(l)) || '';
        const reviewCount = parseInt(reviewLine.replace(/[^\d]/g, '')) || 0;
        
        // 图片
        const imgEl = card.querySelector('img');
        const imageUrl = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';
        
        const fullUrl = cleanHref.startsWith('http') ? cleanHref : 'https://www.ozon.ru' + cleanHref;
        
        products.push({
          sku: sku,
          product_id: sku,
          id: sku,
          name: title,
          title: title,
          price: priceNum,
          cardPrice: priceLine,
          discountPrice: priceLine,
          imageUrl: imageUrl,
          image: imageUrl,
          rating: rating,
          reviewCount: reviewCount,
          url: fullUrl
        });
        
      } catch (error) {
        console.error('[Category Scraper] 提取商品失败:', error);
        continue;
      }
    }
    
    return products;
  }

  console.log('[哨兵] category-scraper 已加载');
})();
