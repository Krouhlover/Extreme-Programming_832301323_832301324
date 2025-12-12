// server.js
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// MySQL数据库配置（支持环境变量，兼容 Docker）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'contact_app',
  password: process.env.DB_PASSWORD || 'contact_password',
  database: process.env.DB_NAME || 'contact_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  // 设置字符集为 utf8mb4（支持完整的 UTF-8，包括中文和 emoji）
  charset: 'utf8mb4'
};

// 创建数据库连接池
let pool;

// 初始化数据库连接
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // 测试连接
    const connection = await pool.getConnection();
    console.log('✅ MySQL数据库连接成功');
    
    // 设置连接字符集为 utf8mb4
    await connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.query('SET CHARACTER SET utf8mb4');
    
    // 测试查询确保表存在
    const [rows] = await connection.query('SHOW TABLES LIKE "contacts"');
    if (rows.length === 0) {
      console.log('⚠️  表不存在，请运行 init_database.sql 初始化数据库');
    } else {
      console.log('✅ 联系人表已存在');
    }
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL数据库连接失败:', error.message);
    return false;
  }
}

// 手动设置CORS中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// 安全转义函数（防止SQL注入）
function escapeSql(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  // 简单的转义，实际项目应该使用库的转义函数
  return "'" + String(value).replace(/'/g, "''") + "'";
}

// 获取联系人列表 - 修复版本（使用直接查询）
app.get('/api/contacts', async (req, res) => {
  try {
    const { q = '', favoriteOnly = '0', page = '1', pageSize = '8' } = req.query;
    const pageNum = parseInt(page) || 1;
    const size = parseInt(pageSize) || 8;
    const offset = (pageNum - 1) * size;
    
    console.log(`查询参数: q=${q}, favoriteOnly=${favoriteOnly}, page=${pageNum}, pageSize=${size}`);
    
    // 构建查询条件
    let whereConditions = [];
    let queryParams = [];
    
    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      whereConditions.push(`(
        name LIKE ? OR 
        phone LIKE ? OR 
        email LIKE ? OR 
        social_account LIKE ? OR 
        address LIKE ?
      )`);
      // 添加5个参数（每个字段一个）
      for (let i = 0; i < 5; i++) {
        queryParams.push(searchTerm);
      }
    }
    
    if (favoriteOnly === '1') {
      whereConditions.push('favorite = 1');
    }
    
    // 构建WHERE子句
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = 'WHERE ' + whereConditions.join(' AND ');
    }
    
    // 获取总数
    let countQuery = `SELECT COUNT(*) as total FROM contacts`;
    if (whereClause) {
      countQuery += ` ${whereClause}`;
    }
    
    console.log('总数查询SQL:', countQuery);
    console.log('总数查询参数:', queryParams);
    
    const [countResult] = await pool.query(countQuery, queryParams);
    const total = countResult[0].total;
    
    // 获取分页数据 - 使用query而不是execute
    let dataQuery = `SELECT * FROM contacts`;
    if (whereClause) {
      dataQuery += ` ${whereClause}`;
    }
    dataQuery += ` ORDER BY updated_at DESC`;
    
    // 添加LIMIT和OFFSET
    dataQuery += ` LIMIT ${size} OFFSET ${offset}`;
    
    console.log('数据查询SQL:', dataQuery);
    console.log('数据查询参数:', queryParams);
    
    // 注意：这里我们使用了query而不是execute，并且不传递LIMIT/OFFSET参数
    const [rows] = await pool.query(dataQuery, queryParams);
    
    console.log(`查询到 ${rows.length} 条记录，总数: ${total}`);
    
    // 转换字段名（下划线转驼峰）
    const formattedRows = rows.map(row => ({
      id: row.id.toString(),
      name: row.name,
      phone: row.phone,
      email: row.email,
      socialAccount: row.social_account,
      address: row.address,
      favorite: Boolean(row.favorite),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      data: formattedRows,
      total,
      page: pageNum,
      pageSize: size
    });
  } catch (error) {
    console.error('获取联系人列表错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: '获取数据失败: ' + error.message 
    });
  }
});

