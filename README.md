# 📇 通讯录管理系统

> 小组极限编程作业项目

一个功能完整的通讯录管理系统，支持联系人的增删改查、搜索、收藏、分页以及 Excel 导入导出等功能。

## ✨ 功能特性

- 📝 **联系人管理**：添加、编辑、删除联系人信息
- 🔍 **智能搜索**：支持按姓名、电话、邮箱等多字段搜索
- ⭐ **收藏功能**：标记常用联系人，快速筛选收藏项
- 📄 **分页显示**：支持分页浏览，提升用户体验
- 📊 **Excel 导入导出**：支持批量导入和导出联系人数据
- 🎨 **简洁界面**：现代化的用户界面设计
- 🐳 **Docker 部署**：支持一键部署，开箱即用

## 🛠️ 技术栈

- **前端**：HTML + CSS + JavaScript
- **后端**：Node.js + Express
- **数据库**：MySQL 8.0
- **部署**：Docker + Docker Compose + Nginx

## 📦 项目结构

```
.
├── frontend/          # 前端代码
│   ├── index.html    # 主页面
│   ├── app.js        # 前端逻辑
│   └── style.css     # 样式文件
├── backend/          # 后端代码
│   ├── server.js     # 服务器主文件
│   ├── src/          # 源代码目录
│   ├── init_database.sql  # 数据库初始化脚本
│   └── package.json  # 依赖配置
├── nginx/            # Nginx 配置
├── docker-compose.yml # Docker Compose 配置
└── start.sh          # 一键启动脚本
```

## 🚀 快速开始

### 方式一：Docker 部署（推荐）🐳

1. **确保已安装 Docker 和 Docker Compose**

2. **一键启动所有服务**
   ```bash
   bash start.sh
   ```
   或手动执行：
   ```bash
   docker-compose up -d
   ```

3. **访问应用**
   - 前端界面：http://localhost
   - 后端 API：http://localhost:3000

### 方式二：本地部署 💻

#### 前置要求

- Node.js (推荐 v16+)
- MySQL 8.0+

#### 部署步骤

1. **初始化数据库**
   ```bash
   # 登录 MySQL
   mysql -u root -p
   
   # 执行初始化脚本
   source backend/init_database.sql
   ```

2. **安装后端依赖**
   ```bash
   cd backend
   npm install
   npm install xlsx
   ```

3. **启动后端服务**
   ```bash
   npm start
   ```

4. **启动前端**
   - 使用任意 HTTP 服务器（如 Live Server）打开 `frontend/index.html`
   - 或使用 Python 简单服务器：
     ```bash
     cd frontend
     python -m http.server 8080
     ```
   - 访问：http://localhost:8080

## 📡 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/contacts` | 获取联系人列表（支持搜索、分页、收藏筛选） |
| POST | `/api/contacts` | 创建新联系人 |
| PATCH | `/api/contacts/:id` | 更新联系人信息 |
| DELETE | `/api/contacts/:id` | 删除联系人 |
| GET | `/api/contacts/export` | 导出所有联系人为 Excel |
| POST | `/api/contacts/import` | 从 Excel 导入联系人 |

### 查询参数示例

```
GET /api/contacts?q=张三&favoriteOnly=1&page=1&pageSize=8
```

- `q`: 搜索关键词（可选）
- `favoriteOnly`: 是否仅显示收藏（0/1，可选）
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 8）

## 🗄️ 数据库配置

### 默认配置

- **数据库名**：`contact_db`
- **用户名**：`contact_app`
- **密码**：`contact_password`
- **端口**：`3306`

### 环境变量（Docker 部署）

可通过环境变量修改数据库配置：

```yaml
DB_HOST: mysql
DB_USER: contact_app
DB_PASSWORD: contact_password
DB_NAME: contact_db
```

## 📋 常用命令

### Docker 相关

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f              # 所有服务
docker-compose logs -f backend       # 后端日志
docker-compose logs -f mysql         # 数据库日志
docker-compose logs -f nginx         # Nginx 日志

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build
```

## ⚠️ 注意事项

1. **数据库初始化**：本地部署前务必先执行 `init_database.sql` 初始化数据库
2. **端口占用**：确保 80、3000、3306 端口未被占用
3. **字符编码**：数据库使用 `utf8mb4` 字符集，支持中文和 emoji
4. **电话唯一性**：系统要求电话号码唯一，重复电话无法添加

## 🐛 问题排查

### 后端无法连接数据库

- 检查 MySQL 服务是否启动
- 确认数据库配置是否正确
- 验证数据库用户权限

### 前端无法访问后端

- 检查后端服务是否正常运行（端口 3000）
- 查看浏览器控制台错误信息
- 确认 CORS 配置是否正确

### Docker 容器启动失败

- 查看容器日志：`docker-compose logs`
- 检查端口是否被占用
- 确认 Docker 服务正常运行

## 📝 开发说明

本项目为小组极限编程作业，采用前后端分离架构，使用 RESTful API 进行数据交互。

---

**祝使用愉快！** 🎉
