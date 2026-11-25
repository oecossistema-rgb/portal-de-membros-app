// Visão geral da Administração (25/11/2026): tela principal com gráficos em 3D. Só leitura; cada quadro leva à aba certa.
// Os números vêm de painel_graficos() (banco). A profundidade 3D é só visual: as alturas e larguras seguem os números exatos.
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Aba = "membros" | "eventos" | "presencas" | "conteudo" | "contratos" | "sistema";
type Dados = {
  funil: { ativos: number; com_senha: number; onboarding: number; acessaram_30d: number };
  perfis: { total: number; foto: number; logo: number; resumo: number; produtos: number };
  contratos: { aguardando_formulario: number; revisao: number; enviado: number; vigentes: number; vencidos: number };
  eventos: { titulo: string; data: string; vagas: number | null; confirmados: number }[];
  acessos: { dia: string; membros: number }[];
  acessos_desde: string | null;
};

const VERDE = "#1f9d55";
const escuro = (c: string, p: number) => `color-mix(in srgb, ${c} ${100 - p}%, black)`;
const claro = (c: string, p: number) => `color-mix(in srgb, ${c} ${100 - p}%, white)`;
const dataCurta = (s: string) => { const [, m, d] = s.split("-"); return `${d}/${m}`; };

// Cartão com profundidade (camadas de sombra + leve inclinação ao passar o mouse).
function Cartao3D({ titulo, sub, aba, onIr, children }: { titulo: string; sub?: string; aba?: Aba; onIr: (a: Aba) => void; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => aba && onIr(aba)}
      style={{ background: "linear-gradient(160deg, var(--p-card) 0%, color-mix(in srgb, var(--p-card) 92%, var(--p-accent)) 100%)",
        border: "1px solid var(--p-line)", borderRadius: 22, padding: "18px 18px 14px", cursor: aba ? "pointer" : "default", color: "var(--p-text)",
        boxShadow: hover ? "0 2px 0 var(--p-line), 0 14px 30px -12px rgba(0,0,0,.35), 0 30px 60px -30px rgba(0,0,0,.35)" : "0 1px 0 var(--p-line), 0 8px 18px -10px rgba(0,0,0,.25), 0 18px 40px -28px rgba(0,0,0,.3)",
        transform: hover ? "perspective(900px) rotateX(2deg) translateY(-2px)" : "perspective(900px) rotateX(0deg)", transition: "transform .25s, box-shadow .25s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{titulo}</div>
          {sub && <div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>{sub}</div>}
        </div>
        {aba && <span style={{ fontSize: 12.5, color: "var(--p-accent-text)", fontWeight: 600, whiteSpace: "nowrap" }}>Abrir →</span>}
      </div>
      {children}
    </div>
  );
}

function Indicador({ rotulo, valor, de, cor = "var(--p-accent)", onClick }: { rotulo: string; valor: number; de?: number; cor?: string; onClick?: () => void }) {
  const pct = de ? Math.round((valor / Math.max(de, 1)) * 100) : null;
  return (
    <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", borderRadius: 20, padding: "16px 18px", color: "#fff", position: "relative", overflow: "hidden",
      background: `linear-gradient(150deg, ${claro(cor, 10)} 0%, ${escuro(cor, 22)} 100%)`,
      boxShadow: `0 6px 0 ${escuro(cor, 45)}, 0 18px 30px -14px ${escuro(cor, 30)}`, transform: "translateY(-3px)" }}>
      <div style={{ position: "absolute", right: -30, top: -30, width: 110, height: 110, borderRadius: 99, background: "rgba(255,255,255,.12)" }} />
      <div style={{ fontSize: 13, opacity: 0.92, fontWeight: 600 }}>{rotulo}</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginTop: 4 }}>
        {valor}{de !== undefined && <span style={{ fontSize: 16, fontWeight: 600, opacity: 0.85 }}> de {de}</span>}
      </div>
      {pct !== null && <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>{pct}%</div>}
    </div>
  );
}

