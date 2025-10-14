// src/routes/cartRoutes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
 getCart,
 addItem,
 updateItem,
 removeItem,
 clearCart,
} from "../controllers/cartController.js";

const router = Router();

router.get("/", auth, getCart);
router.post("/items", auth, addItem);
router.put("/items/:itemId", auth, updateItem);
router.delete("/items/:itemId", auth, removeItem);
router.delete("/", auth, clearCart);
export default router;
