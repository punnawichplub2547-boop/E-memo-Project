"use client";

import { MAX_TABLE_COLUMNS, TABLE_COLUMN_WARN_AT } from "@/lib/memo-body-blocks";

type Props = {
  headers: string[];
  rows: string[][];
  onChange: (next: { headers: string[]; rows: string[][] }) => void;
};

export function TableBlock({ headers, rows, onChange }: Props) {
  const setHeader = (i: number, value: string) =>
    onChange({ headers: headers.map((h, idx) => (idx === i ? value : h)), rows });

  const setCell = (r: number, c: number, value: string) =>
    onChange({
      headers,
      rows: rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row)),
    });

  const addColumn = () => {
    if (headers.length >= MAX_TABLE_COLUMNS) return;
    onChange({ headers: [...headers, ""], rows: rows.map((row) => [...row, ""]) });
  };

  const addRow = () => onChange({ headers, rows: [...rows, headers.map(() => "")] });

  const removeRow = (r: number) => onChange({ headers, rows: rows.filter((_, ri) => ri !== r) });

  return (
    <div className="em-block-table">
      <div className="em-block-table-scroll">
        <table className="em-table">
          <thead>
            <tr>
              {headers.map((header, i) => (
                <th key={i}>
                  <input
                    className="em-table-input"
                    value={header}
                    placeholder={`คอลัมน์ ${i + 1}`}
                    onChange={(e) => setHeader(i, e.target.value)}
                  />
                </th>
              ))}
              <th aria-label="ลบแถว" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input
                      className="em-table-input"
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="em-btn sm icon-only danger"
                    onClick={() => removeRow(r)}
                    aria-label="ลบแถวนี้"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="em-block-table-actions">
        <button type="button" className="em-btn sm ghost" onClick={addRow}>
          + เพิ่มแถว
        </button>
        <button
          type="button"
          className="em-btn sm ghost"
          onClick={addColumn}
          disabled={headers.length >= MAX_TABLE_COLUMNS}
        >
          + เพิ่มคอลัมน์ ({headers.length}/{MAX_TABLE_COLUMNS})
        </button>
      </div>

      {headers.length > TABLE_COLUMN_WARN_AT ? (
        <p className="em-hint em-hint-warn">
          คอลัมน์เยอะทำให้ตัวอักษรถูกบีบจนอ่านยากเมื่อพิมพ์ลงกระดาษ A4
        </p>
      ) : null}
    </div>
  );
}
