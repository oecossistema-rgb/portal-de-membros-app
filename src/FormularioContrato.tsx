// Formulário "Dados do contrato" do membro NOVO, aberto pelo link do WhatsApp (#contrato/<código>), sem login.
// Mesmas perguntas do Google Forms "Dados do Contratante" + nacionalidade, órgão emissor, cidade, estado e sócio.
// As respostas vão para a função "contratos", que gera o contrato para a equipe revisar (e copia para o Google Forms).
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type P = { nome: string; whatsapp: string; email: string; nacionalidade: string; estado_civil: string; profissao: string; rg: string; orgao_emissor: string; documento: string; endereco: string; cidade: string; estado: string; cep: string };
const VAZIO: P = { nome: "", whatsapp: "", email: "", nacionalidade: "Brasileira", estado_civil: "", profissao: "", rg: "", orgao_emissor: "", documento: "", endereco: "", cidade: "", estado: "", cep: "" };
const CAMPOS: [keyof P, string, string?][] = [
  ["nome", "Nome completo"], ["whatsapp", "Telefone/WhatsApp", "tel"], ["email", "E-mail", "email"], ["nacionalidade", "Nacionalidade"],
  ["estado_civil", "Estado civil"], ["profissao", "Profissão"], ["rg", "RG"], ["orgao_emissor", "Órgão emissor do RG (ex.: SSP-BA)"],
  ["documento", "CPF ou CNPJ"], ["endereco", "Endereço (rua, número, bairro)"], ["cidade", "Cidade"], ["estado", "Estado"], ["cep", "CEP"],
];
const PAGAMENTOS: [string, string][] = [
  ["avista", "R$ 28.000 à vista"],
  ["cartao", "12x de R$ 3.084,45 (cartão de crédito)"],
  ["boleto", "R$ 8.000 (adesão) + 12x de R$ 1.835,00 (boleto)"],
];
// Renovação: sem taxa de adesão, só a mensalidade.
const PAGAMENTOS_RENOVACAO: [string, string][] = [["renovacao", "12x de R$ 1.835,00 (mensalidade no boleto, sem taxa de adesão)"]];

async function chamar(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("contratos", { body: corpo });
  if (error) {
    try { const j = await (error as { context?: Response }).context?.json(); return { erro: j?.erro || "Não foi possível enviar agora. Tente de novo." }; } catch { return { erro: "Não foi possível enviar agora. Tente de novo." }; }
  }
  return data;
}

