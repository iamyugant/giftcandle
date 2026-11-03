import { z } from "zod";

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), "Must be an http(s) URL");

export const fragranceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is at most 80 characters"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(500, "Description is at most 500 characters"),
  category: z.string().trim().min(1, "Category is required").max(50),
  image_url: httpUrl.optional(),
});

export const fragranceUpdateSchema = fragranceInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
