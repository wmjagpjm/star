// 1688自动搜索和对比功能
// 使用 OneBound API 实现以图搜同款

// ============ OneBound 1688 API 配置 ============
const ONEBOUND_CONFIG = {
  baseUrl: 'https://api-gw.onebound.cn/1688/item_search_img/',
  key: 't3246573992',
  secret: '39922f40',
  lang: 'zh-CN',
  cache: 'no',
  pageSize: 50
};
// ================================================

// 全局变量
let comparisonResults = [];

/**
 * 下载图片并转为 Base64 JPEG (data URI)
 * 统一转为 JPEG 格式，避免 WebP 等特殊格式导致 API 报错
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<string>} base64 data URI (image/jpeg)
 */
async function downloadImageAsBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    // 统一转为 JPEG（避免 WebP 等格式导致 API 报 data error）
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          // 白色背景（ JPEG 不支持透明）
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob((jpegBlob) => {
            if (!jpegBlob) { reject(new Error('Canvas转JPEG失败')); return; }
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
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
      img.src = url;
    });
  } catch (e) {
    console.warn('图片下载失败:', e.message);
    throw e;
  }
}

/**
 * 使用 OneBound API 搜索 1688 同款
 * @param {string} imageUrl - 商品图片URL（可从提取的商品获取）
 * @param {number} page - 页码
 * @returns {Promise<{products: Array, total: number}>}
 */
