import { z } from "zod";

const optionalUrl = z
 .string()
 .trim()
 .url()
 .or(z.literal(""))
 .optional();

export const userReviewCreateSchema = z.object({
 reviewerName: z.string().trim().min(2),
 title: z.string().trim().optional().default(""),
 comment: z.string().trim().min(2),
 rating: z.number().min(1).max(5),
 imageUrl: optionalUrl.default(""),
});

export const reviewCreateSchema = userReviewCreateSchema.extend({
 isVisible: z.boolean().optional().default(true),
 isActive: z.boolean().optional().default(true),
});

export const reviewUpdateSchema = reviewCreateSchema.partial();
