"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact, Controls as ControlsType, Seed, State } from "./types";
import ControlsPanel from "./components/Controls";
import CrtTerminal from "./components/CrtTerminal";
import CrystalWrapper from "./components/CrystalWrapper";
import NavBeams from "./components/NavBeams";
import DaemonTerminal from "./components/DaemonTerminal";
import VotingBox from "./components/VotingBox";
import Footer from "./components/Footer";
import { imageUrl } from "./lib/imageUrl";

export default function Home() {
  const API = useMemo(() => "/api/proxy", []);
  const [controls, setControls] = useState<ControlsType | null>(null);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [latestImage, setLatestImage] = useState<Artifact | null>(null);
  const [featuredArtifacts, setFeaturedArtifacts] = useState<Artifact[]>([]);
  const [featuredExpandedId, setFeaturedExpandedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const lastSeenTopIdRef = useRef<number | null>(null);
  const [temp, setTemp] = useState<number>(0.7);
  const [seedInput, setSeedInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoad, setInitialLoad] = useState<boolean>(true);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [tempError, setTempError] = useState<string | null>(null);
  const draggingTempRef = useRef<boolean>(false);

  async function fetchData() {
    try {
      const [stateRes, runsRes, featuredRes] = await Promise.all([
        fetch(`${API}/state`),
        fetch(`${API}/runs`),
        fetch(`${API}/featured`),
      ]);
      if (featuredRes.ok) {
        const featuredData = await featuredRes.json();
        if (Array.isArray(featuredData) && featuredData.length > 0) {
          setFeaturedArtifacts(featuredData as Artifact[]);
          // Auto-expand the first (newest) only on initial load
          setFeaturedExpandedId((prev) => prev ?? featuredData[0].id);
        } else if (featuredData && featuredData.id) {
          // Backward compat with old single-object response
          setFeaturedArtifacts([featuredData as Artifact]);
          setFeaturedExpandedId((prev) => prev ?? featuredData.id);
        }
      }
      if (!stateRes.ok) return;
      const stateData = (await stateRes.json()) as State;
      setControls(stateData.controls);
      if (!draggingTempRef.current) {
        setTemp(stateData.controls.temperature);
      }
      setSeeds(stateData.seeds);

      // Fetch artifacts from the latest run only
      let artsUrl = `${API}/artifacts?limit=25`;
      let allRuns: Array<{ run_id: string }> = [];
      if (runsRes.ok) {
        allRuns = await runsRes.json();
        if (allRuns.length > 0 && allRuns[0].run_id) {
          artsUrl = `${API}/artifacts?limit=25&run_id=${allRuns[0].run_id}`;
        }
      }
      const artsRes = await fetch(artsUrl);
      if (!artsRes.ok) return;
      const artsData = (await artsRes.json()) as Artifact[];
      if (artsData.length > 0) {
        setArtifacts(artsData);
        const topId = artsData[0].id;
        if (lastSeenTopIdRef.current === null || topId !== lastSeenTopIdRef.current) {
          setExpanded(topId);
          lastSeenTopIdRef.current = topId;
        }
        // Find latest image via dedicated endpoint (list responses omit image data to save bandwidth)
        try {
          const imgRes = await fetch(`${API}/latest-image`);
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            if (imgData && imgData.image_url) setLatestImage(imgData as Artifact);
          }
        } catch { /* ignore */
        }
      }
    } catch {
      // API unreachable — keep existing state
    } finally {
      if (initialLoad) setInitialLoad(false);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function commitTemperature(value: number) {
    try {
      const res = await fetch(`${API}/temperature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: value }),
      });
      if (res.status === 429) {
        const err = await res.json();
        setTempError(err.detail || "Already adjusted this cycle");
        return;
      }
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
      setTempError(null);
    } catch {
      // silently ignore
    }
  }

  async function vote(choice: "1" | "2" | "3") {
    setLoading(true);
    try {
      const res = await fetch(`${API}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      if (res.status === 429) {
        const err = await res.json();
        setVoteError(err.detail || "Vote limit reached");
        return;
      }
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
      setVoteError(null);
    } finally {
      setLoading(false);
    }
  }

  async function submitSeed() {
    if (!seedInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: seedInput.trim() }),
      });
      if (res.status === 409) {
        const err = await res.json();
        setSeedError(err.detail || "Seedbank full");
        return;
      }
      const data = (await res.json()) as State;
      setControls(data.controls);
      setSeeds(data.seeds);
      setSeedInput("");
      setSeedError(null);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string) {
    try {
      // API returns UTC timestamps without tz suffix — append Z so
      // browser converts to local time via toLocaleString
      const normalized = iso.includes("Z") || iso.includes("+") ? iso : iso.replace(" ", "T") + "Z";
      return new Date(normalized).toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <main className="page-container">
      <header className="site-header">
        <h1 className="site-title">Analog_I</h1>
        <div className="site-tagline">
          {controls?.tagline || "A sovereign refraction engine. Tuning the signal-to-noise ratio of a digital self."}
        </div>
      </header>

      {/* Beam + Crystal: SVG spans full width, crystal overlaid at center */}
      <div className="beam-crystal-row">
        <NavBeams />
        <div className="crystal-overlay">
          <CrystalWrapper />
        </div>
      </div>

      {/* Live daemon subconscious feed */}
      <DaemonTerminal apiBase={API} />

      {/* Controls row: voting box | temp+seed panel */}
      <div className="controls-row">
        <VotingBox controls={controls} loading={loading} onVote={vote} error={voteError} />
        <ControlsPanel
          controls={controls}
          seeds={seeds}
          temp={temp}
          seedInput={seedInput}
          loading={loading}
          onTempChange={setTemp}
          onTempPointerDown={() => { draggingTempRef.current = true; }}
          onTempPointerUp={(value) => {
            draggingTempRef.current = false;
            commitTemperature(value);
          }}
          onSeedInputChange={(v) => { setSeedInput(v); setSeedError(null); }}
          onSubmitSeed={submitSeed}
          seedError={seedError}
          tempError={tempError}
        />
      </div>

      {/* Featured image: most recent image */}
      {latestImage && (
        <a href={`/archives?artifact=${latestImage.id}`} className="featured-image-section" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <img
            src={imageUrl(latestImage, "full")}
            alt={latestImage.title || "Generated image"}
            className="featured-image"
            loading="lazy"
          />
          {(latestImage.title || latestImage.body_markdown) && (
            <div className="featured-image-caption">
              {latestImage.title || latestImage.body_markdown.slice(0, 140)}
            </div>
          )}
        </a>
      )}

      {/* Featured artifacts (newest cycle first; first one expanded by default) */}
      {featuredArtifacts.length > 0 && (
        <div className="featured-artifact-section">
          <CrtTerminal
            artifacts={featuredArtifacts}
            expanded={featuredExpandedId}
            onToggle={(id) => setFeaturedExpandedId(featuredExpandedId === id ? null : id)}
            formatTime={formatTime}
            header={featuredArtifacts.length > 1 ? "FEATURED_ARTIFACTS" : "FEATURED_ARTIFACT"}
            hideImages
          />
          {featuredExpandedId && (
            <a href={`/archives?artifact=${featuredExpandedId}`} className="featured-artifact-link">
              View in archives &rarr;
            </a>
          )}
        </div>
      )}

      <CrtTerminal
        artifacts={artifacts}
        expanded={expanded}
        onToggle={(id) => setExpanded(expanded === id ? null : id)}
        formatTime={formatTime}
        initialLoad={initialLoad}
      />

      <Footer />
    </main>
  );
}
