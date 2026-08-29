"use client";

// ============================================================
// The section, drawn to scale.
//
// "The largest unbroken clear area is 19m × 51m, behind the house" is a sentence
// a reader has to take on trust. The same thing drawn — boundary measured, house
// where it actually stands, the proposed unit sitting in the gap — is a claim
// they can hold against the aerial shot in the listing and check for themselves.
// That is the difference this whole report is supposed to be.
//
// Every coordinate comes from LINZ: the parcel boundary from NZ Primary Parcels,
// the footprints from NZ Building Outlines. Nothing here is drawn from an
// impression of the photographs.
// ============================================================

import type { SiteLayout } from "@/lib/scoring/site-layout";

/**
 * Breathing room for the dimension labels, in METRES — the same units as the
 * plan, because the viewBox is the section itself.
 *
 * A fixed 26 swamped the drawing: on a 38 × 52m section that is 26 METRES of
 * margin on every side, and the parcel came out occupying 40% of the canvas.
 * Proportional keeps the section large whatever its size.
 */
const padFor = (extent: number) => Math.max(3.5, Math.min(9, extent * 0.11));

interface Pt {
  x: number;
  y: number;
}

/** Metres → SVG, flipping Y so north is up rather than down. */
function project(p: Pt, height: number, pad: number): [number, number] {
  return [p.x + pad, height - p.y + pad];
}

const path = (ring: Pt[], height: number, pad: number): string =>
  ring.map((p, i) => `${i === 0 ? "M" : "L"}${project(p, height, pad).join(" ")}`).join(" ") + " Z";

function ringCentre(r: Pt[]): Pt {
  return { x: r.reduce((s, p) => s + p.x, 0) / r.length, y: r.reduce((s, p) => s + p.y, 0) / r.length };
}

/**
 * Length of each boundary run, so the reader can measure the section themselves.
 *
 * Pushed OUTSIDE the boundary, perpendicular to each edge. On the edge they
 * collided with the house — "45m" printed straight through the word "house" —
 * which is the sort of thing that makes a drawing look like a mistake rather
 * than a measurement.
 */
function edgeLabels(ring: Pt[], height: number, pad: number) {
  const c = ringCentre(ring);
  const out: { x: number; y: number; text: string; angle: number }[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 5) continue; // a 2m chamfer labelled "2m" is clutter, not information
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // Outward normal: away from the centre of the section.
    let nx = mid.x - c.x, ny = mid.y - c.y;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const off = Math.max(2.2, pad * 0.5);
    const [x, y] = project({ x: mid.x + nx * off, y: mid.y + ny * off }, height, pad);
    let angle = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
    if (angle > 90 || angle < -90) angle += 180; // keep text upright
    out.push({ x, y, text: `${Math.round(len)}m`, angle });
  }
  return out;
}

