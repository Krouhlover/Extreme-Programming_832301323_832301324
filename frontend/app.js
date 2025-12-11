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
        const contacts = jsonData.map(row => ({
          name: row['姓名'] || row['Name'] || '',
          phone: row['电话'] || row['Phone'] || '',
          email: row['邮箱'] || row['Email'] || row['邮箱地址'] || '',
          socialAccount: row['社交账号'] || row['Social Account'] || '',
          address: row['地址'] || row['Address'] || '',
          favorite: row['收藏'] === '是' || row['Favorite'] === true || false
        })).filter(contact => contact.name && contact.phone);
        
        resolve(contacts);
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + error.message));
      }
    };
    
    reader.onerror = function() {
      reject(new Error('Failed to read file'));
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
  
  // 导出按钮
  const exportBtn = document.createElement('button');
  exportBtn.id = 'exportBtn';
  exportBtn.textContent = '导出 Excel';
  exportBtn.style.backgroundColor = '#28a745';
  exportBtn.style.borderColor = '#28a745';
  exportBtn.style.marginLeft = 'auto';
  
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
  topbar.appendChild(exportBtn);
  topbar.appendChild(importBtn);
  document.body.appendChild(importFileInput);
  
  // 添加事件监听
  exportBtn.onclick = handleExport;
  importBtn.onclick = () => importFileInput.click();
  importFileInput.onchange = handleImport;
}

// 处理导出
async function handleExport() {
  try {
    exportBtn.disabled = true;
    exportBtn.textContent = '导出中...';
    await API.export();
    alert('导出成功！');
  } catch (error) {
    console.error('Export error:', error);
    alert('导出失败: ' + error.message);
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = '导出 Excel';
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
    if (!confirm(`确定要导入文件 "${file.name}" 吗？这将更新现有联系人或添加新联系人。`)) {
      event.target.value = '';
      return;
    }
    
    // 读取并解析Excel文件
    const contacts = await readExcelFile(file);
    
    if (contacts.length === 0) {
      alert('Excel文件中没有找到有效的联系人数据');
      return;
    }
    
    // 显示导入确认信息
    const confirmMsg = `找到 ${contacts.length} 个联系人\n\n` +
      `示例数据：\n` +
      `姓名：${contacts[0].name}\n` +
      `电话：${contacts[0].phone}\n\n` +
      `确认导入吗？`;
    
    if (!confirm(confirmMsg)) {
      event.target.value = '';
      return;
    }
    
    // 执行导入
    const result = await API.import(contacts);
    
    alert(`导入完成！\n` +
      `新增：${result.data.imported} 个\n` +
      `更新：${result.data.updated} 个\n` +
      `错误：${result.data.errors} 个`);
    
    // 刷新列表
    await refresh();
    
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