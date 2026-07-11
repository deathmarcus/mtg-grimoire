export function SetProgressBar({
  owned,
  total,
  pct,
}: {
  owned: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="set-progress">
      <div className="set-progress-track">
        <div className="set-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="set-progress-label">
        {owned} / {total} · {pct}%
      </span>
    </div>
  );
}
