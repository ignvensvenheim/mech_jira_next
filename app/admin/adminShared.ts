import { getIssueAssetParts, parseMachineKey } from "@/lib/assets";
import {
  dateOnlyToDayKey,
  formatDateOnly,
  formatMaintenanceDateTimeInput,
  formatMaintenanceDateTimeForLocale,
  getCurrentLocalDateOnly,
  getDateOnlyFromMaintenanceDateTime,
  getCurrentLocalDayKey,
  parseMaintenanceDateTime,
  parseDateOnly,
} from "@/lib/dateOnly";
import { DEPARTMENT_LINES } from "@/data/listData";
import type { NormalizedIssue } from "@/lib/jira";
import {
  normalizePlannedMaintenanceRecipients,
  type PlannedMaintenanceRecipient,
} from "@/lib/plannedMaintenanceRecipients";

export type AdminTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export type ManualCostEntry = {
  id: string;
  date: string;
  amount: number;
  comment: string;
  createdAt: string;
};

export type MachineDataResponse = {
  entries: ManualCostEntry[];
};

export type TicketFixCost = {
  issueKey: string;
  machineKey: string;
  date: string;
  amount: number;
  comment: string;
  updatedAt: string;
};

export type TicketFixDraft = {
  date: string;
  amount: string;
  comment: string;
};

export type EquipmentDetailsResponse = {
  machineKey: string;
  category?: string;
  subcategory?: string;
  model: string;
  serialNumber: string;
  manufacturer: string;
  updatedAt: string | null;
};

export type EquipmentDraft = {
  model: string;
  serialNumber: string;
  manufacturer: string;
};

