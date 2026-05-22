"use client";

import Modal from "react-modal";
import {
  formatCurrency,
  formatDateTimeForLocale,
  getCurrentLocalDateOnly,
  getMaintenanceDueLabel,
  getMaintenanceItemStatus,
  type AdminTranslate,
  type MaintenanceLogEntry,
  type MaintenanceStatus,
  type MachineDirectoryItem,
  type PlannedMaintenanceItem,
} from "../adminShared";

type MaintenanceCalendarDay = {
  dateKey: string;
  dayNumber: number | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPlaceholder: boolean;
  items: PlannedMaintenanceItem[];
};

type MaintenanceSectionProps = {
  locale: string;
  t: AdminTranslate;
  plannedMaintenanceError: string;
  plannedMaintenanceLoading: boolean;
  plannedMaintenanceSaving: boolean;
  maintenanceCalendarLabel: string;
  maintenanceCalendarMonthItemCount: number;
  maintenanceWeekdayLabels: string[];
  maintenanceCalendarDays: MaintenanceCalendarDay[];
  selectedMaintenanceDate: string;
  maintenanceLogEntries: MaintenanceLogEntry[];
  editingMaintenanceId: string | null;
  isMaintenanceModalOpen: boolean;
  isMaintenanceEditing: boolean;
  activeMaintenanceItem: PlannedMaintenanceItem | null;
  activeMaintenanceStatus: MaintenanceStatus | null;
  machineDirectory: MachineDirectoryItem[];
  machineLabelByKey: Record<string, string>;
  maintenanceMachineKey: string;
  maintenanceTitle: string;
  maintenanceDueDate: string;
  maintenanceCost: string;
  maintenanceNote: string;
  selectedMaintenanceDateLabel: string;
  maintenanceActionKey: string | null;
  onPreviousMonth: () => void;
  onThisMonth: () => void;
  onNextMonth: () => void;
  onOpenCreateMaintenanceModal: (dateKey: string) => void;
  onOpenEditMaintenanceModal: (item: PlannedMaintenanceItem) => void;
  onCloseMaintenanceModal: () => void;
  onMaintenanceMachineKeyChange: (value: string) => void;
  onMaintenanceTitleChange: (value: string) => void;
  onMaintenanceDueDateChange: (value: string) => void;
  onMaintenanceCostChange: (value: string) => void;
  onMaintenanceNoteChange: (value: string) => void;
  onSavePlannedMaintenance: () => void;
  onUpdatePlannedMaintenanceState: (id: string, isCompleted: boolean) => void;
  onDeletePlannedMaintenance: (id: string) => void;
};

