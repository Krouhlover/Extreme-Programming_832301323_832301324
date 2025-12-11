// app.js
const BASE_URL = "http://localhost:3000";

// 改进的请求函数，增加重试和错误处理
async function request(path, { method = "GET", query, body, retries = 3 } = {}) {
  const url = new URL(path, BASE_URL);
  
  // 添加查询参数
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  
  // 配置请求选项
  const options = {
    method,
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  };
  
  if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }
  
  let lastError;
  
  // 重试机制
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`请求: ${method} ${url.toString()}`, body ? `数据: ${JSON.stringify(body)}` : '');
      
      const res = await fetch(url.toString(), options);
      
      // 尝试解析JSON响应
      let json;
      try {
        json = await res.json();
      } catch (parseError) {
        // 如果不是JSON响应，创建空对象
        json = {};
      }
      
      if (!res.ok) {
        const errorMessage = json.message || `HTTP ${res.status} ${res.statusText}`;
        console.error(`请求失败 (${res.status}):`, errorMessage);
        
        // 如果是服务器错误，可以重试
        if (res.status >= 500 && i < retries - 1) {
          console.log(`重试 ${i + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 指数退避
          continue;
        }
        
        throw new Error(errorMessage);
      }
      
      // 如果API返回success字段为false
      if (json.success === false) {
        throw new Error(json.message || "请求失败");
      }
      
      return json;
      
    } catch (error) {
      lastError = error;
      console.error(`请求错误 (尝试 ${i + 1}/${retries}):`, error.message);
      
      // 如果不是最后一次尝试，等待后重试
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error("请求失败");
}

// 下载 Excel 文件
function downloadExcel(data, filename) {
  try {
    const blob = new Blob([data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `contacts_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('下载Excel失败:', error);
    throw error;
  }
}

// 读取 Excel 文件
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('未选择文件'));
      return;
    }
    
    // 检查文件类型
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      reject(new Error('请选择Excel文件 (.xlsx 或 .xls)'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Excel文件中没有工作表'));
          return;
        }
        
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Excel文件中没有数据'));
          return;
        }
        
        console.log('解析到Excel数据:', jsonData);
        
        // 转换数据格式，支持多种列名
        const contacts = jsonData.map((row, index) => {
          // 尝试多种可能的列名
          const name = row['姓名'] || row['Name'] || row['name'] || '';
          const phone = row['电话'] || row['Phone'] || row['phone'] || row['手机'] || '';
          const email = row['邮箱'] || row['Email'] || row['email'] || row['邮箱地址'] || '';
          const socialAccount = row['社交账号'] || row['Social Account'] || row['socialAccount'] || row['社交'] || '';
          const address = row['地址'] || row['Address'] || row['address'] || '';
          
          // 处理收藏字段
          let favorite = false;
          if (row['收藏'] !== undefined) {
            favorite = row['收藏'] === '是' || row['收藏'] === true || row['收藏'] === 'true';
          } else if (row['Favorite'] !== undefined) {
            favorite = row['Favorite'] === '是' || row['Favorite'] === true || row['Favorite'] === 'true';
          } else if (row['favorite'] !== undefined) {
            favorite = row['favorite'] === '是' || row['favorite'] === true || row['favorite'] === 'true';
          }
          
          return {
            name: String(name).trim(),
            phone: String(phone).trim(),
            email: String(email).trim(),
            socialAccount: String(socialAccount).trim(),
            address: String(address).trim(),
            favorite: Boolean(favorite)
          };
        }).filter(contact => {
          // 过滤无效数据：姓名和电话都不能为空
          const isValid = contact.name && contact.phone && 
                         contact.name.trim() !== '' && 
                         contact.phone.trim() !== '';
          
          if (!isValid) {
            console.warn(`跳过无效数据行: ${JSON.stringify(contact)}`);
          }
          
          return isValid;
        });
        
        if (contacts.length === 0) {
          reject(new Error('Excel文件中没有有效的联系人数据（需要姓名和电话）'));
          return;
        }
        
        console.log(`成功解析 ${contacts.length} 个联系人`);
        resolve(contacts);
        
      } catch (error) {
        console.error('解析Excel文件失败:', error);
        reject(new Error('解析Excel文件失败: ' + error.message));
      }
    };
    
    reader.onerror = function() {
      reject(new Error('读取文件失败'));
    };
    
    reader.onabort = function() {
      reject(new Error('读取文件被取消'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// API接口
const API = {
  // 获取联系人列表
  list: async ({ q = "", favoriteOnly = false, page = 1, pageSize = 8 }) => {
    try {
      const json = await request("/api/contacts", {
        query: { 
          q: q.trim(), 
          favoriteOnly: favoriteOnly ? "1" : "0", 
          page, 
          pageSize 
        }
      });
      
      return { 
        data: json.data || [], 
        total: json.total || 0, 
        page: json.page || page, 
        pageSize: json.pageSize || pageSize 
      };
    } catch (error) {
      console.error('获取联系人列表失败:', error);
      return { data: [], total: 0, page, pageSize };
    }
  },
  
  // 创建联系人
  create: async ({ name, phone, email = "", socialAccount = "", address = "", favorite = false }) => {
    const json = await request("/api/contacts", {
      method: "POST",
      body: { 
        name: name.trim(), 
        phone: phone.trim(), 
        email: email.trim(), 
        socialAccount: socialAccount.trim(), 
        address: address.trim(), 
        favorite 
      }
    });
    return json.data;
  },
  
  // 更新联系人
  update: async (id, patch) => {
    // 清理patch数据
    const cleanedPatch = {};
    Object.keys(patch).forEach(key => {
      if (patch[key] !== undefined) {
        if (typeof patch[key] === 'string') {
          cleanedPatch[key] = patch[key].trim();
        } else {
          cleanedPatch[key] = patch[key];
        }
      }
    });
    
    const json = await request(`/api/contacts/${id}`, {
      method: "PATCH",
      body: cleanedPatch
    });
    return json.data;
  },
  
  // 删除联系人
  remove: async (id) => {
    await request(`/api/contacts/${id}`, { method: "DELETE" });
    return true;
  },
  
  // 导出联系人
  export: async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/contacts/export`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || '导出失败';
        } catch {
          errorMessage = `导出失败: ${response.status} ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('导出的文件为空');
      }
      
      downloadExcel(await blob.arrayBuffer(), `contacts_${new Date().toISOString().slice(0,10)}.xlsx`);
      return true;
    } catch (error) {
      console.error('导出失败:', error);
      throw error;
    }
  },
  
  // 导入联系人
  import: async (data) => {
    const json = await request("/api/contacts/import", {
      method: "POST",
      body: { data }
    });
    return json;
  }
};

