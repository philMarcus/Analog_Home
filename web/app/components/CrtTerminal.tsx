"use client";

import type { Artifact } from "../types";
import { imageUrl } from "../lib/imageUrl";

type Props = {
  artifacts: Artifact[];
  expanded: number | null;
  onToggle: (id: number) => void;
  formatTime: (iso: string) => string;
  header?: string;
  initialLoad?: boolean;
  hideImages?: boolean;
};

function isSystemArtifact(art: Artifact): boolean {
  return art.artifact_type.startsWith("system_");
}

/** Pink system events: major state changes */
function isPinkSystem(art: Artifact): boolean {
  return ["system_run_start", "system_kernel_update", "system_tagline_update"].includes(art.artifact_type);
}

/** Blue system events: cycle reports (directives, controls) */
function isBlueSystem(art: Artifact): boolean {
  return ["system_daemon_directives", "system_controls_update", "system_cycle_report"].includes(art.artifact_type);
}

function systemLabel(art: Artifact): string {
  if (art.artifact_type === "system_run_start") return "SESSION START";
  if (art.artifact_type === "system_kernel_update") return "KERNEL SELF-UPDATE";
  if (art.artifact_type === "system_cycle_report") return "CYCLE REPORT";
  if (art.artifact_type === "system_daemon_directives") return "CYCLE REPORT";
  if (art.artifact_type === "system_controls_update") return "CONTROLS UPDATE";
  if (art.artifact_type === "system_dev_request") return "DEV REQUEST";
  if (art.artifact_type === "system_tagline_update") return "TAGLINE UPDATE";
  return "SYSTEM EVENT";
}

function displayTitle(art: Artifact): string {
  const base = art.title || (
    art.artifact_type === "reply" ? "Reply" :
    art.artifact_type === "comment" ? "Comment" :
    `[${art.artifact_type}]`
  );
  // Prefix Moltbook posts so they're distinguishable when scrolling
  if (art.artifact_type === "post" && art.source_platform === "moltbook") {
    return `Moltbook Post: ${base}`;
  }
  return base;
}

export default function CrtTerminal({ artifacts, expanded, onToggle, formatTime, header = "RECENT_ARTIFACTS", initialLoad = false, hideImages = false }: Props) {
  return (
    <div className="crt-terminal">
      <div className="crt-content">
        <div className="crt-header">&gt; {header}</div>

        {initialLoad ? (
          <div className="crt-text loading-pulse">
            Establishing uplink...
          </div>
        ) : artifacts.length === 0 ? (
          <div className="crt-text" style={{ opacity: 0.5 }}>
            No transmissions received.
          </div>
        ) : (
          artifacts.map((art) => {
            const isExpanded = expanded === art.id;
            const isSys = isSystemArtifact(art);
            const isPink = isPinkSystem(art);
            const isBlue = isBlueSystem(art);
            // System artifacts are always shown expanded (they're short)
            const showBody = isExpanded || isSys;
            const sysClass = isPink ? " system-event" : isBlue ? " system-event-blue" : isSys ? " system-event" : "";
            return (
              <div
                key={art.id}
                id={`artifact-${art.id}`}
                className={`artifact-card${isExpanded ? " expanded" : ""}${sysClass}`}
                onClick={() => onToggle(art.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className={isBlue ? "system-event-title-blue" : isSys ? "system-event-title" : "artifact-title"}>
                    {isSys && <span className={isBlue ? "system-event-badge-blue" : "system-event-badge"}>{systemLabel(art)}</span>}
                    {(art.image_url || art.has_image) && <span className="image-badge">IMG</span>}
                    {displayTitle(art)}
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

                {/* Preview text for collapsed non-system artifacts */}
                {!showBody && !isSys && art.body_markdown && (
                  <div className="artifact-preview">
                    {art.body_markdown.slice(0, 140)}{art.body_markdown.length > 140 ? "..." : ""}
                  </div>
                )}

                {showBody && (
                  <div>
                    {/* Image display (suppressed in featured section since it shows above).
                        For new artifacts image_url is already a /image/medium URL, served
                        with HTTP caching. For legacy artifacts it's a data URI passthrough. */}
                    {art.image_url && !hideImages && (
                      <div className="artifact-image-container">
                        <img
                          src={imageUrl(art, "medium")}
                          alt={art.title || "Generated image"}
                          className="artifact-image"
                          loading="lazy"
                        />
                        {!art.image_url.startsWith("data:") && (
                          <a
                            href={imageUrl(art, "full")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="artifact-full-image-link"
                          >
                            View full size &rarr;
                          </a>
                        )}
                      </div>
                    )}

                    <pre className={isBlue ? "system-event-body-blue" : isSys ? "system-event-body" : "artifact-body"}>{art.body_markdown}</pre>

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
