import type { PrismaClient } from "@prisma/client";
import type { NormalizedIssue } from "@/lib/jira";

type AssetParts = {
  category: string;
  subcategory: string;
  machineKey: string;
};

const DEPRECATED_MACHINE_KEY_MAP: Record<string, string> = {
  "AB::UV linijos": "AB::UV apdailos linija",
  "AB::CEFLA linijos": "AB::CEFLA daÅ¾ymo linija",
};

export function buildMachineKey(category: string, subcategory: string) {
  const nextCategory = category.trim();
  const nextSubcategory = subcategory.trim();
  return nextCategory && nextSubcategory
    ? `${nextCategory}::${nextSubcategory}`
    : "";
}

export function normalizeDeprecatedMachineKey(machineKey: string) {
  const normalizedKey = machineKey.trim();
  return DEPRECATED_MACHINE_KEY_MAP[normalizedKey] || normalizedKey;
}

export function parseMachineKey(machineKey: string): AssetParts {
  const [category = "", subcategory = ""] = normalizeDeprecatedMachineKey(machineKey)
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
  const normalizedMachineKey = normalizeDeprecatedMachineKey(machineKey);
  const { category, subcategory } = parseMachineKey(normalizedMachineKey);

  if (!category || !subcategory) {
    throw new Error("machineKey must be a concrete asset key");
  }

  return prisma.asset.upsert({
    where: { machineKey: normalizedMachineKey },
    update: updatedById ? { updatedById } : {},
    create: {
      machineKey: normalizedMachineKey,
      category,
      subcategory,
      updatedById: updatedById || null,
    },
  });
}
