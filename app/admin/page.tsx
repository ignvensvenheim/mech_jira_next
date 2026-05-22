"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Modal from "react-modal";
import { useI18n } from "@/components/I18nProvider";
import { useJiraSearch } from "@/hooks/useJiraSearch";
import { useIssues } from "@/lib/IssuesContext";
import AdminTicketModal from "./components/AdminTicketModal/AdminTicketModal";
import CostsSection from "./components/CostsSection";
import InventorySection from "./components/InventorySection";
import MaintenanceSection from "./components/MaintenanceSection";
import StatisticsSection from "./components/StatisticsSection";
import UsersManager from "./users/users-manager";
import {
  formatDisplayDate,
  getDateRangeBounds,
  getCurrentLocalDateOnly,
  getIssueCategoryAndSubcategory,
  getLocaleTag,
  getMaintenanceItemStatus,
  getRepairCostTotalsByMachine,
  parseMachineKey,
  summarizeIssuesByAsset,
  type AssetStatisticsRow,
  type MaintenanceLogEntry,
  type MaintenanceStatus,
} from "./adminShared";
import { useAdminAssetData } from "./hooks/useAdminAssetData";
import { useAdminFilters } from "./hooks/useAdminFilters";
import { useAdminMaintenance } from "./hooks/useAdminMaintenance";
import { useAdminSession } from "./hooks/useAdminSession";
import type { NormalizedIssue } from "@/lib/jira";

Modal.setAppElement("body");

