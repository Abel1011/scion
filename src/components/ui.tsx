import { ChevronDown } from "lucide-react";

/** Shared input/textarea styling: subtle leaf focus ring, raised surface. */
export const fieldClass =
  "w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink placeholder-ink-faint focus:border-leaf/60 focus:outline-none focus:ring-2 focus:ring-leaf/15";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /** Extra classes merged onto the native select. */
  className?: string;
};

/**
 * Native <select> styled to match the rest of the app: no platform chrome,
 * a custom chevron, and the same focus ring as text inputs.
 */
export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full cursor-pointer appearance-none rounded-lg border border-line bg-raised px-3 py-2 pr-9 text-sm text-ink focus:border-leaf/60 focus:outline-none focus:ring-2 focus:ring-leaf/15 ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
    </div>
  );
}

/** Shimmering placeholder block. Give it width/height via className. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}
