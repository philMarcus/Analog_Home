"use client";

import dynamic from "next/dynamic";

const Crystal = dynamic(() => import("./Crystal"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: 220,
        height: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          background: "rgba(57, 255, 20, 0.08)",
          border: "1px solid rgba(57, 255, 20, 0.25)",
          transform: "rotate(45deg)",
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
    </div>
  ),
});

export default function CrystalWrapper() {
  return <Crystal />;
}
