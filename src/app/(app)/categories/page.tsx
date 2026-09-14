import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { CategoryManagement } from "@/features/categories/components/category-management";
import {
  initializeDefaultCategories,
  listCategories,
} from "@/features/categories/server/category";
import { listCategoryUsage } from "@/features/categories/server/category-management";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const ownerId = session.user.id;

  await initializeDefaultCategories(db, ownerId);
  const [categories, usage] = await Promise.all([
    listCategories(db, ownerId),
    listCategoryUsage(db, ownerId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <CategoryManagement categories={categories} usage={usage} />
    </main>
  );
}
