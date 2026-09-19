/** Missing-image fallback: category icon on a neutral tile, per spec. */
export function ImagePlaceholder({ icon, className = '' }: { icon: string | null; className?: string }): JSX.Element {
  return (
    <div className={`flex items-center justify-center bg-surface-container ${className}`} aria-hidden="true">
      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">{icon ?? 'smartphone'}</span>
    </div>
  );
}
