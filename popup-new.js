// 长腿欧巴 V2 - Popup 界面逻辑
// 连接 UI 和主控制器

document.addEventListener('DOMContentLoaded', function() {
  // 初始化控制器
  const controller = new MainController();

  // DOM 元素
  const modeTabs = document.querySelectorAll('#modeTabs .mode-tab');
  const categoryPanel = document.getElementById('categoryPanel');
  const categoryIds = document.getElementById('categoryIds');
  const quickCatBtns = document.querySelectorAll('.quick-cat-btn');

  const startPipelineBtn = document.getElementById('startPipeline');
  const exportExcelBtn = document.getElementById('exportExcel');
  const exportHTMLBtn = document.getElementById('exportHTML');

  const statusDiv = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const resultsDiv = document.getElementById('results');
  const resultCount = document.getElementById('resultCount');

  let currentMode = 'hot';
  let products = [];

  // ============ 模式切换 ============
  modeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      modeTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentMode = this.dataset.mode;

      // 显示/隐藏类目面板
      if (currentMode === 'category') {
        categoryPanel.classList.add('show');
      } else {
        categoryPanel.classList.remove('show');
      }
    });
  });

  // ============ 快选类目 ============
  quickCatBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.dataset.id;
      const existing = (categoryIds.value || '').trim();
      const ids = existing ? existing.split(',').map(s => s.trim()).filter(Boolean) : [];

      if (!ids.includes(id)) {
        ids.push(id);
        categoryIds.value = ids.join(',');
      }

      showStatus(`已选: ${this.textContent}`, 'success');
    });
  });

  // ============ 开始智能选品 ============
  startPipelineBtn.addEventListener('click', async function() {
    if (controller.isProcessingNow()) {
      showStatus('正在处理中，请稍候...', 'error');
      return;
    }

    // 读取筛选条件
    const filters = {
      minPrice: parseFloat(document.getElementById('filterPriceMin').value) || null,
      maxPrice: parseFloat(document.getElementById('filterPriceMax').value) || null,
      minMonthSales: parseFloat(document.getElementById('filterSalesMin').value) || null,
      minProfitRate: parseFloat(document.getElementById('filterProfitRate').value) || 22,
      requireFBS: document.getElementById('filterFBS').checked,
    };

    // 读取类目
    let categories = [];
    if (currentMode === 'category') {
      const catInput = (categoryIds.value || '').trim();
      if (!catInput) {
        showStatus('请输入类目 ID', 'error');
        return;
      }
      categories = catInput.split(',').map(c => parseInt(c.trim())).filter(n => !isNaN(n));
    }

    // 是否启用 1688 匹配
    const enable1688Match = document.getElementById('enable1688Match').checked;

    // 禁用按钮
    startPipelineBtn.disabled = true;
    startPipelineBtn.textContent = '⏳ 处理中...';
    exportExcelBtn.disabled = true;
    exportHTMLBtn.disabled = true;

    try {
      // 执行完整流程
      products = await controller.executeFullPipeline(
        {
          mode: currentMode,
          categories,
          filters,
          enable1688Match,
          targetCount: 50,
          maxRawItems: 1000
        },
        (progress) => {
          // 更新进度
          showStatus(progress.message, 'loading');
          updateProgress(progress.percent);
        }
      );

      // 显示结果
      renderResults(products);
      showStatus(`✅ 完成！共 ${products.length} 个符合条件的商品`, 'success');

      // 启用导出按钮
      exportExcelBtn.disabled = false;
      exportHTMLBtn.disabled = false;

    } catch (error) {
      showStatus(`❌ 错误: ${error.message}`, 'error');
      console.error('[Popup] 执行失败:', error);
    } finally {
      startPipelineBtn.disabled = false;
      startPipelineBtn.textContent = '🎯 开始智能选品';
      hideProgress();
    }
  });

  // ============ 导出 Excel ============
  exportExcelBtn.addEventListener('click', function() {
    if (products.length === 0) {
      showStatus('没有可导出的商品', 'error');
      return;
    }

    const filename = `ozon_products_${new Date().toISOString().slice(0,10)}.csv`;
    controller.exportToExcel(products, filename);
    showStatus(`✅ 已导出 ${products.length} 个商品到 ${filename}`, 'success');
  });

  // ============ 导出 HTML ============
  exportHTMLBtn.addEventListener('click', function() {
    if (products.length === 0) {
      showStatus('没有可导出的商品', 'error');
      return;
    }

    const filename = `ozon_report_${new Date().toISOString().slice(0,10)}.html`;
    controller.exportToHTML(products, filename);
    showStatus(`✅ 已导出 HTML 报告到 ${filename}`, 'success');
  });

  // ============ UI 辅助函数 ============

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }

  function updateProgress(percent) {
    progressBar.style.display = 'block';
    progressFill.style.width = percent + '%';
  }

  function hideProgress() {
    progressBar.style.display = 'none';
    progressFill.style.width = '0%';
  }

  function renderResults(products) {
    if (products.length === 0) {
      resultsDiv.innerHTML = '<div class="empty-state">未找到符合条件的商品</div>';
      resultCount.textContent = '';
      return;
    }

    resultCount.textContent = `(${products.length} 个)`;

    const html = products.map((p, index) => {
      const profitColor = p.profitRate >= 30 ? '#11998e' : p.profitRate >= 22 ? '#f5576c' : '#999';

      return `
        <div class="product-card">
          <img src="${p.mainImage || 'assets/logo.png'}" class="product-image" alt="商品图片">
          <div class="product-info">
            <div class="product-title">${index + 1}. ${p.titleZh || p.title || '未知商品'}</div>
            <div class="product-meta">
              💰 推荐售价: <b>${p.recommendedPrice || '-'} ₽</b> |
              🏷️ 黑标: ${p.cardPrice || '-'} ₽ |
              🟢 绿标: ${p.bestSellerPrice || '-'} ₽
            </div>
            <div class="product-meta">
              📦 月销: ${p.soldCount || '-'} |
              🏭 品牌: ${p.brand || '-'} |
              📏 重量: ${p.weight || '-'}
            </div>
            ${p.match1688 ? `
              <div class="product-meta">
                🇨🇳 1688: ${p.match1688.title.slice(0, 30)}... |
                💵 采购价: ${p.purchaseCost || '-'} ₽
              </div>
            ` : ''}
            <div class="product-profit" style="color: ${profitColor}">
              💎 利润: ${p.profit || '-'} ₽ | 利润率: ${p.profitRate || '-'}%
            </div>
          </div>
        </div>
      `;
    }).join('');

    resultsDiv.innerHTML = html;
  }

  // ============ 初始化检查 ============
  checkSellerTab();

  function checkSellerTab() {
    chrome.runtime.sendMessage({ type: 'CHECK_SELLER_TAB' }, (resp) => {
      if (resp && resp.hasSellerTab) {
        showStatus('✅ 已连接 seller.ozon.ru，可以开始选品', 'success');
      } else {
        showStatus('⚠️ 请先打开 seller.ozon.ru 并登录', 'error');
        startPipelineBtn.disabled = true;
      }
    });
  }
});
