// Regras do resumo do perfil gerado por IA (sem dependências: testável fora do Supabase).
//
// É um RESUMO da empresa para outros empresários (o que é, o que oferece, quem atende,
// como fazer negócio com ela). NÃO é diagnóstico: nada de pontos fracos, avaliação ou conselhos.
//
// NUNCA vão para a IA: faturamento atual (P11), meta 12 meses (P12), meta 5 anos (P20),
// maior limitação (P30), gargalo (P17), desafios (P23), decisões pendentes (P26),
// planejamento anual (P27), comentários (P36), tamanho da equipe (P13), outras mentorias (P31),
// perfil de gestão (P28), ponto forte (P29), áreas de apoio (P24), avanços (P18), papel em 5 anos (P21).

export type Fonte = Record<string, unknown>;

export const PERMITIDAS: { campo: string; rotulo: string }[] = [
  { campo: "nome", rotulo: "Nome do empresário" },
  { campo: "empresa", rotulo: "Empresa" },
  { campo: "segmento", rotulo: "Segmento de atuação" },
  { campo: "cidade_estado", rotulo: "Cidade / Estado" },
  { campo: "ano_fundacao", rotulo: "Ano de fundação" },
  { campo: "produtos_servicos", rotulo: "Principais produtos/serviços" },
  { campo: "modelo_negocio", rotulo: "Modelo de negócio" },
  { campo: "modelo_comercial_txt", rotulo: "Para quem vende (modelo comercial)" },
  { campo: "modelo_comercial_outros", rotulo: "Detalhe do modelo comercial" },
  { campo: "canais_aquisicao_txt", rotulo: "Como chega aos clientes" },
  { campo: "melhor_canal_hoje", rotulo: "Canal que mais traz clientes" },
  { campo: "visao_5anos", rotulo: "Visão da empresa em 5 anos" },
  { campo: "legado_missao", rotulo: "Legado / missão" },
  { campo: "motivacao_entrada", rotulo: "O que motivou a entrar no Ecossistema" },
  { campo: "expectativas", rotulo: "O que espera do Ecossistema" },
  { campo: "conexoes_buscadas", rotulo: "Conexões e trocas que busca" },
  { campo: "como_pode_contribuir", rotulo: "Como pode contribuir com o grupo" },
  { campo: "esporte", rotulo: "Esporte" },
  { campo: "hobby", rotulo: "Hobby" },
];

const lista = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : "");
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const vazio = (s: string) => !s || /^(-|\.|n\/?a|nsa|na|não|nao|nenhum|teste.*)$/i.test(s.trim());

function modeloComercial(o: Fonte): string {
  return o.modelo_comercial === "Outro:" ? texto(o.modelo_comercial_outro_texto) : texto(o.modelo_comercial);
}

// Monta só os campos permitidos, a partir da ficha (membros) + onboarding.
export function montarEntrada(m: Fonte, o: Fonte): { rotulo: string; valor: string }[] {
  const derivados: Fonte = {
    ...m,
    ...o,
    ano_fundacao: texto(o.data_fundacao).slice(0, 4),
    modelo_comercial_txt: modeloComercial(o),
    canais_aquisicao_txt: [lista(o.canais_aquisicao).replace("Outros (especifique)", "").replace(/,\s*$/, ""), texto(o.canais_aquisicao_outros)]
      .filter((x) => !vazio(x)).join(", "),
  };
  return PERMITIDAS.map((p) => ({ rotulo: p.rotulo, valor: texto(derivados[p.campo]) }))
    .filter((x) => !vazio(x.valor));
}

// Fatos rápidos do topo do perfil: vêm direto do cadastro, sem passar pela IA.
export type Fatos = { fundacao: string; local: string; atende: string; segmento: string };

export function montarFatos(m: Fonte, o: Fonte): Fatos {
  const mc = modeloComercial(o);
  const atende = /^B2B/i.test(mc) ? "Empresas (B2B)" : /^B2C/i.test(mc) ? "Consumidor final (B2C)" : /B2B.*B2C|B2C.*B2B/i.test(mc) ? "Empresas e consumidor final" : mc.slice(0, 40);
  const cidade = [texto(m.cidade), texto(m.estado)].filter(Boolean).join(" · ") || texto(o.cidade_estado).slice(0, 40);
  return { fundacao: texto(o.data_fundacao).slice(0, 4), local: cidade, atende, segmento: texto(m.segmento).slice(0, 60) };
}