export type PlannedMaintenanceItem = {
  id: string;
  machineKey: string;
  title: string;
  dueDate: string;
  note: string | null;
  cost: number | null;
  jiraIssueId: string | null;
  jiraIssueKey: string | null;
  jiraIssueUrl: string | null;
  notificationRecipients: PlannedMaintenanceRecipient[];
  status: MaintenanceWorkflowStatus;
  isCompleted: boolean;
  completedAt: string | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceWorkflowStatus =
  | "planned"
  | "inProgress"
  | "waitingForParts"
  | "completed"
  | "cancelled";

export type MaintenanceStatus =
  | "overdue"
  | "dueSoon"
  | "upcoming"
  | "inProgress"
  | "waitingForParts"
  | "completed"
  | "cancelled";

export type MaintenanceLogEntry = {
  id: string;
  category: string;
  change: string;
  title: string;
  timestamp: string;
  kind: "created" | "updated" | "completed";
};

export type AssetStatisticsRow = {
  key: string;
  label: string;
  category: string;
  subcategory: string;
  breakdowns: number;
  maintenanceCount: number;
  loggedSeconds: number;
  repairCost: number;
  maintenanceCost: number;
};

export type MachineDirectoryItem = {
  machineKey: string;
  category: string;
  subcategory: string;
};

export type AdminFunction =
  | "costs"
  | "maintenance"
  | "inventory"
  | "users"
  | "statistics";

export type DatePreset = "" | "all" | "last7" | "thisMonth" | "lastMonth" | "last6Months";

export function getLocaleTag(locale: string) {
  return locale === "lt" ? "lt-LT" : "en-US";
}

export function formatMachineDirectoryLabel(machine: {
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

export function formatMachineKeyDisplay(machineKey: string) {
  const parsed = parseMachineKey(machineKey);
  return formatMachineDirectoryLabel(parsed) || machineKey.trim();
}

export function formatCurrency(amount: number, locale: string = "en") {
  return new Intl.NumberFormat(getLocaleTag(locale), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getIssueCategoryAndSubcategory(issue: NormalizedIssue) {
  const [categoryPart = "", subcategoryPart = ""] = (issue.summary ?? "")
    .split("|")
    .map((s: string) => s.trim());

  return {
    category: categoryPart,
    subcategory: subcategoryPart || "Unspecified",
  };
}

export function summarizeIssuesByAsset(issueList: NormalizedIssue[]) {
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

export function getRepairCostTotalsByMachine(
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

export function sortPlannedMaintenanceItems(items: PlannedMaintenanceItem[]) {
  const order: Record<MaintenanceWorkflowStatus, number> = {
    planned: 0,
    inProgress: 1,
    waitingForParts: 2,
    completed: 3,
    cancelled: 4,
  };

  return [...items].sort((a, b) => {
    if (a.status !== b.status) {
      return order[a.status] - order[b.status];
    }

    const dueDateSort = a.dueDate.localeCompare(b.dueDate);
    if (dueDateSort !== 0) return dueDateSort;

    return a.title.localeCompare(b.title);
  });
}

export function normalizeMaintenanceWorkflowStatus(
  value: unknown,
  fallbackIsCompleted: boolean = false
): MaintenanceWorkflowStatus {
  switch (value) {
    case "planned":
    case "inProgress":
    case "waitingForParts":
    case "completed":
    case "cancelled":
      return value;
    default:
      return fallbackIsCompleted ? "completed" : "planned";
  }
}

export function isMaintenanceClosedStatus(status: MaintenanceWorkflowStatus) {
  return status === "completed" || status === "cancelled";
}

export function getMaintenanceItemStatus(
  item: PlannedMaintenanceItem,
  todayDayKey: number = getCurrentLocalDayKey()
): MaintenanceStatus {
  if (item.status === "completed") return "completed";
  if (item.status === "cancelled") return "cancelled";
  if (item.status === "inProgress") return "inProgress";
  if (item.status === "waitingForParts") return "waitingForParts";

  const dueDayKey = dateOnlyToDayKey(getDateOnlyFromMaintenanceDateTime(item.dueDate));
  if (dueDayKey === null) return "upcoming";
  if (dueDayKey < todayDayKey) return "overdue";
  if (dueDayKey <= todayDayKey + 7) return "dueSoon";

  return "upcoming";
}

export function toDateOnlyFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function parseDateOnlyToLocalTime(value: string, endOfDay: boolean) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return endOfDay
    ? new Date(year, monthIndex, day, 23, 59, 59, 999).getTime()
    : new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
}

export function formatSeconds(total: number, locale: string = "en") {
  const safe = Math.max(0, Math.floor(total || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (locale === "lt") {
    return `${hours} val ${minutes} min ${seconds} s`;
  }
  return `${hours}h ${minutes}m ${seconds}s`;
}

export async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }
  return data;
}

export function toDateInputValue(date: Date) {
  const safe = new Date(date);
  safe.setHours(0, 0, 0, 0);
  return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, "0")}-${String(
    safe.getDate()
  ).padStart(2, "0")}`;
}

export function getLastSevenDaysRange() {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

export function getThisMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

export function getLastMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

export function getLastSixMonthsRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

export function formatDisplayDate(value: string) {
  if (!value) return "";
  const parsed = parseDateOnly(value);
  if (!parsed) return value;
  return formatDateOnly(parsed);
}

export function getDateRangeBounds(from: string, to: string) {
  const fromTime = from ? parseDateOnlyToLocalTime(from, false) : -Infinity;
  const toTime = to ? parseDateOnlyToLocalTime(to, true) : Infinity;

  return {
    fromTime,
    toTime,
  };
}

export function formatDateTimeForLocale(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatMaintenanceDueDateTimeForLocale(value: string, locale: string) {
  return formatMaintenanceDateTimeForLocale(value, getLocaleTag(locale));
}

export function getTicketCountLabel(t: AdminTranslate, count: number) {
  return t(count === 1 ? "admin.ticketsCountOne" : "admin.ticketsCountMany", {
    count,
  });
}

export function getMaintenanceCountLabel(t: AdminTranslate, count: number) {
  return t(
    count === 1 ? "admin.maintenanceCountOne" : "admin.maintenanceCountMany",
    { count }
  );
}

export function normalizePlannedMaintenanceItem(
  item: PlannedMaintenanceItem
): PlannedMaintenanceItem {
  const status = normalizeMaintenanceWorkflowStatus(item.status, item.isCompleted);

  return {
    ...item,
    note: item.note ?? null,
    cost: typeof item.cost === "number" ? item.cost : item.cost === null ? null : null,
    jiraIssueId: item.jiraIssueId ?? null,
    jiraIssueKey: item.jiraIssueKey ?? null,
    jiraIssueUrl: item.jiraIssueUrl ?? null,
    notificationRecipients: normalizePlannedMaintenanceRecipients(
      (item as PlannedMaintenanceItem & { notificationRecipients?: unknown })
        .notificationRecipients
    ),
    createdBy:
      item.createdBy && typeof item.createdBy === "object"
        ? {
            id: String(item.createdBy.id ?? ""),
            name:
              typeof item.createdBy.name === "string" || item.createdBy.name === null
                ? item.createdBy.name
                : null,
            email:
              typeof item.createdBy.email === "string" || item.createdBy.email === null
                ? item.createdBy.email
                : null,
          }
        : null,
    status,
    isCompleted: status === "completed",
    completedAt:
      status === "completed" ? item.completedAt ?? item.updatedAt ?? null : null,
  };
}

export function getMaintenanceWorkflowStatusLabel(
  t: AdminTranslate,
  status: MaintenanceStatus | MaintenanceWorkflowStatus
) {
  switch (status) {
    case "planned":
      return t("admin.maintenanceStatusPlanned");
    case "inProgress":
      return t("admin.maintenanceStatusInProgress");
    case "waitingForParts":
      return t("admin.maintenanceStatusWaitingForParts");
    case "completed":
      return t("admin.maintenanceStatusCompleted");
    case "cancelled":
      return t("admin.maintenanceStatusCancelled");
    case "overdue":
      return t("admin.overdueMaintenance");
    case "dueSoon":
      return t("admin.dueSoonMaintenance");
    case "upcoming":
      return t("admin.upcomingMaintenance");
  }
}

export function getActiveDatePreset(from: string, to: string): DatePreset {
  if (!from && !to) return "all";

  const last7 = getLastSevenDaysRange();
  if (from === last7.from && to === last7.to) return "last7";

  const thisMonth = getThisMonthRange();
  if (from === thisMonth.from && to === thisMonth.to) return "thisMonth";

  const lastMonth = getLastMonthRange();
  if (from === lastMonth.from && to === lastMonth.to) return "lastMonth";

  const last6Months = getLastSixMonthsRange();
  if (from === last6Months.from && to === last6Months.to) return "last6Months";

  return "";
}

export function createMachineCatalog(): MachineDirectoryItem[] {
  return Object.entries(DEPARTMENT_LINES).flatMap(([dep, lines]) =>
    lines.map((line) => ({
      category: dep,
      subcategory: line,
      machineKey: `${dep}::${line}`,
    }))
  );
}

export function createMachineDirectory(
  machineCatalog: MachineDirectoryItem[],
  assetDetailsByMachineKey: Record<string, EquipmentDetailsResponse>
) {
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
}

export function createMachineLabelByKey(machineDirectory: MachineDirectoryItem[]) {
  return Object.fromEntries(
    machineDirectory.map((machine) => [
      machine.machineKey,
      formatMachineDirectoryLabel(machine) || machine.machineKey,
    ])
  ) as Record<string, string>;
}

export function getMaintenanceDueLabel(
  dueDateRaw: string,
  t: AdminTranslate
) {
  const dueDayKey = dateOnlyToDayKey(getDateOnlyFromMaintenanceDateTime(dueDateRaw));
  if (dueDayKey === null) return dueDateRaw;

  const diffDays = dueDayKey - getCurrentLocalDayKey();

  if (diffDays < 0) return t("admin.daysOverdue", { count: Math.abs(diffDays) });
  if (diffDays === 0) return t("admin.dueToday");
  return t("admin.dueInDays", { count: diffDays });
}

export function getAdminAssetHref(machineKey: string) {
  return `/admin/assets/${encodeURIComponent(machineKey)}`;
}

export {
  DEPARTMENT_LINES,
  getCurrentLocalDateOnly,
  getDateOnlyFromMaintenanceDateTime,
  getIssueAssetParts,
  formatMaintenanceDateTimeInput,
  parseMaintenanceDateTime,
  parseDateOnly,
  parseMachineKey,
};

export type { PlannedMaintenanceRecipient };
