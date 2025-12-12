import "./ticketModal.css";
import Modal from "react-modal";
import { DetailedSingleTicket } from "../DetailedSingleTicket/DetailedSingleTicket";

Modal.setAppElement("body");

type Props = {
  isOpen: boolean;
  onClose: () => void;
  issue: any; // NormalizedIssue
};

export default function TicketModal({ isOpen, onClose, issue }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="ticket-modal"
      overlayClassName="ticket-modal__overlay"
    >
      <button className="modal-close-btn" onClick={onClose}>
        ✕
      </button>

      <DetailedSingleTicket issue={issue} />
    </Modal>
  );
}
