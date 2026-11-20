import { PainelMembro, OportunidadesDoMembro } from "./Painel";
import { Agenda, type Galeria } from "./Agenda";
import { PortalShell, VisaoGeral } from "./Visao";
import { ConteudoMembro } from "./Conteudo";
import { carregarVagas, type AcoesVaga, type VagaInfo } from "./Vagas";
import { useState, useMemo, useEffect, type ReactNode, type ChangeEvent, type InputHTMLAttributes } from "react";
import { supabase } from "./supabase";
import Membros from "./Membros";
import MeuPerfil from "./MeuPerfil";
import Admin from "./Admin";
import { contarSolicitacoes } from "./Solicitacoes";
import Onboarding from "./Onboarding";
// ============================================================
// ARQUITETURA ATUAL
// Supabase Auth: cadastro, login e sessão dos membros.
// Supabase Database: registro das confirmações de presença.
// ============================================================
// ------------------------------------------------------------
// Dados da agenda (extraídos do PDF oficial 26/27)
// ------------------------------------------------------------
type EventoAgenda = {
  id: string;
  trilha: string;
  titulo: string;
  quando: string;
  diaSemana: string;
  dataOrdenacao: string;
  inscrivel: boolean;
  local?: string | null;
  galeria?: Galeria | null;
};

const TRILHAS = {
  imersao: { rotulo: "Imersão", cor: "#8BAD3F", corTexto: "#2C3315" },
  "business-day": { rotulo: "Business Day", cor: "#1A1F2B", corTexto: "#FFFFFF" },
  growth: { rotulo: "Growth Session", cor: "#C9D9A0", corTexto: "#2C3315" },
  conselho: { rotulo: "Conselho", cor: "#4A5568", corTexto: "#FFFFFF" },
};

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "imersao", rotulo: "Imersões" },
  { id: "business-day", rotulo: "Business Day" },
  { id: "growth", rotulo: "Growth Sessions" },
  { id: "conselho", rotulo: "Conselho" },
];


const ENTREGAVEIS = [
  { id:"imersoes", grupo:"metodologia", numero:"01", titulo:"Imersões Master Business", resumo:"O principal momento estratégico do Ecossistema.", objetivo:"Promover momentos de imersão estratégica capazes de gerar decisões que impactem positivamente o crescimento da empresa no curto, médio e longo prazo.", descricao:"São três imersões exclusivas ao longo do ano, reunindo todos os membros em experiências intensivas de dois ou três dias. Momentos criados para o empresário sair da operação diária e mergulhar na construção estratégica do futuro do negócio, ampliando a visão, desafiando convicções e refletindo sobre decisões transformadoras.", topicos:["Ampliar a visão estratégica dos empresários","Discutir desafios reais dos negócios","Desenvolver novas soluções","Fortalecer a capacidade de liderança","Renovar a clareza sobre o futuro da empresa","Gerar conexões entre empresários de diferentes segmentos","Compartilhar experiências práticas que aceleram resultados"] },
  { id:"reunioes-individuais", grupo:"metodologia", numero:"02", titulo:"Reuniões Individuais de Acompanhamento", resumo:"Direcionamento estratégico personalizado.", objetivo:"Garantir acompanhamento estratégico individual e potencializar os resultados de cada membro dentro do Ecossistema.", descricao:"Reuniões conduzidas pelo time de Customer Success, que podem ser solicitadas conforme necessidade, mediante agendamento e disponibilidade. Acontecem presencialmente ou online, oferecendo suporte individualizado para cada empresário extrair o máximo valor da participação no Ecossistema.", topicos:["Construção Estratégica — desenvolver estratégias para superar desafios e acelerar o crescimento","Inteligência Coletiva — identificar conexões, indicações, parcerias e sinergias entre membros","Rede de Relacionamento — aproximar o empresário de pessoas e oportunidades relevantes"] },
  { id:"conselho", grupo:"metodologia", numero:"03", titulo:"Reuniões de Conselho Empresarial", resumo:"Sua empresa diante de um Conselho de empresários.", objetivo:"Auxiliar empresários a tomarem decisões mais estratégicas através da inteligência coletiva do Conselho Empresarial.", descricao:"Encontros em grupos reduzidos, normalmente entre 10 e 12 empresários. Cada participante apresenta sua empresa ao Conselho — compartilhando desafios, decisões e projetos — e também atua como conselheiro dos demais. O objetivo não é decidir pela empresa, mas ampliar a qualidade da reflexão e fortalecer a tomada de decisão.", topicos:["Apresentar sua empresa ao Conselho","Atuar como conselheiro dos demais participantes","Enxergar oportunidades e riscos pouco percebidos individualmente"] },
  { id:"growth", grupo:"metodologia", numero:"04", titulo:"Growth Session", resumo:"Construindo crescimento em conjunto.", objetivo:"Desenvolver soluções práticas capazes de aumentar a geração de receita e acelerar o crescimento das empresas participantes.", descricao:"Encontros colaborativos voltados exclusivamente para geração de receita, reunindo grupos de aproximadamente oito a dez empresários. Um ambiente altamente colaborativo, onde os empresários constroem, testam, refinam e validam estratégias em conjunto.", topicos:["Campanhas comerciais e estratégias de marketing","Processos comerciais e mecanismos de aquisição de clientes","Novos produtos, serviços e posicionamento","Expansão, projetos de crescimento e validação de novas ideias"] },
  { id:"business-day", grupo:"beneficio", numero:"05", titulo:"Business Day", resumo:"Imersão intensiva de um dia para empresários.", objetivo:"Atualizar empresários, ampliar repertório estratégico e desenvolver competências de gestão, marketing e vendas.", descricao:"Uma imersão intensiva de um dia focada no desenvolvimento de competências em gestão, marketing, vendas e estratégia empresarial. Ambiente de muito conteúdo prático, networking e troca de experiências. Benefício exclusivo, sem custo adicional, respeitando a disponibilidade de vagas.", topicos:["Conteúdo prático em gestão, marketing e vendas","Networking e troca de experiências","Novas perspectivas para o crescimento dos negócios"] },
  { id:"network-experience", grupo:"beneficio", numero:"06", titulo:"Network Experience", resumo:"Conexões de alto valor entre empresários.", objetivo:"Expandir o capital de relacionamento dos empresários e fortalecer o ambiente de colaboração do Ecossistema.", descricao:"Um encontro criado para gerar conexões de alto valor entre empresários. Mais do que promover networking, busca construir relações capazes de gerar parcerias, indicações, novos clientes e crescimento coletivo. Benefício exclusivo, sem custo adicional, respeitando a disponibilidade de vagas.", topicos:["Fortalecer relacionamentos e ampliar a rede de contatos","Criar oportunidades reais de negócios","Construir parcerias, indicações e novos clientes"] },
];

const CULTURA = {
  introducao:[
    "O Ecossistema Master Business nasceu com um propósito claro: conectar empresários que desejam crescer como empresários para crescer as suas empresas.",
    "Este manual é o nosso mapa cultural, criado para alinhar expectativas, orientar comportamentos e garantir que todos os membros construam um ambiente de alta performance, confiança e contribuição.",
    "Aqui, cada empresário é mais que um membro: é parte de um movimento. Este documento não é apenas uma referência escrita, mas um pacto cultural que define como pensamos, como agimos e como crescemos em conjunto."
  ],
  visao:"Ser o maior e mais relevante ecossistema de empresários do Nordeste, referência em crescimento empresarial através de conexões e estratégias.",
  missao:"Criar um ambiente de alta performance, onde empresários compartilham experiências, aprendizados e estratégias para que cada membro possa crescer como empresário e crescer as suas empresas, impactando positivamente sua vida pessoal, o mercado e a sociedade.",
  valores:["Visão","Ambição","Coragem","Alta performance","Honestidade","Integridade","Compromisso","Inovação","Contribuição"]
};

