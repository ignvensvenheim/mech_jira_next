"use client";

import "../page.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { useIssues } from "@/lib/IssuesContext";
import { DEPARTMENT_LINES } from "@/data/listData";
import type { NormalizedIssue } from "@/lib/jira";

type ManualCostEntry = {
  id: string;
  date: string;
  amount: number;
  comment: string;
  createdAt: string;
};

type MachineDataResponse = {
  hourlyRate: number;
  entries: ManualCostEntry[];
};

type TicketFixCost = {
  issueKey: string;
  machineKey: string;
  date: string;
  amount: number;
  comment: string;
  updatedAt: string;
};

type TicketFixDraft = {
  date: string;
  amount: string;
  comment: string;
};

type EquipmentDetailsResponse = {
  machineKey: string;
  model: string;
  serialNumber: string;
  manufacturer: string;
  updatedAt: string | null;
};

type EquipmentDraft = {
  model: string;
  serialNumber: string;
  manufacturer: string;
};

type AdminFunction = "costs" | "inventory" | null;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getIssueCategoryAndSubcategory(issue: NormalizedIssue) {
  const [categoryPart = "", subcategoryPart = ""] = (issue.summary ?? "")
    .split("|")
    .map((s: string) => s.trim());

  return {
    category: categoryPart,
    subcategory: subcategoryPart || "Unspecified",
  };
}

