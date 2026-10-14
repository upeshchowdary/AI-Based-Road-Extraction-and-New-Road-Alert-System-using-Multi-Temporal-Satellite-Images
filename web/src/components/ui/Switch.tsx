/** Accessible switch: a native button with role="switch" (Space/Enter toggle it). No library needed. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
  id?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-label={label}
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault() // inside a <label>, don't let the click bubble into a second toggle
        onCheckedChange(!checked)
      }}
      className="relative h-5 w-9 shrink-0 rounded-full border border-line-strong bg-surface2 transition-colors duration-200 aria-checked:border-sentinel/70 aria-checked:bg-sentinel/25"
    >
      <span
        aria-hidden
        className={`block size-3.5 rounded-full transition-transform duration-200 ease-ui ${checked ? 'translate-x-[17px] bg-sentinel' : 'translate-x-[2px] bg-muted'}`}
      />
    </button>
  )
}
