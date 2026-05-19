import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sun, Droplets, Zap, Gauge, Power, Activity, Leaf, CloudRain, ArrowDownUp, AlertTriangle,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/")({ component: Dashboard });

const TANK_CAPACITY = 5000; // litros
const TANK_MIN = 15; // %
const TANK_MAX = 90; // %

type Point = { t: string; solar: number; consumo: number; chuva: number };

function fmt(n: number, unit = "") {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unit}`;
}

function Dashboard() {
  const [now, setNow] = useState(new Date());
  const [series, setSeries] = useState<Point[]>(() => {
    const arr: Point[] = [];
    for (let i = 23; i >= 0; i--) {
      const h = (new Date().getHours() - i + 24) % 24;
      const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * (3.5 + Math.random());
      arr.push({
        t: `${String(h).padStart(2, "0")}h`,
        solar: +(sun).toFixed(2),
        consumo: +(1 + Math.random() * 2.5).toFixed(2),
        chuva: +(Math.random() < 0.25 ? Math.random() * 6 : 0).toFixed(1),
      });
    }
    return arr;
  });
  const [tankSup, setTankSup] = useState(72); // % reservatório superior (irrigação)
  const [tankInf, setTankInf] = useState(58); // % reservatório inferior (captação)
  const [pumpAuto, setPumpAuto] = useState(true);
  const [pumpOn, setPumpOn] = useState(false);
  const [solarKw, setSolarKw] = useState(3.2);
  const [consumoKw, setConsumoKw] = useState(1.4);
  const [batteryPct, setBatteryPct] = useState(82);
  const [events, setEvents] = useState<{ t: string; msg: string; kind: "info" | "warn" | "ok" }[]>([
    { t: "agora", msg: "Sistema iniciado", kind: "info" },
  ]);
  const [irrigOpen, setIrrigOpen] = useState(false);
  const [irrigLevel, setIrrigLevel] = useState(60);

  function handleManualTransfer() {
    const amount = Math.min(10, tankInf);
    setTankInf((v) => Math.max(0, v - amount));
    setTankSup((v) => Math.min(100, v + amount));
    pushEvent(`Transferência manual: ${amount.toFixed(1)}% movidos para o reservatório superior`, "info");
  }

  // Tick simulado (substituir por leitura do Arduino via API)
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * (3.5 + Math.random() * 0.6);
      const cons = 1 + Math.random() * 2.5;
      const rain = Math.random() < 0.08 ? Math.random() * 3 : 0;

      setSolarKw(+sun.toFixed(2));
      setConsumoKw(+cons.toFixed(2));
      setBatteryPct((p) => Math.max(10, Math.min(100, p + (sun - cons) * 0.4)));

      setTankInf((v) => Math.max(0, Math.min(100, v + rain * 1.2 - (pumpOn ? 0.8 : 0) - 0.05)));
      setTankSup((v) => Math.max(0, Math.min(100, v + (pumpOn ? 0.8 : 0) - 0.3)));

      setSeries((s) => {
        const next = [...s.slice(1), {
          t: `${String(new Date().getHours()).padStart(2, "0")}h`,
          solar: +sun.toFixed(2),
          consumo: +cons.toFixed(2),
          chuva: +rain.toFixed(1),
        }];
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [pumpOn]);

  // Controle automático da bomba
  useEffect(() => {
    if (!pumpAuto) return;
    if (tankSup < TANK_MIN && tankInf > 20 && !pumpOn) {
      setPumpOn(true);
      pushEvent("Bomba LIGADA — reservatório superior abaixo do mínimo", "warn");
    } else if ((tankSup >= TANK_MAX || tankInf <= 10) && pumpOn) {
      setPumpOn(false);
      pushEvent("Bomba DESLIGADA — nível máximo / fonte esgotada", "ok");
    }
  }, [tankSup, tankInf, pumpAuto, pumpOn]);

  function pushEvent(msg: string, kind: "info" | "warn" | "ok" = "info") {
    setEvents((e) => [{ t: new Date().toLocaleTimeString("pt-BR"), msg, kind }, ...e].slice(0, 8));
  }

  function toggleManual() {
    if (pumpAuto) return;
    setPumpOn((p) => {
      pushEvent(`Bomba ${!p ? "LIGADA" : "DESLIGADA"} manualmente`, "info");
      return !p;
    });
  }

  // KPIs derivados
  const energiaHoje = useMemo(
    () => series.reduce((s, p) => s + p.solar, 0), [series],
  );
  const consumoHoje = useMemo(
    () => series.reduce((s, p) => s + p.consumo, 0), [series],
  );
  const economiaR$ = energiaHoje * 0.95; // R$/kWh aproximado
  // Baseline de referência (sem o sistema): consumo médio diário típico
  const baselineEnergiaKwh = 24; // kWh/dia
  const baselineAguaL = 450; // L/dia (consumo médio residencial atribuível à irrigação/uso externo)
  const chuvaHoje = series.reduce((s, p) => s + p.chuva, 0);
  const aguaCaptadaL = chuvaHoje * 80; // 80 L por mm em 80m² de telhado
  const balanco = solarKw - consumoKw;

  const litrosSup = (tankSup / 100) * TANK_CAPACITY;
  const litrosInf = (tankInf / 100) * TANK_CAPACITY;
  const reducaoEnergiaPct = Math.min(95, Math.max(0, (energiaHoje / baselineEnergiaKwh) * 100));
  const reducaoAguaPct = Math.min(95, Math.max(0, (aguaCaptadaL / baselineAguaL) * 100));
  const reducaoMediaPct = (reducaoEnergiaPct + reducaoAguaPct) / 2;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-[1400px] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center ring-1 ring-primary/30">
              <Leaf className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Ecotech</h1>
              <p className="text-xs text-muted-foreground">
                Monitoramento de energia solar e reaproveitamento de água
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-primary animate-pulse" />
              Arduino conectado
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {now.toLocaleTimeString("pt-BR")}
              </div>
              <div className="text-xs text-muted-foreground">
                {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
        {/* Big Numbers */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <BigNumber
            icon={<Sun className="h-5 w-5" />}
            label="Geração solar agora"
            value={fmt(solarKw, " kW")}
            sub={`${fmt(energiaHoje, " kWh")} hoje`}
            tone="primary"
          />
          <BigNumber
            icon={<Zap className="h-5 w-5" />}
            label="Consumo atual"
            value={fmt(consumoKw, " kW")}
            sub={`${fmt(consumoHoje, " kWh")} hoje`}
            tone="accent"
          />
          <BigNumber
            icon={<Droplets className="h-5 w-5" />}
            label="Água captada (chuva)"
            value={fmt(aguaCaptadaL, " L")}
            sub={`${fmt(chuvaHoje, " mm")} de precipitação`}
            tone="info"
          />
          <BigNumber
            icon={<Leaf className="h-5 w-5" />}
            label="Redução nas contas (água e energia)"
            value={`-${fmt(reducaoMediaPct)}%`}
            sub={`Energia -${fmt(reducaoEnergiaPct)}% · Água -${fmt(reducaoAguaPct)}%`}
            tone="primary"
          />
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Geração vs Consumo (24h)</CardTitle>
              <Badge variant="secondary" className={balanco >= 0 ? "bg-primary/15 text-primary" : "bg-destructive/20 text-destructive"}>
                {balanco >= 0 ? "Superávit" : "Déficit"} {fmt(Math.abs(balanco), " kW")}
              </Badge>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCons" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} unit=" kW" />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="solar" name="Solar" stroke="var(--chart-1)" fill="url(#gSolar)" strokeWidth={2} />
                  <Area type="monotone" dataKey="consumo" name="Consumo" stroke="var(--chart-4)" fill="url(#gCons)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CloudRain className="h-4 w-4 text-accent" /> Precipitação (24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} unit=" mm" />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="chuva" name="Chuva" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Reservatórios + Bomba */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <TankCard
            title="Reservatório Superior"
            subtitle="Irrigação"
            level={tankSup}
            liters={litrosSup}
            capacity={TANK_CAPACITY}
            min={TANK_MIN}
            max={TANK_MAX}
          />
          <TankCard
            title="Reservatório Inferior"
            subtitle="Captação da chuva"
            level={tankInf}
            liters={litrosInf}
            capacity={TANK_CAPACITY}
            min={10}
            max={100}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4 text-primary" /> Controle da Bomba
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <div>
                  <div className="text-sm font-medium">Modo automático</div>
                  <div className="text-xs text-muted-foreground">
                    Liga em {TANK_MIN}% / desliga em {TANK_MAX}%
                  </div>
                </div>
                <Switch checked={pumpAuto} onCheckedChange={(v) => { setPumpAuto(v); pushEvent(`Modo ${v ? "automático" : "manual"} ativado`); }} />
              </div>

              <div className="rounded-lg border border-border p-4 flex flex-col items-center gap-3">
                <div className={`h-20 w-20 rounded-full grid place-items-center transition-all ${pumpOn ? "bg-primary/20 ring-2 ring-primary animate-pulse" : "bg-muted ring-1 ring-border"}`}>
                  <Power className={`h-9 w-9 ${pumpOn ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <Badge className={pumpOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>
                  {pumpOn ? "BOMBA ATIVA" : "BOMBA DESLIGADA"}
                </Badge>
                <Button
                  variant={pumpOn ? "destructive" : "default"}
                  disabled={pumpAuto}
                  onClick={toggleManual}
                  className="w-full"
                >
                  {pumpOn ? "Desligar manualmente" : "Ligar manualmente"}
                </Button>
                {pumpAuto && (
                  <p className="text-xs text-muted-foreground text-center">
                    Desative o modo automático para controlar manualmente.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Vazão" value="12 L/min" />
                <Stat label="Potência" value="0,37 kW" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Button variant="secondary" onClick={handleManualTransfer} className="w-full">
                  <ArrowDownUp className="h-4 w-4" /> Transferência manual
                </Button>
                <Button variant="outline" onClick={() => setIrrigOpen((v) => !v)} className="w-full">
                  <Droplets className="h-4 w-4" /> Ajuste de irrigação
                </Button>
              </div>

              {irrigOpen && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Intensidade de irrigação</span>
                    <span className="font-medium tabular-nums">{irrigLevel}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={irrigLevel}
                    onChange={(e) => setIrrigLevel(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      pushEvent(`Irrigação ajustada para ${irrigLevel}%`, "ok");
                      setIrrigOpen(false);
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Bateria + Eventos */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" /> Banco de baterias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div className="text-4xl font-semibold">{Math.round(batteryPct)}%</div>
                <div className="text-xs text-muted-foreground">
                  {balanco >= 0 ? "Carregando" : "Descarregando"}
                </div>
              </div>
              <Progress value={batteryPct} className="h-3" />
              <div className="grid grid-cols-3 text-center text-xs text-muted-foreground pt-2">
                <div><div className="text-foreground font-medium text-sm">48 V</div>Tensão</div>
                <div><div className="text-foreground font-medium text-sm">{fmt(Math.abs(balanco * 20.8))} A</div>Corrente</div>
                <div><div className="text-foreground font-medium text-sm">28 °C</div>Temp.</div>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-accent" /> Eventos do sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {events.map((e, i) => (
                  <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${
                        e.kind === "warn" ? "bg-destructive" : e.kind === "ok" ? "bg-primary" : "bg-accent"
                      }`} />
                      <span className="text-sm">{e.msg}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{e.t}</span>
                  </li>
                ))}
                {events.length === 0 && (
                  <li className="text-sm text-muted-foreground py-4">Nenhum evento registrado.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </section>

        <footer className="text-center text-xs text-muted-foreground py-6">
          Dados simulados — integre com seu Arduino via endpoint REST para leituras reais.
        </footer>
      </main>
    </div>
  );
}

function BigNumber({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  tone: "primary" | "accent" | "info";
}) {
  const toneCls =
    tone === "primary" ? "text-primary bg-primary/15 ring-primary/30"
    : tone === "accent" ? "text-accent bg-accent/15 ring-accent/30"
    : "text-accent bg-accent/10 ring-accent/20";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-3xl font-semibold mt-2 tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
          <div className={`h-10 w-10 rounded-xl grid place-items-center ring-1 ${toneCls}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TankCard({
  title, subtitle, level, liters, capacity, min, max,
}: {
  title: string; subtitle: string; level: number; liters: number; capacity: number; min: number; max: number;
}) {
  const status =
    level < min ? { label: "Crítico", cls: "bg-destructive/20 text-destructive" }
    : level > max ? { label: "Cheio", cls: "bg-accent/20 text-accent" }
    : { label: "Normal", cls: "bg-primary/15 text-primary" };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Badge className={status.cls}>{status.label}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5">
          {/* Tank visual */}
          <div className="relative h-44 w-24 rounded-b-2xl rounded-t-md border-2 border-border bg-secondary/40 overflow-hidden shrink-0">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-accent to-primary/70 transition-all duration-700"
              style={{ height: `${level}%` }}
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-white/20 animate-pulse" />
            </div>
            {/* Marcas */}
            <div className="absolute inset-0 flex flex-col justify-between py-2 px-1 text-[9px] text-muted-foreground">
              {[100, 75, 50, 25, 0].map((m) => (
                <div key={m} className="flex items-center gap-1">
                  <span className="h-px w-2 bg-border" />{m}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <div className="text-4xl font-semibold tabular-nums">{Math.round(level)}%</div>
              <div className="text-xs text-muted-foreground">
                {fmt(liters, " L")} / {fmt(capacity, " L")}
              </div>
            </div>
            <Progress value={level} className="h-2" />
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Mínimo: <span className="text-foreground">{min}%</span></div>
              <div>Máximo: <span className="text-foreground">{max}%</span></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-medium tabular-nums">{value}</div>
    </div>
  );
}
