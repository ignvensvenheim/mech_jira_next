"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NormalizedIssue } from "@/lib/jira";
import {
  createMachineCatalog,
  createMachineDirectory,
  createMachineLabelByKey,
  getCurrentLocalDateOnly,
  getIssueAssetParts,
  parseJson,
  parseMachineKey,
  type AdminTranslate,
  type EquipmentDetailsResponse,
  type EquipmentDraft,
  type MachineDataResponse,
  type MachineDirectoryItem,
  type ManualCostEntry,
  type TicketFixCost,
  type TicketFixDraft,
} from "../adminShared";

type UseAdminAssetDataArgs = {
  sessionResolved: boolean;
  currentUserIsAdmin: boolean;
  costsCategory: string;
  costsSubCategory: string;
  filteredIssues: NormalizedIssue[];
  ticketsLoading: boolean;
  t: AdminTranslate;
};

function sortManualEntries(entries: ManualCostEntry[]) {
  return [...entries].sort((a, b) => {
    const dateSort = b.date.localeCompare(a.date);
    if (dateSort !== 0) return dateSort;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function useAdminAssetData({
  sessionResolved,
  currentUserIsAdmin,
  costsCategory,
  costsSubCategory,
  filteredIssues,
  ticketsLoading,
  t,
}: UseAdminAssetDataArgs) {
  const [manualEntries, setManualEntries] = useState<ManualCostEntry[]>([]);
  const [machineDataLoading, setMachineDataLoading] = useState(false);
  const [machineDataError, setMachineDataError] = useState("");
  const [entryDate, setEntryDate] = useState(getCurrentLocalDateOnly());
  const [entryAmount, setEntryAmount] = useState("");
  const [entryComment, setEntryComment] = useState("");
  const [ticketCostsByIssue, setTicketCostsByIssue] = useState<Record<string, TicketFixCost>>({});
  const [ticketDrafts, setTicketDrafts] = useState<Record<string, TicketFixDraft>>({});
  const [ticketCostsLoading, setTicketCostsLoading] = useState(false);
  const [savingTicketKey, setSavingTicketKey] = useState<string | null>(null);
  const [equipmentModel, setEquipmentModel] = useState("");
  const [equipmentSerialNumber, setEquipmentSerialNumber] = useState("");
  const [equipmentManufacturer, setEquipmentManufacturer] = useState("");
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [equipmentSaving, setEquipmentSaving] = useState(false);
  const [equipmentError, setEquipmentError] = useState("");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventorySavingKey, setInventorySavingKey] = useState<string | null>(null);
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, EquipmentDraft>>({});
  const [assetDetailsByMachineKey, setAssetDetailsByMachineKey] = useState<
    Record<string, EquipmentDetailsResponse>
  >({});
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editComment, setEditComment] = useState("");
  const [ticketCostsRefreshKey, setTicketCostsRefreshKey] = useState(0);

  const hasMachineSelection = Boolean(costsCategory && costsSubCategory);
  const selectedMachineKey = hasMachineSelection ? `${costsCategory}::${costsSubCategory}` : "";
  const selectedMachineManualMoney = manualEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const machineCatalog = useMemo<MachineDirectoryItem[]>(() => createMachineCatalog(), []);
  const costsSubCategoryOptions = useMemo(
    () =>
      costsCategory
        ? machineCatalog
            .filter((item) => item.category === costsCategory)
            .map((item) => item.subcategory)
        : [],
    [costsCategory, machineCatalog]
  );
  const machineDirectory = useMemo(
    () => createMachineDirectory(machineCatalog, assetDetailsByMachineKey),
    [assetDetailsByMachineKey, machineCatalog]
  );
  const filteredMachineDirectory = useMemo(() => {
    const needle = inventoryQuery.trim().toLowerCase();
    if (!needle) return machineDirectory;

    return machineDirectory.filter((machine) => {
      const source = `${machine.category} ${machine.subcategory} ${machine.machineKey}`.toLowerCase();
      return source.includes(needle);
    });
  }, [inventoryQuery, machineDirectory]);
  const machineLabelByKey = useMemo(
    () => createMachineLabelByKey(machineDirectory),
    [machineDirectory]
  );

  const upsertAssetDetailsCache = useCallback(
    (machineKey: string, next?: Partial<EquipmentDetailsResponse>) => {
      const parsed = parseMachineKey(machineKey);

      setAssetDetailsByMachineKey((prev) => {
        const existing = prev[machineKey];
        return {
          ...prev,
          [machineKey]: {
            machineKey,
            category: next?.category?.trim() || existing?.category || parsed.category || "",
            subcategory:
              next?.subcategory?.trim() || existing?.subcategory || parsed.subcategory || "",
            model: next?.model ?? existing?.model ?? "",
            serialNumber: next?.serialNumber ?? existing?.serialNumber ?? "",
            manufacturer: next?.manufacturer ?? existing?.manufacturer ?? "",
            updatedAt: next?.updatedAt ?? existing?.updatedAt ?? null,
          },
        };
      });

      setInventoryDrafts((prev) => {
        const existing = prev[machineKey];
        return {
          ...prev,
          [machineKey]: {
            model: next?.model ?? existing?.model ?? "",
            serialNumber: next?.serialNumber ?? existing?.serialNumber ?? "",
            manufacturer: next?.manufacturer ?? existing?.manufacturer ?? "",
          },
        };
      });
    },
    []
  );

  const loadMachineData = useCallback(async () => {
    if (!sessionResolved || !currentUserIsAdmin) {
      setMachineDataLoading(false);
      setMachineDataError("");
      setManualEntries([]);
      return;
    }
    if (!hasMachineSelection) {
      setManualEntries([]);
      setMachineDataError("");
      return;
    }

    setMachineDataLoading(true);
    setMachineDataError("");
    try {
      const res = await fetch(
        `/api/admin/machine-data?machineKey=${encodeURIComponent(selectedMachineKey)}`,
        { cache: "no-store" }
      );
      const data = await parseJson<MachineDataResponse>(res);
      setManualEntries(data.entries ?? []);
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
      setManualEntries([]);
    } finally {
      setMachineDataLoading(false);
    }
  }, [currentUserIsAdmin, hasMachineSelection, selectedMachineKey, sessionResolved]);

  const loadEquipmentData = useCallback(async () => {
    if (!sessionResolved || !currentUserIsAdmin) {
      setEquipmentLoading(false);
      setEquipmentError("");
      setEquipmentModel("");
      setEquipmentSerialNumber("");
      setEquipmentManufacturer("");
      return;
    }
    if (!hasMachineSelection) {
      setEquipmentModel("");
      setEquipmentSerialNumber("");
      setEquipmentManufacturer("");
      setEquipmentError("");
      return;
    }

    setEquipmentLoading(true);
    setEquipmentError("");
    try {
      const res = await fetch(
        `/api/admin/equipment?machineKey=${encodeURIComponent(selectedMachineKey)}`,
        { cache: "no-store" }
      );
      const data = await parseJson<EquipmentDetailsResponse>(res);
      setEquipmentModel(data.model || "");
      setEquipmentSerialNumber(data.serialNumber || "");
      setEquipmentManufacturer(data.manufacturer || "");
    } catch (e: unknown) {
      setEquipmentError(String((e as Error).message || e));
      setEquipmentModel("");
      setEquipmentSerialNumber("");
      setEquipmentManufacturer("");
    } finally {
      setEquipmentLoading(false);
    }
  }, [currentUserIsAdmin, hasMachineSelection, selectedMachineKey, sessionResolved]);

  const loadInventoryData = useCallback(async () => {
    if (!sessionResolved || !currentUserIsAdmin) {
      setInventoryLoading(false);
      setInventoryError("");
      setAssetDetailsByMachineKey({});
      setInventoryDrafts({});
      return;
    }
    if (machineCatalog.length === 0) {
      setAssetDetailsByMachineKey({});
      setInventoryDrafts({});
      return;
    }

    setInventoryLoading(true);
    setInventoryError("");
    try {
      const res = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeAll: true }),
      });
      const data = await parseJson<{ items: EquipmentDetailsResponse[] }>(res);
      const byMachineKey: Record<string, EquipmentDetailsResponse> = {};
      for (const item of data.items) {
        byMachineKey[item.machineKey] = item;
      }
      setAssetDetailsByMachineKey(byMachineKey);

      const nextDrafts: Record<string, EquipmentDraft> = {};
      for (const machineKey of new Set([
        ...machineCatalog.map((machine) => machine.machineKey),
        ...Object.keys(byMachineKey),
      ])) {
        const existing = byMachineKey[machineKey];
        nextDrafts[machineKey] = {
          model: existing?.model || "",
          serialNumber: existing?.serialNumber || "",
          manufacturer: existing?.manufacturer || "",
        };
      }
      setInventoryDrafts(nextDrafts);
    } catch (e: unknown) {
      setInventoryError(String((e as Error).message || e));
      setAssetDetailsByMachineKey({});
    } finally {
      setInventoryLoading(false);
    }
  }, [currentUserIsAdmin, machineCatalog, sessionResolved]);

  const loadTicketCosts = useCallback(async () => {
    if (ticketsLoading) {
      setTicketCostsLoading(false);
      return;
    }
    if (!sessionResolved || !currentUserIsAdmin) {
      setTicketCostsLoading(false);
      setTicketCostsByIssue({});
      setTicketDrafts({});
      setMachineDataError("");
      return;
    }

    const issueKeys = filteredIssues.map((issue) => issue.key);
    if (issueKeys.length === 0) {
      setTicketCostsByIssue({});
      setTicketDrafts({});
      setTicketCostsLoading(false);
      return;
    }

    setTicketCostsLoading(true);
    try {
      const res = await fetch("/api/admin/ticket-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKeys }),
      });
      const data = await parseJson<{ items: TicketFixCost[] }>(res);
      const itemsByIssueKey = Object.fromEntries(
        data.items.map((item) => [item.issueKey, item])
      ) as Record<string, TicketFixCost>;
      const costsMap: Record<string, TicketFixCost> = {};
      const draftsMap: Record<string, TicketFixDraft> = {};

      for (const issue of filteredIssues) {
        const existing = itemsByIssueKey[issue.key];
        if (existing) {
          costsMap[issue.key] = existing;
          draftsMap[issue.key] = {
            date: existing.date,
            amount: String(existing.amount),
            comment: existing.comment,
          };
        } else {
          draftsMap[issue.key] = {
            date: getCurrentLocalDateOnly(),
            amount: "",
            comment: "",
          };
        }
      }

      setTicketCostsByIssue(costsMap);
      setTicketDrafts(draftsMap);
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
    } finally {
      setTicketCostsLoading(false);
    }
  }, [currentUserIsAdmin, filteredIssues, sessionResolved, ticketsLoading]);

  useEffect(() => {
    void loadMachineData();
    setEditingEntryId(null);
    setEditDate("");
    setEditAmount("");
    setEditComment("");
  }, [loadMachineData]);

  useEffect(() => {
    void loadEquipmentData();
  }, [loadEquipmentData]);

  useEffect(() => {
    void loadInventoryData();
  }, [loadInventoryData]);

  useEffect(() => {
    void loadTicketCosts();
  }, [loadTicketCosts, ticketCostsRefreshKey]);

  const saveEquipmentDetails = async () => {
    if (!hasMachineSelection) return;
    const model = equipmentModel.trim();
    const serialNumber = equipmentSerialNumber.trim();
    const manufacturer = equipmentManufacturer.trim();
    if (!model || !serialNumber || !manufacturer) return;

    setEquipmentSaving(true);
    setEquipmentError("");
    try {
      const res = await fetch("/api/admin/equipment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineKey: selectedMachineKey, model, serialNumber, manufacturer }),
      });
      const data = await parseJson<EquipmentDetailsResponse>(res);
      setEquipmentModel(data.model || "");
      setEquipmentSerialNumber(data.serialNumber || "");
      setEquipmentManufacturer(data.manufacturer || "");
      upsertAssetDetailsCache(selectedMachineKey, data);
    } catch (e: unknown) {
      setEquipmentError(String((e as Error).message || e));
    } finally {
      setEquipmentSaving(false);
    }
  };

  const setInventoryDraftField = (
    machineKey: string,
    field: keyof EquipmentDraft,
    value: string
  ) => {
    setInventoryDrafts((prev) => ({
      ...prev,
      [machineKey]: {
        model: prev[machineKey]?.model || "",
        serialNumber: prev[machineKey]?.serialNumber || "",
        manufacturer: prev[machineKey]?.manufacturer || "",
        [field]: value,
      },
    }));
  };

  const saveInventoryMachine = async (machineKey: string) => {
    const draft = inventoryDrafts[machineKey];
    if (!draft) return;
    const model = draft.model.trim();
    const serialNumber = draft.serialNumber.trim();
    const manufacturer = draft.manufacturer.trim();
    if (!model || !serialNumber || !manufacturer) return;

    setInventorySavingKey(machineKey);
    setInventoryError("");
    try {
      const res = await fetch("/api/admin/equipment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineKey, model, serialNumber, manufacturer }),
      });
      const saved = await parseJson<EquipmentDetailsResponse>(res);
      upsertAssetDetailsCache(machineKey, saved);
    } catch (e: unknown) {
      setInventoryError(String((e as Error).message || e));
    } finally {
      setInventorySavingKey(null);
    }
  };

  const addManualCostEntry = async () => {
    if (!hasMachineSelection) return;
    const amount = Number(entryAmount);
    if (!entryDate || !Number.isFinite(amount) || amount <= 0) return;
    const comment = entryComment.trim();
    if (!comment) return;

    try {
      const res = await fetch("/api/admin/manual-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineKey: selectedMachineKey, date: entryDate, amount, comment }),
      });
      const entry = await parseJson<ManualCostEntry>(res);
      setManualEntries((prev) => sortManualEntries([...prev, entry]));
      upsertAssetDetailsCache(selectedMachineKey);
      setEntryAmount("");
      setEntryComment("");
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
    }
  };

  const deleteManualCostEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/admin/manual-entries/${entryId}`, { method: "DELETE" });
      await parseJson<{ ok: boolean }>(res);
      setManualEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      if (editingEntryId === entryId) {
        setEditingEntryId(null);
        setEditDate("");
        setEditAmount("");
        setEditComment("");
      }
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
    }
  };

  const startEditManualCostEntry = (entry: ManualCostEntry) => {
    setEditingEntryId(entry.id);
    setEditDate(entry.date);
    setEditAmount(String(entry.amount));
    setEditComment(entry.comment);
  };

  const cancelEditManualCostEntry = () => {
    setEditingEntryId(null);
    setEditDate("");
    setEditAmount("");
    setEditComment("");
  };

  const saveEditManualCostEntry = async () => {
    if (!editingEntryId) return;
    const amount = Number(editAmount);
    if (!editDate || !Number.isFinite(amount) || amount <= 0) return;
    const comment = editComment.trim();
    if (!comment) return;

    try {
      const res = await fetch(`/api/admin/manual-entries/${editingEntryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editDate, amount, comment }),
      });
      const updated = await parseJson<ManualCostEntry>(res);
      setManualEntries((prev) =>
        sortManualEntries(prev.map((entry) => (entry.id === updated.id ? updated : entry)))
      );
      cancelEditManualCostEntry();
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
    }
  };

  const setTicketDraftField = (
    issueKey: string,
    field: keyof TicketFixDraft,
    value: string
  ) => {
    setTicketDrafts((prev) => ({
      ...prev,
      [issueKey]: {
        date: prev[issueKey]?.date || getCurrentLocalDateOnly(),
        amount: prev[issueKey]?.amount || "",
        comment: prev[issueKey]?.comment || "",
        [field]: value,
      },
    }));
  };

  const saveTicketFixCost = async (issueKey: string) => {
    const draft = ticketDrafts[issueKey];
    if (!draft) return;
    const issue = filteredIssues.find((item) => item.key === issueKey);
    const machineKey = getIssueAssetParts(issue ?? null).machineKey;
    const amountRaw = draft.amount.trim();
    const amount = amountRaw === "" ? 0 : Number(amountRaw);
    const comment = draft.comment.trim();
    const shouldDelete = amountRaw === "" && !comment;
    if (!shouldDelete && (!draft.date || !Number.isFinite(amount) || amount < 0)) return;
    if (!shouldDelete && !machineKey) {
      setMachineDataError(t("admin.noMachineMapping"));
      return;
    }

    setSavingTicketKey(issueKey);
    setMachineDataError("");
    try {
      if (shouldDelete) {
        const res = await fetch("/api/admin/ticket-costs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueKey }),
        });
        await parseJson<{ ok: boolean }>(res);
        setTicketCostsByIssue((prev) => {
          const next = { ...prev };
          delete next[issueKey];
          return next;
        });
        setTicketDrafts((prev) => ({
          ...prev,
          [issueKey]: { date: draft.date || getCurrentLocalDateOnly(), amount: "", comment: "" },
        }));
      } else {
        const res = await fetch("/api/admin/ticket-costs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueKey, machineKey, date: draft.date, amount, comment }),
        });
        const saved = await parseJson<TicketFixCost>(res);
        upsertAssetDetailsCache(machineKey);
        setTicketCostsByIssue((prev) => ({ ...prev, [issueKey]: saved }));
        setTicketDrafts((prev) => ({
          ...prev,
          [issueKey]: {
            date: saved.date,
            amount: String(saved.amount),
            comment: saved.comment,
          },
        }));
      }
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
    } finally {
      setSavingTicketKey(null);
    }
  };

  const refreshTicketCosts = () => {
    setTicketCostsRefreshKey((value) => value + 1);
  };

  return {
    manualEntries,
    machineDataLoading,
    machineDataError,
    entryDate,
    setEntryDate,
    entryAmount,
    setEntryAmount,
    entryComment,
    setEntryComment,
    ticketCostsByIssue,
    ticketDrafts,
    ticketCostsLoading,
    savingTicketKey,
    equipmentModel,
    setEquipmentModel,
    equipmentSerialNumber,
    setEquipmentSerialNumber,
    equipmentManufacturer,
    setEquipmentManufacturer,
    equipmentLoading,
    equipmentSaving,
    equipmentError,
    inventoryQuery,
    setInventoryQuery,
    inventoryLoading,
    inventoryError,
    inventorySavingKey,
    inventoryDrafts,
    assetDetailsByMachineKey,
    machineCatalog,
    costsSubCategoryOptions,
    machineDirectory,
    filteredMachineDirectory,
    machineLabelByKey,
    hasMachineSelection,
    selectedMachineKey,
    selectedMachineManualMoney,
    upsertAssetDetailsCache,
    editingEntryId,
    editDate,
    setEditDate,
    editAmount,
    setEditAmount,
    editComment,
    setEditComment,
    loadMachineData,
    loadEquipmentData,
    loadInventoryData,
    saveEquipmentDetails,
    setInventoryDraftField,
    saveInventoryMachine,
    addManualCostEntry,
    deleteManualCostEntry,
    startEditManualCostEntry,
    cancelEditManualCostEntry,
    saveEditManualCostEntry,
    setTicketDraftField,
    saveTicketFixCost,
    refreshTicketCosts,
  };
}
