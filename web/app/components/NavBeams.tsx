"use client";

const NAV_LINKS = [
  { label: "Archives", href: "/archives" },
  { label: "About", href: "#" },
  { label: "Source", href: "#" },
];

export default function NavBeams() {
  const cx = 450;  // crystal center = 50% of viewBox 900
  const cy = 50;
  const beamLen = 300;
  const spread = 28;
  const count = NAV_LINKS.length;

  return (
    <svg
      viewBox="0 0 900 100"
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
    >
      {/* Input beam: far left → crystal center */}
      <line
        x1={cx - beamLen}
        y1={cy}
        x2={cx}
        y2={cy}
        stroke="white"
        strokeWidth="1.5"
        opacity="0.5"
      />

      {/* Output beams: crystal center → diverging right → nav links */}
      {NAV_LINKS.map((link, i) => {
        const endX = cx + beamLen;
        const endY = cy + (i - (count - 1) / 2) * spread;
        return (
          <g key={link.label}>
            <line
              x1={cx}
              y1={cy}
              x2={endX}
              y2={endY}
              stroke="white"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <a href={link.href}>
              <text
                x={endX + 12}
                y={endY + 4}
                textAnchor="start"
                fill="#00ffd5"
                fontSize="14"
                fontFamily="var(--font-mono)"
                style={{ letterSpacing: "1px", cursor: "pointer" }}
              >
                {link.label.toUpperCase()}
              </text>
            </a>
          </g>
        );
      })}
    </svg>
  );
}
