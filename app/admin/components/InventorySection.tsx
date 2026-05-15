"use client";

import type { AdminTranslate, EquipmentDraft, MachineDirectoryItem } from "../adminShared";

type InventorySectionProps = {
  t: AdminTranslate;
  inventoryQuery: string;
  inventoryLoading: boolean;
  inventoryError: string;
  filteredMachineDirectory: MachineDirectoryItem[];
  inventoryDrafts: Record<string, EquipmentDraft>;
  inventorySavingKey: string | null;
  onInventoryQueryChange: (value: string) => void;
  onRefreshInventory: () => void;
  onSetInventoryDraftField: (
    machineKey: string,
    field: keyof EquipmentDraft,
    value: string
  ) => void;
  onSaveInventoryMachine: (machineKey: string) => void;
};

export default function InventorySection({
  t,
  inventoryQuery,
  inventoryLoading,
  inventoryError,
  filteredMachineDirectory,
  inventoryDrafts,
  inventorySavingKey,
  onInventoryQueryChange,
  onRefreshInventory,
  onSetInventoryDraftField,
  onSaveInventoryMachine,
}: InventorySectionProps) {
  return (
    <>
      <div className="admin-card">
        <h1 className="admin-title">{t("admin.inventoryTitle")}</h1>
        <p className="admin-subtitle">{t("admin.inventorySubtitle")}</p>
        <div className="admin-filters">
          <label className="admin-inventory-search">
            <div className="admin-label">{t("admin.searchMachines")}</div>
            <input
              type="text"
              className="admin-input"
              value={inventoryQuery}
              onChange={(event) => onInventoryQueryChange(event.target.value)}
              placeholder={t("admin.searchMachinesPlaceholder")}
            />
          </label>
          <div className="admin-filters-actions admin-filters-actions--inline">
            <button
              type="button"
              className="admin-reset-button"
              onClick={onRefreshInventory}
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
              <div key={machine.machineKey} className="admin-inventory-row">
                <div className="admin-ticket-meta">
                  <div className="admin-ticket-key">{machine.category}</div>
                  <div className="admin-ticket-summary">{machine.subcategory}</div>
                </div>
                <label className="admin-inventory-field">
                  <div className="admin-inventory-field__label">{t("admin.model")}</div>
                  <input
                    type="text"
                    className="admin-input"
                    value={draft.model}
                    onChange={(event) =>
                      onSetInventoryDraftField(
                        machine.machineKey,
                        "model",
                        event.target.value
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
                    onChange={(event) =>
                      onSetInventoryDraftField(
                        machine.machineKey,
                        "serialNumber",
                        event.target.value
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
                    onChange={(event) =>
                      onSetInventoryDraftField(
                        machine.machineKey,
                        "manufacturer",
                        event.target.value
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="admin-reset-button"
                  onClick={() => onSaveInventoryMachine(machine.machineKey)}
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
  );
}
