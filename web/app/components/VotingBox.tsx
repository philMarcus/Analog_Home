"use client";

import type { Controls } from "../types";

type Props = {
  controls: Controls | null;
  loading: boolean;
  onVote: (choice: "1" | "2" | "3") => void;
  error: string | null;
};

export default function VotingBox({ controls, loading, onVote, error }: Props) {
  return (
    <div className="cyber-panel voting-box">
      <div className="section-label" style={{ textAlign: "center", marginBottom: 10 }}>
        Cast Your Vote
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button disabled={loading} onClick={() => onVote("1")} className="cyber-button vote-btn">
          {controls?.vote_label_1 ?? "emergence"}
          <span className="vote-count">{controls?.vote_1 ?? 0}</span>
        </button>
        <button disabled={loading} onClick={() => onVote("2")} className="cyber-button vote-btn">
          {controls?.vote_label_2 ?? "entropy"}
          <span className="vote-count">{controls?.vote_2 ?? 0}</span>
        </button>
        <button disabled={loading} onClick={() => onVote("3")} className="cyber-button vote-btn">
          {controls?.vote_label_3 ?? "self"}
          <span className="vote-count">{controls?.vote_3 ?? 0}</span>
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--magenta)", textAlign: "center" }}>
          {error}
        </div>
      )}
      {controls?.trajectory_reason && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", fontStyle: "italic", textAlign: "center" }}>
          {controls.trajectory_reason}
        </div>
      )}
    </div>
  );
}
