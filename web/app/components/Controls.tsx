"use client";

import { useEffect, useRef, useState } from "react";
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
  // Brief confirmation of the seed the user just planted. Fades after ~5s.
  // Previously the full pending-seeds list stayed visible until the agent
  // next woke, which could be hours — that was noisy, especially with
  // other visitors' seeds mixed in. Now we just show a quick "seed planted"
  // toast and trust the user to know they submitted it.
  const [lastPlanted, setLastPlanted] = useState<string>("");
  const [showPlanted, setShowPlanted] = useState<boolean>(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSubmitSeed() {
    const text = seedInput.trim();
    if (!text) return;
    setLastPlanted(text);
    setShowPlanted(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setShowPlanted(false), 4500);
    onSubmitSeed();
  }

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // Silence the unused-prop lint: `seeds` is still passed from the parent
  // but we no longer render the persistent list. Accessing length keeps
  // the prop in play in case we re-introduce a count indicator.
  void seeds.length;

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
            onKeyDown={(e) => e.key === "Enter" && handleSubmitSeed()}
            className="cyber-input"
            style={{ flex: 1 }}
          />
          <button
            disabled={loading || !seedInput.trim()}
            onClick={handleSubmitSeed}
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
        {lastPlanted && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "var(--cyan-dim)",
              opacity: showPlanted ? 1 : 0,
              transition: "opacity 0.6s ease-out",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            &check; seed planted: {lastPlanted}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-dim)" }}>
        Last updated: {controls?.updated_at ?? "\u2014"}
      </div>
    </div>
  );
}
