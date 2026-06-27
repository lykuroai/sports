"use client";

import { useActionState, useState } from "react";
import { createSport, type SportState } from "./actions";

const initial: SportState = { error: null };

// 親（大分類）を選ぶと小分類、未選択なら大分類として作成する。区分は小分類では親から継承するため隠す。
export function SportCreateForm({ parents }: { parents: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createSport, initial);
  const [parentId, setParentId] = useState("");
  const isChild = parentId !== "";

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-2 p-4">
      {state.error && <p className="w-full rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <div>
        <label className="label" htmlFor="parent_id">親（大分類）</label>
        <select
          id="parent_id"
          name="parent_id"
          className="input"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">（なし＝大分類として作成）</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.name} の小分類</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="name">カテゴリ名</label>
        <input id="name" name="name" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="slug">slug</label>
        <input id="slug" name="slug" className="input" required placeholder="tennis" />
      </div>
      {!isChild && (
        <div>
          <label className="label" htmlFor="category_type">区分</label>
          <select id="category_type" name="category_type" className="input">
            <option value="sports">スポーツ</option>
            <option value="outdoor">アウトドア</option>
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="display_order">表示順</label>
        <input id="display_order" name="display_order" type="number" className="input max-w-[6rem]" defaultValue={0} />
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {isChild ? "小分類を追加" : "大分類を追加"}
      </button>
    </form>
  );
}
