// src/schemas/productSchemas.js
import { z } from "zod";
export const productCreateSchema = z.object({
 name: z.string().min(2),
 slug: z.string().min(2),
 category: z.string().length(24),
 pricePaise: z.number().int().nonnegative(),
 imageUrl: z.string().url().optional(),
 isActive: z.boolean().optional(),
 stock: z.number().int().nonnegative().optional(),
 description: z.string().min(2)
});
export const productUpdateSchema = productCreateSchema.partial();
