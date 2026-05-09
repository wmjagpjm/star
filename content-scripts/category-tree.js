// category-tree.js
let categoryTree = null;

async function fetchCategoryTree() {
  if (categoryTree) return categoryTree;

  try {
    const [sellerTab] = await chrome.tabs.query({ url: '*://seller.ozon.ru/*' });
    if (!sellerTab || !sellerTab.id) {
      console.error('[category-tree] 未找到 seller.ozon.ru Tab');
      return null;
    }

    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(sellerTab.id, {
        type: 'OZON_DESC_CATEGORY_TREE',
        language: 'ZH_HANS'
      }, resolve);
    });

    if (resp && resp.success && resp.data) {
      categoryTree = resp.data;
      console.log('[category-tree] 获取成功，类目数:', Object.keys(categoryTree).length);
      return categoryTree;
    } else {
      console.error('[category-tree] 获取失败:', resp);
      return null;
    }
  } catch (e) {
    console.error('[category-tree] 获取异常:', e);
    return null;
  }
}

function flattenCategoryTree(tree, prefix) {
  prefix = prefix || '';
  var result = [];
  if (!tree) return result;

  var keys = Object.keys(tree);
  keys.forEach(function(key) {
    var node = tree[key];
    var name = prefix ? prefix + ' > ' + node.descriptionCategoryName : node.descriptionCategoryName;
    var id = node.descriptionCategoryId;
    if (id) result.push({ id: id, name: name });

    if (node.nodes && Object.keys(node.nodes).length > 0) {
      var children = flattenCategoryTree(node.nodes, name);
      children.forEach(function(child) { result.push(child); });
    }
  });

  return result;
}

function getCategoryPath(categoryId, tree, path) {
  path = path || '';
  if (!tree) return null;

  var keys = Object.keys(tree);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var node = tree[key];
    var currentPath = path ? path + ' > ' + node.descriptionCategoryName : node.descriptionCategoryName;

    if (key === categoryId) return currentPath;

    if (node.nodes && Object.keys(node.nodes).length > 0) {
      var found = getCategoryPath(categoryId, node.nodes, currentPath);
      if (found) return found;
    }
  }
  return null;
}

window.categoryTreeUtils = {
  fetchCategoryTree: fetchCategoryTree,
  flattenCategoryTree: flattenCategoryTree,
  getCategoryPath: getCategoryPath
};