// 状态管理
const state = {
  q: "",
  favoriteOnly: false,
  page: 1,
  pageSize: 8,
  total: 0,
  items: []
};

// 主页面元素
const listEl = document.getElementById("list");
const pageInfoEl = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const searchInput = document.getElementById("searchInput");
const favOnlyEl = document.getElementById("favOnly");
const addBtn = document.getElementById("addBtn");

// 编辑模态框元素
const editModal = document.getElementById("editModal");
const modalTitle = document.getElementById("modalTitle");
const nameInput = document.getElementById("nameInput");
const phoneInput = document.getElementById("phoneInput");
const emailInput = document.getElementById("emailInput");
const socialInput = document.getElementById("socialInput");
const addressInput = document.getElementById("addressInput");
const favoriteInput = document.getElementById("favoriteInput");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

// 详情模态框元素
const detailModal = document.getElementById("detailModal");
const detailTitle = document.getElementById("detailTitle");
const detailPhone = document.getElementById("detailPhone");
const detailEmail = document.getElementById("detailEmail");
const detailSocial = document.getElementById("detailSocial");
const detailAddress = document.getElementById("detailAddress");
const closeDetailBtn = document.getElementById("closeDetailBtn");

let editingId = null;

// 创建导入导出按钮
function createImportExportButtons() {
  const topbar = document.querySelector('.topbar .actions');
  
  if (!topbar) {
    console.error('找不到.topbar .actions元素');
    return;
  }
  
  // 检查是否已存在按钮
  if (document.getElementById('templateBtn')) {
    return; // 按钮已存在
  }
  
  // 模板下载按钮
  const templateBtn = document.createElement('button');
  templateBtn.id = 'templateBtn';
  templateBtn.textContent = '下载模板';
  templateBtn.className = 'secondary-btn';
  templateBtn.style.backgroundColor = '#6c757d';
  templateBtn.style.borderColor = '#6c757d';
  templateBtn.style.marginLeft = '8px';
  templateBtn.style.padding = '8px 12px';
  templateBtn.style.borderRadius = '8px';
  templateBtn.style.color = 'white';
  templateBtn.style.cursor = 'pointer';
  templateBtn.style.border = 'none';
  
  // 导出按钮
  const exportBtn = document.createElement('button');
  exportBtn.id = 'exportBtn';
  exportBtn.textContent = '导出 Excel';
  exportBtn.className = 'export-btn';
  exportBtn.style.backgroundColor = '#28a745';
  exportBtn.style.borderColor = '#28a745';
  exportBtn.style.marginLeft = '8px';
  exportBtn.style.padding = '8px 12px';
  exportBtn.style.borderRadius = '8px';
  exportBtn.style.color = 'white';
  exportBtn.style.cursor = 'pointer';
  exportBtn.style.border = 'none';
  
  // 导入按钮
  const importBtn = document.createElement('button');
  importBtn.id = 'importBtn';
  importBtn.textContent = '导入 Excel';
  importBtn.className = 'import-btn';
  importBtn.style.backgroundColor = '#17a2b8';
  importBtn.style.borderColor = '#17a2b8';
  importBtn.style.marginLeft = '8px';
  importBtn.style.padding = '8px 12px';
  importBtn.style.borderRadius = '8px';
  importBtn.style.color = 'white';
  importBtn.style.cursor = 'pointer';
  importBtn.style.border = 'none';
  
  // 导入文件输入
  const importFileInput = document.createElement('input');
  importFileInput.id = 'importFileInput';
  importFileInput.type = 'file';
  importFileInput.accept = '.xlsx,.xls';
  importFileInput.style.display = 'none';
  
  // 插入到页面
  topbar.appendChild(templateBtn);
  topbar.appendChild(exportBtn);
  topbar.appendChild(importBtn);
  document.body.appendChild(importFileInput);
  
  // 添加事件监听
  templateBtn.onclick = downloadTemplate;
  exportBtn.onclick = handleExport;
  importBtn.onclick = () => importFileInput.click();
  importFileInput.onchange = handleImport;
  
  console.log('导入导出按钮创建成功');
}

