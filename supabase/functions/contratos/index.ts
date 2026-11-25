// Função "contratos": contrato do membro NOVO, do formulário até as assinaturas na Autentique (23/11/2026).
//
// Público (sem login, só com o link que o membro recebeu no WhatsApp):
//   { acao: "formulario", token }          -> dados básicos para abrir o formulário
//   { acao: "responder", token, dados }    -> guarda as respostas, gera o contrato do modelo e manda para revisão
// Administradores (login):
//   { acao: "convidar", membro_id, socio? } -> cria o contrato e envia no WhatsApp o link do formulário
//   { acao: "reenviar_link", id }          -> manda o link do formulário de novo
//   { acao: "regerar", id }                -> refaz o texto a partir do modelo (descarta edições)
//   { acao: "enviar", id, teste? }         -> PDF + Autentique; cada assinante recebe o link pelo WhatsApp
//   { acao: "reenviar_assinatura", id }    -> manda de novo os links de assinatura de quem ainda não assinou
//   { acao: "verificar", id }              -> consulta as assinaturas agora
//   { acao: "cancelar", id }               -> cancela (e tira o documento da Autentique, se já tiver ido)
// Banco (cabeçalho x-portal-interno):
//   { varredura: true }                    -> a cada 10 min: confere assinaturas e reenvia ao Google Forms o que faltou
//   { acao: "importar_modelo", id }        -> monta o texto-modelo a partir de um contrato padrão já assinado na Autentique
//   (e qualquer ação de administrador acima, para testes da equipe; o banco chama "convidar" quando o membro novo cria a senha)
// Membro novo logado: { acao: "meu_contrato" } -> em que passo está o contrato (tela de contrato em andamento)
// Avisos no grupo "GESTÃO DE CONTRATO": contrato gerado (para revisar/enviar) e contrato assinado por todos.
// Quando TODOS assinam: guarda o PDF assinado e dispara a mensagem de boas-vindas que já existe (cartão de membro).
// Segredos: AUTENTIQUE_TOKEN, ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN. Nenhum dado de membro fica no código.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, PDFFont, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-interno" };
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const PORTAL = "https://portal.oecossistemabusiness.com";
const GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdjNoYX4JlZ10yqYnlXODxC4TyYLkrwEuVKyttkBXejgcRa9A/formResponse";

type Participante = {
  nome: string; whatsapp: string; email: string; nacionalidade: string; estado_civil: string; profissao: string;
  rg: string; orgao_emissor: string; documento: string; endereco: string; cidade: string; estado: string; cep: string;
};
type Dados = { participantes: Participante[]; pagamento: "avista" | "cartao" | "boleto"; dia_boleto?: string };
type Assinatura = { nome: string; email?: string | null; papel: string; link: string | null; public_id: string; assinado_em: string | null; recusado_em: string | null; avisado: boolean };
// deno-lint-ignore no-explicit-any
type Reg = Record<string, any>;

const PAGAMENTOS: Record<string, string> = {
  avista: "R$28.000 à vista",
  cartao: "12x de R$ 3.084,45 (Cartão de crédito)",
  boleto: "R$8.000 (Adesão) + 12x de R$1.835,00 (Boleto)",
};

// ---------- utilidades ----------
const primeiro = (n: string) => { const p = (n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
export function telefoneZapi(bruto: string): string {
  const d = (bruto || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}
async function zapiTexto(telefone: string, message: string): Promise<{ ok: boolean; erro?: string }> {
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!inst || !tok || !cli) return { ok: false, erro: "credenciais da Z-API não configuradas" };
  const phone = telefoneZapi(telefone);
  if (phone.length < 12) return { ok: false, erro: "sem WhatsApp válido" };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/send-text`, {
      method: "POST", headers: { "Content-Type": "application/json", "Client-Token": cli }, body: JSON.stringify({ phone, message }),
    });
    return r.ok ? { ok: true } : { ok: false, erro: `Z-API ${r.status}` };
  } catch (e) { return { ok: false, erro: e instanceof Error ? e.message : String(e) }; }
}
// Avisos para o grupo de WhatsApp da equipe "GESTÃO DE CONTRATO" (o id do grupo fica em portal_config.contrato_grupo_whatsapp).
async function avisarGrupo(texto: string): Promise<{ ok: boolean; erro?: string }> {
  const { data } = await db.from("portal_config").select("valor").eq("chave", "contrato_grupo_whatsapp").maybeSingle();
  const grupo = (data?.valor || "").trim();
  if (!grupo) return { ok: false, erro: "grupo não configurado" };
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!inst || !tok || !cli) return { ok: false, erro: "credenciais da Z-API não configuradas" };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/send-text`, {
      method: "POST", headers: { "Content-Type": "application/json", "Client-Token": cli }, body: JSON.stringify({ phone: grupo, message: texto }),
    });
    if (!r.ok) console.error("aviso ao grupo", r.status, (await r.text()).slice(0, 200));
    return r.ok ? { ok: true } : { ok: false, erro: `Z-API ${r.status}` };
  } catch (e) { return { ok: false, erro: e instanceof Error ? e.message : String(e) }; }
}
const PAGAMENTO_CURTO: Record<string, string> = { avista: "R$ 28.000 à vista", cartao: "12x de R$ 3.084,45 no cartão", boleto: "R$ 8.000 de adesão + 12x de R$ 1.835 no boleto" };

