"use client";

import "../page.css";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import Modal from "react-modal";
import { useI18n } from "@/components/I18nProvider";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { useIssues } from "@/lib/IssuesContext";
import { getIssueAssetParts, parseMachineKey } from "@/lib/assets";
import {
  dateOnlyToDayKey,
  formatDateOnly,
  getCurrentLocalDateOnly,
  getCurrentLocalDayKey,
  parseDateOnly,
} from "@/lib/dateOnly";
import { DEPARTMENT_LINES } from "@/data/listData";
import AdminTicketModal from "@/components/AdminTicketModal/AdminTicketModal";
import UsersManager from "./users/users-manager";
import type { NormalizedIssue } from "@/lib/jira";

Modal.setAppElement("body");

type ManualCostEntry = {
  id: string;
  date: string;
  amount: number;
  comment: string;
  createdAt: string;
};

type MachineDataResponse = {
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
  category?: string;
  subcategory?: string;
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

type PlannedMaintenanceItem = {
  id: string;
  machineKey: string;
  title: string;
  dueDate: string;
  note: string | null;
  cost: number | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MaintenanceStatus = "overdue" | "dueSoon" | "upcoming" | "completed";
type MaintenanceLogEntry = {
  id: string;
  category: string;
  change: string;
  title: string;
  timestamp: string;
  kind: "created" | "updated" | "completed";
};

type AssetStatisticsRow = {
  key: string;
  label: string;
  category: string;
  subcategory: string;
  breakdowns: number;
  loggedSeconds: number;
  repairCost: number;
  maintenanceCost: number;
};

type MachineDirectoryItem = {
  machineKey: string;
  category: string;
  subcategory: string;
};

type AdminFunction =
  | "costs"
  | "maintenance"
  | "inventory"
  | "users"
  | "statistics";
type DatePreset = "" | "all" | "last7" | "thisMonth" | "lastMonth" | "last6Months";

function getLocaleTag(locale: string) {
  return locale === "lt" ? "lt-LT" : "en-US";
}

function formatMachineDirectoryLabel(machine: {
  category: string;
  subcategory: string;
}) {
  const category = machine.category.trim();
  const subcategory = machine.subcategory.trim();

  if (category && subcategory) {
    return `${category} / ${subcategory}`;
  }

  return category || subcategory;
}

function formatCurrency(amount: number, locale: string = "en") {
  return new Intl.NumberFormat(getLocaleTag(locale), {
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

function summarizeIssuesByAsset(issueList: NormalizedIssue[]) {
  const byMachine = new Map<
    string,
    {
      key: string;
      category: string;
      subcategory: string;
      breakdowns: number;
      loggedSeconds: number;
    }
  >();
  let unmappedTickets = 0;

  for (const issue of issueList) {
    const parts = getIssueAssetParts(issue);
    if (!parts.machineKey) {
      unmappedTickets += 1;
      continue;
    }

    const existing = byMachine.get(parts.machineKey) || {
      key: parts.machineKey,
      category: parts.category,
      subcategory: parts.subcategory,
      breakdowns: 0,
      loggedSeconds: 0,
    };

    existing.breakdowns += 1;
    existing.loggedSeconds += issue.timeSpentSeconds ?? 0;
    byMachine.set(parts.machineKey, existing);
  }

  return {
    byMachine,
    unmappedTickets,
  };
}

function getRepairCostTotalsByMachine(
  issueList: NormalizedIssue[],
  ticketCostsByIssue: Record<string, TicketFixCost>
) {
  const totals = new Map<string, number>();

  for (const issue of issueList) {
    const machineKey = getIssueAssetParts(issue).machineKey;
    if (!machineKey) continue;

    totals.set(
      machineKey,
      (totals.get(machineKey) ?? 0) + (ticketCostsByIssue[issue.key]?.amount ?? 0)
    );
  }

  return totals;
}

function sortPlannedMaintenanceItems(items: PlannedMaintenanceItem[]) {
  return [...items].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return Number(a.isCompleted) - Number(b.isCompleted);
    }

    const dueDateSort = a.dueDate.localeCompare(b.dueDate);
    if (dueDateSort !== 0) return dueDateSort;

    return a.title.localeCompare(b.title);
  });
}

function getMaintenanceItemStatus(
  item: PlannedMaintenanceItem,
  todayDayKey: number = getCurrentLocalDayKey()
): MaintenanceStatus {
  if (item.isCompleted) return "completed";

  const dueDayKey = dateOnlyToDayKey(item.dueDate);
  if (dueDayKey === null) return "upcoming";
  if (dueDayKey < todayDayKey) return "overdue";
  if (dueDayKey <= todayDayKey + 7) return "dueSoon";

  return "upcoming";
}

function toDateOnlyFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function formatSeconds(total: number, locale: string = "en") {
  const safe = Math.max(0, Math.floor(total || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (locale === "lt") {
    return `${hours} val ${minutes} min ${seconds} s`;
  }
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

function getLastSevenDaysRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(today),
  };
}

function getThisMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(today),
  };
}

function getLastMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

function getLastSixMonthsRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(today),
  };
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateTimeForLocale(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTicketCountLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  count: number
) {
  return t(count === 1 ? "admin.ticketsCountOne" : "admin.ticketsCountMany", {
    count,
  });
}

function getActiveDatePreset(from: string, to: string) {
  const matches = (range: { from: string; to: string }) =>
    from === range.from && to === range.to;

  if (!from && !to) return "all";
  if (matches(getLastSevenDaysRange())) return "last7";
  if (matches(getThisMonthRange())) return "thisMonth";
  if (matches(getLastMonthRange())) return "lastMonth";
  if (matches(getLastSixMonthsRange())) return "last6Months";
  return "";
}

type AdminFiltersProps = {
  className?: string;
  category: string;
  subCategory: string;
  dateFrom: string;
  dateTo: string;
  subCategoryOptions: string[];
  activeDatePreset: DatePreset;
  resetDisabled: boolean;
  onCategoryChange: (value: string) => void;
  onSubCategoryChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApplyAllTickets: () => void;
  onApplyLastSevenDays: () => void;
  onApplyThisMonth: () => void;
  onApplyLastMonth: () => void;
  onApplyLastSixMonths: () => void;
  onResetFilters: () => void;
};

function AdminFilters({
  className,
  category,
  subCategory,
  dateFrom,
  dateTo,
  subCategoryOptions,
  activeDatePreset,
  resetDisabled,
  onCategoryChange,
  onSubCategoryChange,
  onDateFromChange,
  onDateToChange,
  onApplyAllTickets,
  onApplyLastSevenDays,
  onApplyThisMonth,
  onApplyLastMonth,
  onApplyLastSixMonths,
  onResetFilters,
}: AdminFiltersProps) {
  const { t } = useI18n();

  return (
    <div className={className ? `admin-filters ${className}` : "admin-filters"}>
      <label>
        <div className="admin-label">{t("home.category")}</div>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="admin-input"
        >
          <option value="">{t("common.all")}</option>
          {Object.keys(DEPARTMENT_LINES).map((dep) => (
            <option key={dep} value={dep}>
              {dep}
            </option>
          ))}
        </select>
      </label>

      <label>
        <div className="admin-label">{t("home.subcategory")}</div>
        <select
          value={subCategory}
          onChange={(e) => onSubCategoryChange(e.target.value)}
          className="admin-input"
          disabled={!category}
        >
          <option value="">{t("common.all")}</option>
          {subCategoryOptions.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>
      </label>

      <label>
        <div className="admin-label">{t("common.dateFrom")}</div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="admin-input"
        />
      </label>

      <label>
        <div className="admin-label">{t("common.dateTo")}</div>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="admin-input"
        />
      </label>

      <div className="admin-filters-actions admin-filters-actions--presets">
        <div className="admin-date-presets">
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "all" ? " admin-reset-button--active" : ""
            }`}
            onClick={onApplyAllTickets}
          >
            {t("common.allTickets")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "last7" ? " admin-reset-button--active" : ""
            }`}
            onClick={onApplyLastSevenDays}
          >
            {t("common.last7Days")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "thisMonth"
                ? " admin-reset-button--active"
                : ""
            }`}
            onClick={onApplyThisMonth}
          >
            {t("common.thisMonth")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "lastMonth"
                ? " admin-reset-button--active"
                : ""
            }`}
            onClick={onApplyLastMonth}
          >
            {t("common.lastMonth")}
          </button>
          <button
            type="button"
            className={`admin-reset-button${
              activeDatePreset === "last6Months"
                ? " admin-reset-button--active"
                : ""
            }`}
            onClick={onApplyLastSixMonths}
          >
            {t("common.last6Months")}
          </button>
        </div>
        <button
          type="button"
          className="admin-reset-button"
          onClick={onResetFilters}
          disabled={resetDisabled}
        >
          {t("common.resetFilters")}
        </button>
      </div>
    </div>
  );
}