// 下载导入模板
function downloadTemplate() {
  try {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX库未加载，请检查网络连接');
    }
    
    // 创建模板数据
    const templateData = [
      {
        '姓名': '张三',
        '电话': '13800138000',
        '邮箱': 'zhangsan@example.com',
        '社交账号': '@zhangsan',
        '地址': '北京市朝阳区',
        '收藏': '否'
      },
      {
        '姓名': '李四',
        '电话': '13900139000',
        '邮箱': 'lisi@example.com',
        '社交账号': '@lisi',
        '地址': '上海市浦东新区',
        '收藏': '是'
      }
    ];
    
    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '模板');
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 姓名
      { wch: 15 }, // 电话
      { wch: 25 }, // 邮箱
      { wch: 15 }, // 社交账号
      { wch: 25 }, // 地址
      { wch: 10 }  // 收藏
    ];
    worksheet['!cols'] = colWidths;
    
    // 生成文件
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    // 下载文件
    downloadExcel(excelBuffer, '通讯录导入模板.xlsx');
    
    alert('模板下载成功！请按照模板格式填写数据。\n\n注意事项：\n1. "姓名"和"电话"为必填项\n2. 电话重复的联系人不会被导入\n3. 收藏列填写"是"或"否"');
    
  } catch (error) {
    console.error('Download template error:', error);
    alert('下载模板失败: ' + error.message);
  }
}

