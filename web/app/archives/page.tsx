"use client";

import { useEffect, useState } from "react";
import type { Artifact, Run } from "../types";
import CrtTerminal from "../components/CrtTerminal";

const API = "/api/proxy";

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
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Generate a short descriptive title for a run based on its artifacts. */
function runTitle(run: Run, artifacts: Artifact[]): string {
  if (!artifacts.length) {
    return `${run.brain} — ${formatDate(run.started_at)}`;
  }
  // Find the first non-system post artifact for a title hint
  const firstPost = artifacts.find(
    (a) => !a.artifact_type.startsWith("system_") && a.title
  );
  const titleHint = firstPost?.title || "";
  const date = formatDate(run.started_at);
  if (titleHint) {
    // Truncate long titles
    const short = titleHint.length > 50 ? titleHint.slice(0, 47) + "..." : titleHint;
    return `${run.brain} — ${short} (${date})`;
  }
  return `${run.brain} — ${run.artifact_count} artifacts (${date})`;
}

export default function ArchivesPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runArtifacts, setRunArtifacts] = useState<Record<string, Artifact[]>>({});
  const [expandedArtifact, setExpandedArtifact] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // For artifacts with no run_id (legacy)
  const [legacyArtifacts, setLegacyArtifacts] = useState<Artifact[]>([]);
  const [legacyCount, setLegacyCount] = useState(0);
  const [showLegacy, setShowLegacy] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/runs`)
      .then(async (res) => {
        if (res.ok) {
          const data: Run[] = await res.json();
          setRuns(data);
          // Auto-expand the most recent run
          if (data.length > 0) {
            const latest = data[0].run_id;
            setExpandedRun(latest);
            loadRunArtifacts(latest);
          }
        }
      })
      .finally(() => setLoading(false));

    // Check for legacy (no run_id) artifacts
    fetch(`${API}/artifacts/count?run_id=`)
      .then(async (res) => {
        // We'll just get total count and subtract run counts later
      });
  }, []);

  function loadRunArtifacts(runId: string) {
    if (runArtifacts[runId]) return; // Already loaded
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

  function loadLegacy() {
    setShowLegacy(!showLegacy);
    if (legacyArtifacts.length === 0) {
      // Fetch artifacts that have empty run_id
      fetch(`${API}/artifacts?limit=50&offset=0`)
        .then(async (res) => {
          if (res.ok) {
            const all: Artifact[] = await res.json();
            setLegacyArtifacts(all.filter((a) => !a.run_id));
          }
        });
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
        <div className="crt-terminal">
          <div className="crt-content">
            <div className="crt-header">&gt; RUNS</div>

            {runs.map((run) => {
              const isExpanded = expandedRun === run.run_id;
              const arts = runArtifacts[run.run_id] || [];
              return (
                <div key={run.run_id} style={{ marginBottom: 4 }}>
                  {/* Run header */}
                  <div
                    className="artifact-card"
                    onClick={() => toggleRun(run.run_id)}
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
                        {runTitle(run, arts)}
                      </span>
                      <span className="artifact-meta">
                        {run.artifact_count} artifacts
                        {run.first_cycle != null && run.last_cycle != null && (
                          <> &middot; cycles {run.first_cycle}-{run.last_cycle}</>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Expanded: show artifacts */}
                  {isExpanded && (
                    <div style={{ marginLeft: 12, borderLeft: "1px solid var(--border)", paddingLeft: 8 }}>
                      {arts.length === 0 ? (
                        <div className="crt-text" style={{ opacity: 0.5, padding: "8px 0" }}>
                          Loading...
                        </div>
                      ) : (
                        <CrtTerminal
                          artifacts={arts}
                          expanded={expandedArtifact}
                          onToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                          formatTime={formatTime}
                          header={`RUN ${run.run_id.slice(0, 8)}`}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Legacy artifacts (no run_id) */}
            <div style={{ marginTop: 16 }}>
              <div
                className="artifact-card"
                onClick={loadLegacy}
                style={{
                  cursor: "pointer",
                  borderLeft: showLegacy ? "2px solid var(--text-dim)" : "2px solid transparent",
                  paddingLeft: 8,
                  opacity: 0.7,
                }}
              >
                <span className="artifact-title" style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--text-dim)", marginRight: 6 }}>
                    {showLegacy ? "[-]" : "[+]"}
                  </span>
                  Legacy artifacts (pre-run tracking)
                </span>
              </div>
              {showLegacy && legacyArtifacts.length > 0 && (
                <div style={{ marginLeft: 12, borderLeft: "1px solid var(--border)", paddingLeft: 8 }}>
                  <CrtTerminal
                    artifacts={legacyArtifacts}
                    expanded={expandedArtifact}
                    onToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                    formatTime={formatTime}
                    header="LEGACY"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
