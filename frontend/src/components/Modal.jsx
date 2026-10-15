export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-pure/50" onClick={onClose} />
      {/* Surface Bone, radius 6px — bukan membulat besar (PRD Section 6), tanpa shadow */}
      <div
        className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto rounded-card border-2 border-pure bg-bone text-ink`}
      >
        <div className="flex items-center justify-between border-b border-ink px-6 py-4">
          <h2 className="font-display text-base uppercase leading-[0.9] tracking-wide text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-pill border border-ink px-2 py-0.5 font-mono text-xs leading-none text-ink transition hover:bg-ink hover:text-bone"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
