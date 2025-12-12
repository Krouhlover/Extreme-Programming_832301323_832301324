-- Docker 环境数据库初始化脚本
-- 注意：数据库和用户已通过 Docker 环境变量创建，这里只需要创建表结构

-- 切换到数据库（如果还没有切换）
USE contact_db;

-- 设置数据库字符集为 utf8mb4（支持完整的 UTF-8，包括 emoji）
ALTER DATABASE contact_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建联系人表（使用 utf8mb4 字符集）
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    social_account VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    address TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建索引以提高搜索性能
-- 注意：这是初始化脚本，首次运行时索引不存在，直接创建即可
-- 如果索引已存在（脚本被多次执行），MySQL 会报错但可以忽略
CREATE INDEX idx_name ON contacts(name);
CREATE INDEX idx_favorite ON contacts(favorite);
CREATE INDEX idx_phone ON contacts(phone);

-- 插入一些示例数据（如果表为空）
INSERT INTO contacts (name, phone, email, social_account, address, favorite) 
SELECT * FROM (SELECT '张三' as name, '13800138000' as phone, 'zhangsan@example.com' as email, '@zhangsan' as social_account, '北京市朝阳区' as address, true as favorite) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE phone = '13800138000');

INSERT INTO contacts (name, phone, email, social_account, address, favorite) 
SELECT * FROM (SELECT '李四' as name, '13900139000' as phone, 'lisi@example.com' as email, '@lisi' as social_account, '上海市浦东新区' as address, false as favorite) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE phone = '13900139000');

INSERT INTO contacts (name, phone, email, social_account, address, favorite) 
SELECT * FROM (SELECT '王五' as name, '13700137000' as phone, 'wangwu@example.com' as email, '@wangwu' as social_account, '广州市天河区' as address, true as favorite) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE phone = '13700137000');

INSERT INTO contacts (name, phone, email, social_account, address, favorite) 
SELECT * FROM (SELECT '赵六' as name, '13600136000' as phone, 'zhaoliu@example.com' as email, '@zhaoliu' as social_account, '深圳市南山区' as address, false as favorite) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE phone = '13600136000');

