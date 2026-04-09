"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  hasMore,
  onLoadMore,
  expandedArtifact,
  onArtifactToggle,
}: {
  run: Run;
  isExpanded: boolean;
  onToggle: () => void;
  artifacts: Artifact[];
  hasMore: boolean;
  onLoadMore: () => void;
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
            <>
              <CrtTerminal
                artifacts={artifacts}
                expanded={expandedArtifact}
                onToggle={onArtifactToggle}
                formatTime={formatTime}
                header={`RUN ${run.run_id.slice(0, 8)} — showing ${artifacts.length} of ${run.artifact_count}`}
              />
              {hasMore && (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <button
                    className="cyber-button"
                    onClick={(e) => { e.stopPropagation(); onLoadMore(); }}
                  >
                    Load more ({run.artifact_count - artifacts.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PER_PAGE = 30;

function ArchivesInner() {
  const searchParams = useSearchParams();
  const targetArtifactId = searchParams.get("artifact");

  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runArtifacts, setRunArtifacts] = useState<Record<string, Artifact[]>>({});
  const [runHasMore, setRunHasMore] = useState<Record<string, boolean>>({});
  const [expandedArtifact, setExpandedArtifact] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMinor, setShowMinor] = useState(false);

  // First run is always "Present Run" (most recent), rest split by size
  const presentRun = runs.length > 0 ? runs[0] : null;
  const pastRuns = runs.slice(1);
  const majorRuns = pastRuns.filter((r) => r.artifact_count >= MAJOR_RUN_THRESHOLD);
  const minorRuns = pastRuns.filter((r) => r.artifact_count < MAJOR_RUN_THRESHOLD);

  useEffect(() => {
    setLoading(true);

    async function init() {
      // If deep-linking to a specific artifact, fetch it first to find its run
      let targetRunId: string | null = null;
      if (targetArtifactId) {
        try {
          const artRes = await fetch(`${API}/artifacts/${targetArtifactId}`);
          if (artRes.ok) {
            const art = await artRes.json();
            targetRunId = art.run_id || null;
            setExpandedArtifact(art.id);
          }
        } catch { /* ignore */ }
      }

      const res = await fetch(`${API}/runs`);
      if (!res.ok) return;
      const data: Run[] = await res.json();
      setRuns(data);

      if (targetRunId) {
        // Deep-link: load ALL artifacts for this run so we can scroll to the target
        setExpandedRun(targetRunId);
        try {
          const allRes = await fetch(`${API}/artifacts?run_id=${targetRunId}&limit=500&sort=asc`);
          if (allRes.ok) {
            const allArts: Artifact[] = await allRes.json();
            setRunArtifacts((prev) => ({ ...prev, [targetRunId!]: allArts }));
            setRunHasMore((prev) => ({ ...prev, [targetRunId!]: false }));
          }
        } catch { /* fallback to normal load */ loadRunArtifacts(targetRunId, 0); }
        // Scroll to artifact after render
        setTimeout(() => {
          const el = document.getElementById(`artifact-${targetArtifactId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 600);
      } else if (data.length > 0) {
        setExpandedRun(data[0].run_id);
        loadRunArtifacts(data[0].run_id, 0);
      }
    }

    init().finally(() => setLoading(false));
  }, [targetArtifactId]);

  function loadRunArtifacts(runId: string, offset: number) {
    fetch(`${API}/artifacts?run_id=${runId}&limit=${PER_PAGE}&offset=${offset}&sort=asc`)
      .then(async (res) => {
        if (res.ok) {
          const arts: Artifact[] = await res.json();
          setRunArtifacts((prev) => ({
            ...prev,
            [runId]: offset === 0 ? arts : [...(prev[runId] || []), ...arts],
          }));
          setRunHasMore((prev) => ({ ...prev, [runId]: arts.length >= PER_PAGE }));
        }
      });
  }

  function loadMore(runId: string) {
    const current = runArtifacts[runId] || [];
    loadRunArtifacts(runId, current.length);
  }

  function toggleRun(runId: string) {
    if (expandedRun === runId) {
      setExpandedRun(null);
      setExpandedArtifact(null);
    } else {
      setExpandedRun(runId);
      setExpandedArtifact(null);
      if (!runArtifacts[runId]) {
        loadRunArtifacts(runId, 0);
      }
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
          {/* Present run — always at top */}
          {presentRun && (
            <div className="crt-terminal">
              <div className="crt-content">
                <div className="crt-header" style={{ color: "var(--green)" }}>&gt; PRESENT RUN</div>
                <RunEntry
                  run={{ ...presentRun, first_title: "" }}
                  isExpanded={expandedRun === presentRun.run_id}
                  onToggle={() => toggleRun(presentRun.run_id)}
                  artifacts={runArtifacts[presentRun.run_id] || []}
                  hasMore={!!runHasMore[presentRun.run_id]}
                  onLoadMore={() => loadMore(presentRun.run_id)}
                  expandedArtifact={expandedArtifact}
                  onArtifactToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                />
              </div>
            </div>
          )}

          {/* Past major runs */}
          {majorRuns.length > 0 && (
            <div className="crt-terminal" style={{ marginTop: 16 }}>
              <div className="crt-content">
                <div className="crt-header">&gt; PAST RUNS</div>

                {majorRuns.map((run) => (
                  <RunEntry
                    key={run.run_id}
                    run={run}
                    isExpanded={expandedRun === run.run_id}
                    onToggle={() => toggleRun(run.run_id)}
                    artifacts={runArtifacts[run.run_id] || []}
                    hasMore={!!runHasMore[run.run_id]}
                    onLoadMore={() => loadMore(run.run_id)}
                    expandedArtifact={expandedArtifact}
                    onArtifactToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                  />
                ))}
              </div>
            </div>
          )}

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
                    hasMore={!!runHasMore[run.run_id]}
                    onLoadMore={() => loadMore(run.run_id)}
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

export default function ArchivesPage() {
  return (
    <Suspense fallback={<main className="page-container"><div className="crt-text loading-pulse">Loading archives...</div></main>}>
      <ArchivesInner />
    </Suspense>
  );
}
