import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  
  // 预检请求处理
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

// 获取联系人列表（支持搜索、筛选、分页）
app.get('/api/contacts', (req, res) => {
  const { q = '', favoriteOnly = '0', page = '1', pageSize = '8' } = req.query;
  const contacts = readData();
  
  // 过滤数据
  let filtered = contacts.filter(contact => {
    // 搜索过滤（支持姓名、电话、邮箱搜索）
    const searchLower = q.toLowerCase();
    const matchesSearch = !q || 
      contact.name.toLowerCase().includes(searchLower) ||
      (contact.phone && contact.phone.includes(q)) ||
      (contact.email && contact.email.toLowerCase().includes(searchLower));
    
    // 收藏过滤
    const matchesFavorite = favoriteOnly === '0' || 
      (favoriteOnly === '1' && contact.favorite === true);
    
    return matchesSearch && matchesFavorite;
  });
  
  // 分页
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
  const { name, phone, email = '', favorite = false } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required' });
  }
  
  const contacts = readData();
  const newContact = {
    id: Date.now().toString(),
    name,
    phone,
    email: email.trim(),
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
  
  // 更新联系人信息
  const updatedContact = {
    ...contacts[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  // 清理email字段的空格
  if (updatedContact.email !== undefined) {
    updatedContact.email = updatedContact.email.trim();
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Data file saved at: ${DATA_FILE}`);
  console.log('Frontend API accessible at http://localhost:3000');
});