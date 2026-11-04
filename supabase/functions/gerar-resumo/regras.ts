// Regras do resumo do perfil gerado por IA (sem dependências: testável fora do Supabase).
//
// O QUE A IA RECEBE: só perguntas sem dados sensíveis.
// NUNCA vão para a IA: faturamento atual (P11), meta 12 meses (P12), meta 5 anos (P20),
// maior limitação (P30), gargalo (P17), desafios (P23), decisões pendentes (P26),
// planejamento anual (P27), comentários (P36), tamanho da equipe (P13), outras mentorias (P31).

export type Fonte = Record<string, unknown>;

export const PERMITIDAS: { campo: string; rotulo: string }[] = [
  { campo: "nome", rotulo: "Nome do empresário" },
  { campo: "empresa", rotulo: "Empresa" },
  { campo: "segmento", rotulo: "Segmento de atuação" },
  { campo: "cidade_estado", rotulo: "Cidade / Estado" },
  { campo: "site_instagram", rotulo: "Site / Instagram / LinkedIn" },
  { campo: "ano_fundacao", rotulo: "Ano de fundação" },
  { campo: "produtos_servicos", rotulo: "Principais produtos/serviços" },
  { campo: "modelo_negocio", rotulo: "Modelo de negócio" },
  { campo: "modelo_comercial_txt", rotulo: "Modelo comercial" },
  { campo: "canais_aquisicao_txt", rotulo: "Canais de aquisição" },
  { campo: "melhor_canal_hoje", rotulo: "O que funciona hoje comercialmente" },
  { campo: "avancos_12m", rotulo: "Maiores avanços nos últimos 12 meses" },
  { campo: "visao_5anos", rotulo: "Visão da empresa em 5 anos" },
  { campo: "papel_5anos", rotulo: "Como se vê na empresa em 5 anos" },
  { campo: "legado_missao", rotulo: "Legado / missão" },
  { campo: "areas_apoio_txt", rotulo: "Áreas em que busca apoio" },
  { campo: "perfil_gestao", rotulo: "Perfil de gestão" },
  { campo: "ponto_forte", rotulo: "Maior ponto forte como empresário" },
  { campo: "motivacao_entrada", rotulo: "O que motivou a entrar no Ecossistema" },
  { campo: "expectativas", rotulo: "O que espera alcançar" },
  { campo: "conexoes_buscadas", rotulo: "Conexões e trocas que busca" },
  { campo: "como_pode_contribuir", rotulo: "Como pode contribuir com o grupo" },
  { campo: "esporte", rotulo: "Esporte" },
  { campo: "hobby", rotulo: "Hobby" },
];

const lista = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : "");
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Monta só os campos permitidos, a partir da ficha (membros) + onboarding.
export function montarEntrada(m: Fonte, o: Fonte): { rotulo: string; valor: string }[] {
  const derivados: Fonte = {
    ...m,
    ...o,
    ano_fundacao: texto(o.data_fundacao).slice(0, 4),
    modelo_comercial_txt: o.modelo_comercial === "Outro:" ? texto(o.modelo_comercial_outro_texto) : texto(o.modelo_comercial),
    canais_aquisicao_txt: lista(o.canais_aquisicao).replace("Outros (especifique)", "").replace(/,\s*$/, ""),
    areas_apoio_txt: [lista(o.areas_apoio).replace("Outro (especifique)", "").replace(/,\s*$/, ""), texto(o.areas_apoio_outro)]
      .filter(Boolean).join(", "),
  };
  return PERMITIDAS.map((p) => ({ rotulo: p.rotulo, valor: texto(derivados[p.campo]) }))
    .filter((x) => x.valor && !/^(-|\.|teste.*)$/i.test(x.valor));
}

export const SISTEMA = `Você escreve o "perfil da empresa" de um membro do Ecossistema Master Business,
uma comunidade de empresários. O texto será lido pelos OUTROS MEMBROS, para gerar conexões e negócios.

REGRAS OBRIGATÓRIAS:
- Use somente as informações fornecidas. Não invente fatos, números, clientes ou prêmios.
- NUNCA mencione faturamento, receita, lucro, metas financeiras, valores em R$, tamanho de equipe ou qualquer número financeiro,
  mesmo que apareça indiretamente nas respostas (por exemplo, na visão de futuro ou nos avanços). Se aparecer, omita.
- NUNCA mencione pontos fracos, limitações, dificuldades, problemas internos ou desafios da empresa ou do empresário.
- "Oportunidades" são oportunidades de conexão e de negócio com outros membros: que tipo de parceiro, cliente ou troca faz sentido
  para essa empresa e onde ela pode gerar valor para o grupo. Escreva de forma positiva.
- Português do Brasil, tom profissional e acolhedor, frases curtas, em terceira pessoa.
- Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato:
{"apresentacao": "2 a 3 frases sobre a empresa e o empresário",
 "o_que_faz": "1 a 2 frases sobre produtos e serviços",
 "pontos_fortes": ["2 a 4 itens curtos"],
 "oportunidades": ["2 a 4 itens curtos de conexão/negócio com outros membros"],
 "como_contribui": "1 frase sobre como pode contribuir com o grupo",
 "interesses": "esporte e hobby em 1 frase curta, ou vazio se não houver"}`;

export function montarPedido(entrada: { rotulo: string; valor: string }[]): string {
  return "Respostas do onboarding (somente as que podem ser usadas):\n\n" +
    entrada.map((x) => `- ${x.rotulo}: ${x.valor}`).join("\n");
}

export type Resumo = {
  apresentacao: string; o_que_faz: string; pontos_fortes: string[]; oportunidades: string[];
  como_contribui: string; interesses: string;
};

// Lê a resposta da IA, garante o formato e aponta qualquer sinal de dado sensível para o administrador revisar.
export function validar(textoIA: string): { resumo: Resumo; alertas: string[] } {
  const bruto = textoIA.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const ini = bruto.indexOf("{"), fim = bruto.lastIndexOf("}");
  if (ini < 0 || fim < ini) throw new Error("A IA não devolveu um JSON");
  const j = JSON.parse(bruto.slice(ini, fim + 1));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 5) : []);
  const resumo: Resumo = {
    apresentacao: str(j.apresentacao), o_que_faz: str(j.o_que_faz),
    pontos_fortes: arr(j.pontos_fortes), oportunidades: arr(j.oportunidades),
    como_contribui: str(j.como_contribui), interesses: str(j.interesses),
  };
  if (!resumo.apresentacao) throw new Error("Resumo sem apresentação");
  return { resumo, alertas: procurarSensiveis(resumo) };
}

const PADROES: [RegExp, string][] = [
  [/R\$\s*\d/i, "valor em R$"],
  [/\b\d+([.,]\d+)?\s*(mil|milh(ão|ões|oes)|bilh|mm|k)\b/i, "valor numérico (mil/milhão)"],
  [/fatura|receita|lucro|ticket m[ée]dio|margem/i, "termo financeiro"],
  [/limita[çc]|ponto fraco|fraqueza|dificuldade|gargalo|problema/i, "possível ponto fraco"],
  [/\b\d+\s*(funcion[áa]rios|colaboradores|pessoas)\b/i, "tamanho de equipe"],
];

export function procurarSensiveis(r: Resumo): string[] {
  const tudo = [r.apresentacao, r.o_que_faz, ...r.pontos_fortes, ...r.oportunidades, r.como_contribui, r.interesses].join("\n");
  return PADROES.filter(([re]) => re.test(tudo)).map(([, nome]) => nome);
}
