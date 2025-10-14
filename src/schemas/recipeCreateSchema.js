import { z } from "zod";

export const recipeCreateSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  imageUrl: z.string().url().optional(),
  shortDescription: z.string().min(10),

  ingredients: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),

  prepTimeMins: z.number().int().nonnegative().optional().default(0),
  cookTimeMins: z.number().int().nonnegative().optional().default(0),
  servings: z.number().int().positive().optional().default(1),

  tags: z.array(z.string()).default([]),
  category: z.string().length(24).optional(),

  isActive: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),

  author: z
    .object({
      name: z.string().min(1).optional(),
      userId: z.string().length(24).optional(),
    })
    .optional(),
});

export const recipeUpdateSchema = recipeCreateSchema.partial();
