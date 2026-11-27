// Lokal ishga tushirish: sayt + API bitta portda (http://localhost:5577).
// .env bo'lmasa yoki MONGODB_URI bo'sh bo'lsa — xotiradagi vaqtinchalik MongoDB ishga tushadi.
const path = require("path");
const fs = require("fs");

const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mem.getUri();
    console.log("MONGODB_URI yo'q — vaqtinchalik xotiradagi MongoDB ishlatilmoqda (ma'lumot saqlanmaydi).");
  }
  if (!process.env.ADMIN_PASSWORD) {
    process.env.ADMIN_PASSWORD = "local-admin";
    console.log("ADMIN_PASSWORD yo'q — lokal parol: local-admin");
  }
  const express = require("express");
  const api = require("./app");
  const root = path.join(__dirname, "..");
  const site = express();
  site.use("/api", api);
  site.use(express.static(root, { index: "index.html", dotfiles: "deny" }));
  const port = Number(process.env.PORT) || 5577;
  site.listen(port, () => console.log(`Carbon: http://localhost:${port}  (admin: /admin.html)`));
}
main().catch((e) => { console.error(e); process.exit(1); });
