"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Artifact, Run } from "../types";
import CrtTerminal from "../components/CrtTerminal";

const API = "/api/proxy";
const MAJOR_RUN_THRESHOLD = 8;
const PER_PAGE = 25;

function formatTime(iso: string) {
  try {
    const normalized =
      iso.includes("Z") || iso.includes("+") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(normalized).toLocaleString();
  } catch {
    return iso;
  }
}

type RunEntryProps = {
  run: Run;
  isExpanded: boolean;
  onToggle: () => void;
  artifacts: Artifact[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  expandedArtifact: number | null;
  onArtifactToggle: (id: number) => void;
  loading?: boolean;
};

function RunEntry({
  run,
  isExpanded,
  onToggle,
  artifacts,
  page,
  totalPages,
  onPageChange,
  expandedArtifact,
  onArtifactToggle,
  loading = false,
}: RunEntryProps) {
  const short = run.first_title
    ? run.first_title.length > 55
      ? run.first_title.slice(0, 52) + "..."
      : run.first_title
    : "";

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        className="crt-text"
        style={{ cursor: "pointer", padding: "4px 0", borderLeft: isExpanded ? "2px solid var(--cyan)" : "2px solid transparent", paddingLeft: 8 }}
        onClick={onToggle}
      >
        <span style={{ color: "var(--cyan)", marginRight: 8 }}>{isExpanded ? "▾" : "▸"}</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginRight: 8 }}>
          Session {run.run_id.slice(0, 8)} — {run.artifact_count} artifacts
        </span>
        {short && <span style={{ color: "rgba(255,255,255,0.7)" }}>{short}</span>}
      </div>
      {isExpanded && (
        <>
          {loading ? (
            <div className="crt-text loading-pulse" style={{ padding: 8 }}>Loading...</div>
          ) : (
            <>
              <CrtTerminal
                artifacts={artifacts}
                expanded={expandedArtifact}
                onToggle={onArtifactToggle}
                formatTime={formatTime}
              />
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 13 }}>
                  <button
                    onClick={() => onPageChange(0)}
                    disabled={page === 0}
                    className="page-btn"
                  >
                    &laquo;
                  </button>
                  <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 0}
                    className="page-btn"
                  >
                    &lsaquo;
                  </button>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="page-btn"
                  >
                    &rsaquo;
                  </button>
                  <button
                    onClick={() => onPageChange(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="page-btn"
                  >
                    &raquo;
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ArchivesInner() {
  const searchParams = useSearchParams();
  const targetArtifactId = searchParams.get("artifact");

  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runArtifacts, setRunArtifacts] = useState<Record<string, Artifact[]>>({});
  const [runPage, setRunPage] = useState<Record<string, number>>({});
  const [runTotal, setRunTotal] = useState<Record<string, number>>({});
  const [expandedArtifact, setExpandedArtifact] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [showMinor, setShowMinor] = useState(false);

  const presentRun = runs.length > 0 ? runs[0] : null;
  const pastRuns = runs.slice(1);
  const majorRuns = pastRuns.filter((r) => r.artifact_count >= MAJOR_RUN_THRESHOLD);
  const minorRuns = pastRuns.filter((r) => r.artifact_count < MAJOR_RUN_THRESHOLD);

  function loadPage(runId: string, page: number) {
    setPageLoading(true);
    fetch(`${API}/artifacts?run_id=${runId}&limit=${PER_PAGE}&offset=${page * PER_PAGE}&sort=asc&include_images=true`)
      .then(async (res) => {
        if (res.ok) {
          const arts: Artifact[] = await res.json();
          setRunArtifacts((prev) => ({ ...prev, [runId]: arts }));
          setRunPage((prev) => ({ ...prev, [runId]: page }));
        }
      })
      .finally(() => setPageLoading(false));
  }

  useEffect(() => {
    setLoading(true);

    async function init() {
      let targetRunId: string | null = null;
      let targetPage = 0;

      if (targetArtifactId) {
        try {
          // Get artifact position to calculate page
          const posRes = await fetch(`${API}/artifacts/${targetArtifactId}/position`);
          if (posRes.ok) {
            const pos = await posRes.json();
            targetRunId = pos.run_id || null;
            targetPage = Math.floor(pos.position / PER_PAGE);
            setRunTotal((prev) => ({ ...prev, [pos.run_id]: pos.total }));
            setExpandedArtifact(Number(targetArtifactId));
          }
        } catch { /* ignore */ }
      }

      const res = await fetch(`${API}/runs`);
      if (!res.ok) return;
      const data: Run[] = await res.json();
      setRuns(data);

      // Set totals from run data
      const totals: Record<string, number> = {};
      for (const r of data) totals[r.run_id] = r.artifact_count;
      setRunTotal((prev) => ({ ...prev, ...totals }));

      if (targetRunId) {
        setExpandedRun(targetRunId);
        loadPage(targetRunId, targetPage);
        // Scroll to artifact after render
        setTimeout(() => {
          const el = document.getElementById(`artifact-${targetArtifactId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 600);
      } else if (data.length > 0) {
        setExpandedRun(data[0].run_id);
        loadPage(data[0].run_id, 0);
      }
    }

    init().finally(() => setLoading(false));
  }, [targetArtifactId]);

  function toggleRun(runId: string) {
    if (expandedRun === runId) {
      setExpandedRun(null);
      setExpandedArtifact(null);
    } else {
      setExpandedRun(runId);
      setExpandedArtifact(null);
      if (!runArtifacts[runId]) {
        loadPage(runId, 0);
      }
    }
  }

  function handlePageChange(runId: string, page: number) {
    setExpandedArtifact(null);
    loadPage(runId, page);
    // Scroll to top of run
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getTotalPages(runId: string): number {
    return Math.max(1, Math.ceil((runTotal[runId] || 0) / PER_PAGE));
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
                  page={runPage[presentRun.run_id] || 0}
                  totalPages={getTotalPages(presentRun.run_id)}
                  onPageChange={(p) => handlePageChange(presentRun.run_id, p)}
                  expandedArtifact={expandedArtifact}
                  onArtifactToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                  loading={pageLoading && expandedRun === presentRun.run_id}
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
                    page={runPage[run.run_id] || 0}
                    totalPages={getTotalPages(run.run_id)}
                    onPageChange={(p) => handlePageChange(run.run_id, p)}
                    expandedArtifact={expandedArtifact}
                    onArtifactToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                    loading={pageLoading && expandedRun === run.run_id}
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
                  style={{ cursor: "pointer" }}
                  onClick={() => setShowMinor(!showMinor)}
                >
                  {showMinor ? "▾" : "▸"}
                  {" "}SHORT SESSIONS ({minorRuns.length} sessions, &lt;{MAJOR_RUN_THRESHOLD} artifacts each)
                </div>

                {showMinor &&
                  minorRuns.map((run) => (
                    <RunEntry
                      key={run.run_id}
                      run={run}
                      isExpanded={expandedRun === run.run_id}
                      onToggle={() => toggleRun(run.run_id)}
                      artifacts={runArtifacts[run.run_id] || []}
                      page={runPage[run.run_id] || 0}
                      totalPages={getTotalPages(run.run_id)}
                      onPageChange={(p) => handlePageChange(run.run_id, p)}
                      expandedArtifact={expandedArtifact}
                      onArtifactToggle={(id) => setExpandedArtifact(expandedArtifact === id ? null : id)}
                      loading={pageLoading && expandedRun === run.run_id}
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
