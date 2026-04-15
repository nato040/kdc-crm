import Link from "next/link";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface SortHeaderProps {
  label: string;
  column: string;
  currentSort: string | null;
  currentDir: "asc" | "desc";
  basePath: string;
  className?: string;
  /** Extra query params to preserve (e.g. date filter from/to) */
  extraParams?: Record<string, string>;
  /** Tooltip for the column header */
  title?: string;
}

/**
 * A column header that links to the same page with sort query params.
 * No client JS — the sort is a full page navigation via <a href>.
 * Preserves extraParams (e.g. date filter state) in the generated URL.
 */
export function SortHeader({
  label,
  column,
  currentSort,
  currentDir,
  basePath,
  className,
  extraParams,
  title,
}: SortHeaderProps) {
  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams({ sort: column, dir: nextDir, ...extraParams });
  const href = `${basePath}?${params.toString()}`;

  return (
    <th
      title={title}
      className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-taupe-dark ${className ?? ""}`}
    >
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:text-charcoal transition-colors"
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </Link>
    </th>
  );
}
