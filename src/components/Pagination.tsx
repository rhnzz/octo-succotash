type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = totalItems && itemsPerPage ? (currentPage - 1) * itemsPerPage + 1 : null;
  const endItem = totalItems && itemsPerPage
    ? Math.min(currentPage * itemsPerPage, totalItems)
    : null;

  function getVisiblePages(): (number | 'ellipsis')[] {
    const pages: (number | 'ellipsis')[] = [];
    const delta = 2;
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);
    if (left > 2) pages.push('ellipsis');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('ellipsis');
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  }

  const btnBase =
    'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition';
  const btnActive = 'bg-(--color-primary) text-white';
  const btnInactive = 'bg-white text-gray-600 border border-gray-200 hover:border-(--color-primary) hover:text-(--color-primary)';
  const btnDisabled = 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100';

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Navigasi halaman">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`${btnBase} ${currentPage <= 1 ? btnDisabled : btnInactive}`}
        aria-label="Halaman sebelumnya"
      >
        &laquo;
      </button>

      {getVisiblePages().map((page, idx) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 text-sm">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`${btnBase} ${page === currentPage ? btnActive : btnInactive}`}
            aria-current={page === currentPage ? 'page' : undefined}
            aria-label={`Halaman ${page}`}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`${btnBase} ${currentPage >= totalPages ? btnDisabled : btnInactive}`}
        aria-label="Halaman selanjutnya"
      >
        &raquo;
      </button>

      {totalItems !== undefined && itemsPerPage !== undefined && startItem && endItem && (
        <span className="ml-2 text-xs text-gray-400">
          Menampilkan {startItem}-{endItem} dari {totalItems} item
        </span>
      )}
    </nav>
  );
}