function AdminPageContent() {
  const { locale, t } = useI18n();
  const ticketsPerPage = 20;
  const searchParams = useSearchParams();
  const { loadingInitial, fetchingAllTickets, error } = useJiraSearch();
  const { issues } = useIssues();
  const [selectedIssue, setSelectedIssue] = useState<NormalizedIssue | null>(null);

  const {
    currentUserId,
    currentUserIsAdmin,
    currentUserCanManageUsers,
    sessionResolved,
    activeFunction,
    setActiveFunction,
  } = useAdminSession(searchParams);

  const {
    costsCategory,
    setCostsCategory,
    costsSubCategory,
    setCostsSubCategory,
    statisticsCategory,
    setStatisticsCategory,
    statisticsSubCategory,
    setStatisticsSubCategory,
    costsDateFrom,
    setCostsDateFrom,
    costsDateTo,
    setCostsDateTo,
    statisticsDateFrom,
    setStatisticsDateFrom,
    statisticsDateTo,
    setStatisticsDateTo,
    viewCategory,
    viewSubCategory,
    viewDateFrom,
    viewDateTo,
    costsActiveDatePreset,
    statisticsActiveDatePreset,
    costsCurrentPage,
    setCostsCurrentPage,
    resetCostsFilters,
    resetStatisticsFilters,
    applyLastSevenDays,
    applyAllTickets,
    applyThisMonth,
    applyLastMonth,
    applyLastSixMonths,
  } = useAdminFilters(activeFunction);

  const ticketsLoading = loadingInitial || fetchingAllTickets;
  const allIssues = useMemo(() => (issues ?? []) as NormalizedIssue[], [issues]);
  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      const { category: depPartRaw, subcategory: linePartRaw } =
        getIssueCategoryAndSubcategory(issue);
      const depPart = depPartRaw.toLowerCase();
      const linePart = linePartRaw.toLowerCase();
      const dep = viewCategory.toLowerCase();
      const line = viewSubCategory.toLowerCase();
      const matchCategory = !viewCategory || depPart === dep;
      const matchSub = !viewSubCategory || linePart === line;
      const created = new Date(issue.created).getTime();
      const { fromTime, toTime } = getDateRangeBounds(viewDateFrom, viewDateTo);
      const matchDate = created >= fromTime && created <= toTime;

      return matchCategory && matchSub && matchDate;
    });
  }, [allIssues, viewCategory, viewDateFrom, viewDateTo, viewSubCategory]);

  const assetData = useAdminAssetData({
    sessionResolved,
    currentUserIsAdmin,
    costsCategory,
    costsSubCategory,
    filteredIssues,
    ticketsLoading,
    t,
  });

  const {
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
  } = assetData;

  const statisticsSubCategoryOptions = useMemo(
    () =>
      statisticsCategory
        ? machineCatalog
            .filter((item) => item.category === statisticsCategory)
            .map((item) => item.subcategory)
        : [],
    [machineCatalog, statisticsCategory]
  );

  const maintenance = useAdminMaintenance({
    sessionResolved,
    currentUserIsAdmin,
    locale,
    t,
    machineLabelByKey,
    upsertAssetDetailsCache,
  });

  const {
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
    updatePlannedMaintenanceState,
    deletePlannedMaintenance,
  } = maintenance;

  const statisticsTimeframeLabel = useMemo(() => {
    if (!statisticsDateFrom && !statisticsDateTo) return t("admin.timeframeAll");
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
      return t("admin.timeframeFrom", { from: formatDisplayDate(statisticsDateFrom) });
    }
    return t("admin.timeframeUntil", { to: formatDisplayDate(statisticsDateTo) });
  }, [statisticsActiveDatePreset, statisticsDateFrom, statisticsDateTo, t]);

  const selectedTicketFixMoney = filteredIssues.reduce((sum, issue) => {
    const cost = ticketCostsByIssue[issue.key];
    return sum + (cost?.amount ?? 0);
  }, 0);
  const statisticsTotalTimeSeconds = useMemo(
    () => filteredIssues.reduce((sum, issue) => sum + (issue.timeSpentSeconds ?? 0), 0),
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
    const counts = new Map<string, number>();
    for (const item of plannedMaintenanceItems) {
      counts.set(item.machineKey, (counts.get(item.machineKey) ?? 0) + 1);
    }
    return counts;
  }, [plannedMaintenanceItems]);
  const statisticsMaintenanceCost = useMemo(
    () => Array.from(maintenanceCostsByMachineKey.values()).reduce((sum, cost) => sum + cost, 0),
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
      ...maintenanceCountByMachineKey.keys(),
      ...maintenanceCostsByMachineKey.keys(),
    ]);

    return Array.from(machineKeys).map((machineKey) => {
      const row = statisticsIssueAssetSummary.byMachine.get(machineKey);
      const asset = assetDetailsByMachineKey[machineKey];
      const parsed = parseMachineKey(machineKey);
      const category = asset?.category || row?.category || parsed.category || t("common.unknown");
      const subcategory =
        asset?.subcategory || row?.subcategory || parsed.subcategory || t("common.unknown");

      return {
        key: machineKey,
        label: `${category} / ${subcategory}`,
        category,
        subcategory,
        breakdowns: row?.breakdowns ?? 0,
        maintenanceCount: maintenanceCountByMachineKey.get(machineKey) ?? 0,
        loggedSeconds: row?.loggedSeconds ?? 0,
        repairCost: repairCostByMachineKey.get(machineKey) ?? 0,
        maintenanceCost: maintenanceCostsByMachineKey.get(machineKey) ?? 0,
      };
    });
  }, [
    assetDetailsByMachineKey,
    maintenanceCountByMachineKey,
    maintenanceCostsByMachineKey,
    repairCostByMachineKey,
    statisticsIssueAssetSummary.byMachine,
    t,
  ]);
  const statisticsUnmappedTicketCount = statisticsIssueAssetSummary.unmappedTickets;
  const ticketsByCategory = useMemo(() => {
    const rows = machineCatalog.reduce<Record<string, { name: string; tickets: number; seconds: number }>>(
      (acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { name: item.category, tickets: 0, seconds: 0 };
        }
        return acc;
      },
      {}
    );
    const byCategory = new Map(Object.values(rows).map((row) => [row.name, row]));

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
  }, [assetStatistics, machineCatalog, statisticsUnmappedTicketCount, t]);
  const maxCategoryTickets = useMemo(
    () => Math.max(...ticketsByCategory.map((item) => item.tickets), 1),
    [ticketsByCategory]
  );
  const machinesByBreakdowns = useMemo(
    () => [...assetStatistics].sort((a, b) => b.breakdowns - a.breakdowns).slice(0, 10),
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
  const topTicketsByTime = useMemo(
    () => [...filteredIssues].sort((a, b) => (b.timeSpentSeconds ?? 0) - (a.timeSpentSeconds ?? 0)).slice(0, 5),
    [filteredIssues]
  );
  const costsTotalPages = Math.max(1, Math.ceil(filteredIssues.length / ticketsPerPage));
  const costsPaginationItems = useMemo<Array<number | string>>(() => {
    if (costsTotalPages <= 6) return Array.from({ length: costsTotalPages }, (_, i) => i + 1);
    return [1, 2, 3, 4, 5, "ellipsis", costsTotalPages];
  }, [costsTotalPages]);
  const paginatedCostsIssues = useMemo(() => {
    const start = (costsCurrentPage - 1) * ticketsPerPage;
    return filteredIssues.slice(start, start + ticketsPerPage);
  }, [costsCurrentPage, filteredIssues]);

  useEffect(() => {
    if (costsCurrentPage > costsTotalPages) {
      setCostsCurrentPage(costsTotalPages);
    }
  }, [costsCurrentPage, costsTotalPages, setCostsCurrentPage]);

  const handleModalDataChanged = () => {
    void loadMachineData();
    void loadEquipmentData();
    void loadInventoryData();
    void loadPlannedMaintenance();
    refreshTicketCosts();
  };

  return (
    <>
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
            <a href="/" className="page__action-link">
              {t("common.backToHome")}
            </a>
          </div>
        </div>
      )}

      {sessionResolved && currentUserIsAdmin && (
        <div className="admin-dashboard">
              {activeFunction === "costs" && (
                <CostsSection
                  locale={locale}
                  t={t}
                  costsCategory={costsCategory}
                  costsSubCategory={costsSubCategory}
                  costsDateFrom={costsDateFrom}
                  costsDateTo={costsDateTo}
                  costsSubCategoryOptions={costsSubCategoryOptions}
                  costsActiveDatePreset={costsActiveDatePreset}
                  ticketsLoading={ticketsLoading}
                  error={error}
                  machineDataError={machineDataError}
                  equipmentError={equipmentError}
                  hasMachineSelection={hasMachineSelection}
                  selectedMachineKey={selectedMachineKey}
                  equipmentLoading={equipmentLoading}
                  equipmentModel={equipmentModel}
                  equipmentSerialNumber={equipmentSerialNumber}
                  equipmentManufacturer={equipmentManufacturer}
                  equipmentSaving={equipmentSaving}
                  machineDataLoading={machineDataLoading}
                  entryDate={entryDate}
                  entryAmount={entryAmount}
                  entryComment={entryComment}
                  manualEntries={manualEntries}
                  selectedMachineManualMoney={selectedMachineManualMoney}
                  editingEntryId={editingEntryId}
                  editDate={editDate}
                  editAmount={editAmount}
                  editComment={editComment}
                  ticketCostsLoading={ticketCostsLoading}
                  filteredIssues={filteredIssues}
                  paginatedCostsIssues={paginatedCostsIssues}
                  ticketDrafts={ticketDrafts}
                  savingTicketKey={savingTicketKey}
                  costsTotalPages={costsTotalPages}
                  costsCurrentPage={costsCurrentPage}
                  costsPaginationItems={costsPaginationItems}
                  onCategoryChange={setCostsCategory}
                  onSubCategoryChange={setCostsSubCategory}
                  onDateFromChange={setCostsDateFrom}
                  onDateToChange={setCostsDateTo}
                  onApplyAllTickets={applyAllTickets}
                  onApplyLastSevenDays={applyLastSevenDays}
                  onApplyThisMonth={applyThisMonth}
                  onApplyLastMonth={applyLastMonth}
                  onApplyLastSixMonths={applyLastSixMonths}
                  onResetFilters={resetCostsFilters}
                  onEquipmentModelChange={setEquipmentModel}
                  onEquipmentSerialNumberChange={setEquipmentSerialNumber}
                  onEquipmentManufacturerChange={setEquipmentManufacturer}
                  onSaveEquipmentDetails={() => void saveEquipmentDetails()}
                  onEntryDateChange={setEntryDate}
                  onEntryAmountChange={setEntryAmount}
                  onEntryCommentChange={setEntryComment}
                  onAddManualCostEntry={() => void addManualCostEntry()}
                  onEditDateChange={setEditDate}
                  onEditAmountChange={setEditAmount}
                  onEditCommentChange={setEditComment}
                  onSaveEditManualCostEntry={() => void saveEditManualCostEntry()}
                  onCancelEditManualCostEntry={cancelEditManualCostEntry}
                  onStartEditManualCostEntry={startEditManualCostEntry}
                  onDeleteManualCostEntry={(entryId) => void deleteManualCostEntry(entryId)}
                  onSetSelectedIssue={setSelectedIssue}
                  onSetTicketDraftField={setTicketDraftField}
                  onSaveTicketFixCost={(issueKey) => void saveTicketFixCost(issueKey)}
                  onSetCostsCurrentPage={setCostsCurrentPage}
                />
              )}

              {activeFunction === "inventory" && (
                <InventorySection
                  t={t}
                  inventoryQuery={inventoryQuery}
                  inventoryLoading={inventoryLoading}
                  inventoryError={inventoryError}
                  filteredMachineDirectory={filteredMachineDirectory}
                  inventoryDrafts={inventoryDrafts}
                  inventorySavingKey={inventorySavingKey}
                  onInventoryQueryChange={setInventoryQuery}
                  onRefreshInventory={() => void loadInventoryData()}
                  onSetInventoryDraftField={setInventoryDraftField}
                  onSaveInventoryMachine={(machineKey) => void saveInventoryMachine(machineKey)}
                />
              )}

              {activeFunction === "maintenance" && (
                <MaintenanceSection
                  locale={locale}
                  t={t}
                  plannedMaintenanceError={plannedMaintenanceError}
                  plannedMaintenanceLoading={plannedMaintenanceLoading}
                  plannedMaintenanceSaving={plannedMaintenanceSaving}
                  maintenanceCalendarLabel={maintenanceCalendarLabel}
                  maintenanceCalendarMonthItemCount={maintenanceCalendarMonthItemCount}
                  maintenanceWeekdayLabels={maintenanceWeekdayLabels}
                  maintenanceCalendarDays={maintenanceCalendarDays}
                  selectedMaintenanceDate={selectedMaintenanceDate}
                  maintenanceLogEntries={maintenanceLogEntries}
                  editingMaintenanceId={editingMaintenanceId}
                  isMaintenanceModalOpen={isMaintenanceModalOpen}
                  isMaintenanceEditing={isMaintenanceEditing}
                  activeMaintenanceItem={activeMaintenanceItem}
                  activeMaintenanceStatus={activeMaintenanceStatus}
                  machineDirectory={machineDirectory}
                  machineLabelByKey={machineLabelByKey}
                  maintenanceMachineKey={maintenanceMachineKey}
                  maintenanceTitle={maintenanceTitle}
                  maintenanceDueDate={maintenanceDueDate}
                  maintenanceCost={maintenanceCost}
                  maintenanceNote={maintenanceNote}
                  selectedMaintenanceDateLabel={selectedMaintenanceDateLabel}
                  maintenanceActionKey={maintenanceActionKey}
                  onPreviousMonth={() =>
                    setMaintenanceCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  onThisMonth={() => {
                    const today = new Date();
                    selectMaintenanceDate(getCurrentLocalDateOnly());
                    setMaintenanceCalendarMonth(
                      new Date(today.getFullYear(), today.getMonth(), 1)
                    );
                  }}
                  onNextMonth={() =>
                    setMaintenanceCalendarMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  onOpenCreateMaintenanceModal={openCreateMaintenanceModal}
                  onOpenEditMaintenanceModal={openEditMaintenanceModal}
                  onCloseMaintenanceModal={closeMaintenanceModal}
                  onMaintenanceMachineKeyChange={setMaintenanceMachineKey}
                  onMaintenanceTitleChange={setMaintenanceTitle}
                  onMaintenanceDueDateChange={setMaintenanceDueDate}
                  onMaintenanceCostChange={setMaintenanceCost}
                  onMaintenanceNoteChange={setMaintenanceNote}
                  onSavePlannedMaintenance={() => void savePlannedMaintenance()}
                  onUpdatePlannedMaintenanceState={(id, isCompleted) =>
                    void updatePlannedMaintenanceState(id, isCompleted)
                  }
                  onDeletePlannedMaintenance={(id) => void deletePlannedMaintenance(id)}
                />
              )}

              {activeFunction === "statistics" && (
                <StatisticsSection
                  locale={locale}
                  t={t}
                  statisticsTimeframeLabel={statisticsTimeframeLabel}
                  statisticsCategory={statisticsCategory}
                  statisticsSubCategory={statisticsSubCategory}
                  statisticsDateFrom={statisticsDateFrom}
                  statisticsDateTo={statisticsDateTo}
                  statisticsSubCategoryOptions={statisticsSubCategoryOptions}
                  statisticsActiveDatePreset={statisticsActiveDatePreset}
                  filteredIssues={filteredIssues}
                  statisticsTotalTimeSeconds={statisticsTotalTimeSeconds}
                  statisticsTrackedCost={statisticsTrackedCost}
                  plannedMaintenanceItemsLength={plannedMaintenanceItems.length}
                  statisticsMaintenanceActiveCount={statisticsMaintenanceActiveCount}
                  statisticsMaintenanceCompletedCount={statisticsMaintenanceCompletedCount}
                  statisticsMaintenanceCost={statisticsMaintenanceCost}
                  ticketsByCategory={ticketsByCategory}
                  maxCategoryTickets={maxCategoryTickets}
                  machinesByBreakdowns={machinesByBreakdowns}
                  maxMachineBreakdowns={maxMachineBreakdowns}
                  machinesByRepairCost={machinesByRepairCost}
                  maxMachineRepairCost={maxMachineRepairCost}
                  machinesByMaintenanceCost={machinesByMaintenanceCost}
                  maxMachineMaintenanceCost={maxMachineMaintenanceCost}
                  topTicketsByTime={topTicketsByTime}
                  ticketCostsByIssue={ticketCostsByIssue}
                  onCategoryChange={setStatisticsCategory}
                  onSubCategoryChange={setStatisticsSubCategory}
                  onDateFromChange={setStatisticsDateFrom}
                  onDateToChange={setStatisticsDateTo}
                  onApplyAllTickets={applyAllTickets}
                  onApplyLastSevenDays={applyLastSevenDays}
                  onApplyThisMonth={applyThisMonth}
                  onApplyLastMonth={applyLastMonth}
                  onApplyLastSixMonths={applyLastSixMonths}
                  onResetFilters={resetStatisticsFilters}
                  onSetSelectedIssue={setSelectedIssue}
                />
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
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  );
}
