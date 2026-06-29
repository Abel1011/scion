export function ScionMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22V9" />
      <path d="M12 15c0-3.3 2.6-6 6.5-6.5C18.5 12 16 14.5 12 15Z" />
      <path d="M12 12C12 8.7 9.4 6 5.5 5.5 5.5 9 8 11.5 12 12Z" />
      <circle cx="12" cy="4.5" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
