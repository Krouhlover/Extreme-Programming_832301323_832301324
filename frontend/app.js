const BASE_URL = "http://localhost:3000";

async function request(path, { method = "GET", query, body } = {}) {
  const url = new URL(path, BASE_URL);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json;
}

// 下载 Excel 文件
function downloadExcel(data, filename) {
  const blob = new Blob([data], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'contacts.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// 读取 Excel 文件
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // 转换数据格式
        const contacts = jsonData.map((row, index) => ({
          name: row['姓名'] || row['Name'] || '',
          phone: row['电话'] || row['Phone'] || '',
          email: row['邮箱'] || row['Email'] || row['邮箱地址'] || '',
          socialAccount: row['社交账号'] || row['Social Account'] || '',
          address: row['地址'] || row['Address'] || '',
          favorite: row['收藏'] === '是' || row['Favorite'] === true || false
        })).filter(contact => {
          // 过滤无效数据
          const isValid = contact.name && contact.phone;
          if (!isValid) {
            console.warn(`跳过无效数据行: ${JSON.stringify(contact)}`);
          }
          return isValid;
        });
        
        resolve(contacts);
      } catch (error) {
        reject(new Error('解析Excel文件失败: ' + error.message));
      }
    };
    
    reader.onerror = function() {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

const API = {
  list: async ({ q = "", favoriteOnly = false, page = 1, pageSize = 8 }) => {
    const json = await request("/api/contacts", {
      query: { q, favoriteOnly: favoriteOnly ? 1 : 0, page, pageSize }
    });
    return { data: json.data, total: json.total, page: json.page, pageSize: json.pageSize };
  },
  create: async ({ name, phone, email = "", socialAccount = "", address = "", favorite = false }) => {
    const json = await request("/api/contacts", {
      method: "POST",
      body: { name, phone, email, socialAccount, address, favorite }
    });
    return json.data;
  },
  update: async (id, patch) => {
    const json = await request(`/api/contacts/${id}`, {
      method: "PATCH",
      body: patch
    });
    return json.data;
  },
  remove: async (id) => {
    await request(`/api/contacts/${id}`, { method: "DELETE" });
    return true;
  },
  // 导出联系人
  export: async () => {
    const response = await fetch(`${BASE_URL}/api/contacts/export`);
    if (!response.ok) {
      throw new Error('Failed to export contacts');
    }
    const blob = await response.blob();
    downloadExcel(await blob.arrayBuffer(), `contacts_${new Date().toISOString().slice(0,10)}.xlsx`);
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
  
  // 模板下载按钮
  const templateBtn = document.createElement('button');
  templateBtn.id = 'templateBtn';
  templateBtn.textContent = '下载模板';
  templateBtn.style.backgroundColor = '#6c757d';
  templateBtn.style.borderColor = '#6c757d';
  templateBtn.style.marginLeft = 'auto';
  
  // 导出按钮
  const exportBtn = document.createElement('button');
  exportBtn.id = 'exportBtn';
  exportBtn.textContent = '导出 Excel';
  exportBtn.style.backgroundColor = '#28a745';
  exportBtn.style.borderColor = '#28a745';
  
  // 导入按钮
  const importBtn = document.createElement('button');
  importBtn.id = 'importBtn';
  importBtn.textContent = '导入 Excel';
  importBtn.style.backgroundColor = '#17a2b8';
  importBtn.style.borderColor = '#17a2b8';
  
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
}

// 下载导入模板
function downloadTemplate() {
  try {
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
    exportBtn.disabled = true;
    exportBtn.textContent = '导出中...';
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
  
  try {
    // 检查文件类型
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      alert('请选择Excel文件 (.xlsx 或 .xls)');
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
  }
}

// 打开编辑模态框
function openEditModal({ title, data } = {}) {
  modalTitle.textContent = title || "Add Contact";
  nameInput.value = data?.name ?? "";
  phoneInput.value = data?.phone ?? "";
  emailInput.value = data?.email ?? "";
  socialInput.value = data?.socialAccount ?? "";
  addressInput.value = data?.address ?? "";
  favoriteInput.checked = !!data?.favorite;
  editModal.classList.remove("hidden");
  nameInput.focus();
}

// 关闭编辑模态框
function closeEditModal() {
  editModal.classList.add("hidden");
  editingId = null;
}

// 打开详情模态框
function openDetailModal(contact) {
  detailTitle.textContent = `${contact.name}'s Details`;
  detailPhone.textContent = contact.phone || "Not provided";
  detailEmail.textContent = contact.email || "Not provided";
  detailSocial.textContent = contact.socialAccount || "Not provided";
  detailAddress.textContent = contact.address || "Not provided";
  detailModal.classList.remove("hidden");
}

// 关闭详情模态框
function closeDetailModal() {
  detailModal.classList.add("hidden");
}

// 渲染联系人列表
function renderList() {
  listEl.innerHTML = "";
  state.items.forEach(item => {
    const li = document.createElement("li");
    li.className = "card";

    // 姓名
    const title = document.createElement("h4");
    title.textContent = item.name || "Unnamed";

    // 更新时间
    const meta = document.createElement("div");
    meta.className = "meta";
    const dt = new Date(item.updatedAt || Date.now());
    meta.textContent = `Updated: ${dt.toLocaleString()}`;

    // 电话行（仅显示电话）
    const row1 = document.createElement("div");
    row1.className = "row";
    
    const phonePill = document.createElement("span");
    phonePill.className = "pill";
    phonePill.textContent = `Phone: ${item.phone || "-"}`;
    
    const favPill = document.createElement("span");
    favPill.className = "pill";
    favPill.textContent = item.favorite ? "★" : "☆";
    favPill.style.backgroundColor = item.favorite ? "#fffacd" : "#fff";
    
    row1.appendChild(phonePill);
    row1.appendChild(favPill);

    // 操作按钮行
    const ops = document.createElement("div");
    ops.className = "ops";
    
    // 显示更多按钮
    const showMoreBtn = document.createElement("button");
    showMoreBtn.className = "info";
    showMoreBtn.textContent = "Show More";
    showMoreBtn.onclick = () => openDetailModal(item);
    
    // 编辑按钮
    const editBtn = document.createElement("button");
    editBtn.className = "primary";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => {
      editingId = item.id;
      openEditModal({ title: "Edit Contact", data: item });
    };
    
    // 删除按钮
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
      await API.remove(item.id);
      await refresh();
    };
    
    // 收藏/取消收藏按钮
    const toggleFavBtn = document.createElement("button");
    toggleFavBtn.textContent = item.favorite ? "Unfavorite" : "Favorite";
    toggleFavBtn.style.backgroundColor = item.favorite ? "#ffcccb" : "#e6f7ff";
    toggleFavBtn.onclick = async () => {
      await API.update(item.id, { favorite: !item.favorite });
      await refreshKeepingPage();
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
  pageInfoEl.textContent = `Page ${state.page} / ${totalPages}`;
  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= totalPages;
}

async function refresh() {
  state.page = 1;
  const { data, total, page, pageSize } = await API.list({
    q: state.q,
    favoriteOnly: state.favoriteOnly,
    page: state.page,
    pageSize: state.pageSize
  });
  state.items = data;
  state.total = total;
  state.page = page;
  state.pageSize = pageSize;
  renderList();
}

async function refreshKeepingPage() {
  const { data, total, page, pageSize } = await API.list({
    q: state.q,
    favoriteOnly: state.favoriteOnly,
    page: state.page,
    pageSize: state.pageSize
  });
  state.items = data;
  state.total = total;
  state.page = page;
  state.pageSize = pageSize;
  renderList();
}

// 事件监听器
addBtn.onclick = () => {
  editingId = null;
  openEditModal({ title: "Add Contact" });
};

cancelBtn.onclick = () => closeEditModal();

closeDetailBtn.onclick = () => closeDetailModal();

// 点击模态框外部关闭
editModal.onclick = (e) => {
  if (e.target === editModal) closeEditModal();
};

detailModal.onclick = (e) => {
  if (e.target === detailModal) closeDetailModal();
};

saveBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  const socialAccount = socialInput.value.trim();
  const address = addressInput.value.trim();
  const favorite = !!favoriteInput.checked;

  if (!name || !phone) {
    alert("Name and phone are required");
    return;
  }

  if (editingId) {
    await API.update(editingId, { name, phone, email, socialAccount, address, favorite });
  } else {
    await API.create({ name, phone, email, socialAccount, address, favorite });
  }
  closeEditModal();
  await refresh();
};

searchInput.addEventListener("input", async (e) => {
  state.q = e.target.value.trim();
  await refresh();
});

favOnlyEl.addEventListener("change", async (e) => {
  state.favoriteOnly = e.target.checked;
  await refresh();
});

prevBtn.onclick = async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  await refreshKeepingPage();
};

nextBtn.onclick = async () => {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  if (state.page >= totalPages) return;
  state.page += 1;
  await refreshKeepingPage();
};

// 初始加载
createImportExportButtons();
refresh();