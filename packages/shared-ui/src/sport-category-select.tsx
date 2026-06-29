"use client";

import { useState } from "react";

// 種目の大分類/小分類カスケード選択（施設の「種別」入力に共用）。
// nodes は core.sports（公開中）。parent_id=null が大分類、それ以外が小分類。
// 送信フィールドは sport_parent / sport_child（id）。サーバー側で facility_sports に展開する。
export type SportNode = { id: string; name: string; parent_id: string | null };

export type SportCategorySelectProps = {
  nodes: SportNode[];
  defaultParentId?: string | null;
  defaultChildId?: string | null;
  required?: boolean;
};

export function SportCategorySelect({
  nodes,
  defaultParentId = "",
  defaultChildId = "",
  required = true,
}: SportCategorySelectProps) {
  const [parentId, setParentId] = useState(defaultParentId ?? "");
  const [childId, setChildId] = useState(defaultChildId ?? "");

  const parents = nodes.filter((n) => !n.parent_id);
  const children = nodes.filter((n) => n.parent_id === parentId);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor="sport_parent">種別（大分類）{required ? " *" : ""}</label>
        <select
          id="sport_parent"
          name="sport_parent"
          className="input"
          required={required}
          value={parentId}
          onChange={(e) => { setParentId(e.target.value); setChildId(""); }}
        >
          <option value="">選択</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
          {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
}
