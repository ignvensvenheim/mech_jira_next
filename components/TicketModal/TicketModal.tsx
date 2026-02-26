import React from "react";
import "./ticketModal.css";
import Modal from "react-modal";
import { DetailedSingleTicket } from "../DetailedSingleTicket/DetailedSingleTicket";
import type { NormalizedIssue } from "@/lib/jira";
import { normalizeIssue } from "@/lib/normalizeIssue";
import type { Issue } from "@/lib/types";
import { getStatusClassName } from "@/helpers/getStatusClassName";

Modal.setAppElement("body");

type Props = {
  isOpen: boolean;
  onClose: () => void;
  issue: NormalizedIssue | null;
};

export default function TicketModal({ isOpen, onClose, issue }: Props) {
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
                  Open in Jira
                </a>
              )}
              <button className="modal-close-btn" onClick={onClose}>
                x
              </button>
            </div>
          </div>

          <div className="ticket-modal__body">
            <DetailedSingleTicket issue={detailIssue} loadingDetail={loadingDetail} />
          </div>
        </>
      )}
    </Modal>
  );
}
