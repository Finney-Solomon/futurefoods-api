// seed.js
import "dotenv/config";
import mongoose from "mongoose";
import Category from "./src/models/Category.js";
import Product from "./src/models/Product.js";
import User from "./src/models/User.js";
import bcrypt from "bcryptjs";

await mongoose.connect(process.env.MONGO_URI);

await Promise.all([
 Category.deleteMany({}),
 Product.deleteMany({}),
 User.deleteMany({}),
]);

const admin = await User.create({
 name: "Admin",
 email: "admin@futurefoods.local",
 passwordHash: await bcrypt.hash("Admin@123", 10),
 role: "admin",
});

const cats = await Category.insertMany([
 {
  name: "Fermented Foods",
  slug: "fermented-foods",
  description: "Kimchi, Tempeh, Kombucha",
 },
 { name: "Vegan", slug: "vegan", description: "Plant‑based goodies" },
]);

await Product.insertMany([
 {
  name: "Classic Napa Cabbage Kimchi",
  slug: "classic-kimchi",
  category: cats[0]._id,
  pricePaise: 1299,
  imageUrl:
   "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&h=300",
 },
 {
  name: "Smoky Maple Tempeh Strips",
  slug: "smoky-tempeh-strips",
  category: cats[0]._id,
  pricePaise: 999,
  imageUrl:
   "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&h=300",
 },
 {
  name: "Turmeric & Ginger Tempeh Cubes",
  slug: "turmeric-tempeh-cubes",
  category: cats[0]._id,
  pricePaise: 1099,
  imageUrl:
   "https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&w=400&h=300",
 },
]);

console.log("Seeded. Admin login: admin@futurefoods.local / Admin@123");
await mongoose.disconnect();