const dataExtenso = (d = new Date()) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", day: "numeric", month: "long", year: "numeric" }).format(d);

// ---------- Autentique ----------
async function gql(query: string, variables: Reg = {}): Promise<Reg> {
  const tok = Deno.env.get("AUTENTIQUE_TOKEN");
  if (!tok) throw new Error("AUTENTIQUE_TOKEN não cadastrado");
  const r = await fetch("https://api.autentique.com.br/v2/graphql", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ query, variables }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.errors?.length) throw new Error(`Autentique: ${j.errors.map((e: Reg) => e.message).join("; ")}`);
  return j.data || {};
}
async function criarDocumento(nome: string, pdf: Uint8Array, signers: Reg[], teste: boolean): Promise<Reg> {
  const tok = Deno.env.get("AUTENTIQUE_TOKEN");
  if (!tok) throw new Error("AUTENTIQUE_TOKEN não cadastrado");
  const query = `mutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument(sandbox: ${teste ? "true" : "false"}, document: $document, signers: $signers, file: $file) {
      id name signatures { public_id name email action { name } link { short_link } }
    } }`;
  const fd = new FormData();
  fd.append("operations", JSON.stringify({ query, variables: { document: { name: nome, refusable: true }, signers, file: null } }));
  fd.append("map", JSON.stringify({ file: ["variables.file"] }));
  fd.append("file", new Blob([pdf], { type: "application/pdf" }), "contrato.pdf");
  const r = await fetch("https://api.autentique.com.br/v2/graphql", { method: "POST", headers: { Authorization: `Bearer ${tok}` }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (j.errors?.length || !j.data?.createDocument) throw new Error(`Autentique: ${(j.errors || []).map((e: Reg) => e.message).join("; ") || r.status}`);
  return j.data.createDocument;
}
const consultarDocumento = (id: string) => gql(`query($id: UUID!) { document(id: $id) {
  id files { signed } signatures { public_id name email action { name } link { short_link } signed { created_at } rejected { created_at } } } }`, { id });
// Link de assinatura de quem recebe por e-mail (a Autentique manda o e-mail; o mesmo link vai também pelo WhatsApp).
async function linkDe(publicId: string): Promise<string | null> {
  try { const d = await gql(`mutation { createLinkToSignature(public_id: "${publicId}") { short_link } }`); return d.createLinkToSignature?.short_link || null; }
  catch (e) { console.error("link de assinatura", e); return null; }
}

// ---------- modelo do contrato ----------
// Junta as linhas quebradas do PDF em parágrafos (cada cláusula, item, alínea e linha de assinatura vira um parágrafo).
const INICIO = /^(CLÁUSULA|\d+(\.\d+)*\.\s|[a-j]\)\s|Favorecido:|Banco:|AG:|CC:|CNPJ:|PIX|Salvador, capital|_{5,}|\(CONTRATANTE|ECOSSISTEMA MASTER BUSINESS LTDA$|\(CONTRATADA\)|TESTEMUNHA:|CPF:|De outro lado|Pelo presente|19\.)/;
export function paragrafos(bruto: string): string[] {
  const out: string[] = [];
  for (const l of bruto.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
    if (!out.length || INICIO.test(l)) out.push(l);
    else out[out.length - 1] += " " + l;
  }
  return out;
}
// Do contrato padrão, guarda tudo a partir da CONTRATADA, com marcadores no que muda de um membro para outro.
export function montarModelo(bruto: string): string {
  const ps = paragrafos(bruto.slice(bruto.indexOf("De outro lado")));
  const out: string[] = [];
  for (const p of ps) {
    if (/^5\.1\.\s/.test(p)) out.push("{{CLAUSULA_5_1}}");
    else if (/^6\.1\.\s/.test(p)) out.push("{{PAGAMENTO}}");
    else if (/^6\.[234]\.\s/.test(p)) continue; // fazem parte do bloco de pagamento
    else if (/^Salvador, capital/.test(p)) out.push("Salvador, capital da Bahia, {{DATA}}.");
    else out.push(p);
  }
  return out.join("\n\n");
}

function cabecalho(ps: Participante[]): string {
  const bloco = (p: Participante) => [
    `Nome Completo: ${p.nome}`, `Contato: ${p.whatsapp}`, `E-mail: ${p.email}`, `Nacionalidade: ${p.nacionalidade}`,
    `Estado Civil: ${p.estado_civil}`, `Profissão/Ocupação: ${p.profissao}`, `CPF/ME: ${p.documento}`, `RG/Identidade: ${p.rg}`,
    `Órgão Emissor: ${p.orgao_emissor}`, `Endereço: ${p.endereco}${p.cep ? `, CEP ${p.cep}` : ""}`, `Cidade: ${p.cidade}`, `Estado: ${p.estado}`,
  ].join("\n");
  const partes = ["CONTRATO DE ADESÃO À COMUNIDADE EMPRESARIAL PRIVADA\nECOSSISTEMA MASTER BUSINESS", "De um lado PARTICIPANTE / CONTRATANTE:"];
  if (ps.length > 1) ps.forEach((p, i) => { partes.push(`${i + 1}º PARTICIPANTE`); partes.push(bloco(p)); });
  else partes.push(bloco(ps[0]));
  return partes.join("\n\n");
}

const DIAS: Record<string, string> = { "05": "5 (cinco)", "10": "10 (dez)", "15": "15 (quinze)" };
function pagamento(d: Dados): { c51: string; bloco: string } {
  const c63 = "6.3. O pagamento da Taxa de adesão garantirá o ingresso de até 2 (dois) PARTICIPANTES, desde que sejam sócios da mesma empresa ou casal.";
  if (d.pagamento === "avista") return {
    c51: "5.1. A remuneração pelo acesso ao ECOSSISTEMA na modalidade EXCLUSIVE se dará através do pagamento do valor total de R$ 28.000,00 (vinte e oito mil reais), pago à vista.",
    bloco: [
      "6.1. O PARTICIPANTE pagará para a CONTRATADA o valor total de R$ 28.000,00 (vinte e oito mil reais), à vista, via transferência bancária (pix), cartão de crédito ou boleto disponibilizado pela CONTRATADA, quitando de uma só vez a taxa de adesão e o valor residual.",
      "6.2. Por se tratar de pagamento à vista, não haverá parcelas a pagar.",
      c63,
      "6.4. Embora a adesão permita duas cadeiras, o valor deste contrato deverá ser pago individualmente por cada PARTICIPANTE, nos termos desta cláusula.",
    ].join("\n\n"),
  };
  if (d.pagamento === "cartao") return {
    c51: "5.1. A remuneração pelo acesso ao ECOSSISTEMA na modalidade EXCLUSIVE se dará através do pagamento do valor total de R$ 28.000,00 (vinte e oito mil reais), que poderá ser parcelado no cartão de crédito.",
    bloco: [
      "6.1. O PARTICIPANTE pagará para a CONTRATADA o valor total de R$ 28.000,00 (vinte e oito mil reais) em 12 (doze) parcelas de R$ 3.084,45 (três mil e oitenta e quatro reais e quarenta e cinco centavos) no cartão de crédito.",
      "6.2. Os juros cobrados pela operadora do cartão de crédito pelo parcelamento são de responsabilidade do PARTICIPANTE e já estão incluídos no valor das parcelas descrito no item 6.1.",
      c63,
      "6.4. Embora a adesão permita duas cadeiras, o valor deste contrato deverá ser pago individualmente por cada PARTICIPANTE, nos termos desta cláusula.",
    ].join("\n\n"),
  };
  const dia = DIAS[d.dia_boleto || ""] || "";
  return {
    c51: "5.1. A remuneração pelo acesso ao ECOSSISTEMA na modalidade EXCLUSIVE se dará através do pagamento do valor total de R$ 30.020,00 (trinta mil e vinte reais), que serão pagos através de uma taxa de adesão, mais parcelamento.",
    bloco: [
      "6.1. O PARTICIPANTE pagará para a CONTRATADA a título de taxa de adesão o valor de R$ 8.000,00 (oito mil reais), via transferência bancária (pix), cartão de crédito ou boleto disponibilizado pela CONTRATADA.",
      `6.2. O valor residual de R$ 22.020,00 (vinte e dois mil e vinte reais) poderá ser pago em até 12 parcelas iguais e sucessivas no valor de R$ 1.835,00 (um mil oitocentos e trinta e cinco reais), por boleto${dia ? `, com vencimento no dia ${dia} de cada mês` : ""}.`,
      c63,
      "6.4. Embora a adesão permita duas cadeiras, o valor residual de R$ 22.020,00 (vinte e dois mil e vinte reais) deverá ser pago individualmente por cada PARTICIPANTE, nos termos desta cláusula.",
    ].join("\n\n"),
  };
}

export function gerarTexto(modelo: string, d: Dados): string {
  const p = pagamento(d);
  const corpo = modelo.replace("{{CLAUSULA_5_1}}", p.c51).replace("{{PAGAMENTO}}", p.bloco).replace("{{DATA}}", dataExtenso());
  return `${cabecalho(d.participantes)}\n\n${corpo}`;
}

// ---------- PDF ----------
export async function gerarPdf(texto: string, titulo: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica), negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cache = new Map<string, boolean>();
  const limpa = (s: string, f: PDFFont) => [...s.replace(/\t/g, " ")].map((ch) => {
    if (ch === "\n") return ch; // quebra de linha é tratada na hora de montar as linhas
    if (!cache.has(ch)) { try { f.encodeText(ch); cache.set(ch, true); } catch { cache.set(ch, false); } }
    return cache.get(ch) ? ch : ch === "‑" ? "-" : "";
  }).join("");
  const A4: [number, number] = [595.28, 841.89], M = 62, LARG = A4[0] - 2 * M, TAM = 10.5, LH = 14.6;
  let pag = pdf.addPage(A4), y = A4[1] - M;
  const nova = () => { pag = pdf.addPage(A4); y = A4[1] - M; };
  const linhas = (t: string, f: PDFFont, tam: number) => {
    const out: string[] = [];
    for (const bruta of t.split("\n")) {
      let atual = "";
      for (const w of bruta.split(/\s+/).filter(Boolean)) {
        const teste = atual ? `${atual} ${w}` : w;
        if (f.widthOfTextAtSize(teste, tam) > LARG && atual) { out.push(atual); atual = w; } else atual = teste;
      }
      out.push(atual);
    }
    return out;
  };
  const blocos = texto.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  blocos.forEach((b, i) => {
    const titulo = i === 0;
    const forte = titulo || /^CLÁUSULA/.test(b) || /^(\dº PARTICIPANTE|De um lado|De outro lado a CONTRATADA:)/.test(b);
    const f = forte ? negrito : fonte, tam = titulo ? 12.5 : TAM;
    const ls = linhas(limpa(b, f), f, tam);
    if (/^CLÁUSULA/.test(b) && y - LH * (ls.length + 2) < M) nova(); // título de cláusula não fica sozinho no pé da página
    for (const l of ls) {
      if (y < M + LH) nova();
      const w = f.widthOfTextAtSize(l, tam);
      pag.drawText(l, { x: titulo ? (A4[0] - w) / 2 : M, y, size: tam, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= titulo ? LH * 1.25 : LH;
    }
    y -= titulo ? LH : LH * 0.55;
  });
  const n = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => p.drawText(`${i + 1}/${n}`, { x: A4[0] - M - 20, y: 30, size: 8, font: fonte, color: rgb(0.5, 0.5, 0.5) }));
  return await pdf.save();
}

// ---------- Google Forms (mesma planilha de sempre) ----------
async function espelharGoogle(d: Dados): Promise<{ ok: boolean; erro?: string }> {
  try {
    for (const p of d.participantes) {
      const f = new URLSearchParams({
        emailAddress: p.email, "entry.692920242": p.nome, "entry.1154968108": p.whatsapp, "entry.1278937806": p.email,
        "entry.1838407065": p.estado_civil, "entry.1162731604": p.profissao, "entry.1689548781": [p.rg, p.orgao_emissor].filter(Boolean).join(" - "),
        "entry.851467681": p.documento, "entry.84396485": [p.endereco, `${p.cidade} - ${p.estado}`, p.nacionalidade ? `Nacionalidade: ${p.nacionalidade}` : ""].filter(Boolean).join("\n"),
        "entry.191929612": p.cep, "entry.1607657276": PAGAMENTOS[d.pagamento],
      });
      if (d.pagamento === "boleto" && d.dia_boleto) f.set("entry.50116861", `Dia ${d.dia_boleto} de cada mês`);
      const r = await fetch(GOOGLE_FORM, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: f });
      if (!r.ok) return { ok: false, erro: `Google Forms ${r.status}` };
    }
    return { ok: true };
  } catch (e) { return { ok: false, erro: e instanceof Error ? e.message : String(e) }; }
}

// ---------- validação do formulário ----------
const CAMPOS: (keyof Participante)[] = ["nome", "whatsapp", "email", "nacionalidade", "estado_civil", "profissao", "rg", "orgao_emissor", "documento", "endereco", "cidade", "estado", "cep"];
function validar(bruto: Reg): { dados?: Dados; erro?: string } {
  const ps = Array.isArray(bruto?.participantes) ? bruto.participantes : [];
  if (ps.length < 1 || ps.length > 2) return { erro: "participantes inválidos" };
  const participantes: Participante[] = [];
  for (const p of ps.slice(0, 2)) {
    const x = {} as Participante;
    for (const c of CAMPOS) {
      const v = String(p?.[c] ?? "").trim().slice(0, 300);
      if (!v) return { erro: `preencha todos os campos (${c})` };
      x[c] = v;
    }
    if (!/^\S+@\S+\.\S+$/.test(x.email)) return { erro: "e-mail inválido" };
    if (x.documento.replace(/\D/g, "").length < 11) return { erro: "CPF ou CNPJ inválido" };
    participantes.push(x);
  }
  const pg = String(bruto?.pagamento || "");
  if (!["avista", "cartao", "boleto"].includes(pg)) return { erro: "escolha a forma de pagamento" };
  const dia = String(bruto?.dia_boleto || "");
  if (pg === "boleto" && !["05", "10", "15"].includes(dia)) return { erro: "escolha a melhor data do boleto" };
  return { dados: { participantes, pagamento: pg as Dados["pagamento"], ...(pg === "boleto" ? { dia_boleto: dia } : {}) } };
}

// ---------- ações ----------
async function modelo(): Promise<string> {
  const { data } = await db.from("portal_config").select("valor").eq("chave", "contrato_modelo").maybeSingle();
  if (!data?.valor) throw new Error("modelo do contrato ainda não cadastrado");
  return data.valor;
}
async function membro(id: string): Promise<Reg | null> {
  const { data } = await db.from("membros").select("id, nome, email, telefone_whatsapp, ativo").eq("id", id).maybeSingle();
  return data;
}
const linkFormulario = (token: string) => `${PORTAL}/#contrato/${token}`;

async function enviarConvite(c: Reg): Promise<{ ok: boolean; erro?: string }> {
  const m = await membro(c.membro_id);
  if (!m?.telefone_whatsapp) return { ok: false, erro: "membro sem WhatsApp no cadastro" };
  const p = primeiro(m.nome);
  const msg = `*Bem-vindo(a) ao Ecossistema Master Business${p ? `, ${p}` : ""}!* 🎉\n\n` +
    `O próximo passo é o seu contrato. Preencha seus dados neste link (leva poucos minutos):\n${linkFormulario(c.token)}\n\n` +
    `Com os dados em mãos, nossa equipe prepara o contrato e você recebe o link para assinar. Depois das assinaturas, seu acesso ao portal é liberado.`;
  const r = await zapiTexto(m.telefone_whatsapp, msg);
  await db.from("contratos").update(r.ok ? { formulario_enviado_em: new Date().toISOString(), whatsapp_erro: null } : { whatsapp_erro: r.erro }).eq("id", c.id);
  return r;
}

async function equipeAssinantes(): Promise<{ nome: string; acao: string; papel: string; whatsapp: string | null; email: string | null }[]> {
  const { data } = await db.from("portal_config").select("valor").eq("chave", "contrato_assinantes").maybeSingle();
  const lista: { nome: string; acao: string; papel: string }[] = JSON.parse(data?.valor || "[]");
  const out = [];
  for (const a of lista) {
    const { data: m } = await db.from("membros").select("telefone_whatsapp, email").ilike("nome", a.nome).limit(1).maybeSingle();
    out.push({ ...a, whatsapp: m?.telefone_whatsapp || null, email: (a as Reg).email || m?.email || null });
  }
  return out;
}

async function avisarAssinantes(c: Reg, assinaturas: Assinatura[]): Promise<Assinatura[]> {
  const d = c.dados as Dados;
  const equipe = await equipeAssinantes();
  const nomeMembro = d.participantes.map((p) => p.nome).join(" e ");
  for (const a of assinaturas) {
    if (!a.link || a.assinado_em) continue;
    const mesmo = (n?: string | null, e?: string | null) => (!!a.email && !!e && a.email.toLowerCase() === e.toLowerCase()) || (!!a.nome && a.nome === n);
    const part = d.participantes.find((p) => mesmo(p.nome, p.email));
    const eq = equipe.find((e) => mesmo(e.nome, e.email));
    const fone = part?.whatsapp || eq?.whatsapp;
    if (!fone) continue;
    const msg = part
      ? `*Seu contrato do Ecossistema Master Business está pronto.* ✍️\n\n${primeiro(part.nome)}, é só assinar por este link (também enviamos para o seu e-mail):\n${a.link}\n\nAssim que todas as assinaturas forem concluídas, você recebe o acesso ao portal.`
      : `*Contrato para assinar* ✍️\n\n${nomeMembro} · Ecossistema Master Business\nSua assinatura (${a.papel.toLowerCase()}):\n${a.link}\n\n(O link também foi para o seu e-mail.)`;
    const r = await zapiTexto(fone, msg);
    a.avisado = a.avisado || r.ok;
  }
  return assinaturas;
}

async function enviarAutentique(c: Reg, teste: boolean): Promise<Reg> {
  if (!c.texto || !c.dados) throw new Error("contrato ainda sem dados do formulário");
  const d = c.dados as Dados;
  const titulo = `${d.participantes.map((p) => p.nome).join(" & ")} - CONTRATO DE ECOSSISTEMA MASTER BUSINESS${teste ? " (TESTE)" : ""}`;
  const pdf = await gerarPdf(c.texto, titulo);
  const caminho = `${c.membro_id}/${c.id}${teste ? "-teste" : ""}.pdf`;
  await db.storage.from("contratos").upload(caminho, pdf, { contentType: "application/pdf", upsert: true });
  const equipe = await equipeAssinantes();
  // Assinatura pelo e-mail (a Autentique manda o e-mail) e pelo WhatsApp (o portal manda o link). Sem e-mail: só link.
  const signer = (nome: string, email: string | null, acao: string) => (email ? { email: email.toLowerCase(), action: acao } : { name: nome, action: acao });
  const signers = [
    ...d.participantes.map((p) => signer(p.nome, p.email, "SIGN")),
    ...equipe.map((e) => signer(e.nome, e.email, e.acao)),
  ];
  const doc = await criarDocumento(titulo, pdf, signers, teste);
  const pessoas = [...d.participantes.map((p) => ({ nome: p.nome, email: p.email, papel: "Participante" })), ...equipe.map((e) => ({ nome: e.nome, email: e.email, papel: e.papel }))];
  const quem = (s: Reg) => pessoas.find((x) => (s.email && x.email && x.email.toLowerCase() === String(s.email).toLowerCase()) || (s.name && x.nome === s.name));
  let assinaturas: Assinatura[] = [];
  for (const s of (doc.signatures || []).filter((x: Reg) => x.action)) {
    const q = quem(s);
    assinaturas.push({ nome: q?.nome || s.name || s.email, email: s.email || q?.email || null, papel: q?.papel || "Assinante",
      link: s.link?.short_link || await linkDe(s.public_id), public_id: s.public_id, assinado_em: null, recusado_em: null, avisado: false });
  }
  assinaturas = await avisarAssinantes(c, assinaturas);
  const { data } = await db.from("contratos").update({
    status: "enviado", autentique_id: doc.id, autentique_teste: teste, arquivo_path: caminho, assinaturas, enviado_em: new Date().toISOString(), verificado_em: null,
  }).eq("id", c.id).select("*").single();
  return data!;
}

async function verificar(c: Reg): Promise<Reg> {
  if (!c.autentique_id) return c;
  const { document: doc } = await consultarDocumento(c.autentique_id);
  if (!doc) return c;
  const antes: Assinatura[] = c.assinaturas || [];
  const assinaturas: Assinatura[] = (doc.signatures || []).filter((s: Reg) => s.action).map((s: Reg) => {
    const a = antes.find((x) => x.public_id === s.public_id);
    return { nome: a?.nome || s.name || s.email, email: a?.email || s.email || null, papel: a?.papel || "Assinante", link: a?.link || s.link?.short_link || null, public_id: s.public_id,
      assinado_em: s.signed?.created_at || null, recusado_em: s.rejected?.created_at || null, avisado: a?.avisado || false };
  });
  const tudo = assinaturas.length > 0 && assinaturas.every((a) => a.assinado_em);
  const mud: Reg = { assinaturas, verificado_em: new Date().toISOString() };
  if (tudo && c.status !== "assinado") {
    mud.status = "assinado";
    mud.assinado_em = new Date().toISOString();
    if (doc.files?.signed) {
      try {
        const b = new Uint8Array(await (await fetch(doc.files.signed)).arrayBuffer());
        const caminho = `${c.membro_id}/${c.id}-assinado.pdf`;
        await db.storage.from("contratos").upload(caminho, b, { contentType: "application/pdf", upsert: true });
        mud.assinado_path = caminho;
      } catch (e) { console.error("pdf assinado", e); }
    }
  }
  const { data } = await db.from("contratos").update(mud).eq("id", c.id).select("*").single();
  // Todas as assinaturas: libera o portal (agora é membro) e dispara o que já existe: cartão de membro; o onboarding vem no
  // próximo acesso. Teste não dispara.
  if (tudo && !c.autentique_teste) await db.from("membros").update({ contrato_pendente: false }).eq("id", c.membro_id);
  if (tudo && !c.boas_vindas_em && !c.autentique_teste) {
    await avisarGrupo(`✅ *Contrato assinado por todos*\n\n*${(c.dados?.participantes || []).map((p: Participante) => p.nome).join(" e ")}*\nO portal foi liberado e o membro recebeu o cartão de boas-vindas.`);
    const { error } = await db.rpc("contrato_boas_vindas", { p_membro_id: c.membro_id });
    if (!error) await db.from("contratos").update({ boas_vindas_em: new Date().toISOString() }).eq("id", c.id);
    else console.error("boas-vindas", error.message);
  }
  return data || c;
}

async function varredura() {
  const feitos: unknown[] = [];
  const { data: enviados } = await db.from("contratos").select("*").eq("status", "enviado").not("autentique_id", "is", null);
  for (const c of enviados || []) {
    try { const n = await verificar(c); feitos.push({ id: c.id, status: n.status }); } catch (e) { feitos.push({ id: c.id, erro: String(e) }); }
  }
  const { data: semGoogle } = await db.from("contratos").select("id, dados, observacoes").not("dados", "is", null).is("google_enviado_em", null).neq("status", "cancelado").limit(5);
  for (const c of semGoogle || []) {
    if (c.observacoes === "TESTE") continue;
    const g = await espelharGoogle(c.dados);
    await db.from("contratos").update(g.ok ? { google_enviado_em: new Date().toISOString(), google_erro: null } : { google_erro: g.erro }).eq("id", c.id);
  }
  return feitos;
}

async function souAdmin(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: m } = await db.from("membros").select("id, is_admin, ativo").eq("auth_user_id", u.user.id).maybeSingle();
  return m?.ativo && m.is_admin ? m.id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  let c: Reg = {};
  try { c = await req.json(); } catch { /* vazio */ }

  try {
    // ---- interno (banco) ----
    const interno = req.headers.get("x-portal-interno");
    let porBanco = false;
    if (interno) {
      const { data: ok } = await db.rpc("token_interno_valido", { p_token: interno });
      if (ok !== true) return resp(401, { erro: "código interno inválido" });
      if (c.varredura) return resp(200, { feitos: await varredura() });
      if (c.acao === "importar_modelo" && c.id) {
        const { document: d } = await gql("query($id: UUID!) { document(id: $id) { name files { original } } }", { id: c.id });
        const b = new Uint8Array(await (await fetch(d.files.original)).arrayBuffer());
        const { text } = await extractText(await getDocumentProxy(b), { mergePages: false }); // mantém as quebras de linha
        const m = montarModelo((text as string[]).join("\n"));
        await db.from("portal_config").update({ valor: m, atualizado_em: new Date().toISOString() }).eq("chave", "contrato_modelo");
        return resp(200, { ok: true, paragrafos: m.split("\n\n").length, marcadores: (m.match(/\{\{\w+\}\}/g) || []) });
      }
      if (c.acao === "grupos") {
        // Lista os grupos do WhatsApp conectado (só nome e id), para configurar o grupo da equipe.
        const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
        const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/groups?page=1&pageSize=200`, { headers: { "Client-Token": cli! } });
        const j = await r.json().catch(() => []);
        return resp(200, { status: r.status, grupos: (Array.isArray(j) ? j : []).map((g: Reg) => ({ nome: g.name, id: g.phone })).filter((g: Reg) => !c.busca || String(g.nome || "").toLowerCase().includes(String(c.busca).toLowerCase())) });
      }
      if (c.acao === "teste_grupo") return resp(200, await avisarGrupo("✅ Teste: o portal está ligado a este grupo e vai avisar aqui sempre que um contrato for gerado ou assinado."));
      porBanco = true; // a equipe também pode acionar as ações de administrador pelo banco (testes)
    }

    // ---- público: formulário pelo link ----
    if (c.acao === "formulario" || c.acao === "responder") {
      if (!/^[0-9a-f-]{36}$/i.test(String(c.token || ""))) return resp(404, { erro: "link inválido" });
      const { data: k } = await db.from("contratos").select("*").eq("token", c.token).maybeSingle();
      if (!k || k.status === "cancelado") return resp(404, { erro: "link inválido ou cancelado" });
      const m = await membro(k.membro_id);
      if (c.acao === "formulario") {
        return resp(200, { nome: m?.nome || "", email: m?.email || "", whatsapp: m?.telefone_whatsapp || "", socio: k.socio, respondido: !!k.formulario_respondido_em });
      }
      if (k.formulario_respondido_em) return resp(409, { erro: "Este formulário já foi enviado. Se precisar corrigir algo, fale com a equipe." });
      const v = validar(c.dados);
      if (!v.dados) return resp(400, { erro: v.erro });
      const texto = gerarTexto(await modelo(), v.dados);
      await db.from("contratos").update({
        dados: v.dados, socio: v.dados.participantes.length > 1, texto, status: "revisao", formulario_respondido_em: new Date().toISOString(),
      }).eq("id", k.id);
      // Aviso no grupo da equipe: contrato gerado, pronto para revisar e enviar.
      if (k.observacoes !== "TESTE") {
        const nomes = v.dados.participantes.map((p) => p.nome).join(" e ");
        await avisarGrupo(`📄 *Novo contrato gerado*\n\n*${nomes}*${v.dados.participantes.length > 1 ? " (com sócio)" : ""}\n` +
          `Pagamento: ${PAGAMENTO_CURTO[v.dados.pagamento]}${v.dados.dia_boleto ? `, dia ${v.dados.dia_boleto}` : ""}\n\n` +
          `Revise e envie para assinatura:\n${PORTAL}/#admin`);
      }
      // Contrato de teste da equipe (observacoes = "TESTE") não vai para a planilha do Google.
      const g = k.observacoes === "TESTE" ? { ok: true } : await espelharGoogle(v.dados);
      await db.from("contratos").update(g.ok ? { google_enviado_em: new Date().toISOString(), google_erro: null } : { google_erro: g.erro }).eq("id", k.id);
      return resp(200, { ok: true });
    }

    // ---- o próprio membro novo (logado), na tela "Seu contrato está em andamento" ----
    if (c.acao === "meu_contrato" && !porBanco) {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: null };
      if (!u?.user) return resp(401, { erro: "não autenticado" });
      const { data: m } = await db.from("membros").select("id, contrato_pendente").eq("auth_user_id", u.user.id).maybeSingle();
      if (!m) return resp(404, { erro: "cadastro não encontrado" });
      if (!m.contrato_pendente) return resp(200, { pendente: false });
      const { data: k } = await db.from("contratos").select("token, status, assinaturas").eq("membro_id", m.id)
        .in("status", ["aguardando_formulario", "revisao", "enviado", "assinado"]).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      const meu = (k?.assinaturas || []).find((a: Assinatura) => a.papel === "Participante" && !a.assinado_em);
      return resp(200, {
        pendente: true, status: k?.status || null, formulario: k?.status === "aguardando_formulario" ? linkFormulario(k.token) : null,
        assinar: k?.status === "enviado" ? meu?.link || null : null,
        assinaturas: k?.assinaturas ? { feitas: k.assinaturas.filter((a: Assinatura) => a.assinado_em).length, total: k.assinaturas.length } : null,
      });
    }

    // ---- administradores ----
    const admin = porBanco ? null : await souAdmin(req);
    if (!admin && !porBanco) return resp(401, { erro: "somente administradores" });

    if (c.acao === "convidar") {
      const m = c.membro_id ? await membro(c.membro_id) : null;
      if (!m) return resp(404, { erro: "membro não encontrado" });
      const { data: aberto } = await db.from("contratos").select("*").eq("membro_id", m.id).in("status", ["aguardando_formulario", "revisao", "enviado"]).maybeSingle();
      const k = aberto || (await db.from("contratos").insert({ membro_id: m.id, status: "aguardando_formulario", origem: "formulario", criado_por: admin }).select("*").single()).data;
      if (!k) return resp(500, { erro: "não foi possível criar o contrato" });
      if (k.status !== "aguardando_formulario") return resp(409, { erro: "esse membro já tem contrato em andamento" });
      // Enquanto não assinar, ainda não é membro: o portal mostra só a tela do contrato.
      await db.from("membros").update({ contrato_pendente: true }).eq("id", m.id);
      const w = await enviarConvite(k);
      return resp(200, { ok: true, id: k.id, whatsapp: w.ok ? "enviado" : "falhou", erro: w.erro, link: linkFormulario(k.token) });
    }

    const { data: k } = c.id ? await db.from("contratos").select("*").eq("id", c.id).maybeSingle() : { data: null };
    if (!k) return resp(404, { erro: "contrato não encontrado" });

    if (c.acao === "reenviar_link") {
      if (k.status !== "aguardando_formulario") return resp(409, { erro: "o formulário já foi respondido" });
      const w = await enviarConvite(k);
      return resp(200, { ok: w.ok, erro: w.erro, link: linkFormulario(k.token) });
    }
    if (c.acao === "regerar") {
      if (!k.dados || k.status !== "revisao") return resp(409, { erro: "só dá para refazer um contrato em revisão" });
      const texto = gerarTexto(await modelo(), k.dados);
      await db.from("contratos").update({ texto }).eq("id", k.id);
      return resp(200, { ok: true, texto });
    }
    if (c.acao === "enviar") {
      if (k.status !== "revisao" && !(k.status === "enviado" && k.autentique_teste)) return resp(409, { erro: "esse contrato não está em revisão" });
      if (k.status === "enviado" && k.autentique_teste && k.autentique_id) { try { await gql(`mutation { deleteDocument(id: "${k.autentique_id}") }`); } catch { /* */ } }
      const n = await enviarAutentique(k, !!c.teste);
      return resp(200, { ok: true, contrato: n });
    }
    if (c.acao === "reenviar_assinatura") {
      if (k.status !== "enviado") return resp(409, { erro: "contrato não está aguardando assinaturas" });
      const a = await avisarAssinantes(k, (k.assinaturas || []).filter((x: Assinatura) => !x.assinado_em));
      return resp(200, { ok: true, avisados: a.filter((x) => x.avisado).length });
    }
    if (c.acao === "verificar") return resp(200, { ok: true, contrato: await verificar(k) });
    if (c.acao === "cancelar") {
      if (k.status === "assinado") return resp(409, { erro: "contrato já assinado" });
      if (k.autentique_id) { try { await gql(`mutation { deleteDocument(id: "${k.autentique_id}") }`); } catch (e) { console.error("apagar na Autentique", e); } }
      await db.from("contratos").update({ status: "cancelado" }).eq("id", k.id);
      return resp(200, { ok: true });
    }
    return resp(400, { erro: "pedido inválido" });
  } catch (e) {
    console.error("contratos", e);
    return resp(500, { erro: e instanceof Error ? e.message : String(e) });
  }
});
