"use client";

import { setKeyValuePair, type KeyValuePair } from "@/lib/memo-body-blocks";
import { IconTrash } from "@/components/icons";

type Props = { pairs: KeyValuePair[]; onChange: (pairs: KeyValuePair[]) => void };

export function KeyValueBlock({ pairs, onChange }: Props) {
  const setPair = (i: number, patch: Partial<KeyValuePair>) => onChange(setKeyValuePair(pairs, i, patch));

  return (
    <div className="em-block-kv">
      {pairs.map((pair, i) => (
        <div key={i} className="em-block-kv-row">
          <input
            className="em-input"
            value={pair.key}
            placeholder="หัวข้อ เช่น Project"
            aria-label={`หัวข้อที่ ${i + 1}`}
            onChange={(e) => setPair(i, { key: e.target.value })}
          />
          <input
            className="em-input"
            value={pair.value}
            placeholder="ค่า"
            aria-label={`ค่าของ ${pair.key.trim() || `หัวข้อที่ ${i + 1}`}`}
            onChange={(e) => setPair(i, { value: e.target.value })}
          />
          <button
            type="button"
            className="em-btn sm icon-only danger"
            aria-label={`ลบหัวข้อที่ ${i + 1}`}
            title="ลบหัวข้อนี้"
            onClick={() => onChange(pairs.filter((_, idx) => idx !== i))}
          >
            <IconTrash size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="em-btn sm ghost"
        onClick={() => onChange([...pairs, { key: "", value: "" }])}
      >
        + เพิ่มหัวข้อ
      </button>
    </div>
  );
}
