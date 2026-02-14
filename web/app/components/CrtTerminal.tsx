"use client";

import type { Artifact } from "../types";

type Props = {
  artifacts: Artifact[];
  expanded: number | null;
  onToggle: (id: number) => void;
  formatTime: (iso: string) => string;
  header?: string;
};

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
            return (
              <div
                key={art.id}
                className={`artifact-card${isExpanded ? " expanded" : ""}`}
                onClick={() => onToggle(art.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="artifact-title">
                    {art.title || `[${art.artifact_type}]`}
                  </span>
                  <span className="artifact-meta">
                    cycle {art.cycle}
                    {art.temperature != null && <> &middot; temp {art.temperature.toFixed(2)}</>}
                    {" "}&middot; {formatTime(art.created_at)}
                  </span>
                </div>

                {art.channel && (
                  <div className="artifact-channel">
                    {art.source_platform}/{art.channel}
                  </div>
                )}

                {isExpanded && (
                  <div>
                    <pre className="artifact-body">{art.body_markdown}</pre>

                    {art.search_queries && (
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

                    {art.monologue_public && (
                      <>
                        <hr className="artifact-divider" />
                        <h3 className="artifact-section-label">Internal Monologue</h3>
                        <pre className="artifact-monologue">{art.monologue_public}</pre>
                      </>
                    )}

                    {art.source_url && (
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
