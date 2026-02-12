"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  label: string;
  defaultVisible?: boolean;         // default true
  sortable?: boolean;               // default true
  align?: "left" | "right" | "center";
  render: (item: T) => React.ReactNode;
  sortValue?: (item: T) => string | number;
  filterValue?: (item: T) => string; // value used for text search
}

export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

type SortDir = "asc" | "desc";

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  filters?: FilterOption[];
  storageKey: string;               // key for saving column prefs
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  actions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
  onSavePreferences?: (visibleColumns: string[]) => void;
  savedPreferences?: string[] | null;
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export default function DataTable<T extends { id: string }>({
  data,
  columns,
  filters = [],
  storageKey,
  emptyIcon,
  emptyTitle = "Geen resultaten",
  emptyDescription,
  emptyAction,
  actions,
  onRowClick,
  onSavePreferences,
  savedPreferences,
}: DataTableProps<T>) {
  // Column visibility
  const defaultVisible = useMemo(
    () => columns.filter((c) => c.defaultVisible !== false).map((c) => c.key),
    [columns]
  );

  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    savedPreferences ?? defaultVisible
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Update when savedPreferences load
  useEffect(() => {
    if (savedPreferences && savedPreferences.length > 0) {
      setVisibleColumns(savedPreferences);
    }
  }, [savedPreferences]);

  // Search & filters
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Sort
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Close column picker on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    if (showColumnPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColumnPicker]);

  // Filter + Search
  const filtered = useMemo(() => {
    let result = data;

    // Text search across all visible columns
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        columns.some((col) => {
          if (!visibleColumns.includes(col.key)) return false;
          const val = col.filterValue?.(item) ?? "";
          return val.toLowerCase().includes(q);
        })
      );
    }

    // Dropdown filters
    for (const [key, value] of Object.entries(activeFilters)) {
      if (!value) continue;
      result = result.filter((item) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        const val = col.filterValue?.(item) ?? col.sortValue?.(item)?.toString() ?? "";
        return val === value;
      });
    }

    return result;
  }, [data, search, activeFilters, columns, visibleColumns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const getValue = col.sortValue ?? col.filterValue ?? (() => "");
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filtered, sortKey, sortDir, columns]);

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (col?.sortable === false) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleColumn = useCallback(
    (key: string) => {
      setVisibleColumns((prev) => {
        const next = prev.includes(key)
          ? prev.filter((k) => k !== key)
          : [...prev, key];
        onSavePreferences?.(next);
        return next;
      });
    },
    [onSavePreferences]
  );

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
  const hasActiveSearch = search.trim().length > 0;

  const visibleCols = columns.filter((c) => visibleColumns.includes(c.key));

  if (data.length === 0) {
    return (
      <div className="card text-center py-12">
        {emptyIcon}
        {emptyTitle && (
          <h3 className="mt-4 text-sm font-medium text-gray-900">{emptyTitle}</h3>
        )}
        {emptyDescription && (
          <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Zoeken..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 py-2 text-sm"
          />
          {hasActiveSearch && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown filters */}
        {filters.map((filter) => (
          <select
            key={filter.key}
            value={activeFilters[filter.key] || ""}
            onChange={(e) =>
              setActiveFilters((prev) => ({ ...prev, [filter.key]: e.target.value }))
            }
            className="input py-2 text-sm w-auto pr-8"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {/* Clear filters */}
        {(activeFilterCount > 0 || hasActiveSearch) && (
          <button
            onClick={() => {
              setSearch("");
              setActiveFilters({});
            }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Wis filters
          </button>
        )}

        {/* Column picker */}
        <div className="relative ml-auto" ref={pickerRef}>
          <button
            onClick={() => setShowColumnPicker((v) => !v)}
            className="btn-ghost text-xs py-2 px-3"
            title="Kolommen beheren"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            <span className="hidden sm:inline">Kolommen</span>
          </button>

          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Zichtbare kolommen
              </p>
              <div className="space-y-1">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
              <button
                onClick={() => {
                  setVisibleColumns(defaultVisible);
                  onSavePreferences?.(defaultVisible);
                }}
                className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 py-1"
              >
                Standaard herstellen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      {(hasActiveSearch || activeFilterCount > 0) && (
        <p className="mb-2 text-xs text-gray-500">
          {sorted.length} van {data.length} resultaten
        </p>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100">
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${col.sortable !== false ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable !== false && sortKey === col.key && (
                        <svg
                          className={`h-3 w-3 transition-transform ${
                            sortDir === "desc" ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
                {actions && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleCols.length + (actions ? 1 : 0)}
                    className="px-6 py-12 text-center text-sm text-gray-400"
                  >
                    Geen resultaten gevonden
                  </td>
                </tr>
              ) : (
                sorted.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 transition-colors${onRowClick ? " cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {visibleCols.map((col) => (
                      <td
                        key={col.key}
                        className={`px-6 py-4 ${col.align === "right" ? "text-right" : ""}`}
                      >
                        {col.render(item)}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>{actions(item)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