async function search1688ByAPI(imageUrl, page = 1) {
  if (!imageUrl) return { products: [], total: 0 };

  let imgid = imageUrl.trim();

  // 如果不是 data URI，先下载为 base64
  if (!imgid.startsWith('data:')) {
    try {
      imgid = await downloadImageAsBase64(imgid);
    } catch (e) {
      console.warn('图片下载失败，尝试直接用URL:', e.message);
      // 保留原URL让API自己处理
    }
  }

  // 统一转为 JPEG（WebP 等格式 API 不认）
  if (imgid.startsWith('data:')) {
    try {
      imgid = await convertToJPEG(imgid);
    } catch (e) {
      console.warn('JPEG转换失败，使用原图:', e.message);
    }
    // API 不接受 base64 data URI，必须上传到图床获取公开 URL
    try {
      imgid = await uploadToImageHost(imgid);
      console.log('图片已上传到图床:', imgid.substring(0, 80));
    } catch (e) {
      // 上传失败时，如果是本地上传（data URI）则返回错误，避免静默失败
      const isHttpUrl = imageUrl.startsWith('http');
      if (!isHttpUrl) {
        return { products: [], total: 0, error: '图片上传失败，请检查网络或稍后重试' };
      }
      console.warn('图片上传失败，回退到原URL:', e.message);
      imgid = imageUrl;
    }
  }

  const params = new URLSearchParams({
    key: ONEBOUND_CONFIG.key,
    imgid: imgid,
    cache: ONEBOUND_CONFIG.cache,
    lang: ONEBOUND_CONFIG.lang,
    secret: ONEBOUND_CONFIG.secret,
    page: String(page),
    page_size: String(ONEBOUND_CONFIG.pageSize)
  });

  const apiUrl = `${ONEBOUND_CONFIG.baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, { method: 'GET', timeout: 30000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // 优先检查 API 报错（data.reason 包含真正的错误信息，如 data error/no cache）
    if (data.reason && data.reason.toLowerCase().includes('error')) {
      return { products: [], total: 0, error: data.reason };
    }
    if (data.error || (data.items && data.items.error)) {
      const errMsg = data.items ? (data.items.reason || data.items.error) : (data.reason || data.error);
      console.error('OneBound API 错误:', errMsg);
      return { products: [], total: 0, error: errMsg };
    }
    if (!data.items || !data.items.item || data.items.item.length === 0) {
      return { products: [], total: 0, error: '未找到同款商品' };
    }

    const products = data.items.item.map(item => ({
      title: item.title || '',
      price: item.price || item.promotion_price || '',
      sales: item.sales || 0,
      turnHead: item.turn_head || '0%',
      picUrl: item.pic_url || '',
      numIid: item.num_iid || '',
      detailUrl: item.detail_url || '',
      isJxhy: item.is_jxhy || false,
      onePsale: item.one_psale || false
    }));

    return { products, total: data.items.total_results || products.length };
  } catch (e) {
    console.error('OneBound API 请求失败:', e.message);
    return { products: [], total: 0, error: e.message };
  }
}

/**
 * 将 data URI 图片统一转为 JPEG（解决 WebP 等格式 API 不支持的问题）
 * @param {string} dataUri - 图片 data URI
 * @returns {Promise<string>} JPEG data URI
 */
function convertToJPEG(dataUri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(jpegBlob => {
          if (!jpegBlob) { reject(new Error('Canvas转JPEG失败')); return; }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(jpegBlob);
        }, 'image/jpeg', 0.85);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUri;
  });
}

/**
 * 上传图片到免费图床，返回公开 URL
 * API 不接受 base64 data URI，只接受公开图片 URL
 * @param {string} dataUri - JPEG data URI
 * @returns {Promise<string>} 公开图片 URL
 */

/**
 * 把 data URI 转为 Blob（不依赖 fetch）
 * @param {string} dataUri - data:image/xxx;base64,xxxxx
 * @returns {Blob}
 */
function dataURItoBlob(dataUri) {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error('无效的 data URI');
  const mime = matches[1];
  const bstr = atob(matches[2]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

async function uploadToImageHost(dataUri) {
  const errors = [];

  // 1. 试 imgbb (主选，CORS 友好)
  try {
    const blob = dataURItoBlob(dataUri);
    console.log('准备上传图片:', blob.type, Math.round(blob.size / 1024) + 'KB');

    // imgbb 免费限额：匿名上传 2MB，有 API key 10MB
    const form = new FormData();
    form.append('image', blob, { filename: 'image.jpg', type: blob.type });
    // 不需要 API key 的匿名上传
    const resp = await fetch('https://api.imgbb.com/1/upload?key=d36eb6591370ae7f9089d85875571358', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20000)
    });
    const json = await resp.json();
    if (json?.data?.url) {
      console.log('imgbb上传成功:', json.data.url);
      return json.data.url;
    }
    console.warn('imgbb返回异常:', JSON.stringify(json).substring(0, 200));
    errors.push('imgbb: ' + (json?.error?.message || 'unknown'));
  } catch (e) { errors.push('imgbb: ' + (e.name === 'TimeoutError' ? '超时' : e.message)); }

  // 2. 试 litterbox.catbox.moe (临时图床，72小时)
  try {
    const blob = dataURItoBlob(dataUri);
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '72');
    form.append('fileToUpload', blob, { filename: 'image.jpg', type: blob.type });
    const resp = await fetch('https://litterbox.catbox.moe/resources/internals/api.php?a=upload', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20000)
    });
    const text = await resp.text();
    if (text.startsWith('https://')) {
      console.log('litterbox上传成功:', text.trim());
      return text.trim();
    }
    errors.push('litterbox: ' + text.substring(0, 100));
  } catch (e) { errors.push('litterbox: ' + (e.name === 'TimeoutError' ? '超时' : e.message)); }

  // 3. 试 catbox.moe (长期保存)
  try {
    const blob = dataURItoBlob(dataUri);
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '86400');
    form.append('fileToUpload', blob, { filename: 'image.jpg', type: blob.type });
    const resp = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20000)
    });
    const text = await resp.text();
    if (text.startsWith('https://')) {
      console.log('catbox上传成功:', text.trim());
      return text.trim();
    }
    errors.push('catbox: ' + text.substring(0, 100));
  } catch (e) { errors.push('catbox: ' + (e.name === 'TimeoutError' ? '超时' : e.message)); }

  console.error('所有图床上传失败:', errors);
  throw new Error('图片上传失败（所有图床均不可用）');
}

/**
 * 旧版 search1688Product（保留兼容，仅关键词搜索）
 * @deprecated 请使用 search1688ByAPI 以图搜同款
 */

// 创建1688对比界面
function create1688ComparisonUI() {
  const modal = document.createElement('div');
  modal.id = '1688ComparisonModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 95%;
    max-width: 1200px;
    max-height: 90vh;
    overflow-y: auto;
  `;
  
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #333;">🔍 1688 同款搜索</h2>
      <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
    </div>

    <!-- 统一的上传+搜索区块 -->
    <div id="imageSearchSection" style="background:#fff0f5; border:2px solid #f5576c; border-radius:12px; padding:16px; margin-bottom:16px;">
      <div style="margin-bottom:10px;">
        <p style="margin:0 0 4px 0; font-size:13px; color:#333; font-weight:600;">📷 以图搜同款</p>
        <p style="margin:0; font-size:11px; color:#999;">上传本地图片或输入图片URL，搜索1688同款商品</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
        <label style="padding:9px 16px; background:#f5576c; color:white; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500;">
          📂 上传图片
          <input type="file" id="singleImageInput" accept="image/*" style="display:none;">
        </label>
        <input type="text" id="singleImageUrlInput" placeholder="或输入图片URL（http/https）"
               style="flex:1; min-width:200px; padding:9px 12px; border:1px solid #ddd; border-radius:6px; font-size:12px;">
        <button id="singleImageSearchBtn" class="btn"
                style="padding:9px 20px; background:#f5576c; color:white; border:none; border-radius:6px; font-size:13px; cursor:pointer; font-weight:500;">
          🔍 搜索
        </button>
      </div>
      <div id="singleImagePreview" style="display:none; margin-bottom:10px; background:#fff; border-radius:6px; padding:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <img id="singleImagePreviewImg" style="width:60px; height:60px; object-fit:contain; border-radius:4px; border:1px solid #eee;">
          <div>
            <div id="singleImagePreviewName" style="font-size:12px; color:#333; font-weight:500;"></div>
            <div id="singleImageUploadStatus" style="font-size:11px; color:#f5576c; margin-top:2px;"></div>
          </div>
        </div>
      </div>
      <div id="singleImageResults" style="max-height:320px; overflow-y:auto; display:none;"></div>
    </div>

    <div id="searchProgress" style="margin-bottom: 16px; display: none;">
      <div style="background: #f0f0f0; border-radius: 8px; height: 8px; overflow: hidden;">
        <div id="progressBar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <p id="progressText" style="margin-top: 8px; font-size: 12px; color: #666; text-align: center;">准备中...</p>
    </div>

    <div id="comparisonResults" style="margin-bottom: 16px;"></div>

    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="startComparison" class="btn btn-primary" style="padding: 10px 24px;">开始对比</button>
      <button id="exportComparison" class="btn" style="padding: 10px 24px; background: #38ef7d; color: white; display: none;">导出报告</button>
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);

  // 无商品时隐藏批量对比区域，单图搜索作为主界面
  if (!extractedProducts || extractedProducts.length === 0) {
    const resultsEl = document.getElementById('comparisonResults');
    const startBtn = document.getElementById('startComparison');
    const exportBtn = document.getElementById('exportComparison');
    const progressEl = document.getElementById('searchProgress');
    if (resultsEl) resultsEl.style.display = 'none';
    if (startBtn) startBtn.style.display = 'none';
    if (exportBtn) exportBtn.style.display = 'none';
    if (progressEl) progressEl.style.display = 'none';
  }
  
  // 绑定事件
  document.getElementById('startComparison').addEventListener('click', startAutoComparison);
  document.getElementById('exportComparison').addEventListener('click', exportComparisonReport);
  document.getElementById('closeModal').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // 初始化单图搜索
  initSingleImageSearch();
}

