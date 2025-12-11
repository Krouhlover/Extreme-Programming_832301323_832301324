-- 创建数据库
CREATE DATABASE contact_db;

-- 创建用户（替换'your_password'为安全密码）
CREATE USER 'contact_app'@'localhost' IDENTIFIED BY 'contact_password';

-- 授予权限
GRANT ALL PRIVILEGES ON contact_db.* TO 'contact_app'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 切换到新数据库
USE contact_db;

-- init_database.sql
-- 创建联系人表
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    social_account VARCHAR(100),
    address TEXT,
    favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_phone (phone)
);

-- 创建索引以提高搜索性能
CREATE INDEX idx_name ON contacts(name);
CREATE INDEX idx_favorite ON contacts(favorite);
CREATE INDEX idx_phone ON contacts(phone);

-- 插入一些示例数据
INSERT INTO contacts (name, phone, email, social_account, address, favorite) VALUES
('张三', '13800138000', 'zhangsan@example.com', '@zhangsan', '北京市朝阳区', true),
('李四', '13900139000', 'lisi@example.com', '@lisi', '上海市浦东新区', false),
('王五', '13700137000', 'wangwu@example.com', '@wangwu', '广州市天河区', true),
('赵六', '13600136000', 'zhaoliu@example.com', '@zhaoliu', '深圳市南山区', false);contacts