// 创建新联系人
app.post('/api/contacts', async (req, res) => {
  try {
    const { 
      name, 
      phone, 
      email = '', 
      socialAccount = '', 
      address = '', 
      favorite = false 
    } = req.body;
    
    console.log('创建联系人请求:', req.body);
    
    if (!name || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: '姓名和电话是必填项' 
      });
    }
    
    // 检查电话是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM contacts WHERE phone = ?',
      [phone]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '电话已存在' 
      });
    }
    
    // 插入新联系人
    const [result] = await pool.query(
      `INSERT INTO contacts 
       (name, phone, email, social_account, address, favorite) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, socialAccount || null, address || null, favorite]
    );
    
    // 获取刚插入的联系人
    const [rows] = await pool.query(
      'SELECT * FROM contacts WHERE id = ?',
      [result.insertId]
    );
    
    if (rows.length === 0) {
      throw new Error('插入联系人后查询失败');
    }
    
    const newContact = {
      id: rows[0].id.toString(),
      name: rows[0].name,
      phone: rows[0].phone,
      email: rows[0].email,
      socialAccount: rows[0].social_account,
      address: rows[0].address,
      favorite: Boolean(rows[0].favorite),
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };
    
    console.log('成功创建联系人:', newContact);
    
    res.json({ 
      success: true, 
      data: newContact 
    });
  } catch (error) {
    console.error('创建联系人错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建联系人失败: ' + error.message 
    });
  }
});

// 更新联系人
app.patch('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log(`更新联系人 ID: ${id}, 更新内容:`, updates);
    
    // 检查联系人是否存在
    const [existing] = await pool.query(
      'SELECT id FROM contacts WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '联系人不存在' 
      });
    }
    
    // 构建更新语句
    const updateFields = [];
    const updateValues = [];
    
    // 检查必须字段
    if (updates.name !== undefined) {
      if (!updates.name || updates.name.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: '姓名不能为空' 
        });
      }
      updateFields.push('name = ?');
      updateValues.push(updates.name.trim());
    }
    
    if (updates.phone !== undefined) {
      if (!updates.phone || updates.phone.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: '电话不能为空' 
        });
      }
      
      // 检查电话是否重复（排除自己）
      const [phoneCheck] = await pool.query(
        'SELECT id FROM contacts WHERE phone = ? AND id != ?',
        [updates.phone.trim(), id]
      );
      
      if (phoneCheck.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: '电话已存在' 
        });
      }
      
      updateFields.push('phone = ?');
      updateValues.push(updates.phone.trim());
    }
    
    // 可选字段
    if (updates.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updates.email ? updates.email.trim() : null);
    }
    
    if (updates.socialAccount !== undefined) {
      updateFields.push('social_account = ?');
      updateValues.push(updates.socialAccount ? updates.socialAccount.trim() : null);
    }
    
    if (updates.address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(updates.address ? updates.address.trim() : null);
    }
    
    if (updates.favorite !== undefined) {
      updateFields.push('favorite = ?');
      updateValues.push(updates.favorite ? 1 : 0); // 转换为0/1
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '没有提供更新字段' 
      });
    }
    
    // 添加更新时间
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // 执行更新
    updateValues.push(id);
    
    const updateQuery = `UPDATE contacts SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log('更新SQL:', updateQuery);
    console.log('更新参数:', updateValues);
    
    const [result] = await pool.query(updateQuery, updateValues);
    
    // 获取更新后的联系人
    const [rows] = await pool.query(
      'SELECT * FROM contacts WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      throw new Error('更新联系人后查询失败');
    }
    
    const updatedContact = {
      id: rows[0].id.toString(),
      name: rows[0].name,
      phone: rows[0].phone,
      email: rows[0].email,
      socialAccount: rows[0].social_account,
      address: rows[0].address,
      favorite: Boolean(rows[0].favorite),
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };
    
    console.log('成功更新联系人:', updatedContact);
    
    res.json({ 
      success: true, 
      data: updatedContact 
    });
  } catch (error) {
    console.error('更新联系人错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新联系人失败: ' + error.message 
    });
  }
});

// 删除联系人
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`删除联系人 ID: ${id}`);
    
    // 先检查联系人是否存在
    const [existing] = await pool.query(
      'SELECT id FROM contacts WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '联系人不存在' 
      });
    }
    
    const [result] = await pool.query(
      'DELETE FROM contacts WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(500).json({ 
        success: false, 
        message: '删除操作未生效' 
      });
    }
    
    console.log('成功删除联系人 ID:', id);
    
    res.json({ 
      success: true,
      message: '联系人已删除'
    });
  } catch (error) {
    console.error('删除联系人错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除联系人失败: ' + error.message 
    });
  }
});

