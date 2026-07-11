import { Router } from "express";
import { z } from "zod";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { serializeCategory } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["income", "expense"]),
  parentCategoryId: z.string().uuid().nullish(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120),
});

const idParams = z.object({ id: z.string().uuid() });

// GET nested tree: top-level categories with their sub-categories.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { userId: getUserId(req), parentCategoryId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    res.json({ categories: categories.map((c) => serializeCategory(c)) });
  }),
);

router.post(
  "/",
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { name, type, parentCategoryId } = req.body as z.infer<typeof createSchema>;

    if (parentCategoryId) {
      const parent = await prisma.category.findFirst({
        where: { id: parentCategoryId, userId },
      });
      if (!parent) throw new NotFoundError("Parent category not found");
      if (parent.type !== type) {
        throw new BadRequestError("Sub-category type must match its parent category type");
      }
      if (parent.parentCategoryId) {
        throw new BadRequestError("Categories can only be nested one level deep");
      }
    }

    const category = await prisma.category.create({
      data: { userId, name, type, parentCategoryId: parentCategoryId ?? null, isDefault: false },
    });
    res.status(201).json({ category: serializeCategory(category) });
  }),
);

async function findOwnedCategory(userId: string, id: string) {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) throw new NotFoundError("Category not found");
  return category;
}

router.patch(
  "/:id",
  validate({ params: idParams, body: updateSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const existing = await findOwnedCategory(userId, req.params.id);
    if (existing.isDefault) throw new ForbiddenError("Default categories cannot be renamed");
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name: (req.body as z.infer<typeof updateSchema>).name },
    });
    res.json({ category: serializeCategory(category) });
  }),
);

router.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const existing = await findOwnedCategory(userId, req.params.id);
    if (existing.isDefault) throw new ForbiddenError("Default categories cannot be deleted");

    const [txCount, childCount] = await Promise.all([
      prisma.transaction.count({ where: { categoryId: req.params.id } }),
      prisma.category.count({ where: { parentCategoryId: req.params.id } }),
    ]);
    if (txCount > 0) {
      throw new ConflictError(`Cannot delete a category used by ${txCount} transaction(s).`);
    }
    if (childCount > 0) {
      throw new ConflictError(`Cannot delete a category with ${childCount} sub-categorie(s).`);
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

export default router;
