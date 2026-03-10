"use client";

import React from "react";
import Modal from "react-modal";
import { Oval } from "react-loader-spinner";
import { useI18n } from "@/components/I18nProvider";
import type { NormalizedIssue } from "@/lib/jira";
import type { Issue } from "@/lib/types";
import { normalizeIssue } from "@/lib/normalizeIssue";
import { getStatusClassName } from "@/helpers/getStatusClassName";
import { relativeDate } from "@/helpers/relativeDate";
import "./adminTicketModal.css";

Modal.setAppElement("body");

type ManualEntry = {
  id: string;
  date: string;
  amount: number;
  comment: string;
  createdAt: string;
};

type MachineDataResponse = {
  entries: ManualEntry[];
};

type EquipmentDetailsResponse = {
  machineKey: string;
  model: string;
  serialNumber: string;
  manufacturer: string;
  updatedAt: string | null;
};

type TicketCostItem = {
  issueKey: string;
  machineKey: string;
  date: string;
  amount: number;
  comment: string;
  updatedAt: string;
};

type Attachment = {
  id: string;
  filename: string;
  mimeType?: string;
  blobUrl?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  issue: NormalizedIssue | null;
  onDataChanged?: () => void;
};

function formatCurrency(amount: number, locale: string = "en") {
  return new Intl.NumberFormat(locale === "lt" ? "lt-LT" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMinutes(seconds: number, locale: string = "en") {
  const value = Math.round((seconds || 0) / 60);
  return locale === "lt" ? `${value} min` : `${value} min`;
}

function getMachineParts(issue: NormalizedIssue | null) {
  const [categoryPart = "", subcategoryPart = ""] = (issue?.summary ?? "")
    .split("|")
    .map((s) => s.trim());
  const machineKey =
    categoryPart && subcategoryPart ? `${categoryPart}::${subcategoryPart}` : "";

  return {
    category: categoryPart,
    subcategory: subcategoryPart,
    machineKey,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.error || `Request failed (${response.status})`);
  }
  return json as T;
}

export default function AdminTicketModal({
  isOpen,
  onClose,
  issue,
  onDataChanged,
}: Props) {
  const { locale, t } = useI18n();
  const [detailIssue, setDetailIssue] = React.useState<NormalizedIssue | null>(issue);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [loadingAdminData, setLoadingAdminData] = React.useState(false);
  const [loadingAttachments, setLoadingAttachments] = React.useState(false);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [adminDataError, setAdminDataError] = React.useState("");
  const [machineData, setMachineData] = React.useState<MachineDataResponse | null>(null);
  const [equipmentData, setEquipmentData] =
    React.useState<EquipmentDetailsResponse | null>(null);
  const [ticketCost, setTicketCost] = React.useState<TicketCostItem | null>(null);
  const [ticketDate, setTicketDate] = React.useState("");
  const [ticketAmount, setTicketAmount] = React.useState("");
  const [ticketComment, setTicketComment] = React.useState("");
  const [savingTicketCost, setSavingTicketCost] = React.useState(false);
  const [entryDate, setEntryDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [entryAmount, setEntryAmount] = React.useState("");
  const [entryComment, setEntryComment] = React.useState("");
  const [savingEntryId, setSavingEntryId] = React.useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(null);
  const [editDate, setEditDate] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editComment, setEditComment] = React.useState("");

  const refreshParent = React.useCallback(() => {
    onDataChanged?.();
  }, [onDataChanged]);

  React.useEffect(() => {
    if (!isOpen || !issue?.key) return;

    let isCancelled = false;
    const initialDate = new Date().toISOString().slice(0, 10);
    const { machineKey } = getMachineParts(issue);

    const load = async () => {
      setLoadingDetail(true);
      setLoadingAdminData(true);
      setLoadingAttachments(false);
      setAdminDataError("");
      setDetailIssue(issue);
      setMachineData(null);
      setEquipmentData(null);
      setTicketCost(null);
      setTicketDate(initialDate);
      setTicketAmount("");
      setTicketComment("");
      setEntryDate(initialDate);
      setEntryAmount("");
      setEntryComment("");
      setEditingEntryId(null);
      setAttachments([]);

      try {
        const params = new URLSearchParams();
        params.set("jql", `key = ${issue.key}`);
        params.set("maxResults", "1");
        params.set("profile", "detail");

        const detailPromise = fetch(`/api/jira/search?${params.toString()}`, {
          cache: "no-store",
        }).then(async (res) => {
          const json = await res.json();
          if (!res.ok || json.error) {
            throw new Error(json.error || "Failed to load ticket detail");
          }
          const fetched = (json.issues?.[0] as Issue | undefined) ?? null;
          return fetched ? normalizeIssue(fetched) : issue;
        });

        const ticketCostPromise = fetch("/api/admin/ticket-costs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueKeys: [issue.key] }),
        }).then(async (res) => {
          const json = await parseJson<{ items: TicketCostItem[] }>(res);
          if (!isCancelled) {
            const existing = json.items?.[0] ?? null;
            setTicketCost(existing);
            setTicketDate(existing?.date ?? initialDate);
            setTicketAmount(existing ? String(existing.amount ?? 0) : "");
            setTicketComment(existing?.comment ?? "");
          }
        });

        const extraPromises: Promise<void>[] = [ticketCostPromise];

        if (machineKey) {
          extraPromises.push(
            fetch(`/api/admin/machine-data?machineKey=${encodeURIComponent(machineKey)}`, {
              cache: "no-store",
            }).then(async (res) => {
              const json = await parseJson<MachineDataResponse>(res);
              if (!isCancelled) {
                setMachineData(json);
              }
            }),
          );

          extraPromises.push(
            fetch(`/api/admin/equipment?machineKey=${encodeURIComponent(machineKey)}`, {
              cache: "no-store",
            }).then(async (res) => {
              const json = await parseJson<EquipmentDetailsResponse>(res);
              if (!isCancelled) {
                setEquipmentData(json);
              }
            }),
          );
        }

        const [nextDetail] = await Promise.all([detailPromise, Promise.all(extraPromises)]);

        if (!isCancelled) {
          setDetailIssue(nextDetail);
        }
      } catch (error) {
        if (!isCancelled) {
          setAdminDataError(String((error as Error).message || error));
          setDetailIssue(issue);
        }
      } finally {
        if (!isCancelled) {
          setLoadingDetail(false);
          setLoadingAdminData(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, issue]);

  React.useEffect(() => {
    if (!isOpen || !detailIssue) return;

    let isCancelled = false;
    const urls: string[] = [];

    const loadAttachments = async () => {
      setAttachments([]);

      if (!detailIssue.attachment?.length) return;

      setLoadingAttachments(true);
      try {
        const results = await Promise.all(
          detailIssue.attachment.map(async (attachment: any) => {
            const res = await fetch(`/api/jira/attachment/content/${attachment.id}`);
            if (!res.ok) {
              throw new Error(`Failed to fetch attachment ${attachment.id}`);
            }

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            urls.push(blobUrl);

            return {
              id: attachment.id,
              filename: attachment.filename,
              mimeType: blob.type,
              blobUrl,
            };
          }),
        );

        if (!isCancelled) {
          setAttachments(results);
        }
      } catch (error) {
        if (!isCancelled) {
          setAdminDataError(String((error as Error).message || error));
        }
      } finally {
        if (!isCancelled) {
          setLoadingAttachments(false);
        }
      }
    };

    void loadAttachments();

    return () => {
      isCancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isOpen, detailIssue]);

  if (!detailIssue) return null;

  const { category, subcategory, machineKey } = getMachineParts(detailIssue);
  const manualEntries = machineData?.entries ?? [];
  const manualTotal = manualEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const saveTicketCost = async () => {
    if (!issue?.key || !machineKey || !ticketDate) return;
    const amountRaw = ticketAmount.trim();
    const amount = amountRaw === "" ? 0 : Number(amountRaw);
    const comment = ticketComment.trim();
    const shouldDelete = amountRaw === "" && !comment;

    setSavingTicketCost(true);
    setAdminDataError("");
    try {
      if (shouldDelete) {
        await parseJson<{ ok: boolean }>(
          await fetch("/api/admin/ticket-costs", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueKey: issue.key }),
          }),
        );
        setTicketCost(null);
        setTicketAmount("");
        setTicketComment("");
      } else {
        const saved = await parseJson<TicketCostItem>(
          await fetch("/api/admin/ticket-costs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              issueKey: issue.key,
              machineKey,
              date: ticketDate,
              amount,
              comment,
            }),
          }),
        );
        setTicketCost(saved);
        setTicketDate(saved.date);
        setTicketAmount(String(saved.amount));
        setTicketComment(saved.comment);
      }
      refreshParent();
    } catch (error) {
      setAdminDataError(String((error as Error).message || error));
    } finally {
      setSavingTicketCost(false);
    }
  };

  const addManualEntry = async () => {
    if (!machineKey) return;
    const amount = Number(entryAmount);
    if (!entryDate || !Number.isFinite(amount) || amount <= 0 || !entryComment.trim()) {
      return;
    }

    setSavingEntryId("new");
    setAdminDataError("");
    try {
      const saved = await parseJson<ManualEntry>(
        await fetch("/api/admin/manual-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineKey,
            date: entryDate,
            amount,
            comment: entryComment.trim(),
          }),
        }),
      );
      setMachineData((prev) =>
        prev
          ? {
              ...prev,
              entries: [...prev.entries, saved].sort((a, b) => {
                const dateSort = b.date.localeCompare(a.date);
                if (dateSort !== 0) return dateSort;
                return b.createdAt.localeCompare(a.createdAt);
              }),
            }
          : { entries: [saved] },
      );
      setEntryAmount("");
      setEntryComment("");
      setEntryDate(new Date().toISOString().slice(0, 10));
      refreshParent();
    } catch (error) {
      setAdminDataError(String((error as Error).message || error));
    } finally {
      setSavingEntryId(null);
    }
  };

  const startEditEntry = (entry: ManualEntry) => {
    setEditingEntryId(entry.id);
    setEditDate(entry.date);
    setEditAmount(String(entry.amount));
    setEditComment(entry.comment);
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditDate("");
    setEditAmount("");
    setEditComment("");
  };

  const saveEditEntry = async (id: string) => {
    const amount = Number(editAmount);
    if (!editDate || !Number.isFinite(amount) || amount <= 0 || !editComment.trim()) {
      return;
    }

    setSavingEntryId(id);
    setAdminDataError("");
    try {
      const saved = await parseJson<ManualEntry>(
        await fetch(`/api/admin/manual-entries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: editDate,
            amount,
            comment: editComment.trim(),
          }),
        }),
      );
      setMachineData((prev) =>
        prev
          ? {
              ...prev,
              entries: prev.entries.map((entry) => (entry.id === id ? saved : entry)),
            }
          : prev,
      );
      cancelEditEntry();
      refreshParent();
    } catch (error) {
      setAdminDataError(String((error as Error).message || error));
    } finally {
      setSavingEntryId(null);
    }
  };

  const deleteEntry = async (id: string) => {
    setSavingEntryId(id);
    setAdminDataError("");
    try {
      await parseJson<{ ok: boolean }>(
        await fetch(`/api/admin/manual-entries/${id}`, {
          method: "DELETE",
        }),
      );
      setMachineData((prev) =>
        prev
          ? { ...prev, entries: prev.entries.filter((entry) => entry.id !== id) }
          : prev,
      );
      refreshParent();
    } catch (error) {
      setAdminDataError(String((error as Error).message || error));
    } finally {
      setSavingEntryId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="ticket-modal admin-ticket-modal"
      overlayClassName="ticket-modal__overlay"
    >
      <div className="ticket-modal__header">
        <div className="ticket-modal__title-wrap">
          <p className="ticket-modal__key">{detailIssue.key}</p>
          <h2 className="ticket-modal__title">{detailIssue.summary}</h2>
        </div>
        <div className="ticket-modal__header-actions">
          <span className={getStatusClassName(detailIssue.statusCategory)}>
            {detailIssue.status}
          </span>
              <button
                className="modal-close-btn"
                onClick={onClose}
                aria-label={t("common.close")}
              >
                x
              </button>
        </div>
      </div>

      <div className="ticket-modal__body">
        <div className="admin-ticket-modal__content">
          {(loadingDetail || loadingAdminData) && (
            <div className="page__loading">
              <Oval visible={true} height={80} width={80} color="#4fa94d" />
            </div>
          )}

          {adminDataError && <div className="page__error">{adminDataError}</div>}

          {!loadingDetail && !loadingAdminData && (
            <>
              <section className="detailed-ticket__section admin-ticket-modal__section--compact">
                <h3 className="detailed-ticket__section-title">{t("admin.timeAndCost")}</h3>

                <div className="admin-ticket-modal__summary-grid">
                  <div className="admin-ticket-modal__summary-card">
                    <span className="detailed-ticket__label">{t("admin.ticketTimeSpent")}</span>
                    <strong className="admin-ticket-modal__summary-value">
                      {formatMinutes(detailIssue.timeSpentSeconds, locale)}
                    </strong>
                  </div>
                  <div className="admin-ticket-modal__summary-card">
                    <span className="detailed-ticket__label">{t("admin.manualEntriesTotal")}</span>
                    <strong className="admin-ticket-modal__summary-value">
                      {formatCurrency(manualTotal, locale)}
                    </strong>
                  </div>
                </div>

                <div className="admin-ticket-modal__panels">
                  <div className="admin-ticket-modal__panel">
                    <div className="admin-ticket-modal__panel-header">
                      <div>
                        <div className="admin-chart-title">{t("admin.ticketFixCost")}</div>
                        <p className="admin-ticket-modal__panel-copy">
                          {t("admin.ticketFixCostHelp")}
                        </p>
                      </div>
                    </div>
                    <div className="admin-ticket-modal__ticket-form">
                      <label className="admin-ticket-modal__field">
                        <span className="detailed-ticket__label">{t("common.date")}</span>
                        <input
                          type="date"
                          className="admin-input"
                          value={ticketDate}
                          onChange={(e) => setTicketDate(e.target.value)}
                        />
                      </label>
                      <label className="admin-ticket-modal__field">
                        <span className="detailed-ticket__label">{t("common.amount")}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="admin-input"
                          value={ticketAmount}
                          onChange={(e) => setTicketAmount(e.target.value)}
                          placeholder={t("admin.fixCostEur")}
                        />
                      </label>
                      <label className="admin-ticket-modal__field">
                        <span className="detailed-ticket__label">{t("common.comment")}</span>
                        <input
                          type="text"
                          className="admin-input"
                          value={ticketComment}
                          onChange={(e) => setTicketComment(e.target.value)}
                          placeholder={t("admin.fixCommentOptional")}
                        />
                      </label>
                      <button
                        type="button"
                        className="admin-reset-button"
                        onClick={() => {
                          void saveTicketCost();
                        }}
                        disabled={
                          savingTicketCost ||
                          !machineKey ||
                          !ticketDate ||
                          (ticketAmount.trim() !== "" && Number(ticketAmount) < 0)
                        }
                      >
                        {savingTicketCost ? t("admin.saving") : t("common.save")}
                      </button>
                    </div>
                  </div>

                  <div className="admin-ticket-modal__panel">
                    <div className="admin-ticket-modal__panel-header">
                      <div>
                        <div className="admin-chart-title">{t("admin.manualCostEntries")}</div>
                        <p className="admin-ticket-modal__panel-copy">
                          {t("admin.manualCostEntriesHelp")}
                        </p>
                      </div>
                    </div>

                    <div className="admin-ticket-modal__ticket-form">
                      <label className="admin-ticket-modal__field">
                        <span className="detailed-ticket__label">{t("common.date")}</span>
                        <input
                          type="date"
                          className="admin-input"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                        />
                      </label>
                      <label className="admin-ticket-modal__field">
                        <span className="detailed-ticket__label">{t("common.amount")}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="admin-input"
                          value={entryAmount}
                          onChange={(e) => setEntryAmount(e.target.value)}
                          placeholder={t("admin.amountEur")}
                        />
                      </label>
                      <label className="admin-ticket-modal__field">
                        <span className="detailed-ticket__label">{t("common.comment")}</span>
                        <input
                          type="text"
                          className="admin-input"
                          value={entryComment}
                          onChange={(e) => setEntryComment(e.target.value)}
                          placeholder={t("admin.commentPlaceholder")}
                        />
                      </label>
                      <button
                        type="button"
                        className="admin-reset-button"
                        onClick={() => {
                          void addManualEntry();
                        }}
                        disabled={
                          savingEntryId === "new" ||
                          !machineKey ||
                          !entryDate ||
                          !entryComment.trim() ||
                          Number(entryAmount) <= 0
                        }
                      >
                        {savingEntryId === "new" ? t("admin.saving") : t("admin.addEntry")}
                      </button>
                    </div>

                    {manualEntries.length > 0 ? (
                      <div className="admin-ticket-modal__entries">
                        {manualEntries.map((entry) =>
                          editingEntryId === entry.id ? (
                            <div
                              key={entry.id}
                              className="admin-ticket-modal__entry admin-ticket-modal__entry--edit"
                            >
                              <label className="admin-ticket-modal__field">
                                <span className="detailed-ticket__label">{t("common.date")}</span>
                                <input
                                  type="date"
                                  className="admin-input"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                />
                              </label>
                              <label className="admin-ticket-modal__field">
                                <span className="detailed-ticket__label">{t("common.amount")}</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="admin-input"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                />
                              </label>
                              <label className="admin-ticket-modal__field">
                                <span className="detailed-ticket__label">{t("common.comment")}</span>
                                <input
                                  type="text"
                                  className="admin-input"
                                  value={editComment}
                                  onChange={(e) => setEditComment(e.target.value)}
                                />
                              </label>
                              <div className="admin-manual-actions">
                                <button
                                  type="button"
                                  className="admin-reset-button"
                                  onClick={() => {
                                    void saveEditEntry(entry.id);
                                  }}
                                  disabled={
                                    savingEntryId === entry.id ||
                                    !editDate ||
                                    !editComment.trim() ||
                                    Number(editAmount) <= 0
                                  }
                                >
                                  {t("common.save")}
                                </button>
                                <button
                                  type="button"
                                  className="admin-reset-button"
                                  onClick={cancelEditEntry}
                                >
                                  {t("common.cancel")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div key={entry.id} className="admin-ticket-modal__entry">
                              <div className="admin-ticket-modal__entry-main">
                                <span className="admin-ticket-modal__entry-amount">
                                  {formatCurrency(entry.amount, locale)}
                                </span>
                                <span className="admin-ticket-modal__entry-comment">
                                  {entry.comment}
                                </span>
                              </div>
                              <span className="admin-ticket-modal__entry-date">{entry.date}</span>
                              <div className="admin-manual-actions">
                                <button
                                  type="button"
                                  className="admin-reset-button"
                                  onClick={() => startEditEntry(entry)}
                                >
                                  {t("common.edit")}
                                </button>
                                <button
                                  type="button"
                                  className="admin-reset-button"
                                  onClick={() => {
                                    void deleteEntry(entry.id);
                                  }}
                                  disabled={savingEntryId === entry.id}
                                >
                                  {t("common.delete")}
                                </button>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="detailed-ticket__empty">{t("admin.noManualEntriesYet")}</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="detailed-ticket__section">
                <h3 className="detailed-ticket__section-title">{t("admin.inventoryDetails")}</h3>
                {machineKey ? (
                  <div className="admin-ticket-modal__grid">
                    <div className="admin-ticket-modal__item">
                      <span className="detailed-ticket__label">{t("home.category")}</span>
                      <span>{category || "-"}</span>
                    </div>
                    <div className="admin-ticket-modal__item">
                      <span className="detailed-ticket__label">{t("admin.subcategory")}</span>
                      <span>{subcategory || "-"}</span>
                    </div>
                    <div className="admin-ticket-modal__item">
                      <span className="detailed-ticket__label">{t("admin.model")}</span>
                      <span>{equipmentData?.model || "-"}</span>
                    </div>
                    <div className="admin-ticket-modal__item">
                      <span className="detailed-ticket__label">{t("admin.serialNumber")}</span>
                      <span>{equipmentData?.serialNumber || "-"}</span>
                    </div>
                    <div className="admin-ticket-modal__item">
                      <span className="detailed-ticket__label">{t("admin.manufacturer")}</span>
                      <span>{equipmentData?.manufacturer || "-"}</span>
                    </div>
                  </div>
                ) : (
                  <p className="detailed-ticket__empty">{t("admin.noMachineMapping")}</p>
                )}
              </section>

              <section className="detailed-ticket__section detailed-ticket__section--compact">
                <div className="detailed-ticket__meta-grid">
                  <div className="detailed-ticket__meta-item">
                    <span className="detailed-ticket__label">{t("common.created")}</span>
                    <span>{relativeDate(detailIssue.created, locale)}</span>
                  </div>
                  <div className="detailed-ticket__meta-item">
                    <span className="detailed-ticket__label">{t("common.updated")}</span>
                    <span>{relativeDate(detailIssue.updated || detailIssue.created, locale)}</span>
                  </div>
                  <div className="detailed-ticket__meta-item">
                    <span className="detailed-ticket__label">{t("common.timeSpent")}</span>
                    <span>{formatMinutes(detailIssue.timeSpentSeconds, locale)}</span>
                  </div>
                  <div className="detailed-ticket__meta-item">
                    <span className="detailed-ticket__label">{t("common.priority")}</span>
                    <span>{detailIssue.priority || "-"}</span>
                  </div>
                </div>
              </section>


              <section className="detailed-ticket__section">
                <h3 className="detailed-ticket__section-title">{t("common.comments")}</h3>
                {Array.isArray(detailIssue.comments) && detailIssue.comments.length > 0 ? (
                  <div className="detailed-ticket__comments-list">
                    {detailIssue.comments.map((comment) => (
                      <article key={comment.id} className="detailed-ticket__comment-item">
                        <div className="detailed-ticket__comment-meta">
                          <span className="detailed-ticket__comment-author">
                            {comment.author?.name || t("common.unknown")}
                          </span>
                          <span className="detailed-ticket__comment-date">
                            {relativeDate(comment.created, locale)}
                          </span>
                        </div>
                        <p className="detailed-ticket__comment">{comment.body || "-"}</p>
                      </article>
                    ))}
                  </div>
                ) : detailIssue.descriptionText ? (
                  <>
                    <p className="detailed-ticket__label">{t("common.initialNote")}</p>
                    <p className="detailed-ticket__comment">{detailIssue.descriptionText}</p>
                  </>
                ) : (
                  <p className="detailed-ticket__empty">{t("common.noCommentsYet")}</p>
                )}
              </section>

              <section className="detailed-ticket__section">
                <h3 className="detailed-ticket__section-title">{t("common.attachments")}</h3>

                {loadingAttachments && (
                  <div className="page__loading">
                    <Oval visible={true} height={60} width={60} color="#4fa94d" />
                  </div>
                )}

                {!loadingAttachments && attachments.length === 0 && (
                  <p className="detailed-ticket__empty">{t("common.noAttachments")}</p>
                )}

                {!loadingAttachments && attachments.length > 0 && (
                  <div className="detailed-ticket__attachments">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="detailed-ticket__attachment-item">
                        <p className="detailed-ticket__attachment-name">
                          {attachment.filename}
                        </p>
                        {attachment.mimeType?.startsWith("image/") ? (
                          <img
                            src={attachment.blobUrl}
                            alt={attachment.filename}
                            className="detailed-ticket__attachment-image"
                          />
                        ) : (
                          <a
                            href={attachment.blobUrl}
                            download={attachment.filename}
                            className="detailed-ticket__download-link"
                          >
                            {t("common.downloadFile")}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
