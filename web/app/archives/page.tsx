"use client";

import { useEffect, useState } from "react";
import type { Artifact, Run } from "../types";
import CrtTerminal from "../components/CrtTerminal";

const API = "/api/proxy";
const MAJOR_RUN_THRESHOLD = 8;

function formatTime(iso: string) {
  try {
    const normalized =
      iso.includes("Z") || iso.includes("+") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(normalized).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    const normalized =
      iso.includes("Z") || iso.includes("+") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(normalized).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function runTitle(run: Run): string {
  const date = formatDate(run.started_at);
  if (run.first_title) {
    const short = run.first_title.length > 55 ? run.first_title.slice(0, 52) + "..." : run.first_title;
    return `${short} (${date})`;
  }
  return `${run.brain} — ${run.artifact_count} artifacts (${date})`;
}

function RunEntry({
  run,
  isExpanded,
  onToggle,
  artifacts,
  expandedArtifact,
  onArtifactToggle,
}: {
  run: Run;
  isExpanded: boolean;
  onToggle: () => void;
  artifacts: Artifact[];
  expandedArtifact: number | null;
  onArtifactToggle: (id: number) => void;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        className="artifact-card"
        onClick={onToggle}
        style={{
          cursor: "pointer",
          borderLeft: isExpanded ? "2px solid var(--cyan)" : "2px solid transparent",
          paddingLeft: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="artifact-title" style={{ fontSize: 13 }}>
            <span style={{ color: "var(--cyan)", marginRight: 6 }}>
              {isExpanded ? "[-]" : "[+]"}
            </span>
            {runTitle(run)}
          </span>
          <span className="artifact-meta">
            {run.artifact_count} artifacts
            {run.first_cycle != null && run.last_cycle != null && (
              <> &middot; cycles {run.first_cycle}-{run.last_cycle}</>
            )}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginLeft: 12, borderLeft: "1px solid var(--border)", paddingLeft: 8 }}>
          {artifacts.length === 0 ? (
            <div className="crt-text loading-pulse" style={{ padding: "8px 0" }}>
              Loading...
            </div>
          ) : (
            <CrtTerminal
              artifacts={artifacts}
              expanded={expandedArtifact}
              onToggle={onArtifactToggle}
              formatTime={formatTime}
              header={`RUN ${run.run_id.slice(0, 8)}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function ArchivesPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runArtifacts, setRunArtifacts] = useState<Record<string, Artifact[]>>({});
  const [expandedArtifact, setExpandedArtifact] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMinor, setShowMinor] = useState(false);

  const majorRuns = runs.filter((r) => r.artifact_count >= MAJOR_RUN_THRESHOLD);
  const minorRuns = runs.filter((r) => r.artifact_count < MAJOR_RUN_THRESHOLD);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/runs`)
      .then(async (res) => {
        if (res.ok) {
          const data: Run[] = await res.json();
          setRuns(data);
          // Auto-expand the most recent major run
          const firstMajor = data.find((r) => r.artifact_count >= MAJOR_RUN_THRESHOLD);
          if (firstMajor) {
            setExpandedRun(firstMajor.run_id);
            loadRunArtifacts(firstMajor.run_id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function loadRunArtifacts(runId: string) {
    if (runArtifacts[runId]) return;
    fetch(`${API}/artifacts?run_id=${runId}&limit=50`)
      .then(async (res) => {
        if (res.ok) {
          const arts: Artifact[] = await res.json();
          setRunArtifacts((prev) => ({ ...prev, [runId]: arts }));
        }
      });
  }

  function toggleRun(runId: string) {
    if (expandedRun === runId) {
      setExpandedRun(null);
      setExpandedArtifact(null);
    } else {
      setExpandedRun(runId);
      setExpandedArtifact(null);
      loadRunArtifacts(runId);
    }
  }

  return (
    <main className="page-container">
      <header className="site-header">
        <h1 className="site-title" style={{ fontSize: 24 }}>Archives</h1>
        <div className="site-tagline">
          <a href="/" style={{ color: "var(--cyan-dim)", textDecoration: "none" }}>
            &larr; Back to home
          </a>
        </div>
      </header>

      {loading ? (
        <div className="crt-terminal">
          <div className="crt-content">
            <div className="crt-text loading-pulse">Establishing uplink...</div>
          </div>
        </div>
      ) : runs.length === 0 ? (
        <div className="crt-terminal">
          <div className="crt-content">
            <div className="crt-text" style={{ opacity: 0.5 }}>No runs found.</div>
          </div>
        </div>
      ) : (
        <>
          {/* Major runs */}
          <div className="crt-terminal">
            <div className="crt-content">
              <div className="crt-header">&gt; RUNS</div>

              {majorRuns.map((run) => (
                <RunEntry
                  key={run.run_id}
                  run={run}
                  isExpanded={expandedRun === run.run_id}
                  onToggle={() => toggleRun(run.run_id)}
                  artifacts={runArtifacts[run.run_id] || []}
                  expandedArtifact={expandedArtifact}
                  onArtifactToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                />
              ))}
            </div>
          </div>

          {/* Minor runs (collapsed by default) */}
          {minorRuns.length > 0 && (
            <div className="crt-terminal" style={{ marginTop: 16 }}>
              <div className="crt-content">
                <div
                  className="crt-header"
                  onClick={() => setShowMinor(!showMinor)}
                  style={{ cursor: "pointer" }}
                >
                  <span style={{ color: "var(--text-dim)" }}>
                    {showMinor ? "[-]" : "[+]"}
                  </span>
                  {" "}SHORT RUNS ({minorRuns.length} runs, &lt;{MAJOR_RUN_THRESHOLD} artifacts each)
                </div>

                {showMinor && minorRuns.map((run) => (
                  <RunEntry
                    key={run.run_id}
                    run={run}
                    isExpanded={expandedRun === run.run_id}
                    onToggle={() => toggleRun(run.run_id)}
                    artifacts={runArtifacts[run.run_id] || []}
                    expandedArtifact={expandedArtifact}
                    onArtifactToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
