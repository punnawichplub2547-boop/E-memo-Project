"use client";

import type { CSSProperties, ReactNode } from "react";
import type { MemoRecord } from "@/lib/approval";

type Props = {
  memo: MemoRecord;
  /**
   * The exact same JSX the standard-mode drawer renders for the Request
   * Items / Price Comparison sections, lifted out of drawer-panel.tsx into
   * variables so both render paths share one implementation (VAT/discount
   * rules from V2 §2 and all formatting ride along automatically). A
   * "system" block renders whichever of these its `ref` names — never a
   * re-implementation.
   */
  systemSlots: { priceComparison: ReactNode; requestItems: ReactNode };
};

const EMPTY_STYLE: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  background: "var(--surface-2)",
  border: "1px dashed var(--line-2)",
  fontSize: 12.5,
  color: "var(--muted)",
  fontStyle: "italic",
};

const PARAGRAPH_STYLE: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: "var(--ink-2)",
  margin: 0,
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  whiteSpace: "pre-wrap",
};

const KV_CARD_STYLE: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  display: "grid",
  gap: 8,
  fontSize: 12.5,
};

const KV_ROW_STYLE: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  margin: 0,
};

const TABLE_WRAP_STYLE: CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--line)",
  overflow: "hidden",
  background: "var(--surface)",
};

/**
 * Renders a free-form memo's body blocks in the queue drawer, in the exact
 * order the requester arranged them. "system" blocks render the same
 * Request Items / Price Comparison JSX the standard-mode drawer uses (see
 * `systemSlots`) — so a free-form memo's price/discount/VAT display is
 * never a second implementation to keep in sync.
 */
export function MemoBodyBlocksSection({ memo, systemSlots }: Props) {
  const blocks = memo.bodyBlocks ?? [];

  return (
    <section>
      <div className="em-eyebrow" style={{ marginBottom: 8 }}>เนื้อหาเมโม / Memo Body</div>
      {blocks.length === 0 ? (
        <div style={EMPTY_STYLE}>ไม่มีเนื้อหาในเมโมฉบับนี้</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {blocks.map((block) => {
            if (block.type === "paragraph") {
              return (
                <p key={block.id} style={PARAGRAPH_STYLE}>
                  {block.text}
                </p>
              );
            }

            if (block.type === "keyValue") {
              return (
                <dl key={block.id} style={KV_CARD_STYLE}>
                  {block.pairs.map((pair, i) => (
                    <div key={i} style={KV_ROW_STYLE}>
                      <dt style={{ color: "var(--muted)" }}>{pair.key || "—"}</dt>
                      <dd style={{ margin: 0, color: "var(--ink)", fontWeight: 500, textAlign: "right" }}>
                        {pair.value || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              );
            }

            if (block.type === "table") {
              return (
                <div key={block.id} style={TABLE_WRAP_STYLE}>
                  {/* .em-table-scroll: the project's existing mobile-overflow-safety
                      wrapper (globals.css) — transparent on desktop, becomes a real
                      overflow-x scroller under the 768px breakpoint. Reused here
                      instead of a new class; see Task 13 report for why. */}
                  <div className="em-table-scroll">
                    <table className="em-table" style={{ fontSize: 12, width: "100%" }}>
                      <thead>
                        <tr>
                          {block.headers.map((header, i) => (
                            <th key={i}>{header || "—"}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, r) => (
                          <tr key={r}>
                            {row.map((cell, c) => (
                              <td key={c}>{cell || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // block.type === "system": render the real Request Items / Price
            // Comparison JSX passed in via systemSlots — never a copy.
            return <div key={block.id}>{systemSlots[block.ref]}</div>;
          })}
        </div>
      )}
    </section>
  );
}
