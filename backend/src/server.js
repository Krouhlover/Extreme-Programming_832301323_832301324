import dotenv from "dotenv";
import express from "express";
import { router } from "./routes.js";
dotenv.config();
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use(router);
const PORT = Number(process.env.PORT || 3485);
app.listen(PORT, () => {
  console.log(`File-based Contacts API running at http://localhost:3485`);
  console.log(`Data file: ${process.env.DATA_FILE || "./bendineicun"}`);
});