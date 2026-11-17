// "Baixar planilha": todas as respostas do onboarding em um arquivo Excel, com as mesmas
// colunas do Google Forms (as 40 perguntas, na mesma ordem). Só administradores conseguem ler esses dados.
import { supabase } from "./supabase";
import { PERGUNTAS } from "./onboardingPerguntas";

const valor = (v: unknown): string | number => {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (typeof v === "number") return v;
  return String(v);
};
const dataBR = (v: unknown) => (v ? new Date(String(v)).toLocaleString("pt-BR", { timeZone: "America/Bahia" }) : "");

export async function baixarPlanilhaOnboarding(): Promise<number> {
  const [{ data: membros, error: e1 }, { data: onb, error: e2 }] = await Promise.all([
    supabase.from("membros").select("*").eq("equipe", false).order("nome"),
    supabase.from("membros_onboarding").select("*"),
  ]);
  if (e1 || e2) throw new Error((e1 || e2)!.message);
  const porMembro = new Map((onb || []).map((o) => [o.membro_id as string, o as Record<string, unknown>]));

  const linhas = (membros || []).map((m: Record<string, unknown>) => {
    const o = porMembro.get(m.id as string) || {};
    const l: Record<string, string | number> = {
      "Carimbo de data/hora": dataBR(o.onboarding_concluido_em),
      "Situação": o.onboarding_concluido_em ? "Concluído" : o.membro_id ? "Em andamento" : "Não iniciado",
      "E-mail": valor(m.email),
      "WhatsApp": valor(m.telefone_whatsapp),
    };
    for (const p of PERGUNTAS) {
      const fonte = p.tabela === "membros" ? m : o;
      let v = valor(fonte[p.campo]);
      if (p.outro && String(v).startsWith("Outro")) v = `${v} ${valor(o[p.outro.campo])}`.trim();
      l[`${p.n}. ${p.texto}`] = v;
    }
    return l;
  });

  const XLSX = await import("xlsx");
  const aba = XLSX.utils.json_to_sheet(linhas);
  aba["!cols"] = Object.keys(linhas[0] || {}).map((k, i) => ({ wch: i < 4 ? 22 : Math.min(Math.max(k.length, 18), 45) }));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, aba, "Respostas");
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Bahia" }).replace(/\//g, "-");
  XLSX.writeFile(livro, `onboarding-ecossistema-${hoje}.xlsx`);
  return linhas.length;
}
