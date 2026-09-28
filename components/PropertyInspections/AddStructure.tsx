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

import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteLayout } from "@/lib/scoring/site-layout";
import { canPlace, firstFit, rectOutline } from "@/lib/scoring/site-layout";
import { IMAGERY_CREDIT, IMAGERY_SOURCE_HEADER, isImagerySource, type ImagerySource } from "@/lib/imagery/source";
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

/**
 * What an easement is FOR. LINZ publishes where a surveyed easement runs but
 * not its purpose — that is only in the instrument — so the buyer says, from
 * the title or the LIM. Until they do it is "unknown", and unknown is treated
 * as a right of way: nothing goes on it.
 */
type EasementUse = "unknown" | "row" | "services";

/**
 * What may sit over a drainage or services easement: a small structure with no
 * foundations that can be lifted off if the pipe or cable needs digging up. The
 * 10m² line is Schedule 1's no-setback size, where these are built on skids or
 * blocks rather than footings.
 */
const REMOVABLE = new Set(["garden_shed", "wood_shed", "greenhouse", "closed_shed"]);
const REMOVABLE_MAX_SQM = 10;
const isRemovable = (id: string, sqm: number) => REMOVABLE.has(id) && sqm <= REMOVABLE_MAX_SQM;
const isEasement = (kind: string) => /^easement/i.test(kind);
const TILE = 256;