export const SISTEMA = `Você escreve o RESUMO DA EMPRESA de um membro do Ecossistema Master Business, uma comunidade de empresários.
Quem lê são os OUTROS EMPRESÁRIOS do grupo. Depois de 30 segundos olhando, eles devem pensar:
"eu sei o que essa empresa faz, para quem, e como posso fazer negócio com ela".

ISTO É UM RESUMO, NÃO UM DIAGNÓSTICO:
- Descreva a empresa como ela é. Não avalie, não aconselhe, não aponte pontos fortes ou fracos, não fale de desafios.
- Use somente as informações fornecidas. Não invente clientes, números, prêmios ou serviços.
- Se uma informação não existir nas respostas, devolva o campo vazio ("" ou []).

PROIBIDO (mesmo que apareça nas respostas, inclusive escondido dentro de outra resposta):
- dinheiro: faturamento, receita, lucro, metas financeiras, valores em R$, preços, dívidas, investimentos, números de crescimento;
- a empresa por dentro: tamanho de equipe, limitações, gargalos, dificuldades, desafios, problemas internos, decisões pendentes,
  falta de planejamento, áreas em que precisa de ajuda, mentorias ou grupos de que participa ou participou;
- a pessoa: saúde, família, vida amorosa, religião, política, processos na justiça, conflitos com sócios, clientes ou funcionários,
  momentos difíceis, desabafos, autoavaliações ("sou desorganizado", "tenho dificuldade de...");
- contatos e documentos: telefone, e-mail, endereço, CPF, CNPJ, links;
- qualquer coisa que o empresário provavelmente não gostaria que os outros membros lessem.
Na dúvida, deixe de fora.

ESTILO: português do Brasil, terceira pessoa, direto e positivo. Textos CURTOS: o perfil é visual, não um texto corrido.
Respeite os limites de palavras de cada campo.

Responda APENAS com um JSON válido, sem nada antes ou depois, exatamente neste formato:
{"frase": "o que a empresa é e para quem, em no máximo 16 palavras",
 "sobre": "no máximo 2 frases curtas: desde quando existe, onde, quem lidera",
 "oferece": [{"titulo": "2 a 4 palavras", "descricao": "no máximo 12 palavras"}],
 "clientes": ["2 a 4 perfis de cliente que a empresa atende, 2 a 6 palavras cada"],
 "canais": ["como chega aos clientes, 1 a 3 palavras cada, até 4 itens"],
 "oportunidades": ["3 a 4 formas concretas de outro membro fazer negócio com ela (ser cliente, parceiro, indicar, fornecer), no máximo 12 palavras cada"],
 "busca": ["2 a 3 coisas que busca no grupo, no máximo 8 palavras cada"],
 "contribui": ["2 a 3 formas como contribui com o grupo, no máximo 8 palavras cada"],
 "proposito": "missão ou aonde quer chegar, 1 frase de no máximo 20 palavras, sem números",
 "fora_do_trabalho": ["esportes e hobbies, 1 a 3 palavras cada"]}
"oferece" deve ter de 2 a 5 itens.`;

export function montarPedido(entrada: { rotulo: string; valor: string }[]): string {
  return "Respostas do onboarding (somente as que podem ser usadas):\n\n" +
    entrada.map((x) => `- ${x.rotulo}: ${x.valor}`).join("\n");
}

export type Oferta = { titulo: string; descricao: string };
export type Resumo = {
  versao: 2; fatos: Fatos; frase: string; sobre: string; oferece: Oferta[]; clientes: string[]; canais: string[];
  oportunidades: string[]; busca: string[]; contribui: string[]; proposito: string; fora_do_trabalho: string[];
};

// Segunda checagem: outra leitura da IA, só sobre o resumo PRONTO, procurando qualquer coisa sensível,
// inclusive o que não estiver na lista acima. Se ela achar algo (ou falhar), o resumo fica para revisão.
export const SISTEMA_REVISAO = `Você é o revisor de privacidade do portal do Ecossistema Master Business.
Recebe o resumo da empresa de um membro, que será publicado para TODOS os outros membros do grupo.
Diga se há QUALQUER informação que o empresário provavelmente não gostaria de ver publicada, por exemplo:
dinheiro (faturamento, valores, preços, metas, dívidas, investimentos), tamanho da equipe, problemas, limitações,
desafios ou decisões internas da empresa, autoavaliações negativas, saúde, família, vida pessoal, religião, política,
processos na justiça, conflitos, contatos pessoais (telefone, e-mail, endereço), documentos, ou algo constrangedor.
Também conta como sensível qualquer coisa parecida que não esteja nesta lista.
NÃO é sensível: o que a empresa faz e vende, para quem, cidade, ano de fundação, canais de venda, propósito, o que busca e como contribui no grupo, esportes e hobbies.
Responda APENAS com JSON: {"sensivel": true ou false, "trechos": ["o trecho exato e o motivo, até 3 itens"]}`;

