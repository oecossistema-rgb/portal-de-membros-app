import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";
import {
  PERGUNTAS, ETAPAS, CAMPOS_MEMBROS, CAMPOS_ONBOARDING, OPCAO_OUTRO,
  TITULO_FORM, DESCRICAO_FORM, DESTAQUE_FORM, formatarResposta, respondida,
} from "./onboardingPerguntas";
import type { Pergunta, Respostas } from "./onboardingPerguntas";

type Props = {
  userId: string;
  // "obrigatorio": logo após criar a senha; só libera o portal depois do envio.
  // "edicao": o membro revisa as respostas pela aba Meu Perfil.
  modo: "obrigatorio" | "edicao";
  onConcluido: () => void;
  onSair?: () => void;
};

const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp"];
const LIMITE_IMAGEM = 2 * 1024 * 1024;

// "Salvador / BA", "Salvador - BA", "Salvador, BA" -> cidade e UF para o card do diretório.
function separarCidadeEstado(texto: string): { cidade: string; estado: string } | null {
  const m = texto.trim().match(/^(.+?)\s*[/,-]\s*([A-Za-z]{2})$/);
  return m ? { cidade: m[1].trim(), estado: m[2].toUpperCase() } : null;
}

function limpar(v: string | string[] | null | undefined) {
  if (Array.isArray(v)) return v.length ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export default function Onboarding({ userId, modo, onConcluido, onSair }: Props) {
  const TOTAL = PERGUNTAS.length; // 40
  const [membroId, setMembroId] = useState<string | null>(null);
  const [resp, setResp] = useState<Respostas>({});
  // -1 = abertura · 0..39 = uma pergunta por tela · TOTAL = revisão final
  const [idx, setIdx] = useState(-1);
  const [deRevisao, setDeRevisao] = useState(false); // editando a partir da revisão: "Continuar" volta para ela
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [faltando, setFaltando] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from("membros")
        .select(["id", ...CAMPOS_MEMBROS].join(","))
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (!m) {
        setErro("Seu cadastro não foi encontrado. Fale com a administração do Ecossistema.");
        setCarregando(false);
        return;
      }
      const membro = m as unknown as Record<string, string | null>;
      // Cria a ficha do onboarding na primeira vez (não sobrescreve se já existir).
      await supabase.from("membros_onboarding").upsert({ membro_id: membro.id }, { onConflict: "membro_id", ignoreDuplicates: true });
      const { data: o } = await supabase
        .from("membros_onboarding")
        .select([...CAMPOS_ONBOARDING, "etapa_atual"].join(","))
        .eq("membro_id", membro.id)
        .maybeSingle();
      const onb = (o || {}) as unknown as Record<string, string | string[] | null>;
      setMembroId(membro.id);
      setResp({ ...membro, ...onb });
      if (modo === "edicao") {
        setIdx(TOTAL); // abre na revisão; o membro escolhe o que editar
      } else {
        // etapa_atual guarda o número da pergunta em que o membro parou (1..40; 41 = revisão)
        const salva = Number(onb.etapa_atual) || 1;
        setIdx(salva <= 1 ? -1 : Math.min(salva - 1, TOTAL));
      }
      setCarregando(false);
    })();
  }, [userId, modo, TOTAL]);

  const pergunta: Pergunta | null = idx >= 0 && idx < TOTAL ? PERGUNTAS[idx] : null;
  const etapaAtual = useMemo(() => (pergunta ? ETAPAS.find((e) => pergunta.n >= e.de && pergunta.n <= e.ate) : null), [pergunta]);

  function alterar(campo: string, valor: string | string[] | null) {
    setResp((r) => ({ ...r, [campo]: valor }));
    setErro("");
  }

  async function gravar(proximo: number) {
    if (!membroId) return false;
    const dadosMembro: Record<string, unknown> = {};
    for (const c of CAMPOS_MEMBROS) if (c !== "foto_url" && c !== "logo_url") dadosMembro[c] = limpar(resp[c]);
    const ce = separarCidadeEstado((resp.cidade_estado as string) || "");
    if (ce) { dadosMembro.cidade = ce.cidade; dadosMembro.estado = ce.estado; }

    const dadosOnb: Record<string, unknown> = { etapa_atual: Math.max(proximo, 0) + 1 };
    for (const c of CAMPOS_ONBOARDING) dadosOnb[c] = limpar(resp[c]);
    if (resp.modelo_comercial !== OPCAO_OUTRO) dadosOnb.modelo_comercial_outro_texto = null;

    const [r1, r2] = await Promise.all([
      supabase.from("membros").update(dadosMembro).eq("id", membroId),
      supabase.from("membros_onboarding").update(dadosOnb).eq("membro_id", membroId),
    ]);
    if (r1.error || r2.error) {
      setErro("Não foi possível salvar sua resposta. Verifique sua conexão e tente novamente.");
      return false;
    }
    return true;
  }

  function irPara(novo: number) {
    setIdx(novo);
    window.scrollTo(0, 0);
  }

  async function avancar() {
    if (!pergunta) return;
    if (pergunta.obrigatoria && !respondida(pergunta, resp)) {
      setFaltando([pergunta.n]);
      setErro(pergunta.outro && resp[pergunta.campo] === OPCAO_OUTRO
        ? 'Escreva qual é o seu modelo comercial em "Outro:" para continuar.'
        : "Responda esta pergunta para continuar.");
      return;
    }
    setFaltando((f) => f.filter((n) => n !== pergunta.n));
    const proximo = deRevisao ? TOTAL : idx + 1;
    setSalvando(true);
    const ok = await gravar(proximo);
    setSalvando(false);
    if (ok) { if (proximo === TOTAL) setDeRevisao(false); irPara(proximo); }
  }

  async function voltar() {
    setErro("");
    if (deRevisao) { setDeRevisao(false); irPara(TOTAL); return; }
    await gravar(idx - 1);
    irPara(idx - 1);
  }

  function editar(i: number) {
    setDeRevisao(true);
    setErro("");
    irPara(i);
  }

  async function enviar() {
    setSalvando(true);
    setErro("");
    const ok = await gravar(TOTAL);
    if (!ok) { setSalvando(false); return; }
    if (modo === "edicao") { setSalvando(false); onConcluido(); return; }
    const { data, error } = await supabase.rpc("concluir_onboarding");
    setSalvando(false);
    if (error) { setErro("Não foi possível enviar agora. Tente novamente."); return; }
    if (data?.ok) {
      supabase.functions.invoke("gerar-resumo", { body: {} }).catch(() => { /* o admin pode gerar depois */ });
      onConcluido();
      return;
    }
    const nums: number[] = ((data?.faltando as string[]) || []).map((s) => Number(s.replace("P", "")));
    setFaltando(nums);
    setErro(`Ainda falta responder: ${nums.join(", ")}. Clique em "Editar" na pergunta destacada.`);
  }

  async function enviarArquivo(p: Pergunta, arquivo: File | undefined) {
    if (!arquivo || !membroId) return;
    if (!TIPOS_IMAGEM.includes(arquivo.type)) { setErro("Envie a imagem em JPG, PNG ou WEBP."); return; }
    if (arquivo.size > LIMITE_IMAGEM) { setErro("A imagem deve ter no máximo 2 MB."); return; }
    setEnviandoArquivo(p.campo);
    setErro("");
    const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
    const prefixo = p.campo === "logo_url" ? "logo" : "foto";
    const caminho = `${userId}/${prefixo}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("fotos-membros").upload(caminho, arquivo, { contentType: arquivo.type });
    if (error) { setEnviandoArquivo(null); setErro("Não foi possível enviar a imagem. Tente novamente."); return; }
    const url = supabase.storage.from("fotos-membros").getPublicUrl(caminho).data.publicUrl;
    const { error: e2 } = await supabase.from("membros").update({ [p.campo]: url }).eq("id", membroId);
    setEnviandoArquivo(null);
    if (e2) { setErro("Imagem enviada, mas não foi possível salvar. Tente novamente."); return; }
    alterar(p.campo, url);
  }

  if (carregando) return <Pagina><div style={{ ...ui.aviso, margin: 24 }}>Carregando...</div></Pagina>;
  if (!membroId) return <Pagina><div style={{ ...ui.erro, margin: 24 }}>{erro}</div>{onSair && <button style={{ ...ui.botaoSecundario, marginLeft: 24 }} onClick={onSair}>Sair</button>}</Pagina>;

  const abertura = idx < 0;
  const revisao = idx >= TOTAL;
  const progresso = Math.round((Math.max(idx, 0) / TOTAL) * 100);
  const linkTopo: CSSProperties = { position: "absolute", top: 0, right: 24, background: "none", border: "none", color: "#B8C0CC", cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 4 };

  return (
    <Pagina>
      {/* CABEÇALHO: tudo centralizado no mesmo eixo; "Sair" fixo no canto */}
      <section style={{ ...ui.hero, padding: "28px 0 36px" }}>
        <div style={{ ...ui.heroInner, position: "relative", textAlign: "center" }}>
          {modo === "obrigatorio" && onSair && <button onClick={onSair} style={linkTopo}>Sair</button>}
          {modo === "edicao" && <button onClick={onConcluido} style={linkTopo}>Cancelar</button>}
          <div style={{ ...ui.heroEyebrow, marginBottom: 12 }}>{modo === "obrigatorio" ? "Bem-vindo ao Ecossistema" : "Minhas respostas"}</div>
          <h1 style={{ ...ui.heroTitle, fontSize: abertura ? 34 : 26, margin: "0 auto", maxWidth: 640 }}>{TITULO_FORM}</h1>
          {abertura && (
            <>
              <p style={{ ...ui.heroSub, margin: "16px auto 0" }}>{DESCRICAO_FORM}</p>
              <p style={{ ...ui.heroSub, color: "#fff", fontWeight: 700, margin: "14px auto 0" }}>{DESTAQUE_FORM}</p>
            </>
          )}
          {!abertura && (
            <div style={{ maxWidth: 560, margin: "20px auto 0" }}>
              <div style={{ fontSize: 13, color: "#B8C0CC", marginBottom: 8 }}>
                {revisao ? "Revisão final" : `Pergunta ${pergunta!.n} de ${TOTAL} · ${etapaAtual?.titulo}`}
              </div>
              <div style={{ height: 6, background: "#14241C", borderRadius: 6 }} role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ height: 6, width: `${revisao ? 100 : progresso}%`, background: "#2BE36B", borderRadius: 6, transition: "width .3s" }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <main style={{ ...ui.lista, maxWidth: 680, margin: "16px auto 0", padding: "0 20px 40px", textAlign: "left" }}>
        {abertura && (
          <div style={{ ...ui.cartao, textAlign: "center", padding: "32px 22px" }}>
            <p style={{ margin: "0 0 6px", fontSize: 16, color: "#E9F0EC", fontWeight: 700 }}>São {TOTAL} perguntas, uma por tela.</p>
            <p style={{ margin: "0 0 22px", fontSize: 14, color: "#97A69E" }}>Suas respostas ficam salvas a cada passo: se precisar sair, você continua de onde parou.</p>
            <button className="cta-btn" style={{ ...ui.botao, padding: "14px 28px", fontSize: 15 }} onClick={() => irPara(0)}>Começar</button>
          </div>
        )}

        {pergunta && (
          <div style={{ ...ui.cartao, padding: "28px 22px" }}
            onKeyDown={(e) => {
              const alvo = e.target as HTMLElement;
              if (e.key === "Enter" && alvo.tagName === "INPUT" && (alvo as HTMLInputElement).type !== "file") { e.preventDefault(); avancar(); }
            }}>
            <CampoPergunta key={pergunta.n} p={pergunta} resp={resp} alterar={alterar} destacado={faltando.includes(pergunta.n)}
              enviando={enviandoArquivo === pergunta.campo} onArquivo={(f) => enviarArquivo(pergunta, f)} autoFoco />
          </div>
        )}

        {revisao && (
          <div style={ui.cartao}>
            <p style={{ margin: "0 0 12px", color: "#97A69E", fontSize: 15 }}>
              Confira suas respostas. Para corrigir alguma, clique em "Editar" ao lado dela.
            </p>
            {ETAPAS.map((e) => (
              <div key={e.titulo} style={{ borderTop: "1px solid #1B2A23", padding: "12px 0 4px" }}>
                <strong style={{ color: "#E9F0EC" }}>{e.titulo}</strong>
                {PERGUNTAS.filter((p) => p.n >= e.de && p.n <= e.ate).map((p) => (
                  <div key={p.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><LinhaResposta p={p} resp={resp} destacado={faltando.includes(p.n)} /></div>
                    <button onClick={() => editar(p.n - 1)} aria-label={`Editar pergunta ${p.n}`}
                      style={{ background: "none", border: "none", color: "#2BE36B", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "10px 0", fontFamily: "inherit" }}>Editar</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {erro && <div style={ui.erro} role="alert">{erro}</div>}

        {!abertura && (
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
            {idx > 0 || deRevisao ? <button style={ui.botaoSecundario} onClick={voltar} disabled={salvando}>{deRevisao ? "Voltar à revisão" : "Voltar"}</button> : <span />}
            {pergunta ? (
              <button className="cta-btn" style={ui.botao} onClick={avancar} disabled={salvando || !!enviandoArquivo}>
                {salvando ? "Salvando..." : deRevisao || idx === TOTAL - 1 ? "Ir para a revisão" : "Continuar"}
              </button>
            ) : (
              <button className="cta-btn" style={ui.botao} onClick={enviar} disabled={salvando}>
                {salvando ? "Enviando..." : modo === "obrigatorio" ? "Enviar e acessar o portal" : "Salvar alterações"}
              </button>
            )}
          </div>
        )}
      </main>
    </Pagina>
  );
}

function Pagina({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "radial-gradient(80% 50% at 50% 0%, rgba(43,227,107,.12) 0%, rgba(43,227,107,0) 60%), #06090A", color: "#E9F0EC", fontFamily: "'Inter', system-ui, sans-serif", width: "100%" }}>{children}</div>;
}

function Enunciado({ p, id }: { p: Pergunta; id?: string }) {
  return (
    <label htmlFor={id} style={{ ...ui.label, fontSize: 18, fontWeight: 700, color: "#E9F0EC", lineHeight: 1.4, marginBottom: 12 }}>
      {p.n}. {p.texto} {p.obrigatoria && <span style={{ color: "#FF9A9A" }} aria-label="obrigatória">*</span>}
    </label>
  );
}

function CampoPergunta({ p, resp, alterar, destacado, enviando, onArquivo, autoFoco }: {
  p: Pergunta; resp: Respostas; alterar: (c: string, v: string | string[] | null) => void;
  destacado: boolean; enviando: boolean; onArquivo: (f: File | undefined) => void; autoFoco?: boolean;
}) {
  const id = `q${p.n}`;
  const valor = resp[p.campo];
  const caixa: CSSProperties = { marginBottom: 22, padding: destacado ? 12 : 0, borderRadius: 10, border: destacado ? "1.5px solid #1B2A23" : "none", background: destacado ? "#FDF6F6" : "transparent" };
  const opcao: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#E9F0EC", margin: "8px 0", cursor: "pointer", lineHeight: 1.4 };

  if (p.tipo === "curto" || p.tipo === "longo" || p.tipo === "data") {
    return (
      <div style={caixa}>
        <Enunciado p={p} id={id} />
        {p.tipo === "longo" ? (
          <textarea id={id} autoFocus={autoFoco} style={{ ...ui.input, minHeight: 120, resize: "vertical" }} value={(valor as string) || ""} onChange={(e) => alterar(p.campo, e.target.value)} />
        ) : (
          <input id={id} autoFocus={autoFoco} type={p.tipo === "data" ? "date" : "text"} style={ui.input} value={(valor as string) || ""} onChange={(e) => alterar(p.campo, e.target.value)} />
        )}
        {p.ajuda && <div style={{ fontSize: 12, color: "#97A69E", marginTop: 6, fontStyle: "italic" }}>{p.ajuda}</div>}
      </div>
    );
  }

  if (p.tipo === "unica") {
    return (
      <fieldset style={{ ...caixa, border: caixa.border, margin: "0 0 22px", minWidth: 0 }}>
        <legend style={{ padding: 0 }}><Enunciado p={p} /></legend>
        <div style={{ fontSize: 13, color: "#97A69E", fontStyle: "italic" }}>Marcar apenas uma oval.</div>
        {p.opcoes!.map((o) => (
          <label key={o} style={opcao}>
            <input type="radio" name={id} checked={valor === o} onChange={() => alterar(p.campo, o)} style={{ marginTop: 2, accentColor: "#2BE36B" }} />
            {o}
          </label>
        ))}
        {p.outro && (
          <label style={{ ...opcao, alignItems: "center" }}>
            <input type="radio" name={id} checked={valor === OPCAO_OUTRO} onChange={() => alterar(p.campo, OPCAO_OUTRO)} style={{ accentColor: "#2BE36B" }} />
            Outro:
            <input aria-label="Outro (especifique)" style={{ ...ui.input, padding: "7px 10px", flex: 1 }} value={(resp[p.outro.campo] as string) || ""}
              onFocus={() => alterar(p.campo, OPCAO_OUTRO)} onChange={(e) => alterar(p.outro!.campo, e.target.value)} />
          </label>
        )}
      </fieldset>
    );
  }

  if (p.tipo === "multipla") {
    const marcados = Array.isArray(valor) ? valor : [];
    const alternar = (o: string) => alterar(p.campo, marcados.includes(o) ? marcados.filter((x) => x !== o) : [...marcados, o]);
    return (
      <fieldset style={{ ...caixa, border: caixa.border, margin: "0 0 22px", minWidth: 0 }}>
        <legend style={{ padding: 0 }}><Enunciado p={p} /></legend>
        <div style={{ fontSize: 13, color: "#97A69E", fontStyle: "italic" }}>Marque todas que se aplicam.</div>
        {p.opcoes!.map((o) => (
          <label key={o} style={opcao}>
            <input type="checkbox" checked={marcados.includes(o)} onChange={() => alternar(o)} style={{ marginTop: 2, width: 16, height: 16, accentColor: "#2BE36B" }} />
            {o}
          </label>
        ))}
      </fieldset>
    );
  }

  // arquivo (P39 foto, P40 logo)
  const url = valor as string | null;
  return (
    <div style={caixa}>
      <Enunciado p={p} id={id} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
        {url ? (
          <img src={url} alt={p.campo === "logo_url" ? "Logo enviada" : "Foto enviada"}
            style={{ width: 96, height: 96, objectFit: p.campo === "logo_url" ? "contain" : "cover", borderRadius: p.campo === "logo_url" ? 12 : "50%", background: "linear-gradient(180deg,#0E1714 0%,#0B1210 100%)", border: "1px solid #1B2A23" }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: 12, border: "1.5px dashed #1B2A23", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#97A69E" }}>sem imagem</div>
        )}
        <label style={{ ...ui.botaoSecundario, display: "inline-block" }}>
          {enviando ? "Enviando..." : url ? "Trocar imagem" : "Enviar imagem"}
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={enviando}
            onChange={(e) => onArquivo(e.target.files?.[0])} />
        </label>
        <span style={{ fontSize: 12, color: "#97A69E" }}>JPG, PNG ou WEBP, até 2 MB.</span>
      </div>
    </div>
  );
}

export function LinhaResposta({ p, resp, destacado }: { p: Pergunta; resp: Respostas; destacado?: boolean }) {
  const texto = formatarResposta(p, resp);
  return (
    <div style={{ padding: "8px 0", borderRadius: 8, background: destacado ? "#FDF6F6" : "transparent" }}>
      <div style={{ fontSize: 13, color: "#97A69E", fontWeight: 600 }}>{p.n}. {p.texto}</div>
      {p.tipo === "arquivo" ? (
        texto ? <img src={texto} alt="" style={{ marginTop: 6, width: 72, height: 72, objectFit: p.campo === "logo_url" ? "contain" : "cover", borderRadius: 10, border: "1px solid #1B2A23", background: "linear-gradient(180deg,#0E1714 0%,#0B1210 100%)" }} />
          : <div style={{ fontSize: 14, color: "#FF9A9A" }}>Não enviada</div>
      ) : (
        <div style={{ fontSize: 15, color: texto ? "#E9F0EC" : "#6B7A72", whiteSpace: "pre-wrap", marginTop: 2 }}>{texto || "Sem resposta"}</div>
      )}
    </div>
  );
}
