"use client";

import Modal from "react-modal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { PLANNED_MAINTENANCE_RECIPIENTS } from "@/lib/plannedMaintenanceRecipients";
import {
  formatCurrency,
  formatMaintenanceAvailabilityLabel,
  formatDateTimeForLocale,
  getCurrentLocalDateOnly,
  type AdminTranslate,
  type MaintenanceLogEntry,
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
  plannedMaintenanceSuccess: string;
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
  currentUserLabel: string;
  machineDirectory: MachineDirectoryItem[];
  machineLabelByKey: Record<string, string>;
  maintenanceMachineKey: string;
  maintenanceTitle: string;
  maintenanceDueDate: string;
  maintenanceAvailabilityStartTime: string;
  maintenanceAvailabilityEndTime: string;
  maintenanceCost: string;
  maintenanceNote: string;
  maintenanceNotificationRecipients: PlannedMaintenanceRecipient[];
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
  onMaintenanceAvailabilityStartTimeChange: (value: string) => void;
  onMaintenanceAvailabilityEndTimeChange: (value: string) => void;
  onMaintenanceCostChange: (value: string) => void;
  onMaintenanceNoteChange: (value: string) => void;
  onMaintenanceNotificationRecipientsChange: (value: PlannedMaintenanceRecipient[]) => void;
  onSavePlannedMaintenance: () => void;
  onSendPlannedMaintenanceReminder: (id: string) => void;
  onDeletePlannedMaintenance: (id: string) => void;
};

