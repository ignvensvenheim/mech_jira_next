"use client";

import Modal from "react-modal";
import { PLANNED_MAINTENANCE_RECIPIENTS } from "@/lib/plannedMaintenanceRecipients";
import {
  formatCurrency,
  formatDateTimeForLocale,
  getCurrentLocalDateOnly,
  getMaintenanceDueLabel,
  getMaintenanceItemStatus,
  getMaintenanceWorkflowStatusLabel,
  type AdminTranslate,
  type MaintenanceLogEntry,
  type MaintenanceStatus,
  type MaintenanceWorkflowStatus,
  type MachineDirectoryItem,
  type PlannedMaintenanceRecipient,
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
  maintenanceNotificationRecipients: PlannedMaintenanceRecipient[];
  maintenanceStatus: MaintenanceWorkflowStatus;
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
  onMaintenanceNotificationRecipientsChange: (value: PlannedMaintenanceRecipient[]) => void;
  onMaintenanceStatusChange: (value: MaintenanceWorkflowStatus) => void;
  onSavePlannedMaintenance: () => void;
  onUpdatePlannedMaintenanceStatus: (id: string, status: MaintenanceWorkflowStatus) => void;
  onSendPlannedMaintenanceReminder: (id: string) => void;
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
  maintenanceNotificationRecipients,
  maintenanceStatus,
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
  onMaintenanceNotificationRecipientsChange,
  onMaintenanceStatusChange,
  onSavePlannedMaintenance,
  onUpdatePlannedMaintenanceStatus,
  onSendPlannedMaintenanceReminder,
  onDeletePlannedMaintenance,
}: MaintenanceSectionProps) {
  const selectedRecipientEmails = new Set(
    maintenanceNotificationRecipients.map((recipient) => recipient.email.toLowerCase())
  );

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
                    ["inProgress", t("admin.maintenanceStatusInProgress")],
                    ["waitingForParts", t("admin.maintenanceStatusWaitingForParts")],
                    ["completed", t("admin.completedMaintenance")],
                    ["cancelled", t("admin.maintenanceStatusCancelled")],
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
                {activeMaintenanceStatus
                  ? getMaintenanceWorkflowStatusLabel(t, activeMaintenanceStatus)
                  : ""}
              </div>
            </div>
          )}

          {activeMaintenanceItem && activeMaintenanceItem.notificationRecipients.length > 0 && (
            <div className="admin-maintenance-recipient-summary">
              <div className="admin-inventory-field__label">
                {t("admin.maintenanceNotifyPeople")}
              </div>
              <div className="admin-maintenance-recipient-summary__names">
                {activeMaintenanceItem.notificationRecipients
                  .map((recipient) => recipient.name)
                  .join(", ")}
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
            <label className="admin-inventory-field">
              <div className="admin-inventory-field__label">{t("common.status")}</div>
              <select
                className="admin-input"
                value={maintenanceStatus}
                onChange={(event) =>
                  onMaintenanceStatusChange(event.target.value as MaintenanceWorkflowStatus)
                }
              >
                <option value="planned">{t("admin.maintenanceStatusPlanned")}</option>
                <option value="inProgress">{t("admin.maintenanceStatusInProgress")}</option>
                <option value="waitingForParts">
                  {t("admin.maintenanceStatusWaitingForParts")}
                </option>
                <option value="completed">{t("admin.maintenanceStatusCompleted")}</option>
                <option value="cancelled">{t("admin.maintenanceStatusCancelled")}</option>
              </select>
            </label>
            <div className="admin-inventory-field admin-maintenance-modal__field--full">
              <div className="admin-inventory-field__label">
                {t("admin.maintenanceNotifyPeople")}
              </div>
              <div className="admin-maintenance-recipient-grid">
                {PLANNED_MAINTENANCE_RECIPIENTS.map((recipient) => {
                  const isChecked = selectedRecipientEmails.has(
                    recipient.email.toLowerCase()
                  );

                  return (
                    <label
                      key={recipient.email}
                      className="admin-maintenance-recipient-option"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            onMaintenanceNotificationRecipientsChange([
                              ...maintenanceNotificationRecipients,
                              recipient,
                            ]);
                            return;
                          }

                          onMaintenanceNotificationRecipientsChange(
                            maintenanceNotificationRecipients.filter(
                              (item) =>
                                item.email.toLowerCase() !== recipient.email.toLowerCase()
                            )
                          );
                        }}
                      />
                      <span>{recipient.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
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
                onClick={() => onSendPlannedMaintenanceReminder(activeMaintenanceItem.id)}
                disabled={
                  plannedMaintenanceSaving ||
                  maintenanceActionKey === `${activeMaintenanceItem.id}:reminder` ||
                  activeMaintenanceItem.notificationRecipients.length === 0
                }
              >
                {t("admin.sendReminder")}
              </button>
            )}
            {activeMaintenanceItem && (
              <button
                type="button"
                className="admin-reset-button"
                onClick={() => onUpdatePlannedMaintenanceStatus(activeMaintenanceItem.id, "planned")}
                disabled={
                  plannedMaintenanceSaving ||
                  maintenanceActionKey === `${activeMaintenanceItem.id}:planned`
                }
              >
                {t("admin.markPlanned")}
              </button>
            )}
            {activeMaintenanceItem && (
              <button
                type="button"
                className="admin-reset-button"
                onClick={() =>
                  onUpdatePlannedMaintenanceStatus(activeMaintenanceItem.id, "completed")
                }
                disabled={
                  plannedMaintenanceSaving ||
                  maintenanceActionKey === `${activeMaintenanceItem.id}:completed`
                }
              >
                {t("admin.markCompleted")}
              </button>
            )}
            {activeMaintenanceItem && (
              <button
                type="button"
                className="admin-reset-button"
                onClick={() =>
                  onUpdatePlannedMaintenanceStatus(activeMaintenanceItem.id, "cancelled")
                }
                disabled={
                  plannedMaintenanceSaving ||
                  maintenanceActionKey === `${activeMaintenanceItem.id}:cancelled`
                }
              >
                {t("admin.markCancelled")}
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
