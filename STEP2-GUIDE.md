# 🎯 第 2 步：逆向 Ozon Seller 上架接口 - 详细操作手册

## 📋 准备工作

### 需要的工具
- ✅ Chrome 浏览器
- ✅ Ozon Seller 账号（已登录）
- ✅ 文本编辑器（记录数据）
- ✅ Postman（可选，用于测试接口）

### 预计时间
- 操作时间：30-60 分钟
- 整理时间：2-3 小时
- **总计：3-4 小时**

---

## 🚀 操作步骤

### 步骤 1：打开 Ozon Seller 后台

1. **访问上架页面**
   ```
   https://seller.ozon.ru/app/products/add
   ```

2. **确认已登录**
   - 如果未登录，先登录账号
   - 确保有商品上架权限

---

### 步骤 2：配置开发者工具

1. **打开开发者工具**
   - 按 `F12` 或 `Ctrl+Shift+I`

2. **切换到 Network 标签**
   - 点击顶部的 "Network"

3. **配置过滤器**
   - 勾选 "Preserve log"（保留日志）
   - 在过滤器中选择 "XHR"
   - 清空现有记录（点击 🚫 图标）

4. **准备记录**
   - 打开文本编辑器
   - 创建文件：`ozon-seller-api-capture.txt`

---

### 步骤 3：手动创建测试商品

**重要**：创建一个简单的测试商品，记录每一步的请求

#### 3.1 填写基本信息

1. **商品标题**
   ```
   测试商品 - 请勿购买
   ```

2. **选择类目**
   - 选择任意简单类目（如：家居用品）
   - **记录类目 ID**

3. **观察 Network**
   - 查看是否有新的 XHR 请求
   - 右键点击请求 → Copy → Copy as cURL
   - 粘贴到记录文件

#### 3.2 上传图片

1. **上传一张测试图片**

2. **记录图片上传请求**
   - 找到包含 "upload" 或 "image" 的请求
   - 记录：
     ```
     接口: POST https://...
     Headers: {...}
     Body: {...}
     Response: {...}
     ```

#### 3.3 填写价格和库存

1. **填写价格**
   ```
   价格: 1000
   原价: 1500
   ```

2. **填写库存**
   ```
   库存: 10
   ```

3. **记录相关请求**

#### 3.4 填写属性

1. **填写必填属性**
   - 品牌、材质等

2. **记录属性相关请求**

#### 3.5 提交商品

1. **点击"保存"或"发布"按钮**

2. **重点记录提交请求**
   - 这是最关键的请求
   - 包含完整的商品数据结构
   - 记录完整的 Request 和 Response

---

### 步骤 4：整理记录的数据

创建文件：`OZON-SELLER-API.md`

#### 模板：

```markdown
# Ozon Seller 上架接口文档

## 接口 1：获取类目列表

**URL**: `GET https://seller.ozon.ru/api/...`

**Headers**:
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json",
  "x-o3-company-id": "{company_id}"
}
```

**Response**:
```json
{
  "result": [...]
}
```

---

## 接口 2：上传图片

**URL**: `POST https://seller.ozon.ru/api/...`

**Headers**:
```json
{...}
```

**Request Body**:
```json
{...}
```

**Response**:
```json
{...}
```

---

## 接口 3：创建商品（核心）

**URL**: `POST https://seller.ozon.ru/api/...`

**Headers**:
```json
{...}
```

**Request Body**:
```json
{
  "items": [
    {
      "name": "商品标题",
      "category_id": 12345,
      "price": "1000",
      "old_price": "1500",
      "images": ["图片URL"],
      "attributes": [...]
    }
  ]
}
```

**Response**:
```json
{
  "result": {
    "task_id": 123456
  }
}
```

---

## 接口 4：查询上架状态

**URL**: `GET https://seller.ozon.ru/api/...`

**Response**:
```json
{...}
```
```

---

### 步骤 5：使用 Postman 验证

1. **导入 cURL**
   - 打开 Postman
   - Import → Raw text
   - 粘贴 cURL 命令

2. **修改参数**
   - 修改商品标题
   - 修改价格

3. **发送请求**
   - 点击 Send
   - 查看响应

4. **验证成功**
   - 检查是否创建成功
   - 记录成功的参数格式

---

## 📝 记录清单

### 必须记录的信息

- [ ] 类目选择接口
- [ ] 图片上传接口
- [ ] 商品创建接口（核心）
- [ ] 上架状态查询接口
- [ ] Authorization token 格式
- [ ] company_id 获取方式
- [ ] 必填字段列表
- [ ] 属性字段格式

### 可选记录的信息

- [ ] 草稿保存接口
- [ ] 商品编辑接口
- [ ] 商品删除接口
- [ ] 批量上架接口

---

## 🎯 关键点

### 1. Authorization Token

**位置**：Request Headers

**格式**：
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**获取方式**：
- 从任意 XHR 请求的 Headers 中复制
- 或从 localStorage/cookie 中读取

### 2. Company ID

**位置**：Request Headers

**格式**：
```
x-o3-company-id: 123456
```

**获取方式**：
- 从 XHR 请求的 Headers 中复制
- 或从页面 URL 中提取

### 3. 商品数据结构

**重点关注**：
- 必填字段
- 字段类型（string/number/array）
- 嵌套结构
- 枚举值

---

## ⚠️ 注意事项

1. **不要提交真实商品**
   - 使用测试数据
   - 标题加上"测试"字样

2. **保护敏感信息**
   - Token 不要泄露
   - Company ID 不要公开

3. **记录完整信息**
   - Request 和 Response 都要记录
   - 错误响应也要记录

4. **多次测试**
   - 测试不同的类目
   - 测试不同的属性组合

---

## 📞 遇到问题？

### 问题 1：找不到上架接口

**可能原因**：
- 请求被过滤掉了
- 使用了其他方式上架

**解决方法**：
- 取消所有过滤器
- 尝试不同的上架入口
- 查看 Fetch/XHR 标签

### 问题 2：请求太多，不知道哪个是关键的

**识别方法**：
- 看 URL 中包含 "product"、"create"、"import"
- 看 Request Body 中包含商品数据
- 看 Response 中返回 task_id 或 product_id

### 问题 3：无法重放请求

**可能原因**：
- Token 过期
- 参数格式错误

**解决方法**：
- 重新获取 Token
- 仔细检查参数格式

---

## ✅ 完成标准

- [ ] 已记录至少 3 个关键接口
- [ ] 已保存完整的 cURL 命令
- [ ] 已创建 OZON-SELLER-API.md
- [ ] 已用 Postman 验证接口可用
- [ ] 已理解商品数据结构

---

**预计完成时间**：3-4 小时  
**下一步**：第 3 步 - 实现上架功能

🚀 **开始吧！**
