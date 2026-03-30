"use client";

import "../page.css";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useI18n } from "@/components/I18nProvider";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { useIssues } from "@/lib/IssuesContext";
import { getIssueAssetParts, parseMachineKey } from "@/lib/assets";
import { DEPARTMENT_LINES } from "@/data/listData";
import AdminTicketModal from "@/components/AdminTicketModal/AdminTicketModal";
import UsersManager from "./users/users-manager";
import type { NormalizedIssue } from "@/lib/jira";

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
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssetStatisticsRow = {
  key: string;
  label: string;
  category: string;
  subcategory: string;
  breakdowns: number;
  loggedSeconds: number;
  repairCost: number;
  hasAssetRecord: boolean;
  hasInventoryDetails: boolean;
};

type AdminFunction =
  | "costs"
  | "maintenance"
  | "inventory"
  | "users"
  | "statistics";
type DatePreset = "" | "all" | "last7" | "thisMonth" | "lastMonth" | "last6Months";
type MaintenanceTimeline = "all" | "7days" | "month" | "3months";

function formatCurrency(amount: number, locale: string = "en") {
  return new Intl.NumberFormat(locale === "lt" ? "lt-LT" : "en-US", {
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
  const [currentUserCanManageUsers, setCurrentUserCanManageUsers] = useState(false);
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
  const [maintenanceTimeline, setMaintenanceTimeline] =
    useState<MaintenanceTimeline>("all");
  const [maintenanceMachineKey, setMaintenanceMachineKey] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDueDate, setMaintenanceDueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [maintenanceNote, setMaintenanceNote] = useState("");
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
  const machineLabelByKey = useMemo(
    () =>
      Object.fromEntries(
        machineCatalog.map((machine) => [
          machine.machineKey,
          `${machine.category} / ${machine.subcategory}`,
        ])
      ) as Record<string, string>,
    [machineCatalog]
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

  const filteredIssues = useMemo<NormalizedIssue[]>(() => {
    return ((issues ?? []) as NormalizedIssue[]).filter((i: NormalizedIssue) => {
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
  }, [issues, viewCategory, viewSubCategory, viewDateFrom, viewDateTo]);

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
  const statisticsIssueAssetSummary = useMemo(() => {
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

    for (const issue of filteredIssues) {
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
  }, [filteredIssues]);
  const repairCostByMachineKey = useMemo(() => {
    const totals = new Map<string, number>();

    for (const issue of filteredIssues) {
      const machineKey = getIssueAssetParts(issue).machineKey;
      if (!machineKey) continue;
      totals.set(
        machineKey,
        (totals.get(machineKey) ?? 0) + (ticketCostsByIssue[issue.key]?.amount ?? 0)
      );
    }

    return totals;
  }, [filteredIssues, ticketCostsByIssue]);
  const assetStatistics = useMemo<AssetStatisticsRow[]>(() => {
    return Array.from(statisticsIssueAssetSummary.byMachine.values()).map((row) => {
      const asset = assetDetailsByMachineKey[row.key];
      const parsed = parseMachineKey(row.key);
      const category = asset?.category || row.category || parsed.category || t("common.unknown");
      const subcategory =
        asset?.subcategory || row.subcategory || parsed.subcategory || t("common.unknown");
      const model = asset?.model?.trim() || "";
      const serialNumber = asset?.serialNumber?.trim() || "";
      const manufacturer = asset?.manufacturer?.trim() || "";

      return {
        key: row.key,
        label: `${category} / ${subcategory}`,
        category,
        subcategory,
        breakdowns: row.breakdowns,
        loggedSeconds: row.loggedSeconds,
        repairCost: repairCostByMachineKey.get(row.key) ?? 0,
        hasAssetRecord: Boolean(asset),
        hasInventoryDetails: Boolean(model && serialNumber && manufacturer),
      };
    });
  }, [assetDetailsByMachineKey, repairCostByMachineKey, statisticsIssueAssetSummary.byMachine, t]);
  const statisticsMappedAssetCount = useMemo(
    () => assetStatistics.filter((item) => item.hasAssetRecord).length,
    [assetStatistics]
  );
  const statisticsAssetsWithInventoryCount = useMemo(
    () => assetStatistics.filter((item) => item.hasInventoryDetails).length,
    [assetStatistics]
  );
  const statisticsAssetsMissingInventoryCount =
    statisticsMappedAssetCount - statisticsAssetsWithInventoryCount;
  const statisticsUnmappedTicketCount = statisticsIssueAssetSummary.unmappedTickets;
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
  const filteredMaintenanceItems = useMemo(() => {
    const visibleMachineKeys = new Set(filteredMachineCatalog.map((item) => item.machineKey));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = new Date(now);

    if (maintenanceTimeline === "all") {
      horizon.setFullYear(horizon.getFullYear() + 100);
    } else if (maintenanceTimeline === "7days") {
      horizon.setDate(horizon.getDate() + 7);
    } else if (maintenanceTimeline === "month") {
      horizon.setMonth(horizon.getMonth() + 1);
    } else {
      horizon.setMonth(horizon.getMonth() + 3);
    }

    return plannedMaintenanceItems.filter((item) => {
      if (!visibleMachineKeys.has(item.machineKey)) return false;
      const dueDate = new Date(item.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() <= horizon.getTime();
    });
  }, [filteredMachineCatalog, maintenanceTimeline, plannedMaintenanceItems]);
  const groupedMaintenanceItems = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const overdue: PlannedMaintenanceItem[] = [];
    const dueSoon: PlannedMaintenanceItem[] = [];
    const upcoming: PlannedMaintenanceItem[] = [];
    const completed: PlannedMaintenanceItem[] = [];

    for (const item of filteredMaintenanceItems) {
      if (item.isCompleted) {
        completed.push(item);
        continue;
      }

      const dueDate = new Date(item.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate.getTime() < now.getTime()) {
        overdue.push(item);
      } else if (dueDate.getTime() <= sevenDaysFromNow.getTime()) {
        dueSoon.push(item);
      } else {
        upcoming.push(item);
      }
    }

    return { overdue, dueSoon, upcoming, completed };
  }, [filteredMaintenanceItems]);
  const maintenanceBadgeCount =
    groupedMaintenanceItems.overdue.length + groupedMaintenanceItems.dueSoon.length;
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
      setAssetDetailsByMachineKey(byMachineKey);
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
      setAssetDetailsByMachineKey({});
    } finally {
      setInventoryLoading(false);
    }
  }, [machineCatalog]);

  const loadPlannedMaintenance = useCallback(async () => {
    setPlannedMaintenanceLoading(true);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch("/api/admin/planned-maintenance", {
        cache: "no-store",
      });
      const data = await parseJson<{ items: PlannedMaintenanceItem[] }>(res);
      setPlannedMaintenanceItems(data.items ?? []);
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
      setPlannedMaintenanceItems([]);
    } finally {
      setPlannedMaintenanceLoading(false);
    }
  }, []);

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
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          user?: {
            id?: string | null;
            name?: string | null;
            email?: string | null;
          };
        };
        const userId = String(data.user?.id || "");
        const normalizedName = String(data.user?.name || "").trim().toLowerCase();
        const normalizedEmail = String(data.user?.email || "").trim().toLowerCase();
        const displayName = String(data.user?.name || "").trim();
        const displayEmail = String(data.user?.email || "").trim();
        const emailLocalPart = normalizedEmail.includes("@")
          ? normalizedEmail.split("@")[0]
          : normalizedEmail;

        setCurrentUserId(userId);
        setCurrentUserLabel(displayName || displayEmail || userId);
        setCurrentUserCanManageUsers(
          normalizedName === "ignven" || emailLocalPart === "ignven"
        );
      } catch {
        setCurrentUserId("");
        setCurrentUserLabel("");
        setCurrentUserCanManageUsers(false);
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
  }, [filteredIssues]);

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

  const createPlannedMaintenance = async () => {
    if (!maintenanceMachineKey || !maintenanceTitle.trim() || !maintenanceDueDate) {
      return;
    }

    setPlannedMaintenanceSaving(true);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch("/api/admin/planned-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineKey: maintenanceMachineKey,
          title: maintenanceTitle.trim(),
          dueDate: maintenanceDueDate,
          note: maintenanceNote.trim(),
        }),
      });
      const saved = await parseJson<PlannedMaintenanceItem>(res);
      setPlannedMaintenanceItems((prev) =>
        [...prev, saved].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      );
      setMaintenanceTitle("");
      setMaintenanceDueDate(new Date().toISOString().slice(0, 10));
      setMaintenanceNote("");
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    } finally {
      setPlannedMaintenanceSaving(false);
    }
  };

  const updatePlannedMaintenanceState = async (id: string, isCompleted: boolean) => {
    try {
      const res = await fetch(`/api/admin/planned-maintenance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      const saved = await parseJson<PlannedMaintenanceItem>(res);
      setPlannedMaintenanceItems((prev) =>
        prev.map((item) => (item.id === id ? saved : item))
      );
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    }
  };

  const deletePlannedMaintenance = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/planned-maintenance/${id}`, {
        method: "DELETE",
      });
      await parseJson<{ ok: boolean }>(res);
      setPlannedMaintenanceItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    }
  };

  function getMaintenanceDueLabel(dueDateRaw: string) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateRaw);
    dueDate.setHours(0, 0, 0, 0);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / 86400000);

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
        date: prev[issueKey]?.date || new Date().toISOString().slice(0, 10),
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
            machineKey,
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
                <button
                  type="button"
                  className={`admin-function-button ${
                    activeFunction === "users" ? "admin-function-button--active" : ""
                  }`}
                  onClick={() => setActiveFunction("users")}
                >
                  {t("admin.manageUsers")}
                </button>
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
                        date: new Date().toISOString().slice(0, 10),
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
                  <div className="admin-stats">
                    <div className="admin-stat">
                      <div className="admin-stat-label">
                        {t("admin.assetsInFilteredTickets")}
                      </div>
                      <div className="admin-stat-value">{statisticsMappedAssetCount}</div>
                    </div>
                    {statisticsAssetsMissingInventoryCount > 0 && (
                      <div className="admin-stat">
                        <div className="admin-stat-label">
                          {t("admin.assetsInFilteredTicketsMissingInventory")}
                        </div>
                        <div className="admin-stat-value">
                          {statisticsAssetsMissingInventoryCount}
                        </div>
                      </div>
                    )}
                    {statisticsUnmappedTicketCount > 0 && (
                      <div className="admin-stat">
                        <div className="admin-stat-label">{t("admin.unmappedTickets")}</div>
                        <div className="admin-stat-value">
                          {statisticsUnmappedTicketCount}
                        </div>
                      </div>
                    )}
                    <div className="admin-stat">
                      <div className="admin-stat-label">{t("admin.registeredAssets")}</div>
                      <div className="admin-stat-value">{totalRegisteredAssetCount}</div>
                    </div>
                    <div className="admin-stat">
                      <div className="admin-stat-label">{t("admin.catalogAssets")}</div>
                      <div className="admin-stat-value">{totalCatalogAssetCount}</div>
                    </div>
                    <div className="admin-stat">
                      <div className="admin-stat-label">{t("admin.assetsWithInventory")}</div>
                      <div className="admin-stat-value">
                        {totalRegisteredAssetsWithInventoryCount}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">{t("admin.assetCoverage")}</div>
                  <p className="admin-subtitle">{t("admin.assetCoverageSubtitle")}</p>
                  <div className="admin-chart-row admin-chart-row--compact">
                    <div className="admin-chart-label">
                      {t("admin.filteredTicketAssetCoverage")}
                    </div>
                    <div className="admin-chart-bar">
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${
                            filteredIssues.length > 0
                              ? (statisticsMappedAssetCount /
                                  Math.max(
                                    statisticsMappedAssetCount + statisticsUnmappedTicketCount,
                                    1
                                  )) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="admin-chart-value">
                      {statisticsMappedAssetCount}
                    </div>
                    <div className="admin-chart-money">
                      {statisticsUnmappedTicketCount > 0
                        ? `${t("admin.unmappedTickets")}: ${statisticsUnmappedTicketCount}`
                        : ""}
                    </div>
                  </div>
                  <div className="admin-chart-row admin-chart-row--compact">
                    <div className="admin-chart-label">
                      {t("admin.filteredTicketInventoryCoverage")}
                    </div>
                    <div className="admin-chart-bar">
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${
                            statisticsMappedAssetCount > 0
                              ? (statisticsAssetsWithInventoryCount /
                                  Math.max(statisticsMappedAssetCount, 1)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="admin-chart-value">
                      {statisticsAssetsWithInventoryCount}
                    </div>
                    <div className="admin-chart-money">
                      {statisticsAssetsMissingInventoryCount > 0
                        ? `${t("admin.assetsInFilteredTicketsMissingInventory")}: ${statisticsAssetsMissingInventoryCount}`
                        : ""}
                    </div>
                  </div>
                  <div className="admin-chart-row admin-chart-row--compact">
                    <div className="admin-chart-label">
                      {t("admin.registryInventoryCoverage")}
                    </div>
                    <div className="admin-chart-bar">
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${
                            totalRegisteredAssetCount > 0
                              ? (totalRegisteredAssetsWithInventoryCount /
                                  Math.max(totalRegisteredAssetCount, 1)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="admin-chart-value">
                      {totalRegisteredAssetsWithInventoryCount}
                    </div>
                    <div className="admin-chart-money">
                      {t("admin.registeredAssets")}: {totalRegisteredAssetCount}
                    </div>
                  </div>
                  <div className="admin-chart-row admin-chart-row--compact">
                    <div className="admin-chart-label">{t("admin.catalogCoverage")}</div>
                    <div className="admin-chart-bar">
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${
                            totalCatalogAssetCount > 0
                              ? (totalRegisteredAssetCount /
                                  Math.max(totalCatalogAssetCount, 1)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="admin-chart-value">{totalRegisteredAssetCount}</div>
                    <div className="admin-chart-money">
                      {t("admin.catalogAssets")}: {totalCatalogAssetCount}
                    </div>
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-chart-title">
                    {t("admin.machinesCount", {
                      count: filteredMachineCatalog.length,
                    })}
                  </div>
                  {inventoryLoading && (
                    <div className="admin-buffering">
                      <div className="admin-buffering-spinner" />
                      <div className="admin-chart-empty">{t("admin.loadingMachines")}</div>
                    </div>
                  )}
                  {!inventoryLoading && filteredMachineCatalog.length === 0 && (
                    <div className="admin-chart-empty">{t("admin.noMachinesFound")}</div>
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
                <div className="admin-card">
                  <h1 className="admin-title">{t("admin.plannedMaintenance")}</h1>
                  <p className="admin-subtitle">
                    {t("admin.plannedMaintenanceSubtitle")}
                  </p>
                  <div className="admin-maintenance-header-actions">
                    <a
                      href="https://svenheim.atlassian.net/servicedesk/customer/portal/40"
                      target="_blank"
                      rel="noreferrer"
                      className="page__action-link admin-maintenance-link"
                    >
                      {t("admin.registerMaintenanceTicket")}
                    </a>
                  </div>
                  {plannedMaintenanceError && (
                    <div className="page__error">{plannedMaintenanceError}</div>
                  )}
                </div>

                <div className="admin-panel">
                  <div className="admin-maintenance-form">
                    <label className="admin-inventory-field">
                      <div className="admin-inventory-field__label">
                        {t("admin.maintenanceAsset")}
                      </div>
                      <select
                        className="admin-input"
                        value={maintenanceMachineKey}
                        onChange={(e) => setMaintenanceMachineKey(e.target.value)}
                      >
                        <option value="">{t("common.all")}</option>
                        {machineCatalog.map((machine) => (
                          <option key={machine.machineKey} value={machine.machineKey}>
                            {machine.category} / {machine.subcategory}
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
                        {t("admin.maintenanceNote")}
                      </div>
                      <input
                        type="text"
                        className="admin-input"
                        value={maintenanceNote}
                        onChange={(e) => setMaintenanceNote(e.target.value)}
                        placeholder={t("admin.maintenanceNotePlaceholder")}
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-reset-button admin-maintenance-form__button"
                      onClick={() => {
                        void createPlannedMaintenance();
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
                        : t("admin.addMaintenancePlan")}
                    </button>
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-filters-actions admin-filters-actions--presets admin-maintenance-timeline">
                    <div className="admin-date-presets">
                      <span className="admin-label">{t("admin.maintenanceTimeline")}</span>
                      <button
                        type="button"
                        className={`admin-reset-button${
                          maintenanceTimeline === "all"
                            ? " admin-reset-button--active"
                            : ""
                        }`}
                        onClick={() => setMaintenanceTimeline("all")}
                      >
                        {t("admin.allMaintenance")}
                      </button>
                      <button
                        type="button"
                        className={`admin-reset-button${
                          maintenanceTimeline === "7days"
                            ? " admin-reset-button--active"
                            : ""
                        }`}
                        onClick={() => setMaintenanceTimeline("7days")}
                      >
                        {t("admin.next7Days")}
                      </button>
                      <button
                        type="button"
                        className={`admin-reset-button${
                          maintenanceTimeline === "month"
                            ? " admin-reset-button--active"
                            : ""
                        }`}
                        onClick={() => setMaintenanceTimeline("month")}
                      >
                        {t("admin.nextMonth")}
                      </button>
                      <button
                        type="button"
                        className={`admin-reset-button${
                          maintenanceTimeline === "3months"
                            ? " admin-reset-button--active"
                            : ""
                        }`}
                        onClick={() => setMaintenanceTimeline("3months")}
                      >
                        {t("admin.next3Months")}
                      </button>
                    </div>
                  </div>
                  {plannedMaintenanceLoading && (
                    <div className="admin-buffering">
                      <div className="admin-buffering-spinner" />
                      <div className="admin-chart-empty">{t("common.loading")}</div>
                    </div>
                  )}
                  {!plannedMaintenanceLoading && (
                    <>
                      {groupedMaintenanceItems.overdue.length === 0 &&
                        groupedMaintenanceItems.dueSoon.length === 0 &&
                        groupedMaintenanceItems.upcoming.length === 0 &&
                        groupedMaintenanceItems.completed.length === 0 && (
                          <div className="admin-chart-empty">
                            {t("admin.noMaintenancePlans")}
                          </div>
                        )}
                      {(
                        [
                          ["overdue", groupedMaintenanceItems.overdue, t("admin.overdueMaintenance")],
                          ["dueSoon", groupedMaintenanceItems.dueSoon, t("admin.dueSoonMaintenance")],
                          ["upcoming", groupedMaintenanceItems.upcoming, t("admin.upcomingMaintenance")],
                          ["completed", groupedMaintenanceItems.completed, t("admin.completedMaintenance")],
                        ] as const
                      )
                        .filter(([, items]) => items.length > 0)
                        .map(([key, items, title]) => (
                          <div key={key} className="admin-maintenance-group">
                            <div className="admin-chart-title">{title}</div>
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className={`admin-maintenance-row${
                                  item.isCompleted
                                    ? " admin-maintenance-row--completed"
                                    : ""
                                }`}
                              >
                                <div className="admin-ticket-meta">
                                  <div className="admin-ticket-key">
                                    {machineLabelByKey[item.machineKey] || item.machineKey}
                                  </div>
                                  <div className="admin-ticket-summary">{item.title}</div>
                                  {item.note && (
                                    <div className="admin-maintenance-note">{item.note}</div>
                                  )}
                                </div>
                                <div className="admin-maintenance-due">
                                  <div>{new Date(item.dueDate).toISOString().slice(0, 10)}</div>
                                  {!item.isCompleted && (
                                    <div className="admin-chart-empty">
                                      {getMaintenanceDueLabel(item.dueDate)}
                                    </div>
                                  )}
                                </div>
                                <div className="admin-manual-actions admin-maintenance-actions">
                                  <button
                                    type="button"
                                    className="admin-reset-button admin-maintenance-actions__button"
                                    onClick={() => {
                                      void updatePlannedMaintenanceState(
                                        item.id,
                                        !item.isCompleted
                                      );
                                    }}
                                  >
                                    {item.isCompleted
                                      ? t("admin.markActive")
                                      : t("admin.markCompleted")}
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-reset-button admin-maintenance-actions__button"
                                    onClick={() => {
                                      void deletePlannedMaintenance(item.id);
                                    }}
                                  >
                                    {t("common.delete")}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                    </>
                  )}
                </div>
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

            {activeFunction === "users" && (
              <UsersManager
                currentUserId={currentUserId}
                canManageUsers={currentUserCanManageUsers}
              />
            )}
          </div>

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
