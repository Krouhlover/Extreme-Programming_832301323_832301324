import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();
const dataFilePath = path.resolve(process.cwd(), process.env.DATA_FILE || "./bendineicun");
function load() {
  if (!fs.existsSync(dataFilePath)) {
    const initData = { nextId: 1, items: [] };
    fs.writeFileSync(dataFilePath, JSON.stringify(initData, null, 2), "utf-8");
    return initData;
  }
  try {
    const raw = fs.readFileSync(dataFilePath, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object") throw new Error("invalid file");
    if (!Array.isArray(parsed.items)) parsed.items = [];
    if (typeof parsed.nextId !== "number" || parsed.nextId < 1) {
      const maxId = parsed.items.reduce((m, it) => Math.max(m, Number(it.id) || 0), 0);
      parsed.nextId = maxId + 1;
    }
    return parsed;
  } catch {
    const reset = { nextId: 1, items: [] };
    fs.writeFileSync(dataFilePath, JSON.stringify(reset, null, 2), "utf-8");
    return reset;
  }
}
function save(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), "utf-8");
}

export const Store = {
  list({ q = "", favoriteOnly = 0, page = 1, pageSize = 10 }) {
    const data = load();
    const keyword = String(q).toLowerCase();
    let arr = data.items.slice();

    if (keyword) {
      arr = arr.filter(it =>
        String(it.name || "").toLowerCase().includes(keyword) ||
        String(it.phone || "").toLowerCase().includes(keyword)
      );
    }
    if (Number(favoriteOnly) === 1) {
      arr = arr.filter(it => Number(it.favorite) === 1);
    }
    arr.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    const p = Number(page) > 0 ? Number(page) : 1;
    const ps = Number(pageSize) > 0 ? Number(pageSize) : 10;
    const offset = (p - 1) * ps;
    const pageItems = arr.slice(offset, offset + ps);

    return { rows: pageItems, total: arr.length, page: p, pageSize: ps };
  },
  get(id) {
    const data = load();
    const item = data.items.find(it => Number(it.id) === Number(id));
    return item || null;
  },
  create({ name, phone, favorite = 0 }) {
    const data = load();
    const now = Date.now();
    const item = {
      id: data.nextId++,
      name: name ?? "",
      phone: phone ?? "",
      favorite: favorite ? 1 : 0,
      updatedAt: now
    };
    data.items.push(item);
    save(data);
    return item.id;
  },
  update(id, patch) {
    const data = load();
    const idx = data.items.findIndex(it => Number(it.id) === Number(id));
    if (idx === -1) return 0;
    const cur = data.items[idx];
    const next = {
      ...cur,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.favorite !== undefined ? { favorite: patch.favorite ? 1 : 0 } : {}),
      updatedAt: Date.now()
    };
    data.items[idx] = next;
    save(data);
    return 1;
  },
  remove(id) {
    const data = load();
    const before = data.items.length;
    data.items = data.items.filter(it => Number(it.id) !== Number(id));
    const after = data.items.length;
    if (after !== before) save(data);
    return before - after;
  }
};