const MANDAMENTOS = [
 ["01","Visão, Ambição e Coragem são inegociáveis","Grandes líderes enxergam além do óbvio, desejam além do confortável e agem apesar do medo.","O tamanho do seu negócio nunca será maior que o tamanho da sua visão.",["Grandes líderes não se limitam a enxergar o que todos veem. Eles conseguem olhar além do óbvio, perceber oportunidades onde a maioria enxerga obstáculos e construir futuros que ainda não existem.","Ter visão significa não aceitar os limites aparentes, enxergar possibilidades maiores e direcionar o negócio para horizontes que desafiam o status quo.","No Ecossistema, acreditamos que o tamanho do seu negócio nunca será maior que o tamanho da sua visão.","O comportamento esperado de cada membro é claro: liderar com coragem, ousar pensar maior do que a média e agir com a determinação de quem está construindo um legado."]],
 ["02","Seja obcecado pela execução","Ideias não valem nada sem ação.","Execução transforma visão em legado.",["No mundo dos negócios, ideias não valem nada sem ação. A execução é a ponte que separa os sonhadores dos realizadores, os que falam dos que constroem.","Obcecado pela execução é aquele que entende que consistência é mais importante do que genialidade.","No Ecossistema Master Business, o comportamento esperado é claro: ter disciplina, consistência e foco em entregar."]],
 ["03","Comprometimento vence talento","O que constrói impérios não é genialidade, é consistência.","Comprometimento supera qualquer talento natural.",["Na construção de impérios, não é a genialidade que determina o resultado, mas a consistência.","Comprometimento é ser confiável, entregar o que foi prometido e aparecer todos os dias com a mesma intensidade.","O comportamento esperado de cada membro é simples e poderoso: ser confiável, entregar sempre e cumprir promessas."]],
 ["04","Construa relacionamentos antes de construir negócios","Pessoas são o ativo mais valioso.","Networking verdadeiro gera confiança, e confiança gera negócios.",["Os maiores empresários da história entenderam cedo que o verdadeiro patrimônio não está no dinheiro, mas nas pessoas.","Relacionamentos sólidos são a base da confiança, e a confiança é o alicerce que sustenta qualquer negócio de longo prazo.","No Ecossistema Master Business, acreditamos que ninguém cresce sozinho. Primeiro se constrói conexão, para depois vir o negócio."]],
 ["05","Esteja sempre visível e relevante","Oportunidades encontram quem aparece.","No silêncio sua rede esquece você; na visibilidade sua rede multiplica você.",["Oportunidades encontram aqueles que estão em movimento, que se mostram ao mundo e que constroem presença de forma consistente.","Ser visível não significa apenas estar presente, mas ser lembrado.","No Ecossistema Master Business, acreditamos que cada membro deve ser protagonista da própria história e exemplo vivo da cultura que construímos."]],
 ["06","Reputação vale mais que dinheiro","Dinheiro abre portas, mas só a reputação as mantém abertas.","Reputação é o legado que o dinheiro não compra.",["Reputação é o ativo invisível que sustenta negócios sólidos. É ela que atrai novas oportunidades, gera confiança e constrói legados duradouros.","No Ecossistema Master Business, acreditamos que reputação é capital social e que vale muito mais do que qualquer saldo bancário.","Construir uma boa reputação exige tempo, mas perdê-la pode ser questão de segundos."]],
 ["07","Seja o líder que o seu negócio precisa","Ninguém cresce sozinho; grandes líderes formam grandes times.","Grandes empresas não são feitas por heróis solitários, mas por líderes que formam exércitos.",["Nenhum império foi construído sozinho. Grandes realizações sempre nasceram da capacidade de um líder em inspirar, atrair e organizar pessoas em torno de uma visão maior.","Um verdadeiro líder busca pessoas melhores que ele em determinadas áreas, dá autonomia e cria uma cultura de responsabilidade compartilhada.","Grandes empresas não são erguidas por heróis solitários, mas por líderes capazes de formar grandes times."]],
 ["08","Empresário inteligente toma decisões baseadas em dados","Intuição importa, mas decisões inteligentes precisam de números.","Opiniões divergem, mas dados mostram o caminho.",["Intuição é valiosa, mas, sozinha, pode se tornar perigosa. Para transformar intuição em resultado, é preciso sustentá-la com dados concretos.","Empresários inteligentes entendem que achismos não sustentam crescimento de longo prazo.","No Ecossistema Master Business, o comportamento esperado é medir o que realmente importa, acompanhar indicadores-chave, testar hipóteses e aprender com evidências."]],
 ["09","Crescimento não acontece por acaso — planeje-o","Empresas que crescem de verdade são intencionais.","Crescimento não é sorte; é estratégia aplicada com disciplina.",["Empresas que crescem de forma consistente não dependem da sorte. Elas crescem porque são intencionais.","No Ecossistema Master Business, acreditamos que crescimento é sempre fruto de decisão consciente.","Planejamento não significa engessar o caminho, mas criar direções claras e revisar rotas de forma consistente."]],
 ["10","Viva a cultura como um todo, não como partes","Nenhum mandamento isolado gera transformação — todos se integram.","O poder não está em um mandamento, mas em viver todos como um só.",["A força de um ecossistema não está em fragmentos isolados, mas na integração de todos os seus princípios.","No Ecossistema Master Business, acreditamos que viver a cultura é compromisso diário de praticar todos eles, com intensidade e consistência.","O verdadeiro poder não está em decorar os mandamentos, mas em vivê-los como uma filosofia de vida e de negócios."]]
].map(([numero,titulo,sintese,frase,texto])=>({numero,titulo,sintese,frase,texto})) as Array<{numero:string;titulo:string;sintese:string;frase:string;texto:string[]}>;

const REGRAS_GRUPO = {
 intro:[
  "Sobre a utilização do nosso grupo de WhatsApp, garantindo que continuemos mantendo um ambiente produtivo, organizado e rico em conexões, trocas e oportunidades para todos.",
  "O objetivo é garantir que este continue sendo um ambiente de alto nível, com trocas relevantes, networking qualificado, inteligência coletiva e contribuições que realmente gerem valor para todos."
 ],
 blocos:[
  {tom:"permitido",titulo:"Contribuir para o crescimento dos membros",texto:"Toda participação deve ter como foco agregar valor, gerar aprendizado, conexões, oportunidades ou contribuir para o desenvolvimento dos empresários do grupo."},
  {tom:"permitido",titulo:"Compartilhar conteúdos relevantes",texto:"Utilize o grupo para:",itens:["Tirar dúvidas e pedir ajuda","Compartilhar experiências","Trazer informações importantes para empresários","Apresentar atualizações relevantes de mercado","Contribuir com insights estratégicos e oportunidades pertinentes"]},
  {tom:"evitar",titulo:"Conteúdos fora do propósito do grupo",texto:"Não é permitido o envio de:",itens:["Correntes","Mensagens religiosas ou políticas","Memes e fake news","Propagandas e conteúdos aleatórios","Divulgações sem contexto ou relevância para os membros"]},
  {tom:"evitar",titulo:"Conteúdos de redes sociais",texto:"Não é permitido o compartilhamento de posts, Reels, Stories, links ou republicações de redes sociais, mesmo quando forem de autoria do próprio membro. Se o conteúdo gerar uma reflexão relevante, compartilhe o aprendizado diretamente no grupo, contextualizando a discussão."},
  {tom:"info",titulo:"Sobre oportunidades e divulgações",texto:"Oportunidades de negócio são bem-vindas quando fazem sentido para o perfil do grupo e trazem benefícios reais. Não é permitido enviar links de vendas, promoções ou ofertas diretamente no grupo. Abordagens comerciais e negociações devem acontecer no privado."},
  {tom:"info",titulo:"Preservação da qualidade do grupo",texto:"Essas diretrizes existem para proteger o principal propósito do Ecossistema: fortalecer conexões, promover trocas de experiências e manter um ambiente produtivo, estratégico e valioso para todos. Em caso de dúvida, consulte os administradores."}
 ]
};

type MembroLogado = {
  userId: string;
  nome: string;
  login: string;
  ativo: boolean;
  isAdmin: boolean;
  equipe: boolean;
  foto: string | null;
  onboardingPendente: boolean;
};

async function montarMembro(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): Promise<MembroLogado> {
  const { data } = await supabase
    .from("membros")
    .select("nome, ativo, is_admin, equipe, foto_url")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  // Onboarding obrigatório: só bloqueia quando o banco responde "pendente".
  // Admin nunca é bloqueado; se a consulta falhar, não trava o acesso (o banco já protege os dados).
  let onboardingPendente = false;
  if (data?.ativo && !data?.is_admin) {
    const { data: status } = await supabase.rpc("meu_status_onboarding");
    onboardingPendente = status === "pendente";
  }
  return {
    userId: user.id,
    nome: data?.nome || (user.user_metadata?.nome as string) || user.email?.split("@")[0] || "Membro",
    login: user.email || "",
    ativo: !!data?.ativo,
    isAdmin: !!data?.ativo && !!data?.is_admin,
    equipe: !!data?.ativo && !!data?.equipe,
    foto: data?.foto_url || null,
    onboardingPendente,
  };
}

export default function PortalAgenda() {
  const [membroLogado, setMembroLogado] = useState<MembroLogado | null>(null);
  const [tela, setTela] = useState("login");
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecuperandoSenha(true);
      }
      // Busca o perfil fora do callback para não travar o cliente de autenticação.
      setTimeout(async () => {
        if (session?.user) {
          setMembroLogado(await montarMembro(session.user));
        } else {
          setMembroLogado(null);
        }
        setCarregandoSessao(false);
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function sairMembro() {
    await supabase.auth.signOut();
    setMembroLogado(null);
    setTela("login");
  }

  if (carregandoSessao) {
    return (
      <div style={S.loginPage}>
        <div style={{ color: "var(--p-text)", fontFamily: "'Inter', system-ui, sans-serif" }}>
          Carregando...
        </div>
      </div>
    );
  }

  if (recuperandoSenha && membroLogado) {
    return <TelaNovaSenha onConcluir={() => setRecuperandoSenha(false)} />;
  }

  if (membroLogado) {
    if (!membroLogado.ativo) {
      return (
        <TelaSemAcesso
          email={membroLogado.login}
          nomeInicial={membroLogado.nome}
          onSair={sairMembro}
          onLiberado={async () => {
            const { data } = await supabase.auth.getUser();
            if (data.user) setMembroLogado(await montarMembro(data.user));
          }}
        />
      );
    }
    if (membroLogado.onboardingPendente) {
      return (
        <Onboarding
          userId={membroLogado.userId}
          modo="obrigatorio"
          onConcluido={() => setMembroLogado({ ...membroLogado, onboardingPendente: false })}
          onSair={sairMembro}
        />
      );
    }
    return <PortalConteudo membro={membroLogado} onSair={sairMembro} />;
  }

  if (tela === "esqueci") {
    return <TelaEsqueciSenha onVoltar={() => setTela("login")} />;
  }

  return <TelaEntrada onEsqueci={() => setTela("esqueci")} />;
}

function TelaEsqueciSenha({ onVoltar }) {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) {
      setErro("Digite o e-mail que você usa no portal.");
      return;
    }
    setEnviando(true);
    setErro("");
    const { error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    setEnviando(false);
    if (error) {
      setErro(
        error.status === 429
          ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
          : "Não foi possível enviar agora. Fale com a administração do Ecossistema."
      );
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <AuthShell>
        <h1 style={S.loginTitulo}>Verifique seu e-mail</h1>
        <p style={S.loginSub}>
          Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.
          Confira também a caixa de spam.
        </p>
        <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={onVoltar}>
          Voltar ao login
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={S.loginTitulo}>Esqueci minha senha</h1>
      <p style={S.loginSub}>Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
      <CampoEntrada id="r-email" rotulo="Seu e-mail" icone="email" primeiro>
        <input id="r-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com.br" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} />
      </CampoEntrada>
      {erro && <div style={S.modalErro}>{erro}</div>}
      <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={enviar} disabled={enviando}>
        {enviando ? "Enviando..." : "Enviar link"}
      </button>
      <button style={S.linkBtn} onClick={onVoltar}>Voltar ao login</button>
    </AuthShell>
  );
}