export default function MaintenanceSection({
  locale,
  t,
  plannedMaintenanceError,
  plannedMaintenanceSuccess,
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
  currentUserLabel,
  machineDirectory,
  machineLabelByKey,
  maintenanceMachineKey,
  maintenanceTitle,
  maintenanceDueDate,
  maintenanceAvailabilityStartTime,
  maintenanceAvailabilityEndTime,
  maintenanceCost,
  maintenanceNote,
  maintenanceNotificationRecipients,
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
  onMaintenanceAvailabilityStartTimeChange,
  onMaintenanceAvailabilityEndTimeChange,
  onMaintenanceCostChange,
  onMaintenanceNoteChange,
  onMaintenanceNotificationRecipientsChange,
  onSavePlannedMaintenance,
  onSendPlannedMaintenanceReminder,
  onDeletePlannedMaintenance,
}: MaintenanceSectionProps) {
  useBodyScrollLock(isMaintenanceModalOpen);
  const timeOptions = Array.from({ length: 36 }, (_, index) => {
    const slot = index + 12;
    const hours = String(Math.floor(slot / 2)).padStart(2, "0");
    const minutes = slot % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
  });
  const selectedRecipientEmails = new Set(
    maintenanceNotificationRecipients.map((recipient) => recipient.email.toLowerCase())
  );
  const isSendingNotificationEmails =
    plannedMaintenanceSaving && maintenanceNotificationRecipients.length > 0;
  const activeMaintenanceCreatorLabel = activeMaintenanceItem
    ? activeMaintenanceItem.createdBy?.name ||
      activeMaintenanceItem.createdBy?.email ||
      t("common.unknown")
    : currentUserLabel || t("common.unknown");
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
              </div>
            </div>
          </div>

          {plannedMaintenanceError && <div className="page__error">{plannedMaintenanceError}</div>}
          {plannedMaintenanceSuccess && (
            <div className="page__success">{plannedMaintenanceSuccess}</div>
          )}

          {plannedMaintenanceLoading ? (
            <div className="admin-buffering">
              <div className="admin-buffering-spinner" />
              <div className="admin-chart-empty">{t("common.loading")}</div>
            </div>
          ) : (
            <>
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
                  const isSelectedDay = day.dateKey === selectedMaintenanceDate;

                  return (
                    <div
                      key={day.dateKey}
                      className={`admin-maintenance-calendar__day${
                        day.isCurrentMonth ? "" : " admin-maintenance-calendar__day--outside"
                      }${day.isToday ? " admin-maintenance-calendar__day--today" : ""}${
                        isSelectedDay ? " admin-maintenance-calendar__day--selected" : ""
                      }`}
                      aria-disabled={!day.isCurrentMonth}
                    >
                      <div className="admin-maintenance-calendar__day-header">
                        <div className="admin-maintenance-calendar__day-number">
                          {day.dayNumber}
                        </div>
                      </div>

                      <div className="admin-maintenance-calendar__events">
                        {day.items.map((item) => {
                          const isSelectedEvent = editingMaintenanceId === item.id;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`admin-maintenance-calendar__event${
                                isSelectedEvent
                                  ? " admin-maintenance-calendar__event--selected"
                                  : ""
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenEditMaintenanceModal(item);
                              }}
                            >
                              <div className="admin-maintenance-calendar__event-top">
                                <div className="admin-maintenance-calendar__event-title">
                                  {item.title}
                                </div>
                              </div>
                              <div className="admin-maintenance-calendar__event-meta">
                                {machineLabelByKey[item.machineKey] || item.machineKey}
                              </div>
                              {formatMaintenanceAvailabilityLabel(
                                item.availabilityStartTime,
                                item.availabilityEndTime
                              ) && (
                                <div className="admin-maintenance-calendar__event-time">
                                  {formatMaintenanceAvailabilityLabel(
                                    item.availabilityStartTime,
                                    item.availabilityEndTime
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="admin-maintenance-log" aria-label={t("admin.activity")}>
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
                ? `${machineLabelByKey[activeMaintenanceItem.machineKey] || activeMaintenanceItem.machineKey} / ${activeMaintenanceItem.title}`
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
            <div className="admin-inventory-field">
              <div className="admin-inventory-field__label">
                {t("admin.maintenanceAvailability")}
              </div>
              <div className="admin-maintenance-modal__date-time-inputs">
                <select
                  className="admin-input"
                  value={maintenanceAvailabilityStartTime}
                  onChange={(event) => {
                    const nextStartTime = event.target.value;
                    onMaintenanceAvailabilityStartTimeChange(nextStartTime);
                    if (
                      maintenanceAvailabilityEndTime &&
                      nextStartTime &&
                      maintenanceAvailabilityEndTime < nextStartTime
                    ) {
                      onMaintenanceAvailabilityEndTimeChange("");
                    }
                    if (!nextStartTime) {
                      onMaintenanceAvailabilityEndTimeChange("");
                    }
                  }}
                >
                  <option value="">{t("admin.maintenanceAvailabilityStart")}</option>
                  {timeOptions.map((timeValue) => (
                    <option key={timeValue} value={timeValue}>
                      {timeValue}
                    </option>
                  ))}
                </select>
                <select
                  className="admin-input"
                  value={maintenanceAvailabilityEndTime}
                  onChange={(event) =>
                    onMaintenanceAvailabilityEndTimeChange(event.target.value)
                  }
                  disabled={!maintenanceAvailabilityStartTime}
                >
                  <option value="">{t("admin.maintenanceAvailabilityEnd")}</option>
                  {timeOptions
                    .filter(
                      (timeValue) =>
                        !maintenanceAvailabilityStartTime ||
                        timeValue >= maintenanceAvailabilityStartTime
                    )
                    .map((timeValue) => (
                      <option key={timeValue} value={timeValue}>
                        {timeValue}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="admin-inventory-field">
              <div className="admin-inventory-field__label">
                {t("admin.maintenanceCreatedBy")}
              </div>
              <div className="admin-input" aria-readonly="true">
                {activeMaintenanceCreatorLabel}
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
              {isSendingNotificationEmails && (
                <div className="admin-maintenance-recipient-status" role="status">
                  <span className="admin-buffering-spinner" aria-hidden="true" />
                  <span>
                    {t("admin.maintenanceSendingNotifications", {
                      count: maintenanceNotificationRecipients.length,
                    })}
                  </span>
                </div>
              )}
            </div>
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
                ? isSendingNotificationEmails
                  ? t("admin.maintenanceSendingEmails")
                  : t("admin.saving")
                : isMaintenanceEditing
                  ? t("common.save")
                  : t("admin.addMaintenancePlan")}
            </button>
            {activeMaintenanceItem && (
              <button
                type="button"
                className="admin-reset-button"
                onClick={() => {
                  if (!window.confirm(t("admin.deleteMaintenanceConfirm"))) {
                    return;
                  }

                  onDeletePlannedMaintenance(activeMaintenanceItem.id);
                }}
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
