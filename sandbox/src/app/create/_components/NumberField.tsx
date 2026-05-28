import {
  clampNonNegativeInputElement,
  coerceNonNegativeNumber,
  shouldBlockNonNegativeNumberKey,
} from "@/lib/number-input";

export function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="em-field">
      <label className="em-label">{label}</label>
      <div className="em-input-prefix">
        <span className="pre">฿</span>
        <input
          type="number"
          min={0}
          value={value}
          onInput={(e) => clampNonNegativeInputElement(e.currentTarget)}
          onBlur={(e) => clampNonNegativeInputElement(e.currentTarget)}
          onKeyDown={(e) => {
            if (shouldBlockNonNegativeNumberKey(e.key)) e.preventDefault();
          }}
          onChange={(e) => onChange(coerceNonNegativeNumber(e.target.value))}
        />
      </div>
    </div>
  );
}