function TelaNovaSenha({ onConcluir }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function salvar() {
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setSalvando(true);
    setErro("");
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      setErro("Não foi possível salvar a nova senha. Peça um novo link e tente de novo.");
      return;
    }
    setPronto(true);
  }

  if (pronto) {
    return (
      <AuthShell>
        <h1 style={S.loginTitulo}>Senha alterada</h1>
        <p style={S.loginSub}>Pronto! Sua nova senha já está valendo.</p>
        <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={onConcluir}>
          Entrar no portal
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={S.loginTitulo}>Criar nova senha</h1>
      <p style={S.loginSub}>Escolha uma senha com pelo menos 8 caracteres.</p>
      <CampoEntrada id="n-senha" rotulo="Nova senha" icone="cadeado" primeiro>
        <InputSenha id="n-senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
      </CampoEntrada>
      <CampoEntrada id="n-conf" rotulo="Confirme a nova senha" icone="cadeado">
        <InputSenha id="n-conf" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} />
      </CampoEntrada>
      {erro && <div style={S.modalErro}>{erro}</div>}
      <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar nova senha"}
      </button>
    </AuthShell>
  );
}

// (71) 99999-0000 a partir de "71999990000".
function formatarFone(d: string | null): string {
  const n = (d || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d || "";
}

// Quem tem login mas não está liberado: pede acesso (vira uma solicitação na Administração).
type Solicitacao = { status: "pendente" | "aprovada" | "recusada"; nome: string; whatsapp: string | null; empresa: string | null };
function TelaSemAcesso({ email, nomeInicial, onSair, onLiberado }: { email: string; nomeInicial: string; onSair: () => void; onLiberado: () => Promise<void> }) {
  const [sol, setSol] = useState<Solicitacao | null | undefined>(undefined);
  const [nome, setNome] = useState(nomeInicial || "");
  const fone = useCampoFone();
  const [empresa, setEmpresa] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("solicitacoes_acesso").select("status,nome,whatsapp,empresa").maybeSingle();
    setSol((data as Solicitacao) || null);
    if (data) { setNome(data.nome || ""); fone.setValor(mascaraFone(data.whatsapp || "").valor); setEmpresa(data.empresa || ""); }
  }
  useEffect(() => { carregar(); }, []);

  async function enviar() {
    const foneOk = fone.validar();
    if (nome.trim().length < 2 || !foneOk || empresa.trim().length < 2) {
      setErro("Preencha seu nome, o WhatsApp com DDD e o nome da empresa.");
      return;
    }
    setEnviando(true); setErro("");
    const { data, error } = await supabase.rpc("solicitar_acesso", { p_nome: nome, p_whatsapp: fone.digitos, p_empresa: empresa });
    setEnviando(false);
    if (error) { setErro("Não foi possível enviar agora. Tente de novo em instantes."); return; }
    if (data === "ja_liberado") { onLiberado(); return; }
    carregar();
  }

  // Enquanto o pedido espera aprovação, a tela confere sozinha a cada 20 segundos.
  // Quando for aprovado, o portal abre automaticamente (sem botão, sem recarregar).
  const aguardando = sol?.status === "pendente" && !!sol?.whatsapp;
  useEffect(() => {
    if (!aguardando) return;
    const t = setInterval(() => { onLiberado(); }, 20000);
    return () => clearInterval(t);
  }, [aguardando]); // eslint-disable-line react-hooks/exhaustive-deps


  if (sol === undefined) return <AuthShell><p style={S.loginSub}>Carregando...</p></AuthShell>;

  // O pedido já nasce ao criar a conta; a tela de "enviada" só aparece depois que a pessoa completa WhatsApp e empresa.
  if (sol?.status === "pendente" && sol.whatsapp) {
    return (
      <AuthShell>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--p-accent-bg)", color: "var(--p-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", margin: "6px auto 14px", fontSize: 26 }}>✓</div>
        <h1 style={S.loginTitulo}>Solicitação enviada</h1>
        <p style={S.loginSub}>
          Recebemos o seu pedido de acesso. Assim que a administração aprovar, você recebe uma mensagem no
          WhatsApp <strong>{formatarFone(sol.whatsapp)}</strong> e já pode entrar com o e-mail <strong>{email}</strong>.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, color: "var(--p-muted)", background: "var(--p-hover)", borderRadius: 12, padding: "10px 14px" }}>
          <span className="pulso-espera" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--p-accent)" }} />
          Esta tela se atualiza sozinha. Quando for aprovado, você entra automaticamente.
        </div>
        <style>{`@keyframes pulsoEspera{0%,100%{opacity:.35}50%{opacity:1}} .pulso-espera{animation:pulsoEspera 1.6s ease-in-out infinite}`}</style>
        <button style={{ ...S.linkBtn, marginTop: 14 }} onClick={onSair}>Sair</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={S.loginTitulo}>Solicitar acesso</h1>
      <p style={S.loginSub}>
        {sol?.status === "recusada"
          ? "Sua solicitação anterior não foi aprovada. Se achar que foi um engano, confira seus dados e envie de novo."
          : <>O e-mail <strong>{email}</strong> ainda não está liberado no portal. Preencha abaixo e a administração analisa o seu acesso.</>}
      </p>
      <CampoEntrada id="sol-nome" rotulo="Seu nome completo" icone="pessoa" primeiro>
        <input id="sol-nome" name="name" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Souza" />
      </CampoEntrada>
      <CampoEntrada id="sol-whats" rotulo="Seu WhatsApp" icone="whats" dica="Só números, com DDD." erro={fone.erro}>
        <input id="sol-whats" name="whatsapp" type="tel" inputMode="numeric" autoComplete="tel-national" value={fone.valor} onChange={fone.onChange} onBlur={fone.onBlur}
          placeholder="(71) 99999-9999" maxLength={16} aria-invalid={!!fone.erro} />
      </CampoEntrada>
      <CampoEntrada id="sol-empresa" rotulo="Nome da sua empresa" icone="empresa">
        <input id="sol-empresa" name="organization" autoComplete="organization" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex.: Souza Consultoria"
          onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} />
      </CampoEntrada>
      {erro && <div style={S.modalErro}>{erro}</div>}
      <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={enviar} disabled={enviando}>
        {enviando ? "Enviando..." : "Solicitar acesso"}
      </button>
      <button style={S.linkBtn} onClick={onSair}>Sair</button>
    </AuthShell>
  );
}


// ── Campos das telas de entrada: rótulo em destaque com ícone verde em relevo, campo grande com brilho no foco ──
const ICONES: Record<string, ReactNode> = {
  email: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zm1.6.2 7.4 5.6 7.4-5.6" />,
  pessoa: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" /></>,
  whats: <path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.6zM9 8.4c.3-.6.6-.6.9-.6h.5c.2 0 .4 0 .6.5l.8 1.8c.1.2.1.4 0 .6l-.6.8c-.1.2-.1.3 0 .5.6 1 1.5 1.9 2.6 2.4.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.3.3.6-.2.9-1 1.7-2 1.7-2.9 0-6.7-3.5-6.7-6.5 0-.7.1-1.1.1-1.2z" />,
  cadeado: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  empresa: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4 12.5h16" /></>,
  codigo: <><rect x="3" y="7" width="18" height="10" rx="3" /><path d="M7.5 12h.01M12 12h.01M16.5 12h.01" strokeWidth="3" /></>,
};
function CampoEntrada({ id, rotulo, icone, dica, erro, children, primeiro }: { id: string; rotulo: string; icone: keyof typeof ICONES; dica?: string; erro?: string; children: ReactNode; primeiro?: boolean }) {
  return (
    <div className={`campo-entrada${erro ? " com-erro" : ""}`} style={{ textAlign: "left", marginTop: primeiro ? 0 : 18 }}>
      <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9, cursor: "pointer" }}>
        <span className="campo-icone" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONES[icone]}</svg>
        </span>
        <span style={{ fontSize: 15.5, fontWeight: 650, color: "var(--p-text)", letterSpacing: "-0.01em" }}>{rotulo}</span>
      </label>
      {children}
      {(erro || dica) && <div style={{ fontSize: 12.5, marginTop: 7, color: erro ? "var(--p-danger)" : "var(--p-muted)", fontWeight: erro ? 600 : 400 }}>{erro || dica}</div>}
    </div>
  );
}
const CSS_ENTRADA = `
  .campo-icone { width: 30px; height: 30px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; color: #fff; flex: none;
    background: linear-gradient(180deg, #3FD47A 0%, #1F9D55 55%, #157A40 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,.45) inset, 0 -2px 0 rgba(0,0,0,.18) inset, 0 4px 10px rgba(31,157,85,.35); }
  .campo-entrada input { width: 100%; height: 52px; padding: 0 16px; border-radius: 14px; font-size: 16px; box-sizing: border-box; outline: none; font-family: inherit;
    background: var(--p-field); color: var(--p-text); border: 1.5px solid var(--p-line2); box-shadow: 0 1px 2px rgba(0,0,0,.04) inset; transition: border-color .15s, box-shadow .15s; }
  .campo-senha { position: relative; }
  .campo-entrada .campo-senha input { padding-right: 52px; }
  .olho-senha { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border: 0; border-radius: 10px; background: transparent;
    color: var(--p-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .olho-senha:hover { background: var(--p-hover); color: var(--p-text); }
  .campo-entrada input::placeholder { color: var(--p-faint); }
  .campo-entrada input:focus { border-color: var(--p-accent) !important; box-shadow: 0 0 0 4px var(--p-accent-bg); }
  .campo-entrada.com-erro input, .campo-entrada.com-erro input:focus { border-color: var(--p-danger) !important; box-shadow: 0 0 0 4px color-mix(in srgb, var(--p-danger) 14%, transparent); }
  .campo-entrada.com-erro .campo-icone { background: linear-gradient(180deg, #FF6B6B 0%, #D70015 60%, #A3000F 100%); box-shadow: 0 1px 0 rgba(255,255,255,.4) inset, 0 -2px 0 rgba(0,0,0,.18) inset, 0 4px 10px rgba(215,0,21,.3); }
`;

