"use client";

// ============================================================
// Add a structure — pick one, size it, drag it where it's allowed.
//
// The Land tab used to answer one question ("does a 70m² minor dwelling fit?")
// about the largest and hardest structure a buyer might add. A section with no
// room for a granny flat very often has room for a double garage, and always has
// room for a woodshed. This lets them ask about the one they actually want.
//
// THE DRAG IS THE RULE, and that is the point of it. The footprint cannot be
// moved anywhere it may not be built: the constraint is checked per frame
// against the parcel boundary, the existing footprints, and the setback THAT
// STRUCTURE at THAT SIZE has to keep — 0m under 10m², 1m to 30m², 2m for a
// self-contained dwelling. A reader who drags a shed into the corner and feels
// it stop has learnt the rule better than any paragraph would teach them.
//
// The backdrop is LINZ aerial imagery, which is free and licensed CC BY. The
// boundary is drawn from the surveyed parcel, so it lands on the fences in the
// photograph — and when it doesn't, that mismatch is itself worth seeing.
// ============================================================

import { useMemo, useRef, useState } from "react";
import type { SiteLayout } from "@/lib/scoring/site-layout";
import { canPlace, firstFit } from "@/lib/scoring/site-layout";
import {
  BUILDABLE,
  BUILDABLE_BY_ID,
  estimateBuild,
  footprintFor,
  regimeFor,
  regimeNote,
  resaleOf,
  setbacksFor,
  type BuildableStructure,
} from "@/lib/scoring/buildable-structures";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;
const TILE = 256;

/** Web Mercator pixel coordinates at a given zoom. */
function toPixels(lat: number, lng: number, z: number): { px: number; py: number } {
  const n = TILE * 2 ** z;
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    px: ((lng + 180) / 360) * n,
    py: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n,
  };
}

export interface PlacedStructure {
  id: string;
  label: string;
  sqm: number;
  cost: number;
  resale: number;
}

