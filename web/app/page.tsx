"use client";

import { useEffect, useMemo, useState } from "react";

type Artifact = {
  id: number;
  created_at: string;
  brain: string;
  cycle: number | null;
  artifact_type: string;
  title: string;
  body_markdown: string;
  monologue_public: string;
  channel: string;
  source_platform: string;
  source_id: string;
  source_parent_id: string;
  source_url: string;
};

type Seed = {
  id: number;
  text: string;
  created_at: string;
};

type Controls = {
  temperature: number;
  vote_1: number;
  vote_2: number;
  vote_3: number;
  vote_label_1: string;
  vote_label_2: string;
  vote_label_3: string;
  updated_at: string;
};

type State = {
  artifact: Artifact | null;
  controls: Controls;
  seeds: Seed[];
};

export default function Home() {
  const API = useMemo(() => "/api/proxy", []);
  const [controls, setControls] = useState<Controls | null>(null);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [lastSeenTopId, setLastSeenTopId] = useState<number | null>(null);
  const [temp, setTemp] = useState<number>(0.7);
  const [seedInput, setSeedInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [draggingTemp, setDraggingTemp] = useState<boolean>(false);

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
      if (!draggingTemp) {
        setTemp(stateData.controls.temperature);
      }
      setSeeds(stateData.seeds);
      setArtifacts(artsData);
      if (artsData.length > 0) {
        const topId = artsData[0].id;
        if (lastSeenTopId === null || topId !== lastSeenTopId) {
          setExpanded(topId);
          setLastSeenTopId(topId);
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
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
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
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
      setSeedInput("");
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Analog_I</h1>
      <div style={{ opacity: 0.7, marginBottom: 24 }}>
        A public interface to a scheduled agent. Read-only thoughts, bounded influence.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <section>
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 12 }}>Recent Artifacts</h2>
          {artifacts.length === 0 ? (
            <div style={{ opacity: 0.7, border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
              No artifacts yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {artifacts.map((art) => {
                const isExpanded = expanded === art.id;
                return (
                  <div
                    key={art.id}
                    style={{
                      border: isExpanded ? "2px solid #4a90d9" : "1px solid #ddd",
                      borderRadius: 12,
                      padding: 16,
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onClick={() => setExpanded(isExpanded ? null : art.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 600 }}>
                        {art.title || `[${art.artifact_type}]`}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.5, whiteSpace: "nowrap", marginLeft: 12 }}>
                        cycle {art.cycle} &middot; {formatTime(art.created_at)}
                      </div>
                    </div>

                    {art.channel && (
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                        {art.source_platform}/{art.channel}
                      </div>
                    )}

                    {isExpanded && (
                      <div style={{ marginTop: 12 }}>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>
                          {art.body_markdown}
                        </pre>

                        {art.monologue_public && (
                          <>
                            <hr style={{ margin: "16px 0", opacity: 0.3 }} />
                            <h3 style={{ fontSize: 13, margin: "0 0 8px 0", opacity: 0.6 }}>
                              Internal Monologue
                            </h3>
                            <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.8, fontSize: 13, lineHeight: 1.5 }}>
                              {art.monologue_public}
                            </pre>
                          </>
                        )}

                        {art.source_url && (
                          <div style={{ marginTop: 12, fontSize: 12 }}>
                            <a href={art.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "#4a90d9" }}>
                              View source &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, alignSelf: "start" }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Controls</h2>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Temperature: {temp.toFixed(2)}</div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={temp}
              onChange={(e) => setTemp(parseFloat(e.target.value))}
              onPointerDown={() => setDraggingTemp(true)}
              onPointerUp={(e) => {
                setDraggingTemp(false);
                commitTemperature(parseFloat((e.target as HTMLInputElement).value));
              }}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Plant a seed</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                maxLength={200}
                placeholder="A thought, topic, or question..."
                onKeyDown={(e) => e.key === "Enter" && submitSeed()}
                style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
              />
              <button disabled={loading || !seedInput.trim()} onClick={submitSeed} style={btnStyle}>
                Send
              </button>
            </div>
            {seeds.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
                {seeds.map((s) => (
                  <div key={s.id} style={{ marginBottom: 2 }}>
                    &bull; {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Trajectory</div>
          <div style={{ display: "grid", gap: 8 }}>
            <button disabled={loading} onClick={() => vote("1")} style={btnStyle}>
              {controls?.vote_label_1 ?? "emergence"} ({controls?.vote_1 ?? 0})
            </button>
            <button disabled={loading} onClick={() => vote("2")} style={btnStyle}>
              {controls?.vote_label_2 ?? "entropy"} ({controls?.vote_2 ?? 0})
            </button>
            <button disabled={loading} onClick={() => vote("3")} style={btnStyle}>
              {controls?.vote_label_3 ?? "self"} ({controls?.vote_3 ?? 0})
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Last updated: {controls?.updated_at ?? "\u2014"}
          </div>
        </aside>
      </div>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
  textAlign: "left",
};