// 导出所有联系人为 Excel
app.get('/api/contacts/export', async (req, res) => {
  try {
    console.log('导出联系人请求');
    
    const [rows] = await pool.query(
      'SELECT * FROM contacts ORDER BY name'
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '没有联系人数据可导出' 
      });
    }
    
    console.log(`导出 ${rows.length} 个联系人`);
    
    // 准备 Excel 数据
    const worksheetData = rows.map(contact => ({
      '姓名': contact.name,
      '电话': contact.phone,
      '邮箱': contact.email || '',
      '社交账号': contact.social_account || '',
      '地址': contact.address || '',
      '收藏': contact.favorite ? '是' : '否',
      '创建时间': new Date(contact.created_at).toLocaleString(),
      '更新时间': new Date(contact.updated_at).toLocaleString()
    }));
    
    // 创建工作簿和工作表
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    
    // 设置列宽
    const colWidths = [
      { wch: 20 }, // 姓名
      { wch: 15 }, // 电话
      { wch: 25 }, // 邮箱
      { wch: 20 }, // 社交账号
      { wch: 30 }, // 地址
      { wch: 10 }, // 收藏
      { wch: 20 }, // 创建时间
      { wch: 20 }  // 更新时间
    ];
    worksheet['!cols'] = colWidths;
    
    // 生成 Excel 文件
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'buffer' 
    });
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('导出错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '导出数据失败: ' + error.message 
    });
  }
});

// 从 Excel 导入联系人
app.post('/api/contacts/import', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    if (!req.body || !req.body.data || !Array.isArray(req.body.data)) {
      return res.status(400).json({ 
        success: false, 
        message: '没有提供有效的数据' 
      });
    }
    
    const importedData = req.body.data;
    console.log(`导入 ${importedData.length} 条数据`);
    
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < importedData.length; i++) {
      const item = importedData[i];
      
      try {
        // 验证必填字段
        if (!item.name || !item.name.trim() || !item.phone || !item.phone.trim()) {
          errorCount++;
          errors.push(`第${i + 1}行: 缺少姓名或电话`);
          continue;
        }
        
        const name = item.name.trim();
        const phone = item.phone.trim();
        
        // 检查是否已存在相同电话的联系人
        const [existing] = await connection.query(
          'SELECT id FROM contacts WHERE phone = ?',
          [phone]
        );
        
        if (existing.length > 0) {
          duplicateCount++;
          console.log(`跳过重复联系人: ${name} (电话: ${phone})`);
          continue;
        }
        
        // 插入新联系人
        await connection.query(
          `INSERT INTO contacts 
           (name, phone, email, social_account, address, favorite) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            name,
            phone,
            item.email ? item.email.trim() : null,
            item.socialAccount ? item.socialAccount.trim() : null,
            item.address ? item.address.trim() : null,
            Boolean(item.favorite) ? 1 : 0
          ]
        );
        
        importedCount++;
        console.log(`成功导入联系人: ${name} (电话: ${phone})`);
        
      } catch (err) {
        errorCount++;
        errors.push(`第${i + 1}行: ${err.message}`);
        console.error(`处理导入行 ${i + 1} 错误:`, err);
      }
    }
    
    await connection.commit();
    
    const response = { 
      success: true, 
      message: `导入完成: ${importedCount} 个成功导入, ${duplicateCount} 个重复跳过, ${errorCount} 个错误`,
      data: {
        imported: importedCount,
        duplicates: duplicateCount,
        errors: errorCount
      }
    };
    
    if (errors.length > 0) {
      response.details = errors.slice(0, 10); // 只返回前10个错误详情
    }
    
    console.log('导入结果:', response);
    
    res.json(response);
    
  } catch (error) {
    await connection.rollback();
    console.error('导入错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '导入数据失败: ' + error.message 
    });
  } finally {
    connection.release();
  }
});

// 启动服务器
async function startServer() {
  const dbInitialized = await initDatabase();
  
  if (!dbInitialized) {
    console.log('❌ 无法连接到数据库，服务器启动失败');
    console.log('💡 请确保:');
    console.log('1. MySQL服务已启动');
    console.log('2. 数据库配置正确');
    console.log('3. 已创建数据库和用户（运行 init_database.sql）');
    process.exit(1);
  }
  
  app.listen(PORT, () => {
    console.log(`\n✅ 服务器运行在 http://localhost:${PORT}`);
    console.log(`✅ 使用MySQL数据库: ${dbConfig.database}`);
    console.log(`📊 数据库连接信息: ${dbConfig.host} (用户: ${dbConfig.user})`);
    console.log('\n📋 可用接口:');
    console.log(`  GET  /api/contacts        - 获取联系人列表`);
    console.log(`  POST /api/contacts        - 创建新联系人`);
    console.log(`  PATCH /api/contacts/:id   - 更新联系人`);
    console.log(`  DELETE /api/contacts/:id  - 删除联系人`);
    console.log(`  GET  /api/contacts/export - 导出Excel`);
    console.log(`  POST /api/contacts/import - 导入Excel`);
  });
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

startServer().catch(error => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});