// Campo de senha com o "olhinho" para mostrar/esconder o que foi digitado.
function InputSenha(props: InputHTMLAttributes<HTMLInputElement>) {
  const [ver, setVer] = useState(false);
  return (
    <div className="campo-senha">
      <input {...props} type={ver ? "text" : "password"} />
      <button type="button" className="olho-senha" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder senha" : "Mostrar senha"} title={ver ? "Esconder senha" : "Mostrar senha"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          {!ver && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}

// WhatsApp: só números, formatado enquanto digita. Devolve o texto formatado e se a pessoa tentou digitar letras.
export function mascaraFone(bruto: string): { valor: string; letras: boolean } {
  const letras = /[^\d\s()+\-.]/.test(bruto);
  const d = bruto.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  let v = d;
  if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 6) v = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return { valor: v, letras };
}
function useCampoFone() {
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { valor: v, letras } = mascaraFone(e.target.value);
    setValor(v);
    setErro(letras ? "Digite só números: DDD + número." : "");
  };
  const onBlur = () => { const n = valor.replace(/\D/g, "").length; if (n > 0 && n < 10) setErro("Número incompleto: DDD + número."); };
  const validar = () => { const ok = valor.replace(/\D/g, "").length >= 10; if (!ok) setErro("Informe o WhatsApp com DDD, só números."); return ok; };
  return { valor, setValor, erro, setErro, onChange, onBlur, validar, digitos: valor.replace(/\D/g, "") };
}

function AuthShell({ children }) {
  return (
    <div style={S.loginPage}>
      <style>{CSS + CSS_ENTRADA}</style>
      <div style={S.loginCard}>
        <img src="/logo-ecossistema-redondo.png" alt="" style={{ width: 68, height: 68, borderRadius: "50%", display: "block", margin: "4px auto 6px", boxShadow: "0 0 0 1.5px #3BA7FF, 0 0 10px 2px rgba(59,167,255,.75), 0 0 26px 6px rgba(59,167,255,.32)" }} />
        <div style={S.loginEyebrow}><div style={{ display: "inline-block", textTransform: "uppercase" }}><div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: ".42em", marginRight: "-.42em", lineHeight: 1.3 }}>Ecossistema</div><div style={{ fontSize: 17, fontWeight: 700, letterSpacing: ".04em", lineHeight: 1.15 }}>Master Business</div></div></div>
        {children}
      </div>
    </div>
  );
}

// Entrada única: a pessoa digita o e-mail e o portal decide o resto.
//  - e-mail já tem senha      -> pede a senha;
//  - e-mail ainda sem senha    -> pede nome, WhatsApp e uma senha nova;
//      * se o portal reconhece o membro (e-mail ou WhatsApp do cadastro): manda um código para o WhatsApp
//        QUE ESTÁ NO CADASTRO e, com o código, entra direto no perfil dele;
//      * se não reconhece: cria a conta e vira pedido de acesso (a administração aprova).
type EtapaEntrada = "email" | "senha" | "criar" | "codigo";

async function chamarEntrada(corpo: Record<string, string>): Promise<{ modo?: string; fone?: string; ok?: boolean; erro?: string }> {
  const { data, error } = await supabase.functions.invoke("entrada", { body: corpo });
  if (!error) return data || {};
  try { const ctx = (error as { context?: Response }).context; const j = ctx ? await ctx.json() : null; if (j?.erro) return { erro: j.erro }; } catch { /* sem corpo */ }
  return { erro: "Não foi possível continuar agora. Tente de novo em instantes." };
}

function TelaEntrada({ onEsqueci }) {
  const [etapa, setEtapa] = useState<EtapaEntrada>("email");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const fone = useCampoFone();
  const whats = fone.valor;
  const [codigo, setCodigo] = useState("");
  const [foneCadastro, setFoneCadastro] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);
  const emailN = email.trim().toLowerCase();

  function ir(e: EtapaEntrada) {
    setErro(""); setAviso("");
    // Ao chegar em "Crie sua senha", os campos começam vazios (nada herdado nem preenchido pelo navegador).
    if (e === "criar") { setNome(""); setSenha(""); fone.setValor(""); fone.setErro(""); }
    setEtapa(e);
  }

  async function continuarEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailN)) { setErro("Digite um e-mail válido."); return; }
    setCarregando(true); setErro("");
    const { data, error } = await supabase.rpc("entrada_status", { p_email: emailN });
    setCarregando(false);
    if (error) { setErro("Não foi possível continuar agora. Tente de novo em instantes."); return; }
    ir(data === "senha" ? "senha" : "criar");
  }

  async function entrar() {
    if (!senha) { setErro("Digite sua senha."); return; }
    setCarregando(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: emailN, password: senha });
    if (error) { setErro("Senha incorreta. Confira e tente de novo, ou use \"Esqueci minha senha\"."); setCarregando(false); }
    // Com sucesso, o portal abre sozinho quando a sessão é detectada.
  }

  // Quem o portal não reconhece: cria a conta e vira pedido de acesso (tela "Solicitação enviada").
  async function criarComoPedido() {
    setCarregando(true); setErro("");
    const { data, error } = await supabase.auth.signUp({
      email: emailN, password: senha,
      options: { data: { nome: nome.trim(), whatsapp: fone.digitos } },
    });
    if (error || !data.user) {
      const m = (error?.message || "").toLowerCase();
      setErro(m.includes("already") || m.includes("registered") ? "Esse e-mail já tem senha. Volte e entre com ela." : "Não foi possível criar seu acesso agora.");
      setCarregando(false);
    }
  }

  async function continuarCriar() {
    const d = fone.digitos;
    const foneOk = fone.validar();
    if (nome.trim().length < 2 || !foneOk || senha.length < 6) {
      setErro(nome.trim().length < 2 ? "Preencha seu nome completo." : !foneOk ? "Confira o WhatsApp: só números, com DDD." : "A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setCarregando(true); setErro("");
    const r = await chamarEntrada({ acao: "iniciar", email: emailN, nome: nome.trim(), whatsapp: d });
    setCarregando(false);
    if (r.erro) { setErro(r.erro); return; }
    if (r.modo === "senha") { ir("senha"); setAviso("Esse e-mail já tem senha. Entre com ela."); return; }
    if (r.modo === "codigo") { setFoneCadastro(r.fone || ""); setCodigo(""); ir("codigo"); return; }
    await criarComoPedido();
  }

  async function reenviarCodigo() {
    setCarregando(true); setErro(""); setAviso("");
    const r = await chamarEntrada({ acao: "iniciar", email: emailN, nome: nome.trim(), whatsapp: fone.digitos });
    setCarregando(false);
    if (r.erro) setErro(r.erro); else if (r.modo === "codigo") setAviso("Enviamos um novo código.");
  }

  async function confirmarCodigo() {
    const c = codigo.replace(/\D/g, "");
    if (c.length !== 6) { setErro("Digite os 6 números do código."); return; }
    setCarregando(true); setErro("");
    const r = await chamarEntrada({ acao: "confirmar", email: emailN, nome: nome.trim(), whatsapp: fone.digitos, senha, codigo: c });
    if (!r.ok) { setErro(r.erro || "Não foi possível confirmar agora."); setCarregando(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: emailN, password: senha });
    if (error) { setErro("Seu acesso foi criado. Volte e entre com seu e-mail e a senha que você criou."); setCarregando(false); }
  }

  const btn = (rotulo: string, ocupado: string, acao: () => void) => (
    <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={acao} disabled={carregando}>
      {carregando ? ocupado : rotulo}
    </button>
  );
  const emailFixo = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 12, background: "var(--p-hover)", margin: "0 0 14px", fontSize: 14 }}>
      <span style={{ color: "var(--p-text)", overflowWrap: "anywhere" }}>{emailN}</span>
      <button style={{ ...S.linkBtn, margin: 0, padding: 0, width: "auto" }} onClick={() => { setSenha(""); ir("email"); }}>Trocar</button>
    </div>
  );
  const erroAviso = <>{aviso && <div style={{ ...S.modalErro, color: "var(--p-accent-text)" }}>{aviso}</div>}{erro && <div style={S.modalErro}>{erro}</div>}</>;

  if (etapa === "senha") {
    return (
      <AuthShell>
        <h1 style={S.loginTitulo}>Bem-vindo de volta</h1>
        <p style={S.loginSub}>Digite sua senha para entrar.</p>
        {emailFixo}
        <CampoEntrada id="senha" rotulo="Sua senha" icone="cadeado" primeiro>
          <InputSenha id="senha" name="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="digite sua senha" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") entrar(); }} />
        </CampoEntrada>
        {erroAviso}
        {btn("Entrar", "Entrando...", entrar)}
        <button style={S.linkBtn} onClick={onEsqueci}>Esqueci minha senha</button>
      </AuthShell>
    );
  }

  if (etapa === "criar") {
    return (
      <AuthShell>
        <h1 style={S.loginTitulo}>Crie sua senha</h1>
        <p style={S.loginSub}>É o seu primeiro acesso. Preencha abaixo para criar a sua senha.</p>
        {emailFixo}
        <CampoEntrada id="c-nome" rotulo="Seu nome completo" icone="pessoa" primeiro>
          <input id="c-nome" name="name" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Souza" autoFocus />
        </CampoEntrada>
        <CampoEntrada id="c-whats" rotulo="Seu WhatsApp" icone="whats" dica="Só números, com DDD." erro={fone.erro}>
          <input id="c-whats" name="whatsapp" type="tel" inputMode="numeric" autoComplete="tel-national" value={fone.valor} onChange={fone.onChange} onBlur={fone.onBlur}
            placeholder="(71) 99999-9999" maxLength={16} aria-invalid={!!fone.erro} />
        </CampoEntrada>
        <CampoEntrada id="c-senha" rotulo="Crie uma senha" icone="cadeado" dica="Mínimo de 6 caracteres.">
          <InputSenha id="c-senha" name="new-password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="crie sua senha"
            onKeyDown={(e) => { if (e.key === "Enter") continuarCriar(); }} />
        </CampoEntrada>
        {erroAviso}
        {btn("Continuar", "Aguarde...", continuarCriar)}
      </AuthShell>
    );
  }

  if (etapa === "codigo") {
    return (
      <AuthShell>
        <h1 style={S.loginTitulo}>Confirme pelo WhatsApp</h1>
        <p style={S.loginSub}>
          Encontramos o seu cadastro de membro. Enviamos um código de 6 números para o WhatsApp do cadastro{foneCadastro ? <> <strong style={{ whiteSpace: "nowrap" }}>{foneCadastro}</strong></> : ""}.
        </p>
        <CampoEntrada id="c-codigo" rotulo="Código recebido no WhatsApp" icone="codigo" primeiro>
          <input id="c-codigo" style={{ letterSpacing: ".4em", fontSize: 22, textAlign: "center", fontWeight: 600 }} value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") confirmarCodigo(); }} />
        </CampoEntrada>
        {erroAviso}
        {btn("Confirmar e entrar", "Confirmando...", confirmarCodigo)}
        <button style={S.linkBtn} onClick={reenviarCodigo} disabled={carregando}>Reenviar código</button>
        <button style={{ ...S.linkBtn, marginTop: 4 }} onClick={criarComoPedido} disabled={carregando}>Não tenho mais esse WhatsApp — pedir acesso à administração</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={S.loginTitulo}>Portal de Membros</h1>
      <p style={S.loginSub}>Acesso exclusivo para membros. Digite seu e-mail para continuar.</p>
      <CampoEntrada id="email" rotulo="Seu e-mail" icone="email" primeiro>
        <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com.br" autoFocus autoComplete="email"
          onKeyDown={(e) => { if (e.key === "Enter") continuarEmail(); }} />
      </CampoEntrada>
      {erroAviso}
      {btn("Continuar", "Aguarde...", continuarEmail)}
    </AuthShell>
  );
}


