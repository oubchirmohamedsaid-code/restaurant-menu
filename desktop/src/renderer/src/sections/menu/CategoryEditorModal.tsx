import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import type { OgtFlag, OgtMenuCategory } from "@shared/types";
import { Modal, TextField } from "../../components/ui";
import { MenuImage } from "./MenuImage";
import { imagePreview, uploadFile } from "./menu-utils";

export interface CategorySaveInput {
  nameAr: string;
  icon: string;
  isHidden: OgtFlag;
  imageUrl: string | null;
}

export function CategoryEditorModal({
  category,
  busy,
  onClose,
  onSave,
}: {
  category: OgtMenuCategory | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: CategorySaveInput) => Promise<void>;
}) {
  const editing = category != null;
  const [nameAr, setNameAr] = useState(category?.nameAr ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [isHidden, setIsHidden] = useState(category?.isHidden === 1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!nameAr.trim()) {
      setError("الاسم مطلوب");
      return;
    }
    setError(null);
    let imageUrl: string | null = null;
    if (file) {
      setUploading(true);
      const res = await uploadFile(file);
      setUploading(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      imageUrl = res.path;
    }
    await onSave({ nameAr: nameAr.trim(), icon: icon.trim(), isHidden: isHidden ? 1 : 0, imageUrl });
  }

  const previewUrl = file ? imagePreview(file) : editing ? category.imageUrl : "";

  return (
    <Modal title={editing ? "تعديل الصنف" : "صنف جديد"} onClose={onClose}>
      <div className="space-y-4">
        <TextField
          label="اسم الصنف"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder="مثال: بيتزا، سندويتشات، مشروبات…"
          autoFocus
        />
        <TextField
          label="أيقونة (إيموجي)"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🍕"
          maxLength={8}
        />

        <div>
          <span className="mb-1.5 block text-sm font-bold text-foreground">صورة الصنف (اختياري)</span>
          <div className="flex items-center gap-3">
            <MenuImage url={previewUrl} alt={nameAr || "الصنف"} className="size-16 rounded-xl border border-line" iconClassName="size-6" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-foreground transition-colors hover:bg-card-2"
            >
              <ImagePlus className="size-4 text-accent" />
              اختيار صورة
            </button>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 className="size-4" />
                إزالة
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {editing && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-foreground">
            <input
              type="checkbox"
              checked={isHidden}
              onChange={(e) => setIsHidden(e.target.checked)}
              className="size-4 accent-accent"
            />
            إخفاء هذا الصنف من واجهة الزبون
          </label>
        )}

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            onClick={onClose}
            disabled={busy || uploading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || uploading}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {uploading ? <Upload className="size-4 animate-pulse" /> : null}
            {editing ? "حفظ التعديلات" : "إنشاء الصنف"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
