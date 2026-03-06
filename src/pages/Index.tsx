import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, RotateCcw, TrendingUp, TrendingDown, Wallet } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bucket {
  id: string;
  label: string;
  percentage: number;
}

interface FormState {
  saldoInicial: string;
  ingresos: string;
  tarjetas: string;
  gastosFijos: string;
  gastosVariables: string;
}

const DEFAULT_FORM: FormState = {
  saldoInicial: "",
  ingresos: "",
  tarjetas: "",
  gastosFijos: "",
  gastosVariables: "",
};

const DEFAULT_BUCKETS: Bucket[] = [
  { id: "ahorro", label: "Ahorro / Inversión", percentage: 60 },
  { id: "liquido", label: "Fondo Líquido", percentage: 20 },
  { id: "disfrute", label: "Disfrute", percentage: 20 },
];

const LS_KEY = "presupuesto_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseARS(value: string): number {
  const clean = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatARSCompact(value: number): { text: string; suffix: string | null } {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const num = value / 1_000_000;
    return {
      text: new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(num),
      suffix: "MM",
    };
  }
  if (abs >= 1_000) {
    const num = value / 1_000;
    return {
      text: new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(num),
      suffix: "K",
    };
  }
  return {
    text: new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value),
    suffix: null,
  };
}

function formatARSInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(digits));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  negative,
  positive,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  negative?: boolean;
  positive?: boolean;
}) {
  const valueColor = negative
    ? "text-destructive"
    : positive
    ? "text-primary"
    : "text-foreground";

  const { text, suffix } = formatARSCompact(value);

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              negative ? "bg-red-50" : "bg-secondary"
            }`}
          >
            <Icon
              size={14}
              className={negative ? "text-destructive" : "text-accent"}
            />
          </span>
          <span className="text-sm text-muted-foreground font-medium">{label}</span>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>
          $ {text}{suffix ? ` ${suffix}` : ""}
          {suffix && <span className="text-xs font-normal text-muted-foreground align-super ml-0.5">*</span>}
        </p>
        {suffix && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            *Expresado en {suffix === "K" ? "miles" : "millones"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NumericInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\./g, "");
    const digits = raw.replace(/\D/g, "");
    onChange(formatARSInput(digits));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium select-none">
          $
        </span>
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          placeholder={placeholder ?? "0"}
          className="pl-7"
          aria-label={label}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PresupuestoMensual() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [buckets, setBuckets] = useState<Bucket[]>(DEFAULT_BUCKETS);
  const [modoCompleto, setModoCompleto] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setForm(parsed.form);
        if (parsed.buckets) setBuckets(parsed.buckets);
        if (typeof parsed.modoCompleto === "boolean")
          setModoCompleto(parsed.modoCompleto);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Save to localStorage
  const persist = useCallback(
    (f: FormState, b: Bucket[], mc: boolean) => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ form: f, buckets: b, modoCompleto: mc }));
      } catch {}
    },
    []
  );

  useEffect(() => {
    if (hydrated) persist(form, buckets, modoCompleto);
  }, [form, buckets, modoCompleto, hydrated, persist]);

  // ── Calculations ────────────────────────────────────────────────────────────
  const saldoInicial = parseARS(form.saldoInicial);
  const ingresos = parseARS(form.ingresos);
  const tarjetas = parseARS(form.tarjetas);
  const gastosFijos = parseARS(form.gastosFijos);
  const gastosVariables = parseARS(form.gastosVariables);

  const ingresoTotal = modoCompleto ? saldoInicial + ingresos : ingresos;
  const egresoTotal = modoCompleto
    ? tarjetas + gastosFijos + gastosVariables
    : gastosFijos + gastosVariables;
  const saldoFinal = ingresoTotal - egresoTotal;

  const totalPct = buckets.reduce((s, b) => s + b.percentage, 0);
  const bucketsValid = totalPct === 100;
  const saldoNegativo = saldoFinal < 0;

  // ── Handlers ────────────────────────────────────────────────────────────────
  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateBucketPct(id: string, newValue: number) {
    setBuckets((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const old = prev[idx].percentage;
      const diff = newValue - old;
      if (diff === 0) return prev;

      const updated = prev.map((b) => ({ ...b }));
      updated[idx].percentage = newValue;

      // Distribute the difference from bottom up (lowest priority first)
      let remaining = -diff;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (i === idx) continue;
        if (remaining === 0) break;
        const canAdjust = remaining > 0
          ? Math.min(remaining, 100 - updated[i].percentage)
          : Math.max(remaining, -updated[i].percentage);
        updated[i].percentage += canAdjust;
        remaining -= canAdjust;
      }

      return updated;
    });
  }

  function handleReset() {
    setForm(DEFAULT_FORM);
    setBuckets(DEFAULT_BUCKETS);
    setModoCompleto(false);
    setResetOpen(false);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  if (!hydrated) return null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen font-sans bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                {/* Logo finanzas */}
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 44 44"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Logo Mi Presupuesto Mensual"
                  role="img"
                  className="flex-shrink-0"
                >
                  <rect x="16" y="2" width="26" height="40" rx="6" fill="#3E6651" stroke="white" strokeWidth="1.2" />
                  <rect x="9" y="9" width="24" height="33" rx="6" fill="#4E7E65" stroke="white" strokeWidth="1.2" />
                  <rect x="2" y="16" width="22" height="26" rx="6" fill="#6CA487" stroke="white" strokeWidth="1.2" />
                  <rect x="2" y="26" width="14" height="16" rx="4" fill="#88B69E" stroke="white" strokeWidth="1.2" />
                </svg>
                <h1 className="text-2xl md:text-3xl font-bold text-primary text-balance leading-tight">
                  Mi Presupuesto Mensual
                </h1>
              </div>
              <p className="text-sm md:text-base text-muted-foreground mt-1 text-balance">
                Ingresos, egresos y distribución del saldo en segundos
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Modo toggle */}
              <div className="flex items-center gap-2 bg-card rounded-xl px-3 py-2 border border-border shadow-sm w-[168px]">
                <Switch
                  id="modo-switch"
                  checked={modoCompleto}
                  onCheckedChange={setModoCompleto}
                  aria-label="Alternar modo completo"
                  className="data-[state=checked]:bg-primary"
                />
                <Label
                  htmlFor="modo-switch"
                  className="text-sm font-medium text-foreground cursor-pointer whitespace-nowrap"
                >
                  {modoCompleto ? "Modo completo" : "Modo simple"}
                </Label>
              </div>

              {/* Reset */}
              <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:border-red-200"
                    aria-label="Resetear presupuesto"
                  >
                    <RotateCcw size={16} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      ¿Resetear presupuesto?
                    </DialogTitle>
                    <DialogDescription>
                      Todos los valores ingresados se borrarán y los buckets
                      volverán a sus valores por defecto. Esta acción no se
                      puede deshacer.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setResetOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleReset}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      Sí, resetear
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Inputs ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-primary">
                  Datos del mes
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Ingresos */}
                <section aria-label="Ingresos">
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
                    Ingresos
                  </p>
                  <div className="flex flex-col gap-4">
                    {modoCompleto && (
                      <NumericInput
                        id="saldo-inicial"
                        label="Saldo inicial"
                        value={form.saldoInicial}
                        onChange={(v) => updateField("saldoInicial", v)}
                        hint="Saldo que ya tenés en cuenta"
                      />
                    )}
                    <NumericInput
                      id="ingresos"
                      label="Ingresos del mes"
                      value={form.ingresos}
                      onChange={(v) => updateField("ingresos", v)}
                      hint="Sueldos, freelance, rentas, etc."
                    />
                  </div>
                </section>

                <Separator />

                {/* Egresos */}
                <section aria-label="Egresos">
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
                    Egresos
                  </p>
                  <div className="flex flex-col gap-4">
                    {modoCompleto && (
                      <NumericInput
                        id="tarjetas"
                        label="Tarjetas de crédito"
                        value={form.tarjetas}
                        onChange={(v) => updateField("tarjetas", v)}
                        hint="Resumen total del período"
                      />
                    )}
                    <NumericInput
                      id="gastos-fijos"
                      label="Gastos fijos"
                      value={form.gastosFijos}
                      onChange={(v) => updateField("gastosFijos", v)}
                      hint="Alquiler, servicios, suscripciones"
                    />
                    <NumericInput
                      id="gastos-variables"
                      label="Gastos variables estimados"
                      value={form.gastosVariables}
                      onChange={(v) => updateField("gastosVariables", v)}
                      hint="Supermercado, salidas, transporte"
                    />
                  </div>
                </section>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: KPIs + Buckets ─────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            {/* KPIs */}
            <section aria-label="Resumen financiero">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3">
                <KpiCard
                  label="Ingreso total"
                  value={ingresoTotal}
                  icon={TrendingUp}
                  positive={ingresoTotal > 0}
                />
                <KpiCard
                  label="Egreso total"
                  value={egresoTotal}
                  icon={TrendingDown}
                />
                <KpiCard
                  label="Saldo final"
                  value={saldoFinal}
                  icon={Wallet}
                  negative={saldoNegativo}
                  positive={!saldoNegativo && saldoFinal > 0}
                />
              </div>
            </section>

            {/* Negative balance alert */}
            {saldoNegativo && (
              <Alert className="border-red-200 bg-red-50" role="alert">
                <AlertTriangle size={16} className="text-destructive" />
                <AlertDescription className="text-red-600 text-sm">
                  Tu saldo final es negativo. Revisá tus egresos antes de
                  continuar.
                </AlertDescription>
              </Alert>
            )}

            {/* Buckets */}
            {!saldoNegativo && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-primary">
                    Distribución del saldo
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Ajustá los porcentajes. Deben sumar 100%.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {/* Disclaimer distribución desbalanceada */}
                  {(() => {
                    const disfrute = buckets.find(b => b.id === "disfrute")?.percentage ?? 0;
                    const ahorro = buckets.find(b => b.id === "ahorro")?.percentage ?? 0;
                    if (disfrute > ahorro) {
                      return (
                        <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
                          <p className="text-xs text-red-500">
                            ⚠ La proporción de Disfrute es muy alta respecto a Ahorro/Inversión o Fondo Líquido. Considerá redistribuir.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Bucket rows */}
                  <div className="flex flex-col gap-3">
                    {buckets.map((bucket) => {
                      const amount = bucketsValid
                        ? (saldoFinal * bucket.percentage) / 100
                        : null;

                      return (
                        <div key={bucket.id} className="group">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="flex-1 text-sm font-medium text-foreground px-2">
                              {bucket.label}
                            </span>
                            <Select
                              value={String(bucket.percentage)}
                              onValueChange={(v) =>
                                updateBucketPct(bucket.id, Number(v))
                              }
                            >
                              <SelectTrigger className="w-20 h-8 text-sm font-semibold text-primary bg-secondary text-center">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {Array.from({ length: 21 }, (_, i) => i * 5).map((v) => (
                                  <SelectItem key={v} value={String(v)}>
                                    {v}%
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Slider & amount */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={bucket.percentage}
                                onChange={(e) =>
                                  updateBucketPct(bucket.id, Number(e.target.value))
                                }
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-secondary accent-accent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0"
                                aria-label={`${bucket.label}: ${bucket.percentage}%`}
                              />
                            </div>
                            {amount !== null ? (
                              <span className="text-xs font-semibold text-primary w-28 text-right flex-shrink-0">
                                $ {formatARS(amount)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground w-28 text-right flex-shrink-0">
                                —
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total badge */}
                  <div
                    className={`flex items-center justify-between rounded-lg px-3 py-2 mt-1 ${
                      bucketsValid
                        ? "bg-secondary border border-border"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Total
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        bucketsValid ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {totalPct}%
                    </span>
                  </div>

                  {!bucketsValid && (
                    <p className="text-sm text-destructive font-medium mt-2">
                      ⚠ La distribución no suma 100%. Ajustá los porcentajes para continuar.
                    </p>
                  )}

                  {/* Grand total */}
                  {bucketsValid && saldoFinal > 0 && (
                    <div className="rounded-xl border border-border bg-background px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Saldo a distribuir
                      </p>
                      <p className="text-xl font-bold text-primary">
                        $ {formatARS(saldoFinal)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center">
          <p className="text-xs text-muted-foreground">
            Los datos se guardan automáticamente en tu navegador.
          </p>
        </footer>
      </div>
    </main>
  );
}
