export function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="em-field">
      <label className="em-label">{label}</label>
      <div className="em-input-prefix">
        <span className="pre">฿</span>
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}
