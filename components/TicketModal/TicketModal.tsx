import React from "react";
import "./ticketModal.css";
import Modal from "react-modal";
import { DetailedSingleTicket } from "../DetailedSingleTicket/DetailedSingleTicket";
import { useI18n } from "@/components/I18nProvider";
import type { NormalizedIssue } from "@/lib/jira";
import { normalizeIssue } from "@/lib/normalizeIssue";
import type { Issue } from "@/lib/types";
import { getStatusClassName } from "@/helpers/getStatusClassName";
import { fmtDuration } from "@/helpers/fmtDuration";
import { relativeDate } from "@/helpers/relativeDate";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

Modal.setAppElement("body");

type Props = {
  isOpen: boolean;
  onClose: () => void;
  issue: NormalizedIssue | null;
};

export default function TicketModal({ isOpen, onClose, issue }: Props) {
  const { locale, t } = useI18n();
  useBodyScrollLock(isOpen);
  const [detailIssue, setDetailIssue] = React.useState<NormalizedIssue | null>(
    issue
  );
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !issue?.key) return;

    let isCancelled = false;

    const load = async () => {
      setLoadingDetail(true);

      try {
        const params = new URLSearchParams();
        params.set("jql", `key = ${issue.key}`);
        params.set("maxResults", "1");
        params.set("profile", "detail");

        const res = await fetch(`/api/jira/search?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || json.error) throw new Error(json.error || "Fetch failed");

        const fetched = (json.issues?.[0] as Issue | undefined) ?? null;

        if (!isCancelled) {
          setDetailIssue(fetched ? normalizeIssue(fetched) : issue);
        }
      } catch {
        if (!isCancelled) setDetailIssue(issue);
      } finally {
        if (!isCancelled) setLoadingDetail(false);
      }
    };

    setDetailIssue(issue);
    load();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, issue]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="ticket-modal"
      overlayClassName="ticket-modal__overlay"
    >
      {detailIssue && (
        <>
          <div className="ticket-modal__header">
            <div className="ticket-modal__title-wrap">
              <p className="ticket-modal__key">{detailIssue.key}</p>
              <h2 className="ticket-modal__title">{detailIssue.summary}</h2>
              <div className="ticket-modal__header-meta">
                <div className="ticket-modal__header-meta-item">
                  <span className="detailed-ticket__label">{t("common.created")}</span>
                  <span>{relativeDate(detailIssue.created, locale)}</span>
                </div>
                <div className="ticket-modal__header-meta-item">
                  <span className="detailed-ticket__label">{t("common.updated")}</span>
                  <span>{relativeDate(detailIssue.updated || detailIssue.created, locale)}</span>
                </div>
                <div className="ticket-modal__header-meta-item">
                  <span className="detailed-ticket__label">{t("common.timeSpent")}</span>
                  <span>{fmtDuration(detailIssue.timeSpentSeconds, locale)}</span>
                </div>
                <div className="ticket-modal__header-meta-item">
                  <span className="detailed-ticket__label">{t("common.priority")}</span>
                  <span>{detailIssue.priority || "-"}</span>
                </div>
              </div>
            </div>
            <div className="ticket-modal__header-actions">
              <span className={getStatusClassName(detailIssue.statusCategory)}>
                {detailIssue.status}
              </span>
              {detailIssue.requestUrl && (
                <a
                  href={detailIssue.requestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ticket-modal__jira-link"
                >
                  {t("admin.openInJira")}
                </a>
              )}
              <button className="modal-close-btn" onClick={onClose} aria-label={t("common.close")}>
                x
              </button>
            </div>
          </div>

          <div className="ticket-modal__body">
            <DetailedSingleTicket
              issue={detailIssue}
              loadingDetail={loadingDetail}
              hideMetaSection
            />
          </div>
        </>
      )}
    </Modal>
  );
}
