// MongoDB ulanishi: bitta client qayta ishlatiladi (Vercel serverless uchun ham).
const { MongoClient } = require("mongodb");

let pending = null;

function getDb() {
  if (!pending) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI sozlanmagan");
    const client = new MongoClient(uri, { maxPoolSize: 5 });
    pending = client.connect().then(async (c) => {
      const db = c.db(process.env.MONGODB_DB || "carbon");
      await Promise.all([
        db.collection("bookings").createIndex({ id: 1 }, { unique: true }),
        db.collection("bookings").createIndex({ date: 1, status: 1 }),
        db.collection("bookings").createIndex({ userId: 1 }),
        db.collection("cafe").createIndex({ id: 1 }, { unique: true }),
        db.collection("cafe").createIndex({ date: 1 }),
        db.collection("users").createIndex({ phone: 1 }, { unique: true }),
        db.collection("staff").createIndex({ id: 1 }, { unique: true }),
      ]);
      return db;
    });
    pending.catch(() => { pending = null; });
  }
  return pending;
}

module.exports = { getDb };
