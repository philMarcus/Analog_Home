"use client";

import type { Artifact } from "../types";

type Props = {
  artifacts: Artifact[];
  expanded: number | null;
  onToggle: (id: number) => void;
  formatTime: (iso: string) => string;
  header?: string;
};

function isSystemArtifact(art: Artifact): boolean {
  return art.artifact_type.startsWith("system_");
}

function systemLabel(art: Artifact): string {
  if (art.artifact_type === "system_kernel_update") return "KERNEL SELF-UPDATE";
  if (art.artifact_type === "system_trajectory_update") return "TRAJECTORY CHANGE";
  return "SYSTEM EVENT";
}

export default function CrtTerminal({ artifacts, expanded, onToggle, formatTime, header = "RECENT_ARTIFACTS" }: Props) {
  return (
    <div className="crt-terminal">
      <div className="crt-content">
        <div className="crt-header">&gt; {header}</div>

        {artifacts.length === 0 ? (
          <div className="crt-text" style={{ opacity: 0.5 }}>
            No transmissions received.
          </div>
        ) : (
          artifacts.map((art) => {
            const isExpanded = expanded === art.id;
            const isSys = isSystemArtifact(art);
            return (
              <div
                key={art.id}
                className={`artifact-card${isExpanded ? " expanded" : ""}${isSys ? " system-event" : ""}`}
                onClick={() => onToggle(art.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className={isSys ? "system-event-title" : "artifact-title"}>
                    {isSys && <span className="system-event-badge">{systemLabel(art)}</span>}
                    {art.title || `[${art.artifact_type}]`}
                  </span>
                  <span className="artifact-meta">
                    cycle {art.cycle}
                    {art.temperature != null && <> &middot; temp {art.temperature.toFixed(2)}</>}
                    {" "}&middot; {formatTime(art.created_at)}
                  </span>
                </div>

                {!isSys && art.channel && (
                  <div className="artifact-channel">
                    {art.source_platform}/{art.channel}
                  </div>
                )}

                {isExpanded && (
                  <div>
                    <pre className={isSys ? "system-event-body" : "artifact-body"}>{art.body_markdown}</pre>

                    {!isSys && art.search_queries && (
                      <>
                        <hr className="artifact-divider" />
                        <h3 className="artifact-section-label">Search Queries</h3>
                        <div>
                          {art.search_queries.split(",").map((q, i) => (
                            <span key={i} className="search-tag">
                              {q.trim()}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {!isSys && art.monologue_public && (
                      <>
                        <hr className="artifact-divider" />
                        <h3 className="artifact-section-label">Internal Monologue</h3>
                        <pre className="artifact-monologue">{art.monologue_public}</pre>
                      </>
                    )}

                    {!isSys && art.source_url && (
                      <div style={{ marginTop: 12 }}>
                        <a
                          href={art.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="artifact-link"
                        >
                          View source &rarr;
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
