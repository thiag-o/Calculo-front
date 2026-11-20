// Icon of the problem note, drawn with the Lucide (ISC) "circle-alert" strokes, estilos.md §6: currentColor, 2 stroke at 14px.

export function AlertIcon() {
  return (
    <svg
      className="fc-formula-note-icon"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
