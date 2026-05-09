// 1688 API 集成模块
// 使用官方 MTOP API 进行以图搜图

/**
 * MD5 哈希函数（纯JS实现）
 * 来源: https://github.com/blueimp/JavaScript-MD5
 */
function md5(string) {
  function rotateLeft(value, shift) {
    return (value << shift) | (value >>> (32 - shift));
  }
  
  function addUnsigned(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }
  
  function md5cmn(q, a, b, x, s, t) {
    return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, q), addUnsigned(x, t)), s), b);
  }
  
  function md5ff(a, b, c, d, x, s, t) {
    return md5cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }
  
  function md5gg(a, b, c, d, x, s, t) {
    return md5cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }
  
  function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  
  function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | (~d)), a, b, x, s, t);
  }
  
  function convertToWordArray(string) {
    const wordArray = [];
    for (let i = 0; i < string.length * 8; i += 8) {
      wordArray[i >> 5] |= (string.charCodeAt(i / 8) & 0xFF) << (i % 32);
    }
    return wordArray;
  }
  
  function wordToHex(value) {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      hex += ((value >> (i * 8 + 4)) & 0x0F).toString(16) + ((value >> (i * 8)) & 0x0F).toString(16);
    }
    return hex;
  }
  
  function utf8Encode(string) {
    string = string.replace(/\r\n/g, '\n');
    let utftext = '';
    for (let n = 0; n < string.length; n++) {
      const c = string.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  }
  
  let x = convertToWordArray(utf8Encode(string));
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;
  
  const xl = x.length;
  for (let k = 0; k < xl; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = md5ff(a, b, c, d, x[k + 0], 7, 0xD76AA478);
    d = md5ff(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
    c = md5ff(c, d, a, b, x[k + 2], 17, 0x242070DB);
    b = md5ff(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
    a = md5ff(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
    d = md5ff(d, a, b, c, x[k + 5], 12, 0x4787C62A);
    c = md5ff(c, d, a, b, x[k + 6], 17, 0xA8304613);
    b = md5ff(b, c, d, a, x[k + 7], 22, 0xFD469501);
    a = md5ff(a, b, c, d, x[k + 8], 7, 0x698098D8);
    d = md5ff(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
    c = md5ff(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
    b = md5ff(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
    a = md5ff(a, b, c, d, x[k + 12], 7, 0x6B901122);
    d = md5ff(d, a, b, c, x[k + 13], 12, 0xFD987193);
    c = md5ff(c, d, a, b, x[k + 14], 17, 0xA679438E);
    b = md5ff(b, c, d, a, x[k + 15], 22, 0x49B40821);
    a = md5gg(a, b, c, d, x[k + 1], 5, 0xF61E2562);
    d = md5gg(d, a, b, c, x[k + 6], 9, 0xC040B340);
    c = md5gg(c, d, a, b, x[k + 11], 14, 0x265E5A51);
    b = md5gg(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
    a = md5gg(a, b, c, d, x[k + 5], 5, 0xD62F105D);
    d = md5gg(d, a, b, c, x[k + 10], 9, 0x02441453);
    c = md5gg(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
    b = md5gg(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
    a = md5gg(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
    d = md5gg(d, a, b, c, x[k + 14], 9, 0xC33707D6);
    c = md5gg(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
    b = md5gg(b, c, d, a, x[k + 8], 20, 0x455A14ED);
    a = md5gg(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
    d = md5gg(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
    c = md5gg(c, d, a, b, x[k + 7], 14, 0x676F02D9);
    b = md5gg(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
    a = md5hh(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
    d = md5hh(d, a, b, c, x[k + 8], 11, 0x8771F681);
    c = md5hh(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
    b = md5hh(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
    a = md5hh(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
    d = md5hh(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
    c = md5hh(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
    b = md5hh(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
    a = md5hh(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
    d = md5hh(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
    c = md5hh(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
    b = md5hh(b, c, d, a, x[k + 6], 23, 0x04881D05);
    a = md5hh(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
    d = md5hh(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
    c = md5hh(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
    b = md5hh(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
    a = md5ii(a, b, c, d, x[k + 0], 6, 0xF4292244);
    d = md5ii(d, a, b, c, x[k + 7], 10, 0x432AFF97);
    c = md5ii(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
    b = md5ii(b, c, d, a, x[k + 5], 21, 0xFC93A039);
    a = md5ii(a, b, c, d, x[k + 12], 6, 0x655B59C3);
    d = md5ii(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
    c = md5ii(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
    b = md5ii(b, c, d, a, x[k + 1], 21, 0x85845DD1);
    a = md5ii(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
    d = md5ii(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
    c = md5ii(c, d, a, b, x[k + 6], 15, 0xA3014314);
    b = md5ii(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
    a = md5ii(a, b, c, d, x[k + 4], 6, 0xF7537E82);
    d = md5ii(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
    c = md5ii(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
    b = md5ii(b, c, d, a, x[k + 9], 21, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

/**
 * 获取 Cookie 值
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

/**
 * 生成 MTOP 签名
 * @param {string} token - _m_h5_tk Cookie 的前半部分
 * @param {number} timestamp - 时间戳
 * @param {string} appKey - 应用Key
 * @param {string} data - 请求数据（JSON字符串）
 */
function generateSign(token, timestamp, appKey, data) {
  const signString = `${token}&${timestamp}&${appKey}&${data}`;
  return md5(signString);
}

/**
 * 图片转 Base64
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<string>} Base64编码的图片
 */
async function imageToBase64(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
      resolve(base64);
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

/**
 * 调用 1688 以图搜图 API
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<Object>} 搜索结果
 */
async function search1688ByImage(imageUrl) {
  try {
    // 1. 获取 Cookie
    const m_h5_tk = getCookie('_m_h5_tk');
    if (!m_h5_tk) {
      throw new Error('未登录1688，请先登录');
    }
    
    const token = m_h5_tk.split('_')[0]; // 取前半部分
    
    // 2. 转换图片为 Base64
    console.log('正在转换图片为Base64...');
    const imageBase64 = await imageToBase64(imageUrl);
    
    // 3. 准备请求参数
    const timestamp = Date.now();
    const appKey = '12574478';
    const api = 'mtop.relationrecommend.wirelessrecommend.recommend';
    const version = '2.0';
    
    const requestData = {
      appId: 32517,
      params: JSON.stringify({
        beginPage: 1,
        pageSize: 60,
        searchScene: 'pcImageSearch',
        method: 'uploadBase64WithRequest',
        appName: 'pctusou',
        imageBase64: imageBase64,
        sortType: 'normal'
      })
    };
    
    const dataString = JSON.stringify(requestData);
    
    // 4. 生成签名
    console.log('正在生成签名...');
    const sign = generateSign(token, timestamp, appKey, dataString);
    
    // 5. 构建请求URL
    const url = `https://h5api.m.1688.com/h5/${api}/${version}/`;
    const params = new URLSearchParams({
      jsv: '2.7.2',
      appKey: appKey,
      t: timestamp.toString(),
      sign: sign,
      api: api,
      v: version,
      type: 'originaljson',
      dataType: 'json'
    });
    
    const fullUrl = `${url}?${params.toString()}`;
    
    // 6. 发送请求
    console.log('正在调用1688 API...');
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://s.1688.com',
        'Referer': 'https://s.1688.com/'
      },
      body: `data=${encodeURIComponent(dataString)}`,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('1688 API响应:', result);
    
    // 7. 检查响应
    if (result.ret && result.ret[0] === 'SUCCESS::调用成功') {
      if (result.data && result.data.success) {
        return {
          success: true,
          imageId: result.data.data?.imageId,
          results: result.data.result || [],
          message: '搜索成功'
        };
      } else {
        return {
          success: false,
          message: result.data?.message || '搜索失败'
        };
      }
    } else {
      return {
        success: false,
        message: result.ret ? result.ret[0] : '未知错误'
      };
    }
    
  } catch (error) {
    console.error('1688 API调用失败:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 打开1688搜索结果页面
 * @param {string} imageId - 图片ID
 */
function open1688SearchPage(imageId) {
  const searchUrl = `https://s.1688.com/youyuan/index.htm?imageId=${imageId}`;
  window.open(searchUrl, '_blank');
}

/**
 * 主函数：搜索1688同款
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<Object>} 搜索结果
 */
async function find1688Similar(imageUrl) {
  console.log('开始1688以图搜图:', imageUrl);
  
  // 调用API
  const result = await search1688ByImage(imageUrl);
  
  if (result.success && result.imageId) {
    console.log('搜索成功，图片ID:', result.imageId);
    // 打开搜索结果页面
    open1688SearchPage(result.imageId);
    return result;
  } else {
    console.error('搜索失败:', result.message);
    // 使用 console 提示替代 alert，避免阻塞 UI
    console.warn(`⚠️ 1688搜索失败: ${result.message}`);
    return result;
  }
}

// 导出函数
window.find1688Similar = find1688Similar;
window.search1688ByImage = search1688ByImage;
