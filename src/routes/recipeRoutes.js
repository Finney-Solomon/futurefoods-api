import express from "express";
import {
 listRecipes,
 getRecipeBySlug,
 createRecipe,
 updateRecipe,
 removeRecipe,
} from "../controllers/recipeController.js";
// import { validateBody } from "../middleware/validate.js";
// import { recipeCreateSchema, recipeUpdateSchema } from "../schemas/recipeSchemas.js";

const router = express.Router();

router.get("/", listRecipes); // GET /api/recipes?featured=true&q=kimchi...
router.get("/slug/:slug", getRecipeBySlug); // GET /api/recipes/slug/kimchi-grilled-cheese

// Admin
router.post(
 "/",
 // validateBody(recipeCreateSchema)
 createRecipe
);
router.put(
 "/:id",
 //  validateBody(recipeUpdateSchema)
 updateRecipe
);
router.delete("/:id", removeRecipe);

export default router;
