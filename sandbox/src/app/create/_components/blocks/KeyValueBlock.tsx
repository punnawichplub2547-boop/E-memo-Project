"use client";

type Pair = { key: string; value: string };
type Props = { pairs: Pair[]; onChange: (pairs: Pair[]) => void };

export function KeyValueBlock({ pairs, onChange }: Props) {
  const setPair = (i: number, patch: Partial<Pair>) =>
    onChange(pairs.map((pair, idx) => (idx === i ? { ...pair, ...patch } : pair)));

  return (
    <div className="em-block-kv">
      {pairs.map((pair, i) => (
        <div key={i} className="em-block-kv-row">
          <input
            className="em-input"
            value={pair.key}
            placeholder="หัวข้อ เช่น Project"
            onChange={(e) => setPair(i, { key: e.target.value })}
          />
          <input
            className="em-input"
            value={pair.value}
            placeholder="ค่า"
            onChange={(e) => setPair(i, { value: e.target.value })}
          />
          <button
            type="button"
            className="em-btn sm icon-only danger"
            aria-label="ลบรายการนี้"
            onClick={() => onChange(pairs.filter((_, idx) => idx !== i))}
          >
            🗑
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
