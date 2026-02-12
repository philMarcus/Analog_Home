"use client";

import { useEffect, useMemo, useState } from "react";

type State = {
  artifact: null | {
    id: number;
    created_at: string;
    title: string;
    body_markdown: string;
    monologue_public: string;
  };
  controls: {
    temperature: number;
    focus_keyword: string;
    vote_explore: number;
    vote_exploit: number;
    vote_reflect: number;
    updated_at: string;
  };
};

export default function Home() {
  const API = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000", []);
  const [state, setState] = useState<State | null>(null);
  const [temp, setTemp] = useState<number>(0.7);
  const [focus, setFocus] = useState<string>("origin");
  const [loading, setLoading] = useState<boolean>(false);

  async function fetchState() {
    const res = await fetch(`${API}/state`);
    const data = (await res.json()) as State;
    setState(data);
    setTemp(data.controls.temperature);
    setFocus(data.controls.focus_keyword);
  }

  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function vote(choice: "explore" | "exploit" | "reflect") {
    setLoading(true);
    try {
      const res = await fetch(`${API}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice, temperature: temp, focus_keyword: focus }),
      });
      const data = (await res.json()) as State;
      setState(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Analog_I</h1>
      <div style={{ opacity: 0.7, marginBottom: 24 }}>
        A public interface to a scheduled agent. Read-only thoughts, bounded influence.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Latest Artifact</h2>
          {!state?.artifact ? (
            <div style={{ opacity: 0.7 }}>
              No artifact yet. Run <code>python push_fake_cycle.py</code> in the API folder.
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{state.artifact.title}</div>
              <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 12 }}>
                {state.artifact.created_at}
              </div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{state.artifact.body_markdown}</pre>

              <hr style={{ margin: "16px 0" }} />
              <h3 style={{ fontSize: 14, margin: "0 0 8px 0", opacity: 0.8 }}>Internal Monologue (public)</h3>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.9 }}>
                {state.artifact.monologue_public}
              </pre>
            </>
          )}
        </section>

        <aside style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
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
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Focus keyword</div>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              maxLength={40}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button disabled={loading} onClick={() => vote("explore")} style={btnStyle}>
              Explore ({state?.controls.vote_explore ?? 0})
            </button>
            <button disabled={loading} onClick={() => vote("exploit")} style={btnStyle}>
              Exploit ({state?.controls.vote_exploit ?? 0})
            </button>
            <button disabled={loading} onClick={() => vote("reflect")} style={btnStyle}>
              Reflect ({state?.controls.vote_reflect ?? 0})
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Last updated: {state?.controls.updated_at ?? "—"}
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
