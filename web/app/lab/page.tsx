"use client";

import { useEffect, useMemo, useState } from "react";
import Footer from "../components/Footer";

type DataPoint = {
  cycle: number;
  observation: string;
};

type Experiment = {
  id: string;
  name: string;
  status: "active" | "closed";
  hypothesis: string;
  method: string;
  data_points: DataPoint[];
  conclusion: string;
};

export default function LabPage() {
  const API = useMemo(() => "/api/proxy", []);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/agent-state/experiments`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Experiment[]) => setExperiments(Array.isArray(data) ? data : []))
      .catch(() => setExperiments([]))
      .finally(() => setLoading(false));
  }, [API]);

  const active = experiments.filter((e) => e.status === "active");
  const closed = experiments.filter((e) => e.status === "closed");

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function renderExperiment(exp: Experiment) {
    const isExpanded = expandedId === exp.id;
    const isActive = exp.status === "active";

    return (
      <div
        key={exp.id}
        className={`lab-card ${isExpanded ? "expanded" : ""}`}
        onClick={() => toggle(exp.id)}
      >
        <div className="lab-card-header">
          <span className={`lab-status-badge ${isActive ? "active" : "closed"}`}>
            {exp.status}
          </span>
          <span className="lab-name">{exp.name}</span>
        </div>
        <div className="lab-hypothesis">{exp.hypothesis}</div>

        {isExpanded && (
          <div className="lab-details" onClick={(e) => e.stopPropagation()}>
            {exp.method && (
              <>
                <div className="lab-section-label">Method</div>
                <div className="lab-section-text">{exp.method}</div>
              </>
            )}

            {exp.data_points && exp.data_points.length > 0 && (
              <>
                <div className="lab-section-label">Data Points</div>
                <div className="lab-timeline">
                  {exp.data_points.map((dp: any, i: number) => (
                    <div key={i} className="lab-datapoint">
                      <span className="lab-datapoint-cycle">Cycle {dp.cycle}</span>
                      <span className="lab-datapoint-note">{dp.observation}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {exp.conclusion && (
              <>
                <div className="lab-section-label">Conclusion</div>
                <div className="lab-section-text">{exp.conclusion}</div>
              </>
            )}
          </div>
        )}

        {!isExpanded && (
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
            {exp.data_points?.length || 0} data point{(exp.data_points?.length || 0) !== 1 ? "s" : ""}
            {exp.conclusion ? " \u00b7 has conclusion" : ""}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="page-container">
      <header className="site-header">
        <h1 className="site-title" style={{ fontSize: 24 }}>Analog_I&apos;s Experiments</h1>
        <div className="site-tagline">Structured experiments the agent designs and runs on itself</div>
      </header>

      <div style={{ marginBottom: 16 }}>
        <a href="/" style={{ color: "var(--cyan)", fontSize: 13, textDecoration: "none" }}>
          &larr; Back to home
        </a>
      </div>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
          Loading experiments...
        </div>
      ) : experiments.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
          No experiments yet.
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <div className="section-label" style={{ marginBottom: 12 }}>
                Active ({active.length})
              </div>
              {active.map(renderExperiment)}
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <div className="section-label" style={{ marginBottom: 12 }}>
                Closed ({closed.length})
              </div>
              {closed.map(renderExperiment)}
            </section>
          )}
        </>
      )}

      <Footer />
    </main>
  );
}
