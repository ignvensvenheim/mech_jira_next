"use client";

import { getCurrentLocalDateOnly, getIssueAssetParts } from "../adminShared";
import {
  formatCurrency,
  type AdminTranslate,
  type DatePreset,
  type EquipmentDetailsResponse,
  type ManualCostEntry,
  type TicketFixDraft,
  type TicketFixCost,
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
  costsSubCategoryOptions: string[];
  costsActiveDatePreset: DatePreset;
  ticketsLoading: boolean;
  error: string | null | undefined;
  machineDataError: string;
  equipmentError: string;
  hasMachineSelection: boolean;
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
  ticketDrafts: Record<string, TicketFixDraft>;
  savingTicketKey: string | null;
  costsTotalPages: number;
  costsCurrentPage: number;
  costsPaginationItems: Array<number | string>;
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
  onSetTicketDraftField: (
    issueKey: string,
    field: keyof TicketFixDraft,
    value: string
  ) => void;
  onSaveTicketFixCost: (issueKey: string) => void;
  onSetCostsCurrentPage: (value: number | ((prev: number) => number)) => void;
};

export default function CostsSection({
  locale,
  t,
  costsCategory,
  costsSubCategory,
  costsDateFrom,
  costsDateTo,
  costsSubCategoryOptions,
  costsActiveDatePreset,
  ticketsLoading,
  error,
  machineDataError,
  equipmentError,
  hasMachineSelection,
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
  ticketDrafts,
  savingTicketKey,
  costsTotalPages,
  costsCurrentPage,
  costsPaginationItems,
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
  onSetTicketDraftField,
  onSaveTicketFixCost,
  onSetCostsCurrentPage,
}: CostsSectionProps) {
  return (
    <>
      <div className="admin-card">
        <h1 className="admin-title">{t("admin.timeAndCost")}</h1>
        <p className="admin-subtitle">{t("admin.timeAndCostSubtitle")}</p>

        <AdminFilters
          category={costsCategory}
          subCategory={costsSubCategory}
          dateFrom={costsDateFrom}
          dateTo={costsDateTo}
          subCategoryOptions={costsSubCategoryOptions}
          activeDatePreset={costsActiveDatePreset}
          resetDisabled={!costsCategory && !costsSubCategory && !costsDateFrom && !costsDateTo}
          onCategoryChange={(value) => {
            onCategoryChange(value);
            onSubCategoryChange("");
          }}
          onSubCategoryChange={onSubCategoryChange}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
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
                          onClick={() => onSetSelectedIssue(issue)}
                        >
                          <div className="admin-ticket-meta">
                            <div className="admin-ticket-key">{issue.key}</div>
                            <div className="admin-ticket-summary">{issue.summary}</div>
                          </div>
                        </button>
                        <input
                          type="date"
                          className="admin-input"
                          value={draft.date}
                          onChange={(event) =>
                            onSetTicketDraftField(issue.key, "date", event.target.value)
                          }
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="admin-input"
                          value={draft.amount}
                          onChange={(event) =>
                            onSetTicketDraftField(issue.key, "amount", event.target.value)
                          }
                          placeholder={t("admin.fixCostEur")}
                        />
                        <input
                          type="text"
                          className="admin-input"
                          value={draft.comment}
                          onChange={(event) =>
                            onSetTicketDraftField(issue.key, "comment", event.target.value)
                          }
                          placeholder={t("admin.fixCommentOptional")}
                        />
                        <button
                          type="button"
                          className="admin-reset-button"
                          onClick={() => onSaveTicketFixCost(issue.key)}
                          disabled={
                            savingTicketKey === issue.key ||
                            !issueMachineKey ||
                            !draft.date ||
                            (draft.amount.trim() !== "" && Number(draft.amount) < 0)
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
