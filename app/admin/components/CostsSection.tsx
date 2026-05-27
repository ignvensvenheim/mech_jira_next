"use client";

import Link from "next/link";
import { TicketCard } from "@/components/TicketCard/TicketCard";
import {
  formatCurrency,
  getAdminAssetHref,
  type AdminTranslate,
  type DatePreset,
  type ManualCostEntry,
} from "../adminShared";
import type { NormalizedIssue } from "@/lib/jira";
import AdminFilters from "./AdminFilters";

type CostsSectionProps = {
  locale: string;
  t: AdminTranslate;
  costsCategory: string;
  costsSubCategory: string;
  costsDateFrom: string;
  costsDateTo: string;
  costsSearchText: string;
  costsSubCategoryOptions: string[];
  costsActiveDatePreset: DatePreset;
  ticketsLoading: boolean;
  error: string | null | undefined;
  machineDataError: string;
  equipmentError: string;
  hasMachineSelection: boolean;
  selectedMachineKey: string;
  equipmentLoading: boolean;
  equipmentModel: string;
  equipmentSerialNumber: string;
  equipmentManufacturer: string;
  equipmentSaving: boolean;
  machineDataLoading: boolean;
  entryDate: string;
  entryAmount: string;
  entryComment: string;
  manualEntries: ManualCostEntry[];
  selectedMachineManualMoney: number;
  editingEntryId: string | null;
  editDate: string;
  editAmount: string;
  editComment: string;
  ticketCostsLoading: boolean;
  filteredIssues: NormalizedIssue[];
  paginatedCostsIssues: NormalizedIssue[];
  costsTotalPages: number;
  costsCurrentPage: number;
  costsPaginationItems: Array<number | string>;
  onCategoryChange: (value: string) => void;
  onSubCategoryChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onApplyAllTickets: () => void;
  onApplyLastSevenDays: () => void;
  onApplyThisMonth: () => void;
  onApplyLastMonth: () => void;
  onApplyLastSixMonths: () => void;
  onResetFilters: () => void;
  onEquipmentModelChange: (value: string) => void;
  onEquipmentSerialNumberChange: (value: string) => void;
  onEquipmentManufacturerChange: (value: string) => void;
  onSaveEquipmentDetails: () => void;
  onEntryDateChange: (value: string) => void;
  onEntryAmountChange: (value: string) => void;
  onEntryCommentChange: (value: string) => void;
  onAddManualCostEntry: () => void;
  onEditDateChange: (value: string) => void;
  onEditAmountChange: (value: string) => void;
  onEditCommentChange: (value: string) => void;
  onSaveEditManualCostEntry: () => void;
  onCancelEditManualCostEntry: () => void;
  onStartEditManualCostEntry: (entry: ManualCostEntry) => void;
  onDeleteManualCostEntry: (entryId: string) => void;
  onSetSelectedIssue: (issue: NormalizedIssue) => void;
  onSetCostsCurrentPage: (value: number | ((prev: number) => number)) => void;
};

