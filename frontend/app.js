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
refresh();