import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, loading }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal confirm-dialog">
        <div className="modal-body">
          <div className="confirm-icon"><AlertTriangle size={28} /></div>
          <h3>{title || "Are you sure?"}</h3>
          <p>{message || "This action cannot be undone."}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