export function SitePlan({ layout }: { layout: SiteLayout }) {
  const { plan, largestClear, unitFits, assumed } = layout;
  if (!plan.parcel.length) return null;

  const { width: W, length: H } = plan.extent;
  const PAD = padFor(Math.max(W, H));
  const vw = W + PAD * 2;
  const vh = H + PAD * 2;
  // Text sized against the drawing, not against a fixed canvas — a 12m courtyard
  // and a 90m rural block otherwise get the same letter height in metres, and
  // one of them is unreadable.
  const fs = Math.max(2.2, Math.min(6, Math.max(W, H) * 0.055));

  // Which side the street is on, so the drawing can be labelled rather than
  // leaving the reader to guess which way they'd be looking at it.
  const road = plan.road;
  const roadSide = road
    ? Math.abs(road.x - W / 2) > Math.abs(road.y - H / 2)
      ? road.x < W / 2 ? "left" : "right"
      : road.y < H / 2 ? "bottom" : "top"
    : null;

  const houseArea = (r: Pt[]) => {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j].x * r[i].y - r[i].x * r[j].y;
    return Math.abs(a / 2);
  };
  const biggest = plan.buildings.length
    ? plan.buildings.reduce((m, b) => (houseArea(b) > houseArea(m) ? b : m))
    : null;

  return (
    <div className="mt-4 rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          The section, to scale
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          LINZ parcel boundary &amp; building footprints
        </span>
      </div>

      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full h-auto"
        style={{ maxHeight: 420 }}
        role="img"
        aria-label={`Site plan: a ${Math.round(W)} by ${Math.round(H)} metre section with ${plan.buildings.length} existing building${plan.buildings.length === 1 ? "" : "s"}${unitFits ? " and space for a minor dwelling" : " and no room for a minor dwelling"}.`}
      >
        {/* The street, so "front" and "back" are visible rather than asserted. */}
        {roadSide && (
          <g>
            <line
              x1={roadSide === "left" ? 5 : roadSide === "right" ? vw - 5 : 0}
              y1={roadSide === "top" ? 5 : roadSide === "bottom" ? vh - 5 : 0}
              x2={roadSide === "left" ? 5 : roadSide === "right" ? vw - 5 : vw}
              y2={roadSide === "top" ? 5 : roadSide === "bottom" ? vh - 5 : vh}
              stroke="var(--text-muted)"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              opacity={0.5}
            />
            <text
              x={roadSide === "left" ? 12 : roadSide === "right" ? vw - 12 : vw / 2}
              y={roadSide === "top" ? 14 : roadSide === "bottom" ? vh - 6 : vh / 2}
              textAnchor="middle"
              fontSize={fs}
              fill="var(--text-muted)"
              transform={roadSide === "left" ? `rotate(-90 12 ${vh / 2})` : roadSide === "right" ? `rotate(90 ${vw - 12} ${vh / 2})` : undefined}
            >
              street
            </text>
          </g>
        )}

        {/* The section itself. */}
        <path d={path(plan.parcel, H, PAD)} fill="var(--good-wash)" stroke="var(--text-secondary)" strokeWidth={1.2} opacity={0.9} />

        {/* Where a minor dwelling would go. Drawn UNDER the buildings so an
            overlap would be visible rather than hidden by paint order. */}
        {plan.clearArea && (
          <path
            d={path(plan.clearArea, H, PAD)}
            fill="var(--brand)"
            fillOpacity={0.1}
            stroke="var(--brand)"
            strokeWidth={0.5}
            strokeDasharray="2 2"
            opacity={0.7}
          />
        )}
        {plan.unit && (
          <>
            <path d={path(plan.unit, H, PAD)} fill="var(--brand)" fillOpacity={0.28} stroke="var(--brand)" strokeWidth={1.2} strokeDasharray="4 2" />
            <text
              x={project({ x: (plan.unit[0].x + plan.unit[2].x) / 2, y: (plan.unit[0].y + plan.unit[2].y) / 2 }, H, PAD)[0]}
              y={project({ x: (plan.unit[0].x + plan.unit[2].x) / 2, y: (plan.unit[0].y + plan.unit[2].y) / 2 }, H, PAD)[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fs}
              fontWeight="bold"
              fill="var(--brand)"
            >
              {assumed.unit.width}×{assumed.unit.length}m
            </text>
          </>
        )}

        {/* What already stands there. */}
        {plan.buildings.map((b, i) => (
          <path
            key={i}
            d={path(b, H, PAD)}
            fill="var(--text-secondary)"
            fillOpacity={b === biggest ? 0.55 : 0.32}
            stroke="var(--text-secondary)"
            strokeWidth={0.8}
          />
        ))}
        {biggest && (
          <text
            x={project({ x: biggest.reduce((s, p) => s + p.x, 0) / biggest.length, y: biggest.reduce((s, p) => s + p.y, 0) / biggest.length }, H, PAD)[0]}
            y={project({ x: biggest.reduce((s, p) => s + p.x, 0) / biggest.length, y: biggest.reduce((s, p) => s + p.y, 0) / biggest.length }, H, PAD)[1]}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fs}
            fill="var(--surface)"
            fontWeight="bold"
          >
            house
          </text>
        )}

        {/* Boundary runs, measured. */}
        {edgeLabels(plan.parcel, H, PAD).map((e, i) => (
          <text
            key={i}
            x={e.x}
            y={e.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fs * 0.95}
            fill="var(--text-secondary)"
            transform={`rotate(${e.angle} ${e.x} ${e.y})`}
            dy={-3}
          >
            {e.text}
          </text>
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1">
          <span style={{ width: 9, height: 9, background: "var(--text-secondary)", opacity: 0.55, display: "inline-block", borderRadius: 2 }} />
          existing buildings
        </span>
        {plan.unit ? (
          <span className="flex items-center gap-1">
            <span style={{ width: 9, height: 9, background: "var(--brand)", opacity: 0.28, border: "1px dashed var(--brand)", display: "inline-block", borderRadius: 2 }} />
            a {assumed.unit.width}m × {assumed.unit.length}m unit, in the clear area it would sit in
          </span>
        ) : (
          <span style={{ color: "var(--warn)" }}>
            no {assumed.unit.width}m × {assumed.unit.length}m space clears the {assumed.boundarySetback}m setbacks
            {largestClear ? ` — the largest is ${largestClear.width}m × ${largestClear.length}m` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
