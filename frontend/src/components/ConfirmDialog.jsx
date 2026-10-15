import Modal from './Modal';

export default function ConfirmDialog({ title, message, confirmLabel = 'Hapus', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink/80">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-pill border border-ink bg-bone px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink hover:text-bone"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="rounded-pill border border-firecracker bg-firecracker px-5 py-2 font-grotesk text-xs font-bold uppercase tracking-[0.05em] text-bone transition hover:bg-bone hover:text-firecracker"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
