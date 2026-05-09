// 修复脚本：只在获取实时价格后启用1688按钮
const fs = require('fs');

let content = fs.readFileSync('C:\\Users\\Administrator\\Desktop\\work\\ozon-smart-picker\\popup.js', 'utf8');

// 1. 先移除所有之前添加的 find1688Btn.disabled 行
content = content.replace(/\s*find1688Btn\.disabled = extractedProducts\.length === 0;/g, '');

// 2. 在 fetchRealTimePrices 函数的成功完成处添加启用逻辑
// 找到 "完成！" 或 "成功" 的 showStatus，在其后添加启用按钮的代码

// 在显示成功状态后启用按钮
content = content.replace(
  /(showStatus\(`✅ 完成！\$\{extractedProducts\.length\} 个有低价推荐的FBS商品[^`]*`[^;]*;)/g,
  '$1\n            find1688Btn.disabled = false; // 获取实时价格后启用'
);

content = content.replace(
  /(showStatus\(`✅ \$\{extractedProducts\.length\} 个商品[^`]*`[^;]*;)/g,
  '$1\n          find1688Btn.disabled = false; // 获取实时价格后启用'
);

// 3. 在初始化时禁用按钮
content = content.replace(
  /(const find1688Btn = document\.getElementById\('find1688'\);)/,
  '$1\n  find1688Btn.disabled = true; // 初始禁用，等待获取实时价格'
);

fs.writeFileSync('C:\\Users\\Administrator\\Desktop\\work\\ozon-smart-picker\\popup.js', content, 'utf8');

console.log('✅ 修改完成！');
console.log('- 移除了所有旧的启用逻辑');
console.log('- 只在获取实时价格成功后启用按钮');
console.log('- 初始状态设为禁用');
