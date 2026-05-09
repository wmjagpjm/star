// Content Script - 1688 以图搜图 API 调用
// 运行在所有页面上，负责从 1688.com 域发起 MTOP API 调用（具备正确的 SameSite Cookie）

(function() {
  console.log('[1688 Content] 已加载');

  // ========== 读取 _m_h5_tk Cookie（仅在 1688 页面有效） ==========
  function getTokenFromDocument() {
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var parts = cookies[i].trim().split('=');
        if (parts[0] === '_m_h5_tk') {
          return parts.slice(1).join('='); // 完整值
        }
      }
    } catch (e) {}
    return null;
  }

  // ========== MD5（纯 JS 实现） ==========
  function md5(s) {
    function r(v,s){return(v<<s)|(v>>>(32-s))}
    function a(x,y){var l=(x&0xffff)+(y&0xffff);return(((x>>16)+(y>>16)+(l>>16))<<16)|(l&0xffff)}
    function f(a,b,c,d,x,s,t){return a(r(a(a,a(b&c|~b&d),a(x,t)),s),b)}
    function g(a,b,c,d,x,s,t){return a(r(a(a,a(b&d|c&~d),a(x,t)),s),b)}
    function h(a,b,c,d,x,s,t){return a(r(a(a,a(b^c^d),a(x,t)),s),b)}
    function i(a,b,c,d,x,s,t){return a(r(a(a,a(c^(b|~d)),a(x,t)),s),b)}
    function w(s){var l=[];for(var i=0;i<s.length*8;i+=8)l[i>>5]|=(s.charCodeAt(i/8)&0xff)<<(i%32);return l}
    function x(v){var h='';for(var i=0;i<4;i++)h+=((v>>(i*8+4))&0xf).toString(16)+((v>>(i*8))&0xf).toString(16);return h}
    function u(s){return s.replace(/\r\n/g,'\n').replace(/[\x80-\xff]/g,function(c){var n=c.charCodeAt(0);return n<0x800?String.fromCharCode(n>>6|0xc0,n&0x3f|0x80):String.fromCharCode(n>>12|0xe0,n>>6&0x3f|0x80,n&0x3f|0x80)})}
    var l=w(u(s)),A=0x67452301,B=0xefcdab89,C=0x98badcfe,D=0x10325476;
    for(var k=0;k<l.length;k+=16){var AA=A,BB=B,CC=C,DD=D;
      A=f(A,B,C,D,l[k+0],7,0xd76aa478);D=f(D,A,B,C,l[k+1],12,0xe8c7b756);C=f(C,D,A,B,l[k+2],17,0x242070db);B=f(B,C,D,A,l[k+3],22,0xc1bdceee);
      A=f(A,B,C,D,l[k+4],7,0xf57c0faf);D=f(D,A,B,C,l[k+5],12,0x4787c62a);C=f(C,D,A,B,l[k+6],17,0xa8304613);B=f(B,C,D,A,l[k+7],22,0xfd469501);
      A=f(A,B,C,D,l[k+8],7,0x698098d8);D=f(D,A,B,C,l[k+9],12,0x8b44f7af);C=f(C,D,A,B,l[k+10],17,0xffff5bb1);B=f(B,C,D,A,l[k+11],22,0x895cd7be);
      A=f(A,B,C,D,l[k+12],7,0x6b901122);D=f(D,A,B,C,l[k+13],12,0xfd987193);C=f(C,D,A,B,l[k+14],17,0xa679438e);B=f(B,C,D,A,l[k+15],22,0x49b40821);
      A=g(A,B,C,D,l[k+1],5,0xf61e2562);D=g(D,A,B,C,l[k+6],9,0xc040b340);C=g(C,D,A,B,l[k+11],14,0x265e5a51);B=g(B,C,D,A,l[k+0],20,0xe9b6c7aa);
      A=g(A,B,C,D,l[k+5],5,0xd62f105d);D=g(D,A,B,C,l[k+10],9,0x02441453);C=g(C,D,A,B,l[k+15],14,0xd8a1e681);B=g(B,C,D,A,l[k+4],20,0xe7d3fbc8);
      A=g(A,B,C,D,l[k+9],5,0x21e1cde6);D=g(D,A,B,C,l[k+14],9,0xc33707d6);C=g(C,D,A,B,l[k+3],14,0xf4d50d87);B=g(B,C,D,A,l[k+8],20,0x455a14ed);
      A=g(A,B,C,D,l[k+13],5,0xa9e3e905);D=g(D,A,B,C,l[k+2],9,0xfcefa3f8);C=g(C,D,A,B,l[k+7],14,0x676f02d9);B=g(B,C,D,A,l[k+12],20,0x8d2a4c8a);
      A=h(A,B,C,D,l[k+5],4,0xfffa3942);D=h(D,A,B,C,l[k+8],11,0x8771f681);C=h(C,D,A,B,l[k+11],16,0x6d9d6122);B=h(B,C,D,A,l[k+14],23,0xfde5380c);
      A=h(A,B,C,D,l[k+1],4,0xa4beea44);D=h(D,A,B,C,l[k+4],11,0x4bdecfa9);C=h(C,D,A,B,l[k+7],16,0xf6bb4b60);B=h(B,C,D,A,l[k+10],23,0xbebfbc70);
      A=h(A,B,C,D,l[k+13],4,0x289b7ec6);D=h(D,A,B,C,l[k+0],11,0xeaa127fa);C=h(C,D,A,B,l[k+3],16,0xd4ef3085);B=h(B,C,D,A,l[k+6],23,0x04881d05);
      A=h(A,B,C,D,l[k+9],4,0xd9d4d039);D=h(D,A,B,C,l[k+12],11,0xe6db99e5);C=h(C,D,A,B,l[k+15],16,0x1fa27cf8);B=h(B,C,D,A,l[k+2],23,0xc4ac5665);
      A=i(A,B,C,D,l[k+0],6,0xf4292244);D=i(D,A,B,C,l[k+7],10,0x432aff97);C=i(C,D,A,B,l[k+14],15,0xab9423a7);B=i(B,C,D,A,l[k+5],21,0xfc93a039);
      A=i(A,B,C,D,l[k+12],6,0x655b59c3);D=i(D,A,B,C,l[k+3],10,0x8f0ccc92);C=i(C,D,A,B,l[k+10],15,0xffeff47d);B=i(B,C,D,A,l[k+1],21,0x85845dd1);
      A=i(A,B,C,D,l[k+8],6,0x6fa87e4f);D=i(D,A,B,C,l[k+15],10,0xfe2ce6e0);C=i(C,D,A,B,l[k+6],15,0xa3014314);B=i(B,C,D,A,l[k+13],21,0x4e0811a1);
      A=i(A,B,C,D,l[k+4],6,0xf7537e82);D=i(D,A,B,C,l[k+11],10,0xbd3af235);C=i(C,D,A,B,l[k+2],15,0x2ad7d2bb);B=i(B,C,D,A,l[k+9],21,0xeb86d391);
      A=a(A,AA);B=a(B,BB);C=a(C,CC);D=a(D,DD);
    }
    return x(A)+x(B)+x(C)+x(D);
  }
  function generateSign(token, ts, appKey, data) { return md5(token+'&'+ts+'&'+appKey+'&'+data); }

  // ========== 图片转 Base64（从当前页面域发起 fetch） ==========
  async function fetchImageAsBase64(imageUrl) {
    if (imageUrl && imageUrl.indexOf('data:') === 0) {
      var comma = imageUrl.indexOf(',');
      if (comma > -1) return imageUrl.slice(comma + 1);
    }
    // 从当前页面的域发起 fetch — 不受 CORS 限制
    try {
      var resp = await fetch(imageUrl, { mode: 'cors' });
      if (!resp.ok) throw new Error('fetch failed: ' + resp.status);
      var blob = await resp.blob();
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result.split(',')[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('[1688] fetch失败:', e.message);
      return null;
    }
  }

  // ========== MTOP API 调用（从当前页面域发起，Cookie 自动带上） ==========
  async function callMtopApi(token, imageBase64) {
    var ts = Date.now(), appKey = '12574478', api = 'mtop.relationrecommend.wirelessrecommend.recommend', ver = '2.0';
    var reqData = { appId: 32517, params: JSON.stringify({ beginPage: 1, pageSize: 60, searchScene: 'pcImageSearch', method: 'uploadBase64WithRequest', appName: 'pctusou', imageBase64: imageBase64, sortType: 'normal' }) };
    var ds = JSON.stringify(reqData), sign = generateSign(token, ts, appKey, ds);
    var p = 'jsv=2.7.2&appKey='+appKey+'&t='+ts+'&sign='+sign+'&api='+api+'&v='+ver+'&type=originaljson&dataType=json&data='+encodeURIComponent(ds);
    var url = 'https://h5api.m.1688.com/h5/'+api+'/'+ver+'/';
    console.log('[1688 Content] 发起 API 调用...');
    
    try {
      var resp = await fetch(url+'?'+p, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data='+encodeURIComponent(ds),
        credentials: 'include'
      });
      if (!resp.ok) {
        console.error('[1688 Content] HTTP失败:', resp.status);
        return { success: false, message: 'HTTP '+resp.status, httpStatus: resp.status };
      }
      var r = await resp.json();
      console.log('[1688 Content] API响应:', JSON.stringify(r).slice(0,500));
      
      var retMsg = r.ret && r.ret[0] ? r.ret[0] : '';
      if (retMsg.indexOf('SUCCESS') > -1 && r.data && r.data.success !== false) {
        var results = r.data.result || [];
        return { success: true, imageId: r.data.data?.imageId, results: results, message: '搜索成功' };
      }
      return { success: false, message: retMsg || '搜索失败', raw: r };
    } catch (e) {
      console.error('[1688 Content] API异常:', e);
      return { success: false, message: e.message };
    }
  }

  // ========== 主搜索函数（从当前页面域发起，token 由页面 cookie 提供或传入） ==========
  async function search1688ByImage(imageUrl, providedToken) {
    try {
      // 1. 获取 token
      var token = providedToken;
      if (!token) {
        token = getTokenFromDocument();
        if (!token) {
          return { success: false, message: '未检测到1688登录（无法读取 _m_h5_tk）', needsLogin: true };
        }
      }
      // _m_h5_tk 格式通常为 {token}_{hash}，签名需要第一部分
      var signToken = token.split('_')[0] || token;
      console.log('[1688 Content] Token:', signToken.slice(0,10)+'...');

      // 2. 图片转 base64
      var imageBase64 = await fetchImageAsBase64(imageUrl);
      if (!imageBase64) return { success: false, message: '图片加载失败' };
      console.log('[1688 Content] 图片已加载:', Math.round(imageBase64.length/1024)+'KB');

      // 3. 调用 MTOP API
      var result = await callMtopApi(signToken, imageBase64);
      console.log('[1688 Content] 结果:', result.success ? '成功' : '失败', result.message);
      return result;
    } catch (e) {
      console.error('[1688 Content] 搜索异常:', e);
      return { success: false, message: e.message };
    }
  }

  // ========== 消息监听 ==========
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // 新接口：直接从 1688 页面域调用
    if (request.action === 'search1688ByImage') {
      search1688ByImage(request.imageUrl, request.token || null)
        .then(function(result) { sendResponse(result); })
        .catch(function(error) { sendResponse({ success: false, message: error.message }); });
      return true; // 异步回复标记
    }
    
    // 旧接口保留兼容
    if (request.action === 'search1688ByImageWithToken') {
      search1688ByImage(request.imageUrl, request.token)
        .then(function(result) { sendResponse(result); })
        .catch(function(error) { sendResponse({ success: false, message: error.message }); });
      return true;
    }
  });
})();
