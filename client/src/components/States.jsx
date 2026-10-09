import { InboxIcon } from "lucide-react";

export function LoadingState({ message = "Loading..." }) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ title = "No records found", message = "Add your first record to get started.", action }) {
  return (
    <div className="empty-state">
      <InboxIcon size={48} />
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