// 处理导出
async function handleExport() {
  try {
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = '导出中...';
    }
    
    await API.export();
    alert('导出成功！');
  } catch (error) {
    console.error('Export error:', error);
    alert('导出失败: ' + error.message);
  } finally {
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.textContent = '导出 Excel';
    }
  }
}

// 处理导入
async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const importBtn = document.getElementById('importBtn');
  const originalText = importBtn ? importBtn.textContent : '导入 Excel';
  
  try {
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.textContent = '导入中...';
    }
    
    // 检查文件类型
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('请选择Excel文件 (.xlsx 或 .xls)');
      event.target.value = '';
      return;
    }
    
    // 确认导入
    if (!confirm(`确定要导入文件 "${file.name}" 吗？\n\n注意：仅会添加新联系人，不会覆盖现有联系人。`)) {
      event.target.value = '';
      return;
    }
    
    // 读取并解析Excel文件
    const contacts = await readExcelFile(file);
    
    if (contacts.length === 0) {
      alert('Excel文件中没有找到有效的联系人数据（需要姓名和电话）');
      event.target.value = '';
      return;
    }
    
    // 显示导入预览
    let previewMessage = `找到 ${contacts.length} 个联系人\n\n`;
    previewMessage += `前5个联系人预览：\n\n`;
    
    // 显示前5个联系人作为预览
    contacts.slice(0, 5).forEach((contact, index) => {
      previewMessage += `${index + 1}. ${contact.name} - ${contact.phone}\n`;
    });
    
    if (contacts.length > 5) {
      previewMessage += `... 还有 ${contacts.length - 5} 个联系人\n`;
    }
    
    previewMessage += `\n确认导入吗？`;
    
    if (!confirm(previewMessage)) {
      event.target.value = '';
      return;
    }
    
    // 执行导入
    const result = await API.import(contacts);
    
    if (result.success) {
      // 显示详细的导入结果
      let resultMessage = `导入完成！\n`;
      resultMessage += `✓ 成功导入: ${result.data.imported} 个\n`;
      
      if (result.data.duplicates > 0) {
        resultMessage += `⚠ 跳过重复: ${result.data.duplicates} 个（电话已存在）\n`;
      }
      
      if (result.data.errors > 0) {
        resultMessage += `✗ 错误: ${result.data.errors} 个\n`;
      }
      
      if (result.details && result.details.length > 0) {
        resultMessage += `\n错误详情（前${Math.min(result.details.length, 5)}个）：\n`;
        result.details.slice(0, 5).forEach(detail => {
          resultMessage += `- ${detail}\n`;
        });
      }
      
      alert(resultMessage);
      
      // 如果成功导入了新联系人，刷新列表
      if (result.data.imported > 0) {
        await refresh();
      }
    } else {
      throw new Error(result.message || '导入失败');
    }
    
  } catch (error) {
    console.error('Import error:', error);
    alert('导入失败: ' + error.message);
  } finally {
    event.target.value = '';
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.textContent = originalText;
    }
  }
}

// 打开编辑模态框
function openEditModal({ title, data } = {}) {
  modalTitle.textContent = title || "添加联系人";
  nameInput.value = data?.name ?? "";
  phoneInput.value = data?.phone ?? "";
  emailInput.value = data?.email ?? "";
  socialInput.value = data?.socialAccount ?? "";
  addressInput.value = data?.address ?? "";
  favoriteInput.checked = !!data?.favorite;
  editModal.classList.remove("hidden");
  
  // 聚焦到姓名输入框
  setTimeout(() => {
    nameInput.focus();
  }, 100);
}