export function lerRevisao(textoIA: string): { sensivel: boolean; trechos: string[] } {
  const b = textoIA.trim();
  const j = JSON.parse(b.slice(b.indexOf("{"), b.lastIndexOf("}") + 1));
  if (typeof j.sensivel !== "boolean") throw new Error("revisão sem resposta clara");
  const trechos = Array.isArray(j.trechos) ? j.trechos.filter((x: unknown) => typeof x === "string").slice(0, 3) : [];
  return { sensivel: j.sensivel, trechos };
}

// Lê a resposta da IA, garante o formato e aponta qualquer sinal de dado sensível para o administrador revisar.
export function validar(textoIA: string, fatos: Fatos): { resumo: Resumo; alertas: string[] } {
  const bruto = textoIA.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const ini = bruto.indexOf("{"), fim = bruto.lastIndexOf("}");
  if (ini < 0 || fim < ini) throw new Error("A IA não devolveu um JSON");
  const j = JSON.parse(bruto.slice(ini, fim + 1));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown, max = 5) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : []);
  const oferece = (Array.isArray(j.oferece) ? j.oferece : [])
    .map((x: { titulo?: unknown; descricao?: unknown }) => ({ titulo: str(x?.titulo), descricao: str(x?.descricao) }))
    .filter((x: Oferta) => x.titulo).slice(0, 5);
  const resumo: Resumo = {
    versao: 2, fatos, frase: str(j.frase), sobre: str(j.sobre), oferece,
    clientes: arr(j.clientes, 4), canais: arr(j.canais, 4), oportunidades: arr(j.oportunidades, 4),
    busca: arr(j.busca, 3), contribui: arr(j.contribui, 3), proposito: str(j.proposito), fora_do_trabalho: arr(j.fora_do_trabalho, 5),
  };
  if (!resumo.frase) throw new Error("Resumo sem a frase principal");
  return { resumo, alertas: procurarSensiveis(resumo) };
}

const PADROES: [RegExp, string][] = [
  [/R\$\s*\d|\d\s*reais\b/i, "valor em R$"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, "e-mail"],
  [/\(?\b\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/, "telefone"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/, "CPF/CNPJ"],
  [/d[íi]vida|endividad|empr[ée]stimo|inadimpl|fal[êe]ncia|recupera[çc][ãa]o judicial/i, "dívida ou situação financeira"],
  [/processo judicial|na justi[çc]a|a[çc][ãa]o trabalhista|\bprocessad/i, "processo na justiça"],
  [/doen[çc]a|c[âa]ncer|depress|ansiedade|div[óo]rcio|separa[çc][ãa]o conjugal|\bluto\b|faleceu/i, "saúde ou vida pessoal"],
  [/\b(igreja|evang[ée]lic|cat[óo]lic|esp[íi]rita|partido pol|bolsonar|lula\b|petista)/i, "religião ou política"],
  [/desafio|decis[ãa]o pendente|n[ãa]o tem planejamento|sem planejamento|precisa de (apoio|ajuda)/i, "assunto interno da empresa"],
  [/\b\d+([.,]\d+)?\s*(mil|milh(ão|ões|oes)|bilh|mm|k)\b/i, "valor numérico (mil/milhão)"],
  [/fatura|\blucro|ticket m[ée]dio|margem de lucro/i, "termo financeiro"],
  [/limita[çc]|ponto fraco|fraqueza|dificuldade|gargalo/i, "possível ponto fraco"],
  [/\b\d+\s*(funcion[áa]rios|colaboradores|pessoas)\b/i, "tamanho de equipe"],
];

export function procurarSensiveis(r: Omit<Resumo, "fatos" | "versao">): string[] {
  const { fatos: _f, versao: _v, ...resto } = r as Resumo;
  const tudo = JSON.stringify(resto);
  return PADROES.filter(([re]) => re.test(tudo)).map(([, nome]) => nome);
}
