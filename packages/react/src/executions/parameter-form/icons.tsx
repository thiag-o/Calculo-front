// Lucide icons (estilos.md §6) of the parameters form: 1.5 stroke, currentColor, decorative.

/** The size of an icon in a small button (estilos.md §6: 16px, 14px in small buttons). */
const SMALL_ICON_SIZE = 14;

/** Lucide "x": removes a chosen value (the tag's button is small). */
export function CloseIcon() {
  return (
    <svg
      width={SMALL_ICON_SIZE}
      height={SMALL_ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