function formatSeconds(total: number) {
  const safe = Math.max(0, Math.floor(total || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.error || `Request failed (${response.status})`);
  }
  return json as T;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfIsoWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AdminPage() {
  const { loadingInitial, error } = useJiraSearch();
  const { issues } = useIssues();

  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [machineRate, setMachineRate] = useState(0);
  const [rateInput, setRateInput] = useState("");
  const [manualEntries, setManualEntries] = useState<ManualCostEntry[]>([]);
  const [machineDataLoading, setMachineDataLoading] = useState(false);
  const [machineDataError, setMachineDataError] = useState("");

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [entryAmount, setEntryAmount] = useState("");
  const [entryComment, setEntryComment] = useState("");
  const [ticketCostsByIssue, setTicketCostsByIssue] = useState<
    Record<string, TicketFixCost>
  >({});
  const [ticketDrafts, setTicketDrafts] = useState<Record<string, TicketFixDraft>>(
    {}
  );
  const [ticketCostsLoading, setTicketCostsLoading] = useState(false);
  const [savingTicketKey, setSavingTicketKey] = useState<string | null>(null);
  const [equipmentModel, setEquipmentModel] = useState("");
  const [equipmentSerialNumber, setEquipmentSerialNumber] = useState("");
  const [equipmentManufacturer, setEquipmentManufacturer] = useState("");
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [equipmentSaving, setEquipmentSaving] = useState(false);
  const [equipmentError, setEquipmentError] = useState("");
  const [activeFunction, setActiveFunction] = useState<AdminFunction>(null);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventorySavingKey, setInventorySavingKey] = useState<string | null>(null);
  const [loggedInAs, setLoggedInAs] = useState("");
  const [inventoryDrafts, setInventoryDrafts] = useState<
    Record<string, EquipmentDraft>
  >({});

  const subCategoryOptions = useMemo(
    () => (category ? DEPARTMENT_LINES[category] || [] : []),
    [category]
  );
  const machineCatalog = useMemo(
    () =>
      Object.entries(DEPARTMENT_LINES).flatMap(([dep, lines]) =>
        lines.map((line) => ({
          category: dep,
          subcategory: line,
          machineKey: `${dep}::${line}`,
        }))
      ),
    []
  );
  const filteredMachineCatalog = useMemo(() => {
    const needle = inventoryQuery.trim().toLowerCase();
    if (!needle) return machineCatalog;
    return machineCatalog.filter((m) => {
      const source = `${m.category} ${m.subcategory} ${m.machineKey}`.toLowerCase();
      return source.includes(needle);
    });
  }, [machineCatalog, inventoryQuery]);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editComment, setEditComment] = useState("");

  const filteredIssues = useMemo<NormalizedIssue[]>(() => {
    return ((issues ?? []) as NormalizedIssue[]).filter((i: NormalizedIssue) => {
      const { category: depPartRaw, subcategory: linePartRaw } =
        getIssueCategoryAndSubcategory(i);
      const depPart = depPartRaw.toLowerCase();
      const linePart = linePartRaw.toLowerCase();
      const dep = category.toLowerCase();
      const line = subCategory.toLowerCase();
      const matchCategory = !category || depPart === dep;
      const matchSub = !subCategory || linePart === line;

      const created = new Date(i.created).getTime();
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
      const to = dateTo ? new Date(dateTo).getTime() : Infinity;
      const matchDate = created >= from && created <= to;

      return matchCategory && matchSub && matchDate;
    });
  }, [issues, category, subCategory, dateFrom, dateTo]);

  const hasCategorySelection = Boolean(category);
  const hasTicketScope = Boolean(category || dateFrom || dateTo);
  const hasMachineSelection = Boolean(category && subCategory);
  const selectedMachineKey = hasMachineSelection
    ? `${category}::${subCategory}`
    : "";
  const selectedTicketScopeKey = category
    ? subCategory
      ? `${category}::${subCategory}`
      : `${category}::ALL`
    : "ALL::ALL";

  const totalTimeSeconds = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo).getTime() : Infinity;

    return filteredIssues.reduce((sum: number, issue: NormalizedIssue) => {
      const worklogs = issue.worklogs ?? [];
      if (worklogs.length > 0) {
        const logged = worklogs.reduce((acc: number, w) => {
          const started = new Date(w.started).getTime();
          if (started >= from && started <= to) {
            return acc + (w.timeSpentSeconds ?? 0);
          }
          return acc;
        }, 0);
        return sum + logged;
      }

      const created = new Date(issue.created).getTime();
      if (created >= from && created <= to) {
        return sum + (issue.timeSpentSeconds ?? 0);
      }
      return sum;
    }, 0);
  }, [filteredIssues, dateFrom, dateTo]);

  const selectedMachineCalculatedMoney = hasMachineSelection
    ? (totalTimeSeconds / 3600) * machineRate
    : 0;
  const selectedMachineManualMoney = manualEntries.reduce(
    (sum: number, entry) => sum + entry.amount,
    0
  );
  const selectedTicketFixMoney = filteredIssues.reduce((sum: number, issue) => {
    const cost = ticketCostsByIssue[issue.key];
    return sum + (cost?.amount ?? 0);
  }, 0);
  const selectedMachineTotalMoney =
    selectedMachineCalculatedMoney +
    selectedMachineManualMoney +
    selectedTicketFixMoney;
  const totalDisplayedCost = hasMachineSelection
    ? selectedMachineTotalMoney
    : selectedTicketFixMoney;
  const statsLoading = loadingInitial || machineDataLoading || ticketCostsLoading;

  const loadMachineData = useCallback(async () => {
    if (!hasMachineSelection) {
      setMachineRate(0);
      setRateInput("");
      setManualEntries([]);
      setMachineDataError("");
      return;
    }

    setMachineDataLoading(true);
    setMachineDataError("");
    try {
      const res = await fetch(
        `/api/admin/machine-data?machineKey=${encodeURIComponent(
          selectedMachineKey
        )}`,
        { cache: "no-store" }
      );
      const data = await parseJson<MachineDataResponse>(res);
      setMachineRate(data.hourlyRate ?? 0);
      setRateInput(String(data.hourlyRate ?? 0));
      setManualEntries(data.entries ?? []);
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
      setMachineRate(0);
      setRateInput("");
      setManualEntries([]);
    } finally {
      setMachineDataLoading(false);
    }
  }, [hasMachineSelection, selectedMachineKey]);

  const loadEquipmentData = useCallback(async () => {
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
  }, [hasMachineSelection, selectedMachineKey]);

  const loadInventoryData = useCallback(async () => {
    if (machineCatalog.length === 0) {
      setInventoryDrafts({});
      return;
    }

    setInventoryLoading(true);
    setInventoryError("");
    try {
      const res = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineKeys: machineCatalog.map((m) => m.machineKey),
        }),
      });
      const data = await parseJson<{ items: EquipmentDetailsResponse[] }>(res);
      const byMachineKey: Record<string, EquipmentDetailsResponse> = {};
      for (const item of data.items) {
        byMachineKey[item.machineKey] = item;
      }
      const nextDrafts: Record<string, EquipmentDraft> = {};
      for (const machine of machineCatalog) {
        const existing = byMachineKey[machine.machineKey];
        nextDrafts[machine.machineKey] = {
          model: existing?.model || "",
          serialNumber: existing?.serialNumber || "",
          manufacturer: existing?.manufacturer || "",
        };
      }
      setInventoryDrafts(nextDrafts);
    } catch (e: unknown) {
      setInventoryError(String((e as Error).message || e));
    } finally {
      setInventoryLoading(false);
    }
  }, [machineCatalog]);

  useEffect(() => {
    loadMachineData();
    setEditingEntryId(null);
    setEditDate("");
    setEditAmount("");
    setEditComment("");
  }, [loadMachineData]);

  useEffect(() => {
    loadEquipmentData();
  }, [loadEquipmentData]);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          user?: { name?: string | null; email?: string | null };
        };
        const label = String(data.user?.name || data.user?.email || "").trim();
        setLoggedInAs(label);
      } catch {
        setLoggedInAs("");
      }
    };
    void loadSession();
  }, []);

  useEffect(() => {
    const loadTicketCosts = async () => {
      const issueKeys = filteredIssues.map((i: NormalizedIssue) => i.key);
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
        const costsMap: Record<string, TicketFixCost> = {};
        const draftsMap: Record<string, TicketFixDraft> = {};

        for (const issue of filteredIssues) {
          const existing = data.items.find((item) => item.issueKey === issue.key);
          if (existing) {
            costsMap[issue.key] = existing;
            draftsMap[issue.key] = {
              date: existing.date,
              amount: String(existing.amount),
              comment: existing.comment,
            };
          } else {
            draftsMap[issue.key] = {
              date: new Date().toISOString().slice(0, 10),
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
    };

    void loadTicketCosts();
  }, [filteredIssues]);

  const resetFilters = () => {
    setCategory("");
    setSubCategory("");
    setDateFrom("");
    setDateTo("");
  };

  const applyCurrentWorkWeek = () => {
    const today = new Date();
    const monday = startOfIsoWeek(today);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    setDateFrom(toDateInputValue(monday));
    setDateTo(toDateInputValue(friday));
  };

  const applyPreviousWorkWeek = () => {
    const today = new Date();
    const monday = startOfIsoWeek(today);
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    const prevFriday = new Date(prevMonday);
    prevFriday.setDate(prevMonday.getDate() + 4);
    setDateFrom(toDateInputValue(prevMonday));
    setDateTo(toDateInputValue(prevFriday));
  };

  const applyThisMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    setDateFrom(toDateInputValue(start));
    setDateTo(toDateInputValue(today));
  };

  const applyLastMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    setDateFrom(toDateInputValue(start));
    setDateTo(toDateInputValue(end));
  };

  const applyLastSixMonths = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    setDateFrom(toDateInputValue(start));
    setDateTo(toDateInputValue(today));
  };

  const saveMachineRate = async () => {
    if (!hasMachineSelection) return;
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    try {
      const res = await fetch("/api/admin/machine-rate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineKey: selectedMachineKey,
          hourlyRate: parsed,
        }),
      });
      const data = await parseJson<{ hourlyRate: number }>(res);
      setMachineRate(data.hourlyRate);
      setRateInput(String(data.hourlyRate));
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
    }
  };

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
        body: JSON.stringify({
          machineKey: selectedMachineKey,
          model,
          serialNumber,
          manufacturer,
        }),
      });
      const data = await parseJson<EquipmentDetailsResponse>(res);
      setEquipmentModel(data.model || "");
      setEquipmentSerialNumber(data.serialNumber || "");
      setEquipmentManufacturer(data.manufacturer || "");
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
        body: JSON.stringify({
          machineKey,
          model,
          serialNumber,
          manufacturer,
        }),
      });
      const saved = await parseJson<EquipmentDetailsResponse>(res);
      setInventoryDrafts((prev) => ({
        ...prev,
        [machineKey]: {
          model: saved.model || "",
          serialNumber: saved.serialNumber || "",
          manufacturer: saved.manufacturer || "",
        },
      }));
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
        body: JSON.stringify({
          machineKey: selectedMachineKey,
          date: entryDate,
          amount,
          comment,
        }),
      });
      const entry = await parseJson<ManualCostEntry>(res);
      setManualEntries((prev) =>
        [...prev, entry].sort((a, b) => {
          const dateSort = b.date.localeCompare(a.date);
          if (dateSort !== 0) return dateSort;
          return b.createdAt.localeCompare(a.createdAt);
        })
      );
      setEntryAmount("");
      setEntryComment("");
    } catch (e: unknown) {
      setMachineDataError(String((e as Error).message || e));
    }
  };

  const deleteManualCostEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/admin/manual-entries/${entryId}`, {
        method: "DELETE",
      });
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
        body: JSON.stringify({
          date: editDate,
          amount,
          comment,
        }),
      });
      const updated = await parseJson<ManualCostEntry>(res);
      setManualEntries((prev) =>
        prev
          .map((entry) => (entry.id === updated.id ? updated : entry))
          .sort((a, b) => {
            const dateSort = b.date.localeCompare(a.date);
            if (dateSort !== 0) return dateSort;
            return b.createdAt.localeCompare(a.createdAt);
          })
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
        date: prev[issueKey]?.date || new Date().toISOString().slice(0, 10),
        amount: prev[issueKey]?.amount || "",
        comment: prev[issueKey]?.comment || "",
        [field]: value,
      },
    }));
  };

  const saveTicketFixCost = async (issueKey: string) => {
    if (!hasTicketScope) return;
    const draft = ticketDrafts[issueKey];
    if (!draft) return;
    const amountRaw = draft.amount.trim();
    const amount = amountRaw === "" ? 0 : Number(amountRaw);
    const comment = draft.comment.trim();
    const shouldDelete = amountRaw === "" && !comment;
    if (!shouldDelete && (!draft.date || !Number.isFinite(amount) || amount < 0)) {
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
          [issueKey]: {
            date: draft.date || new Date().toISOString().slice(0, 10),
            amount: "",
            comment: "",
          },
        }));
      } else {
        const res = await fetch("/api/admin/ticket-costs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueKey,
            machineKey: selectedTicketScopeKey,
            date: draft.date,
            amount,
            comment,
          }),
        });
        const saved = await parseJson<TicketFixCost>(res);
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

  return (
    <div className="page">
      <div className="page__layout page__layout--full">
        <section className="page__content">
          <div className="page__topbar">
            <div className="page__content-actions page__content-actions--gap">
              <Link href="/" className="page__action-link">
                Back to home
              </Link>
              <Link href="/admin" className="page__action-link">
                Admin home
              </Link>
            </div>
            <div className="page__session-label">
              {loggedInAs ? `Logged in as ${loggedInAs}` : ""}
            </div>
          </div>
          <div className="admin-dashboard">
            <div className="admin-card">
              <h1 className="admin-title">Admin Panel</h1>
              <p className="admin-subtitle">Choose a function to manage.</p>
              <div className="admin-function-grid">
                <button
                  type="button"
                  className={`admin-function-button ${
                    activeFunction === "costs" ? "admin-function-button--active" : ""
                  }`}
                  onClick={() => setActiveFunction("costs")}
                >
                  Add machine and ticket costs
                </button>
                <button
                  type="button"
                  className={`admin-function-button ${
                    activeFunction === "inventory"
                      ? "admin-function-button--active"
                      : ""
                  }`}
                  onClick={() => setActiveFunction("inventory")}
                >
                  Manage inventory
                </button>
                <Link href="/admin/users" className="admin-function-button">
                  Manage users
                </Link>
              </div>
            </div>

            {activeFunction === "costs" && (
              <>
            <div className="admin-card">
              <h1 className="admin-title">Admin Panel</h1>
              <p className="admin-subtitle">
                Filter by category and subcategory to see time spent on machines
                in a selected period.
              </p>

              <div className="admin-filters">
                <label>
                  <div className="admin-label">Category</div>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubCategory("");
                    }}
                    className="admin-input"
                  >
                    <option value="">All</option>
                    {Object.keys(DEPARTMENT_LINES).map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <div className="admin-label">Subcategory</div>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="admin-input"
                    disabled={!category}
                  >
                    <option value="">All</option>
                    {subCategoryOptions.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <div className="admin-label">Date from</div>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="admin-input"
                  />
                </label>
                <label>
                  <div className="admin-label">Date to</div>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="admin-input"
                  />
                </label>

                <div className="admin-date-presets">
                  <button
                    type="button"
                    className="admin-reset-button"
                    onClick={applyCurrentWorkWeek}
                  >
                    Current work week
                  </button>
                  <button
                    type="button"
                    className="admin-reset-button"
                    onClick={applyPreviousWorkWeek}
                  >
                    Previous work week
                  </button>
                  <button
                    type="button"
                    className="admin-reset-button"
                    onClick={applyThisMonth}
                  >
                    This month
                  </button>
                  <button
                    type="button"
                    className="admin-reset-button"
                    onClick={applyLastMonth}
                  >
                    Last month
                  </button>
                  <button
                    type="button"
                    className="admin-reset-button"
                    onClick={applyLastSixMonths}
                  >
                    Last 6 months
                  </button>
                </div>

                <div className="admin-filters-actions">
                  <button
                    type="button"
                    className="admin-reset-button"
                    onClick={resetFilters}
                    disabled={!category && !subCategory && !dateFrom && !dateTo}
                  >
                    Reset filters
                  </button>
                </div>
              </div>

              {error && !loadingInitial && (
                <div className="page__error">{String(error)}</div>
              )}

              {loadingInitial && <div className="page__loading">Loading...</div>}
            </div>

            <div className="admin-panel">
              <div className="admin-stats admin-stats--compact">
                <div className="admin-stat">
                  <div className="admin-stat-label">Time spent</div>
                  <div className="admin-stat-value">
                    {statsLoading ? (
                      <span className="admin-stat-loading">
                        <span className="admin-buffering-spinner" />
                      </span>
                    ) : (
                      formatSeconds(totalTimeSeconds)
                    )}
                  </div>
                </div>
                <div className="admin-stat">
                  <div className="admin-stat-label">Cost (total)</div>
                  <div className="admin-stat-value">
                    {statsLoading ? (
                      <span className="admin-stat-loading">
                        <span className="admin-buffering-spinner" />
                      </span>
                    ) : (
                      formatCurrency(totalDisplayedCost)
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-chart">
                {hasTicketScope && machineDataError && (
                  <div className="page__error">{machineDataError}</div>
                )}

                {hasMachineSelection && equipmentError && (
                  <div className="page__error">{equipmentError}</div>
                )}

                {hasMachineSelection && !equipmentLoading && (
                  <div className="admin-manual-costs">
                    <div className="admin-chart-title">Equipment Details</div>
                    <div className="admin-equipment-form">
                      <input
                        type="text"
                        className="admin-input"
                        value={equipmentModel}
                        onChange={(e) => setEquipmentModel(e.target.value)}
                        placeholder="Model"
                      />
                      <input
                        type="text"
                        className="admin-input"
                        value={equipmentSerialNumber}
                        onChange={(e) => setEquipmentSerialNumber(e.target.value)}
                        placeholder="Serial number"
                      />
                      <input
                        type="text"
                        className="admin-input"
                        value={equipmentManufacturer}
                        onChange={(e) => setEquipmentManufacturer(e.target.value)}
                        placeholder="Manufacturer"
                      />
                      <button
                        type="button"
                        className="admin-reset-button"
                        onClick={() => {
                          void saveEquipmentDetails();
                        }}
                        disabled={
                          equipmentSaving ||
                          !equipmentModel.trim() ||
                          !equipmentSerialNumber.trim() ||
                          !equipmentManufacturer.trim()
                        }
                      >
                        {equipmentSaving ? "Saving..." : "Save details"}
                      </button>
                    </div>
                  </div>
                )}

                {hasCategorySelection && !machineDataLoading && (
                  <div className="admin-manual-costs">
                    <div className="admin-chart-title">Manual Cost Entries</div>
                    <div className="admin-manual-form">
                      <input
                        type="date"
                        className="admin-input"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-input"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(e.target.value)}
                        placeholder="Amount (EUR)"
                      />
                      <input
                        type="text"
                        className="admin-input"
                        value={entryComment}
                        onChange={(e) => setEntryComment(e.target.value)}
                        placeholder='Comment, e.g. "fixed something"'
                      />
                      <button
                        type="button"
                        className="admin-reset-button"
                        onClick={() => {
                          void addManualCostEntry();
                        }}
                        disabled={
                          !entryDate ||
                          !entryAmount ||
                          Number(entryAmount) <= 0 ||
                          !entryComment.trim()
                        }
                      >
                        Add entry
                      </button>
                    </div>

                    <div className="admin-manual-total">
                      Manual total: {formatCurrency(selectedMachineManualMoney)}
                    </div>

                    {manualEntries.length === 0 && (
                      <div className="admin-chart-empty">
                        No manual entries yet.
                      </div>
                    )}

                    {manualEntries.map((entry) => (
                      <div key={entry.id} className="admin-manual-row">
                        {editingEntryId === entry.id ? (
                          <>
                            <input
                              type="date"
                              className="admin-input"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="admin-input"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                            />
                            <input
                              type="text"
                              className="admin-input"
                              value={editComment}
                              onChange={(e) => setEditComment(e.target.value)}
                            />
                            <div className="admin-manual-actions">
                              <button
                                type="button"
                                className="admin-reset-button"
                                onClick={() => {
                                  void saveEditManualCostEntry();
                                }}
                                disabled={
                                  !editDate ||
                                  !editAmount ||
                                  Number(editAmount) <= 0 ||
                                  !editComment.trim()
                                }
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="admin-reset-button"
                                onClick={cancelEditManualCostEntry}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>{entry.date}</div>
                            <div>{formatCurrency(entry.amount)}</div>
                            <div>{entry.comment}</div>
                            <div className="admin-manual-actions">
                              <button
                                type="button"
                                className="admin-reset-button"
                                onClick={() => startEditManualCostEntry(entry)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="admin-reset-button"
                                onClick={() => {
                                  void deleteManualCostEntry(entry.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {hasTicketScope && !machineDataLoading && (
                  <div className="admin-manual-costs">
                    {ticketCostsLoading && (
                      <div className="admin-buffering">
                        <div className="admin-buffering-spinner" />
                        <div className="admin-chart-empty">Loading tickets...</div>
                      </div>
                    )}
                    {!ticketCostsLoading && (
                      <>
                        <div className="admin-chart-title">
                          Tickets in selected period ({filteredIssues.length})
                        </div>
                    {filteredIssues.length === 0 && (
                      <div className="admin-chart-empty">
                        No tickets for selected filters.
                      </div>
                    )}
                        {filteredIssues.map((issue) => {
                      const draft = ticketDrafts[issue.key] || {
                        date: new Date().toISOString().slice(0, 10),
                        amount: "",
                        comment: "",
                      };
                      return (
                        <div key={issue.key} className="admin-ticket-row">
                          <div className="admin-ticket-meta">
                            <div className="admin-ticket-key">{issue.key}</div>
                            <div className="admin-ticket-summary">
                              {issue.summary}
                            </div>
                          </div>
                          <input
                            type="date"
                            className="admin-input"
                            value={draft.date}
                            onChange={(e) =>
                              setTicketDraftField(issue.key, "date", e.target.value)
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="admin-input"
                            value={draft.amount}
                            onChange={(e) =>
                              setTicketDraftField(issue.key, "amount", e.target.value)
                            }
                            placeholder="Fix cost (EUR)"
                          />
                          <input
                            type="text"
                            className="admin-input"
                            value={draft.comment}
                            onChange={(e) =>
                              setTicketDraftField(issue.key, "comment", e.target.value)
                            }
                            placeholder="Fix comment (optional)"
                          />
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() => {
                              void saveTicketFixCost(issue.key);
                            }}
                            disabled={
                              savingTicketKey === issue.key ||
                              !draft.date ||
                              (draft.amount.trim() !== "" &&
                                Number(draft.amount) < 0)
                            }
                          >
                            {savingTicketKey === issue.key ? "Saving..." : "Save"}
                          </button>
                        </div>
                      );
                    })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
              </>
            )}

            {activeFunction === "inventory" && (
              <>
                <div className="admin-card">
                  <h1 className="admin-title">Inventory Management</h1>
                  <p className="admin-subtitle">
                    View all machines and maintain equipment details.
                  </p>
                  <div className="admin-filters">
                    <label>
                      <div className="admin-label">Search machines</div>
                      <input
                        type="text"
                        className="admin-input"
                        value={inventoryQuery}
                        onChange={(e) => setInventoryQuery(e.target.value)}
                        placeholder="Category, subcategory, or key"
                      />
                    </label>
                    <div className="admin-filters-actions">
                      <button
                        type="button"
                        className="admin-reset-button"
                        onClick={() => {
                          void loadInventoryData();
                        }}
                        disabled={inventoryLoading}
                      >
                        {inventoryLoading ? "Loading..." : "Refresh list"}
                      </button>
                    </div>
                  </div>
                  {inventoryError && <div className="page__error">{inventoryError}</div>}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">
                    Machines ({filteredMachineCatalog.length})
                  </div>
                  {inventoryLoading && (
                    <div className="admin-buffering">
                      <div className="admin-buffering-spinner" />
                      <div className="admin-chart-empty">Loading machines...</div>
                    </div>
                  )}
                  {!inventoryLoading && filteredMachineCatalog.length === 0 && (
                    <div className="admin-chart-empty">No machines found.</div>
                  )}
                  {!inventoryLoading &&
                    filteredMachineCatalog.map((machine) => {
                      const draft = inventoryDrafts[machine.machineKey] || {
                        model: "",
                        serialNumber: "",
                        manufacturer: "",
                      };
                      const isSaving = inventorySavingKey === machine.machineKey;
                      return (
                        <div
                          key={machine.machineKey}
                          className="admin-inventory-row"
                        >
                          <div className="admin-ticket-meta">
                            <div className="admin-ticket-key">{machine.category}</div>
                            <div className="admin-ticket-summary">
                              {machine.subcategory} ({machine.machineKey})
                            </div>
                          </div>
                          <input
                            type="text"
                            className="admin-input"
                            value={draft.model}
                            onChange={(e) =>
                              setInventoryDraftField(
                                machine.machineKey,
                                "model",
                                e.target.value
                              )
                            }
                            placeholder="Model"
                          />
                          <input
                            type="text"
                            className="admin-input"
                            value={draft.serialNumber}
                            onChange={(e) =>
                              setInventoryDraftField(
                                machine.machineKey,
                                "serialNumber",
                                e.target.value
                              )
                            }
                            placeholder="Serial number"
                          />
                          <input
                            type="text"
                            className="admin-input"
                            value={draft.manufacturer}
                            onChange={(e) =>
                              setInventoryDraftField(
                                machine.machineKey,
                                "manufacturer",
                                e.target.value
                              )
                            }
                            placeholder="Manufacturer"
                          />
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() => {
                              void saveInventoryMachine(machine.machineKey);
                            }}
                            disabled={
                              isSaving ||
                              !draft.model.trim() ||
                              !draft.serialNumber.trim() ||
                              !draft.manufacturer.trim()
                            }
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
