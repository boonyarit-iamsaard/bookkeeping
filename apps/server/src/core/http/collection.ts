import * as z from "zod";

const pageSchema = z
  .object({
    nextCursor: z.string().nullable(),
  })
  .meta({ id: "Page" });

export function createCollectionResponseSchema<Item extends z.ZodType>(
  itemSchema: Item,
) {
  return z.object({
    items: z.array(itemSchema),
    page: pageSchema,
  });
}
