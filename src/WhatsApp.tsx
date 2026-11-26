// Administração › WhatsApp: disparo em massa para membros e conversas com o membro, pelo número da Z-API do portal.
// Envio de verdade só acontece quando alguém clica em "Disparar" (ou no horário agendado). Só administradores veem.
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Publico = { tipo: "todos" | "segmento" | "nao_acessou" | "evento" | "contrato_vencendo" | "lista"; valor?: string; ids?: string[] };
type MembroMin = { id: string; nome: string; empresa: string | null; foto_url?: string | null; segmento?: string | null };
type Disparo = { id: string; titulo: string; texto: string; status: string; criado_em: string; agendado_para: string | null; iniciado_em: string | null; concluido_em: string | null; midia_tipo: string | null; publico: Publico };
type Envio = { id: string; disparo_id: string; membro_id: string; status: string; motivo: string | null; enviado_em: string | null };
type Modelo = { id: string; nome: string; texto: string; midia_url: string | null; midia_tipo: string | null };
type Msg = { id: string; membro_id: string; direcao: "entrada" | "saida"; texto: string | null; midia_url: string | null; midia_tipo: string | null; status: string | null; origem: string; momento: string; lida: boolean };

async function chamar(corpo: Record<string, unknown>): Promise<{ ok?: boolean; erro?: string; [k: string]: unknown }> {
  const { data, error } = await supabase.functions.invoke("whatsapp", { body: corpo });
  if (error) {
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return { erro: j.erro }; } catch { /* */ }
    return { erro: "Não foi possível falar com o servidor." };
  }
  return data;
}
const primeiro = (n: string) => { const p = (n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
const personalizar = (t: string, m?: MembroMin) => !m ? t : t.replaceAll("{primeiro_nome}", primeiro(m.nome)).replaceAll("{nome}", m.nome).replaceAll("{empresa}", m.empresa || "");
const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
// Prévia com a formatação do WhatsApp (*negrito*, _itálico_, ~riscado~).
function Formatado({ t }: { t: string }) {
  const partes = t.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return <>{partes.map((p, i) => /^\*.+\*$/.test(p) ? <b key={i}>{p.slice(1, -1)}</b> : /^_.+_$/.test(p) ? <i key={i}>{p.slice(1, -1)}</i> : /^~.+~$/.test(p) ? <s key={i}>{p.slice(1, -1)}</s> : p)}</>;
}
const iniciais = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

const ROTULO: Record<string, { t: string; cor: string }> = {
  agendado: { t: "Agendado", cor: "#7A6AD8" }, enviando: { t: "Enviando", cor: "#1F8F4E" }, pausado: { t: "Parado", cor: "#D98A1F" },
  concluido: { t: "Concluído", cor: "var(--p-muted)" }, cancelado: { t: "Cancelado", cor: "var(--p-danger)" },
};
const ENVIO: Record<string, string> = { pendente: "Na fila", enviado: "Enviado", entregue: "Entregue", lido: "Lido", falha: "Falha", pulado: "Pulado" };

const CSS = `
.wa{ text-align:left; display:flex; flex-direction:column; gap:16px }
.wa-sub{ display:flex; gap:8px }
.wa-grid{ display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr); gap:16px; align-items:start }
.wa-campo{ display:flex; flex-direction:column; gap:6px; margin-bottom:14px }
.wa-chips{ display:flex; gap:6px; flex-wrap:wrap }
.wa-chip{ border:1px solid var(--p-line2); background:var(--p-card); color:var(--p-text); border-radius:980px; padding:6px 12px; font:inherit; font-size:13px; font-weight:600; cursor:pointer }
.wa-chip.on{ background:var(--p-accent); color:var(--p-on-accent); border-color:transparent }
.wa-tel{ background:#0b141a; border-radius:18px; padding:16px; min-height:180px; background-image:radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px); background-size:14px 14px }
.wa-bolha{ max-width:88%; background:#005c4b; color:#e9edef; border-radius:10px 0 10px 10px; padding:8px 10px 6px; margin-left:auto; font-size:14.5px; line-height:1.4; white-space:pre-wrap; word-break:break-word; box-shadow:0 1px 1px rgba(0,0,0,.3) }
.wa-bolha.in{ background:#202c33; border-radius:0 10px 10px 10px; margin-left:0; margin-right:auto }
.wa-bolha img{ display:block; max-width:100%; border-radius:6px; margin-bottom:6px }
.wa-bolha small{ display:block; text-align:right; font-size:11px; color:rgba(233,237,239,.6); margin-top:2px }
.wa-barra{ height:8px; border-radius:99px; background:var(--p-hover); overflow:hidden }
.wa-barra i{ display:block; height:100%; background:var(--p-accent) }
.wa-lista{ max-height:240px; overflow:auto; border:1px solid var(--p-line); border-radius:12px; padding:6px 10px; font-size:13px }
.wa-lista div{ padding:4px 0; border-bottom:1px solid var(--p-line) }
.wa-lista div:last-child{ border-bottom:0 }
.wa-chat{ display:grid; grid-template-columns:300px minmax(0,1fr); height:min(72vh,720px); border:1px solid var(--p-line); border-radius:20px; overflow:hidden; background:var(--p-card) }
.wa-pessoas{ border-right:1px solid var(--p-line); overflow:auto }
.wa-pessoa{ display:flex; gap:10px; align-items:center; padding:10px 12px; width:100%; border:0; border-bottom:1px solid var(--p-line); background:none; color:var(--p-text); text-align:left; cursor:pointer; font:inherit }
.wa-pessoa.on{ background:var(--p-hover) }
.wa-av{ width:40px; height:40px; border-radius:50%; flex:none; object-fit:cover; background:var(--p-accent-bg); color:var(--p-accent-text); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px }
.wa-pessoa div{ min-width:0; flex:1 } .wa-pessoa strong{ display:block; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.wa-pessoa div span{ display:block; font-size:12.5px; color:var(--p-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.wa-nlida{ background:#25D366; color:#fff; border-radius:99px; font-size:11px; font-weight:800; padding:1px 7px }
.wa-conversa{ display:flex; flex-direction:column; min-width:0 }
.wa-topo{ padding:12px 16px; border-bottom:1px solid var(--p-line); display:flex; gap:10px; align-items:center }
.wa-msgs{ flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column; gap:6px; background:#0b141a; background-image:radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px); background-size:14px 14px }
.wa-envio{ display:flex; gap:8px; padding:10px; border-top:1px solid var(--p-line) }
@media (max-width:900px){ .wa-grid{ grid-template-columns:1fr } .wa-chat{ grid-template-columns:1fr; height:auto } .wa-pessoas{ max-height:260px; border-right:0; border-bottom:1px solid var(--p-line) } .wa-msgs{ min-height:360px } }
`;

export function AdminWhatsApp() {
  const [sub, setSub] = useState<"disparos" | "conversas">("disparos");
  return (
    <div className="wa">
      <style>{CSS}</style>
      <div className="wa-sub">
        <button className={`wa-chip${sub === "disparos" ? " on" : ""}`} onClick={() => setSub("disparos")}>Disparos</button>
        <button className={`wa-chip${sub === "conversas" ? " on" : ""}`} onClick={() => setSub("conversas")}>Conversas</button>
      </div>
      {sub === "disparos" ? <Disparos /> : <Conversas />}
    </div>
  );
}

// ---------------- Disparos ----------------
function Disparos() {
  const [membros, setMembros] = useState<MembroMin[]>([]);
  const [eventos, setEventos] = useState<{ id: string; titulo: string; quando: string }[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [disparos, setDisparos] = useState<Disparo[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [publico, setPublico] = useState<Publico>({ tipo: "todos" });
  const [prev, setPrev] = useState<{ total: number; recebem: MembroMin[]; fora: { nome: string; motivo: string }[] } | null>(null);
  const [verLista, setVerLista] = useState(false);
  const [busca, setBusca] = useState("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [midia, setMidia] = useState<{ url: string; tipo: "imagem" | "documento"; nome: string } | null>(null);
  const [agendar, setAgendar] = useState(false);
  const [quando, setQuando] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);

  async function carregar() {
    const [{ data: d }, { data: e }] = await Promise.all([
      supabase.from("wa_disparos").select("*").order("criado_em", { ascending: false }).limit(30),
      supabase.from("wa_envios").select("id,disparo_id,membro_id,status,motivo,enviado_em"),
    ]);
    setDisparos((d as Disparo[]) || []); setEnvios((e as Envio[]) || []);
  }
  useEffect(() => {
    supabase.from("membros").select("id,nome,empresa,foto_url,segmento").eq("ativo", true).eq("equipe", false).order("nome").then(({ data }) => setMembros((data as MembroMin[]) || []));
    supabase.from("eventos").select("id,titulo,quando").eq("ativo", true).order("data_inicio").then(({ data }) => setEventos(data || []));
    supabase.from("wa_modelos").select("*").order("nome").then(({ data }) => setModelos((data as Modelo[]) || []));
    carregar();
  }, []);
  const ativo = disparos.some((d) => d.status === "enviando" || d.status === "agendado");
  useEffect(() => { if (!ativo) return; const t = window.setInterval(carregar, 10000); return () => window.clearInterval(t); }, [ativo]);

  // Quem recebe: recalcula quando o público muda.
  useEffect(() => {
    let vivo = true;
    setPrev(null);
    if (publico.tipo === "segmento" && !publico.valor) return;
    if (publico.tipo === "evento" && !publico.valor) return;
    if (publico.tipo === "lista" && !(publico.ids || []).length) { setPrev({ total: 0, recebem: [], fora: [] }); return; }
    const t = window.setTimeout(async () => {
      const r = await chamar({ acao: "publico", publico });
      if (vivo && !r.erro) setPrev(r as unknown as { total: number; recebem: MembroMin[]; fora: { nome: string; motivo: string }[] });
    }, 350);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [publico]);

  const segmentos = useMemo(() => [...new Set(membros.map((m) => (m.segmento || "").split(/[,;·]/)[0].trim()).filter(Boolean))].sort(), [membros]);
  const exemplo = prev?.recebem?.[0] || membros[0];
  const inserir = (v: string) => {
    const el = caixa.current; if (!el) { setTexto(texto + v); return; }
    const a = el.selectionStart, b = el.selectionEnd; const novo = texto.slice(0, a) + v + texto.slice(b);
    setTexto(novo); requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + v.length; });
  };

  async function enviarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0]; e.target.value = "";
    if (!arq) return;
    const doc = arq.type === "application/pdf";
    if (!doc && !/^image\/(jpeg|png|webp)$/.test(arq.type)) { setMsg({ tipo: "erro", texto: "Use imagem (JPG, PNG, WEBP) ou PDF." }); return; }
    if (arq.size > 15 * 1024 * 1024) { setMsg({ tipo: "erro", texto: "Arquivo grande demais (máx. 15 MB)." }); return; }
    setOcupado("arquivo");
    const nome = arq.name.normalize("NFD").replace(/[^\w.-]+/g, "-");
    const caminho = `whatsapp/${Date.now()}-${nome}`;
    const { error } = await supabase.storage.from("portal-midia").upload(caminho, arq, { contentType: arq.type });
    setOcupado("");
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível enviar o arquivo." }); return; }
    setMidia({ url: supabase.storage.from("portal-midia").getPublicUrl(caminho).data.publicUrl, tipo: doc ? "documento" : "imagem", nome: arq.name });
  }

  const corpo = () => ({ titulo: titulo.trim() || texto.trim().slice(0, 60), texto, publico, midia_url: midia?.url, midia_tipo: midia?.tipo, midia_nome: midia?.nome,
    agendado_para: agendar && quando ? new Date(quando).toISOString() : undefined });
  async function teste() {
    setOcupado("teste"); setMsg(null);
    const r = await chamar({ acao: "teste", ...corpo() });
    setOcupado("");
    setMsg(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: "Teste enviado para o seu WhatsApp." });
  }
  async function disparar() {
    setOcupado("disparar"); setMsg(null); setConfirmar(false);
    const r = await chamar({ acao: "disparar", ...corpo() });
    setOcupado("");
    if (r.erro) { setMsg({ tipo: "erro", texto: r.erro }); return; }
    setMsg({ tipo: "ok", texto: r.agendado ? `Disparo agendado para ${r.total} membros.` : `Disparo iniciado para ${r.total} membros. Um por vez, com intervalo de segurança.` });
    setTexto(""); setTitulo(""); setMidia(null); setAgendar(false); setQuando("");
    carregar();
  }
  async function controlar(id: string, acao: string) {
    const r = await chamar({ acao, id });
    if (r.erro) setMsg({ tipo: "erro", texto: r.erro });
    carregar();
  }
  async function salvarModelo() {
    const nome = window.prompt("Nome do modelo (ex.: Lembrete de evento)");
    if (!nome?.trim()) return;
    const { data, error } = await supabase.from("wa_modelos").insert({ nome: nome.trim().slice(0, 60), texto, midia_url: midia?.url || null, midia_tipo: midia?.tipo || null }).select("*").single();
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível salvar o modelo." }); return; }
    setModelos([...modelos, data as Modelo].sort((a, b) => a.nome.localeCompare(b.nome)));
    setMsg({ tipo: "ok", texto: "Modelo salvo." });
  }

  const marcados = new Set(publico.ids || []);
  const filtrados = membros.filter((m) => !busca.trim() || `${m.nome} ${m.empresa || ""}`.toLowerCase().includes(busca.toLowerCase()));
  const pode = (texto.trim() || midia) && (prev?.total || 0) > 0 && (!agendar || quando);

  return (
    <>
      <div className="wa-grid">
        <div style={{ ...ui.cartao, marginBottom: 0 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 19 }}>Novo disparo</h3>
          <div className="wa-campo">
            <label style={ui.label}>Para quem</label>
            <div className="wa-chips">
              {([["todos", "Todos os membros"], ["segmento", "Por segmento"], ["nao_acessou", "Ainda não entraram no portal"], ["evento", "Confirmados num evento"], ["contrato_vencendo", "Contrato vencendo"], ["lista", "Escolher membros"]] as [Publico["tipo"], string][]).map(([t, r]) => (
                <button key={t} className={`wa-chip${publico.tipo === t ? " on" : ""}`} onClick={() => setPublico({ tipo: t })}>{r}</button>
              ))}
            </div>
            {publico.tipo === "segmento" && (
              <select style={ui.input} value={publico.valor || ""} onChange={(e) => setPublico({ tipo: "segmento", valor: e.target.value })}>
                <option value="">Escolha o segmento…</option>
                {segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {publico.tipo === "evento" && (
              <select style={ui.input} value={publico.valor || ""} onChange={(e) => setPublico({ tipo: "evento", valor: e.target.value })}>
                <option value="">Escolha o evento…</option>
                {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.titulo} · {ev.quando}</option>)}
              </select>
            )}
            {publico.tipo === "lista" && (
              <>
                <input style={ui.input} placeholder="Buscar membro" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <div className="wa-lista">
                  {filtrados.map((m) => (
                    <div key={m.id}><label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={marcados.has(m.id)} onChange={() => { const s = new Set(marcados); if (s.has(m.id)) s.delete(m.id); else s.add(m.id); setPublico({ tipo: "lista", ids: [...s] }); }} />
                      {m.nome}{m.empresa ? <span style={{ color: "var(--p-muted)" }}> · {m.empresa}</span> : null}
                    </label></div>
                  ))}
                </div>
              </>
            )}
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {prev ? <>Vão receber: <span style={{ color: "var(--p-accent-text)" }}>{prev.total} {prev.total === 1 ? "membro" : "membros"}</span>
                {prev.fora.length > 0 && <span style={{ color: "var(--p-muted)", fontWeight: 500 }}> · {prev.fora.length} de fora</span>}
                {" "}<button style={{ ...ui.botaoSecundario, padding: "3px 10px", fontSize: 12 }} onClick={() => setVerLista(!verLista)}>{verLista ? "Esconder" : "Ver quem"}</button></>
                : <span style={{ color: "var(--p-muted)", fontWeight: 500 }}>Calculando…</span>}
            </div>
            {verLista && prev && (
              <div className="wa-lista">
                {prev.recebem.map((m) => <div key={m.id}>✅ {m.nome}{m.empresa ? ` · ${m.empresa}` : ""}</div>)}
                {prev.fora.map((m, i) => <div key={i} style={{ color: "var(--p-muted)" }}>⛔ {m.nome} · {m.motivo}</div>)}
              </div>
            )}
          </div>

          <div className="wa-campo">
            <label style={ui.label}>Título (só para vocês)</label>
            <input style={ui.input} value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Lembrete Growth Session dezembro" />
          </div>
          <div className="wa-campo">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...ui.label, marginBottom: 0 }}>Mensagem</label>
              {modelos.length > 0 && (
                <select style={{ ...ui.input, width: "auto", padding: "6px 10px", fontSize: 13 }} value="" onChange={(e) => { const m = modelos.find((x) => x.id === e.target.value); if (m) { setTexto(m.texto); setMidia(m.midia_url ? { url: m.midia_url, tipo: (m.midia_tipo as "imagem" | "documento") || "imagem", nome: m.midia_url.split("/").pop() || "arquivo" } : null); } }}>
                  <option value="">Usar um modelo…</option>
                  {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              )}
            </div>
            <textarea ref={caixa} style={{ ...ui.input, minHeight: 150, resize: "vertical" }} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={"Olá, {primeiro_nome}! Tudo bem?\n\nPassando para lembrar..."} />
            <div className="wa-chips">
              <span style={{ fontSize: 12.5, color: "var(--p-muted)", alignSelf: "center" }}>Inserir:</span>
              {[["{primeiro_nome}", "Primeiro nome"], ["{nome}", "Nome completo"], ["{empresa}", "Empresa"]].map(([v, r]) => <button key={v} className="wa-chip" onClick={() => inserir(v)}>{r}</button>)}
              <span style={{ fontSize: 12.5, color: "var(--p-muted)", alignSelf: "center" }}>Negrito: *texto* · Itálico: _texto_</span>
            </div>
          </div>
          <div className="wa-campo">
            <label style={ui.label}>Anexo (opcional)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ ...ui.botaoSecundario, display: "inline-block" }}>{ocupado === "arquivo" ? "Enviando…" : midia ? "Trocar anexo" : "Imagem ou PDF"}
                <input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={enviarArquivo} /></label>
              {midia && <><span style={{ fontSize: 13 }}>{midia.tipo === "imagem" ? "🖼️" : "📄"} {midia.nome}</span><button style={ui.botaoSecundario} onClick={() => setMidia(null)}>Remover</button></>}
            </div>
          </div>
          <div className="wa-campo">
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={agendar} onChange={(e) => setAgendar(e.target.checked)} /> Agendar para depois
            </label>
            {agendar && <input type="datetime-local" style={ui.input} value={quando} onChange={(e) => setQuando(e.target.value)} />}
          </div>
          {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={ui.botaoSecundario} disabled={!(texto.trim() || midia) || !!ocupado} onClick={teste}>{ocupado === "teste" ? "Enviando…" : "Enviar teste para mim"}</button>
            {texto.trim() && <button style={ui.botaoSecundario} onClick={salvarModelo}>Salvar como modelo</button>}
            {!confirmar
              ? <button style={{ ...ui.botao, opacity: pode ? 1 : 0.5 }} disabled={!pode || !!ocupado} onClick={() => setConfirmar(true)}>{agendar ? "Agendar disparo" : `Disparar para ${prev?.total || 0}`}</button>
              : <><button style={ui.botao} onClick={disparar}>{ocupado === "disparar" ? "Criando…" : `Confirmar: ${prev?.total} membros`}</button><button style={ui.botaoSecundario} onClick={() => setConfirmar(false)}>Voltar</button></>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--p-muted)", marginTop: 10 }}>Segurança: sai um por vez, com 20 a 60 segundos entre cada mensagem, até 300 por dia. Quem responder SAIR não recebe mais disparos.</div>
        </div>

        <div style={{ ...ui.cartao, marginBottom: 0, position: "sticky", top: 80 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>Prévia</h3>
          <div style={{ fontSize: 13, color: "var(--p-muted)", marginBottom: 10 }}>Como chega para {exemplo ? primeiro(exemplo.nome) : "o membro"}</div>
          <div className="wa-tel">
            {(texto.trim() || midia) ? (
              <div className="wa-bolha">
                {midia?.tipo === "imagem" && <img src={midia.url} alt="" />}
                {midia?.tipo === "documento" && <div style={{ background: "rgba(0,0,0,.25)", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>📄 {midia.nome}</div>}
                <Formatado t={personalizar(texto, exemplo)} />
                <small>{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ✓✓</small>
              </div>
            ) : <div style={{ color: "rgba(233,237,239,.5)", fontSize: 14, textAlign: "center", paddingTop: 60 }}>Escreva a mensagem para ver a prévia</div>}
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ margin: "8px 0 10px", fontSize: 19 }}>Disparos</h3>
        {disparos.length === 0 && <div style={ui.aviso}>Nenhum disparo ainda.</div>}
        {disparos.map((d) => {
          const es = envios.filter((e) => e.disparo_id === d.id);
          const n = (s: string[]) => es.filter((e) => s.includes(e.status)).length;
          const feitos = n(["enviado", "entregue", "lido", "falha", "pulado"]);
          const pct = es.length ? Math.round((feitos / es.length) * 100) : 0;
          const r = ROTULO[d.status] || { t: d.status, cor: "var(--p-muted)" };
          return (
            <div key={d.id} style={{ ...ui.cartao, padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{d.titulo}</div>
                  <div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>{d.status === "agendado" && d.agendado_para ? `Agendado para ${hora(d.agendado_para)}` : `Criado em ${hora(d.criado_em)}`}{d.midia_tipo ? ` · com ${d.midia_tipo}` : ""}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: r.cor, borderRadius: 99, padding: "3px 10px" }}>{r.t}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {d.status === "enviando" && <button style={ui.botaoPerigo} onClick={() => controlar(d.id, "parar")}>Parar</button>}
                  {d.status === "pausado" && <button style={ui.botaoSecundario} onClick={() => controlar(d.id, "retomar")}>Retomar</button>}
                  {["agendado", "pausado"].includes(d.status) && <button style={ui.botaoPerigo} onClick={() => controlar(d.id, "cancelar")}>Cancelar</button>}
                  <button style={ui.botaoSecundario} onClick={() => setAberto(aberto === d.id ? null : d.id)}>{aberto === d.id ? "Fechar" : "Relatório"}</button>
                </div>
              </div>
              <div className="wa-barra" style={{ margin: "10px 0 6px" }}><i style={{ width: `${pct}%` }} /></div>
              <div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>
                {feitos} de {es.length} · ✓ {n(["enviado", "entregue", "lido"])} enviadas · ✓✓ {n(["entregue", "lido"])} entregues · 👁 {n(["lido"])} lidas{n(["falha"]) ? ` · ⚠️ ${n(["falha"])} falhas` : ""}{n(["pulado"]) ? ` · ${n(["pulado"])} puladas` : ""}
              </div>
              {aberto === d.id && (
                <div className="wa-lista" style={{ marginTop: 10 }}>
                  {es.map((e) => {
                    const m = membros.find((x) => x.id === e.membro_id);
                    return <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>{m?.nome || "Membro"}</span>
                      <span style={{ color: e.status === "falha" ? "var(--p-danger)" : "var(--p-muted)" }}>{ENVIO[e.status]}{e.motivo ? ` · ${e.motivo}` : ""}{e.enviado_em ? ` · ${hora(e.enviado_em)}` : ""}</span>
                    </div>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Conversas ----------------
function Conversas() {
  const [membros, setMembros] = useState<MembroMin[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  async function carregar() {
    const { data } = await supabase.from("wa_mensagens").select("*").order("momento", { ascending: true }).limit(3000);
    setMsgs((data as Msg[]) || []);
  }
  useEffect(() => {
    supabase.from("membros").select("id,nome,empresa,foto_url").eq("ativo", true).eq("equipe", false).order("nome").then(({ data }) => setMembros((data as MembroMin[]) || []));
    carregar();
    const canal = supabase.channel("wa-mensagens").on("postgres_changes", { event: "*", schema: "public", table: "wa_mensagens" }, () => carregar()).subscribe();
    const t = window.setInterval(carregar, 20000);
    return () => { supabase.removeChannel(canal); window.clearInterval(t); };
  }, []);

  const resumo = useMemo(() => {
    const r = new Map<string, { ultima: Msg; naoLidas: number }>();
    for (const m of msgs) {
      const x = r.get(m.membro_id) || { ultima: m, naoLidas: 0 };
      x.ultima = m; if (m.direcao === "entrada" && !m.lida) x.naoLidas++;
      r.set(m.membro_id, x);
    }
    return r;
  }, [msgs]);
  const lista = membros
    .filter((m) => !busca.trim() || `${m.nome} ${m.empresa || ""}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (resumo.get(b.id)?.ultima.momento || "").localeCompare(resumo.get(a.id)?.ultima.momento || ""));
  const atual = membros.find((m) => m.id === sel) || null;
  const conversa = msgs.filter((m) => m.membro_id === sel);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
    const naoLidas = conversa.filter((m) => m.direcao === "entrada" && !m.lida).map((m) => m.id);
    if (naoLidas.length) supabase.from("wa_mensagens").update({ lida: true }).in("id", naoLidas).then(() => {});
  }, [sel, conversa.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar() {
    if (!sel || !texto.trim()) return;
    setEnviando(true); setErro("");
    const r = await chamar({ acao: "responder", membro_id: sel, texto });
    setEnviando(false);
    if (r.erro) { setErro(r.erro); return; }
    setTexto(""); carregar();
  }

  const Av = ({ m }: { m: MembroMin }) => m.foto_url ? <img className="wa-av" src={m.foto_url} alt="" /> : <span className="wa-av">{iniciais(m.nome)}</span>;
  return (
    <>
      {msgs.length === 0 && <div style={{ ...ui.aviso, textAlign: "left", padding: 16, fontSize: 14 }}>As mensagens que os membros mandarem para o WhatsApp do Ecossistema aparecem aqui. Você responde por aqui e a resposta sai pelo mesmo número.</div>}
      <div className="wa-chat">
        <div className="wa-pessoas">
          <div style={{ padding: 10, borderBottom: "1px solid var(--p-line)" }}><input style={ui.input} placeholder="Buscar membro" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          {lista.map((m) => {
            const r = resumo.get(m.id);
            return (
              <button key={m.id} className={`wa-pessoa${sel === m.id ? " on" : ""}`} onClick={() => setSel(m.id)}>
                <Av m={m} />
                <div><strong>{m.nome}</strong><span>{r ? `${r.ultima.direcao === "saida" ? "Você: " : ""}${r.ultima.texto || (r.ultima.midia_tipo ? `[${r.ultima.midia_tipo}]` : "")}` : m.empresa || ""}</span></div>
                {r?.naoLidas ? <span className="wa-nlida">{r.naoLidas}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="wa-conversa">
          {!atual ? <div style={{ margin: "auto", color: "var(--p-muted)", padding: 40, textAlign: "center" }}>Escolha um membro para ver a conversa</div> : (
            <>
              <div className="wa-topo"><Av m={atual} /><div><strong>{atual.nome}</strong><div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>{atual.empresa || ""}</div></div></div>
              <div className="wa-msgs">
                {conversa.length === 0 && <div style={{ color: "rgba(233,237,239,.5)", textAlign: "center", marginTop: 40 }}>Nenhuma mensagem com {primeiro(atual.nome)} ainda.</div>}
                {conversa.map((m) => (
                  <div key={m.id} className={`wa-bolha${m.direcao === "entrada" ? " in" : ""}`}>
                    {m.midia_url && m.midia_tipo === "imagem" && <img src={m.midia_url} alt="" />}
                    {m.midia_url && m.midia_tipo !== "imagem" && <a href={m.midia_url} target="_blank" rel="noopener noreferrer" style={{ color: "#8fd3ff" }}>📎 {m.midia_tipo}</a>}
                    {m.texto && <Formatado t={m.texto} />}
                    <small>{m.origem === "disparo" ? "Disparo · " : ""}{hora(m.momento)}{m.direcao === "saida" ? (m.status === "lido" ? " ✓✓ lida" : m.status === "entregue" ? " ✓✓" : " ✓") : ""}</small>
                  </div>
                ))}
                <div ref={fim} />
              </div>
              {erro && <div style={{ ...ui.erro, margin: "8px 10px 0" }}>{erro}</div>}
              <div className="wa-envio">
                <textarea style={{ ...ui.input, minHeight: 44, maxHeight: 140, resize: "vertical" }} placeholder={`Mensagem para ${primeiro(atual.nome)}`} value={texto}
                  onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                <button style={ui.botao} disabled={enviando || !texto.trim()} onClick={enviar}>{enviando ? "…" : "Enviar"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
