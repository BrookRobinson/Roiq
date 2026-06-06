"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Home, TrendingUp, CheckCircle2, MapPin } from "lucide-react";

type Role = "buyer" | "investor" | "both";
type RentalType = "longterm" | "shortterm" | "both" | "undecided";

const NZ_REGIONS = [
  "Auckland", "Wellington", "Canterbury", "Bay of Plenty", "Waikato",
  "Hawke's Bay", "Manawatū-Whanganui", "Otago", "Taranaki", "Northland",
  "Nelson / Marlborough", "West Coast", "Southland", "Gisborne", "Tasman",
];

const PROPERTY_TYPES = ["House", "Townhouse", "Unit", "Apartment", "Any"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [rentalType, setRentalType] = useState<RentalType>("longterm");
  const [budget, setBudget] = useState("");
  const [deposit, setDeposit] = useState("");
  const [holdYears, setHoldYears] = useState(10);
  const [holdIndefinitely, setHoldIndefinitely] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [nationwide, setNationwide] = useState(false);
  const [minBeds, setMinBeds] = useState(2);
  const [minLand, setMinLand] = useState("");
  const [propTypes, setPropTypes] = useState<string[]>(["House"]);
  const [freeholdOnly, setFreeholdOnly] = useState(false);
  const [minScore, setMinScore] = useState(500);
  const [minYield, setMinYield] = useState(4);

  const depositPct = budget && deposit
    ? Math.round((Number(deposit.replace(/,/g, "")) / Number(budget.replace(/,/g, ""))) * 100)
    : null;

  function toggleRegion(r: string) {
    setRegions((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function togglePropType(t: string) {
    if (t === "Any") { setPropTypes(["Any"]); return; }
    setPropTypes((prev) => {
      const without = prev.filter((x) => x !== "Any");
      return without.includes(t) ? without.filter((x) => x !== t) : [...without, t];
    });
  }

  async function finish() {
    // TODO: save to Supabase user profile
    router.push("/map");
  }

  const progress = (step / 4) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="font-bold text-2xl mb-1" style={{ color: "var(--brand)" }}>RoiQ</div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Set up your profile — takes 2 minutes
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            {["Your role", "Budget & timeline", "Locations", "Preferences"].map((l, i) => (
              <span key={l} style={{ color: i + 1 <= step ? "var(--brand)" : "var(--text-muted)", fontWeight: i + 1 === step ? 600 : 400 }}>
                {l}
              </span>
            ))}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "var(--brand)", boxShadow: "0 0 8px var(--brand-glow)" }} />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

          {/* Step 1 — Role */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>What brings you to RoiQ?</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>This personalises your reports and map view.</p>
              <div className="space-y-3 mb-6">
                {([
                  { id: "buyer",    icon: Home,        label: "Home buyer",         sub: "Looking for a home to live in" },
                  { id: "investor", icon: TrendingUp,  label: "Property investor",  sub: "Building or growing a portfolio" },
                  { id: "both",     icon: CheckCircle2,label: "Both",               sub: "I do both" },
                ] as const).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                    style={{
                      border: `1.5px solid ${role === r.id ? "var(--brand)" : "var(--border)"}`,
                      background: role === r.id ? "var(--brand-light)" : "var(--surface-2)",
                      boxShadow: role === r.id ? "0 0 12px var(--brand-glow)" : "none",
                    }}
                  >
                    <r.icon size={20} style={{ color: role === r.id ? "var(--brand)" : "var(--text-secondary)", flexShrink: 0 }} />
                    <div className="text-left">
                      <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{r.label}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.sub}</div>
                    </div>
                    {role === r.id && <CheckCircle2 size={16} className="ml-auto" style={{ color: "var(--brand)", flexShrink: 0 }} />}
                  </button>
                ))}
              </div>

              {(role === "investor" || role === "both") && (
                <div>
                  <label className="label">Rental strategy</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["longterm", "shortterm", "both", "undecided"] as const).map((r) => {
                      const labels: Record<string, string> = { longterm: "Long-term rental", shortterm: "Short-term / Airbnb", both: "Both", undecided: "Undecided" };
                      return (
                        <button
                          key={r}
                          onClick={() => setRentalType(r)}
                          className="p-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                          style={{
                            border: `1.5px solid ${rentalType === r ? "var(--brand)" : "var(--border)"}`,
                            background: rentalType === r ? "var(--brand-light)" : "var(--surface-2)",
                            color: rentalType === r ? "var(--brand)" : "var(--text-secondary)",
                          }}
                        >
                          {labels[r]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Budget & timeline */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Budget & timeline</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Used to filter the map and personalise financial projections.</p>
              <div className="space-y-4">
                <div>
                  <label className="label">Maximum purchase budget</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold" style={{ color: "var(--text-muted)" }}>$</span>
                    <input className="input pl-7" placeholder="e.g. 850,000" value={budget} onChange={(e) => setBudget(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Deposit available</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold" style={{ color: "var(--text-muted)" }}>$</span>
                    <input className="input pl-7" placeholder="e.g. 170,000" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                  </div>
                  {depositPct !== null && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--brand)" }}>
                      = {depositPct}% deposit on your max budget
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label" style={{ marginBottom: 0 }}>How long do you plan to hold?</label>
                    <span className="font-bold mono text-sm" style={{ color: "var(--brand)" }}>
                      {holdIndefinitely ? "Indefinitely" : `${holdYears} years`}
                    </span>
                  </div>
                  <input
                    type="range" min={1} max={40} value={holdYears}
                    onChange={(e) => { setHoldYears(Number(e.target.value)); setHoldIndefinitely(false); }}
                    className="w-full cursor-pointer mb-2"
                    style={{ accentColor: "var(--brand)" }}
                    disabled={holdIndefinitely}
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={holdIndefinitely} onChange={(e) => setHoldIndefinitely(e.target.checked)} className="cursor-pointer" />
                    Hold indefinitely (not planning to sell)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Locations */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Where are you looking?</h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>The map will pre-filter to your selected regions.</p>
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer p-3 rounded-xl mb-3" style={{ color: "var(--text-primary)", background: nationwide ? "var(--brand-light)" : "var(--surface-2)", border: `1px solid ${nationwide ? "var(--brand)" : "var(--border)"}` }}>
                  <input type="checkbox" checked={nationwide} onChange={(e) => { setNationwide(e.target.checked); if (e.target.checked) setRegions([]); }} className="cursor-pointer" />
                  <MapPin size={14} style={{ color: "var(--brand)" }} />
                  <strong>Willing to invest anywhere in NZ</strong>
                  <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>(enables full NZ map)</span>
                </label>
                {!nationwide && (
                  <div className="flex flex-wrap gap-2">
                    {NZ_REGIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => toggleRegion(r)}
                        className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-all"
                        style={{
                          background: regions.includes(r) ? "var(--brand-light)" : "var(--surface-2)",
                          border: `1px solid ${regions.includes(r) ? "var(--brand)" : "var(--border)"}`,
                          color:  regions.includes(r) ? "var(--brand)" : "var(--text-secondary)",
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4 — Preferences */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Property preferences</h2>
              <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>Sets map defaults. Editable anytime from Account → Preferences.</p>
              <div className="space-y-4">
                <div>
                  <label className="label">Minimum bedrooms</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setMinBeds(n)}
                        className="w-10 h-10 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                        style={{ background: minBeds === n ? "var(--brand-light)" : "var(--surface-2)", border: `1.5px solid ${minBeds === n ? "var(--brand)" : "var(--border)"}`, color: minBeds === n ? "var(--brand)" : "var(--text-secondary)" }}>
                        {n}+
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Property type</label>
                  <div className="flex flex-wrap gap-2">
                    {PROPERTY_TYPES.map((t) => (
                      <button key={t} onClick={() => togglePropType(t)}
                        className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-all"
                        style={{ background: propTypes.includes(t) ? "var(--brand-light)" : "var(--surface-2)", border: `1px solid ${propTypes.includes(t) ? "var(--brand)" : "var(--border)"}`, color: propTypes.includes(t) ? "var(--brand)" : "var(--text-secondary)" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Freehold title only</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>Exclude cross-lease and unit title</div>
                  </div>
                  <button onClick={() => setFreeholdOnly(!freeholdOnly)}
                    className="w-10 h-5 rounded-full relative cursor-pointer transition-colors"
                    style={{ background: freeholdOnly ? "var(--brand)" : "var(--surface)", border: "2px solid var(--border)" }}>
                    <div className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform" style={{ left: 2, transform: freeholdOnly ? "translateX(20px)" : "translateX(0)" }} />
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label" style={{ marginBottom: 0 }}>Minimum quality score</label>
                    <span className="font-bold mono text-sm" style={{ color: "var(--brand)" }}>{minScore}</span>
                  </div>
                  <input type="range" min={0} max={1000} step={50} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: "var(--brand)" }} />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    <span>Any</span><span>500 (avg)</span><span>750 (strong)</span><span>1000</span>
                  </div>
                </div>
                {(role === "investor" || role === "both") && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label" style={{ marginBottom: 0 }}>Minimum gross yield</label>
                      <span className="font-bold mono text-sm" style={{ color: "var(--brand)" }}>{minYield}%</span>
                    </div>
                    <input type="range" min={0} max={10} step={0.5} value={minYield} onChange={(e) => setMinYield(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: "var(--brand)" }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} className="btn-secondary gap-2">
                <ArrowLeft size={15} /> Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !role}
                className="btn-primary gap-2"
                style={{ opacity: step === 1 && !role ? 0.5 : 1 }}
              >
                Continue <ArrowRight size={15} />
              </button>
            ) : (
              <button onClick={finish} className="btn-primary gap-2">
                Open my map <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          All preferences can be changed anytime from Account → Preferences
        </p>
      </div>
    </div>
  );
}