function SecaoEntregas() {
 const [aberto,setAberto]=useState<string|null>("imersoes");
 const grupos=[["Entregas da metodologia",ENTREGAVEIS.filter(e=>e.grupo==="metodologia")],["Benefícios exclusivos para membros",ENTREGAVEIS.filter(e=>e.grupo==="beneficio")]] as const;
 return <><section style={S.hero}><div style={S.heroInner}><div style={S.heroEyebrow}>Metodologia</div><h1 style={S.heroTitle}>Nossas entregas,<br/>uma jornada completa.</h1><p style={S.heroSub}>Cada entrega atua em um momento diferente do desenvolvimento da sua empresa. Juntas, formam um sistema completo de crescimento empresarial — estratégia, inteligência coletiva, conexões e execução.</p></div></section>
 <main style={S.lista}>{grupos.map(([nome,itens],g)=><div key={nome}><div style={{...S.grupoLabel,marginTop:g?32:0}}>{nome}</div>{itens.map(item=>{const open=aberto===item.id;return <article key={item.id} style={S.entregaCard}><button style={S.entregaHead} onClick={()=>setAberto(open?null:item.id)}><span style={S.entregaNumero}>{item.numero}</span><span style={S.entregaHeadTexto}><span style={S.entregaTitulo}>{item.titulo}</span><span style={S.entregaResumo}>{item.resumo}</span></span><span style={S.entregaSeta}>{open?"⌃":"⌄"}</span></button>{open&&<div style={S.entregaCorpo}><p style={S.entregaDescricao}>{item.descricao}</p><div style={S.entregaTopicosTitulo}>Na prática</div><ul style={S.entregaLista}>{item.topicos.map((t,i)=><li key={i} style={S.entregaItem}>{t}</li>)}</ul><div style={S.entregaObjetivo}><span style={S.entregaObjetivoLabel}>Objetivo</span>{item.objetivo}</div></div>}</article>})}</div>)}<div style={S.fecho}>Conectando pessoas. Transformando negócios.</div></main></>;
}

function SecaoCultura() {
 const [aberto,setAberto]=useState<string|null>("01");
 return <><section style={S.hero}><div style={S.heroInner}><div style={S.heroEyebrow}>Manual de Cultura</div><h1 style={S.heroTitle}>Nosso pacto cultural.<br/>Como pensamos e agimos.</h1><p style={S.heroSub}>Mais que uma referência escrita, um pacto que define como pensamos, como agimos e como crescemos em conjunto.</p></div></section>
 <main style={S.lista}><div style={S.blocoTexto}>{CULTURA.introducao.map((p,i)=><p key={i} style={S.paragrafo}>{p}</p>)}</div><div className="vmv-grid" style={S.vmvGrid}><div style={S.vmvCard}><div style={S.vmvLabel}>Visão</div><p style={S.vmvTexto}>{CULTURA.visao}</p></div><div style={S.vmvCard}><div style={S.vmvLabel}>Missão</div><p style={S.vmvTexto}>{CULTURA.missao}</p></div></div><div style={S.vmvCard}><div style={S.vmvLabel}>Valores</div><div style={S.valoresRow}>{CULTURA.valores.map(v=><span key={v} style={S.valorChip}>{v}</span>)}</div></div><div style={{...S.grupoLabel,marginTop:36}}>Os 10 Mandamentos</div>{MANDAMENTOS.map(m=>{const open=aberto===m.numero;return <article key={m.numero} style={S.entregaCard}><button style={S.entregaHead} onClick={()=>setAberto(open?null:m.numero)}><span style={S.entregaNumero}>{m.numero}</span><span style={S.entregaHeadTexto}><span style={S.entregaTitulo}>{m.titulo}</span><span style={S.entregaResumo}>{m.sintese}</span></span><span style={S.entregaSeta}>{open?"⌃":"⌄"}</span></button>{open&&<div style={S.entregaCorpo}>{m.texto.map((p,i)=><p key={i} style={S.entregaDescricao}>{p}</p>)}<div style={S.mandamentoFrase}>“{m.frase}”</div></div>}</article>})}</main></>;
}

function SecaoRegras() {
 const tons:any={permitido:{b:"var(--p-accent)",bg:"color-mix(in srgb, var(--p-accent) 12%, transparent)",c:"var(--p-accent)",r:"Recomendado"},evitar:{b:"var(--p-danger)",bg:"color-mix(in srgb, var(--p-danger) 12%, transparent)",c:"var(--p-danger)",r:"Não permitido"},info:{b:"var(--p-faint)",bg:"rgba(255,255,255,.06)",c:"var(--p-text2)",r:"Importante"}};
 return <><section style={S.hero}><div style={S.heroInner}><div style={S.heroEyebrow}>Grupo de WhatsApp</div><h1 style={S.heroTitle}>Regras de convivência.<br/>Um ambiente de alto nível.</h1><p style={S.heroSub}>Diretrizes para mantermos um ambiente produtivo, organizado e rico em conexões, trocas e oportunidades para todos.</p></div></section><main style={S.lista}><div style={S.blocoTexto}>{REGRAS_GRUPO.intro.map((p,i)=><p key={i} style={S.paragrafo}>{p}</p>)}</div>{REGRAS_GRUPO.blocos.map((x:any,i)=>{const t=tons[x.tom];return <article key={i} style={{...S.regraCard,borderLeft:`4px solid ${t.b}`}}><div style={S.regraHead}><span style={S.regraTitulo}>{x.titulo}</span><span style={{...S.regraChip,background:t.bg,color:t.c}}>{t.r}</span></div><p style={S.regraTexto}>{x.texto}</p>{x.itens&&<ul style={S.entregaLista}>{x.itens.map((v:string,j:number)=><li key={j} style={S.entregaItem}>{v}</li>)}</ul>}</article>})}</main></>;
}