function AdminPageContent() {
  const { locale, t } = useI18n();
  const ticketsPerPage = 20;
  const searchParams = useSearchParams();
  const { loadingInitial, error } = useJiraSearch();
  const { issues } = useIssues();
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserLabel, setCurrentUserLabel] = useState("");
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [currentUserCanManageUsers, setCurrentUserCanManageUsers] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(false);
  const defaultDateRange = useMemo(() => getLastSevenDaysRange(), []);

  const [costsCategory, setCostsCategory] = useState("");
  const [costsSubCategory, setCostsSubCategory] = useState("");
  const [statisticsCategory, setStatisticsCategory] = useState("");
  const [statisticsSubCategory, setStatisticsSubCategory] = useState("");
  const [costsDateFrom, setCostsDateFrom] = useState(defaultDateRange.from);
  const [costsDateTo, setCostsDateTo] = useState(defaultDateRange.to);
  const [statisticsDateFrom, setStatisticsDateFrom] = useState(
    defaultDateRange.from
  );
  const [statisticsDateTo, setStatisticsDateTo] = useState(defaultDateRange.to);

  const [manualEntries, setManualEntries] = useState<ManualCostEntry[]>([]);
  const [machineDataLoading, setMachineDataLoading] = useState(false);
  const [machineDataError, setMachineDataError] = useState("");

  const [entryDate, setEntryDate] = useState(getCurrentLocalDateOnly());
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
  const [activeFunction, setActiveFunction] = useState<AdminFunction>("costs");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventorySavingKey, setInventorySavingKey] = useState<string | null>(null);
  const [inventoryDrafts, setInventoryDrafts] = useState<
    Record<string, EquipmentDraft>
  >({});
  const [assetDetailsByMachineKey, setAssetDetailsByMachineKey] = useState<
    Record<string, EquipmentDetailsResponse>
  >({});
  const [plannedMaintenanceItems, setPlannedMaintenanceItems] = useState<
    PlannedMaintenanceItem[]
  >([]);
  const [plannedMaintenanceLoading, setPlannedMaintenanceLoading] = useState(false);
  const [plannedMaintenanceError, setPlannedMaintenanceError] = useState("");
  const [plannedMaintenanceSaving, setPlannedMaintenanceSaving] = useState(false);
  const [maintenanceActionKey, setMaintenanceActionKey] = useState<string | null>(
    null
  );
  const [selectedMaintenanceDate, setSelectedMaintenanceDate] = useState(
    getCurrentLocalDateOnly()
  );
  const [editingMaintenanceId, setEditingMaintenanceId] = useState<string | null>(
    null
  );
  const [maintenanceMachineKey, setMaintenanceMachineKey] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDueDate, setMaintenanceDueDate] = useState(
    getCurrentLocalDateOnly()
  );
  const [maintenanceCost, setMaintenanceCost] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [maintenanceCalendarMonth, setMaintenanceCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<NormalizedIssue | null>(null);
  const [ticketCostsRefreshKey, setTicketCostsRefreshKey] = useState(0);
  const [costsCurrentPage, setCostsCurrentPage] = useState(1);

  const handleLogout = useCallback(() => {
    void signOut({ callbackUrl: "/login" });
  }, []);

  const costsSubCategoryOptions = useMemo(
    () => (costsCategory ? DEPARTMENT_LINES[costsCategory] || [] : []),
    [costsCategory]
  );
  const statisticsSubCategoryOptions = useMemo(
    () =>
      statisticsCategory ? DEPARTMENT_LINES[statisticsCategory] || [] : [],
    [statisticsCategory]
  );
  const machineCatalog = useMemo<MachineDirectoryItem[]>(
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
  const machineDirectory = useMemo<MachineDirectoryItem[]>(() => {
    const catalogKeys = new Set(machineCatalog.map((machine) => machine.machineKey));
    const extras = Object.values(assetDetailsByMachineKey)
      .filter((asset) => !catalogKeys.has(asset.machineKey))
      .map((asset) => {
        const parsed = parseMachineKey(asset.machineKey);
        return {
          machineKey: asset.machineKey,
          category: asset.category?.trim() || parsed.category || asset.machineKey,
          subcategory: asset.subcategory?.trim() || parsed.subcategory || "",
        };
      })
      .sort((a, b) => {
        const categorySort = a.category.localeCompare(b.category);
        if (categorySort !== 0) return categorySort;

        const subcategorySort = a.subcategory.localeCompare(b.subcategory);
        if (subcategorySort !== 0) return subcategorySort;

        return a.machineKey.localeCompare(b.machineKey);
      });

    return [...machineCatalog, ...extras];
  }, [assetDetailsByMachineKey, machineCatalog]);
  const filteredMachineDirectory = useMemo(() => {
    const needle = inventoryQuery.trim().toLowerCase();
    if (!needle) return machineDirectory;
    return machineDirectory.filter((m) => {
      const source = `${m.category} ${m.subcategory} ${m.machineKey}`.toLowerCase();
      return source.includes(needle);
    });
  }, [machineDirectory, inventoryQuery]);
  const machineLabelByKey = useMemo(
    () =>
      Object.fromEntries(
        machineDirectory.map((machine) => [
          machine.machineKey,
          formatMachineDirectoryLabel(machine) || machine.machineKey,
        ])
      ) as Record<string, string>,
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
            category:
              next?.category?.trim() || existing?.category || parsed.category || "",
            subcategory:
              next?.subcategory?.trim() ||
              existing?.subcategory ||
              parsed.subcategory ||
              "",
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

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editComment, setEditComment] = useState("");
  const viewCategory =
    activeFunction === "statistics" ? statisticsCategory : costsCategory;
  const viewSubCategory =
    activeFunction === "statistics"
      ? statisticsSubCategory
      : costsSubCategory;
  const viewDateFrom =
    activeFunction === "statistics" ? statisticsDateFrom : costsDateFrom;
  const viewDateTo =
    activeFunction === "statistics" ? statisticsDateTo : costsDateTo;
  const costsActiveDatePreset = useMemo(
    () => getActiveDatePreset(costsDateFrom, costsDateTo),
    [costsDateFrom, costsDateTo]
  );
  const statisticsActiveDatePreset = useMemo(
    () => getActiveDatePreset(statisticsDateFrom, statisticsDateTo),
    [statisticsDateFrom, statisticsDateTo]
  );
  const statisticsTimeframeLabel = useMemo(
    () => {
      if (!statisticsDateFrom && !statisticsDateTo) {
        return t("admin.timeframeAll");
      }

      if (statisticsActiveDatePreset === "last7") {
        return t("admin.timeframeLast7", {
          from: formatDisplayDate(statisticsDateFrom),
          to: formatDisplayDate(statisticsDateTo),
        });
      }

      if (statisticsActiveDatePreset === "thisMonth") {
        return t("admin.timeframeThisMonth", {
          from: formatDisplayDate(statisticsDateFrom),
          to: formatDisplayDate(statisticsDateTo),
        });
      }

      if (statisticsActiveDatePreset === "lastMonth") {
        return t("admin.timeframeLastMonth", {
          from: formatDisplayDate(statisticsDateFrom),
          to: formatDisplayDate(statisticsDateTo),
        });
      }

      if (statisticsActiveDatePreset === "last6Months") {
        return t("admin.timeframeLast6Months", {
          from: formatDisplayDate(statisticsDateFrom),
          to: formatDisplayDate(statisticsDateTo),
        });
      }

      if (statisticsDateFrom && statisticsDateTo) {
        return t("admin.timeframeFromTo", {
          from: formatDisplayDate(statisticsDateFrom),
          to: formatDisplayDate(statisticsDateTo),
        });
      }

      if (statisticsDateFrom) {
        return t("admin.timeframeFrom", {
          from: formatDisplayDate(statisticsDateFrom),
        });
      }

      return t("admin.timeframeUntil", {
        to: formatDisplayDate(statisticsDateTo),
      });
    },
    [statisticsActiveDatePreset, statisticsDateFrom, statisticsDateTo, t]
  );

  const allIssues = useMemo(() => (issues ?? []) as NormalizedIssue[], [issues]);
  const filteredIssues = useMemo<NormalizedIssue[]>(() => {
    return allIssues.filter((i: NormalizedIssue) => {
      const { category: depPartRaw, subcategory: linePartRaw } =
        getIssueCategoryAndSubcategory(i);
      const depPart = depPartRaw.toLowerCase();
      const linePart = linePartRaw.toLowerCase();
      const dep = viewCategory.toLowerCase();
      const line = viewSubCategory.toLowerCase();
      const matchCategory = !viewCategory || depPart === dep;
      const matchSub = !viewSubCategory || linePart === line;

      const created = new Date(i.created).getTime();
      const from = viewDateFrom ? new Date(viewDateFrom).getTime() : -Infinity;
      const to = viewDateTo ? new Date(viewDateTo).getTime() : Infinity;
      const matchDate = created >= from && created <= to;

      return matchCategory && matchSub && matchDate;
    });
  }, [allIssues, viewCategory, viewSubCategory, viewDateFrom, viewDateTo]);

  const hasMachineSelection = Boolean(costsCategory && costsSubCategory);
  const selectedMachineKey = hasMachineSelection
    ? `${costsCategory}::${costsSubCategory}`
    : "";
  const selectedMachineManualMoney = manualEntries.reduce(
    (sum: number, entry) => sum + entry.amount,
    0
  );
  const selectedTicketFixMoney = filteredIssues.reduce((sum: number, issue) => {
    const cost = ticketCostsByIssue[issue.key];
    return sum + (cost?.amount ?? 0);
  }, 0);
  const statisticsTotalTimeSeconds = useMemo(
    () =>
      filteredIssues.reduce(
        (sum: number, issue: NormalizedIssue) => sum + (issue.timeSpentSeconds ?? 0),
        0
      ),
    [filteredIssues]
  );
  const statisticsTrackedCost = selectedTicketFixMoney;
  const statisticsIssueAssetSummary = useMemo(
    () => summarizeIssuesByAsset(filteredIssues),
    [filteredIssues]
  );
  const inventoryIssueAssetSummary = useMemo(
    () => summarizeIssuesByAsset(allIssues),
    [allIssues]
  );
  const repairCostByMachineKey = useMemo(
    () => getRepairCostTotalsByMachine(filteredIssues, ticketCostsByIssue),
    [filteredIssues, ticketCostsByIssue]
  );
  const maintenanceCostsByMachineKey = useMemo(() => {
    const totals = new Map<string, number>();

    for (const item of plannedMaintenanceItems) {
      const cost = item.cost ?? 0;
      if (cost <= 0) continue;
      totals.set(item.machineKey, (totals.get(item.machineKey) ?? 0) + cost);
    }

    return totals;
  }, [plannedMaintenanceItems]);
  const maintenanceCountByMachineKey = useMemo(() => {
    const totals = new Map<string, number>();

    for (const item of plannedMaintenanceItems) {
      const cost = item.cost ?? 0;
      if (cost <= 0) continue;
      totals.set(item.machineKey, (totals.get(item.machineKey) ?? 0) + 1);
    }

    return totals;
  }, [plannedMaintenanceItems]);
  const statisticsMaintenanceCost = useMemo(
    () =>
      Array.from(maintenanceCostsByMachineKey.values()).reduce((sum, cost) => {
        return sum + cost;
      }, 0),
    [maintenanceCostsByMachineKey]
  );
  const statisticsMaintenanceCompletedCount = useMemo(
    () => plannedMaintenanceItems.filter((item) => item.isCompleted).length,
    [plannedMaintenanceItems]
  );
  const statisticsMaintenanceActiveCount =
    plannedMaintenanceItems.length - statisticsMaintenanceCompletedCount;
  const assetStatistics = useMemo<AssetStatisticsRow[]>(() => {
    const machineKeys = new Set<string>([
      ...statisticsIssueAssetSummary.byMachine.keys(),
      ...repairCostByMachineKey.keys(),
      ...maintenanceCostsByMachineKey.keys(),
    ]);

    return Array.from(machineKeys).map((machineKey) => {
      const row = statisticsIssueAssetSummary.byMachine.get(machineKey);
      const asset = assetDetailsByMachineKey[machineKey];
      const parsed = parseMachineKey(machineKey);
      const category =
        asset?.category || row?.category || parsed.category || t("common.unknown");
      const subcategory =
        asset?.subcategory || row?.subcategory || parsed.subcategory || t("common.unknown");

      return {
        key: machineKey,
        label: `${category} / ${subcategory}`,
        category,
        subcategory,
        breakdowns: row?.breakdowns ?? 0,
        loggedSeconds: row?.loggedSeconds ?? 0,
        repairCost: repairCostByMachineKey.get(machineKey) ?? 0,
        maintenanceCost: maintenanceCostsByMachineKey.get(machineKey) ?? 0,
      };
    });
  }, [
    assetDetailsByMachineKey,
    maintenanceCostsByMachineKey,
    repairCostByMachineKey,
    statisticsIssueAssetSummary.byMachine,
    t,
  ]);
  const statisticsUnmappedTicketCount = statisticsIssueAssetSummary.unmappedTickets;
  const inventoryMappedAssetCount = useMemo(
    () =>
      Array.from(inventoryIssueAssetSummary.byMachine.keys()).filter((machineKey) =>
        Boolean(assetDetailsByMachineKey[machineKey])
      ).length,
    [assetDetailsByMachineKey, inventoryIssueAssetSummary.byMachine]
  );
  const inventoryAssetsWithInventoryCount = useMemo(
    () =>
      Array.from(inventoryIssueAssetSummary.byMachine.keys()).filter((machineKey) => {
        const asset = assetDetailsByMachineKey[machineKey];
        const model = asset?.model?.trim() || "";
        const serialNumber = asset?.serialNumber?.trim() || "";
        const manufacturer = asset?.manufacturer?.trim() || "";

        return Boolean(model && serialNumber && manufacturer);
      }).length,
    [assetDetailsByMachineKey, inventoryIssueAssetSummary.byMachine]
  );
  const inventoryAssetsMissingInventoryCount =
    inventoryMappedAssetCount - inventoryAssetsWithInventoryCount;
  const inventoryUnmappedTicketCount = inventoryIssueAssetSummary.unmappedTickets;
  const totalCatalogAssetCount = machineCatalog.length;
  const totalRegisteredAssetCount = Object.keys(assetDetailsByMachineKey).length;
  const totalRegisteredAssetsWithInventoryCount = useMemo(
    () =>
      Object.values(assetDetailsByMachineKey).filter(
        (item) =>
          Boolean(item.model?.trim()) &&
          Boolean(item.serialNumber?.trim()) &&
          Boolean(item.manufacturer?.trim())
      ).length,
    [assetDetailsByMachineKey]
  );
  const maintenanceBadgeCount = useMemo(
    () =>
      plannedMaintenanceItems.filter((item) => {
        const status = getMaintenanceItemStatus(item);
        return status === "overdue" || status === "dueSoon";
      }).length,
    [plannedMaintenanceItems]
  );
  const maintenanceItemsByDate = useMemo(() => {
    const itemsByDate = new Map<string, PlannedMaintenanceItem[]>();

    for (const item of sortPlannedMaintenanceItems(plannedMaintenanceItems)) {
      const existing = itemsByDate.get(item.dueDate) || [];
      existing.push(item);
      itemsByDate.set(item.dueDate, existing);
    }

    return itemsByDate;
  }, [plannedMaintenanceItems]);
  const maintenanceCalendarLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(getLocaleTag(locale), {
        month: "long",
        year: "numeric",
      }).format(maintenanceCalendarMonth),
    [locale, maintenanceCalendarMonth]
  );
  const maintenanceWeekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(getLocaleTag(locale), {
      weekday: "short",
    });

    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, 1 + index))
    );
  }, [locale]);
  const maintenanceCalendarDays = useMemo(() => {
    const monthYear = maintenanceCalendarMonth.getFullYear();
    const monthIndex = maintenanceCalendarMonth.getMonth();
    const firstDayOffset = (new Date(monthYear, monthIndex, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(monthYear, monthIndex + 1, 0).getDate();
    const todayDayKey = getCurrentLocalDayKey();

    const leadingPlaceholders = Array.from({ length: firstDayOffset }, (_, index) => ({
      dateKey: `placeholder-start-${index}`,
      dayNumber: null,
      isCurrentMonth: false,
      isToday: false,
      isPlaceholder: true,
      items: [],
    }));

    const monthDays = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const dateKey = toDateOnlyFromParts(monthYear, monthIndex, dayNumber);
      const items = maintenanceItemsByDate.get(dateKey) || [];

      return {
        dateKey,
        dayNumber,
        isCurrentMonth: true,
        isToday: dateOnlyToDayKey(dateKey) === todayDayKey,
        isPlaceholder: false,
        items,
      };
    });

    const trailingPlaceholderCount =
      (7 - ((leadingPlaceholders.length + monthDays.length) % 7)) % 7;
    const trailingPlaceholders = Array.from(
      { length: trailingPlaceholderCount },
      (_, index) => ({
        dateKey: `placeholder-end-${index}`,
        dayNumber: null,
        isCurrentMonth: false,
        isToday: false,
        isPlaceholder: true,
        items: [],
      })
    );

    return [...leadingPlaceholders, ...monthDays, ...trailingPlaceholders];
  }, [maintenanceCalendarMonth, maintenanceItemsByDate]);
  const maintenanceCalendarMonthItemCount = useMemo(
    () =>
      maintenanceCalendarDays.reduce(
        (sum, day) => sum + (day.isCurrentMonth ? day.items.length : 0),
        0
      ),
    [maintenanceCalendarDays]
  );
  const selectedMaintenanceDateLabel = useMemo(() => {
    const parsedDate = parseDateOnly(selectedMaintenanceDate);
    if (!parsedDate) return selectedMaintenanceDate;

    return new Intl.DateTimeFormat(getLocaleTag(locale), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(
      new Date(
        parsedDate.getUTCFullYear(),
        parsedDate.getUTCMonth(),
        parsedDate.getUTCDate()
      )
    );
  }, [locale, selectedMaintenanceDate]);
  const isMaintenanceEditing = Boolean(editingMaintenanceId);
  const activeMaintenanceItem = useMemo(
    () =>
      editingMaintenanceId
        ? plannedMaintenanceItems.find((item) => item.id === editingMaintenanceId) ?? null
        : null,
    [editingMaintenanceId, plannedMaintenanceItems]
  );
  const activeMaintenanceStatus = useMemo<MaintenanceStatus | null>(
    () => (activeMaintenanceItem ? getMaintenanceItemStatus(activeMaintenanceItem) : null),
    [activeMaintenanceItem]
  );
  const maintenanceLogEntries = useMemo<MaintenanceLogEntry[]>(() => {
    return plannedMaintenanceItems
      .map((item) => {
        const machineLabel = machineLabelByKey[item.machineKey] || item.machineKey;
        const completedTime = item.completedAt ? new Date(item.completedAt).getTime() : NaN;
        const updatedTime = new Date(item.updatedAt).getTime();
        const createdTime = new Date(item.createdAt).getTime();

        if (item.completedAt && !Number.isNaN(completedTime)) {
          return {
            id: `${item.id}:completed`,
            category: machineLabel,
            change: "Completed",
            title: item.title,
            timestamp: item.completedAt,
            kind: "completed" as const,
          };
        }

        if (
          !Number.isNaN(updatedTime) &&
          !Number.isNaN(createdTime) &&
          Math.abs(updatedTime - createdTime) > 1000
        ) {
          return {
            id: `${item.id}:updated`,
            category: machineLabel,
            change: "Updated",
            title: item.title,
            timestamp: item.updatedAt,
            kind: "updated" as const,
          };
        }

        return {
          id: `${item.id}:created`,
          category: machineLabel,
          change: "Created",
          title: item.title,
          timestamp: item.createdAt,
          kind: "created" as const,
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
  }, [machineLabelByKey, plannedMaintenanceItems]);
  const ticketsByCategory = useMemo(() => {
    const rows = Object.keys(DEPARTMENT_LINES).map((category) => ({
      name: category,
      tickets: 0,
      seconds: 0,
    }));
    const byCategory = new Map(rows.map((row) => [row.name, row]));

    for (const assetRow of assetStatistics) {
      const categoryRow =
        byCategory.get(assetRow.category) ||
        { name: assetRow.category || "Unspecified", tickets: 0, seconds: 0 };
      categoryRow.tickets += assetRow.breakdowns;
      categoryRow.seconds += assetRow.loggedSeconds;
      if (!byCategory.has(categoryRow.name)) {
        byCategory.set(categoryRow.name, categoryRow);
      }
    }

    if (statisticsUnmappedTicketCount > 0) {
      byCategory.set(t("common.unknown"), {
        name: t("common.unknown"),
        tickets: statisticsUnmappedTicketCount,
        seconds: 0,
      });
    }

    return Array.from(byCategory.values())
      .filter((row) => row.tickets > 0)
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 8);
  }, [assetStatistics, statisticsUnmappedTicketCount, t]);
  const maxCategoryTickets = useMemo(
    () => Math.max(...ticketsByCategory.map((item) => item.tickets), 1),
    [ticketsByCategory]
  );
  const machinesByBreakdowns = useMemo(
    () =>
      [...assetStatistics]
        .sort((a, b) => b.breakdowns - a.breakdowns)
        .slice(0, 10),
    [assetStatistics]
  );
  const maxMachineBreakdowns = useMemo(
    () => Math.max(...machinesByBreakdowns.map((item) => item.breakdowns), 1),
    [machinesByBreakdowns]
  );
  const machinesByRepairCost = useMemo(
    () =>
      [...assetStatistics]
        .filter((item) => item.repairCost > 0)
        .sort((a, b) => b.repairCost - a.repairCost)
        .slice(0, 10),
    [assetStatistics]
  );
  const maxMachineRepairCost = useMemo(
    () => Math.max(...machinesByRepairCost.map((item) => item.repairCost), 1),
    [machinesByRepairCost]
  );
  const machinesByMaintenanceCost = useMemo(
    () =>
      [...assetStatistics]
        .filter((item) => item.maintenanceCost > 0)
        .sort((a, b) => b.maintenanceCost - a.maintenanceCost)
        .slice(0, 10),
    [assetStatistics]
  );
  const maxMachineMaintenanceCost = useMemo(
    () => Math.max(...machinesByMaintenanceCost.map((item) => item.maintenanceCost), 1),
    [machinesByMaintenanceCost]
  );
  const topTicketsByTime = useMemo(() => {
    return [...filteredIssues]
      .sort((a, b) => (b.timeSpentSeconds ?? 0) - (a.timeSpentSeconds ?? 0))
      .slice(0, 5);
  }, [filteredIssues]);
  const costsTotalPages = Math.max(
    1,
    Math.ceil(filteredIssues.length / ticketsPerPage)
  );
  const costsPaginationItems = useMemo<(number | string)[]>(() => {
    if (costsTotalPages <= 6) {
      return Array.from({ length: costsTotalPages }, (_, i) => i + 1);
    }

    return [1, 2, 3, 4, 5, "ellipsis", costsTotalPages];
  }, [costsTotalPages]);
  const paginatedCostsIssues = useMemo(() => {
    const start = (costsCurrentPage - 1) * ticketsPerPage;
    return filteredIssues.slice(start, start + ticketsPerPage);
  }, [costsCurrentPage, filteredIssues]);

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
        `/api/admin/machine-data?machineKey=${encodeURIComponent(
          selectedMachineKey
        )}`,
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
        body: JSON.stringify({
          includeAll: true,
        }),
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

  const loadPlannedMaintenance = useCallback(async () => {
    if (!sessionResolved || !currentUserIsAdmin) {
      setPlannedMaintenanceLoading(false);
      setPlannedMaintenanceError("");
      setPlannedMaintenanceItems([]);
      return;
    }

    setPlannedMaintenanceLoading(true);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch("/api/admin/planned-maintenance", {
        cache: "no-store",
      });
      const data = await parseJson<{ items: PlannedMaintenanceItem[] }>(res);
      setPlannedMaintenanceItems(sortPlannedMaintenanceItems(data.items ?? []));
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
      setPlannedMaintenanceItems([]);
    } finally {
      setPlannedMaintenanceLoading(false);
    }
  }, [currentUserIsAdmin, sessionResolved]);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    if (
      requestedView === "costs" ||
      requestedView === "maintenance" ||
      requestedView === "inventory" ||
      requestedView === "users" ||
      requestedView === "statistics"
    ) {
      setActiveFunction(requestedView);
    }
  }, [searchParams]);

  useEffect(() => {
    if (sessionResolved && !currentUserCanManageUsers && activeFunction === "users") {
      setActiveFunction("costs");
    }
  }, [activeFunction, currentUserCanManageUsers, sessionResolved]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          user?: {
            id?: string | null;
            name?: string | null;
            email?: string | null;
            role?: string | null;
          };
        };
        const userId = String(data.user?.id || "");
        const normalizedName = String(data.user?.name || "").trim().toLowerCase();
        const normalizedEmail = String(data.user?.email || "").trim().toLowerCase();
        const normalizedRole = String(data.user?.role || "").trim().toUpperCase();
        const displayName = String(data.user?.name || "").trim();
        const displayEmail = String(data.user?.email || "").trim();
        const emailLocalPart = normalizedEmail.includes("@")
          ? normalizedEmail.split("@")[0]
          : normalizedEmail;
        const isSuperAdmin =
          normalizedName === "ignven" || emailLocalPart === "ignven";
        const isAdmin = normalizedRole === "ADMIN" || isSuperAdmin;

        setCurrentUserId(userId);
        setCurrentUserLabel(displayName || displayEmail || userId);
        setCurrentUserIsAdmin(isAdmin);
        setCurrentUserCanManageUsers(isSuperAdmin);
      } catch {
        setCurrentUserId("");
        setCurrentUserLabel("");
        setCurrentUserIsAdmin(false);
        setCurrentUserCanManageUsers(false);
      } finally {
        setSessionResolved(true);
      }
    };

    void loadSession();
  }, []);

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
    void loadPlannedMaintenance();
  }, [loadPlannedMaintenance]);

  const loadTicketCosts = useCallback(async () => {
    if (!sessionResolved || !currentUserIsAdmin) {
      setTicketCostsLoading(false);
      setTicketCostsByIssue({});
      setTicketDrafts({});
      setMachineDataError("");
      return;
    }

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
  }, [currentUserIsAdmin, filteredIssues, sessionResolved]);

  useEffect(() => {
    void loadTicketCosts();
  }, [loadTicketCosts, ticketCostsRefreshKey]);

  useEffect(() => {
    setCostsCurrentPage(1);
  }, [costsCategory, costsSubCategory, costsDateFrom, costsDateTo]);

  useEffect(() => {
    if (costsCurrentPage > costsTotalPages) {
      setCostsCurrentPage(costsTotalPages);
    }
  }, [costsCurrentPage, costsTotalPages]);

  const resetCostsFilters = () => {
    setCostsCategory("");
    setCostsSubCategory("");
    setCostsDateFrom(defaultDateRange.from);
    setCostsDateTo(defaultDateRange.to);
  };

  const resetStatisticsFilters = () => {
    setStatisticsCategory("");
    setStatisticsSubCategory("");
    setStatisticsDateFrom(defaultDateRange.from);
    setStatisticsDateTo(defaultDateRange.to);
  };

  const setActiveViewDateRange = (from: string, to: string) => {
    if (activeFunction === "statistics") {
      setStatisticsDateFrom(from);
      setStatisticsDateTo(to);
      return;
    }

    setCostsDateFrom(from);
    setCostsDateTo(to);
  };

  const applyLastSevenDays = () => {
    setActiveViewDateRange(defaultDateRange.from, defaultDateRange.to);
  };

  const applyAllTickets = () => {
    setActiveViewDateRange("", "");
  };

  const applyThisMonth = () => {
    const range = getThisMonthRange();
    setActiveViewDateRange(range.from, range.to);
  };

  const applyLastMonth = () => {
    const range = getLastMonthRange();
    setActiveViewDateRange(range.from, range.to);
  };

  const applyLastSixMonths = () => {
    const range = getLastSixMonthsRange();
    setActiveViewDateRange(range.from, range.to);
  };

  const syncMaintenanceCalendarToDate = useCallback((dateKey: string) => {
    const parsedDate = parseDateOnly(dateKey);
    if (!parsedDate) return;

    setMaintenanceCalendarMonth(
      new Date(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), 1)
    );
  }, []);

  const selectMaintenanceDate = useCallback(
    (dateKey: string) => {
      setSelectedMaintenanceDate(dateKey);
      setEditingMaintenanceId(null);
      setMaintenanceMachineKey("");
      setMaintenanceTitle("");
      setMaintenanceDueDate(dateKey);
      setMaintenanceCost("");
      setMaintenanceNote("");
      syncMaintenanceCalendarToDate(dateKey);
    },
    [syncMaintenanceCalendarToDate]
  );

  const startEditPlannedMaintenance = useCallback(
    (item: PlannedMaintenanceItem) => {
      setSelectedMaintenanceDate(item.dueDate);
      setEditingMaintenanceId(item.id);
      setMaintenanceMachineKey(item.machineKey);
      setMaintenanceTitle(item.title);
      setMaintenanceDueDate(item.dueDate);
      setMaintenanceCost(
        item.cost === null || typeof item.cost === "undefined" ? "" : String(item.cost)
      );
      setMaintenanceNote(item.note ?? "");
      syncMaintenanceCalendarToDate(item.dueDate);
    },
    [syncMaintenanceCalendarToDate]
  );

  const cancelMaintenanceEdit = useCallback(() => {
    setEditingMaintenanceId(null);
    setMaintenanceMachineKey("");
    setMaintenanceTitle("");
    setMaintenanceDueDate(selectedMaintenanceDate);
    setMaintenanceCost("");
    setMaintenanceNote("");
  }, [selectedMaintenanceDate]);

  const openCreateMaintenanceModal = useCallback(
    (dateKey: string) => {
      selectMaintenanceDate(dateKey);
      setIsMaintenanceModalOpen(true);
    },
    [selectMaintenanceDate]
  );

  const openEditMaintenanceModal = useCallback(
    (item: PlannedMaintenanceItem) => {
      startEditPlannedMaintenance(item);
      setIsMaintenanceModalOpen(true);
    },
    [startEditPlannedMaintenance]
  );

  const closeMaintenanceModal = useCallback(() => {
    setIsMaintenanceModalOpen(false);
    cancelMaintenanceEdit();
  }, [cancelMaintenanceEdit]);

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
        body: JSON.stringify({
          machineKey,
          model,
          serialNumber,
          manufacturer,
        }),
      });
      const saved = await parseJson<EquipmentDetailsResponse>(res);
      upsertAssetDetailsCache(machineKey, saved);
    } catch (e: unknown) {
      setInventoryError(String((e as Error).message || e));
    } finally {
      setInventorySavingKey(null);
    }
  };

  const savePlannedMaintenance = async () => {
    if (!maintenanceMachineKey || !maintenanceTitle.trim() || !maintenanceDueDate) {
      return;
    }
    const costRaw = maintenanceCost.trim();
    const cost = costRaw === "" ? null : Number(costRaw);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setPlannedMaintenanceError(t("admin.maintenanceCostInvalid"));
      return;
    }

    setPlannedMaintenanceSaving(true);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch(
        editingMaintenanceId
          ? `/api/admin/planned-maintenance/${editingMaintenanceId}`
          : "/api/admin/planned-maintenance",
        {
          method: editingMaintenanceId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineKey: maintenanceMachineKey,
            title: maintenanceTitle.trim(),
            dueDate: maintenanceDueDate,
            cost,
            note: maintenanceNote.trim(),
          }),
        }
      );
      const saved = await parseJson<PlannedMaintenanceItem>(res);
      upsertAssetDetailsCache(maintenanceMachineKey);
      setPlannedMaintenanceItems((prev) =>
        sortPlannedMaintenanceItems(
          editingMaintenanceId
            ? prev.map((item) => (item.id === editingMaintenanceId ? saved : item))
            : [...prev, saved]
        )
      );
      setSelectedMaintenanceDate(saved.dueDate);
      setIsMaintenanceModalOpen(false);
      setEditingMaintenanceId(null);
      setMaintenanceMachineKey("");
      setMaintenanceTitle("");
      setMaintenanceDueDate(saved.dueDate);
      setMaintenanceCost(
        saved.cost === null || typeof saved.cost === "undefined" ? "" : String(saved.cost)
      );
      setMaintenanceNote("");
      syncMaintenanceCalendarToDate(saved.dueDate);
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    } finally {
      setPlannedMaintenanceSaving(false);
    }
  };

  const updatePlannedMaintenanceState = async (id: string, isCompleted: boolean) => {
    setMaintenanceActionKey(`${id}:${isCompleted ? "complete" : "reopen"}`);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch(`/api/admin/planned-maintenance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      const saved = await parseJson<PlannedMaintenanceItem>(res);
      setPlannedMaintenanceItems((prev) =>
        sortPlannedMaintenanceItems(
          prev.map((item) => (item.id === id ? saved : item))
        )
      );
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    } finally {
      setMaintenanceActionKey(null);
    }
  };

  const deletePlannedMaintenance = async (id: string) => {
    setMaintenanceActionKey(`${id}:delete`);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch(`/api/admin/planned-maintenance/${id}`, {
        method: "DELETE",
      });
      await parseJson<{ ok: boolean }>(res);
      setPlannedMaintenanceItems((prev) => prev.filter((item) => item.id !== id));
      setIsMaintenanceModalOpen(false);
      if (editingMaintenanceId === id) {
        cancelMaintenanceEdit();
      }
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    } finally {
      setMaintenanceActionKey(null);
    }
  };

  function getMaintenanceDueLabel(dueDateRaw: string) {
    const dueDayKey = dateOnlyToDayKey(dueDateRaw);
    if (dueDayKey === null) return dueDateRaw;

    const diffDays = dueDayKey - getCurrentLocalDayKey();

    if (diffDays < 0) return t("admin.daysOverdue", { count: Math.abs(diffDays) });
    if (diffDays === 0) return t("admin.dueToday");
    return t("admin.dueInDays", { count: diffDays });
  }

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
      upsertAssetDetailsCache(selectedMachineKey);
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

  const handleModalDataChanged = () => {
    void loadMachineData();
    void loadEquipmentData();
    void loadInventoryData();
    setTicketCostsRefreshKey((value) => value + 1);
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
    if (!shouldDelete && (!draft.date || !Number.isFinite(amount) || amount < 0)) {
      return;
    }
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
          [issueKey]: {
            date: draft.date || getCurrentLocalDateOnly(),
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
            machineKey,
            date: draft.date,
            amount,
            comment,
          }),
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

  return (
    <div className="page">
      <div className="page__layout">
        <aside className="page__sidebar">
          <div className="admin-sidebar">
            <div className="admin-sidebar__section">
              <div className="admin-sidebar__header">
                <div className="admin-sidebar__title">{t("admin.tools")}</div>
                {currentUserLabel && (
                  <div className="admin-sidebar__session">{currentUserLabel}</div>
                )}
              </div>
              <div className="admin-sidebar__actions">
                <button
                  type="button"
                  className={`admin-function-button ${
                    activeFunction === "costs" ? "admin-function-button--active" : ""
                  }`}
                  onClick={() => setActiveFunction("costs")}
                >
                  {t("admin.timeAndCost")}
                </button>
                <button
                  type="button"
                  className={`admin-function-button ${
                    activeFunction === "maintenance"
                      ? "admin-function-button--active"
                      : ""
                  }`}
                  onClick={() => setActiveFunction("maintenance")}
                >
                  <span className="admin-function-button__content">
                    <span>{t("admin.plannedMaintenance")}</span>
                    {maintenanceBadgeCount > 0 && (
                      <span className="admin-function-badge">{maintenanceBadgeCount}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className={`admin-function-button ${
                    activeFunction === "statistics"
                      ? "admin-function-button--active"
                      : ""
                  }`}
                  onClick={() => setActiveFunction("statistics")}
                >
                  {t("admin.statistics")}
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
                  {t("admin.manageInventory")}
                </button>
                {currentUserCanManageUsers && (
                  <button
                    type="button"
                    className={`admin-function-button ${
                      activeFunction === "users" ? "admin-function-button--active" : ""
                    }`}
                    onClick={() => setActiveFunction("users")}
                  >
                    {t("admin.manageUsers")}
                  </button>
                )}
              </div>
            </div>

            <div className="admin-sidebar__section admin-sidebar__section--bottom">
              <Link href="/" className="page__action-link admin-sidebar__link">
                {t("common.backToHome")}
              </Link>
              <button
                type="button"
                className="page__action-link admin-sidebar__link"
                onClick={handleLogout}
              >
                {t("common.logout")}
              </button>
            </div>
          </div>
        </aside>

        <section className="page__content">
          {!sessionResolved && (
            <div className="admin-card">
              <div className="page__loading">{t("common.loading")}</div>
            </div>
          )}

          {sessionResolved && !currentUserIsAdmin && (
            <div className="admin-card">
              <h1 className="admin-title">{t("admin.accessDeniedTitle")}</h1>
              <p className="admin-subtitle">{t("admin.accessDeniedSubtitle")}</p>
              <div className="page__content-actions">
                <Link href="/" className="page__action-link">
                  {t("common.backToHome")}
                </Link>
                <button
                  type="button"
                  className="admin-reset-button"
                  onClick={handleLogout}
                >
                  {t("common.logout")}
                </button>
              </div>
            </div>
          )}

          {sessionResolved && currentUserIsAdmin && (
          <div className="admin-dashboard">
            {activeFunction === "costs" && (
              <>
            <div className="admin-card">
              <h1 className="admin-title">{t("admin.timeAndCost")}</h1>
              <p className="admin-subtitle">
                {t("admin.timeAndCostSubtitle")}
              </p>

              <AdminFilters
                category={costsCategory}
                subCategory={costsSubCategory}
                dateFrom={costsDateFrom}
                dateTo={costsDateTo}
                subCategoryOptions={costsSubCategoryOptions}
                activeDatePreset={costsActiveDatePreset}
                resetDisabled={
                  !costsCategory &&
                  !costsSubCategory &&
                  !costsDateFrom &&
                  !costsDateTo
                }
                onCategoryChange={(value) => {
                  setCostsCategory(value);
                  setCostsSubCategory("");
                }}
                onSubCategoryChange={setCostsSubCategory}
                onDateFromChange={setCostsDateFrom}
                onDateToChange={setCostsDateTo}
                onApplyAllTickets={applyAllTickets}
                onApplyLastSevenDays={applyLastSevenDays}
                onApplyThisMonth={applyThisMonth}
                onApplyLastMonth={applyLastMonth}
                onApplyLastSixMonths={applyLastSixMonths}
                onResetFilters={resetCostsFilters}
              />

              {error && !loadingInitial && (
                <div className="page__error">{String(error)}</div>
              )}

              {loadingInitial && <div className="page__loading">{t("common.loading")}</div>}
            </div>

            <div className="admin-panel">
              <div className="admin-chart">
                {machineDataError && (
                  <div className="page__error">{machineDataError}</div>
                )}

                {hasMachineSelection && equipmentError && (
                  <div className="page__error">{equipmentError}</div>
                )}

                {hasMachineSelection && !equipmentLoading && (
                  <div className="admin-manual-costs">
                    <div className="admin-chart-title">{t("admin.equipmentDetails")}</div>
                    <div className="admin-equipment-form">
                      <input
                        type="text"
                        className="admin-input"
                        value={equipmentModel}
                        onChange={(e) => setEquipmentModel(e.target.value)}
                        placeholder={t("admin.model")}
                      />
                      <input
                        type="text"
                        className="admin-input"
                        value={equipmentSerialNumber}
                        onChange={(e) => setEquipmentSerialNumber(e.target.value)}
                        placeholder={t("admin.serialNumber")}
                      />
                      <input
                        type="text"
                        className="admin-input"
                        value={equipmentManufacturer}
                        onChange={(e) => setEquipmentManufacturer(e.target.value)}
                        placeholder={t("admin.manufacturer")}
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
                        {equipmentSaving ? t("admin.saving") : t("admin.saveDetails")}
                      </button>
                    </div>
                  </div>
                )}

                {hasMachineSelection && !machineDataLoading && (
                  <div className="admin-manual-costs">
                    <div className="admin-chart-title">{t("admin.manualCostEntries")}</div>
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
                        placeholder={t("admin.amountEur")}
                      />
                      <input
                        type="text"
                        className="admin-input"
                        value={entryComment}
                        onChange={(e) => setEntryComment(e.target.value)}
                        placeholder={t("admin.commentPlaceholder")}
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
                        {t("admin.addEntry")}
                      </button>
                    </div>

                    <div className="admin-manual-total">
                      {t("admin.manualTotal", {
                        value: formatCurrency(selectedMachineManualMoney, locale),
                      })}
                    </div>

                    {manualEntries.length === 0 && (
                      <div className="admin-chart-empty">
                        {t("admin.noManualEntriesYet")}
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
                                {t("common.save")}
                              </button>
                              <button
                                type="button"
                                className="admin-reset-button"
                                onClick={cancelEditManualCostEntry}
                              >
                                {t("common.cancel")}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>{entry.date}</div>
                            <div>{formatCurrency(entry.amount, locale)}</div>
                            <div>{entry.comment}</div>
                            <div className="admin-manual-actions">
                              <button
                                type="button"
                                className="admin-reset-button"
                                onClick={() => startEditManualCostEntry(entry)}
                              >
                                {t("common.edit")}
                              </button>
                              <button
                                type="button"
                                className="admin-reset-button"
                                onClick={() => {
                                  void deleteManualCostEntry(entry.id);
                                }}
                              >
                                {t("common.delete")}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!machineDataLoading && (
                  <div className="admin-manual-costs">
                    {ticketCostsLoading && (
                      <div className="admin-buffering">
                        <div className="admin-buffering-spinner" />
                        <div className="admin-chart-empty">{t("admin.loadingTickets")}</div>
                      </div>
                    )}
                    {!ticketCostsLoading && (
                      <>
                        <div className="admin-chart-title">
                          {t("admin.ticketsInPeriod", {
                            count: filteredIssues.length,
                          })}
                        </div>
                    {filteredIssues.length === 0 && (
                      <div className="admin-chart-empty">
                        {t("admin.noTicketsForFilters")}
                      </div>
                    )}
                    {paginatedCostsIssues.map((issue) => {
                      const draft = ticketDrafts[issue.key] || {
                        date: getCurrentLocalDateOnly(),
                        amount: "",
                        comment: "",
                      };
                      const issueMachineKey = getIssueAssetParts(issue).machineKey;
                      return (
                        <div key={issue.key} className="admin-ticket-row">
                          <button
                            type="button"
                            className="admin-ticket-open"
                            onClick={() => setSelectedIssue(issue)}
                          >
                            <div className="admin-ticket-meta">
                              <div className="admin-ticket-key">{issue.key}</div>
                              <div className="admin-ticket-summary">
                                {issue.summary}
                              </div>
                            </div>
                          </button>
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
                            placeholder={t("admin.fixCostEur")}
                          />
                          <input
                            type="text"
                            className="admin-input"
                            value={draft.comment}
                            onChange={(e) =>
                              setTicketDraftField(issue.key, "comment", e.target.value)
                            }
                            placeholder={t("admin.fixCommentOptional")}
                          />
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() => {
                              void saveTicketFixCost(issue.key);
                            }}
                            disabled={
                              savingTicketKey === issue.key ||
                              !issueMachineKey ||
                              !draft.date ||
                              (draft.amount.trim() !== "" &&
                                Number(draft.amount) < 0)
                            }
                          >
                            {savingTicketKey === issue.key ? t("admin.saving") : t("common.save")}
                          </button>
                        </div>
                      );
                    })}
                        {costsTotalPages > 1 && (
                          <div className="page__pagination">
                            <button
                              type="button"
                              className="page__pagination-button"
                              onClick={() =>
                                setCostsCurrentPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={costsCurrentPage === 1}
                            >
                              &lt;
                            </button>
                            <div className="page__pagination-pages">
                              {costsPaginationItems.map((item, index) =>
                                typeof item === "number" ? (
                                  <button
                                    key={item}
                                    type="button"
                                    className={`page__pagination-button ${
                                      costsCurrentPage === item
                                        ? "page__pagination-button--active"
                                        : ""
                                    }`}
                                    onClick={() => setCostsCurrentPage(item)}
                                  >
                                    {item}
                                  </button>
                                ) : (
                                  <span
                                    key={`${item}-${index}`}
                                    className="page__pagination-ellipsis"
                                  >
                                    ...
                                  </span>
                                )
                              )}
                            </div>
                            <button
                              type="button"
                              className="page__pagination-button"
                              onClick={() =>
                                setCostsCurrentPage((prev) =>
                                  Math.min(costsTotalPages, prev + 1)
                                )
                              }
                              disabled={costsCurrentPage === costsTotalPages}
                            >
                              &gt;
                            </button>
                          </div>
                        )}
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
                  <h1 className="admin-title">{t("admin.inventoryTitle")}</h1>
                  <p className="admin-subtitle">
                    {t("admin.inventorySubtitle")}
                  </p>
                  <div className="admin-filters">
                    <label className="admin-inventory-search">
                      <div className="admin-label">{t("admin.searchMachines")}</div>
                      <input
                        type="text"
                        className="admin-input"
                        value={inventoryQuery}
                        onChange={(e) => setInventoryQuery(e.target.value)}
                        placeholder={t("admin.searchMachinesPlaceholder")}
                      />
                    </label>
                    <div className="admin-filters-actions admin-filters-actions--inline">
                      <button
                        type="button"
                        className="admin-reset-button"
                        onClick={() => {
                          void loadInventoryData();
                        }}
                        disabled={inventoryLoading}
                      >
                        {inventoryLoading ? t("common.loading") : t("common.refresh")}
                      </button>
                    </div>
                  </div>
                  {inventoryError && <div className="page__error">{inventoryError}</div>}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">
                    {t("admin.machinesCount", {
                      count: filteredMachineDirectory.length,
                    })}
                  </div>
                  {inventoryLoading && (
                    <div className="admin-buffering">
                      <div className="admin-buffering-spinner" />
                      <div className="admin-chart-empty">{t("admin.loadingMachines")}</div>
                    </div>
                  )}
                  {!inventoryLoading && filteredMachineDirectory.length === 0 && (
                    <div className="admin-chart-empty">{t("admin.noMachinesFound")}</div>
                  )}
                  {!inventoryLoading &&
                    filteredMachineDirectory.map((machine) => {
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
                              {machine.subcategory}
                            </div>
                          </div>
                          <label className="admin-inventory-field">
                            <div className="admin-inventory-field__label">
                              {t("admin.model")}
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
                            />
                          </label>
                          <label className="admin-inventory-field">
                            <div className="admin-inventory-field__label">
                              {t("admin.serialNumber")}
                            </div>
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
                            />
                          </label>
                          <label className="admin-inventory-field">
                            <div className="admin-inventory-field__label">
                              {t("admin.manufacturer")}
                            </div>
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
                            />
                          </label>
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
                            {isSaving ? t("admin.saving") : t("common.save")}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {activeFunction === "maintenance" && (
              <>
                <div className="admin-panel">
                  <div className="admin-maintenance-calendar">
                    <div className="admin-maintenance-calendar__toolbar">
                      <div className="admin-maintenance-calendar__heading">
                        <div className="admin-chart-title">
                          {t("admin.maintenanceCalendar")}
                        </div>
                        <div className="admin-maintenance-calendar__month">
                          {maintenanceCalendarLabel}
                        </div>
                      </div>
                      <div className="admin-maintenance-calendar__toolbar-actions">
                        <div className="admin-maintenance-calendar__nav">
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() =>
                              setMaintenanceCalendarMonth(
                                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                              )
                            }
                          >
                            {t("common.prev")}
                          </button>
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() => {
                              const today = new Date();
                              selectMaintenanceDate(getCurrentLocalDateOnly());
                              setMaintenanceCalendarMonth(
                                new Date(today.getFullYear(), today.getMonth(), 1)
                              );
                            }}
                          >
                            {t("common.thisMonth")}
                          </button>
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() =>
                              setMaintenanceCalendarMonth(
                                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                              )
                            }
                          >
                            {t("common.next")}
                          </button>
                        </div>
                        <div className="admin-maintenance-calendar__quick-actions">
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() =>
                              openCreateMaintenanceModal(getCurrentLocalDateOnly())
                            }
                          >
                            {t("admin.addMaintenancePlan")}
                          </button>
                          <a
                            href="https://svenheim.atlassian.net/servicedesk/customer/portal/40"
                            target="_blank"
                            rel="noreferrer"
                            className="page__action-link admin-maintenance-link"
                          >
                            {t("admin.registerMaintenanceTicket")}
                          </a>
                        </div>
                      </div>
                    </div>

                    {plannedMaintenanceError && (
                      <div className="page__error">{plannedMaintenanceError}</div>
                    )}

                    {plannedMaintenanceLoading ? (
                      <div className="admin-buffering">
                        <div className="admin-buffering-spinner" />
                        <div className="admin-chart-empty">{t("common.loading")}</div>
                      </div>
                    ) : (
                      <>
                        <div className="admin-maintenance-calendar__legend">
                          {(
                            [
                              ["overdue", t("admin.overdueMaintenance")],
                              ["dueSoon", t("admin.dueSoonMaintenance")],
                              ["upcoming", t("admin.upcomingMaintenance")],
                              ["completed", t("admin.completedMaintenance")],
                            ] as const
                          ).map(([status, label]) => (
                            <div
                              key={status}
                              className="admin-maintenance-calendar__legend-item"
                            >
                              <span
                                className={`admin-maintenance-calendar__legend-dot admin-maintenance-calendar__legend-dot--${status}`}
                              />
                              <span>{label}</span>
                            </div>
                          ))}
                        </div>

                        {maintenanceCalendarMonthItemCount === 0 && (
                          <div className="admin-chart-empty">
                            {t("admin.maintenanceCalendarEmpty")}
                          </div>
                        )}

                        <div className="admin-maintenance-calendar__weekday-row">
                          {maintenanceWeekdayLabels.map((label) => (
                            <div
                              key={label}
                              className="admin-maintenance-calendar__weekday"
                            >
                              {label}
                            </div>
                          ))}
                        </div>

                        <div className="admin-maintenance-calendar__grid">
                          {maintenanceCalendarDays.map((day) => {
                            if (day.isPlaceholder) {
                              return (
                                <div
                                  key={day.dateKey}
                                  className="admin-maintenance-calendar__day admin-maintenance-calendar__day--placeholder"
                                  aria-hidden="true"
                                />
                              );
                            }

                            const isSelectedDay = day.dateKey === selectedMaintenanceDate;

                            return (
                              <div
                                key={day.dateKey}
                                className={`admin-maintenance-calendar__day${
                                  day.isCurrentMonth
                                    ? ""
                                    : " admin-maintenance-calendar__day--outside"
                                }${
                                  day.isToday
                                    ? " admin-maintenance-calendar__day--today"
                                    : ""
                                }${
                                  isSelectedDay
                                    ? " admin-maintenance-calendar__day--selected"
                                    : ""
                                }`}
                              >
                                <div className="admin-maintenance-calendar__day-header">
                                  <div className="admin-maintenance-calendar__day-number">
                                    {day.dayNumber}
                                  </div>
                                  {day.items.length > 0 && (
                                    <div className="admin-maintenance-calendar__day-count">
                                      {day.items.length}
                                    </div>
                                  )}
                                </div>

                                <div className="admin-maintenance-calendar__events">
                                  {day.items.map((item) => {
                                    const status = getMaintenanceItemStatus(item);
                                    const isSelectedEvent =
                                      editingMaintenanceId === item.id;

                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        className={`admin-maintenance-calendar__event admin-maintenance-calendar__event--${status}${
                                          isSelectedEvent
                                            ? " admin-maintenance-calendar__event--selected"
                                            : ""
                                        }`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openEditMaintenanceModal(item);
                                        }}
                                      >
                                        <div className="admin-maintenance-calendar__event-title">
                                          {item.title}
                                        </div>
                                        <div className="admin-maintenance-calendar__event-meta">
                                          {machineLabelByKey[item.machineKey] ||
                                            item.machineKey}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="admin-maintenance-log" aria-label="Maintenance activity">
                          <div className="admin-maintenance-log__header">
                            <div className="admin-chart-title">Activity</div>
                          </div>
                          {maintenanceLogEntries.length === 0 ? (
                            <div className="admin-maintenance-log__empty">
                              No maintenance activity yet.
                            </div>
                          ) : (
                            <div className="admin-maintenance-log__list">
                              {maintenanceLogEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="admin-maintenance-log__item"
                                >
                                  <span className="admin-maintenance-log__line">
                                    <span className="admin-maintenance-log__field">
                                      {entry.title}
                                    </span>
                                    <span className="admin-maintenance-log__separator">
                                      ·
                                    </span>
                                    <span className="admin-maintenance-log__field">
                                      {entry.category}
                                    </span>
                                    <span className="admin-maintenance-log__separator">
                                      ·
                                    </span>
                                    <span className="admin-maintenance-log__field">
                                      {entry.change}
                                    </span>
                                    <span className="admin-maintenance-log__separator">
                                      ·
                                    </span>
                                    <span className="admin-maintenance-log__time">
                                      {formatDateTimeForLocale(entry.timestamp, locale)}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Modal
                  isOpen={isMaintenanceModalOpen}
                  onRequestClose={closeMaintenanceModal}
                  className="admin-maintenance-modal"
                  overlayClassName="admin-maintenance-modal__overlay"
                  shouldCloseOnOverlayClick
                >
                  <div className="admin-maintenance-modal__header">
                    <div className="admin-maintenance-modal__title-wrap">
                      <h2 className="admin-maintenance-modal__title">
                        {isMaintenanceEditing && activeMaintenanceItem
                          ? activeMaintenanceItem.title
                          : t("admin.addMaintenancePlan")}
                      </h2>
                    </div>
                    <div className="admin-maintenance-modal__header-actions">
                      <a
                        href="https://svenheim.atlassian.net/servicedesk/customer/portal/40"
                        target="_blank"
                        rel="noreferrer"
                        className="admin-maintenance-modal__link"
                      >
                        {t("admin.registerMaintenanceTicket")}
                      </a>
                      <button
                        type="button"
                        className="modal-close-btn"
                        onClick={closeMaintenanceModal}
                        aria-label={t("common.close")}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="admin-maintenance-modal__body">
                    {activeMaintenanceItem && (
                      <div className="admin-maintenance-modal__summary">
                        <div className="admin-maintenance-modal__summary-main">
                          <span className="admin-ticket-key">
                            {machineLabelByKey[activeMaintenanceItem.machineKey] ||
                              activeMaintenanceItem.machineKey}
                          </span>
                          <span className="admin-maintenance-modal__summary-separator">
                            |
                          </span>
                          <span className="admin-chart-empty admin-maintenance-modal__summary-due">
                            {getMaintenanceDueLabel(activeMaintenanceItem.dueDate)}
                          </span>
                          {activeMaintenanceItem.cost != null && (
                            <>
                              <span className="admin-maintenance-modal__summary-separator">
                                |
                              </span>
                              <span className="admin-chart-empty admin-maintenance-modal__summary-due">
                                {formatCurrency(activeMaintenanceItem.cost, locale)}
                              </span>
                            </>
                          )}
                        </div>
                        <div
                          className={`admin-maintenance-plan__status admin-maintenance-plan__status--${activeMaintenanceStatus}`}
                        >
                          {activeMaintenanceStatus === "overdue" &&
                            t("admin.overdueMaintenance")}
                          {activeMaintenanceStatus === "dueSoon" &&
                            t("admin.dueSoonMaintenance")}
                          {activeMaintenanceStatus === "upcoming" &&
                            t("admin.upcomingMaintenance")}
                          {activeMaintenanceStatus === "completed" &&
                            t("admin.completedMaintenance")}
                        </div>
                      </div>
                    )}

                    <div className="admin-maintenance-modal__fields">
                      <label className="admin-inventory-field">
                        <div className="admin-inventory-field__label">
                          {t("admin.maintenanceAsset")}
                        </div>
                        <select
                          className="admin-input"
                          value={maintenanceMachineKey}
                          onChange={(e) => setMaintenanceMachineKey(e.target.value)}
                        >
                          <option value="">{t("admin.maintenanceAsset")}</option>
                          {machineDirectory.map((machine) => (
                            <option key={machine.machineKey} value={machine.machineKey}>
                              {machineLabelByKey[machine.machineKey] || machine.machineKey}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-inventory-field">
                        <div className="admin-inventory-field__label">
                          {t("admin.maintenanceTitle")}
                        </div>
                        <input
                          type="text"
                          className="admin-input"
                          value={maintenanceTitle}
                          onChange={(e) => setMaintenanceTitle(e.target.value)}
                          placeholder={t("admin.maintenanceTitlePlaceholder")}
                        />
                      </label>
                      <label className="admin-inventory-field">
                        <div className="admin-inventory-field__label">
                          {t("admin.maintenanceDueDate")}
                        </div>
                        <input
                          type="date"
                          className="admin-input"
                          value={maintenanceDueDate}
                          onChange={(e) => setMaintenanceDueDate(e.target.value)}
                        />
                      </label>
                      <label className="admin-inventory-field">
                        <div className="admin-inventory-field__label">
                          {t("admin.maintenanceCost")}
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="admin-input"
                          value={maintenanceCost}
                          onChange={(e) => setMaintenanceCost(e.target.value)}
                          placeholder={t("admin.maintenanceCostPlaceholder")}
                        />
                      </label>
                      <label className="admin-inventory-field admin-maintenance-modal__field--full">
                        <div className="admin-inventory-field__label">
                          {t("admin.maintenanceNote")}
                        </div>
                        <textarea
                          className="admin-input admin-maintenance-modal__note"
                          value={maintenanceNote}
                          onChange={(e) => setMaintenanceNote(e.target.value)}
                          placeholder={t("admin.maintenanceNotePlaceholder")}
                        />
                      </label>
                    </div>

                    <div className="admin-maintenance-modal__actions">
                      <div className="admin-maintenance-modal__footer-date">
                        {selectedMaintenanceDateLabel}
                      </div>
                      <button
                        type="button"
                        className="admin-reset-button admin-maintenance-modal__primary"
                        onClick={() => {
                          void savePlannedMaintenance();
                        }}
                        disabled={
                          plannedMaintenanceSaving ||
                          !maintenanceMachineKey ||
                          !maintenanceTitle.trim() ||
                          !maintenanceDueDate
                        }
                      >
                        {plannedMaintenanceSaving
                          ? t("admin.saving")
                          : isMaintenanceEditing
                            ? t("common.save")
                            : t("admin.addMaintenancePlan")}
                      </button>
                      {activeMaintenanceItem && (
                        <button
                          type="button"
                          className="admin-reset-button"
                          onClick={() => {
                            void updatePlannedMaintenanceState(
                              activeMaintenanceItem.id,
                              !activeMaintenanceItem.isCompleted
                            );
                          }}
                          disabled={
                            plannedMaintenanceSaving ||
                            maintenanceActionKey ===
                              `${activeMaintenanceItem.id}:${
                                activeMaintenanceItem.isCompleted ? "reopen" : "complete"
                              }`
                          }
                        >
                          {activeMaintenanceItem.isCompleted
                            ? t("admin.markActive")
                            : t("admin.markCompleted")}
                        </button>
                      )}
                      {activeMaintenanceItem && (
                        <button
                          type="button"
                          className="admin-reset-button"
                          onClick={() => {
                            void deletePlannedMaintenance(activeMaintenanceItem.id);
                          }}
                          disabled={
                            plannedMaintenanceSaving ||
                            maintenanceActionKey ===
                              `${activeMaintenanceItem.id}:delete`
                          }
                        >
                          {t("common.delete")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-reset-button"
                        onClick={closeMaintenanceModal}
                        disabled={plannedMaintenanceSaving}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                </Modal>

              </>
            )}

            {activeFunction === "statistics" && (
              <>
                <div className="admin-card">
                  <h1 className="admin-title">{t("admin.statistics")}</h1>
                  <p className="admin-subtitle">
                    {t("admin.statisticsSubtitle")}
                  </p>
                  <p className="admin-subtitle">{statisticsTimeframeLabel}</p>

                  <AdminFilters
                    className="admin-filters--compact"
                    category={statisticsCategory}
                    subCategory={statisticsSubCategory}
                    dateFrom={statisticsDateFrom}
                    dateTo={statisticsDateTo}
                    subCategoryOptions={statisticsSubCategoryOptions}
                    activeDatePreset={statisticsActiveDatePreset}
                    resetDisabled={
                      !statisticsCategory &&
                      !statisticsSubCategory &&
                      !statisticsDateFrom &&
                      !statisticsDateTo
                    }
                    onCategoryChange={(value) => {
                      setStatisticsCategory(value);
                      setStatisticsSubCategory("");
                    }}
                    onSubCategoryChange={setStatisticsSubCategory}
                    onDateFromChange={setStatisticsDateFrom}
                    onDateToChange={setStatisticsDateTo}
                    onApplyAllTickets={applyAllTickets}
                    onApplyLastSevenDays={applyLastSevenDays}
                    onApplyThisMonth={applyThisMonth}
                    onApplyLastMonth={applyLastMonth}
                    onApplyLastSixMonths={applyLastSixMonths}
                    onResetFilters={resetStatisticsFilters}
                  />
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.repairStatistics")}</div>
                  <div className="admin-stats">
                    <div className="admin-stat">
                      <div className="admin-stat-label">{t("admin.tickets")}</div>
                      <div className="admin-stat-value">{filteredIssues.length}</div>
                    </div>
                    <div className="admin-stat">
                      <div className="admin-stat-label">{t("admin.loggedTime")}</div>
                      <div className="admin-stat-value">
                        {formatSeconds(statisticsTotalTimeSeconds, locale)}
                      </div>
                    </div>
                    <div className="admin-stat">
                      <div className="admin-stat-label">{t("admin.trackedCost")}</div>
                      <div className="admin-stat-value">
                        {formatCurrency(statisticsTrackedCost, locale)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.maintenanceStatistics")}</div>
                  <div className="admin-stats">
                    <div className="admin-stat">
                      <div className="admin-stat-label">
                        {t("admin.maintenancePlans")}
                      </div>
                      <div className="admin-stat-value">
                        {plannedMaintenanceItems.length}
                      </div>
                    </div>
                    <div className="admin-stat">
                      <div className="admin-stat-label">
                        {t("admin.activeMaintenancePlans")}
                      </div>
                      <div className="admin-stat-value">
                        {statisticsMaintenanceActiveCount}
                      </div>
                    </div>
                    <div className="admin-stat">
                      <div className="admin-stat-label">
                        {t("admin.completedMaintenancePlans")}
                      </div>
                      <div className="admin-stat-value">
                        {statisticsMaintenanceCompletedCount}
                      </div>
                    </div>
                    <div className="admin-stat">
                      <div className="admin-stat-label">
                        {t("admin.maintenanceCostTotal")}
                      </div>
                      <div className="admin-stat-value">
                        {formatCurrency(statisticsMaintenanceCost, locale)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.ticketsByCategory")}</div>
                  {ticketsByCategory.length === 0 && (
                    <div className="admin-chart-empty">
                      {t("admin.noTicketData")}
                    </div>
                  )}
                  {ticketsByCategory.map((row) => {
                    const width = (row.tickets / maxCategoryTickets) * 100;
                    return (
                      <div key={row.name} className="admin-chart-row">
                        <div className="admin-chart-label">{row.name}</div>
                        <div className="admin-chart-bar">
                          <div
                            className="admin-chart-bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="admin-chart-value">
                          {getTicketCountLabel(t, row.tickets)}
                        </div>
                        <div className="admin-chart-money">
                          {formatSeconds(row.seconds, locale)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">
                    {t("admin.breakdownsByMachine")}
                  </div>
                  {machinesByBreakdowns.length === 0 && (
                    <div className="admin-chart-empty">
                      {t("admin.noMachineBreakdownData")}
                    </div>
                  )}
                  {machinesByBreakdowns.map((row) => {
                    const width = (row.breakdowns / maxMachineBreakdowns) * 100;
                    return (
                      <div key={row.key} className="admin-chart-row">
                        <div className="admin-chart-label">{row.label}</div>
                        <div className="admin-chart-bar">
                          <div
                            className="admin-chart-bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="admin-chart-value">
                          {t("admin.breakdownsCount", {
                            count: row.breakdowns,
                          })}
                        </div>
                        <div className="admin-chart-money">
                          {formatCurrency(row.repairCost, locale)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">
                    {t("admin.repairCostByMachine")}
                  </div>
                  {machinesByRepairCost.length === 0 && (
                    <div className="admin-chart-empty">
                      {t("admin.noRepairCostData")}
                    </div>
                  )}
                  {machinesByRepairCost.map((row) => {
                    const width = (row.repairCost / maxMachineRepairCost) * 100;
                    return (
                      <div key={row.key} className="admin-chart-row">
                        <div className="admin-chart-label">{row.label}</div>
                        <div className="admin-chart-bar">
                          <div
                            className="admin-chart-bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="admin-chart-value">
                          {formatCurrency(row.repairCost, locale)}
                        </div>
                        <div className="admin-chart-money">
                          {t("admin.breakdownsCount", {
                            count: row.breakdowns,
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">
                    {t("admin.maintenanceCostByMachine")}
                  </div>
                  {machinesByMaintenanceCost.length === 0 && (
                    <div className="admin-chart-empty">
                      {t("admin.noMaintenanceCostData")}
                    </div>
                  )}
                  {machinesByMaintenanceCost.map((row) => {
                    const width =
                      (row.maintenanceCost / maxMachineMaintenanceCost) * 100;
                    return (
                      <div key={row.key} className="admin-chart-row">
                        <div className="admin-chart-label">{row.label}</div>
                        <div className="admin-chart-bar">
                          <div
                            className="admin-chart-bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="admin-chart-value">
                          {formatCurrency(row.maintenanceCost, locale)}
                        </div>
                        <div className="admin-chart-money">
                          {t("admin.maintenanceCount", {
                            count: maintenanceCountByMachineKey.get(row.key) ?? 0,
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.topTicketsByLoggedTime")}</div>
                  {topTicketsByTime.length === 0 && (
                    <div className="admin-chart-empty">{t("admin.noTicketsFound")}</div>
                  )}
                  {topTicketsByTime.map((issue) => (
                    <button
                      key={issue.key}
                      type="button"
                      className="admin-ticket-open admin-chart-row admin-chart-row--tickets"
                      onClick={() => setSelectedIssue(issue)}
                    >
                      <div className="admin-chart-label">{issue.key}</div>
                      <div className="admin-ticket-summary">{issue.summary}</div>
                      <div className="admin-chart-value">
                        {formatSeconds(issue.timeSpentSeconds ?? 0, locale)}
                      </div>
                      <div className="admin-chart-money">
                        {ticketCostsByIssue[issue.key]
                          ? formatCurrency(ticketCostsByIssue[issue.key].amount, locale)
                          : "-"}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeFunction === "users" && currentUserCanManageUsers && (
              <UsersManager
                currentUserId={currentUserId}
                canManageUsers={currentUserCanManageUsers}
              />
            )}
          </div>
          )}

          <AdminTicketModal
            isOpen={!!selectedIssue}
            onClose={() => setSelectedIssue(null)}
            issue={selectedIssue}
            onDataChanged={handleModalDataChanged}
          />
        </section>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  );
}
