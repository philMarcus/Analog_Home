"use client";

import { useEffect, useState } from "react";
import type { Artifact } from "../types";
import CrtTerminal from "../components/CrtTerminal";

const PER_PAGE = 20;
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

export default function ArchivesPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/artifacts?limit=${PER_PAGE}&offset=${page * PER_PAGE}`),
      fetch(`${API}/artifacts/count`),
    ])
      .then(async ([artsRes, countRes]) => {
        if (artsRes.ok) setArtifacts(await artsRes.json());
        if (countRes.ok) {
          const data = await countRes.json();
          setTotalCount(data.count);
        }
      })
      .finally(() => setLoading(false));
  }, [page]);

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
            <div className="crt-text" style={{ opacity: 0.5 }}>Loading transmissions...</div>
          </div>
        </div>
      ) : (
        <CrtTerminal
          artifacts={artifacts}
          expanded={expanded}
          onToggle={(id) => setExpanded(expanded === id ? null : id)}
          formatTime={formatTime}
          header="ARTIFACTS"
        />
      )}

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
        <button
          className="cyber-button"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          &larr; Prev
        </button>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Page {page + 1} of {totalPages}
        </span>
        <button
          className="cyber-button"
          disabled={page >= totalPages - 1}
          onClick={() => setPage(page + 1)}
        >
          Next &rarr;
        </button>
      </div>
    </main>
  );
}
