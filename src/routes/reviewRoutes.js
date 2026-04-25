import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
 listReviews,
 getReview,
 createReview,
 createReviewByAdmin,
 updateReview,
 updateReviewVisibility,
 removeReview,
} from "../controllers/reviewController.js";

const router = Router();
const adminView = (req, res, next) => {
 req.adminView = true;
 next();
};

router.get("/", listReviews);
router.get("/admin", auth, requireRole("admin"), adminView, listReviews);
router.get("/admin/:id", auth, requireRole("admin"), adminView, getReview);
router.get("/:id", getReview);

router.post("/", auth, createReview);
router.post("/admin", auth, requireRole("admin"), createReviewByAdmin);
router.put("/:id", auth, requireRole("admin"), updateReview);
router.patch("/:id/visibility", auth, requireRole("admin"), updateReviewVisibility);
router.delete("/:id", auth, requireRole("admin"), removeReview);

export default router;
