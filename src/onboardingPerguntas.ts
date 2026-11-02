// Perguntas do formulário "Onboarding - Ecossistema Master Business" (Google Forms),
// com o texto e as opções copiados exatamente. Cada pergunta diz onde a resposta é gravada:
//   "membros"   -> public.membros (ficha que já existia; aparece no card/diretório)
//   "onboarding"-> public.membros_onboarding (privado: só o membro e os administradores)

export type TipoPergunta = "curto" | "longo" | "data" | "unica" | "multipla" | "arquivo";

export type Pergunta = {
  n: number;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  tabela: "membros" | "onboarding";
  campo: string;
  opcoes?: string[];
  outro?: { campo: string }; // P9: opção "Outro:" com texto livre
  ajuda?: string;
};

export const TITULO_FORM = "Onboarding - Ecossistema Master Business";
export const DESCRICAO_FORM =
  "Você está aqui por um motivo: Crescer como empresario e elevar os resultados do seu negócio para o próximo nível. Este breve formulário é o combustível para impulsionar sua jornada, extrair mais valor do Ecossistema e acelerar seu crescimento.";
export const DESTAQUE_FORM = "Reserve 5 minutos para responder o formulário com atenção e disciplina.";

export const PERGUNTAS: Pergunta[] = [
  { n: 1, texto: "Nome completo", tipo: "curto", obrigatoria: true, tabela: "membros", campo: "nome" },
  { n: 2, texto: "Nome da empresa", tipo: "curto", obrigatoria: true, tabela: "membros", campo: "empresa" },
  { n: 3, texto: "Segmento de atuação", tipo: "curto", obrigatoria: true, tabela: "membros", campo: "segmento" },
  { n: 4, texto: "Cidade / Estado", tipo: "curto", obrigatoria: true, tabela: "onboarding", campo: "cidade_estado" },
  { n: 5, texto: "Site / Instagram / LinkedIn", tipo: "curto", obrigatoria: true, tabela: "membros", campo: "site_instagram" },
  { n: 6, texto: "Data de fundação da empresa", tipo: "data", obrigatoria: true, tabela: "onboarding", campo: "data_fundacao", ajuda: "Exemplo: 7 de janeiro de 2019" },
  { n: 7, texto: "Principais produto(s)/serviço(s)", tipo: "longo", obrigatoria: true, tabela: "membros", campo: "produtos_servicos" },
  { n: 8, texto: "Modelo de negócio", tipo: "unica", obrigatoria: true, tabela: "membros", campo: "modelo_negocio",
    opcoes: ["Fabricante", "Distribuidor", "Varejo", "Venda Direta", "Franquia / Licenciamento", "Franquia", "Assinatura", "Publicidade"] },
  { n: 9, texto: "Modelo Comercial", tipo: "unica", obrigatoria: true, tabela: "onboarding", campo: "modelo_comercial",
    opcoes: [
      "B2B - Empresa vende para outra empresa.",
      "B2C - Empresa vende diretamente para o consumidor final.",
      "D2C - Fabricante ou marca vende direto ao consumidor final, sem intermediários.",
      "B2G - Empresa vende ou presta serviço diretamente para o governo.",
    ],
    outro: { campo: "modelo_comercial_outro_texto" } },
  { n: 10, texto: "Modelo Comercial (Outros) Especifique", tipo: "curto", obrigatoria: true, tabela: "onboarding", campo: "modelo_comercial_outros" },
  { n: 11, texto: "Faturamento médio mensal atual(R$)", tipo: "curto", obrigatoria: true, tabela: "onboarding", campo: "faturamento_mensal_atual" },
  { n: 12, texto: "Faturamento médio mensal desejado (R$) daqui a 12 meses.", tipo: "curto", obrigatoria: true, tabela: "onboarding", campo: "faturamento_meta_12m" },
  { n: 13, texto: "Tamanho da equipe (fixos + freelancers)", tipo: "curto", obrigatoria: true, tabela: "onboarding", campo: "tamanho_equipe" },
  { n: 14, texto: "Canais de aquisição utilizados", tipo: "multipla", obrigatoria: true, tabela: "onboarding", campo: "canais_aquisicao",
    opcoes: [
      "Trafego Organico", "Trafego Pago", "Anúncios em Mídia Tradicional (TV, Rádio, Outdoor, Jornal)", "Email marketing",
      "Marketing de Indicação", "Feiras/Eventos", "Venda Direta", "Representantes Comerciais / Distribuidores / Franqueados",
      "Rede de Relacionamento / Networking", "Parcerias Estratégicas", "Lojas Físicas / Pontos de Venda (PDV)", "Telemarketing",
      "Correio / Mala Direta / Brindes Corporativos", "Outros (especifique)",
    ] },
  { n: 15, texto: "Canais de aquisição utilizados: (Outros) especifique.", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "canais_aquisicao_outros" },
  { n: 16, texto: "O que está funcionando hoje comercialmente? (melhor canal de aquisição)", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "melhor_canal_hoje" },
  { n: 17, texto: "Principal gargalo de crescimento hoje?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "principal_gargalo" },
  { n: 18, texto: "3 maiores avanços nos últimos 12 meses", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "avancos_12m" },
  { n: 19, texto: "Visão da sua empresa daqui a 5 anos?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "visao_5anos" },
  { n: 20, texto: "Faturamento desejado em 5 anos (R$)", tipo: "curto", obrigatoria: true, tabela: "onboarding", campo: "faturamento_meta_5anos" },
  { n: 21, texto: "Como se vê dentro da empresa daqui a 5 anos?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "papel_5anos" },
  { n: 22, texto: "Legado ou impacto que deseja deixar? Missão da sua empresa?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "legado_missao" },
  { n: 23, texto: "3 principais desafios do seu negócio no momento?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "desafios_atuais" },
  { n: 24, texto: "Áreas que mais precisa de apoio? (3 opções)", tipo: "multipla", obrigatoria: true, tabela: "onboarding", campo: "areas_apoio",
    opcoes: ["Marketing", "Vendas", "Gestão", "Liderança", "Finanças", "Branding", "Operações", "Outro (especifique)"] },
  { n: 25, texto: "Áreas que mais precisam de apoio: Outro (especifique)", tipo: "longo", obrigatoria: false, tabela: "onboarding", campo: "areas_apoio_outro" },
  { n: 26, texto: "Decisões estratégicas pendentes? Quais?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "decisoes_pendentes" },
  { n: 27, texto: "Você já tem um planejamento estratégico anual?", tipo: "multipla", obrigatoria: true, tabela: "onboarding", campo: "planejamento_anual",
    opcoes: ["Sim", "Parcialmente", "Não"] },
  { n: 28, texto: "Perfil de Gestão e Estilo de Liderança", tipo: "unica", obrigatoria: true, tabela: "onboarding", campo: "perfil_gestao",
    opcoes: ["Visionário", "Integrador", "Executor", "Técnico"] },
  { n: 29, texto: "Maior ponto forte como empresário", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "ponto_forte" },
  { n: 30, texto: "Maior limitação como empresário hoje", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "maior_limitacao" },
  { n: 31, texto: "Já participou de outros grupos/mentorias? Quais?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "grupos_mentorias" },
  { n: 32, texto: "O que te motivou a entrar no Ecossistema?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "motivacao_entrada" },
  { n: 33, texto: "O que espera alcançar com sua participação?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "expectativas" },
  { n: 34, texto: "Que tipo de conexões ou trocas busca com outros membros?", tipo: "longo", obrigatoria: true, tabela: "membros", campo: "conexoes_buscadas" },
  { n: 35, texto: "Como pode contribuir ativamente com o grupo?", tipo: "longo", obrigatoria: true, tabela: "membros", campo: "como_pode_contribuir" },
  { n: 36, texto: "Comentários ou observações adicionais?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "comentarios" },
  { n: 37, texto: "Gosta ou pratica algum esporte? Qual?", tipo: "longo", obrigatoria: true, tabela: "onboarding", campo: "esporte" },
  { n: 38, texto: "Tem algum hobby? Qual?", tipo: "curto", obrigatoria: true, tabela: "onboarding", campo: "hobby" },
  { n: 39, texto: "Para te apresentar ao grupo à altura que você merece, nos forneça uma imagem de boa qualidade e olhando para câmera, para ser usado no card de apresentação.",
    tipo: "arquivo", obrigatoria: true, tabela: "membros", campo: "foto_url" },
  { n: 40, texto: "Faça o upload da logo de sua empresa", tipo: "arquivo", obrigatoria: true, tabela: "membros", campo: "logo_url" },
];

// Etapas da tela (a ordem das perguntas é a mesma do formulário).
export const ETAPAS: { titulo: string; de: number; ate: number }[] = [
  { titulo: "Você e sua empresa", de: 1, ate: 8 },
  { titulo: "Modelo comercial e números", de: 9, ate: 13 },
  { titulo: "Aquisição de clientes", de: 14, ate: 17 },
  { titulo: "Visão de futuro", de: 18, ate: 23 },
  { titulo: "Necessidades e gestão", de: 24, ate: 28 },
  { titulo: "Você como empresário", de: 29, ate: 31 },
  { titulo: "Você no Ecossistema", de: 32, ate: 36 },
  { titulo: "Um pouco mais sobre você", de: 37, ate: 38 },
  { titulo: "Foto e logo", de: 39, ate: 40 },
];

export const CAMPOS_MEMBROS = PERGUNTAS.filter((p) => p.tabela === "membros").map((p) => p.campo);
export const CAMPOS_ONBOARDING = PERGUNTAS.filter((p) => p.tabela === "onboarding")
  .flatMap((p) => (p.outro ? [p.campo, p.outro.campo] : [p.campo]));

export type Respostas = Record<string, string | string[] | null>;

// Valor gravado quando o membro marca "Outro:" na P9 (o texto vai em modelo_comercial_outro_texto).
export const OPCAO_OUTRO = "Outro:";

// Resposta preenchida? (regra igual à do banco em concluir_onboarding)
export function respondida(p: Pergunta, r: Respostas): boolean {
  const v = r[p.campo];
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v !== "string" || v.trim() === "") return false;
  if (p.outro && v === OPCAO_OUTRO) return ((r[p.outro.campo] as string) || "").trim() !== "";
  return true;
}

// Formata uma resposta para exibição (aba do membro e administrador).
export function formatarResposta(p: Pergunta, r: Respostas): string {
  const v = r[p.campo];
  if (p.tipo === "data" && typeof v === "string" && v) {
    const [a, m, d] = v.split("-");
    return `${d}/${m}/${a}`;
  }
  if (Array.isArray(v)) return v.join(" · ");
  if (p.outro && v === OPCAO_OUTRO) return `Outro: ${(r[p.outro.campo] as string) || ""}`;
  return (v as string) || "";
}
