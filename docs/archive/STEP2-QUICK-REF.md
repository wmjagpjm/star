# 🎯 第 2 步快速参考卡

## 📍 当前位置
**第 2 步**: 逆向 Ozon Seller 上架接口  
**目标**: 记录 API 接口，创建文档  
**时间**: 2-3 小时

---

## ⚡ 快速开始

### 1. 打开页面
```
https://seller.ozon.ru/app/products/add
```

### 2. 开发者工具
- 按 `F12`
- Network → XHR
- ✅ Preserve log

### 3. 创建测试商品
- 标题: `测试商品 - 请勿购买`
- 价格: 1000
- 原价: 1500
- 库存: 10

### 4. 记录请求
- 右键 → Copy as cURL
- 粘贴到文件

---

## 🎯 必须找到的接口

| # | 接口 | 关键词 | 优先级 |
|---|------|--------|--------|
| 1 | 类目列表 | category, list | ⭐⭐ |
| 2 | 图片上传 | upload, image | ⭐⭐⭐ |
| 3 | 创建商品 | product, create, import | ⭐⭐⭐⭐⭐ |
| 4 | 查询状态 | status, task | ⭐⭐⭐ |

---

## 🔑 关键信息

### Authorization Token
```
位置: Request Headers
格式: Bearer eyJhbGci...
```

### Company ID
```
位置: Request Headers
字段: x-o3-company-id
格式: 123456
```

### 商品数据结构
```json
{
  "items": [{
    "name": "标题",
    "category_id": 12345,
    "price": "1000",
    "old_price": "1500",
    "images": ["URL"],
    "attributes": [...]
  }]
}
```

---

## 📝 记录模板

```
=== 接口名称 ===
URL: 
Method: 
Headers:
  Authorization: Bearer ...
  x-o3-company-id: ...
  Content-Type: application/json

Request Body:
{...}

Response:
{...}

备注:
- 必填字段: 
- 可选字段: 
```

---

## ⚠️ 注意

- ❌ 不要提交真实商品
- ❌ 不要泄露 Token
- ✅ 记录完整信息
- ✅ 保存截图

---

## ✅ 完成标准

- [ ] 找到创建商品接口
- [ ] 记录完整请求/响应
- [ ] 创建 OZON-SELLER-API.md
- [ ] Postman 验证成功

---

## 📚 相关文档

- `STEP2-GUIDE.md` - 详细指南
- `STEP2-CHECKLIST.md` - 完整清单
- `IMPLEMENTATION-GUIDE.md` - 实施指南

---

## 🆘 遇到问题？

### 找不到接口
→ 取消过滤器，搜索 "product"

### 请求太多
→ 按 URL 排序，看 Body 大小

### 无法重放
→ 重新获取 Token

---

## 🎉 完成后

1. 提交 `OZON-SELLER-API.md`
2. 开始第 3 步
3. 实现上架功能

---

**预计时间**: 2-3 小时  
**当前进度**: 87.5%  
**完成后**: 95%

🚀 **加油！最后一步了！**
