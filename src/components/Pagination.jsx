import React from "react";

export function Pagination({ page, limit, count, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil((count || 0) / (limit || 1)));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="pagination">
      <button
        className="btn"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
      >
        Prev
      </button>
      <div className="muted">
        Page <strong>{page}</strong> of <strong>{totalPages}</strong> •{" "}
        <strong>{count ?? 0}</strong> total
      </div>
      <button
        className="btn"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
