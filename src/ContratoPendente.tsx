// Membro novo que ainda não assinou o contrato: o portal mostra só esta tela (ele ainda não é membro).
// Mostra o passo em que o contrato está: preencher os dados -> equipe preparando -> assinar -> liberado.
// Quando todas as assinaturas chegam (o portal confere na Autentique a cada 10 min), a tela some sozinha.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";
import FormularioContrato from "./FormularioContrato";

type Situacao = { pendente: boolean; status: string | null; formulario: string | null; assinar: string | null; assinaturas: { feitas: number; total: number } | null };

export default function ContratoPendente({ nome, onSair, onLiberado }: { nome: string; onSair: () => void; onLiberado: () => void }) {
  const [s, setS] = useState<Situacao | null>(null);

  async function consultar() {
    const { data } = await supabase.functions.invoke("contratos", { body: { acao: "meu_contrato" } });
    if (data && data.pendente === false) { onLiberado(); return; }
    if (data) setS(data as Situacao);
  }
  useEffect(() => {
    consultar();
    const t = window.setInterval(consultar, 30000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const token = s?.formulario ? /#contrato\/([0-9a-f-]{36})/i.exec(s.formulario)?.[1] : null;
  if (token) return <FormularioContrato token={token} onSair={onSair} onEnviado={consultar} />;

  const primeiro = (nome || "").split(" ")[0];
  const passos = [
    { t: "Dados do contrato", feito: !!s && s.status !== "aguardando_formulario" && s.status !== null },
    { t: "Contrato preparado pela equipe", feito: s?.status === "enviado" || s?.status === "assinado" },
    { t: "Assinaturas", feito: s?.status === "assinado" },
    { t: "Acesso ao portal", feito: false },
  ];
  let titulo = "Estamos preparando o seu contrato.";
  let texto = "Em instantes você recebe no WhatsApp o link para preencher os dados do contrato.";
  if (s?.status === "revisao") { titulo = "Recebemos os seus dados."; texto = "Nossa equipe está preparando o seu contrato. Você recebe no WhatsApp o link para assinar."; }
  if (s?.status === "enviado") { titulo = "Seu contrato está pronto para assinar."; texto = s.assinar ? "Assine pelo botão abaixo (o mesmo link foi enviado no seu WhatsApp)." : "Sua assinatura já foi registrada. Falta a assinatura da equipe do Ecossistema."; }
  if (s?.status === "assinado") { titulo = "Contrato assinado!"; texto = "Seu acesso está sendo liberado."; }

  return (
    <div style={{ minHeight: "100vh", background: "var(--p-bg)", color: "var(--p-text)", textAlign: "left", padding: "28px 16px 60px", boxSizing: "border-box", width: "100%" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <img src="/icone-192.png" alt="" style={{ width: 40, height: 40, borderRadius: 10 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div style={{ fontWeight: 700, flex: 1 }}>Ecossistema Master Business</div>
          <button style={ui.botaoSecundario} onClick={onSair}>Sair</button>
        </div>
        <div style={{ ...ui.cartao, padding: "28px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--p-accent-text)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            {primeiro ? `${primeiro}, falta pouco` : "Falta pouco"}
          </div>
          <h1 style={{ fontSize: 26, lineHeight: 1.2, margin: "8px 0 10px", fontWeight: 700, color: "var(--p-text)", letterSpacing: "-0.01em" }}>{titulo}</h1>
          <p style={{ color: "var(--p-muted)", fontSize: 15.5, lineHeight: 1.55, margin: "0 0 18px" }}>{texto}</p>
          {s?.status === "enviado" && s.assinar && (
            <a className="cta-btn" href={s.assinar} target="_blank" rel="noopener" style={{ ...ui.botao, display: "block", textAlign: "center", textDecoration: "none", marginBottom: 18 }}>Assinar o contrato</a>
          )}
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {passos.map((p, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 15, color: p.feito ? "var(--p-text)" : "var(--p-muted)" }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                  background: p.feito ? "var(--p-accent)" : "var(--p-line)", color: p.feito ? "#fff" : "var(--p-muted)" }}>{p.feito ? "✓" : i + 1}</span>
                {p.t}{i === 2 && s?.assinaturas && s.status === "enviado" ? ` (${s.assinaturas.feitas} de ${s.assinaturas.total})` : ""}
              </li>
            ))}
          </ol>
        </div>
        <p style={{ fontSize: 13, color: "var(--p-muted)", textAlign: "center" }}>O portal é liberado assim que todas as assinaturas forem concluídas.</p>
      </div>
    </div>
  );
}
