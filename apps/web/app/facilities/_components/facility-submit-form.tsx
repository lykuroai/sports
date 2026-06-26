"use client";

import { useActionState, useState } from "react";
import { PREFECTURES } from "@spotomo/shared-types";
import type { SubmitState } from "./types";
import type { SportNode } from "../../../lib/category";

const initial: SubmitState = { error: null };

type Props = {
  // サーバーアクション（運営者=submitFacility / 一般=registerFacility）を受け取り共用する。
  action: (prev: SubmitState, formData: FormData) => Promise<SubmitState>;
  doneMessage?: string;
  // 渡された場合、種別を種目ツリーの大分類/小分類セレクトにする（一般登録）。
  // 未指定なら従来の自由入力 facility_type（運営者申請）。
  sportNodes?: SportNode[];
};

export function FacilitySubmitForm({ action, doneMessage, sportNodes }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");

  if (state.ok) {
    return (
      <div className="card p-6 text-sm text-green-700">
        {doneMessage ?? "申請を受け付けました。管理者の承認後に施設として公開されます。"}
      </div>
    );
  }

  const parents = sportNodes?.filter((n) => !n.parent_id) ?? [];
  const children = sportNodes?.filter((n) => n.parent_id === parentId) ?? [];

  return (
    <form action={formAction} className="card space-y-4 p-6">
      {state.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}

      <div>
        <label className="label" htmlFor="name">施設名</label>
        <input id="name" name="name" className="input" required maxLength={200} />
      </div>

      {sportNodes ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sport_parent">種別（大分類）</label>
            <select
              id="sport_parent"
              name="sport_parent"
              className="input"
              required
              value={parentId}
              onChange={(e) => {
                setParentId(e.target.value);
                setChildId("");
              }}
            >
              <option value="">選択</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sport_child">種別（小分類）</label>
            <select
              id="sport_child"
              name="sport_child"
              className="input"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              disabled={!parentId || children.length === 0}
            >
              <option value="">
                {!parentId ? "大分類を先に選択" : children.length === 0 ? "小分類なし" : "選択（任意）"}
              </option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="facility_type">種別（例: ゴルフ場 / 体育館）</label>
          <input id="facility_type" name="facility_type" className="input" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="prefecture">都道府県</label>
          <select id="prefecture" name="prefecture" className="input" defaultValue="">
            <option value="">選択</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">市区町村</label>
          <input id="city" name="city" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="address">住所</label>
        <input id="address" name="address" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="source_url">出典 URL（推奨）</label>
        <input id="source_url" name="source_url" type="url" className="input" placeholder="https://..." />
      </div>

      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "送信中..." : "申請する"}
      </button>
    </form>
  );
}
