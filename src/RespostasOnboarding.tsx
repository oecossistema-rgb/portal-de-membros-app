import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";
import { PERGUNTAS, ETAPAS, CAMPOS_MEMBROS, CAMPOS_ONBOARDING } from "./onboardingPerguntas";
import type { Respostas } from "./onboardingPerguntas";
import { LinhaResposta } from "./Onboarding";

// Mostra as 40 respostas do onboarding de um membro.
// Membro comum só consegue ler as próprias; administrador lê de todos (regras do banco).
export default function RespostasOnboarding({ membroId, atualizar = 0 }: { membroId: string; atualizar?: number }) {
  const [resp, setResp] = useState<Respostas | null>(null);
  const [concluidoEm, setConcluidoEm] = useState<string | null>(null);
  const [iniciado, setIniciado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const [{ data: m }, { data: o }] = await Promise.all([
        supabase.from("membros").select(CAMPOS_MEMBROS.join(",")).eq("id", membroId).maybeSingle(),
        supabase.from("membros_onboarding").select([...CAMPOS_ONBOARDING, "onboarding_concluido_em"].join(",")).eq("membro_id", membroId).maybeSingle(),
      ]);
      const onb = (o || {}) as unknown as Record<string, string | string[] | null>;
      setIniciado(!!o);
      setConcluidoEm((onb.onboarding_concluido_em as string) || null);
      setResp({ ...((m || {}) as unknown as Respostas), ...onb });
      setCarregando(false);
    })();
  }, [membroId, atualizar]);

  if (carregando || !resp) return <div style={ui.aviso}>Carregando respostas...</div>;

  const status = concluidoEm
    ? { texto: `Onboarding concluído em ${new Date(concluidoEm).toLocaleDateString("pt-BR")}`, cor: "#4A6118", fundo: "#E8F0D8" }
    : iniciado
      ? { texto: "Onboarding em andamento (ainda não enviado)", cor: "#8A6D1A", fundo: "#FBF3DC" }
      : { texto: "Onboarding ainda não iniciado", cor: "#45505F", fundo: "#EAECEF" };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: status.cor, background: status.fundo, borderRadius: 100, padding: "5px 12px", marginBottom: 12 }}>
        {status.texto}
      </div>
      {ETAPAS.map((e) => (
        <div key={e.titulo} style={{ borderTop: "1px solid #1B2A23", padding: "12px 0" }}>
          <div style={{ fontWeight: 800, color: "#E9F0EC", marginBottom: 4 }}>{e.titulo}</div>
          {PERGUNTAS.filter((p) => p.n >= e.de && p.n <= e.ate).map((p) => (
            <LinhaResposta key={p.n} p={p} resp={resp} />
          ))}
        </div>
      ))}
    </div>
  );
}