export function AddStructure({
  layout,
  onAdd,
  added,
}: {
  layout: SiteLayout;
  /** Hand the chosen structure to the Renovations plan. */
  onAdd?: (s: PlacedStructure) => void;
  added?: string[];
}) {
  const { plan } = layout;

  // OPEN ON SOMETHING THAT ACTUALLY FITS, in list order — so the granny flat
  // still leads on a section that can take one, and a tight site opens on the
  // sleepout or the garage instead.
  //
  // Opening on the granny flat regardless was worse than it sounds. On the demo
  // section — 612m², a 185m² house and a studio — a 60m² unit has exactly ONE
  // legal position once the 2m setbacks are honoured, so the footprint appeared,
  // refused every drag, and read as a broken control rather than as a section
  // with no room. The refusal is right; leading with it is not.
  const initialId = useMemo(() => {
    for (const b of BUILDABLE) {
      const sb = setbacksFor(regimeFor(b, b.defaultSqm));
      const f = footprintFor(b, b.defaultSqm);
      // Room to move, not just room to sit: a metre of slack either way, so the
      // first thing a reader touches responds to being dragged.
      const slack = { width: f.width + 2, length: f.length + 2 };
      if (firstFit(plan, slack, sb.boundary, sb.building)) return b.id;
    }
    return BUILDABLE[BUILDABLE.length - 1].id;
  }, [plan]);

  const [choiceId, setChoiceId] = useState(initialId);
  const choice = BUILDABLE_BY_ID.get(choiceId) as BuildableStructure;
  const [sqm, setSqm] = useState(choice.defaultSqm);

  const size = footprintFor(choice, sqm);
  const regime = regimeFor(choice, sqm);
  const { boundary, building } = setbacksFor(regime);
  const est = estimateBuild(choice, sqm);

  const W = plan.extent.width;
  const H = plan.extent.length;

  // Somewhere legal to start, recomputed whenever the shape changes so a new
  // choice never lands on the house.
  const home = useMemo(
    () => firstFit(plan, size, boundary, building),
    [plan, size.width, size.length, boundary, building] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const at = pos ?? home;
  const legal = at ? canPlace(plan, { ...at, ...size }, boundary, building) : false;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const grab = useRef({ dx: 0, dy: 0 });

  const PAD = Math.max(3.5, Math.min(9, Math.max(W, H) * 0.11));
  const vw = W + PAD * 2;
  const vh = H + PAD * 2;
  const fs = Math.max(2.2, Math.min(6, Math.max(W, H) * 0.055));
  const px = (p: { x: number; y: number }) => [p.x + PAD, H - p.y + PAD] as const;
  const ring = (r: { x: number; y: number }[]) =>
    r.map((p, i) => `${i === 0 ? "M" : "L"}${px(p).join(" ")}`).join(" ") + " Z";

  /**
   * Pointer → metres in the plan's frame.
   *
   * Via the SVG's OWN matrix, not by scaling the bounding box. The element is a
   * tall section in a wide card with `maxHeight` clamping it, so
   * preserveAspectRatio letterboxes the drawing — roughly 180px of dead space
   * each side. Dividing by the element width therefore mapped every pointer to
   * a point far off the section, `canPlace` refused all of them, and the
   * footprint sat there ignoring the mouse: the drag looked broken when the
   * only thing wrong was the arithmetic pointing at it.
   *
   * getScreenCTM knows about the viewBox, the letterboxing and any transform
   * above it, so this cannot drift out of step with the layout again.
   */
  function toMetres(e: React.PointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x - PAD, y: H - (p.y - PAD) };
  }

  function onDown(e: React.PointerEvent) {
    if (!at) return;
    const m = toMetres(e);
    if (!m) return;
    dragging.current = true;
    grab.current = { dx: m.x - at.x, dy: m.y - at.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    if (!dragging.current || !at) return;
    const m = toMetres(e);
    if (!m) return;
    const want = { x: m.x - grab.current.dx, y: m.y - grab.current.dy };
    // REFUSE the move rather than allowing it and colouring it red. A footprint
    // that can be left sitting somewhere illegal is one a reader will screenshot
    // and take to a builder.
    if (canPlace(plan, { ...want, ...size }, boundary, building)) {
      setPos(want);
      return;
    }
    // Let it slide along a boundary it's pressed against, which is how a real
    // drag should feel — refusing the whole move makes corners impossible.
    const slideX = { x: want.x, y: at.y };
    if (canPlace(plan, { ...slideX, ...size }, boundary, building)) return setPos(slideX);
    const slideY = { x: at.x, y: want.y };
    if (canPlace(plan, { ...slideY, ...size }, boundary, building)) return setPos(slideY);
  }

  const stop = () => { dragging.current = false; };

  // ── The aerial backdrop ───────────────────────────────────────────────────
  const tiles = useMemo(() => {
    const a = plan.anchor;
    if (!a) return null;
    const z = 19; // ~0.3m/px at NZ latitudes — a fence post is a few pixels
    const sw = toPixels(a.lat, a.lng, z);
    const ne = toPixels(a.lat + (H + PAD) / a.mPerDegLat, a.lng + (W + PAD) / a.mPerDegLon, z);
    const swPad = toPixels(a.lat - PAD / a.mPerDegLat, a.lng - PAD / a.mPerDegLon, z);
    const left = swPad.px, top = ne.py, right = ne.px, bottom = swPad.py;
    const out: { x: number; y: number; w: number; h: number; url: string }[] = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor(right / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor(bottom / TILE); ty++) {
        out.push({
          x: ((tx * TILE - left) / (right - left)) * vw,
          y: ((ty * TILE - top) / (bottom - top)) * vh,
          w: (TILE / (right - left)) * vw,
          h: (TILE / (bottom - top)) * vh,
          // Through our own route: the LINZ key is a SERVER key and putting it
          // in a tile URL would publish it to every browser that opens a report.
          url: `/api/tiles/aerial/${z}/${tx}/${ty}`,
        });
      }
    }
    void sw;
    return out;
  }, [plan.anchor, W, H, PAD, vw, vh]);

  const alreadyAdded = added?.includes(choiceId);

  return (
    <div className="rounded-2xl p-5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <h3 className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>Add a structure</h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        Your section, its real boundary and what already stands on it. Pick something, size it, and drag it where you&apos;d
        put it — it won&apos;t go anywhere the setback rules don&apos;t allow.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Structure</span>
          <select
            value={choiceId}
            onChange={(e) => {
              const next = BUILDABLE_BY_ID.get(e.target.value) as BuildableStructure;
              setChoiceId(next.id);
              setSqm(next.defaultSqm);
              setPos(null);
            }}
            className="text-sm rounded-lg px-2 py-1.5 cursor-pointer"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {BUILDABLE.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Size — <strong style={{ color: "var(--text-secondary)" }}>{sqm}m²</strong> ({size.width}m × {size.length}m)
          </span>
          <input
            type="range"
            min={choice.minSqm}
            max={choice.maxSqm}
            step={1}
            value={sqm}
            onChange={(e) => { setSqm(Number(e.target.value)); setPos(null); }}
            className="w-full cursor-pointer"
          />
        </label>

        <div className="text-right">
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Estimated to build</div>
          <div className="mono font-bold text-lg" style={{ color: "var(--text-primary)" }}>{money(est.mid)}</div>
          <div className="text-[10px] mono" style={{ color: "var(--text-muted)" }}>{money(est.low)} – {money(est.high)}</div>
        </div>
      </div>

      {/* The section */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full h-auto rounded-lg touch-none select-none"
        style={{ maxHeight: 460, background: "var(--surface-2)" }}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerLeave={stop}
        role="img"
        aria-label={`Your section, ${Math.round(W)} by ${Math.round(H)} metres, with a ${sqm} square metre ${choice.label} you can drag to a permitted position.`}
      >
        <defs>
          <clipPath id="parcel-clip"><path d={ring(plan.parcel)} /></clipPath>
        </defs>

        {/* Aerial, clipped to the section so the neighbours' land stays theirs. */}
        {tiles && (
          <g clipPath="url(#parcel-clip)">
            {tiles.map((t, i) => (
              <image key={i} href={t.url} x={t.x} y={t.y} width={t.w} height={t.h} preserveAspectRatio="none" />
            ))}
          </g>
        )}

        <path d={ring(plan.parcel)} fill={tiles ? "none" : "var(--good-wash)"} stroke="var(--text-primary)" strokeWidth={0.9} />

        {/* What's already there — outlined, not filled, so the imagery shows through. */}
        {plan.buildings.map((b, i) => (
          <path key={i} d={ring(b)} fill="var(--text-primary)" fillOpacity={tiles ? 0.18 : 0.4} stroke="var(--text-primary)" strokeWidth={0.5} strokeDasharray="1.5 1" />
        ))}

        {/* The new structure. */}
        {at && (
          <g onPointerDown={onDown} style={{ cursor: dragging.current ? "grabbing" : "grab" }}>
            <rect
              x={px({ x: at.x, y: at.y + size.length })[0]}
              y={px({ x: at.x, y: at.y + size.length })[1]}
              width={size.width}
              height={size.length}
              fill={legal ? "var(--brand)" : "var(--bad)"}
              fillOpacity={0.45}
              stroke={legal ? "var(--brand)" : "var(--bad)"}
              strokeWidth={0.8}
            />
            <text
              x={px({ x: at.x + size.width / 2, y: at.y + size.length / 2 })[0]}
              y={px({ x: at.x + size.width / 2, y: at.y + size.length / 2 })[1]}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={fs * 0.85} fontWeight="bold" fill="#fff"
              style={{ paintOrder: "stroke", pointerEvents: "none" }}
            >
              {sqm}m²
            </text>
          </g>
        )}

        {/* Boundary runs. */}
        {plan.parcel.map((p, i) => {
          const q = plan.parcel[(i + 1) % plan.parcel.length];
          const len = Math.hypot(q.x - p.x, q.y - p.y);
          if (len < 5) return null;
          const c = { x: plan.parcel.reduce((s, v) => s + v.x, 0) / plan.parcel.length, y: plan.parcel.reduce((s, v) => s + v.y, 0) / plan.parcel.length };
          const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
          let nx = mid.x - c.x, ny = mid.y - c.y;
          const nl = Math.hypot(nx, ny) || 1;
          const off = Math.max(2.2, PAD * 0.5);
          const [lx, ly] = px({ x: mid.x + (nx / nl) * off, y: mid.y + (ny / nl) * off });
          let ang = (Math.atan2(-(q.y - p.y), q.x - p.x) * 180) / Math.PI;
          if (ang > 90 || ang < -90) ang += 180;
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 0.9}
              fill="var(--text-secondary)" transform={`rotate(${ang} ${lx} ${ly})`}>
              {Math.round(len)}m
            </text>
          );
        })}
      </svg>

      {/* What the rules say about this one. */}
      <p className="text-[11px] mt-2" style={{ color: "var(--text-secondary)" }}>
        {regimeNote(regime, sqm)}{" "}
        {boundary > 0
          ? `The shaded footprint won't cross within ${boundary}m of a boundary or of what's already built.`
          : "At this size there's no setback to keep, so it can sit against the boundary."}
      </p>

      {!at && (
        <p className="text-[11px] mt-2" style={{ color: "var(--bad)" }}>
          A {sqm}m² {choice.label.toLowerCase()} doesn&apos;t fit anywhere on this section once the {boundary}m setback is
          allowed for. Try a smaller size, or something smaller.
        </p>
      )}

      {onAdd && at && (
        <button
          onClick={() => onAdd({ id: choiceId, label: `${choice.label} — ${sqm}m²`, sqm, cost: est.mid, resale: resaleOf(choice, sqm) })}
          disabled={alreadyAdded}
          className="mt-3 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer disabled:cursor-default"
          style={{
            background: alreadyAdded ? "var(--surface-2)" : "var(--brand)",
            color: alreadyAdded ? "var(--text-muted)" : "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {alreadyAdded ? "In your renovation plan ✓" : `Add to renovation plan — ${money(est.mid)}`}
        </button>
      )}

      <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
        {/* The boundary and the footprints ARE LINZ. The imagery underneath is
            LINZ Basemaps only where a basemap key is configured, and Mapbox
            otherwise — see app/api/tiles/aerial. Crediting LINZ for a Mapbox
            photograph is a licensing problem, not a wording one. */}
        Parcel boundary and building footprints: Toitū Te Whenua LINZ, CC BY 4.0. Aerial imagery: LINZ Basemaps, or
        © Mapbox © Maxar where that isn&apos;t configured. Costs are indicative build ranges, not quotes. What we
        don&apos;t read is the district plan itself — hazard overlays, height to boundary, and any covenant on your
        title can all still apply.
      </p>
    </div>
  );
}
