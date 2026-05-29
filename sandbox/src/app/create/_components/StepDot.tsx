export function StepDot({ n, label, active }: { n: string; label: string; active?: boolean }) {
  return (
    <div className="em-create-step">
      <div className={`em-create-step-dot ${active ? "is-active" : ""}`}>{n}</div>
      <div className={`em-create-step-label ${active ? "is-active" : ""}`}>{label}</div>
    </div>
  );
}
