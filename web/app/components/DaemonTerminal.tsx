"use client";

import { useEffect, useRef, useState } from "react";

type TickData = {
  tick: number;
  created_at: string;
  data: {
    lines: string[];
    sentry_interval?: number;
    complete?: boolean;
  };
};

type Props = {
  apiBase: string;
};

/** Map line prefixes to CSS colors for the CRT aesthetic. */
function colorForLine(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("──") || trimmed.startsWith("─")) return "rgba(255,255,255,0.8)";  // white - tick borders
  if (trimmed.startsWith("SENTRY") || trimmed.startsWith("Scores:")) return "#00d4ff";
  if (trimmed.startsWith("STRATEGIST")) return "#00ffff";
  if (trimmed.startsWith("SEEKER")) return "#ff00ff";     // magenta
  if (trimmed.startsWith("SEED:") && trimmed.includes("charge")) return "#39ff14";  // green
  if (trimmed.startsWith("SEED:")) return "#cccc00";       // yellow (filtered)
  if (trimmed.startsWith("→")) return "#39ff14";            // green - drafts
  if (trimmed.startsWith("wake=")) return "rgba(255,255,255,0.4)";  // dim
  if (trimmed.startsWith("(no feed)") || trimmed.startsWith("(no drafts)")) return "rgba(255,255,255,0.3)";
  return "rgba(255,255,255,0.7)";  // default dim white
}

export default function DaemonTerminal({ apiBase }: Props) {
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`${apiBase}/daemon/live?limit=8`);
        if (!res.ok) return;
        const data: TickData[] = await res.json();
        if (!active) return;

        if (data.length === 0) {
          setVisible(false);
          return;
        }

        // Check if agent is live: last tick within 2x sentry_interval
        const lastTick = data[data.length - 1];
        const interval = lastTick.data?.sentry_interval || 300;
        const lastTime = new Date(
          lastTick.created_at.includes("Z") || lastTick.created_at.includes("+")
            ? lastTick.created_at
            : lastTick.created_at.replace(" ", "T") + "Z"
        ).getTime();
        const stale = Date.now() - lastTime > interval * 2 * 1000;

        setVisible(!stale);
        setTicks(data);
      } catch {
        // API unreachable
      }
    }

    poll();
    const t = setInterval(poll, 8000);
    return () => { active = false; clearInterval(t); };
  }, [apiBase]);

  // Auto-scroll to bottom when new ticks arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [ticks]);

  if (!visible || ticks.length === 0) return null;

  // Compute countdown to next tick
  const lastTick = ticks[ticks.length - 1];
  const interval = lastTick.data?.sentry_interval || 300;
  const lastTime = new Date(
    lastTick.created_at.includes("Z") || lastTick.created_at.includes("+")
      ? lastTick.created_at
      : lastTick.created_at.replace(" ", "T") + "Z"
  ).getTime();
  const nextTime = lastTime + interval * 1000;
  const remaining = Math.max(0, Math.floor((nextTime - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="daemon-terminal">
      <div className="daemon-terminal-header">
        <span>SUBCONSCIOUS</span>
        <span className="daemon-terminal-countdown">
          {remaining > 0 ? `next tick ~${minutes}m ${seconds}s` : "tick imminent..."}
        </span>
      </div>
      <div className="daemon-terminal-scroll" ref={scrollRef}>
        {ticks.map((tick, ti) => (
          <div key={tick.tick} className={ti === ticks.length - 1 ? "daemon-tick-current" : "daemon-tick-old"}>
            {(tick.data?.lines || []).map((line, li) => (
              <div key={li} style={{ color: colorForLine(line) }} className="daemon-line">
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
