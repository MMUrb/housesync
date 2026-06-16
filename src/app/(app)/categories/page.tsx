import { getHouseCategories, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { CategoryManager } from "@/components/categories/CategoryManager";

export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { house } = await requireHouse();
  const cats = (await getHouseCategories(house.id)).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    sort: c.sort,
  }));

  return (
    <div>
      <PageTitle title="Categories" backHref="/settings" />
      <p className="mb-3 px-1 text-sm text-slate-500">
        Shared by your whole house. Rename them, recolour them, or add your own (like a streaming
        service). They show up when you add an expense and in your spending.
      </p>
      <CategoryManager houseId={house.id} initial={cats} />
    </div>
  );
}
