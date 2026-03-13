import type { Locale, PreviewDialogState } from "../workspace-types";
import { localize } from "../workspace-copy";

type MediaPreviewDialogProps = {
  preview: PreviewDialogState | null;
  locale: Locale;
  onClose: () => void;
};

export function MediaPreviewDialog(props: MediaPreviewDialogProps) {
  const { preview, locale, onClose } = props;
  if (!preview) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-[0_25px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={preview.title}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="truncate text-sm font-semibold text-slate-100">{preview.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {localize(locale, "关闭", "Close")}
          </button>
        </div>
        <div className="bg-slate-950 p-4">
          {preview.kind === "image" ? (
            <div className="flex justify-center rounded-2xl bg-slate-900 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.title} className="max-h-[74vh] w-auto rounded-xl object-contain" />
            </div>
          ) : (
            <div className="rounded-2xl bg-black p-2">
              <video
                className="max-h-[74vh] w-full rounded-xl bg-black object-contain"
                controls
                autoPlay
                preload="metadata"
                src={preview.url}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