type MembroVisto = { id: string; nome: string; foto: string | null; authUserId: string | null };
// Lista de membros para o administrador escolher quem "ver como".
function EscolherMembro({ onFechar, onEscolher }: { onFechar: () => void; onEscolher: (m: MembroVisto) => void }) {
  const [lista, setLista] = useState<{ id: string; nome: string; empresa: string | null; foto_url: string | null; auth_user_id: string | null }[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase.from("membros").select("id,nome,empresa,foto_url,auth_user_id").eq("ativo", true).eq("equipe", false).order("nome")
      .then(({ data }) => setLista(data || []));
  }, []);
  const n = (t: string | null) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const vis = (lista || []).filter((m) => !q || n(m.nome).includes(n(q)) || n(m.empresa).includes(n(q)));
  return (
    <div style={S.overlay} onClick={onFechar}>
      <div style={{ ...S.modal, maxWidth: 480, padding: "26px 22px" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button style={S.modalFechar} onClick={onFechar} aria-label="Fechar">×</button>
        <div style={S.modalEyebrow}>Ver como membro</div>
        <h2 style={S.modalTitulo}>Escolha um membro</h2>
        <p style={{ fontSize: 14, color: "var(--p-muted)", margin: "0 0 14px" }}>Você vê o portal exatamente como ele vê. Só visualização: nada é alterado.</p>
        <input style={S.modalInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou empresa" autoFocus />
        <div style={{ maxHeight: 360, overflowY: "auto", marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {lista === null && <div style={{ color: "var(--p-muted)", fontSize: 14 }}>Carregando...</div>}
          {vis.map((m) => (
            <button key={m.id} onClick={() => onEscolher({ id: m.id, nome: m.nome || "Membro", foto: m.foto_url, authUserId: m.auth_user_id })}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 12, border: "1px solid var(--p-line)", background: "var(--p-card)", cursor: "pointer", textAlign: "left", font: "inherit", color: "var(--p-text)" }}>
              {m.foto_url && !m.foto_url.includes("drive.google")
                ? <img src={m.foto_url} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
                : <span style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--p-accent-bg)", color: "var(--p-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, flex: "none" }}>{(m.nome || "?").charAt(0)}</span>}
              <span style={{ minWidth: 0 }}><span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>{m.nome}</span>
                {m.empresa && <span style={{ display: "block", fontSize: 12.5, color: "var(--p-muted)" }}>{m.empresa}</span>}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortalConteudo({ membro, onSair }) {
  const [filtro, setFiltro] = useState("todos");
  const [confirmacoes, setConfirmacoes] = useState({}); // { [eventoId]: nome }
  const [modalEvento, setModalEvento] = useState(null);
  const [nomeInput, setNomeInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [buscaGeral, setBuscaGeral] = useState("");
  // "Ver como membro" (só administradores): mostra o portal exatamente como um membro escolhido vê, só para olhar.
  const [verComo, setVerComo] = useState<MembroVisto | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [confVisto, setConfVisto] = useState<Record<string, string>>({});
  useEffect(() => {
    setConfVisto({});
    if (!verComo?.authUserId) return;
    supabase.from("presencas").select("evento_id, membro").eq("user_id", verComo.authUserId)
      .then(({ data }) => { const m = {}; (data || []).forEach((p) => { m[p.evento_id] = p.membro; }); setConfVisto(m); });
  }, [verComo]);
  // Administradores veem no menu quantas solicitações de acesso estão em aberto.
  const [solicitacoesAbertas, setSolicitacoesAbertas] = useState(0);
  const atualizarSolicitacoes = () => { if (membro.isAdmin) contarSolicitacoes().then(setSolicitacoesAbertas).catch(() => {}); };
  useEffect(() => { atualizarSolicitacoes(); }, [membro.isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  type Secao = "visao" | "agenda" | "conteudo" | "membros" | "painel" | "perfil" | "entregas" | "cultura" | "regras" | "admin";
  const hashInicial = window.location.hash.replace("#", "").split("/")[0] as Secao; // ex.: #agenda/galeria/... abre a Agenda
  const secoesMembro: Secao[] = ["visao", "painel", "agenda", "conteudo", "membros", "entregas", "cultura", "regras"];
  const secoesValidas: Secao[] = verComo ? secoesMembro : [...(membro.equipe ? [] : ["visao"] as Secao[]), "agenda", "conteudo", "membros", ...(membro.equipe ? ["perfil"] : ["painel", "perfil"]) as Secao[], "entregas", "cultura", "regras", ...(membro.isAdmin ? ["admin" as Secao] : [])];
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(true);

  useEffect(() => {
    supabase
      .from("eventos")
      .select("id, trilha, titulo, quando, dia_semana, data_inicio, inscricoes_abertas, local, galeria, video_url, video_previa_url")
      .eq("ativo", true)
      .order("data_inicio")
      .then(({ data }) => {
        setEventos(
          (data || []).map((e) => ({
            id: e.id,
            trilha: e.trilha,
            titulo: e.titulo,
            quando: e.quando,
            diaSemana: e.dia_semana || "",
            dataOrdenacao: e.data_inicio,
            inscrivel: e.inscricoes_abertas,
            local: e.local,
            galeria: e.galeria,
            videoUrl: e.video_url,
            videoPrevia: e.video_previa_url,
          }))
        );
        setCarregandoEventos(false);
      });
  }, []);
  // Vagas dos eventos (limite, abertura programada, fila, quem já confirmou).
  const [vagas, setVagas] = useState<Record<string, VagaInfo>>({});
  const recarregarVagas = () => carregarVagas(verComo?.id).then(setVagas).catch(() => {});
  useEffect(() => { recarregarVagas(); }, [verComo]); // eslint-disable-line react-hooks/exhaustive-deps
  const eventosComVaga = useMemo(() => eventos.map((e) => ({ ...e, vaga: vagas[e.id] })), [eventos, vagas]);
  const [avisoEvento, setAvisoEvento] = useState("");
  const [secao, setSecao] = useState<Secao>(secoesValidas.includes(hashInicial) ? hashInicial : (membro.equipe ? "admin" : "visao"));

  const mudarSecao = (novaSecao: Secao) => {
    setSecao(novaSecao);
    window.location.hash = novaSecao;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    async function carregarConfirmacoes() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
  
      if (authError || !authData.user) return;
  
      const { data, error } = await supabase
        .from("presencas")
        .select("evento_id, membro")
        .eq("user_id", authData.user.id);
  
      if (error || !data) return;
  
      const mapa = {};
  
      data.forEach((presenca) => {
        mapa[presenca.evento_id] = presenca.membro;
      });
  
      setConfirmacoes(mapa);
    }
  
    carregarConfirmacoes();
  }, []);
  const eventosOrdenados = useMemo(
    () => [...eventos].sort((a, b) => a.dataOrdenacao.localeCompare(b.dataOrdenacao)),
    [eventos]
  );

  const eventosVisiveis = useMemo(() => {
    if (filtro === "todos") return eventosOrdenados;
    return eventosOrdenados.filter((e) => e.trilha === filtro);
  }, [filtro, eventosOrdenados]);

  function abrirConfirmacao(evento) {
    setModalEvento(evento);
    setNomeInput(confirmacoes[evento.id] || membro.nome || "");
    setErro("");
  }

  function fecharModal() {
    setModalEvento(null);
    setNomeInput("");
    setErro("");
    setEnviando(false);
  }

  async function confirmarPresenca() {
    const nome = nomeInput.trim();
    if (nome.length < 2) {
      setErro("Digite seu nome completo para confirmar.");
      return;
    }
    setEnviando(true);
    setErro("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Usuário não autenticado");
      }
      
      const { data: r, error: insertError } = await supabase.rpc("confirmar_presenca", { p_evento: modalEvento.id, p_nome: nome });
      if (insertError) {
        throw insertError;
      }
      if (r !== "confirmado") {
        setEnviando(false);
        recarregarVagas();
        if (r === "lotado") { setErro("lotado"); return; }
        setErro(r === "nao_abriu" ? "As vagas deste encontro ainda não abriram." : "As inscrições deste encontro estão encerradas.");
        return;
      }
      setConfirmacoes((prev) => ({ ...prev, [modalEvento.id]: nome }));
      fecharModal();
      recarregarVagas();
    } catch {
      setErro("Não foi possível confirmar agora. Tente novamente em instantes.");
      setEnviando(false);
    }
  }
  // Fila de espera e "me avise quando abrir".
  const onLista: AcoesVaga["onLista"] = async (evento, tipo, entrar) => {
    if (!entrar) { await supabase.rpc("sair_lista", { p_evento: evento.id, p_tipo: tipo }); recarregarVagas(); return; }
    const { data: r, error } = await supabase.rpc("entrar_lista", { p_evento: evento.id, p_tipo: tipo });
    if (error) { setAvisoEvento("Não foi possível agora. Tente novamente em instantes."); return; }
    if (r === "vaga_livre") { abrirConfirmacao(evento); }
    if (tipo === "fila" && r === "ok") setAvisoEvento("Você entrou na fila de espera. Se alguém desistir, sua presença é confirmada automaticamente e avisamos você no WhatsApp.");
    if (tipo === "aviso" && r === "ok") setAvisoEvento("Pronto! Assim que as vagas abrirem, avisamos você no WhatsApp.");
    recarregarVagas();
  };
  const acoesVaga: AcoesVaga = { onConfirmar: abrirConfirmacao, onCancelar: cancelarPresenca, onLista };

  async function cancelarPresenca(evento) {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
  
      if (authError || !authData.user) {
        throw new Error("Usuário não autenticado");
      }
  
      const { data: rc, error: deleteError } = await supabase.rpc("cancelar_presenca", { p_evento: evento.id });
      if (rc === "prazo") {
        setAvisoEvento("Faltando menos de um dia para o encontro, o cancelamento é feito com a equipe do Ecossistema. Fale com a gente no WhatsApp.");
        return;
      }
      if (deleteError) {
        throw deleteError;
      }
  
      setConfirmacoes((prev) => {
        const novo = { ...prev };
        delete novo[evento.id];
        return novo;
      });
      recarregarVagas();
    } catch {
      setAvisoEvento("Não foi possível cancelar a presença. Tente novamente em instantes.");
    }
  }
  return (
    <PortalShell
      itens={[
        [
          ...(membro.equipe && !verComo ? [] : [{ id: "visao", titulo: "Visão Geral", icone: "casa" as const }, { id: "painel", titulo: "Oportunidades", icone: "aperto" as const }]),
          { id: "membros", titulo: "Meus Membros", icone: "pessoas" as const },
          { id: "conexoes", titulo: "Conexões", icone: "rede" as const, pronto: false },
          { id: "agenda", titulo: "Eventos", icone: "cal" as const },
          { id: "conteudo", titulo: "Conteúdo", icone: "play" as const },
          { id: "dados", titulo: "Inteligência de Dados", icone: "dados" as const, pronto: false },
          { id: "ferramentas", titulo: "Ferramentas", icone: "ferramenta" as const, pronto: false },
        ],
        [
          { id: "perfil", titulo: "Meu Perfil", icone: "eu" as const },
          { id: "entregas", titulo: "Nossas Entregas", icone: "estrela" as const },
          { id: "cultura", titulo: "Cultura", icone: "escudo" as const },
          { id: "regras", titulo: "Regras do Grupo", icone: "info" as const },
          ...(membro.isAdmin && !verComo ? [{ id: "admin", titulo: "Administração", icone: "engrenagem" as const, badge: solicitacoesAbertas },
            { id: "vercomo", titulo: "Ver como membro", icone: "olho" as const }] : []),
        ],
      ].map((g) => verComo ? g.filter((i) => i.id !== "perfil") : g)}
      ativo={secao}
      onIr={(id) => { if (id === "vercomo") { setEscolhendo(true); return; } if (secoesValidas.includes(id as Secao)) mudarSecao(id as Secao); }}
      nome={verComo ? verComo.nome : membro.nome}
      papel={verComo ? "Membro Master" : membro.equipe ? "Equipe Ecossistema" : membro.isAdmin ? "Membro Master · Admin" : "Membro Master"}
      foto={verComo ? verComo.foto : membro.foto}
      onSair={onSair}
      busca={buscaGeral}
      onBusca={(t) => { setBuscaGeral(t); if (secao !== "membros") mudarSecao("membros"); }}
    >
      <style>{CSS}</style>
      {verComo && (
        <div className="faixa-vercomo" role="status">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", flex: "none" }} />
            <span>Você está vendo o portal como <strong>{verComo.nome}</strong> · só visualização, nada é alterado</span>
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEscolhendo(true)}>Trocar membro</button>
            <button onClick={() => { setVerComo(null); mudarSecao("admin"); }}>Sair da visualização</button>
          </span>
        </div>
      )}
      {secao === "visao" && (verComo
        ? <VisaoGeral key={verComo.id} userId="" membroId={verComo.id} nome={verComo.nome} eventos={eventosComVaga} confirmacoes={confVisto}
            onIr={(id) => secoesValidas.includes(id as Secao) && mudarSecao(id as Secao)} />
        : <VisaoGeral userId={membro.userId} nome={membro.nome} eventos={eventosComVaga} confirmacoes={confirmacoes} acoes={acoesVaga}
            onIr={(id) => secoesValidas.includes(id as Secao) && mudarSecao(id as Secao)} />
      )}
      {secao === "agenda" && (
        <Agenda eventos={eventosComVaga} carregando={carregandoEventos} filtro={filtro} setFiltro={setFiltro}
          confirmacoes={verComo ? confVisto : confirmacoes} onConfirmar={verComo ? undefined : abrirConfirmacao} onCancelar={verComo ? undefined : cancelarPresenca} onLista={verComo ? undefined : onLista} />
      )}
      {secao === "conteudo" && <ConteudoMembro />}
      {secao === "membros" && <Membros busca={buscaGeral} admin={membro.isAdmin && !verComo} />}
      {secao === "painel" && (verComo ? <OportunidadesDoMembro key={verComo.id} membroId={verComo.id} nome={verComo.nome} /> : <PainelMembro userId={membro.userId} nome={membro.nome} />)}
      {secao === "perfil" && !verComo && <MeuPerfil userId={membro.userId} equipe={membro.equipe} />}
      {secao === "admin" && membro.isAdmin && !verComo && <Admin onSolicitacoes={atualizarSolicitacoes} />}
      {escolhendo && <EscolherMembro onFechar={() => setEscolhendo(false)} onEscolher={(m) => { setVerComo(m); setEscolhendo(false); mudarSecao("visao"); }} />}
      {secao === "entregas" && <SecaoEntregas />}
      {secao === "cultura" && <SecaoCultura />}
      {secao === "regras" && <SecaoRegras />}


      {modalEvento && (
        <div style={S.overlay} onClick={fecharModal}>
          <div
            style={S.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button style={S.modalFechar} onClick={fecharModal} aria-label="Fechar">
              ×
            </button>
            <div style={S.modalEyebrow}>Confirmar presença</div>
            <h2 style={S.modalTitulo}>{modalEvento.titulo}</h2>
            <div style={S.modalData}>
              {modalEvento.quando} · {modalEvento.diaSemana}
            </div>

            <label style={S.modalLabel} htmlFor="nome-membro">
              Seu nome
            </label>
            <input
              id="nome-membro"
              style={S.modalInput}
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              placeholder="Digite seu nome completo"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarPresenca();
              }}
            />

            {erro && erro !== "lotado" && <div style={S.modalErro}>{erro}</div>}

            {erro === "lotado" ? (
              <div style={{ marginTop: 6 }}>
                <div style={{ background: "color-mix(in srgb, var(--p-warn) 12%, transparent)", color: "var(--p-warn)", borderRadius: 12, padding: "12px 14px", fontSize: 14.5, fontWeight: 600, lineHeight: 1.4 }}>
                  As vagas deste encontro foram 100% preenchidas.
                </div>
                <p style={{ fontSize: 14, color: "var(--p-text2)", lineHeight: 1.5, margin: "12px 0 0" }}>Entre na fila de espera: se alguém desistir, sua presença é confirmada automaticamente e avisamos você no WhatsApp.</p>
                <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={() => { const ev = modalEvento; fecharModal(); onLista(ev, "fila", true); }}>
                  Entrar na fila de espera
                </button>
              </div>
            ) : (
            <button
              className="cta-btn"
              style={{ ...S.ctaBtn, ...S.modalBtn }}
              onClick={confirmarPresenca}
              disabled={enviando}
            >
              {enviando ? "Confirmando..." : vagas[modalEvento.id]?.vagas ? "Garantir minha vaga" : "Confirmar minha presença"}
            </button>
            )}

          </div>
        </div>
      )}
      {avisoEvento && (
        <div style={S.overlay} onClick={() => setAvisoEvento("")}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button style={S.modalFechar} onClick={() => setAvisoEvento("")} aria-label="Fechar">×</button>
            <div style={S.modalEyebrow}>Eventos</div>
            <p style={{ fontSize: 15.5, lineHeight: 1.5, color: "var(--p-text)", margin: "8px 0 0" }}>{avisoEvento}</p>
            <button className="cta-btn" style={{ ...S.ctaBtn, ...S.modalBtn }} onClick={() => setAvisoEvento("")}>Entendi</button>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

// ------------------------------------------------------------
// Estilos
// ------------------------------------------------------------
const S = {

  grupoLabel:{fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--p-accent)",marginBottom:14},
  entregaCard:{background:"linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)",border:"1px solid var(--p-line)",borderRadius:14,marginBottom:12,overflow:"hidden"},
  entregaHead:{display:"flex",alignItems:"center",gap:16,width:"100%",padding:"20px 22px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit"},
  entregaNumero:{fontSize:15,fontWeight:800,color:"var(--p-accent)",minWidth:28},
  entregaHeadTexto:{flex:1,display:"flex",flexDirection:"column",gap:3},
  entregaTitulo:{fontSize:16,fontWeight:800,color:"var(--p-text)"}, entregaResumo:{fontSize:13.5,color:"var(--p-muted)"}, entregaSeta:{fontSize:20,color:"var(--p-accent)",fontWeight:700},
  entregaCorpo:{padding:"0 22px 22px",borderTop:"1px solid var(--p-line)"}, entregaDescricao:{fontSize:14.5,lineHeight:1.65,color:"var(--p-text2)",margin:"18px 0"},
  entregaTopicosTitulo:{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--p-accent)",marginBottom:10},
  entregaLista:{margin:"0 0 18px",paddingLeft:22}, entregaItem:{fontSize:14,lineHeight:1.55,color:"var(--p-text2)",marginBottom:8},
  entregaObjetivo:{background:"color-mix(in srgb, var(--p-accent) 8%, transparent)",border:"1px solid color-mix(in srgb, var(--p-accent) 22%, transparent)",borderRadius:10,padding:"14px 16px",fontSize:14,lineHeight:1.6,color:"var(--p-text)"},
  entregaObjetivoLabel:{display:"block",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--p-accent)",marginBottom:4},
  fecho:{textAlign:"center",fontSize:16,fontWeight:600,color:"var(--p-muted)",fontStyle:"italic",margin:"36px 0 8px"},
  blocoTexto:{marginBottom:24}, paragrafo:{fontSize:15,lineHeight:1.7,color:"var(--p-text2)",margin:"0 0 14px"},
  vmvGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12},
  vmvCard:{background:"linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)",border:"1px solid var(--p-line)",borderRadius:14,padding:"20px 22px",marginBottom:12},
  vmvLabel:{fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--p-accent)",marginBottom:10},
  vmvTexto:{fontSize:14.5,lineHeight:1.6,color:"var(--p-text2)",margin:0}, valoresRow:{display:"flex",flexWrap:"wrap",gap:8},
  valorChip:{fontSize:13,fontWeight:700,color:"var(--p-accent)",background:"color-mix(in srgb, var(--p-accent) 12%, transparent)",border:"1px solid color-mix(in srgb, var(--p-accent) 28%, transparent)",padding:"6px 14px",borderRadius:100},
  mandamentoFrase:{fontSize:15,fontWeight:600,fontStyle:"italic",color:"var(--p-text)",borderLeft:"3px solid var(--p-accent)",paddingLeft:14,marginTop:6},
  regraCard:{background:"linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)",border:"1px solid var(--p-line)",borderRadius:14,padding:"20px 22px",marginBottom:12},
  regraHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10,flexWrap:"wrap"},
  regraTitulo:{fontSize:16,fontWeight:800,color:"var(--p-text)"}, regraChip:{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:6,whiteSpace:"nowrap"},
  regraTexto:{fontSize:14.5,lineHeight:1.65,color:"var(--p-text2)",margin:"0 0 6px"},

  page: {
    minHeight: "100vh",
    background: "#F5F6F2",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#1A1F2B",
  },
  header: { background: "#1A1F2B", padding: "18px 0" },
  headerInner: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 14 },
  logoMark: { position: "relative", width: 30, height: 30 },
  logoDotA: {
    position: "absolute", top: 0, left: 8, width: 12, height: 12,
    borderRadius: "50%", background: "#8BAD3F",
  },
  logoDotB: {
    position: "absolute", bottom: 0, left: 0, width: 12, height: 12,
    borderRadius: "50%", background: "#C9D9A0",
  },
  logoDotC: {
    position: "absolute", bottom: 0, right: 0, width: 12, height: 12,
    borderRadius: "50%", background: "#6B8E23",
  },
  brandEyebrow: {
    fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
    color: "#8BAD3F", fontWeight: 600,
  },
  brandTitle: { fontSize: 17, fontWeight: 700, color: "var(--p-text)" },
  headerNote: { fontSize: 12, color: "#9AA3B2", letterSpacing: 0.5 },
  headerRight: { display: "flex", alignItems: "center", gap: 14 },
  sairBtn: {
    background: "transparent", color: "#B8C0CC", border: "1px solid #3A4150",
    borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "all .15s",
  },

  loginPage: {
    minHeight: "100vh", background: "radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--p-accent) 14%, transparent) 0%, color-mix(in srgb, var(--p-accent) 0%, transparent) 60%), var(--p-bg)", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 20,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  loginCard: {
    background: "linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)", border: "1px solid var(--p-line)", borderRadius: 20, padding: "40px 34px", color: "var(--p-text)",
    maxWidth: 400, width: "100%", boxShadow: "var(--p-shadow-hover)",
  },
  loginEyebrow: {
    fontSize: 15, letterSpacing: "-0.01em",
    color: "var(--p-text)", fontWeight: 700, marginTop: 18, marginBottom: 6,
  },
  loginTitulo: { fontSize: 26, fontWeight: 700, margin: "0 0 6px", color: "var(--p-text)" },
  loginSub: { fontSize: 14, color: "var(--p-muted)", margin: "0 0 26px" },
  linkBtn: {
    display: "block", width: "100%", marginTop: 16, background: "none",
    border: "none", color: "var(--p-accent)", fontSize: 13, fontWeight: 600,
    cursor: "pointer", textAlign: "center", padding: 4,
  },

  hero: { background: "transparent", padding: "0 0 6px" },
  heroInner: { maxWidth: "none", margin: 0, padding: 0 },
  heroEyebrow: {
    fontSize: 12, letterSpacing: 3, textTransform: "uppercase",
    color: "var(--p-accent)", fontWeight: 700, marginBottom: 10,
  },
  heroTitle: {
    fontSize: 28, lineHeight: 1.15, fontWeight: 700, color: "var(--p-text)",
    margin: "0 0 16px", letterSpacing: -0.5,
  },
  heroSub: { fontSize: 15, lineHeight: 1.6, color: "var(--p-muted)", maxWidth: 760, margin: 0 },

  filtroBar: {
    maxWidth: 880, margin: "-28px auto 0", padding: "0 24px 8px",
    display: "flex", gap: 8, flexWrap: "wrap", position: "relative", zIndex: 2,
  },
  filtroBtn: {
    padding: "9px 16px", borderRadius: 100, border: "1px solid #E0E3DC",
    background: "#fff", color: "#4A5568", fontSize: 13, fontWeight: 600,
    cursor: "pointer", transition: "all .15s",
  },
  filtroBtnAtivo: {
    background: "#1A1F2B", color: "var(--p-text)", borderColor: "#1A1F2B",
  },

  lista: { maxWidth: 980, margin: "12px 0 0", padding: "0 0 24px" },
  card: {
    display: "flex", alignItems: "center", gap: 20, background: "#fff",
    border: "1px solid #EAECE6", borderRadius: 14, padding: "20px 22px",
    marginBottom: 12, transition: "box-shadow .15s, transform .15s",
  },
  cardIndex: {
    fontSize: 15, fontWeight: 700, color: "var(--p-muted)",
    minWidth: 28, fontVariantNumeric: "tabular-nums",
  },
  cardBody: { flex: 1, minWidth: 0 },
  tag: {
    display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px",
    borderRadius: 6, letterSpacing: 0.5, marginBottom: 8,
  },
  cardTitulo: { fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: "#1A1F2B" },
  cardData: { fontSize: 14, color: "#5A6472", display: "flex", alignItems: "center", flexWrap: "wrap" },
  cardDivisor: { margin: "0 8px", color: "var(--p-muted)" },
  cardDia: { color: "#8A94A2" },
  cardAcao: { flexShrink: 0 },
  ctaBtn: {
    background: "linear-gradient(180deg,var(--p-accent) 0%,var(--p-accent) 100%)", color: "var(--p-on-accent)", border: "none", borderRadius: 10,
    padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
    transition: "background .15s",
  },
  confirmadoBox: { display: "flex", alignItems: "center", gap: 10 },
  confirmadoCheck: {
    width: 34, height: 34, borderRadius: "50%", background: "#E8F0D8",
    color: "#6B8E23", display: "flex", alignItems: "center",
    justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0,
  },
  confirmadoLabel: { fontSize: 11, color: "#6B8E23", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  confirmadoNome: { fontSize: 14, color: "#1A1F2B", fontWeight: 600 },

  footer: {
    textAlign: "center", padding: "28px 24px", background: "#1A1F2B",
    color: "#8A94A2", fontSize: 12, letterSpacing: 1,
  },

  overlay: {
    position: "fixed", inset: 0, background: "rgba(20,24,34,.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20, zIndex: 50, backdropFilter: "blur(3px)",
  },
  modal: {
    background: "linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)", border: "1px solid var(--p-line2)", color: "var(--p-text)", borderRadius: 18, padding: "32px 28px",
    maxWidth: 420, width: "100%", position: "relative",
    boxShadow: "var(--p-shadow-hover)",
  },
  modalFechar: {
    position: "absolute", top: 14, right: 16, border: "none",
    background: "none", fontSize: 26, color: "#9AA3B2", cursor: "pointer",
    lineHeight: 1,
  },
  modalEyebrow: {
    fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: "var(--p-accent)", fontWeight: 700, marginBottom: 8,
  },
  modalTitulo: { fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "var(--p-text)" },
  modalData: { fontSize: 14, color: "var(--p-muted)", marginBottom: 24 },
  modalLabel: { fontSize: 13, fontWeight: 600, color: "var(--p-text2)", display: "block", marginBottom: 8 },
  modalInput: {
    width: "100%", padding: "13px 15px", borderRadius: 10,
    border: "1.5px solid var(--p-line2)", fontSize: 15, boxSizing: "border-box",
    outline: "none", fontFamily: "inherit", background: "var(--p-field)", color: "var(--p-text)",
  },
  modalErro: { color: "#C0392B", fontSize: 13, marginTop: 10, fontWeight: 500 },
  modalBtn: { width: "100%", marginTop: 18, padding: "14px", fontSize: 15 },
  modalDemo: {
    marginTop: 14, fontSize: 12, color: "#9AA3B2", textAlign: "center", lineHeight: 1.5,
  },
};

const CSS = `
  .filtro-btn:hover { border-color: #8BAD3F; }
  .cta-btn:hover { filter: brightness(1.06); }
  .sair-btn:hover { border-color: #8BAD3F; color: #C9D9A0; }
  .evento-card:hover { box-shadow: 0 8px 24px rgba(26,31,43,.08); transform: translateY(-1px); }
  input:focus, textarea:focus, select:focus { border-color: var(--p-accent) !important; }
  .faixa-vercomo { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:18px; padding:10px 14px; border-radius:14px;
    background: linear-gradient(90deg,#1F9D55,#157A40); color:#fff; font-size:14px; box-shadow:0 8px 20px -10px rgba(31,157,85,.7) }
  .faixa-vercomo button { border:1px solid rgba(255,255,255,.55); background:rgba(255,255,255,.12); color:#fff; border-radius:10px; padding:6px 12px; font:inherit; font-size:13px; font-weight:600; cursor:pointer }
  .faixa-vercomo button:hover { background:rgba(255,255,255,.22) }
  @media (max-width: 640px) {
    .evento-card { flex-direction: column; align-items: flex-start !important; }
  }
`;
