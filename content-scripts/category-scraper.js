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

  // 检测当前网格每行列数
  //   方法 1：读 tileGridDesktop 的 grid-template-columns（最准）
  //   方法 2：用前两行卡片的 offsetTop 分组，取第一组数量
  //   兜底：返回 5（Ozon 桌面端常见默认）
  function detectColumnsPerRow(cards) {
    try {
      const grid = document.querySelector('[data-widget="tileGridDesktop"]');
      if (grid) {
        const cs = window.getComputedStyle(grid);
        const tpl = cs.gridTemplateColumns || '';
        const cols = tpl.trim().split(/\s+/).filter(Boolean).length;
        if (cols >= 2 && cols <= 8) return cols;
      }
    } catch (e) { /* noop */ }

    if (cards && cards.length >= 2) {
      const firstTop = Math.round(cards[0].getBoundingClientRect().top);
      let n = 0;
      for (const c of cards) {
        const top = Math.round(c.getBoundingClientRect().top);
        if (Math.abs(top - firstTop) <= 8) n++;
        else break;
      }
      if (n >= 2 && n <= 8) return n;
    }
    return 5;
  }

  // 自动滚动加载更多商品（按行精确下拉）
  //   目标：DOM 中卡片数 >= targetCount
  //   思路：估算列数 → 目标行 = ceil(targetCount / cols) → 滚到目标行最后一张卡片
  async function autoScrollAndLoad(targetCount) {
    console.log('[Category Scraper] 开始自动滚动加载，目标数量:', targetCount);

    const initialCards = getProductCards();
    const cols = detectColumnsPerRow(initialCards);
    const targetRow = Math.ceil(targetCount / cols);
    console.log('[Category Scraper] 检测到每行列数:', cols, '→ 目标行:', targetRow);

    // 动态上限：每行最多滚 2 次，再加 10 次兜底
    const maxScrolls = Math.max(20, targetRow * 2 + 10);
    const stableLimit = 4;         // 连续 4 次没增加就退出（Ozon 有短暂加载间隔）
    const stepWaitMs = 800;        // 每次滚动后等待渲染
    const settleWaitMs = 400;      // 达标后再等新卡片稳定

    let lastCount = 0;
    let stableCount = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      const cards = getProductCards();
      const currentCount = cards.length;

      // 达标立退（还差"把第 N 张滚进视野确保它被渲染"这一步在循环外做）
      if (currentCount >= targetCount) {
        console.log('[Category Scraper] 已达到目标', targetCount, '，实际', currentCount, '，停止滚动');
        break;
      }

      if (currentCount <= lastCount) {
        stableCount++;
        if (stableCount >= stableLimit) {
          console.log('[Category Scraper] 商品数量连续', stableLimit, '次未增加（当前', currentCount, '），停止');
          break;
        }
      } else {
        stableCount = 0;
        lastCount = currentCount;
      }

      // 优先滚到"目标行的第一张卡片"上方一点（如果已经加载到）；否则滚到最后一张
      const targetIndex = (targetRow - 1) * cols;
      if (cards[targetIndex]) {
        cards[targetIndex].scrollIntoView({ behavior: 'instant', block: 'center' });
      } else if (cards.length > 0) {
        cards[cards.length - 1].scrollIntoView({ behavior: 'instant', block: 'end' });
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }

      scrollCount++;
      console.log('[Category Scraper] 第', scrollCount, '次滚动，当前商品数:', currentCount, '/', targetCount);

      await new Promise(resolve => setTimeout(resolve, stepWaitMs));
    }

    // 收尾：达标后把第 targetCount 张卡片滚进视野，确保它真的被 Ozon 虚拟列表渲染（图片等懒加载属性填好）
    const finalCards = getProductCards();
    const anchorIdx = Math.min(targetCount - 1, finalCards.length - 1);
    if (anchorIdx >= 0 && finalCards[anchorIdx]) {
      finalCards[anchorIdx].scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(r => setTimeout(r, settleWaitMs));
    }

    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 200));

    const finalCount = getProductCards().length;
    console.log('[Category Scraper] 滚动完成，最终商品数量:', finalCount, '（列数', cols, '，滚动', scrollCount, '次）');
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
