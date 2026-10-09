import { CheckCircle, XCircle, X } from "lucide-react";
import { useEffect } from "react";

export default function Alert({ type = "success", message, onClose, autoClose = true }) {
  useEffect(() => {
    if (autoClose && onClose) {
      const t = setTimeout(onClose, 4000);
      return () => clearTimeout(t);
    }
  }, [message, autoClose, onClose]);

  if (!message) return null;
  return (
    <div className={`alert alert-${type}`}>
      {type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={14} /></button>}
    </div>
  );
}