// 单图搜索功能（统一的图片搜索逻辑）
function initSingleImageSearch() {
  const singleImageInput = document.getElementById('singleImageInput');
  const singleImageUrlInput = document.getElementById('singleImageUrlInput');
  const singleImageSearchBtn = document.getElementById('singleImageSearchBtn');
  const singleImagePreview = document.getElementById('singleImagePreview');
  const singleImagePreviewImg = document.getElementById('singleImagePreviewImg');
  const singleImagePreviewName = document.getElementById('singleImagePreviewName');
  const singleImageUploadStatus = document.getElementById('singleImageUploadStatus');
  const singleImageResults = document.getElementById('singleImageResults');

  let currentImageData = null; // 当前图片 data URI
  let currentImageUrl = null;  // 上传到图床后的公开 URL

  function setStatus(msg, isError = false) {
    singleImageUploadStatus.textContent = msg;
    singleImageUploadStatus.style.color = isError ? '#e74c3c' : '#f5576c';
  }

  function showPreview(src, name) {
    singleImagePreview.style.display = 'block';
    singleImagePreviewImg.src = src;
    singleImagePreviewName.textContent = name;
  }

  // 本地文件选择：转换 + 上传 + 保存
  singleImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showStatus('❌ 图片不能超过 5MB', true);
      return;
    }

    // 读取文件为 base64
    const base64 = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!base64) { showStatus('❌ 图片读取失败', true); return; }

    currentImageData = base64;
    currentImageUrl = null;
    sharedImageBase64 = null;
    sharedImageUrl = null;
    showPreview(base64, file.name);
    setStatus('⏳ 已选择图片，搜索时自动上传图床');
  });

  // 搜索按钮
  // URL 输入时清空本地图片状态
  singleImageUrlInput.addEventListener('input', () => {
    const val = singleImageUrlInput.value.trim();
    if (val && val.startsWith('http')) {
      currentImageData = null;
      currentImageUrl = val; // 直接用 URL，不需要上传
      sharedImageUrl = val;
      sharedImageBase64 = null;
      showPreview(val, val.split('/').pop().substring(0, 30));
      setStatus('');
    } else {
      currentImageUrl = null;
    }
  });

  // 搜索按钮
  singleImageSearchBtn.addEventListener('click', async () => {
    const urlVal = singleImageUrlInput.value.trim();

    // 判断用哪个图片：优先 URL 输入 > 上传后的图床URL > 本地base64
    let imageData = null;
    let searchImageForReport = null;

    if (urlVal && urlVal.startsWith('http')) {
      imageData = urlVal;
      searchImageForReport = urlVal;
      showPreview(urlVal, urlVal.split('/').pop().substring(0, 40));
    } else if (currentImageUrl) {
      imageData = currentImageUrl;
      searchImageForReport = currentImageUrl;
    } else if (currentImageData) {
      imageData = currentImageData;
      searchImageForReport = currentImageData;
    }

    if (!imageData) {
      setStatus('❌ 请上传图片或输入图片URL', true);
      return;
    }

    singleImageSearchBtn.disabled = true;
    singleImageSearchBtn.textContent = '搜索中...';
    singleImageResults.style.display = 'block';
    singleImageResults.innerHTML = '<div style="text-align:center; padding:30px 20px; color:#999;">🔍 搜索中，请稍候...</div>';

    try {
      const { products, total, error } = await search1688ByAPI(imageData);

      if (error) {
        singleImageResults.innerHTML = `<div style="padding:20px; color:#e74c3c; text-align:center;">❌ 搜索失败<br><span style="font-size:12px; color:#999; font-weight:normal;">${error}</span></div>`;
        setStatus('❌ ' + error, true);
      } else if (products.length === 0) {
        singleImageResults.innerHTML = '<div style="padding:20px; color:#999; text-align:center;">😁 未找到同款商品</div>';
        setStatus('未找到同款商品', false);
      } else {
        // 保存搜索结果，供导出和批量对比使用
        window._lastSearchProducts = products;
        window._lastSearchImage = searchImageForReport || imageData;
        window._lastSearchTotal = total;

        singleImageResults.innerHTML = `
          <div style="margin-bottom:8px; font-size:12px; color:#666; display:flex; justify-content:space-between; align-items:center;">
            <span>共找到 <strong>${total}</strong> 个同款，显示前 ${products.length} 个</span>
            <button id="exportAllHTMLBtn" style="padding:5px 12px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; border-radius:6px; font-size:11px; cursor:pointer;">
              📋 导出全部 ${products.length} 个结果
            </button>
          </div>
          ${products.map((p, idx) => `
            <div style="display:flex; gap:12px; padding:10px; border-bottom:1px solid #eee; align-items:center;"
                 onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='transparent'">
              <img src="${p.picUrl}" style="width:50px; height:50px; object-fit:contain; border-radius:4px; border:1px solid #ddd; flex-shrink:0;"
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%23f0f0f0%22 width=%2250%22 height=%2250%22/><text x=%2250%25%22 y=%2250%25%22 dy=%22.3em%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2210%22>无图</text></svg>'">
              <div style="flex:1; min-width:0;">
                <div style="font-size:12px; font-weight:500; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.title}</div>
                <div style="font-size:11px; color:#666; margin-top:3px;">
                  <span style="color:#f5576c; font-weight:600;">¥${p.price}</span>
                  <span style="margin-left:10px; color:#999;">销量: ${p.sales > 999 ? (p.sales/1000).toFixed(1)+'k' : p.sales}</span>
                  <span style="margin-left:10px; color:${p.turnHead !== '0%' ? '#38ef7d' : '#999'};">转化: ${p.turnHead}</span>
                </div>
                <div style="font-size:10px; color:#667eea; margin-top:3px;">
                  ${p.isJxhy ? '🏆 精选好货' : ''} ${p.onePsale ? '✓ 一件起批' : ''}
                </div>
              </div>
              <a href="${p.detailUrl}" target="_blank"
                 style="padding:5px 10px; background:#667eea; color:white; border-radius:4px; font-size:11px; text-decoration:none; flex-shrink:0;">
                查看详情 ↗
              </a>
            </div>
          `).join('')}
        `;

        // 绑定导出按钮
        document.getElementById('exportAllHTMLBtn').addEventListener('click', () => {
          if (window._lastSearchProducts && window._lastSearchProducts.length > 0) {
            openFullHTMLReport(window._lastSearchProducts, window._lastSearchImage, window._lastSearchTotal);
          }
        });
      }
    } catch (e) {
      singleImageResults.innerHTML = `<div style="padding:16px; color:#f5576c;">❌ 请求异常: ${e.message}</div>`;
    }

    singleImageSearchBtn.disabled = false;
    singleImageSearchBtn.textContent = '🔍 搜索';
  });

  // 回车搜索
  singleImageUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') singleImageSearchBtn.click();
  });
}

