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
  const [membroId, setMembroId] = useState<string | null>(null);
  const [resp, setResp] = useState<Respostas>({});
  const [etapa, setEtapa] = useState(0); // ETAPAS.length = tela de revisão
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
      if (modo === "obrigatorio") {
        const salva = Number(onb.etapa_atual) || 1;
        setEtapa(Math.min(Math.max(salva - 1, 0), ETAPAS.length));
      }
      setCarregando(false);
    })();
  }, [userId, modo]);

  const perguntasDaEtapa = useMemo(
    () => (etapa < ETAPAS.length ? PERGUNTAS.filter((p) => p.n >= ETAPAS[etapa].de && p.n <= ETAPAS[etapa].ate) : []),
    [etapa]
  );

  function alterar(campo: string, valor: string | string[] | null) {
    setResp((r) => ({ ...r, [campo]: valor }));
    setErro("");
  }

  async function gravar(proximaEtapa: number) {
    if (!membroId) return false;
    const dadosMembro: Record<string, unknown> = {};
    for (const c of CAMPOS_MEMBROS) if (c !== "foto_url" && c !== "logo_url") dadosMembro[c] = limpar(resp[c]);
    const ce = separarCidadeEstado((resp.cidade_estado as string) || "");
    if (ce) { dadosMembro.cidade = ce.cidade; dadosMembro.estado = ce.estado; }

    const dadosOnb: Record<string, unknown> = { etapa_atual: proximaEtapa + 1 };
    for (const c of CAMPOS_ONBOARDING) dadosOnb[c] = limpar(resp[c]);
    if (resp.modelo_comercial !== OPCAO_OUTRO) dadosOnb.modelo_comercial_outro_texto = null;

    const [r1, r2] = await Promise.all([
      supabase.from("membros").update(dadosMembro).eq("id", membroId),
      supabase.from("membros_onboarding").update(dadosOnb).eq("membro_id", membroId),
    ]);
    if (r1.error || r2.error) {
      setErro("Não foi possível salvar suas respostas. Verifique sua conexão e tente novamente.");
      return false;
    }
    return true;
  }

  function pendentesDaEtapa(): Pergunta[] {
    return perguntasDaEtapa.filter((p) => p.obrigatoria && !respondida(p, resp));
  }

  async function avancar() {
    const pend = pendentesDaEtapa();
    if (pend.length) {
      setFaltando(pend.map((p) => p.n));
      setErro(`Responda a${pend.length > 1 ? "s perguntas" : " pergunta"} ${pend.map((p) => p.n).join(", ")} para continuar.`);
      return;
    }
    setFaltando([]);
    setSalvando(true);
    const ok = await gravar(etapa + 1);
    setSalvando(false);
    if (ok) { setEtapa(etapa + 1); window.scrollTo(0, 0); }
  }

  async function voltar() {
    setErro(""); setFaltando([]);
    await gravar(etapa - 1);
    setEtapa(etapa - 1);
    window.scrollTo(0, 0);
  }

  async function enviar() {
    setSalvando(true);
    setErro("");
    const ok = await gravar(ETAPAS.length);
    if (!ok) { setSalvando(false); return; }
    if (modo === "edicao") { setSalvando(false); onConcluido(); return; }
    const { data, error } = await supabase.rpc("concluir_onboarding");
    setSalvando(false);
    if (error) { setErro("Não foi possível enviar agora. Tente novamente."); return; }
    if (data?.ok) { onConcluido(); return; }
    const nums: number[] = ((data?.faltando as string[]) || []).map((s) => Number(s.replace("P", "")));
    setFaltando(nums);
    const primeira = ETAPAS.findIndex((e) => nums.some((n) => n >= e.de && n <= e.ate));
    if (primeira >= 0) setEtapa(primeira);
    setErro(`Ainda falta responder: ${nums.join(", ")}.`);
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

  if (carregando) return <Pagina><div style={ui.aviso}>Carregando...</div></Pagina>;
  if (!membroId) return <Pagina><div style={ui.erro}>{erro}</div>{onSair && <button style={ui.botaoSecundario} onClick={onSair}>Sair</button>}</Pagina>;

  const revisao = etapa >= ETAPAS.length;
  const progresso = Math.round((Math.min(etapa, ETAPAS.length) / ETAPAS.length) * 100);

  return (
    <Pagina>
      <section style={{ ...ui.hero, paddingBottom: 40 }}>
        <div style={ui.heroInner}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={ui.heroEyebrow}>{modo === "obrigatorio" ? "Bem-vindo ao Ecossistema" : "Minhas respostas"}</div>
            {modo === "obrigatorio" && onSair && (
              <button onClick={onSair} style={{ background: "none", border: "none", color: "#B8C0CC", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Sair</button>
            )}
            {modo === "edicao" && (
              <button onClick={onConcluido} style={{ background: "none", border: "none", color: "#B8C0CC", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancelar</button>
            )}
          </div>
          <h1 style={ui.heroTitle}>{TITULO_FORM}</h1>
          {etapa === 0 && (
            <>
              <p style={ui.heroSub}>{DESCRICAO_FORM}</p>
              <p style={{ ...ui.heroSub, color: "#fff", fontWeight: 700, marginTop: 14 }}>{DESTAQUE_FORM}</p>
            </>
          )}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 13, color: "#B8C0CC", marginBottom: 8 }}>
              {revisao ? "Revisão final" : `Etapa ${etapa + 1} de ${ETAPAS.length} · ${ETAPAS[etapa].titulo}`}
            </div>
            <div style={{ height: 6, background: "#2C3442", borderRadius: 6 }} role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ height: 6, width: `${progresso}%`, background: "#8BAD3F", borderRadius: 6, transition: "width .3s" }} />
            </div>
          </div>
        </div>
      </section>

      <main style={{ ...ui.lista, textAlign: "left" }}>
        {!revisao && (
          <div style={ui.cartao}>
            {perguntasDaEtapa.map((p) => (
              <CampoPergunta key={p.n} p={p} resp={resp} alterar={alterar} destacado={faltando.includes(p.n)}
                enviando={enviandoArquivo === p.campo} onArquivo={(f) => enviarArquivo(p, f)} />
            ))}
          </div>
        )}

        {revisao && (
          <div style={ui.cartao}>
            <p style={{ margin: "0 0 18px", color: "#4A5568", fontSize: 15 }}>
              Confira suas respostas. Para corrigir alguma, clique em "Editar" na etapa correspondente.
            </p>
            {ETAPAS.map((e, i) => (
              <div key={e.titulo} style={{ borderTop: "1px solid #EAECE6", padding: "14px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ color: "#1A1F2B" }}>{e.titulo}</strong>
                  <button style={ui.botaoSecundario} onClick={() => setEtapa(i)}>Editar</button>
                </div>
                {PERGUNTAS.filter((p) => p.n >= e.de && p.n <= e.ate).map((p) => (
                  <LinhaResposta key={p.n} p={p} resp={resp} destacado={faltando.includes(p.n)} />
                ))}
              </div>
            ))}
          </div>
        )}

        {erro && <div style={ui.erro} role="alert">{erro}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          {etapa > 0 ? <button style={ui.botaoSecundario} onClick={voltar} disabled={salvando}>Voltar</button> : <span />}
          {!revisao ? (
            <button className="cta-btn" style={ui.botao} onClick={avancar} disabled={salvando || !!enviandoArquivo}>
              {salvando ? "Salvando..." : etapa === ETAPAS.length - 1 ? "Revisar respostas" : "Continuar"}
            </button>
          ) : (
            <button className="cta-btn" style={ui.botao} onClick={enviar} disabled={salvando}>
              {salvando ? "Enviando..." : modo === "obrigatorio" ? "Enviar e acessar o portal" : "Salvar alterações"}
            </button>
          )}
        </div>
      </main>
    </Pagina>
  );
}

function Pagina({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#F5F6F2", fontFamily: "'Inter', system-ui, sans-serif" }}>{children}</div>;
}

function Enunciado({ p, id }: { p: Pergunta; id?: string }) {
  return (
    <label htmlFor={id} style={{ ...ui.label, fontSize: 15, color: "#1A1F2B", lineHeight: 1.45 }}>
      {p.n}. {p.texto} {p.obrigatoria && <span style={{ color: "#C0392B" }} aria-label="obrigatória">*</span>}
    </label>
  );
}

function CampoPergunta({ p, resp, alterar, destacado, enviando, onArquivo }: {
  p: Pergunta; resp: Respostas; alterar: (c: string, v: string | string[] | null) => void;
  destacado: boolean; enviando: boolean; onArquivo: (f: File | undefined) => void;
}) {
  const id = `q${p.n}`;
  const valor = resp[p.campo];
  const caixa: CSSProperties = { marginBottom: 22, padding: destacado ? 12 : 0, borderRadius: 10, border: destacado ? "1.5px solid #E5C2C2" : "none", background: destacado ? "#FDF6F6" : "transparent" };
  const opcao: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#1A1F2B", margin: "8px 0", cursor: "pointer", lineHeight: 1.4 };

  if (p.tipo === "curto" || p.tipo === "longo" || p.tipo === "data") {
    return (
      <div style={caixa}>
        <Enunciado p={p} id={id} />
        {p.tipo === "longo" ? (
          <textarea id={id} style={{ ...ui.input, minHeight: 96, resize: "vertical" }} value={(valor as string) || ""} onChange={(e) => alterar(p.campo, e.target.value)} />
        ) : (
          <input id={id} type={p.tipo === "data" ? "date" : "text"} style={ui.input} value={(valor as string) || ""} onChange={(e) => alterar(p.campo, e.target.value)} />
        )}
        {p.ajuda && <div style={{ fontSize: 12, color: "#9AA3B2", marginTop: 6, fontStyle: "italic" }}>{p.ajuda}</div>}
      </div>
    );
  }

  if (p.tipo === "unica") {
    return (
      <fieldset style={{ ...caixa, border: caixa.border, margin: "0 0 22px", minWidth: 0 }}>
        <legend style={{ padding: 0 }}><Enunciado p={p} /></legend>
        <div style={{ fontSize: 13, color: "#5A6472", fontStyle: "italic" }}>Marcar apenas uma oval.</div>
        {p.opcoes!.map((o) => (
          <label key={o} style={opcao}>
            <input type="radio" name={id} checked={valor === o} onChange={() => alterar(p.campo, o)} style={{ marginTop: 2, accentColor: "#8BAD3F" }} />
            {o}
          </label>
        ))}
        {p.outro && (
          <label style={{ ...opcao, alignItems: "center" }}>
            <input type="radio" name={id} checked={valor === OPCAO_OUTRO} onChange={() => alterar(p.campo, OPCAO_OUTRO)} style={{ accentColor: "#8BAD3F" }} />
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
        <div style={{ fontSize: 13, color: "#9AA3B2", fontStyle: "italic" }}>Marque todas que se aplicam.</div>
        {p.opcoes!.map((o) => (
          <label key={o} style={opcao}>
            <input type="checkbox" checked={marcados.includes(o)} onChange={() => alternar(o)} style={{ marginTop: 2, width: 16, height: 16, accentColor: "#8BAD3F" }} />
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
            style={{ width: 96, height: 96, objectFit: p.campo === "logo_url" ? "contain" : "cover", borderRadius: p.campo === "logo_url" ? 12 : "50%", background: "#fff", border: "1px solid #EAECE6" }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: 12, border: "1.5px dashed #D8DCD2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9AA3B2" }}>sem imagem</div>
        )}
        <label style={{ ...ui.botaoSecundario, display: "inline-block" }}>
          {enviando ? "Enviando..." : url ? "Trocar imagem" : "Enviar imagem"}
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={enviando}
            onChange={(e) => onArquivo(e.target.files?.[0])} />
        </label>
        <span style={{ fontSize: 12, color: "#9AA3B2" }}>JPG, PNG ou WEBP, até 2 MB.</span>
      </div>
    </div>
  );
}

export function LinhaResposta({ p, resp, destacado }: { p: Pergunta; resp: Respostas; destacado?: boolean }) {
  const texto = formatarResposta(p, resp);
  return (
    <div style={{ padding: "8px 0", borderRadius: 8, background: destacado ? "#FDF6F6" : "transparent" }}>
      <div style={{ fontSize: 13, color: "#5A6472", fontWeight: 600 }}>{p.n}. {p.texto}</div>
      {p.tipo === "arquivo" ? (
        texto ? <img src={texto} alt="" style={{ marginTop: 6, width: 72, height: 72, objectFit: p.campo === "logo_url" ? "contain" : "cover", borderRadius: 10, border: "1px solid #EAECE6", background: "#fff" }} />
          : <div style={{ fontSize: 14, color: "#C0392B" }}>Não enviada</div>
      ) : (
        <div style={{ fontSize: 15, color: texto ? "#1A1F2B" : "#9AA3B2", whiteSpace: "pre-wrap", marginTop: 2 }}>{texto || "Sem resposta"}</div>
      )}
    </div>
  );
}
