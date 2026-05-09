# ✅ 第 2 步执行检查清单

## 📋 开始前准备

### 环境检查
- [ ] Chrome 浏览器已安装
- [ ] 已登录 Ozon Seller 账号
- [ ] 有商品上架权限
- [ ] 文本编辑器已打开
- [ ] 已阅读 `STEP2-GUIDE.md`

### 工具准备
- [ ] 创建记录文件：`ozon-seller-api-capture.txt`
- [ ] 创建文档文件：`OZON-SELLER-API.md`
- [ ] Postman 已安装（可选）

---

## 🎯 执行步骤

### 阶段 1：配置开发者工具 (5 分钟)

- [ ] 打开 `https://seller.ozon.ru/app/products/add`
- [ ] 按 F12 打开开发者工具
- [ ] 切换到 Network 标签
- [ ] 勾选 "Preserve log"
- [ ] 选择 "XHR" 过滤器
- [ ] 清空现有记录

**截图保存位置**: `screenshots/step2-devtools.png`

---

### 阶段 2：记录类目选择 (10 分钟)

- [ ] 点击类目选择框
- [ ] 观察 Network 中的请求
- [ ] 找到类目列表接口
- [ ] 右键 → Copy → Copy as cURL
- [ ] 粘贴到 `ozon-seller-api-capture.txt`

**记录内容**:
```
=== 接口 1: 获取类目列表 ===
URL: 
Method: 
Headers:
  Authorization: 
  x-o3-company-id: 
Response:
```

---

### 阶段 3：记录图片上传 (10 分钟)

- [ ] 上传一张测试图片
- [ ] 找到图片上传接口
- [ ] 记录完整的请求和响应
- [ ] 注意图片 URL 的返回格式

**记录内容**:
```
=== 接口 2: 上传图片 ===
URL: 
Method: POST
Headers:
Request Body:
Response:
  - 图片 URL: 
```

---

### 阶段 4：记录商品创建（核心）(20 分钟)

- [ ] 填写商品标题：`测试商品 - 请勿购买`
- [ ] 选择类目
- [ ] 填写价格：1000
- [ ] 填写原价：1500
- [ ] 填写库存：10
- [ ] 填写必填属性
- [ ] 点击"保存"或"发布"
- [ ] **重点记录这个请求**

**记录内容**:
```
=== 接口 3: 创建商品（核心）===
URL: 
Method: POST
Headers:
  Authorization: 
  Content-Type: 
  x-o3-company-id: 

Request Body:
{
  "items": [
    {
      "name": "...",
      "category_id": ...,
      "price": "...",
      "old_price": "...",
      "images": [...],
      "attributes": [...]
    }
  ]
}

Response:
{
  "result": {
    "task_id": ...
  }
}
```

---

### 阶段 5：记录状态查询 (10 分钟)

- [ ] 提交后观察后续请求
- [ ] 找到状态查询接口
- [ ] 记录查询参数和响应

**记录内容**:
```
=== 接口 4: 查询上架状态 ===
URL: 
Method: GET
Query Params:
  task_id: 
Response:
  - status: 
  - product_id: 
```

---

### 阶段 6：整理文档 (30 分钟)

- [ ] 创建 `OZON-SELLER-API.md`
- [ ] 按模板整理所有接口
- [ ] 标注必填字段
- [ ] 标注字段类型
- [ ] 添加示例数据

**模板**:
```markdown
# Ozon Seller 上架接口文档

## 1. 获取类目列表
...

## 2. 上传图片
...

## 3. 创建商品（核心）
...

## 4. 查询上架状态
...

## 5. 字段说明
...

## 6. 错误码
...
```

---

### 阶段 7：Postman 验证 (20 分钟)

- [ ] 打开 Postman
- [ ] Import → Raw text
- [ ] 粘贴 cURL 命令
- [ ] 修改测试数据
- [ ] 发送请求
- [ ] 验证响应
- [ ] 记录成功案例

---

## 🎯 关键信息清单

### 必须记录的信息

#### Authorization Token
- [ ] 格式：`Bearer eyJhbGci...`
- [ ] 获取位置：Request Headers
- [ ] 有效期：记录获取时间

#### Company ID
- [ ] 格式：`123456`
- [ ] 获取位置：Request Headers (`x-o3-company-id`)
- [ ] 是否固定：测试多次确认

#### 商品数据结构
- [ ] 必填字段列表
- [ ] 字段类型（string/number/array）
- [ ] 嵌套结构
- [ ] 枚举值（如：发货方式）

#### 图片处理
- [ ] 上传接口
- [ ] 图片 URL 格式
- [ ] 是否需要预处理

#### 类目信息
- [ ] 类目 ID 格式
- [ ] 类目层级结构
- [ ] 必填属性列表

---

## ⚠️ 注意事项

### 安全
- [ ] 不要提交真实商品
- [ ] Token 不要泄露
- [ ] Company ID 不要公开

### 记录
- [ ] Request 和 Response 都要记录
- [ ] 错误响应也要记录
- [ ] 截图保存关键步骤

### 测试
- [ ] 测试不同类目
- [ ] 测试不同属性组合
- [ ] 测试必填/可选字段

---

## 📊 进度追踪

### 时间分配
- [ ] 配置工具：5 分钟
- [ ] 记录类目：10 分钟
- [ ] 记录图片：10 分钟
- [ ] 记录创建：20 分钟
- [ ] 记录状态：10 分钟
- [ ] 整理文档：30 分钟
- [ ] Postman 验证：20 分钟
- [ ] 休息缓冲：15 分钟

**总计**: 2 小时

### 完成标准
- [ ] 已记录至少 3 个关键接口
- [ ] 已保存完整的 cURL 命令
- [ ] 已创建 OZON-SELLER-API.md
- [ ] 已用 Postman 验证接口可用
- [ ] 已理解商品数据结构
- [ ] 已标注所有必填字段

---

## 🆘 问题处理

### 问题 1：找不到关键接口
**解决**:
- 取消所有过滤器
- 查看 Fetch/XHR 标签
- 搜索关键词：product, create, import

### 问题 2：请求太多
**解决**:
- 按 URL 排序
- 看 Request Body 大小
- 看 Response 内容

### 问题 3：无法重放
**解决**:
- 重新获取 Token
- 检查参数格式
- 查看错误信息

---

## ✅ 完成后

### 提交成果
- [ ] `ozon-seller-api-capture.txt` - 原始记录
- [ ] `OZON-SELLER-API.md` - 整理后的文档
- [ ] `screenshots/` - 关键截图
- [ ] Postman Collection（可选）

### 下一步
- [ ] 阅读 `IMPLEMENTATION-GUIDE.md` 第 3 步
- [ ] 准备实现上架功能
- [ ] 预计时间：4-5 小时

---

## 🎉 激励

**你正在做的是**:
- 🔓 解锁最后一个核心功能
- 🚀 让插件真正实现自动化
- 💪 掌握 Ozon Seller API

**完成后你将拥有**:
- ✅ 完整的 API 文档
- ✅ 可复用的接口知识
- ✅ 实现上架的能力

---

**预计完成时间**: 2-3 小时  
**难度**: ⭐⭐⭐ 中等  
**重要性**: ⭐⭐⭐⭐⭐ 非常重要

🚀 **开始吧！你可以的！**
