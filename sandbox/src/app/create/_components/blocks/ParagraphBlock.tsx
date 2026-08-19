"use client";

type Props = { text: string; onChange: (text: string) => void };

export function ParagraphBlock({ text, onChange }: Props) {
  return (
    <textarea
      className="em-textarea"
      rows={4}
      value={text}
      placeholder="พิมพ์เนื้อความ เช่น เนื่องจากเครื่องจักรสายการผลิตขัดข้อง..."
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
