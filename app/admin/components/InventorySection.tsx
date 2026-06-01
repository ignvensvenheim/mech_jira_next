"use client";

import Link from "next/link";
import { getAdminAssetHref } from "../adminShared";
import type {
  AdminTranslate,
  EquipmentDraft,
  MachineDirectoryItem,
} from "../adminShared";

type InventorySectionProps = {
  t: AdminTranslate;
  inventoryQuery: string;
  inventoryCategory: string;
  inventorySubCategory: string;
  inventoryCategoryOptions: string[];
  inventorySubCategoryOptions: string[];
  inventoryLoading: boolean;
  inventoryError: string;
  filteredMachineDirectory: MachineDirectoryItem[];
  inventoryDrafts: Record<string, EquipmentDraft>;
  onInventoryQueryChange: (value: string) => void;
  onInventoryCategoryChange: (value: string) => void;
  onInventorySubCategoryChange: (value: string) => void;
  onRefreshInventory: () => void;
};

export default function InventorySection({
  t,
  inventoryQuery,
  inventoryCategory,
  inventorySubCategory,
  inventoryCategoryOptions,
  inventorySubCategoryOptions,
  inventoryLoading,
  inventoryError,
  filteredMachineDirectory,
  inventoryDrafts,
  onInventoryQueryChange,
  onInventoryCategoryChange,
  onInventorySubCategoryChange,
  onRefreshInventory,
}: InventorySectionProps) {
  return (
    <>
      <div className="admin-card">
        <h1 className="admin-title">{t("admin.inventoryTitle")}</h1>
        <p className="admin-subtitle">{t("admin.inventorySubtitle")}</p>
        <div className="admin-filters admin-filters--inventory">
          <label className="admin-inventory-search admin-filter admin-filter--search">
            <div className="admin-label">{t("admin.searchMachines")}</div>
            <input
              type="text"
              className="admin-input"
              value={inventoryQuery}
              onChange={(event) => onInventoryQueryChange(event.target.value)}
              placeholder={t("admin.searchMachinesPlaceholder")}
            />
          </label>
          <label className="admin-filter">
            <div className="admin-label">{t("home.category")}</div>
            <select
              className="admin-input"
              value={inventoryCategory}
              onChange={(event) =>
                onInventoryCategoryChange(event.target.value)
              }
            >
              <option value="">{t("common.all")}</option>
              {inventoryCategoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-filter">
            <div className="admin-label">{t("home.subcategory")}</div>
            <select
              className="admin-input"
              value={inventorySubCategory}
              onChange={(event) =>
                onInventorySubCategoryChange(event.target.value)
              }
            >
              <option value="">{t("common.all")}</option>
              {inventorySubCategoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-filters-actions admin-filters-actions--inventory">
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
            <div className="admin-chart-empty">
              {t("admin.loadingMachines")}
            </div>
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

            return (
              <div key={machine.machineKey} className="admin-inventory-row">
                <div className="admin-ticket-meta">
                  <div className="admin-ticket-key">
                    <span> {machine.category}</span> | {machine.subcategory}
                  </div>
                  <Link
                    href={getAdminAssetHref(machine.machineKey)}
                    className="admin-inline-link admin-inline-link--inventory"
                  >
                    {t("admin.openAssetDetails")}
                  </Link>
                </div>
                <label className="admin-inventory-field">
                  <div className="admin-inventory-field__label">
                    {t("admin.model")}
                  </div>
                  <div
                    className="admin-input admin-inventory-field__value"
                    aria-readonly="true"
                  >
                    {draft.model.trim() || "-"}
                  </div>
                </label>
                <label className="admin-inventory-field">
                  <div className="admin-inventory-field__label">
                    {t("admin.serialNumber")}
                  </div>
                  <div
                    className="admin-input admin-inventory-field__value"
                    aria-readonly="true"
                  >
                    {draft.serialNumber.trim() || "-"}
                  </div>
                </label>
                <label className="admin-inventory-field">
                  <div className="admin-inventory-field__label">
                    {t("admin.manufacturer")}
                  </div>
                  <div
                    className="admin-input admin-inventory-field__value"
                    aria-readonly="true"
                  >
                    {draft.manufacturer.trim() || "-"}
                  </div>
                </label>
              </div>
            );
          })}
      </div>
    </>
  );
}