export default function MaintenanceSection({
  locale,
  t,
  plannedMaintenanceError,
  plannedMaintenanceLoading,
  plannedMaintenanceSaving,
  maintenanceCalendarLabel,
  maintenanceCalendarMonthItemCount,
  maintenanceWeekdayLabels,
  maintenanceCalendarDays,
  selectedMaintenanceDate,
  maintenanceLogEntries,
  editingMaintenanceId,
  isMaintenanceModalOpen,
  isMaintenanceEditing,
  activeMaintenanceItem,
  activeMaintenanceStatus,
  machineDirectory,
  machineLabelByKey,
  maintenanceMachineKey,
  maintenanceTitle,
  maintenanceDueDate,
  maintenanceCost,
  maintenanceNote,
  selectedMaintenanceDateLabel,
  maintenanceActionKey,
  onPreviousMonth,
  onThisMonth,
  onNextMonth,
  onOpenCreateMaintenanceModal,
  onOpenEditMaintenanceModal,
  onCloseMaintenanceModal,
  onMaintenanceMachineKeyChange,
  onMaintenanceTitleChange,
  onMaintenanceDueDateChange,
  onMaintenanceCostChange,
  onMaintenanceNoteChange,
  onSavePlannedMaintenance,
  onUpdatePlannedMaintenanceState,
  onDeletePlannedMaintenance,
}: MaintenanceSectionProps) {
  return (
    <>
      <div className="admin-panel">
        <div className="admin-maintenance-calendar">
          <div className="admin-maintenance-calendar__toolbar">
            <div className="admin-maintenance-calendar__heading">
              <div className="admin-chart-title">{t("admin.maintenanceCalendar")}</div>
              <div className="admin-maintenance-calendar__month">
                {maintenanceCalendarLabel}
              </div>
            </div>
            <div className="admin-maintenance-calendar__toolbar-actions">
              <div className="admin-maintenance-calendar__nav">
                <button type="button" className="admin-reset-button" onClick={onPreviousMonth}>
                  {t("common.prev")}
                </button>
                <button type="button" className="admin-reset-button" onClick={onThisMonth}>
                  {t("common.thisMonth")}
                </button>
                <button type="button" className="admin-reset-button" onClick={onNextMonth}>
                  {t("common.next")}
                </button>
              </div>
              <div className="admin-maintenance-calendar__quick-actions">
                <button
                  type="button"
                  className="admin-reset-button"
                  onClick={() => onOpenCreateMaintenanceModal(getCurrentLocalDateOnly())}
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

          {plannedMaintenanceError && <div className="page__error">{plannedMaintenanceError}</div>}

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
                  <div key={status} className="admin-maintenance-calendar__legend-item">
                    <span
                      className={`admin-maintenance-calendar__legend-dot admin-maintenance-calendar__legend-dot--${status}`}
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {maintenanceCalendarMonthItemCount === 0 && (
                <div className="admin-chart-empty">{t("admin.maintenanceCalendarEmpty")}</div>
              )}

              <div className="admin-maintenance-calendar__weekday-row">
                {maintenanceWeekdayLabels.map((label) => (
                  <div key={label} className="admin-maintenance-calendar__weekday">
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
                        day.isCurrentMonth ? "" : " admin-maintenance-calendar__day--outside"
                      }${day.isToday ? " admin-maintenance-calendar__day--today" : ""}${
                        isSelectedDay ? " admin-maintenance-calendar__day--selected" : ""
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
                          const isSelectedEvent = editingMaintenanceId === item.id;

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
                                onOpenEditMaintenanceModal(item);
                              }}
                            >
                              <div className="admin-maintenance-calendar__event-title">
                                {item.title}
                              </div>
                              <div className="admin-maintenance-calendar__event-meta">
                                {machineLabelByKey[item.machineKey] || item.machineKey}
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
                  <div className="admin-chart-title">{t("admin.activity")}</div>
                </div>
                {maintenanceLogEntries.length === 0 ? (
                  <div className="admin-maintenance-log__empty">
                    {t("admin.noMaintenanceActivityYet")}
                  </div>
                ) : (
                  <div className="admin-maintenance-log__list">
                    {maintenanceLogEntries.map((entry) => (
                      <div key={entry.id} className="admin-maintenance-log__item">
                        <span className="admin-maintenance-log__line">
                          <span className="admin-maintenance-log__field">{entry.title}</span>
                          <span className="admin-maintenance-log__separator">|</span>
                          <span className="admin-maintenance-log__field">{entry.category}</span>
                          <span className="admin-maintenance-log__separator">|</span>
                          <span className="admin-maintenance-log__field">{entry.change}</span>
                          <span className="admin-maintenance-log__separator">|</span>
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
        onRequestClose={onCloseMaintenanceModal}
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
            {activeMaintenanceItem?.jiraIssueUrl && (
              <a
                href={activeMaintenanceItem.jiraIssueUrl}
                target="_blank"
                rel="noreferrer"
                className="admin-maintenance-modal__link"
              >
                {t("admin.openInJira")}
              </a>
            )}
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
              onClick={onCloseMaintenanceModal}
              aria-label={t("common.close")}
            >
              x
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
                <span className="admin-maintenance-modal__summary-separator">|</span>
                <span className="admin-chart-empty admin-maintenance-modal__summary-due">
                  {getMaintenanceDueLabel(activeMaintenanceItem.dueDate, t)}
                </span>
                {activeMaintenanceItem.cost != null && (
                  <>
                    <span className="admin-maintenance-modal__summary-separator">|</span>
                    <span className="admin-chart-empty admin-maintenance-modal__summary-due">
                      {formatCurrency(activeMaintenanceItem.cost, locale)}
                    </span>
                  </>
                )}
              </div>
              <div
                className={`status-pill admin-maintenance-plan__status status-pill--${activeMaintenanceStatus}`}
              >
                {activeMaintenanceStatus === "overdue" && t("admin.overdueMaintenance")}
                {activeMaintenanceStatus === "dueSoon" && t("admin.dueSoonMaintenance")}
                {activeMaintenanceStatus === "upcoming" && t("admin.upcomingMaintenance")}
                {activeMaintenanceStatus === "completed" && t("admin.completedMaintenance")}
              </div>
            </div>
          )}

          <div className="admin-maintenance-modal__fields">
            <label className="admin-inventory-field">
              <div className="admin-inventory-field__label">{t("admin.maintenanceAsset")}</div>
              <select
                className="admin-input"
                value={maintenanceMachineKey}
                onChange={(event) => onMaintenanceMachineKeyChange(event.target.value)}
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
              <div className="admin-inventory-field__label">{t("admin.maintenanceTitle")}</div>
              <input
                type="text"
                className="admin-input"
                value={maintenanceTitle}
                onChange={(event) => onMaintenanceTitleChange(event.target.value)}
                placeholder={t("admin.maintenanceTitlePlaceholder")}
              />
            </label>
            <label className="admin-inventory-field">
              <div className="admin-inventory-field__label">{t("admin.maintenanceDueDate")}</div>
              <input
                type="date"
                className="admin-input"
                value={maintenanceDueDate}
                onChange={(event) => onMaintenanceDueDateChange(event.target.value)}
              />
            </label>
            <label className="admin-inventory-field">
              <div className="admin-inventory-field__label">{t("admin.maintenanceCost")}</div>
              <input
                type="number"
                min="0"
                step="0.01"
                className="admin-input"
                value={maintenanceCost}
                onChange={(event) => onMaintenanceCostChange(event.target.value)}
                placeholder={t("admin.maintenanceCostPlaceholder")}
              />
            </label>
            <label className="admin-inventory-field admin-maintenance-modal__field--full">
              <div className="admin-inventory-field__label">{t("admin.maintenanceNote")}</div>
              <textarea
                className="admin-input admin-maintenance-modal__note"
                value={maintenanceNote}
                onChange={(event) => onMaintenanceNoteChange(event.target.value)}
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
              onClick={onSavePlannedMaintenance}
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
                onClick={() =>
                  onUpdatePlannedMaintenanceState(
                    activeMaintenanceItem.id,
                    !activeMaintenanceItem.isCompleted
                  )
                }
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
                onClick={() => onDeletePlannedMaintenance(activeMaintenanceItem.id)}
                disabled={
                  plannedMaintenanceSaving ||
                  maintenanceActionKey === `${activeMaintenanceItem.id}:delete`
                }
              >
                {t("common.delete")}
              </button>
            )}
            <button
              type="button"
              className="admin-reset-button"
              onClick={onCloseMaintenanceModal}
              disabled={plannedMaintenanceSaving}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