// Barras horizontais com profundidade (face da frente, de cima e da ponta). Em HTML para o texto ficar legível no celular.
function BarrasH({ itens, total, cor = "var(--p-accent)" }: { itens: { rotulo: string; valor: number }[]; total: number; cor?: string }) {
  const D = 7, max = Math.max(total, 1);
  return (
    <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
      {itens.map((it) => {
        const pct = Math.max((it.valor / max) * 100, it.valor ? 2 : 0);
        return (
          <div key={it.rotulo} title={`${it.rotulo}: ${it.valor} de ${total}`}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 + D }}>
              <span style={{ color: "var(--p-text2)" }}>{it.rotulo}</span>
              <b>{it.valor} <span style={{ color: "var(--p-muted)", fontWeight: 500 }}>({Math.round((it.valor / max) * 100)}%)</span></b>
            </div>
            <div style={{ position: "relative", height: 18, marginRight: D, background: "color-mix(in srgb, var(--p-line) 60%, transparent)", borderRadius: 3 }}>
              {pct > 0 && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%` }}>
                <div style={{ position: "absolute", inset: 0, background: cor }} />
                <div style={{ position: "absolute", left: D / 2, right: -D / 2, top: -D, height: D, background: claro(cor, 30), transform: "skewX(-45deg)", transformOrigin: "bottom" }} />
                <div style={{ position: "absolute", right: -D, top: -D / 2, bottom: D / 2, width: D, background: escuro(cor, 30), transform: "skewY(-45deg)", transformOrigin: "left" }} />
              </div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Rosca em 3D (camadas empilhadas dão a espessura); os ângulos seguem os números exatos.
function Rosca3D({ fatias }: { fatias: { rotulo: string; valor: number; cor: string }[] }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const cx = 110, cy = 82, rx = 96, ry = 56, ri = 0.55, PROF = 16;
  const pt = (a: number, k = 1, dy = 0) => `${cx + rx * k * Math.cos(a)},${cy + ry * k * Math.sin(a) + dy}`;
  const arco = (a0: number, a1: number, dy: number) => {
    const g = a1 - a0 > Math.PI ? 1 : 0;
    return `M${pt(a0, 1, dy)} A${rx},${ry} 0 ${g} 1 ${pt(a1, 1, dy)} L${pt(a1, ri, dy)} A${rx * ri},${ry * ri} 0 ${g} 0 ${pt(a0, ri, dy)} Z`;
  };
  let a = -Math.PI / 2;
  const fs = fatias.filter((f) => f.valor > 0).map((f) => {
    const a0 = a, a1 = a + (2 * Math.PI * f.valor) / total; a = a1;
    return { ...f, a0, a1: Math.min(a1, a0 + 2 * Math.PI - 0.0001) };
  });
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 220 180" width="220" style={{ maxWidth: "100%" }} role="img" aria-label="Contratos por situação">
        {total === 0 ? (
          <>
            <ellipse cx={cx} cy={cy + PROF} rx={rx} ry={ry} fill="var(--p-line)" />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--p-line2)" />
            <ellipse cx={cx} cy={cy} rx={rx * ri} ry={ry * ri} fill="var(--p-card)" />
          </>
        ) : <>
          {Array.from({ length: PROF }, (_, k) => PROF - k).map((dy) => fs.map((f) => <path key={`${f.rotulo}-${dy}`} d={arco(f.a0, f.a1, dy)} fill={escuro(f.cor, 35)} />))}
          {fs.map((f) => <path key={f.rotulo} d={arco(f.a0, f.a1, 0)} fill={f.cor} stroke="var(--p-card)" strokeWidth={1.5}><title>{`${f.rotulo}: ${f.valor}`}</title></path>)}
        </>}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--p-text)">{total}</text>
      </svg>
      <div style={{ display: "grid", gap: 6, fontSize: 13.5, flex: "1 1 150px" }}>
        {fatias.map((f) => (
          <div key={f.rotulo} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: f.cor, boxShadow: `0 3px 0 ${escuro(f.cor, 35)}`, flex: "none" }} />
            <span style={{ color: "var(--p-text2)", flex: 1 }}>{f.rotulo}</span><b>{f.valor}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// Colunas em 3D: confirmados por evento, com a capacidade (vagas) desenhada em contorno.
function Colunas3D({ itens }: { itens: { rotulo: string; sub: string; valor: number; cap: number | null }[] }) {
  const W = 560, H = 210, B = 168, D = 10, n = Math.max(itens.length, 1), slot = (W - 20) / n, bw = Math.min(46, slot * 0.5);
  const max = Math.max(...itens.map((i) => Math.max(i.valor, i.cap || 0)), 1);
  const h = (v: number) => (v / max) * (B - 30);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Confirmados por evento" style={{ display: "block", overflow: "visible" }}>
      <line x1={0} y1={B} x2={W} y2={B} stroke="var(--p-line2)" />
      {itens.map((it, i) => {
        const x = 10 + i * slot + (slot - bw) / 2, hv = h(it.valor), y = B - hv, hc = it.cap ? h(it.cap) : 0, cor = "var(--p-accent)";
        return (
          <g key={i}>
            <title>{`${it.rotulo} (${it.sub}): ${it.valor} confirmado(s)${it.cap ? ` de ${it.cap} vagas` : ""}`}</title>
            {hc > 0 && <rect x={x} y={B - hc} width={bw} height={hc} fill="none" stroke="var(--p-line2)" strokeDasharray="4 3" />}
            {hv > 0 && <>
              <polygon points={`${x},${y} ${x + D},${y - D} ${x + bw + D},${y - D} ${x + bw},${y}`} fill={claro(cor, 30)} />
              <polygon points={`${x + bw},${y} ${x + bw + D},${y - D} ${x + bw + D},${B - D} ${x + bw},${B}`} fill={escuro(cor, 30)} />
              <rect x={x} y={y} width={bw} height={hv} fill={cor} />
            </>}
            <text x={x + bw / 2} y={(hv > 0 ? y : B) - (hv > 0 ? D + 6 : 6)} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--p-text)">{it.valor}{it.cap ? `/${it.cap}` : ""}</text>
            <text x={x + bw / 2} y={B + 18} textAnchor="middle" fontSize={11.5} fill="var(--p-text2)">{it.rotulo.length > 14 ? `${it.rotulo.slice(0, 13)}…` : it.rotulo}</text>
            <text x={x + bw / 2} y={B + 33} textAnchor="middle" fontSize={11} fill="var(--p-muted)">{it.sub}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Acessos por dia (área), com relevo suave.
function Area({ pontos }: { pontos: { dia: string; membros: number }[] }) {
  const W = 560, H = 170, B = 140, max = Math.max(...pontos.map((p) => p.membros), 4), n = Math.max(pontos.length - 1, 1);
  const x = (i: number) => 8 + (i * (W - 16)) / n, y = (v: number) => B - (v / max) * (B - 16);
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.membros)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Membros que entraram no portal por dia" style={{ display: "block" }}>
      <defs>
        <linearGradient id="vgArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--p-accent)" stopOpacity={0.45} /><stop offset="1" stopColor="var(--p-accent)" stopOpacity={0.02} /></linearGradient>
      </defs>
      <line x1={0} y1={B} x2={W} y2={B} stroke="var(--p-line2)" />
      <path d={`${linha} L${x(pontos.length - 1)},${B} L${x(0)},${B} Z`} fill="url(#vgArea)" transform="translate(4,4)" opacity={0.35} />
      <path d={`${linha} L${x(pontos.length - 1)},${B} L${x(0)},${B} Z`} fill="url(#vgArea)" />
      <path d={linha} fill="none" stroke="var(--p-accent)" strokeWidth={2.5} />
      {pontos.map((p, i) => (
        <g key={p.dia}>
          <rect x={x(i) - 9} y={0} width={18} height={B} fill="transparent"><title>{`${dataCurta(p.dia)}: ${p.membros} membro(s)`}</title></rect>
          {((i % 7 === 0 && i <= pontos.length - 5) || i === pontos.length - 1) && <text x={x(i)} y={B + 18} textAnchor={i === pontos.length - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize={11} fill="var(--p-muted)">{dataCurta(p.dia)}</text>}
        </g>
      ))}
    </svg>
  );
}

export function VisaoGeralAdmin({ onIr }: { onIr: (a: Aba) => void }) {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    supabase.rpc("painel_graficos").then(({ data, error }) => { if (error) setErro(error.message); else setD(data as Dados); });
  }, []);
  if (erro) return <div style={ui.erro}>Não foi possível carregar a visão geral: {erro}</div>;
  if (!d) return <div style={ui.aviso}>Carregando visão geral...</div>;
  const f = d.funil, p = d.perfis, c = d.contratos;
  const totalAcessos = d.acessos.reduce((s, x) => s + x.membros, 0);

  return (
    <main style={ui.largo}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        <Indicador rotulo="Membros ativos" valor={f.ativos} onClick={() => onIr("membros")} />
        <Indicador rotulo="Criaram a senha do portal" valor={f.com_senha} de={f.ativos} cor="#257de0" onClick={() => onIr("membros")} />
        <Indicador rotulo="Entraram nos últimos 30 dias" valor={f.acessaram_30d} de={f.ativos} cor="#6a4ce2" onClick={() => onIr("membros")} />
        <Indicador rotulo="Contratos vigentes" valor={c.vigentes} cor={VERDE} onClick={() => onIr("contratos")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 16 }}>
        <Cartao3D titulo="Jornada dos membros" sub={`de ${f.ativos} membros ativos`} aba="membros" onIr={onIr}>
          <BarrasH total={f.ativos} itens={[
            { rotulo: "Onboarding respondido", valor: f.onboarding },
            { rotulo: "Criaram a senha", valor: f.com_senha },
            { rotulo: "Entraram em 30 dias", valor: f.acessaram_30d },
          ]} />
        </Cartao3D>
        <Cartao3D titulo="Contratos" sub="situação atual (sem os cancelados)" aba="contratos" onIr={onIr}>
          <Rosca3D fatias={[
            { rotulo: "Aguardando formulário", valor: c.aguardando_formulario, cor: "#257de0" },
            { rotulo: "Em revisão", valor: c.revisao, cor: "#f2a600" },
            { rotulo: "Aguardando assinaturas", valor: c.enviado, cor: "#f47230" },
            { rotulo: "Vigentes", valor: c.vigentes, cor: VERDE },
            { rotulo: "Vencidos", valor: c.vencidos, cor: "#ec4647" },
          ]} />
        </Cartao3D>
        <Cartao3D titulo="Próximos eventos" sub="confirmados / vagas (contorno = vagas)" aba="eventos" onIr={onIr}>
          {d.eventos.length ? <Colunas3D itens={d.eventos.map((e) => ({ rotulo: e.titulo, sub: dataCurta(e.data), valor: e.confirmados, cap: e.vagas }))} />
            : <div style={{ fontSize: 14, color: "var(--p-muted)" }}>Nenhum evento futuro cadastrado.</div>}
        </Cartao3D>
        <Cartao3D titulo="Perfis completos" sub={`de ${p.total} membros ativos`} aba="membros" onIr={onIr}>
          <BarrasH total={p.total} cor="#257de0" itens={[
            { rotulo: "Com produtos/serviços", valor: p.produtos },
            { rotulo: "Resumo publicado", valor: p.resumo },
            { rotulo: "Com foto", valor: p.foto },
            { rotulo: "Com logo", valor: p.logo },
          ]} />
        </Cartao3D>
        <Cartao3D titulo="Acessos ao portal" sub={`membros por dia, últimos 30 dias${d.acessos_desde ? ` · contando desde ${dataCurta(d.acessos_desde)}` : " · começa a contar a partir de hoje"}`} onIr={onIr}>
          <Area pontos={d.acessos} />
          <div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>{totalAcessos} acesso(s) no período (cada membro conta uma vez por dia).</div>
        </Cartao3D>
      </div>
    </main>
  );
}
