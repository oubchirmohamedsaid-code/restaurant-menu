import { useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import type { OgtAddonGroup, OgtFlag, OgtMenuProduct } from "@shared/types";
import { Modal, TextField } from "../../components/ui";
import { MenuImage } from "./MenuImage";
import { imagePreview, parsePriceInput, priceInput, toFlag, uploadFile } from "./menu-utils";

export interface IngredientDraft {
  key: string;
  id?: number;
  name: string;
  priceCents: number;
  isExtra: OgtFlag;
  isRequired: OgtFlag;
}

export interface ProductSavePayload {
  info: {
    id?: number;
    categoryId: number;
    name: string;
    description: string;
    priceCents: number;
    isAvailable: OgtFlag;
  };
  imageFile: File | null;
  ingredients: IngredientDraft[];
  groupIds: number[];
}

let uidSeq = 0;
function uid(): string {
  uidSeq += 1;
  return `ing-${Date.now()}-${uidSeq}`;
}

export function ProductEditorModal({
  categoryId,
  categoryName,
  product,
  addonGroups,
  busy,
  onClose,
  onSave,
}: {
  categoryId: number;
  categoryName: string;
  product: OgtMenuProduct | null;
  addonGroups: OgtAddonGroup[];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: ProductSavePayload) => Promise<void>;
}) {
  const editing = product != null;
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(priceInput(product?.priceCents ?? 0));
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable === 1);
  const [file, setFile] = useState<File | null>(null);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    (product?.ingredients ?? []).map((i) => ({
      key: uid(),
      id: i.id,
      name: i.name,
      priceCents: i.priceCents,
      isExtra: i.isExtra,
      isRequired: i.isRequired,
    })),
  );
  const [groupIds, setGroupIds] = useState<number[]>(product?.addonGroupIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = file ? imagePreview(file) : editing ? product.imageUrl : "";

  function patchIngredient(key: string, patch: Partial<IngredientDraft>) {
    setIngredients((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function toggleGroup(id: number) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("اسم الطبق مطلوب");
      return;
    }
    const priceCents = parsePriceInput(price);
    if (priceCents == null) {
      setError("السعر غير صالح");
      return;
    }
    const badIng = ingredients.find((i) => !i.name.trim());
    if (badIng) {
      setError("مكوّن بدون اسم — أكمل الاسم أو احذف الصف");
      return;
    }
    setError(null);
    await onSave({
      info: {
        id: product?.id,
        categoryId,
        name: trimmed,
        description: description.trim(),
        priceCents,
        isAvailable: isAvailable ? 1 : 0,
      },
      imageFile: file,
      ingredients,
      groupIds,
    });
  }

  return (
    <Modal title={editing ? "تعديل الطبق" : "طبق جديد"} onClose={onClose} wide>
      <div className="grid max-h-[70vh] gap-5 overflow-auto sm:grid-cols-2">
        <div className="space-y-4">
          <p className="text-xs font-bold text-muted">الأصناف / {categoryName}</p>
          <TextField label="اسم الطبق" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: بيتزا مارغريتا" autoFocus />
          <TextField
            label="الوصف"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف قصير يظهر للزبون (اختياري)"
          />
          <TextField
            label="السعر (دج)"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-foreground">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="size-4 accent-accent"
            />
            متاح للطلب
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-bold text-foreground">صورة الطبق</span>
            <div className="flex items-center gap-3">
              <MenuImage url={previewUrl} alt={name || "الطبق"} className="size-16 rounded-xl border border-line" iconClassName="size-6" />
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
            {editing && product.imageUrl && !file && (
              <p className="mt-1 text-[10px] font-semibold text-muted">اترك الصورة كما هي لتعديل بقية الحقول دون تغييرها.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-card-2/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-black text-foreground">المكونات والإضافات</h4>
              <button
                onClick={() =>
                  setIngredients((prev) => [...prev, { key: uid(), name: "", priceCents: 0, isExtra: 0, isRequired: 0 }])
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-accent-strong"
              >
                <Plus className="size-3.5" />
                إضافة
              </button>
            </div>
            {ingredients.length === 0 ? (
              <p className="py-3 text-center text-[11px] font-semibold text-muted">لا توجد مكونات بعد — أضف مكوناً أساسياً أو إضافة.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-auto">
                {ingredients.map((ing) => (
                  <li key={ing.key} className="rounded-xl border border-line bg-surface p-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={ing.name}
                        onChange={(e) => patchIngredient(ing.key, { name: e.target.value })}
                        placeholder="اسم المكوّن"
                        className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs font-semibold outline-none focus:border-accent"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceInput(ing.priceCents)}
                        onChange={(e) => patchIngredient(ing.key, { priceCents: parsePriceInput(e.target.value) ?? 0 })}
                        title="السعر الإضافي بالدج"
                        className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-xs font-semibold outline-none focus:border-accent"
                      />
                      <select
                        value={ing.isExtra}
                        onChange={(e) =>
                          patchIngredient(ing.key, {
                            isExtra: toFlag(e.target.value),
                            isRequired: toFlag(e.target.value) === 1 ? ing.isRequired : 0,
                          })
                        }
                        className="h-8 rounded-lg border border-line bg-surface px-1 text-[11px] font-bold outline-none focus:border-accent"
                      >
                        <option value="0">أساسي</option>
                        <option value="1">إضافة</option>
                      </select>
                      <button
                        onClick={() => setIngredients((prev) => prev.filter((i) => i.key !== ing.key))}
                        title="حذف المكوّن"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {ing.isExtra === 1 && (
                      <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 ps-1 text-[11px] font-bold text-muted">
                        <input
                          type="checkbox"
                          checked={ing.isRequired === 1}
                          onChange={(e) => patchIngredient(ing.key, { isRequired: e.target.checked ? 1 : 0 })}
                          className="size-3.5 accent-accent"
                        />
                        إلزامي (لا يمكن رفضه من الزبون)
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-line bg-card-2/40 p-3">
            <h4 className="mb-2 text-xs font-black text-foreground">مجموعات الإضافات (حجم، نوع…)</h4>
            {addonGroups.length === 0 ? (
              <p className="py-2 text-center text-[11px] font-semibold text-muted">لا توجد مجموعات — أنشئها من زر «مجموعات الإضافات».</p>
            ) : (
              <ul className="max-h-44 space-y-1.5 overflow-auto">
                {addonGroups.map((g) => {
                  const checked = groupIds.includes(g.id);
                  return (
                    <li key={g.id}>
                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-2 text-xs font-bold transition-colors ${
                          checked ? "border-accent bg-accent/10 text-foreground" : "border-line bg-surface text-muted hover:bg-card-2"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroup(g.id)}
                            className="size-4 accent-accent"
                          />
                          {g.name}
                        </span>
                        <span className="text-[10px] font-semibold text-muted">
                          {g.options.length} خيار · {g.productCount} طبق
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-4">
        <button
          onClick={onClose}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {busy && <Upload className="size-4 animate-pulse" />}
          {editing ? "حفظ التعديلات" : "إنشاء الطبق"}
        </button>
      </div>
    </Modal>
  );
}