// 提取关键词（优化版 - 支持中文）
function extractKeywords(title) {
  // 移除俄语停用词
  const stopWords = ['новый', 'горячий', 'оптом', 'производитель', 'прямые продажи', 'в наличии', 'бесплатная доставка', 'трансграничный', 'внешняя торговля', 'FBS'];
  let keywords = title;
  
  stopWords.forEach(word => {
    keywords = keywords.replace(new RegExp(word, 'gi'), '');
  });
  
  // 移除数字+字母组合
  keywords = keywords.replace(/\d+[a-zA-Zа-яА-Я]+/g, '');
  // 保留中文、字母和空格
  keywords = keywords.replace(/[^a-zA-Zа-яА-Я\u4e00-\u9fa5\s]/g, ' ');
  keywords = keywords.trim().replace(/\s+/g, ' ');
  
  // 如果有中文，优先使用中文关键词
  const chineseMatch = keywords.match(/[\u4e00-\u9fa5]+/g);
  if (chineseMatch && chineseMatch.length > 0) {
    return chineseMatch.join(' ');
  }
  
  const words = keywords.split(' ').filter(w => w.length > 2);
  return words.slice(0, Math.min(5, words.length)).join(' ');
}

// 开始自动对比
async function startAutoComparison() {
  const startBtn = document.getElementById('startComparison');
  const exportBtn = document.getElementById('exportComparison');
  const progressContainer = document.getElementById('searchProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const resultsContainer = document.getElementById('comparisonResults');
  
  startBtn.disabled = true;
  startBtn.textContent = '对比中...';
  progressContainer.style.display = 'block';
  comparisonResults = [];
  
  // 上传的图片 base64（供所有商品共用）
  let sharedImageBase64 = null;
  // 上传后的公开 URL（避免每个商品重复上传）
  let sharedImageUrl = null;
  // 上传状态（避免重复上传）
  let sharedImageUploadPromise = null;

  // 创建结果表格
  resultsContainer.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <th style="padding: 8px; text-align: left; width: 40%;">商品</th>
          <th style="padding: 8px; text-align: right; width: 15%;">Ozon价格</th>
          <th style="padding: 8px; text-align: right; width: 15%;">1688价格</th>
          <th style="padding: 8px; text-align: right; width: 15%;">价格差</th>
          <th style="padding: 8px; text-align: center; width: 10%;">1688销量</th>
          <th style="padding: 8px; text-align: center; width: 10%;">转化率</th>
          <th style="padding: 8px; text-align: center; width: 10%;">状态</th>
        </tr>
      </thead>
      <tbody id="comparisonTableBody">
      </tbody>
    </table>
  `;
  
  const tableBody = document.getElementById('comparisonTableBody');
  
  // 等待共享图片上传完成（如果有）
  if (sharedImageUploadPromise) {
    progressText.textContent = `⏳ 等待图片上传...`;
    await sharedImageUploadPromise;
    progressText.textContent = `🔍 开始搜索同款...`;
  }

  // 逐个搜索商品
  for (let i = 0; i < extractedProducts.length; i++) {
    const product = extractedProducts[i];
    const progress = ((i + 1) / extractedProducts.length * 100).toFixed(0);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `🔍 以图搜同款 ${i + 1}/${extractedProducts.length}...`;
    
    // 添加行到表格
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid #eee';
    row.innerHTML = `
      <td style="padding: 8px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <img src="${product.mainImage || product.imageUrl || ''}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 11px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.titleCn || product.title}</div>
            <div style="font-size: 10px; color: #999;">ID: ${product.id}</div>
          </div>
        </div>
      </td>
      <td style="padding: 8px; text-align: right; color: #f5576c; font-weight: 600;">${product.cardPrice || product.price || '-'}</td>
      <td id="price1688-${i}" style="padding: 8px; text-align: right; color: #38ef7d; font-weight: 600;">搜索中...</td>
      <td id="priceDiff-${i}" style="padding: 8px; text-align: right; font-weight: 600;">-</td>
      <td id="sales1688-${i}" style="padding: 8px; text-align: center; font-size: 11px; color: #999;">-</td>
      <td id="turnhead-${i}" style="padding: 8px; text-align: center; font-size: 11px; color: #999;">-</td>
      <td id="status-${i}" style="padding: 8px; text-align: center; font-size: 11px; color: #999;">等待...</td>
    `;
    tableBody.appendChild(row);
    
    // 搜索1688 - 使用以图搜API
    try {
      // 优先用上传的共享图片 URL，否则用 base64（会再次上传），最后用商品自己的图片
      let productImage = (sharedImageUrl) ? sharedImageUrl : sharedImageBase64;
      if (!productImage) {
        productImage = product.mainImage || product.imageUrl || '';
      }
      const { products: apiResults, error: apiError } = await search1688ByAPI(productImage);
      const result1688 = (apiResults && apiResults.length > 0) ? apiResults[0] : null;
      
      // 更新结果
      const price1688Cell = document.getElementById(`price1688-${i}`);
      const priceDiffCell = document.getElementById(`priceDiff-${i}`);
      const statusCell = document.getElementById(`status-${i}`);
      
      if (result1688 && result1688.price) {
        price1688Cell.textContent = `¥${result1688.price}`;
        
        // 更新销量和转化率
        const salesCell = document.getElementById(`sales1688-${i}`);
        const turnheadCell = document.getElementById(`turnhead-${i}`);
        if (result1688.sales) {
          salesCell.textContent = result1688.sales > 999 ? `${(result1688.sales/1000).toFixed(1)}k` : result1688.sales;
          salesCell.style.color = '#f5576c';
        }
        if (result1688.turnHead && result1688.turnHead !== '0%') {
          turnheadCell.textContent = result1688.turnHead;
          turnheadCell.style.color = '#38ef7d';
          turnheadCell.style.fontWeight = '600';
        }
        
        // 计算价格差
        const ozonPrice = parseFloat((product.cardPrice || product.price || '0').replace(/[^\d.]/g, ''));
        const price1688Num = parseFloat(result1688.price);
        
        if (ozonPrice > 0 && price1688Num > 0) {
          const diff = ozonPrice - price1688Num;
          const diffPercent = ((diff / ozonPrice) * 100).toFixed(1);
          priceDiffCell.textContent = `¥${diff.toFixed(2)} (${diffPercent}%)`;
          priceDiffCell.style.color = diff > 0 ? '#38ef7d' : '#f5576c';
        }
        
        statusCell.textContent = '✅ 找到同款';
        statusCell.style.color = '#38ef7d';
        
        // 保存结果（包含API返回的详细信息）
        comparisonResults.push({
          ...product,
          price1688: result1688.price,
          url1688: result1688.detailUrl || result1688.url,
          title1688: result1688.title,
          sales1688: result1688.sales,
          turnHead1688: result1688.turnHead,
          picUrl1688: result1688.picUrl,
          priceDiff: ozonPrice - price1688Num,
          priceDiffPercent: ozonPrice > 0 && price1688Num > 0 ? ((ozonPrice - price1688Num) / ozonPrice * 100).toFixed(1) : '0'
        });
      } else {
        price1688Cell.textContent = '-';
        price1688Cell.style.color = '#999';
        statusCell.textContent = '❌ 未找到';
        statusCell.style.color = '#f5576c';
        
        comparisonResults.push({
          ...product,
          price1688: null,
          url1688: null,
          title1688: null,
          sales1688: null,
          turnHead1688: null
        });
      }
    } catch (error) {
      console.error('搜索失败:', error);
      document.getElementById(`price1688-${i}`).textContent = '搜索失败';
      document.getElementById(`status-${i}`).textContent = '⚠️ 错误';
    }
    
    // API调用间隔（避免限流）
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 完成
  progressBar.style.width = '100%';
  progressText.textContent = `✅ API精准以图搜完成！共找到 ${comparisonResults.filter(r => r.price1688).length} 个同款`;
  progressText.style.color = '#38ef7d';
  progressText.style.fontWeight = '500';
  
  startBtn.textContent = '对比完成';
  exportBtn.style.display = 'inline-block';
  
  showStatus(`✅ 对比完成！共找到 ${comparisonResults.filter(r => r.price1688).length} 个同款`, 'success');
}

/**
 * 打开完整的1688同款商品HTML报告（新标签页）
 * @param {Array} products - 商品列表
 * @param {string} originalImage - 原图（base64或URL）
 * @param {number} total - 总数
 */
function openFullHTMLReport(products, originalImage, total) {
  // 按销量降序排列
  const sorted = [...products].sort((a, b) => (Number(b.sales) || 0) - (Number(a.sales) || 0));

  const productCards = sorted.map((p, i) => {
    const salesNum = Number(p.sales) || 0;
    const salesDisplay = salesNum >= 1000 ? `${(salesNum / 1000).toFixed(1)}k` : salesNum;
    const turnNum = parseFloat(p.turnHead) || 0;
    const turnColor = turnNum > 10 ? '#e74c3c' : turnNum > 5 ? '#f39c12' : turnNum > 0 ? '#27ae60' : '#999';

    return `
      <div style="display:flex; gap:16px; padding:16px; border-bottom:1px solid #eee; background:white; border-radius:8px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.08); align-items:flex-start;">
        <div style="position:relative; flex-shrink:0;">
          <img src="${p.picUrl}" style="width:100px; height:100px; object-fit:contain; border-radius:6px; border:1px solid #eee;"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23f5f5f5%22 width=%22100%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 dy=%22.3em%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22>无图</text></svg>'">
          <div style="position:absolute; top:4px; left:4px; background:#f5576c; color:white; font-size:10px; padding:2px 5px; border-radius:3px;">${i + 1}</div>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13px; font-weight:600; color:#222; line-height:1.4; margin-bottom:8px; word-break:break-all;">
            ${p.title}
          </div>
          <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:8px;">
            <div style="background:#fff5f5; border:1px solid #fde8e8; padding:6px 12px; border-radius:6px;">
              <div style="font-size:10px; color:#999; margin-bottom:2px;">1688价格</div>
              <div style="font-size:18px; font-weight:700; color:#f5576c;">¥${p.price}</div>
            </div>
            <div style="background:#f0f9ff; border:1px solid #dbeafe; padding:6px 12px; border-radius:6px;">
              <div style="font-size:10px; color:#999; margin-bottom:2px;">销量</div>
              <div style="font-size:18px; font-weight:700; color:#2563eb;">${salesDisplay}</div>
            </div>
            <div style="background:#fef9e7; border:1px solid #fef3c7; padding:6px 12px; border-radius:6px;">
              <div style="font-size:10px; color:#999; margin-bottom:2px;">转化率</div>
              <div style="font-size:18px; font-weight:700; color:${turnColor};">${p.turnHead}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
            ${p.isJxhy ? '<span style="background:linear-gradient(135deg,#f5576c,#ff8a80); color:white; padding:3px 8px; border-radius:3px; font-size:10px;">🏆 精选好货</span>' : ''}
            ${p.onePsale ? '<span style="background:#e8f5e9; color:#2e7d32; padding:3px 8px; border-radius:3px; font-size:10px;">✓ 一件起批</span>' : ''}
          </div>
          <a href="${p.detailUrl}" target="_blank"
             style="display:inline-block; padding:8px 20px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border-radius:6px; font-size:12px; text-decoration:none; font-weight:500;">
            在1688查看详情 ↗
          </a>
        </div>
      </div>
    `;
  }).join('');

  // 原图展示（尝试显示）
  const originalImgHTML = originalImage && originalImage.startsWith('data:')
    ? `<img src="${originalImage}" style="max-width:220px; max-height:220px; object-fit:contain; border-radius:8px; border:2px solid #667eea;"
           onerror="this.style.display='none'"> `
    : originalImage && originalImage.startsWith('http')
    ? `<img src="${originalImage}" style="max-width:220px; max-height:220px; object-fit:contain; border-radius:8px; border:2px solid #667eea; background:#f5f5f5;"
           onerror="this.parentElement.innerHTML='<div style=\\'color:#999; font-size:12px; text-align:center; padding:20px;\\'>图片加载失败</div>'"> `
    : `<div style="color:#999; font-size:12px; text-align:center; padding:20px;">原始图片不可用</div>`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>1688 同款搜索报告 - ${sorted.length} 个结果</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f0f2f5; min-height: 100vh; padding: 24px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 28px 32px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .header p { font-size: 13px; opacity: 0.85; }
    .stats { display: flex; gap: 24px; margin-top: 16px; }
    .stat-item { background: rgba(255,255,255,0.15); padding: 12px 20px; border-radius: 8px; text-align: center; }
    .stat-item .num { font-size: 24px; font-weight: 700; }
    .stat-item .label { font-size: 11px; opacity: 0.8; margin-top: 2px; }
    .layout { display: flex; gap: 24px; align-items:flex-start; }
    .original-section { width: 260px; flex-shrink: 0; position: sticky; top: 24px; }
    .original-card { background: white; border-radius: 10px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .original-card h3 { font-size: 13px; color: #667eea; font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
    .original-card .img-wrap { display: flex; justify-content: center; align-items: center; min-height: 100px; background: #f9f9f9; border-radius: 6px; overflow: hidden; }
    .results-section { flex: 1; min-width: 0; }
    .results-section h3 { font-size: 14px; color: #333; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .sort-bar { background: white; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; font-size: 12px; color: #666; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
    .sort-bar strong { color: #333; }
    @media (max-width: 768px) {
      .layout { flex-direction: column; }
      .original-section { width: 100%; position: static; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 1688 同款搜索报告</h1>
    <p>以图搜同款 · OneBound API 数据</p>
    <div class="stats">
      <div class="stat-item"><div class="num">${total}</div><div class="label">总同款数</div></div>
      <div class="stat-item"><div class="num">${sorted.length}</div><div class="label">本次显示</div></div>
      <div class="stat-item"><div class="num">${sorted.filter(p => Number(p.sales) > 100).length}</div><div class="label">销量100+</div></div>
    </div>
  </div>

  <div class="layout">
    <div class="original-section">
      <div class="original-card">
        <h3>🖼️ 搜索原图</h3>
        <div class="img-wrap">
          ${originalImgHTML}
        </div>
      </div>
    </div>
    <div class="results-section">
      <div class="sort-bar">
        💡 按销量排序 · <strong>共 ${sorted.length} 个同款</strong> · <span style="color:#999;">转化率越高 = 越受欢迎</span>
      </div>
      ${productCards}
    </div>
  </div>
</body>
</html>`;

  // 打开新标签页
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');

  // 5分钟后自动清理 blob URL
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
}