// 关闭编辑模态框
function closeEditModal() {
  editModal.classList.add("hidden");
  editingId = null;
  
  // 清空表单
  nameInput.value = "";
  phoneInput.value = "";
  emailInput.value = "";
  socialInput.value = "";
  addressInput.value = "";
  favoriteInput.checked = false;
}

// 打开详情模态框
function openDetailModal(contact) {
  detailTitle.textContent = `${contact.name} 的详细信息`;
  detailPhone.textContent = contact.phone || "未提供";
  detailEmail.textContent = contact.email || "未提供";
  detailSocial.textContent = contact.socialAccount || "未提供";
  detailAddress.textContent = contact.address || "未提供";
  detailModal.classList.remove("hidden");
}

// 关闭详情模态框
function closeDetailModal() {
  detailModal.classList.add("hidden");
}

// 渲染联系人列表
function renderList() {
  if (!listEl) {
    console.error('找不到列表元素');
    return;
  }
  
  listEl.innerHTML = "";
  
  if (state.items.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = state.q ? '没有找到匹配的联系人' : '暂无联系人，点击"添加"按钮创建';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.padding = '40px';
    emptyMessage.style.color = '#666';
    listEl.appendChild(emptyMessage);
    return;
  }
  
  state.items.forEach(item => {
    const li = document.createElement("li");
    li.className = "card";
    li.dataset.id = item.id;

    // 姓名
    const title = document.createElement("h4");
    title.textContent = item.name || "未命名";

    // 更新时间
    const meta = document.createElement("div");
    meta.className = "meta";
    const dt = new Date(item.updatedAt || Date.now());
    meta.textContent = `更新: ${dt.toLocaleString()}`;

    // 电话行
    const row1 = document.createElement("div");
    row1.className = "row";
    
    const phonePill = document.createElement("span");
    phonePill.className = "pill";
    phonePill.textContent = `电话: ${item.phone || "-"}`;
    phonePill.title = item.phone || "";
    
    const favPill = document.createElement("span");
    favPill.className = "pill favorite-indicator";
    favPill.textContent = item.favorite ? "★ 收藏" : "☆ 未收藏";
    favPill.style.backgroundColor = item.favorite ? "#fffacd" : "#f5f5f5";
    favPill.style.color = item.favorite ? "#ff9900" : "#666";
    
    row1.appendChild(phonePill);
    row1.appendChild(favPill);

    // 操作按钮行
    const ops = document.createElement("div");
    ops.className = "ops";
    
    // 显示更多按钮
    const showMoreBtn = document.createElement("button");
    showMoreBtn.className = "info";
    showMoreBtn.textContent = "详情";
    showMoreBtn.onclick = () => openDetailModal(item);
    
    // 编辑按钮
    const editBtn = document.createElement("button");
    editBtn.className = "primary";
    editBtn.textContent = "编辑";
    editBtn.onclick = () => {
      editingId = item.id;
      openEditModal({ title: "编辑联系人", data: item });
    };
    
    // 删除按钮
    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.onclick = async () => {
      if (!confirm(`确定要删除 ${item.name} 吗？`)) return;
      try {
        await API.remove(item.id);
        await refreshKeepingPage();
        alert('删除成功');
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败: ' + error.message);
      }
    };
    
    // 收藏/取消收藏按钮
    const toggleFavBtn = document.createElement("button");
    toggleFavBtn.textContent = item.favorite ? "取消收藏" : "收藏";
    toggleFavBtn.style.backgroundColor = item.favorite ? "#ffcccb" : "#e6f7ff";
    toggleFavBtn.onclick = async () => {
      try {
        await API.update(item.id, { favorite: !item.favorite });
        await refreshKeepingPage();
      } catch (error) {
        console.error('更新收藏状态失败:', error);
        alert('操作失败: ' + error.message);
      }
    };

    ops.appendChild(showMoreBtn);
    ops.appendChild(editBtn);
    ops.appendChild(delBtn);
    ops.appendChild(toggleFavBtn);

    // 将元素添加到卡片
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(row1);
    li.appendChild(ops);
    
    listEl.appendChild(li);
  });

  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  pageInfoEl.textContent = `第 ${state.page} 页 / 共 ${totalPages} 页`;
  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= totalPages;
}

