import ContenderCard from "./ContenderCard";
import type { ContenderState } from "@/lib/types";

interface ContenderGridProps {
  contenders: ContenderState[];
}

export default function ContenderGrid({ contenders }: ContenderGridProps) {
  return (
    <section style={{ padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Section heading */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Contenders
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          <span
            style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 10,
              letterSpacing: "0.04em",
              color: "var(--text-muted)",
            }}
          >
            {contenders.length} agents
          </span>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {contenders.map((c) => (
            <ContenderCard key={c.id} contender={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
