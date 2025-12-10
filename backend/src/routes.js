
import { Router } from "express";
import { Store } from "./store.js";

export const router = Router();

router.get("/health", (req, res) => res.json({ ok: true }));

router.get("/api/contacts", (req, res) => {
  const { q = "", favoriteOnly = 0, page = 1, pageSize = 10 } = req.query;
  const { rows, total, page: p, pageSize: ps } = Store.list({ q, favoriteOnly, page, pageSize });
  res.json({ success: true, data: rows, total, page: p, pageSize: ps });
});

router.get("/api/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = Store.get(id);
  if (!row) return res.status(404).json({ success: false });
  res.json({ success: true, data: row });
});

router.post("/api/contacts", (req, res) => {
  const { name = "", phone = "", favorite = 0 } = req.body || {};
  const id = Store.create({ name, phone, favorite });
  const created = Store.get(id);
  res.status(201).json({ success: true, data: created });
});

router.patch("/api/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const changes = Store.update(id, req.body || {});
  if (!changes) return res.status(404).json({ success: false });
  const updated = Store.get(id);
  res.json({ success: true, data: updated });
});

router.delete("/api/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const changes = Store.remove(id);
  if (!changes) return res.status(404).json({ success: false });
  res.json({ success: true });
});