// 搜索1688商品（自动化 - 完全后台）
async function search1688Product(keywords, imageUrl) {
  try {
    // 使用 offscreen API 或完全后台的方式
    // 打开1688搜索页面（完全后台，不显示窗口）
    const searchUrl = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(keywords)}`;
    
    // 创建隐藏的标签页
    const tab = await chrome.tabs.create({ 
      url: searchUrl, 
      active: false,
      // 尝试在当前窗口的后台打开，避免创建新窗口
      windowId: (await chrome.windows.getCurrent()).id
    });
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 提取搜索结果
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const items = [];
        const cards = document.querySelectorAll('.offer-wrapper, .sm-offer-item');
        
        for (let i = 0; i < Math.min(5, cards.length); i++) {
          const card = cards[i];
          
          // 提取标题
          const titleEl = card.querySelector('.title, .offer-title');
          const title = titleEl ? titleEl.textContent.trim() : '';
          
          // 提取价格
          const priceEl = card.querySelector('.price, .offer-price');
          let price = '';
          if (priceEl) {
            const priceText = priceEl.textContent.trim();
            const priceMatch = priceText.match(/[\d.]+/);
            if (priceMatch) price = priceMatch[0];
          }
          
          // 提取链接
          const linkEl = card.querySelector('a[href*="offer"]');
          const url = linkEl ? linkEl.href : '';
          
          if (title && price && url) {
            items.push({ title, price, url });
          }
        }
        
        return items;
      }
    });
    
    // 关闭标签页
    await chrome.tabs.remove(tab.id);
    
    const items = results && results[0] && results[0].result;
    if (items && items.length > 0) {
      // 返回第一个结果
      return items[0];
    }
    
    return null;
  } catch (error) {
    console.error('1688搜索失败:', error);
    return null;
  }
}

// 导出对比报告
function exportComparisonReport() {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Ozon vs 1688 对比报告</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #667eea; margin-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
    .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card .value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
    .summary-card .label { font-size: 12px; opacity: 0.9; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; font-size: 13px; }
    th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: bold; white-space: nowrap; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    tr:hover { background-color: #f0f0f0; }
    .price-ozon { color: #f5576c; font-weight: 600; }
    .price-1688 { color: #38ef7d; font-weight: 600; }
    .price-diff-positive { color: #38ef7d; font-weight: 600; }
    .price-diff-negative { color: #f5576c; font-weight: 600; }
    .status-found { color: #38ef7d; }
    .status-notfound { color: #999; }
    .thumb { width: 50px; height: 50px; object-fit: contain; border-radius: 4px; background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Ozon vs 1688 对比报告</h1>
    <div class="meta">
      <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
      <p>商品数量: ${comparisonResults.length}</p>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <div class="value">${comparisonResults.length}</div>
        <div class="label">总商品数</div>
      </div>
      <div class="summary-card">
        <div class="value">${comparisonResults.filter(r => r.price1688).length}</div>
        <div class="label">找到同款</div>
      </div>
      <div class="summary-card">
        <div class="value">${comparisonResults.filter(r => r.priceDiff > 0).length}</div>
        <div class="label">有利润空间</div>
      </div>
      <div class="summary-card">
        <div class="value">¥${(comparisonResults.reduce((sum, r) => sum + (r.priceDiff || 0), 0) / comparisonResults.length).toFixed(2)}</div>
        <div class="label">平均价格差</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>图片</th>
          <th>商品名称</th>
          <th>Ozon价格</th>
          <th>1688价格</th>
          <th>价格差</th>
          <th>利润率</th>
          <th>1688销量</th>
          <th>转化率</th>
          <th>1688链接</th>
        </tr>
      </thead>
      <tbody>
        ${comparisonResults.map(item => `
          <tr>
            <td><img src="${item.mainImage || item.imageUrl || ''}" class="thumb" onerror="this.style.display='none'"></td>
            <td>
              <div style="font-weight: 500; margin-bottom: 4px;">${item.titleCn || item.title}</div>
              <div style="font-size: 11px; color: #999;">ID: ${item.id}</div>
            </td>
            <td class="price-ozon">${item.cardPrice || item.price || '-'}</td>
            <td class="price-1688">${item.price1688 ? '¥' + item.price1688 : '-'}</td>
            <td class="${item.priceDiff > 0 ? 'price-diff-positive' : 'price-diff-negative'}">
              ${item.priceDiff ? '¥' + item.priceDiff.toFixed(2) : '-'}
            </td>
            <td class="${item.priceDiffPercent > 0 ? 'price-diff-positive' : 'price-diff-negative'}">
              ${item.priceDiffPercent ? item.priceDiffPercent + '%' : '-'}
            </td>
            <td style="color:#f5576c;">${item.sales1688 ? (item.sales1688 > 999 ? (item.sales1688/1000).toFixed(1) + 'k' : item.sales1688) : '-'}</td>
            <td style="color:#38ef7d;font-weight:600;">${item.turnHead1688 && item.turnHead1688 !== '0%' ? item.turnHead1688 : '-'}</td>
            <td>
              ${item.url1688 ? `<a href="${item.url1688}" target="_blank" style="color:#667eea;text-decoration:none;">查看↗</a>` : '-'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;
  
  // 下载HTML
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Ozon_1688对比报告_${new Date().toISOString().slice(0, 10)}.html`;
  link.click();
  URL.revokeObjectURL(url);
  
  showStatus('✅ 对比报告已导出', 'success');
}

// 查找1688同款按钮点击事件
const find1688Btn = document.getElementById('find1688');
find1688Btn.addEventListener('click', function() {
  // 有商品时：直接批量对比；无商品时：弹窗单图搜索
  if (extractedProducts && extractedProducts.length > 0) {
    create1688ComparisonUI();
    // 弹窗打开后自动开始对比
    const startBtn = document.getElementById('startComparison');
    if (startBtn) {
      setTimeout(() => startBtn.click(), 300);
    }
  } else {
    // 无商品：弹窗单图搜索
    create1688ComparisonUI();
  }
});
