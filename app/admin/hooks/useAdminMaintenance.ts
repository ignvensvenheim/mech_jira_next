"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrentLocalDateOnly,
  getLocaleTag,
  getMaintenanceItemStatus,
  getMaintenanceWorkflowStatusLabel,
  isMaintenanceClosedStatus,
  normalizePlannedMaintenanceItem,
  parseDateOnly,
  parseJson,
  sortPlannedMaintenanceItems,
  toDateOnlyFromParts,
  type AdminTranslate,
  type EquipmentDetailsResponse,
  type MaintenanceLogEntry,
  type MaintenanceStatus,
  type MaintenanceWorkflowStatus,
  type PlannedMaintenanceRecipient,
  type PlannedMaintenanceItem,
} from "../adminShared";

type UseAdminMaintenanceArgs = {
  sessionResolved: boolean;
  currentUserIsAdmin: boolean;
  locale: string;
  t: AdminTranslate;
  machineLabelByKey: Record<string, string>;
  upsertAssetDetailsCache: (
    machineKey: string,
    next?: Partial<EquipmentDetailsResponse>
  ) => void;
};

export function useAdminMaintenance({
  sessionResolved,
  currentUserIsAdmin,
  locale,
  t,
  machineLabelByKey,
  upsertAssetDetailsCache,
}: UseAdminMaintenanceArgs) {
  const [plannedMaintenanceItems, setPlannedMaintenanceItems] = useState<
    PlannedMaintenanceItem[]
  >([]);
  const [plannedMaintenanceLoading, setPlannedMaintenanceLoading] = useState(false);
  const [plannedMaintenanceError, setPlannedMaintenanceError] = useState("");
  const [plannedMaintenanceSaving, setPlannedMaintenanceSaving] = useState(false);
  const [maintenanceActionKey, setMaintenanceActionKey] = useState<string | null>(null);
  const [selectedMaintenanceDate, setSelectedMaintenanceDate] = useState(
    getCurrentLocalDateOnly()
  );
  const [editingMaintenanceId, setEditingMaintenanceId] = useState<string | null>(null);
  const [maintenanceMachineKey, setMaintenanceMachineKey] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDueDate, setMaintenanceDueDate] = useState(getCurrentLocalDateOnly());
  const [maintenanceCost, setMaintenanceCost] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [maintenanceNotificationRecipients, setMaintenanceNotificationRecipients] = useState<
    PlannedMaintenanceRecipient[]
  >([]);
  const [maintenanceStatus, setMaintenanceStatus] =
    useState<MaintenanceWorkflowStatus>("planned");
  const [maintenanceCalendarMonth, setMaintenanceCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);

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
      const res = await fetch("/api/admin/planned-maintenance", { cache: "no-store" });
      const data = await parseJson<{ items: PlannedMaintenanceItem[] }>(res);
      setPlannedMaintenanceItems(
        sortPlannedMaintenanceItems((data.items ?? []).map(normalizePlannedMaintenanceItem))
      );
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
      setPlannedMaintenanceItems([]);
    } finally {
      setPlannedMaintenanceLoading(false);
    }
  }, [currentUserIsAdmin, sessionResolved]);

  useEffect(() => {
    void loadPlannedMaintenance();
  }, [loadPlannedMaintenance]);

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
      setMaintenanceNotificationRecipients([]);
      setMaintenanceStatus("planned");
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
      setMaintenanceCost(item.cost == null ? "" : String(item.cost));
      setMaintenanceNote(item.note ?? "");
      setMaintenanceNotificationRecipients(item.notificationRecipients ?? []);
      setMaintenanceStatus(item.status);
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
    setMaintenanceNotificationRecipients([]);
    setMaintenanceStatus("planned");
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

  const savePlannedMaintenance = async () => {
    if (!maintenanceMachineKey || !maintenanceTitle.trim() || !maintenanceDueDate) return;
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
            notificationRecipients: maintenanceNotificationRecipients,
            status: maintenanceStatus,
          }),
        }
      );
      const payload = await parseJson<
        PlannedMaintenanceItem & { notificationWarning?: string }
      >(res);
      const saved = normalizePlannedMaintenanceItem(payload);
      if (payload.notificationWarning) {
        setPlannedMaintenanceError(payload.notificationWarning);
      }
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
      setMaintenanceCost(saved.cost == null ? "" : String(saved.cost));
      setMaintenanceNote("");
      setMaintenanceNotificationRecipients([]);
      setMaintenanceStatus("planned");
      syncMaintenanceCalendarToDate(saved.dueDate);
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    } finally {
      setPlannedMaintenanceSaving(false);
    }
  };

  const updatePlannedMaintenanceStatus = async (
    id: string,
    status: MaintenanceWorkflowStatus
  ) => {
    setMaintenanceActionKey(`${id}:${status}`);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch(`/api/admin/planned-maintenance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await parseJson<
        PlannedMaintenanceItem & { notificationWarning?: string }
      >(res);
      const saved = normalizePlannedMaintenanceItem(payload);
      if (payload.notificationWarning) {
        setPlannedMaintenanceError(payload.notificationWarning);
      }
      setPlannedMaintenanceItems((prev) =>
        sortPlannedMaintenanceItems(prev.map((item) => (item.id === id ? saved : item)))
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
      const res = await fetch(`/api/admin/planned-maintenance/${id}`, { method: "DELETE" });
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

  const sendPlannedMaintenanceReminder = async (id: string) => {
    setMaintenanceActionKey(`${id}:reminder`);
    setPlannedMaintenanceError("");
    try {
      const res = await fetch(`/api/admin/planned-maintenance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendReminder" }),
      });
      const payload = await parseJson<
        PlannedMaintenanceItem & { notificationWarning?: string }
      >(res);
      if (payload.notificationWarning) {
        setPlannedMaintenanceError(payload.notificationWarning);
      }
    } catch (e: unknown) {
      setPlannedMaintenanceError(String((e as Error).message || e));
    } finally {
      setMaintenanceActionKey(null);
    }
  };

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
        isToday: dateKey === getCurrentLocalDateOnly(),
        isPlaceholder: false,
        items,
      };
    });

    const trailingPlaceholderCount =
      (7 - ((leadingPlaceholders.length + monthDays.length) % 7)) % 7;
    const trailingPlaceholders = Array.from({ length: trailingPlaceholderCount }, (_, index) => ({
      dateKey: `placeholder-end-${index}`,
      dayNumber: null,
      isCurrentMonth: false,
      isToday: false,
      isPlaceholder: true,
      items: [],
    }));

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

        if (item.status === "completed" && item.completedAt && !Number.isNaN(completedTime)) {
          return {
            id: `${item.id}:completed`,
            category: machineLabel,
            change: t("admin.changeCompleted"),
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
          const changeLabel = isMaintenanceClosedStatus(item.status)
            ? getMaintenanceWorkflowStatusLabel(t, item.status)
            : t("admin.changeUpdated");
          return {
            id: `${item.id}:updated`,
            category: machineLabel,
            change: changeLabel,
            title: item.title,
            timestamp: item.updatedAt,
            kind: "updated" as const,
          };
        }

        return {
          id: `${item.id}:created`,
          category: machineLabel,
          change: t("admin.changeCreated"),
          title: item.title,
          timestamp: item.createdAt,
          kind: "created" as const,
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
  }, [machineLabelByKey, plannedMaintenanceItems, t]);

  return {
    plannedMaintenanceItems,
    plannedMaintenanceLoading,
    plannedMaintenanceError,
    plannedMaintenanceSaving,
    maintenanceActionKey,
    selectedMaintenanceDate,
    editingMaintenanceId,
    maintenanceMachineKey,
    setMaintenanceMachineKey,
    maintenanceTitle,
    setMaintenanceTitle,
    maintenanceDueDate,
    setMaintenanceDueDate,
    maintenanceCost,
    setMaintenanceCost,
    maintenanceNote,
    setMaintenanceNote,
    maintenanceNotificationRecipients,
    setMaintenanceNotificationRecipients,
    maintenanceStatus,
    setMaintenanceStatus,
    maintenanceCalendarMonth,
    setMaintenanceCalendarMonth,
    isMaintenanceModalOpen,
    loadPlannedMaintenance,
    maintenanceBadgeCount,
    maintenanceCalendarLabel,
    maintenanceWeekdayLabels,
    maintenanceCalendarDays,
    maintenanceCalendarMonthItemCount,
    selectedMaintenanceDateLabel,
    isMaintenanceEditing,
    activeMaintenanceItem,
    activeMaintenanceStatus,
    maintenanceLogEntries,
    openCreateMaintenanceModal,
    openEditMaintenanceModal,
    closeMaintenanceModal,
    selectMaintenanceDate,
    savePlannedMaintenance,
    updatePlannedMaintenanceStatus,
    sendPlannedMaintenanceReminder,
    deletePlannedMaintenance,
  };
}
