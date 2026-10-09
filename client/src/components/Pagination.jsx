import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="pagination-info">Showing {start}–{end} of {total}</div>
      <div className="pagination-controls">
        <button className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}><ChevronLeft size={14} /></button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} className={`page-btn ${p === page ? "active" : ""}`} onClick={() => onPageChange(p)}>{p}</button>
        ))}
        <button className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}
