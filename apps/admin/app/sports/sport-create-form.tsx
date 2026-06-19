"use client";

import { useActionState } from "react";
import { createSport, type SportState } from "./actions";

const initial: SportState = { error: null };

export function SportCreateForm() {
  const [state, formAction, pending] = useActionState(createSport, initial);

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-2 p-4">
      {state.error && <p className="w-full rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <div>
        <label className="label" htmlFor="name">カテゴリ名</label>
        <input id="name" name="name" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="slug">slug</label>
        <input id="slug" name="slug" className="input" required placeholder="tennis" />
      </div>
      <div>
        <label className="label" htmlFor="category_type">区分</label>
        <select id="category_type" name="category_type" className="input">
          <option value="sports">スポーツ</option>
          <option value="outdoor">アウトドア</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="display_order">表示順</label>
        <input id="display_order" name="display_order" type="number" className="input max-w-[6rem]" defaultValue={0} />
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>追加</button>
    </form>
  );
}