function Pessoa({ p, onChange, titulo }: { p: P; onChange: (p: P) => void; titulo?: string }) {
  return (
    <div style={{ ...ui.cartao, padding: "20px 18px" }}>
      {titulo && <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{titulo}</div>}
      {CAMPOS.map(([k, r, tipo]) => (
        <div key={k} style={{ marginBottom: 12 }}>
          <label style={ui.label} htmlFor={`${titulo || "p1"}-${k}`}>{r} *</label>
          <input id={`${titulo || "p1"}-${k}`} style={ui.input} type={tipo || "text"} value={p[k]} autoComplete="off"
            onChange={(e) => onChange({ ...p, [k]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

function Moldura({ children, onSair }: { children: ReactNode; onSair?: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--p-bg)", color: "var(--p-text)", textAlign: "left", padding: "28px 16px 60px", boxSizing: "border-box", width: "100%" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <img src="/icone-192.png" alt="" style={{ width: 40, height: 40, borderRadius: 10 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div style={{ fontWeight: 700, flex: 1 }}>Ecossistema Master Business</div>
          {onSair && <button style={ui.botaoSecundario} onClick={onSair}>Sair</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function FormularioContrato({ token, onSair, onEnviado }: { token: string; onSair?: () => void; onEnviado?: () => void }) {
  const [estado, setEstado] = useState<"carregando" | "invalido" | "respondido" | "form" | "enviado">("carregando");
  const [p1, setP1] = useState<P>(VAZIO);
  const [p2, setP2] = useState<P>(VAZIO);
  const [socio, setSocio] = useState(false);
  const [pagamento, setPagamento] = useState("");
  const [dia, setDia] = useState("");
  const [renovacao, setRenovacao] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    chamar({ acao: "formulario", token }).then((r) => {
      if (!r || r.erro) { setEstado("invalido"); return; }
      if (r.respondido) { setEstado("respondido"); return; }
      setP1({ ...VAZIO, nome: r.nome || "", email: r.email || "", whatsapp: r.whatsapp || "" });
      if (r.renovacao) { setRenovacao(true); setPagamento("renovacao"); setSocio(!!r.socio); }
      setEstado("form");
    });
  }, [token]);

  async function enviar() {
    setErro("");
    const pessoas = socio ? [p1, p2] : [p1];
    for (const [i, p] of pessoas.entries()) {
      const falta = CAMPOS.find(([k]) => !p[k].trim());
      if (falta) { setErro(`Preencha "${falta[1]}"${socio ? ` do ${i + 1}º participante` : ""}.`); return; }
    }
    if (!pagamento) { setErro("Escolha a forma de pagamento."); return; }
    if ((pagamento === "boleto" || pagamento === "renovacao") && !dia) { setErro("Escolha a melhor data do boleto."); return; }
    setEnviando(true);
    const r = await chamar({ acao: "responder", token, dados: { participantes: pessoas, pagamento, dia_boleto: dia || undefined } });
    setEnviando(false);
    if (r?.erro) { setErro(r.erro); return; }
    setEstado("enviado");
    window.scrollTo(0, 0);
    if (onEnviado) window.setTimeout(onEnviado, 2500); // dentro do portal: volta para a tela do contrato em andamento
  }

  if (estado === "carregando") return <Moldura onSair={onSair}><div style={ui.aviso}>Carregando...</div></Moldura>;
  if (estado === "invalido") return <Moldura onSair={onSair}><div style={ui.aviso}>Este link não é válido ou foi cancelado. Fale com a equipe do Ecossistema.</div></Moldura>;
  if (estado === "respondido" || estado === "enviado") return (
    <Moldura onSair={onSair}>
      <div style={{ ...ui.cartao, textAlign: "center", padding: "34px 22px" }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <h1 style={{ fontSize: 24, margin: "8px 0 10px", fontWeight: 700, color: "var(--p-text)", letterSpacing: "-0.01em" }}>{estado === "enviado" ? "Dados recebidos!" : "Você já enviou seus dados."}</h1>
        <p style={{ color: "var(--p-muted)", fontSize: 15.5, lineHeight: 1.55, margin: 0 }}>
          {renovacao
            ? "Nossa equipe vai preparar a renovação do seu contrato. Você recebe no WhatsApp o link para assinar. Seu acesso ao portal continua normal."
            : "Nossa equipe vai preparar o seu contrato. Você recebe no WhatsApp o link para assinar e, depois das assinaturas, o acesso ao portal."}
        </p>
      </div>
    </Moldura>
  );

  return (
    <Moldura onSair={onSair}>
      <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: "0 0 8px", letterSpacing: "-0.02em", fontWeight: 700, color: "var(--p-text)" }}>{renovacao ? "Renovação do contrato" : "Dados do contrato"}</h1>
      <p style={{ color: "var(--p-muted)", fontSize: 15, lineHeight: 1.5, margin: "0 0 18px" }}>
        {renovacao ? "Confirme seus dados para a renovação. Na renovação não há taxa de adesão, só a mensalidade." : "Os dados abaixo serão usados para fazer o seu contrato. Confira tudo antes de enviar."}
      </p>
      <Pessoa p={p1} onChange={setP1} titulo={socio ? "1º participante" : undefined} />

      <div style={{ ...ui.cartao, padding: "16px 18px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={socio} onChange={(e) => setSocio(e.target.checked)} style={{ width: 20, height: 20 }} />
          Vai entrar com sócio(a)?
        </label>
        <div style={{ fontSize: 13, color: "var(--p-muted)", marginTop: 6 }}>A adesão vale para até 2 participantes da mesma empresa ou casal.</div>
      </div>
      {socio && <Pessoa p={p2} onChange={setP2} titulo="2º participante" />}

      <div style={{ ...ui.cartao, padding: "20px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Forma de pagamento *</div>
        {(renovacao ? PAGAMENTOS_RENOVACAO : PAGAMENTOS).map(([v, t]) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer", fontSize: 15 }}>
            <input type="radio" name="pagamento" checked={pagamento === v} onChange={() => setPagamento(v)} style={{ width: 19, height: 19 }} /> {t}
          </label>
        ))}
        {pagamento === "cartao" && <div style={{ fontSize: 13, color: "var(--p-muted)", marginTop: 4 }}>No cartão, os juros da operadora já estão no valor das parcelas.</div>}
        {(pagamento === "boleto" || pagamento === "renovacao") && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Melhor data do boleto *</div>
            {["05", "10", "15"].map((d) => (
              <label key={d} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 18, padding: "6px 0", cursor: "pointer" }}>
                <input type="radio" name="dia" checked={dia === d} onChange={() => setDia(d)} style={{ width: 18, height: 18 }} /> Dia {d}
              </label>
            ))}
          </div>
        )}
      </div>

      {erro && <div style={ui.erro}>{erro}</div>}
      <button className="cta-btn" style={{ ...ui.botao, width: "100%", padding: "15px 22px", fontSize: 16 }} disabled={enviando} onClick={enviar}>
        {enviando ? "Enviando..." : "Enviar dados do contrato"}
      </button>
    </Moldura>
  );
}