function inPoly(p: { x: number; y: number }, r: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i].y > p.y !== r[j].y > p.y && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) inside = !inside;
  }
  return inside;
}

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

  // Which easements the buyer has said are drainage or services. A removable
  // structure may sit over those; nothing sits over a right of way, a
  // covenant, or an easement nobody has identified.
  const [uses, setUses] = useState<Record<number, EasementUse>>({});
  const removable = isRemovable(choiceId, sqm);
  const placing = useMemo(
    () => ({
      ...plan,
      burdens: (plan.burdens ?? []).filter((b, i) => !(removable && isEasement(b.kind) && uses[i] === "services")),
    }),
    [plan, uses, removable]
  );

  // Degrees, anticlockwise from square-to-north. Turning is held to the same
  // rule as dragging: it won't turn into a position the setbacks don't allow.
  const [angle, setAngle] = useState(0);
  const [turnBlocked, setTurnBlocked] = useState(false);

  // Somewhere legal to start, recomputed whenever the shape changes so a new
  // choice never lands on the house.
  const home = useMemo(
    () => firstFit(placing, size, boundary, building, angle),
    [placing, size.width, size.length, boundary, building] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const at = pos ?? home;
  const legal = at ? canPlace(placing, { ...at, ...size, angle }, boundary, building) : false;

  // Sitting over an easement the buyer said is drainage or services: allowed,
  // for something removable, and said plainly every time.
  const overServices = useMemo(() => {
    if (!at) return [] as string[];
    const outline = rectOutline({ ...at, ...size, angle });
    return (plan.burdens ?? [])
      .filter((b, i) => isEasement(b.kind) && uses[i] === "services")
      .filter((b) => outline.some((p) => inPoly(p, b.ring)) || b.ring.some((p) => inPoly(p, outline)))
      .map((b) => b.appellation ?? "the easement");
  }, [at, size.width, size.length, angle, plan.burdens, uses]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Turn to `next`, where it stands if it fits there, otherwise nudged to the
   * nearest spot within a few metres that does. If nowhere close fits, it
   * doesn't turn, and says so — the same refusal the drag gives.
   */
  function turnTo(next: number) {
    const a = ((Math.round(next) % 180) + 180) % 180;
    if (!at) return;
    if (canPlace(placing, { ...at, ...size, angle: a }, boundary, building)) {
      setAngle(a);
      setTurnBlocked(false);
      return;
    }
    let best: { x: number; y: number; d: number } | null = null;
    for (let dx = -4; dx <= 4; dx += 0.5) {
      for (let dy = -4; dy <= 4; dy += 0.5) {
        const p = { x: at.x + dx, y: at.y + dy };
        const d = Math.hypot(dx, dy);
        if ((!best || d < best.d) && canPlace(placing, { ...p, ...size, angle: a }, boundary, building)) best = { ...p, d };
      }
    }
    if (best) {
      setPos({ x: best.x, y: best.y });
      setAngle(a);
      setTurnBlocked(false);
    } else {
      setTurnBlocked(true);
    }
  }

  /** The angle of the boundary nearest the structure, so it can sit square to it. */
  function nearestBoundaryAngle(): number | null {
    if (!at) return null;
    const c = { x: at.x + size.width / 2, y: at.y + size.length / 2 };
    let best: { a: number; d: number } | null = null;
    plan.parcel.forEach((p, i) => {
      const q = plan.parcel[(i + 1) % plan.parcel.length];
      const vx = q.x - p.x, vy = q.y - p.y;
      const len2 = vx * vx + vy * vy;
      if (len2 < 1) return;
      const t = Math.max(0, Math.min(1, ((c.x - p.x) * vx + (c.y - p.y) * vy) / len2));
      const d = Math.hypot(c.x - (p.x + t * vx), c.y - (p.y + t * vy));
      if (!best || d < best.d) best = { a: (Math.atan2(vy, vx) * 180) / Math.PI, d };
    });
    return best ? (best as { a: number }).a : null;
  }

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
    if (canPlace(placing, { ...want, ...size, angle }, boundary, building)) {
      setPos(want);
      return;
    }
    // Let it slide along a boundary it's pressed against, which is how a real
    // drag should feel — refusing the whole move makes corners impossible.
    const slideX = { x: want.x, y: at.y };
    if (canPlace(placing, { ...slideX, ...size, angle }, boundary, building)) return setPos(slideX);
    const slideY = { x: at.x, y: want.y };
    if (canPlace(placing, { ...slideY, ...size, angle }, boundary, building)) return setPos(slideY);
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

  // WHO to credit. Two providers on different licences serve /api/tiles/aerial,
  // and the page cannot tell them apart from the picture — an <img> hands back
  // no headers. So one tile is fetched for its header; the browser has the same
  // URL in its HTTP cache from drawing it, so this is not a second download.
  //
  // Null means no imagery is on screen at all (no anchor, or nothing answered),
  // and then no imagery credit is printed — crediting a provider whose picture
  // nobody is looking at is its own small untruth.
  const [imagery, setImagery] = useState<ImagerySource | null>(null);
  useEffect(() => {
    const first = tiles?.[0];
    if (!first) { setImagery(null); return; }
    let cancelled = false;
    fetch(first.url)
      .then((r) => {
        if (cancelled || !r.ok) return;
        const named = r.headers.get(IMAGERY_SOURCE_HEADER);
        if (isImagerySource(named)) setImagery(named);
      })
      .catch(() => { /* the plan still draws; it just carries no imagery credit */ });
    return () => { cancelled = true; };
  }, [tiles]);

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
              setAngle(0);
              setTurnBlocked(false);
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
            onChange={(e) => { setSqm(Number(e.target.value)); setPos(null); setAngle(0); setTurnBlocked(false); }}
            className="w-full cursor-pointer"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-[160px]">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Rotate — <strong style={{ color: "var(--text-secondary)" }}>{angle}°</strong>
          </span>
          <input
            type="range"
            min={0}
            max={179}
            step={1}
            value={angle}
            disabled={!at}
            onChange={(e) => turnTo(Number(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="Rotate the structure"
          />
          <span className="flex gap-2 text-[11px]">
            <button type="button" disabled={!at} onClick={() => turnTo(angle + 90)} className="cursor-pointer underline" style={{ color: "var(--brand)" }}>
              Turn 90°
            </button>
            <button
              type="button"
              disabled={!at}
              onClick={() => {
                const a = nearestBoundaryAngle();
                if (a != null) turnTo(a);
              }}
              className="cursor-pointer underline"
              style={{ color: "var(--brand)" }}
            >
              Line up with nearest boundary
            </button>
          </span>
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

        {/* Ground tone under the drawing when there is no photograph. Presentation
            only — a driveway or a lawn edge drawn here would be invention, and
            nothing on this plan is allowed to be. */}
        <path d={ring(plan.parcel)} fill={tiles ? "none" : "var(--good-wash)"} stroke="var(--text-primary)" strokeWidth={0.9} />

        {/* REGISTERED BURDENS. Drawn under the buildings and over the imagery,
            hatched so they read as a restriction rather than a structure. The
            drag refuses to cross them — you cannot build over a right of way. */}
        {(plan.burdens ?? []).map((b, i) => {
          const c = { x: b.ring.reduce((s2, q) => s2 + q.x, 0) / b.ring.length, y: b.ring.reduce((s2, q) => s2 + q.y, 0) / b.ring.length };
          const bx = b.ring.map((q) => q.x), by = b.ring.map((q) => q.y);
          const w = Math.max(...bx) - Math.min(...bx), h = Math.max(...by) - Math.min(...by);
          const [lx, ly] = px(c);
          // Written ALONG the strip, because an easement is nearly always long
          // and thin and a horizontal label would overflow it.
          const vertical = h > w * 1.4;
          return (
            <g key={`burden-${i}`}>
              <path
                d={ring(b.ring)}
                fill="var(--warn)"
                fillOpacity={0.22}
                stroke="var(--warn)"
                strokeWidth={0.7}
                strokeDasharray="2 1.5"
              />
              {(() => {
                // SIZED TO THE STRIP. "EASEMENT — NO BUILDING" at the plan's
                // normal text size ran clean past both boundaries of a 17m band
                // and out over the neighbours. The label is the KIND only — the
                // legend and the banner below both already say you can't build
                // there — and it shrinks to fit the shorter side of the strip,
                // disappearing entirely when there is no room for it.
                const label = b.kind.toUpperCase();
                const along = vertical ? h : w;
                const across = vertical ? w : h;
                const size = Math.min(fs * 0.8, (along * 0.85) / (label.length * 0.58), across * 0.62);
                if (size < 1.2) return null;
                return (
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={size}
                    fontWeight="bold"
                    fill="var(--warn)"
                    transform={vertical ? `rotate(-90 ${lx} ${ly})` : undefined}
                    style={{ pointerEvents: "none" }}
                  >
                    {label}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* What's already there — outlined, not filled, so the imagery shows through. */}
        {plan.buildings.map((b, i) => (
          <g key={i}>
            {/* A soft offset shadow reads as a building standing on ground
                rather than a hole cut in it. Offset south-east, which is where
                a New Zealand shadow falls. */}
            <path d={ring(b.map((q) => ({ x: q.x + 0.6, y: q.y - 0.6 })))} fill="#000" fillOpacity={0.16} />
            <path d={ring(b)} fill="var(--text-primary)" fillOpacity={tiles ? 0.18 : 0.42} stroke="var(--text-primary)" strokeWidth={0.5} strokeDasharray="1.5 1" />
          </g>
        ))}

        {/* The new structure. */}
        {at && (
          <g onPointerDown={onDown} style={{ cursor: dragging.current ? "grabbing" : "grab" }}>
            {/* Drawn from the same turned outline canPlace checks, so what you
                see is exactly what was tested. */}
            <path
              d={ring(rectOutline({ ...at, ...size, angle }))}
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

        {/* North arrow. We know which way is up because the metre frame is built
            off latitude — +y IS north — so this is measured, not decorative. */}
        <g style={{ pointerEvents: "none" }}>
          <line x1={vw - PAD * 0.55} y1={PAD * 1.25} x2={vw - PAD * 0.55} y2={PAD * 0.45}
            stroke="var(--text-secondary)" strokeWidth={0.6} />
          <path d={`M${vw - PAD * 0.55} ${PAD * 0.3} l${fs * 0.28} ${fs * 0.5} l${-fs * 0.56} 0 Z`} fill="var(--text-secondary)" />
          <text x={vw - PAD * 0.55} y={PAD * 1.75} textAnchor="middle" fontSize={fs * 0.8}
            fill="var(--text-secondary)" fontWeight="bold">N</text>
        </g>

        {/* Scale bar — a round number of metres, so the reader can measure
            anything on the plan against it rather than trusting the labels. */}
        {(() => {
          const nice = [5, 10, 20, 50].find((n) => n <= W * 0.45) ?? 5;
          const x0 = PAD, y0 = vh - PAD * 0.35;
          return (
            <g style={{ pointerEvents: "none" }}>
              <line x1={x0} y1={y0} x2={x0 + nice} y2={y0} stroke="var(--text-secondary)" strokeWidth={0.7} />
              <line x1={x0} y1={y0 - fs * 0.3} x2={x0} y2={y0 + fs * 0.3} stroke="var(--text-secondary)" strokeWidth={0.7} />
              <line x1={x0 + nice} y1={y0 - fs * 0.3} x2={x0 + nice} y2={y0 + fs * 0.3} stroke="var(--text-secondary)" strokeWidth={0.7} />
              <text x={x0 + nice / 2} y={y0 - fs * 0.55} textAnchor="middle" fontSize={fs * 0.75} fill="var(--text-secondary)">{nice}m</text>
            </g>
          );
        })()}

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
      {(plan.burdens ?? []).length > 0 && (
        <p className="text-[11px] mt-2 rounded-lg p-2.5" style={{ background: "var(--warn-wash)", border: "1px solid var(--warn-wash)", color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>
            {plan.burdens.length === 1 ? "One registered area" : `${plan.burdens.length} registered areas`} on this section
            can&apos;t be built on
          </strong>{" "}
          — {plan.burdens.map((b) => `${b.kind.toLowerCase()}${b.appellation ? ` (${b.appellation})` : ""}`).join(", ")}. The
          footprint won&apos;t cross them, unless you mark an easement below as drainage or services — and then only with
          something small and removable. We can see WHERE they run but not what they permit, so give those references to your
          solicitor. And an absence of shading is not an all-clear: many easements are described in words on the title with no
          surveyed extent at all.
        </p>
      )}

      {/* What each easement is FOR. LINZ doesn't publish it — the instrument
          does — so the buyer says, from the title or the LIM. A drainage or
          services easement can take a small removable structure; a right of
          way, a covenant or an unidentified easement takes nothing. */}
      {(plan.burdens ?? []).some((b) => isEasement(b.kind)) && (
        <div className="mt-2 rounded-lg p-2.5 text-[11px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>What is each easement for?</div>
          <div className="mt-0.5">
            It&apos;s on the title or the LIM. A right of way has to stay clear. Over drainage or services — pipes or cables — a
            small removable structure can usually sit: a garden shed, woodshed, greenhouse or closed shed up to {REMOVABLE_MAX_SQM}m²,
            on skids or blocks rather than foundations.
          </div>
          <div className="mt-2 space-y-1.5">
            {(plan.burdens ?? []).map((b, i) =>
              isEasement(b.kind) ? (
                <label key={i} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{b.appellation ?? `Easement ${i + 1}`}</span>
                  <select
                    value={uses[i] ?? "unknown"}
                    onChange={(e) => { setUses((u) => ({ ...u, [i]: e.target.value as EasementUse })); setPos(null); }}
                    className="rounded-md px-2 py-1 text-[11px]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="unknown">Don&apos;t know — keep it clear</option>
                    <option value="row">Right of way — keep it clear</option>
                    <option value="services">Drainage or services (pipes, cables)</option>
                  </select>
                </label>
              ) : null
            )}
          </div>
          {Object.values(uses).includes("services") && !removable && (
            <div className="mt-2" style={{ color: "var(--text-muted)" }}>
              A {sqm}m² {choice.label.toLowerCase()} still can&apos;t go over it — only a removable garden shed, woodshed, greenhouse
              or closed shed up to {REMOVABLE_MAX_SQM}m² can.
            </div>
          )}
        </div>
      )}

      {overServices.length > 0 && (
        <p className="text-[11px] mt-2 rounded-lg p-2.5" style={{ background: "var(--warn-wash)", color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--warn)" }}>Over a drainage or services easement ({overServices.join(", ")}).</strong>{" "}
          Usually allowed only because it can be moved: if the pipe or cable needs work it comes off, at your cost. Keep it on
          skids or blocks, not foundations. Check the instrument&apos;s wording, and if it&apos;s a public drain, the council&apos;s
          rules for building near it.
        </p>
      )}

      <p className="text-[11px] mt-2" style={{ color: "var(--text-secondary)" }}>
        {regimeNote(regime, sqm)}{" "}
        {boundary > 0
          ? `The shaded footprint won't cross within ${boundary}m of a boundary or of what's already built.`
          : "At this size there's no setback to keep, so it can sit against the boundary."}
      </p>

      {turnBlocked && (
        <p className="text-[11px] mt-2" style={{ color: "var(--warn)" }}>
          There isn&apos;t room to turn it there without breaking a setback. Drag it somewhere more open and try again.
        </p>
      )}

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
        {/* The boundary and the footprints ARE LINZ, always. The imagery under
            them is whichever of the two providers answered, which the route
            reports in a header — this used to read "LINZ Basemaps, or © Mapbox
            © Maxar where that isn't configured", naming both and committing to
            neither. Crediting the wrong one is a licensing problem, not a
            wording one, and an "or" is not attribution. */}
        Parcel boundary and building footprints: Toitū Te Whenua LINZ, CC BY 4.0.
        {imagery ? ` ${IMAGERY_CREDIT[imagery]}.` : ""} Costs are indicative build ranges, not quotes. What we
        don&apos;t read is the district plan itself — hazard overlays, height to boundary, and any covenant on your
        title can all still apply.
      </p>
    </div>
  );
}