export default function CostsSection({
  locale,
  t,
  costsCategory,
  costsSubCategory,
  costsDateFrom,
  costsDateTo,
  costsSearchText,
  costsSubCategoryOptions,
  costsActiveDatePreset,
  ticketsLoading,
  error,
  machineDataError,
  equipmentError,
  hasMachineSelection,
  selectedMachineKey,
  equipmentLoading,
  equipmentModel,
  equipmentSerialNumber,
  equipmentManufacturer,
  equipmentSaving,
  machineDataLoading,
  entryDate,
  entryAmount,
  entryComment,
  manualEntries,
  selectedMachineManualMoney,
  editingEntryId,
  editDate,
  editAmount,
  editComment,
  ticketCostsLoading,
  filteredIssues,
  paginatedCostsIssues,
  costsTotalPages,
  costsCurrentPage,
  costsPaginationItems,
  onCategoryChange,
  onSubCategoryChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onApplyAllTickets,
  onApplyLastSevenDays,
  onApplyThisMonth,
  onApplyLastMonth,
  onApplyLastSixMonths,
  onResetFilters,
  onEquipmentModelChange,
  onEquipmentSerialNumberChange,
  onEquipmentManufacturerChange,
  onSaveEquipmentDetails,
  onEntryDateChange,
  onEntryAmountChange,
  onEntryCommentChange,
  onAddManualCostEntry,
  onEditDateChange,
  onEditAmountChange,
  onEditCommentChange,
  onSaveEditManualCostEntry,
  onCancelEditManualCostEntry,
  onStartEditManualCostEntry,
  onDeleteManualCostEntry,
  onSetSelectedIssue,
  onSetCostsCurrentPage,
}: CostsSectionProps) {
  return (
    <>
      <div className="admin-card">
        <h1 className="admin-title">{t("admin.timeAndCost")}</h1>
        <p className="admin-subtitle">{t("admin.timeAndCostSubtitle")}</p>

        <AdminFilters
          className="admin-filters--costs"
          category={costsCategory}
          subCategory={costsSubCategory}
          dateFrom={costsDateFrom}
          dateTo={costsDateTo}
          searchText={costsSearchText}
          subCategoryOptions={costsSubCategoryOptions}
          activeDatePreset={costsActiveDatePreset}
          resetDisabled={
            !costsCategory &&
            !costsSubCategory &&
            !costsDateFrom &&
            !costsDateTo &&
            !costsSearchText.trim()
          }
          onCategoryChange={(value) => {
            onCategoryChange(value);
            onSubCategoryChange("");
          }}
          onSubCategoryChange={onSubCategoryChange}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
          onSearchChange={onSearchChange}
          onApplyAllTickets={onApplyAllTickets}
          onApplyLastSevenDays={onApplyLastSevenDays}
          onApplyThisMonth={onApplyThisMonth}
          onApplyLastMonth={onApplyLastMonth}
          onApplyLastSixMonths={onApplyLastSixMonths}
          onResetFilters={onResetFilters}
          t={t}
        />

        {error && !ticketsLoading && <div className="page__error">{String(error)}</div>}
        {ticketsLoading && <div className="page__loading">{t("common.loading")}</div>}
        {hasMachineSelection && (
          <div className="page__content-actions">
            <Link href={getAdminAssetHref(selectedMachineKey)} className="page__action-link">
              {t("admin.openAssetDetails")}
            </Link>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-chart">
          {machineDataError && <div className="page__error">{machineDataError}</div>}
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
                  onChange={(event) => onEquipmentModelChange(event.target.value)}
                  placeholder={t("admin.model")}
                />
                <input
                  type="text"
                  className="admin-input"
                  value={equipmentSerialNumber}
                  onChange={(event) => onEquipmentSerialNumberChange(event.target.value)}
                  placeholder={t("admin.serialNumber")}
                />
                <input
                  type="text"
                  className="admin-input"
                  value={equipmentManufacturer}
                  onChange={(event) => onEquipmentManufacturerChange(event.target.value)}
                  placeholder={t("admin.manufacturer")}
                />
                <button
                  type="button"
                  className="admin-reset-button"
                  onClick={onSaveEquipmentDetails}
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
                  onChange={(event) => onEntryDateChange(event.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="admin-input"
                  value={entryAmount}
                  onChange={(event) => onEntryAmountChange(event.target.value)}
                  placeholder={t("admin.amountEur")}
                />
                <input
                  type="text"
                  className="admin-input"
                  value={entryComment}
                  onChange={(event) => onEntryCommentChange(event.target.value)}
                  placeholder={t("admin.commentPlaceholder")}
                />
                <button
                  type="button"
                  className="admin-reset-button"
                  onClick={onAddManualCostEntry}
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
                <div className="admin-chart-empty">{t("admin.noManualEntriesYet")}</div>
              )}

              {manualEntries.map((entry) => (
                <div key={entry.id} className="admin-manual-row">
                  {editingEntryId === entry.id ? (
                    <>
                      <input
                        type="date"
                        className="admin-input"
                        value={editDate}
                        onChange={(event) => onEditDateChange(event.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-input"
                        value={editAmount}
                        onChange={(event) => onEditAmountChange(event.target.value)}
                      />
                      <input
                        type="text"
                        className="admin-input"
                        value={editComment}
                        onChange={(event) => onEditCommentChange(event.target.value)}
                      />
                      <div className="admin-manual-actions">
                        <button
                          type="button"
                          className="admin-reset-button"
                          onClick={onSaveEditManualCostEntry}
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
                          onClick={onCancelEditManualCostEntry}
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
                          onClick={() => onStartEditManualCostEntry(entry)}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          className="admin-reset-button"
                          onClick={() => onDeleteManualCostEntry(entry.id)}
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
              {(ticketsLoading || ticketCostsLoading) && (
                <div className="admin-buffering">
                  <div className="admin-buffering-spinner" />
                  <div className="admin-chart-empty">{t("admin.loadingTickets")}</div>
                </div>
              )}
              {!ticketsLoading && !ticketCostsLoading && (
                <>
                  <div className="admin-chart-title">
                    {t("admin.ticketsInPeriod", { count: filteredIssues.length })}
                  </div>
                  {filteredIssues.length === 0 && (
                    <div className="admin-chart-empty">{t("admin.noTicketsForFilters")}</div>
                  )}
                  {paginatedCostsIssues.length > 0 && (
                    <div className="admin-costs-ticket-list">
                      {paginatedCostsIssues.map((issue) => (
                        <TicketCard
                          key={issue.id}
                          issue={issue}
                          onOpen={onSetSelectedIssue}
                          view="list"
                        />
                      ))}
                    </div>
                  )}
                  {costsTotalPages > 1 && (
                    <div className="page__pagination">
                      <button
                        type="button"
                        className="page__pagination-button"
                        onClick={() =>
                          onSetCostsCurrentPage((prev) => Math.max(1, prev - 1))
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
                              onClick={() => onSetCostsCurrentPage(item)}
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
                          onSetCostsCurrentPage((prev) => Math.min(costsTotalPages, prev + 1))
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
  );
}
