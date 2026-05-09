// 修复类目ID类型问题
const fs = require('fs');

let content = fs.readFileSync('C:\\Users\\Administrator\\Desktop\\work\\ozon-smart-picker\\popup.js', 'utf8');

// 找到类目处理的代码，将字符串转换为数字
content = content.replace(
  /categories = catInput\.split\(','\)\.map\(c => c\.trim\(\)\)\.filter\(Boolean\);/g,
  'categories = catInput.split(\',\').map(c => parseInt(c.trim())).filter(n => !isNaN(n));'
);

fs.writeFileSync('C:\\Users\\Administrator\\Desktop\\work\\ozon-smart-picker\\popup.js', content, 'utf8');

console.log('✅ 修复完成！');
console.log('- 类目ID现在会被转换为数字类型');
console.log('- 过滤掉无效的类目ID');
