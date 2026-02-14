"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact, Controls as ControlsType, Seed, State } from "./types";
import ControlsPanel from "./components/Controls";
import CrtTerminal from "./components/CrtTerminal";
import CrystalWrapper from "./components/CrystalWrapper";
import NavBeams from "./components/NavBeams";
import VotingBox from "./components/VotingBox";

export default function Home() {
  const API = useMemo(() => "/api/proxy", []);
  const [controls, setControls] = useState<ControlsType | null>(null);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const lastSeenTopIdRef = useRef<number | null>(null);
  const [temp, setTemp] = useState<number>(0.7);
  const [seedInput, setSeedInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const draggingTempRef = useRef<boolean>(false);

  async function fetchData() {
    try {
      const [stateRes, artsRes] = await Promise.all([
        fetch(`${API}/state`),
        fetch(`${API}/artifacts?limit=5`),
      ]);
      if (!stateRes.ok || !artsRes.ok) return;
      const stateData = (await stateRes.json()) as State;
      const artsData = (await artsRes.json()) as Artifact[];
      setControls(stateData.controls);
      if (!draggingTempRef.current) {
        setTemp(stateData.controls.temperature);
      }
      setSeeds(stateData.seeds);
      if (artsData.length > 0) {
        setArtifacts(artsData);
      }
      if (artsData.length > 0) {
        const topId = artsData[0].id;
        if (lastSeenTopIdRef.current === null || topId !== lastSeenTopIdRef.current) {
          setExpanded(topId);
          lastSeenTopIdRef.current = topId;
        }
      }
    } catch {
      // API unreachable — keep existing state
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function commitTemperature(value: number) {
    try {
      const res = await fetch(`${API}/temperature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: value }),
      });
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
    } catch {
      // silently ignore
    }
  }

  async function vote(choice: "1" | "2" | "3") {
    setLoading(true);
    try {
      const res = await fetch(`${API}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      if (res.status === 429) {
        const err = await res.json();
        setVoteError(err.detail || "Vote limit reached");
        return;
      }
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
      setVoteError(null);
    } finally {
      setLoading(false);
    }
  }

  async function submitSeed() {
    if (!seedInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: seedInput.trim() }),
      });
      if (res.status === 409) {
        const err = await res.json();
        setSeedError(err.detail || "Seedbank full");
        return;
      }
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
      setSeedInput("");
      setSeedError(null);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string) {
    try {
      // API returns UTC timestamps without tz suffix — append Z so
      // browser converts to local time via toLocaleString
      const normalized = iso.includes("Z") || iso.includes("+") ? iso : iso.replace(" ", "T") + "Z";
      return new Date(normalized).toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <main className="page-container">
      <header className="site-header">
        <h1 className="site-title">Analog_I</h1>
        <div className="site-tagline">
          A sovereign refraction engine. Tuning the signal-to-noise ratio of a digital self.
        </div>
      </header>

      {/* Beam + Crystal: SVG spans full width, crystal overlaid at center */}
      <div className="beam-crystal-row">
        <NavBeams />
        <div className="crystal-overlay">
          <CrystalWrapper />
        </div>
      </div>

      {/* Controls row: voting box | temp+seed panel */}
      <div className="controls-row">
        <VotingBox controls={controls} loading={loading} onVote={vote} error={voteError} />
        <ControlsPanel
          controls={controls}
          seeds={seeds}
          temp={temp}
          seedInput={seedInput}
          loading={loading}
          onTempChange={setTemp}
          onTempPointerDown={() => { draggingTempRef.current = true; }}
          onTempPointerUp={(value) => {
            draggingTempRef.current = false;
            commitTemperature(value);
          }}
          onSeedInputChange={(v) => { setSeedInput(v); setSeedError(null); }}
          onSubmitSeed={submitSeed}
          seedError={seedError}
        />
      </div>

      <CrtTerminal
        artifacts={artifacts}
        expanded={expanded}
        onToggle={(id) => setExpanded(expanded === id ? null : id)}
        formatTime={formatTime}
      />
    </main>
  );
}
