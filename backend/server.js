import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx'; // 添加 Excel 处理库

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'bendihuancun.json');

const app = express();
const PORT = 3000;

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

// 确保数据文件存在
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// 读取数据
const readData = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return [];
  }
};

// 保存数据
const saveData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving data file:', error);
    return false;
  }
};

// 获取联系人列表
app.get('/api/contacts', (req, res) => {
  const { q = '', favoriteOnly = '0', page = '1', pageSize = '8' } = req.query;
  const contacts = readData();
  
  let filtered = contacts.filter(contact => {
    const searchLower = q.toLowerCase();
    const matchesSearch = !q || 
      contact.name.toLowerCase().includes(searchLower) ||
      (contact.phone && contact.phone.includes(q)) ||
      (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
      (contact.socialAccount && contact.socialAccount.toLowerCase().includes(searchLower)) ||
      (contact.address && contact.address.toLowerCase().includes(searchLower));
    
    const matchesFavorite = favoriteOnly === '0' || 
      (favoriteOnly === '1' && contact.favorite === true);
    
    return matchesSearch && matchesFavorite;
  });
  
  const pageNum = parseInt(page);
  const size = parseInt(pageSize);
  const startIndex = (pageNum - 1) * size;
  const endIndex = startIndex + size;
  const paginated = filtered.slice(startIndex, endIndex);
  
  res.json({
    data: paginated,
    total: filtered.length,
    page: pageNum,
    pageSize: size
  });
});

// 创建新联系人
app.post('/api/contacts', (req, res) => {
  const { 
    name, 
    phone, 
    email = '', 
    socialAccount = '', 
    address = '', 
    favorite = false 
  } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required' });
  }
  
  const contacts = readData();
  const newContact = {
    id: Date.now().toString(),
    name,
    phone,
    email: email.trim(),
    socialAccount: socialAccount.trim(),
    address: address.trim(),
    favorite: Boolean(favorite),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  contacts.push(newContact);
  
  if (saveData(contacts)) {
    res.json({ success: true, data: newContact });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save data' });
  }
});

// 更新联系人
app.patch('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const contacts = readData();
  const index = contacts.findIndex(contact => contact.id === id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }
  
  const updatedContact = {
    ...contacts[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  if (updatedContact.email !== undefined) {
    updatedContact.email = updatedContact.email.trim();
  }
  if (updatedContact.socialAccount !== undefined) {
    updatedContact.socialAccount = updatedContact.socialAccount.trim();
  }
  if (updatedContact.address !== undefined) {
    updatedContact.address = updatedContact.address.trim();
  }
  
  contacts[index] = updatedContact;
  
  if (saveData(contacts)) {
    res.json({ success: true, data: contacts[index] });
  } else {
    res.status(500).json({ success: false, message: 'Failed to update data' });
  }
});

// 删除联系人
app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  
  const contacts = readData();
  const filtered = contacts.filter(contact => contact.id !== id);
  
  if (filtered.length === contacts.length) {
    return res.status(404).json({ success: false, message: 'Contact not found' });
  }
  
  if (saveData(filtered)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, message: 'Failed to delete data' });
  }
});

// 导出所有联系人为 Excel
app.get('/api/contacts/export', (req, res) => {
  try {
    const contacts = readData();
    
    // 准备 Excel 数据
    const worksheetData = contacts.map(contact => ({
      '姓名': contact.name,
      '电话': contact.phone,
      '邮箱': contact.email || '',
      '社交账号': contact.socialAccount || '',
      '地址': contact.address || '',
      '收藏': contact.favorite ? '是' : '否',
      '创建时间': new Date(contact.createdAt).toLocaleString(),
      '更新时间': new Date(contact.updatedAt).toLocaleString()
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
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export data' });
  }
});

// 从 Excel 导入联系人 - 只添加新联系人，不更新已有联系人
app.post('/api/contacts/import', (req, res) => {
  try {
    if (!req.body || !req.body.data) {
      return res.status(400).json({ success: false, message: 'No data provided' });
    }
    
    const contacts = readData();
    const importedData = req.body.data;
    
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    importedData.forEach(item => {
      try {
        if (!item.name || !item.phone) {
          errorCount++;
          return;
        }
        
        // 检查是否已存在相同电话的联系人
        const existingContact = contacts.find(c => c.phone === item.phone);
        
        if (existingContact) {
          // 跳过重复的电话号码，只统计但不添加
          duplicateCount++;
          console.log(`跳过重复联系人: ${item.name} (电话: ${item.phone})`);
          return;
        }
        
        // 添加新联系人
        const newContact = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: item.name,
          phone: item.phone,
          email: item.email ? item.email.trim() : '',
          socialAccount: item.socialAccount ? item.socialAccount.trim() : '',
          address: item.address ? item.address.trim() : '',
          favorite: Boolean(item.favorite),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        contacts.push(newContact);
        importedCount++;
        
        console.log(`成功导入联系人: ${item.name} (电话: ${item.phone})`);
        
      } catch (err) {
        errorCount++;
        console.error('Error processing row:', err);
      }
    });
    
    if (importedCount > 0 || duplicateCount > 0) {
      // 只有有新联系人时才保存
      if (saveData(contacts)) {
        res.json({ 
          success: true, 
          message: `导入完成: ${importedCount} 个成功导入, ${duplicateCount} 个重复跳过, ${errorCount} 个错误`,
          data: {
            imported: importedCount,
            duplicates: duplicateCount,
            errors: errorCount
          }
        });
      } else {
        res.status(500).json({ success: false, message: '保存导入数据失败' });
      }
    } else {
      res.json({ 
        success: true, 
        message: `没有新数据导入: ${duplicateCount} 个重复, ${errorCount} 个错误`,
        data: {
          imported: importedCount,
          duplicates: duplicateCount,
          errors: errorCount
        }
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: '导入数据失败: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Data file saved at: ${DATA_FILE}`);
});