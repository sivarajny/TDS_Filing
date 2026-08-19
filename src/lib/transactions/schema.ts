import { z } from "zod";

const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid 10-character PAN (e.g. ABCDE1234F)");

export const milestoneInputSchema = z.object({
  description: z.string().trim().min(1, "Milestone description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  dueDate: z.string().trim().min(1, "Due date is required"),
});

export const buyerSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), buyerId: z.string().uuid() }),
  z.object({
    mode: z.literal("invite"),
    buyerName: z.string().trim().min(1, "Buyer name is required"),
    buyerEmail: z.string().trim().email("Enter a valid email"),
  }),
]);

export const createTransactionSchema = z.object({
  projectId: z.string().uuid().optional(),
  newProjectName: z.string().trim().optional(),

  propertyAddress: z.string().trim().min(1, "Property address is required"),
  unitNumber: z.string().trim().optional(),
  propertyValue: z.coerce.number().positive("Property value must be greater than 0"),

  buyerName: z.string().trim().min(1, "Buyer name is required"),
  buyerPan: panSchema,
  buyerAddress: z.string().trim().optional(),

  sellerName: z.string().trim().min(1, "Seller name is required"),
  sellerPan: z
    .union([panSchema, z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  sellerResidentialStatus: z.enum(["resident", "nri"]),
  sellerAddress: z.string().trim().optional(),

  milestones: z.array(milestoneInputSchema).min(1, "Add at least one payment milestone"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;
