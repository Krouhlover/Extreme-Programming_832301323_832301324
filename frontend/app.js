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
  create: async ({ name, phone, email = "", favorite = false }) => {
    const json = await request("/api/contacts", {
      method: "POST",
      body: { name, phone, email, favorite }
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

const listEl = document.getElementById("list");
const pageInfoEl = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const searchInput = document.getElementById("searchInput");
const favOnlyEl = document.getElementById("favOnly");
const addBtn = document.getElementById("addBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const nameInput = document.getElementById("nameInput");
const phoneInput = document.getElementById("phoneInput");
const emailInput = document.getElementById("emailInput");
const favoriteInput = document.getElementById("favoriteInput");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

let editingId = null;

function openModal({ title, data } = {}) {
  modalTitle.textContent = title || "Add Contact";
  nameInput.value = data?.name ?? "";
  phoneInput.value = data?.phone ?? "";
  emailInput.value = data?.email ?? "";
  favoriteInput.checked = !!data?.favorite;
  modal.classList.remove("hidden");
  nameInput.focus();
}
function closeModal() {
  modal.classList.add("hidden");
  editingId = null;
}

function renderList() {
  listEl.innerHTML = "";
  state.items.forEach(item => {
    const li = document.createElement("li");
    li.className = "card";

    const title = document.createElement("h4");
    title.textContent = item.name || "Unnamed";

    const meta = document.createElement("div");
    meta.className = "meta";
    const dt = new Date(item.updatedAt || Date.now());
    meta.textContent = `Updated: ${dt.toLocaleString()}`;

    // 第一行：电话和收藏状态
    const row1 = document.createElement("div");
    row1.className = "row";
    
    const phonePill = document.createElement("span");
    phonePill.className = "pill";
    phonePill.textContent = `Phone: ${item.phone || "-"}`;
    
    const favPill = document.createElement("span");
    favPill.className = "pill";
    favPill.textContent = item.favorite ? "★ Favorited" : "☆ Not Favorited";
    favPill.style.backgroundColor = item.favorite ? "#fffacd" : "#fff";
    
    row1.appendChild(phonePill);
    row1.appendChild(favPill);

    // 第二行：邮箱（如果有）
    const row2 = document.createElement("div");
    row2.className = "row";
    row2.style.marginTop = "4px";
    row2.style.marginBottom = "8px";
    
    if (item.email && item.email.trim() !== "") {
      const emailPill = document.createElement("span");
      emailPill.className = "pill email-pill";
      emailPill.textContent = `Email: ${item.email}`;
      emailPill.style.backgroundColor = "#e8f5e9";
      row2.appendChild(emailPill);
    } else {
      // 如果没有邮箱，创建一个空占位符以保持布局一致
      const emptyPill = document.createElement("span");
      emptyPill.className = "pill empty-email";
      emptyPill.textContent = "Email: Not provided";
      emptyPill.style.backgroundColor = "#f5f5f5";
      emptyPill.style.color = "#999";
      row2.appendChild(emptyPill);
    }

    // 操作按钮行
    const ops = document.createElement("div");
    ops.className = "ops";
    const editBtn = document.createElement("button");
    editBtn.className = "primary";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => {
      editingId = item.id;
      openModal({ title: "Edit Contact", data: item });
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
      await API.remove(item.id);
      await refresh();
    };
    const toggleFavBtn = document.createElement("button");
    toggleFavBtn.textContent = item.favorite ? "Remove Favorite" : "Add to Favorite";
    toggleFavBtn.style.backgroundColor = item.favorite ? "#ffcccb" : "#e6f7ff";
    toggleFavBtn.onclick = async () => {
      await API.update(item.id, { favorite: !item.favorite });
      await refreshKeepingPage();
    };

    ops.appendChild(editBtn);
    ops.appendChild(delBtn);
    ops.appendChild(toggleFavBtn);

    // 将元素添加到卡片
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(row1);
    li.appendChild(row2);
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


addBtn.onclick = () => {
  editingId = null;
  openModal({ title: "Add Contact" });
};

cancelBtn.onclick = () => closeModal();

saveBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  const favorite = !!favoriteInput.checked;

  if (!name || !phone) {
    alert("Name and phone are required");
    return;
  }

  if (editingId) {
    await API.update(editingId, { name, phone, email, favorite });
  } else {
    await API.create({ name, phone, email, favorite });
  }
  closeModal();
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

refresh();