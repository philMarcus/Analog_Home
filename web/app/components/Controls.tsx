"use client";

import type { Controls as ControlsType, Seed } from "../types";

type Props = {
  controls: ControlsType | null;
  seeds: Seed[];
  temp: number;
  seedInput: string;
  loading: boolean;
  onTempChange: (value: number) => void;
  onTempPointerDown: () => void;
  onTempPointerUp: (value: number) => void;
  onSeedInputChange: (value: string) => void;
  onSubmitSeed: () => void;
  seedError: string | null;
  tempError: string | null;
};

export default function Controls({
  controls,
  seeds,
  temp,
  seedInput,
  loading,
  onTempChange,
  onTempPointerDown,
  onTempPointerUp,
  onSeedInputChange,
  onSubmitSeed,
  seedError,
  tempError,
}: Props) {
  return (
    <div className="cyber-panel">
      {/* Temperature */}
      <div style={{ marginBottom: 16 }}>
        <div className="section-label">Temperature: {temp.toFixed(2)}</div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={temp}
          onChange={(e) => onTempChange(parseFloat(e.target.value))}
          onPointerDown={onTempPointerDown}
          onPointerUp={(e) => onTempPointerUp(parseFloat((e.target as HTMLInputElement).value))}
          className="cyber-slider"
        />
        {tempError && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-dim)" }}>
            {tempError}
          </div>
        )}
      </div>

      {/* Seeds */}
      <div>
        <div className="section-label">Plant a seed</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={seedInput}
            onChange={(e) => onSeedInputChange(e.target.value)}
            maxLength={200}
            placeholder="A thought, topic, or question..."
            onKeyDown={(e) => e.key === "Enter" && onSubmitSeed()}
            className="cyber-input"
            style={{ flex: 1 }}
          />
          <button
            disabled={loading || !seedInput.trim()}
            onClick={onSubmitSeed}
            className="cyber-button"
          >
            Send
          </button>
        </div>
        {seedError && (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--magenta)" }}>
            {seedError}
          </div>
        )}
        {seeds.length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px 12px",
              fontSize: 12,
              color: "var(--cyan-dim)",
            }}
          >
            {seeds.slice(0, 10).map((s) => (
              <div
                key={s.id}
                title={s.text}
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                &bull; {s.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-dim)" }}>
        Last updated: {controls?.updated_at ?? "\u2014"}
      </div>
    </div>
  );
}
