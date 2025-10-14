// src/schemas/categorySchemas.js
import { z } from "zod";
export const categoryCreateSchema = z.object({
 name: z.string().min(2),
 slug: z.string().min(2),
 description: z.string().optional(),
 isActive: z.boolean().optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();
