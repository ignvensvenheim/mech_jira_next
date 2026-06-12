import { DEPARTMENT_LINES } from "@/data/listData";

export type MachineCatalogItem = {
  machineKey: string;
  category: string;
  subcategory: string;
};

const HIDDEN_MACHINE_KEYS = new Set([
  "AB::CEFLA daÅ¾ymo linija",
  "AB::CEFLA linijos",
  "AB::UV linijos",
]);

export function isVisibleMachineKey(machineKey: string) {
  return !HIDDEN_MACHINE_KEYS.has(machineKey.trim());
}

export const VISIBLE_DEPARTMENT_LINES: Record<string, string[]> = Object.fromEntries(
  Object.entries(DEPARTMENT_LINES).map(([category, subcategories]) => [
    category,
    subcategories.filter((subcategory) =>
      isVisibleMachineKey(`${category}::${subcategory}`)
    ),
  ])
);

export function createVisibleMachineCatalog(): MachineCatalogItem[] {
  return Object.entries(VISIBLE_DEPARTMENT_LINES).flatMap(([category, subcategories]) =>
    subcategories.map((subcategory) => ({
      category,
      subcategory,
      machineKey: `${category}::${subcategory}`,
    }))
  );
}

export function filterVisibleMachineDirectory<T extends { machineKey: string }>(
  items: T[]
) {
  return items.filter((item) => isVisibleMachineKey(item.machineKey));
}
