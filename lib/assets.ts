import type { PrismaClient } from "@prisma/client";
import type { NormalizedIssue } from "@/lib/jira";

type AssetParts = {
  category: string;
  subcategory: string;
  machineKey: string;
};

export function buildMachineKey(category: string, subcategory: string) {
  const nextCategory = category.trim();
  const nextSubcategory = subcategory.trim();
  return nextCategory && nextSubcategory
    ? `${nextCategory}::${nextSubcategory}`
    : "";
}

export function parseMachineKey(machineKey: string): AssetParts {
  const [category = "", subcategory = ""] = machineKey
    .split("::")
    .map((part) => part.trim());

  return {
    category,
    subcategory,
    machineKey: buildMachineKey(category, subcategory),
  };
}

export function getIssueAssetParts(
  issue: Pick<NormalizedIssue, "summary"> | null
): AssetParts {
  const [category = "", subcategory = ""] = (issue?.summary ?? "")
    .split("|")
    .map((part) => part.trim());

  return {
    category,
    subcategory,
    machineKey: buildMachineKey(category, subcategory),
  };
}

export function isConcreteMachineKey(machineKey: string) {
  const { category, subcategory } = parseMachineKey(machineKey);
  return Boolean(
    category &&
      subcategory &&
      category.toUpperCase() !== "ALL" &&
      subcategory.toUpperCase() !== "ALL"
  );
}

export async function ensureAssetExists(
  prisma: PrismaClient,
  machineKey: string,
  updatedById?: string | null
) {
  const { category, subcategory } = parseMachineKey(machineKey);

  if (!category || !subcategory) {
    throw new Error("machineKey must be a concrete asset key");
  }

  return prisma.asset.upsert({
    where: { machineKey },
    update: updatedById ? { updatedById } : {},
    create: {
      machineKey,
      category,
      subcategory,
      updatedById: updatedById || null,
    },
  });
}
