import Modal from './Modal';

export default function ConfirmDialog({ title, message, confirmLabel = 'Hapus', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-coal/80">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-full border border-line px-5 py-2 text-xs font-semibold uppercase tracking-wider text-coal transition hover:bg-line/50"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="rounded-full bg-clay px-5 py-2 text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-clay/90"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}