async function refresh() {
  try {
    state.page = 1;
    const result = await API.list({
      q: state.q,
      favoriteOnly: state.favoriteOnly,
      page: state.page,
      pageSize: state.pageSize
    });
    
    state.items = result.data || [];
    state.total = result.total || 0;
    state.page = result.page || 1;
    state.pageSize = result.pageSize || 8;
    
    renderList();
  } catch (error) {
    console.error('刷新列表失败:', error);
    state.items = [];
    state.total = 0;
    renderList();
    // 不显示错误，避免干扰用户
  }
}

async function refreshKeepingPage() {
  try {
    const result = await API.list({
      q: state.q,
      favoriteOnly: state.favoriteOnly,
      page: state.page,
      pageSize: state.pageSize
    });
    
    state.items = result.data || [];
    state.total = result.total || 0;
    state.page = result.page || state.page;
    state.pageSize = result.pageSize || state.pageSize;
    
    renderList();
  } catch (error) {
    console.error('刷新列表失败:', error);
    // 保持原有数据
  }
}

// 事件监听器
if (addBtn) {
  addBtn.onclick = () => {
    editingId = null;
    openEditModal({ title: "添加联系人" });
  };
}

if (cancelBtn) {
  cancelBtn.onclick = () => closeEditModal();
}

if (closeDetailBtn) {
  closeDetailBtn.onclick = () => closeDetailModal();
}

// 点击模态框外部关闭
if (editModal) {
  editModal.onclick = (e) => {
    if (e.target === editModal) closeEditModal();
  };
}

if (detailModal) {
  detailModal.onclick = (e) => {
    if (e.target === detailModal) closeDetailModal();
  };
}

if (saveBtn) {
  saveBtn.onclick = async () => {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const socialAccount = socialInput.value.trim();
    const address = addressInput.value.trim();
    const favorite = !!favoriteInput.checked;

    // 验证必填字段
    if (!name) {
      alert("姓名是必填项");
      nameInput.focus();
      return;
    }

    if (!phone) {
      alert("电话是必填项");
      phoneInput.focus();
      return;
    }

    // 简单的电话格式验证
    if (!/^[\d\s\-\+\(\)]{6,20}$/.test(phone)) {
      alert("电话格式不正确，请输入有效的电话号码");
      phoneInput.focus();
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "保存中...";
      
      if (editingId) {
        await API.update(editingId, { name, phone, email, socialAccount, address, favorite });
        alert('更新成功');
      } else {
        await API.create({ name, phone, email, socialAccount, address, favorite });
        alert('添加成功');
      }
      
      closeEditModal();
      await refresh();
    } catch (error) {
      console.error('保存联系人失败:', error);
      alert('保存失败: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
    }
  };
}

if (searchInput) {
  // 使用防抖减少频繁请求
  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      state.q = e.target.value.trim();
      await refresh();
    }, 300);
  });
}

if (favOnlyEl) {
  favOnlyEl.addEventListener("change", async (e) => {
    state.favoriteOnly = e.target.checked;
    await refresh();
  });
}

if (prevBtn) {
  prevBtn.onclick = async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    await refreshKeepingPage();
  };
}

if (nextBtn) {
  nextBtn.onclick = async () => {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page >= totalPages) return;
    state.page += 1;
    await refreshKeepingPage();
  };
}

// 初始加载
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM加载完成，初始化应用...');
  
  try {
    // 检查必需的元素
    const requiredElements = ['list', 'searchInput', 'addBtn'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
      console.error('缺少必需的元素:', missingElements);
      alert('页面加载不完整，请刷新页面');
      return;
    }
    
    // 创建导入导出按钮
    createImportExportButtons();
    
    // 加载数据
    await refresh();
    
    console.log('应用初始化完成');
  } catch (error) {
    console.error('初始化失败:', error);
    alert('初始化失败: ' + error.message);
  }
});