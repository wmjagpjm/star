const fs = require('fs');

// 读取文件
let content = fs.readFileSync('C:\\Users\\Administrator\\Desktop\\work\\ozon-smart-picker\\popup.js', 'utf8');

// 替换所有出现的位置
content = content.replace(
  /exportResultsBtn\.disabled = extractedProducts\.length === 0;/g,
  'exportResultsBtn.disabled = extractedProducts.length === 0;\n        find1688Btn.disabled = extractedProducts.length === 0;'
);

// 写回文件
fs.writeFileSync('C:\\Users\\Administrator\\Desktop\\work\\ozon-smart-picker\\popup.js', content, 'utf8');

console.log('✅ 修改完成！');
