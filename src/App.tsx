import { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabase";
import Membros from "./Membros";
// ============================================================
// ARQUITETURA ATUAL
// Supabase Auth: cadastro, login e sessão dos membros.
// Supabase Database: registro das confirmações de presença.
// ============================================================
// ------------------------------------------------------------
// Dados da agenda (extraídos do PDF oficial 26/27)
// ------------------------------------------------------------
const EVENTOS = [
  {
    id: "imersao-nov-2026",
    trilha: "imersao",
    titulo: "Imersão Ecossistema Master Business",
    quando: "13 e 14 de Novembro de 2026",
    diaSemana: "Sexta e Sábado",
    dataOrdenacao: "2026-11-13",
    inscrivel: true,
  },
  {
    id: "business-day-2026",
    trilha: "business-day",
    titulo: "Ecossistema Business Day",
    quando: "28 de Novembro de 2026",
    diaSemana: "Sábado",
    dataOrdenacao: "2026-11-28",
    inscrivel: true,
  },
  {
    id: "imersao-mar-2027",
    trilha: "imersao",
    titulo: "Imersão Ecossistema Master Business",
    quando: "26 e 27 de Março de 2027",
    diaSemana: "Sexta e Sábado",
    dataOrdenacao: "2027-03-26",
    inscrivel: true,
  },
  {
    id: "imersao-jul-2027",
    trilha: "imersao",
    titulo: "Imersão Ecossistema Master Business",
    quando: "23 e 24 de Julho de 2027",
    diaSemana: "Sexta e Sábado",
    dataOrdenacao: "2027-07-23",
    inscrivel: true,
  },
  {
    id: "imersao-nov-2027",
    trilha: "imersao",
    titulo: "Imersão Ecossistema Master Business",
    quando: "12 e 13 de Novembro de 2027",
    diaSemana: "Sexta e Sábado",
    dataOrdenacao: "2027-11-12",
    inscrivel: true,
  },
  {
    id: "gs-ago-2026",
    trilha: "growth",
    titulo: "Growth Session",
    quando: "19 de Agosto de 2026",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2026-08-19",
    inscrivel: true,
  },
  {
    id: "conselho-set-2026",
    trilha: "conselho",
    titulo: "Reunião de Conselho",
    quando: "16 de Setembro de 2026",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2026-09-16",
    inscrivel: true,
  },
  {
    id: "gs-out-2026",
    trilha: "growth",
    titulo: "Growth Session",
    quando: "14 de Outubro de 2026",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2026-10-14",
    inscrivel: true,
  },
  {
    id: "conselho-nov-2026",
    trilha: "conselho",
    titulo: "Reunião de Conselho",
    quando: "18 de Novembro de 2026",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2026-11-18",
    inscrivel: true,
  },
  {
    id: "gs-dez-2026",
    trilha: "growth",
    titulo: "Growth Session",
    quando: "16 de Dezembro de 2026",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2026-12-16",
    inscrivel: true,
  },
  {
    id: "conselho-jan-2027",
    trilha: "conselho",
    titulo: "Reunião de Conselho",
    quando: "13 de Janeiro de 2027",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2027-01-13",
    inscrivel: true,
  },
  {
    id: "gs-fev-2027",
    trilha: "growth",
    titulo: "Growth Session",
    quando: "17 de Fevereiro de 2027",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2027-02-17",
    inscrivel: true,
  },
  {
    id: "conselho-mar-2027",
    trilha: "conselho",
    titulo: "Reunião de Conselho",
    quando: "17 de Março de 2027",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2027-03-17",
    inscrivel: true,
  },
  {
    id: "gs-abr-2027",
    trilha: "growth",
    titulo: "Growth Session",
    quando: "14 de Abril de 2027",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2027-04-14",
    inscrivel: true,
  },
  {
    id: "conselho-mai-2027",
    trilha: "conselho",
    titulo: "Reunião de Conselho",
    quando: "12 de Maio de 2027",
    diaSemana: "Quarta-feira",
    dataOrdenacao: "2027-05-12",
    inscrivel: true,
  },
];

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

export default function PortalAgenda() {
  const [membroLogado, setMembroLogado] = useState(null);
  const [tela, setTela] = useState("login");
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    async function carregarSessao() {
      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        const user = data.session.user;

        setMembroLogado({
          nome:
            user.user_metadata?.nome ||
            user.email?.split("@")[0] ||
            "Membro",
          login: user.email || "",
        });
      }

      setCarregandoSessao(false);
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = session.user;

        setMembroLogado({
          nome:
            user.user_metadata?.nome ||
            user.email?.split("@")[0] ||
            "Membro",
          login: user.email || "",
        });
      } else {
        setMembroLogado(null);
      }

      setCarregandoSessao(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function entrarMembro(membro) {
    setMembroLogado(membro);
  }

  async function sairMembro() {
    await supabase.auth.signOut();
    setMembroLogado(null);
    setTela("login");
  }

  if (carregandoSessao) {
    return (
      <div style={S.loginPage}>
        <div style={{ color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
          Carregando...
        </div>
      </div>
    );
  }

  if (membroLogado) {
    return <PortalConteudo membro={membroLogado} onSair={sairMembro} />;
  }

  if (tela === "cadastro") {
    return <TelaCadastro onVoltar={() => setTela("login")} />;
  }

  return (
    <TelaLogin
      onEntrar={entrarMembro}
      onIrCadastro={() => setTela("cadastro")}
    />
  );
}

function AuthShell({ children }) {
  return (
    <div style={S.loginPage}>
      <style>{CSS}</style>
      <div style={S.loginCard}>
        <div style={S.logoMark}>
          <span style={S.logoDotA} />
          <span style={S.logoDotB} />
          <span style={S.logoDotC} />
        </div>
        <div style={S.loginEyebrow}>Ecossistema Master Business</div>
        {children}
      </div>
    </div>
  );
}

function TelaLogin({ onEntrar, onIrCadastro }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
    
      if (error || !data.user) {
        throw new Error("invalido");
      }
    
      const nome =
        data.user.user_metadata?.nome ||
        data.user.email?.split("@")[0] ||
        "Membro";
    
      onEntrar({
        nome,
        login: data.user.email || email.trim().toLowerCase(),
      });
          } catch {
      setErro("E-mail ou senha incorretos.");
      setCarregando(false);
    }
  }

  return (
    <AuthShell>
      <h1 style={S.loginTitulo}>Portal de Membros</h1>
      <p style={S.loginSub}>Acesso exclusivo para membros.</p>

      <label style={S.modalLabel} htmlFor="email">E-mail</label>
      <input
        id="email"
        style={S.modalInput}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu e-mail de membro"
        autoFocus
      />
      <label style={{ ...S.modalLabel, marginTop: 14 }} htmlFor="senha">Senha</label>
      <input
        id="senha"
        type="password"
        style={S.modalInput}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="sua senha"
        onKeyDown={(e) => { if (e.key === "Enter") entrar(); }}
      />

      {erro && <div style={S.modalErro}>{erro}</div>}

      <button
        className="cta-btn"
        style={{ ...S.ctaBtn, ...S.modalBtn }}
        onClick={entrar}
        disabled={carregando}
      >
        {carregando ? "Entrando..." : "Entrar"}
      </button>

      <button style={S.linkBtn} onClick={onIrCadastro}>
        Primeiro acesso? Criar minha senha
      </button>
    </AuthShell>
  );
}

function TelaCadastro({ onVoltar }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  async function cadastrar() {
    const emailNormalizado = email.trim().toLowerCase();

    if (nome.trim().length < 2 || !emailNormalizado || senha.length < 6) {
      setErro("Preencha seu nome, e-mail e uma senha de pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailNormalizado,
        password: senha,
        options: {
          data: {
            nome: nome.trim(),
          },
        },
      });

      if (error) {
        const mensagem = error.message.toLowerCase();

        if (
          mensagem.includes("already") ||
          mensagem.includes("registered") ||
          mensagem.includes("exists")
        ) {
          throw new Error("Esse e-mail já possui acesso. Volte e faça login.");
        }

        throw error;
      }

      if (!data.user) {
        throw new Error("Não foi possível criar seu acesso agora.");
      }

    } catch (e) {
      setErro(e?.message || "Não foi possível concluir agora.");
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <AuthShell>
        <h1 style={S.loginTitulo}>Tudo certo!</h1>
        <p style={S.loginSub}>
          Sua senha foi criada. Agora é só entrar com seu e-mail e senha.
        </p>
        <button
          className="cta-btn"
          style={{ ...S.ctaBtn, ...S.modalBtn }}
          onClick={onVoltar}
        >
          Ir para o login
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 style={S.loginTitulo}>Primeiro acesso</h1>
      <p style={S.loginSub}>
        Crie sua senha. Válido para quem já é membro do Ecossistema.
      </p>

      <label style={S.modalLabel} htmlFor="c-nome">Nome completo</label>
      <input
        id="c-nome"
        style={S.modalInput}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="seu nome"
        autoFocus
      />
      <label style={{ ...S.modalLabel, marginTop: 14 }} htmlFor="c-email">E-mail de membro</label>
      <input
        id="c-email"
        style={S.modalInput}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="o e-mail cadastrado no Ecossistema"
      />
      <label style={{ ...S.modalLabel, marginTop: 14 }} htmlFor="c-senha">Crie uma senha</label>
      <input
        id="c-senha"
        type="password"
        style={S.modalInput}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="mínimo 6 caracteres"
        onKeyDown={(e) => { if (e.key === "Enter") cadastrar(); }}
      />

      {erro && <div style={S.modalErro}>{erro}</div>}

      <button
        className="cta-btn"
        style={{ ...S.ctaBtn, ...S.modalBtn }}
        onClick={cadastrar}
        disabled={carregando}
      >
        {carregando ? "Criando..." : "Criar minha senha"}
      </button>

      <button style={S.linkBtn} onClick={onVoltar}>
        Já tenho senha — voltar ao login
      </button>
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
 const tons:any={permitido:{b:"#8BAD3F",bg:"#E8F0D8",c:"#4A6118",r:"Recomendado"},evitar:{b:"#D98A8A",bg:"#F7E4E4",c:"#9A3B3B",r:"Não permitido"},info:{b:"#8A94A2",bg:"#EAECEF",c:"#45505F",r:"Importante"}};
 return <><section style={S.hero}><div style={S.heroInner}><div style={S.heroEyebrow}>Grupo de WhatsApp</div><h1 style={S.heroTitle}>Regras de convivência.<br/>Um ambiente de alto nível.</h1><p style={S.heroSub}>Diretrizes para mantermos um ambiente produtivo, organizado e rico em conexões, trocas e oportunidades para todos.</p></div></section><main style={S.lista}><div style={S.blocoTexto}>{REGRAS_GRUPO.intro.map((p,i)=><p key={i} style={S.paragrafo}>{p}</p>)}</div>{REGRAS_GRUPO.blocos.map((x:any,i)=>{const t=tons[x.tom];return <article key={i} style={{...S.regraCard,borderLeft:`4px solid ${t.b}`}}><div style={S.regraHead}><span style={S.regraTitulo}>{x.titulo}</span><span style={{...S.regraChip,background:t.bg,color:t.c}}>{t.r}</span></div><p style={S.regraTexto}>{x.texto}</p>{x.itens&&<ul style={S.entregaLista}>{x.itens.map((v:string,j:number)=><li key={j} style={S.entregaItem}>{v}</li>)}</ul>}</article>})}</main></>;
}

function PortalConteudo({ membro, onSair }) {
  const [filtro, setFiltro] = useState("todos");
  const [confirmacoes, setConfirmacoes] = useState({}); // { [eventoId]: nome }
  const [modalEvento, setModalEvento] = useState(null);
  const [nomeInput, setNomeInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  type Secao = "agenda" | "membros" | "entregas" | "cultura" | "regras";
  const hashInicial = window.location.hash.replace("#", "") as Secao;
  const secoesValidas: Secao[] = ["agenda", "membros", "entregas", "cultura", "regras"];
  const [secao, setSecao] = useState<Secao>(secoesValidas.includes(hashInicial) ? hashInicial : "agenda");

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
    () => [...EVENTOS].sort((a, b) => a.dataOrdenacao.localeCompare(b.dataOrdenacao)),
    []
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

    const payload = {
      acao: "presenca",
      membro: nome,
      membroLogin: membro.login,
      eventoId: modalEvento.id,
      evento: modalEvento.titulo,
      data: modalEvento.quando,
      trilha: TRILHAS[modalEvento.trilha].rotulo,
      confirmadoEm: new Date().toISOString(),
    };

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Usuário não autenticado");
      }
      
      const { error: insertError } = await supabase
        .from("presencas")
        .insert({
          user_id: authData.user.id,
          membro: nome,
          membro_login: membro.login,
          evento_id: modalEvento.id,
          evento: modalEvento.titulo,
          data_evento: modalEvento.quando,
          trilha: TRILHAS[modalEvento.trilha].rotulo,
          confirmado_em: new Date().toISOString(),
        });
      
      if (insertError) {
        throw insertError;
      }
      setConfirmacoes((prev) => ({ ...prev, [modalEvento.id]: nome }));
      fecharModal();
    } catch {
      setErro("Não foi possível enviar agora. Tente novamente em instantes.");
      setEnviando(false);
    }
  }
  async function cancelarPresenca(evento) {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
  
      if (authError || !authData.user) {
        throw new Error("Usuário não autenticado");
      }
  
      const { error: deleteError } = await supabase
        .from("presencas")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("evento_id", evento.id);
  
      if (deleteError) {
        throw deleteError;
      }
  
      setConfirmacoes((prev) => {
        const novo = { ...prev };
        delete novo[evento.id];
        return novo;
      });
    } catch {
      alert("Não foi possível cancelar a presença.");
    }
  }
  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.brandRow}>
            <div style={S.logoMark}>
              <span style={S.logoDotA} />
              <span style={S.logoDotB} />
              <span style={S.logoDotC} />
            </div>
            <div>
              <div style={S.brandEyebrow}>Ecossistema Master Business</div>
              <div style={S.brandTitle}>Portal de Membros</div>
            </div>
          </div>
          <div style={S.headerRight}>
            <span style={S.headerNote}>{membro.nome}</span>
            <button className="sair-btn" style={S.sairBtn} onClick={onSair}>
              Sair
            </button>
          </div>
        </div>
      </header>
<nav style={{background:"#fff",borderBottom:"1px solid #EAECE6"}}>
        <div style={{maxWidth:880,margin:"0 auto",padding:"10px 24px",display:"flex",gap:8,flexWrap:"wrap"}}>
          {([["agenda","Agenda de Eventos"],["membros","Membros"],["entregas","Nossas Entregas"],["cultura","Cultura"],["regras","Regras do Grupo"]] as [Secao,string][]).map(([id,label])=><button key={id} onClick={()=>mudarSecao(id)} style={{border:0,borderRadius:8,padding:"10px 14px",cursor:"pointer",fontWeight:700,fontFamily:"inherit",background:secao===id?"#1A1F2B":"transparent",color:secao===id?"#fff":"#1A1F2B"}}>{label}</button>)}
        </div>
      </nav>
      {secao === "agenda" && (
  <>
      <section style={S.hero}>
        <div style={S.heroInner}>
          <div style={S.heroEyebrow}>Agenda 26 / 27</div>
          <h1 style={S.heroTitle}>
            Toda a jornada do ano,<br />em um só lugar.
          </h1>
          <p style={S.heroSub}>
            Consulte imersões, business day, growth sessions e reuniões de
            conselho. Confirme sua presença em segundos — é só colocar seu nome.
          </p>
        </div>
      </section>

      <div style={S.filtroBar}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className="filtro-btn"
            style={{
              ...S.filtroBtn,
              ...(filtro === f.id ? S.filtroBtnAtivo : {}),
            }}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <main style={S.lista}>
        {eventosVisiveis.map((evento, i) => {
          const trilha = TRILHAS[evento.trilha];
          const confirmado = confirmacoes[evento.id];
          return (
            <article key={evento.id} className="evento-card" style={S.card}>
              <div style={S.cardIndex}>{String(i + 1).padStart(2, "0")}</div>
              <div style={S.cardBody}>
                <span
                  style={{
                    ...S.tag,
                    background: trilha.cor,
                    color: trilha.corTexto,
                  }}
                >
                  {trilha.rotulo}
                </span>
                <h3 style={S.cardTitulo}>{evento.titulo}</h3>
                <div style={S.cardData}>
                  {evento.quando}
                  <span style={S.cardDivisor}>·</span>
                  <span style={S.cardDia}>{evento.diaSemana}</span>
                </div>
              </div>
              <div style={S.cardAcao}>
              {confirmado ? (
  <button
    onClick={() => cancelarPresenca(evento)}
    title="Clique para cancelar sua presença"
    style={{
      ...S.confirmadoBox,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: 0,
      textAlign: "left",
    }}
  >
    <div style={S.confirmadoCheck}>✓</div>
    <div>
      <div style={S.confirmadoLabel}>Presença confirmada</div>
      <div style={S.confirmadoNome}>{confirmado}</div>
    </div>
  </button>
) : (                  <button
                    className="cta-btn"
                    style={S.ctaBtn}
                    onClick={() => abrirConfirmacao(evento)}
                  >
                    Confirmar presença
                  </button>
                )}
              </div>
            </article>
          );
        })}
    </main>
  </>
)}
      {secao === "membros" && <Membros />}
      {secao === "entregas" && <SecaoEntregas />}
      {secao === "cultura" && <SecaoCultura />}
      {secao === "regras" && <SecaoRegras />}

<footer style={S.footer}>
        Ecossistema Master Business — Portal exclusivo de membros
      </footer>

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

            {erro && <div style={S.modalErro}>{erro}</div>}

            <button
              className="cta-btn"
              style={{ ...S.ctaBtn, ...S.modalBtn }}
              onClick={confirmarPresenca}
              disabled={enviando}
            >
              {enviando ? "Confirmando..." : "Confirmar minha presença"}
            </button>

              <div style={S.modalDemo}>
                Modo demonstração — conecte o webhook do Make para registrar de verdade.
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Estilos
// ------------------------------------------------------------
const S = {

  grupoLabel:{fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#8A94A2",marginBottom:14},
  entregaCard:{background:"#fff",border:"1px solid #EAECE6",borderRadius:14,marginBottom:12,overflow:"hidden"},
  entregaHead:{display:"flex",alignItems:"center",gap:16,width:"100%",padding:"20px 22px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"inherit"},
  entregaNumero:{fontSize:15,fontWeight:800,color:"#C0C6BB",minWidth:28},
  entregaHeadTexto:{flex:1,display:"flex",flexDirection:"column",gap:3},
  entregaTitulo:{fontSize:17,fontWeight:700,color:"#1A1F2B"}, entregaResumo:{fontSize:13.5,color:"#5A6472"}, entregaSeta:{fontSize:20,color:"#8BAD3F",fontWeight:700},
  entregaCorpo:{padding:"0 22px 22px",borderTop:"1px solid #F0F2EC"}, entregaDescricao:{fontSize:14.5,lineHeight:1.65,color:"#3A4250",margin:"18px 0"},
  entregaTopicosTitulo:{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6B8E23",marginBottom:10},
  entregaLista:{margin:"0 0 18px",paddingLeft:22}, entregaItem:{fontSize:14,lineHeight:1.55,color:"#3A4250",marginBottom:8},
  entregaObjetivo:{background:"#F4F7EC",borderRadius:10,padding:"14px 16px",fontSize:14,lineHeight:1.6,color:"#2C3315"},
  entregaObjetivoLabel:{display:"block",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6B8E23",marginBottom:4},
  fecho:{textAlign:"center",fontSize:16,fontWeight:600,color:"#4A5568",fontStyle:"italic",margin:"36px 0 8px"},
  blocoTexto:{marginBottom:24}, paragrafo:{fontSize:15,lineHeight:1.7,color:"#3A4250",margin:"0 0 14px"},
  vmvGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12},
  vmvCard:{background:"#fff",border:"1px solid #EAECE6",borderRadius:14,padding:"20px 22px",marginBottom:12},
  vmvLabel:{fontSize:12,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#6B8E23",marginBottom:10},
  vmvTexto:{fontSize:14.5,lineHeight:1.6,color:"#3A4250",margin:0}, valoresRow:{display:"flex",flexWrap:"wrap",gap:8},
  valorChip:{fontSize:13,fontWeight:600,color:"#2C3315",background:"#E8F0D8",padding:"6px 14px",borderRadius:100},
  mandamentoFrase:{fontSize:15,fontWeight:600,fontStyle:"italic",color:"#2C3315",borderLeft:"3px solid #8BAD3F",paddingLeft:14,marginTop:6},
  regraCard:{background:"#fff",border:"1px solid #EAECE6",borderRadius:14,padding:"20px 22px",marginBottom:12},
  regraHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10,flexWrap:"wrap"},
  regraTitulo:{fontSize:16.5,fontWeight:700,color:"#1A1F2B"}, regraChip:{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:6,whiteSpace:"nowrap"},
  regraTexto:{fontSize:14.5,lineHeight:1.65,color:"#3A4250",margin:"0 0 6px"},

  page: {
    minHeight: "100vh",
    background: "#F5F6F2",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#1A1F2B",
  },
  header: { background: "#1A1F2B", padding: "18px 0" },
  headerInner: {
    maxWidth: 880,
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
  brandTitle: { fontSize: 17, fontWeight: 700, color: "#fff" },
  headerNote: { fontSize: 12, color: "#9AA3B2", letterSpacing: 0.5 },
  headerRight: { display: "flex", alignItems: "center", gap: 14 },
  sairBtn: {
    background: "transparent", color: "#B8C0CC", border: "1px solid #3A4150",
    borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "all .15s",
  },

  loginPage: {
    minHeight: "100vh", background: "#1A1F2B", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 20,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  loginCard: {
    background: "#fff", borderRadius: 20, padding: "40px 34px",
    maxWidth: 400, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,.35)",
  },
  loginEyebrow: {
    fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: "#8BAD3F", fontWeight: 700, marginTop: 20, marginBottom: 6,
  },
  loginTitulo: { fontSize: 26, fontWeight: 800, margin: "0 0 6px", color: "#1A1F2B" },
  loginSub: { fontSize: 14, color: "#5A6472", margin: "0 0 26px" },
  linkBtn: {
    display: "block", width: "100%", marginTop: 16, background: "none",
    border: "none", color: "#6B8E23", fontSize: 13, fontWeight: 600,
    cursor: "pointer", textAlign: "center", padding: 4,
  },

  hero: { background: "#1A1F2B", padding: "12px 0 56px" },
  heroInner: { maxWidth: 880, margin: "0 auto", padding: "0 24px" },
  heroEyebrow: {
    fontSize: 12, letterSpacing: 3, textTransform: "uppercase",
    color: "#8BAD3F", fontWeight: 600, marginBottom: 16,
  },
  heroTitle: {
    fontSize: 40, lineHeight: 1.1, fontWeight: 800, color: "#fff",
    margin: "0 0 16px", letterSpacing: -0.5,
  },
  heroSub: { fontSize: 16, lineHeight: 1.6, color: "#B8C0CC", maxWidth: 520, margin: 0 },

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
    background: "#1A1F2B", color: "#fff", borderColor: "#1A1F2B",
  },

  lista: { maxWidth: 880, margin: "24px auto 0", padding: "0 24px 48px" },
  card: {
    display: "flex", alignItems: "center", gap: 20, background: "#fff",
    border: "1px solid #EAECE6", borderRadius: 14, padding: "20px 22px",
    marginBottom: 12, transition: "box-shadow .15s, transform .15s",
  },
  cardIndex: {
    fontSize: 15, fontWeight: 700, color: "#C0C6BB",
    minWidth: 28, fontVariantNumeric: "tabular-nums",
  },
  cardBody: { flex: 1, minWidth: 0 },
  tag: {
    display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px",
    borderRadius: 6, letterSpacing: 0.5, marginBottom: 8,
  },
  cardTitulo: { fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: "#1A1F2B" },
  cardData: { fontSize: 14, color: "#5A6472", display: "flex", alignItems: "center", flexWrap: "wrap" },
  cardDivisor: { margin: "0 8px", color: "#C0C6BB" },
  cardDia: { color: "#8A94A2" },
  cardAcao: { flexShrink: 0 },
  ctaBtn: {
    background: "#8BAD3F", color: "#1A2410", border: "none", borderRadius: 10,
    padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
    transition: "background .15s",
  },
  confirmadoBox: { display: "flex", alignItems: "center", gap: 10 },
  confirmadoCheck: {
    width: 34, height: 34, borderRadius: "50%", background: "#E8F0D8",
    color: "#6B8E23", display: "flex", alignItems: "center",
    justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0,
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
    background: "#fff", borderRadius: 18, padding: "32px 28px",
    maxWidth: 420, width: "100%", position: "relative",
    boxShadow: "0 24px 60px rgba(0,0,0,.28)",
  },
  modalFechar: {
    position: "absolute", top: 14, right: 16, border: "none",
    background: "none", fontSize: 26, color: "#9AA3B2", cursor: "pointer",
    lineHeight: 1,
  },
  modalEyebrow: {
    fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: "#8BAD3F", fontWeight: 700, marginBottom: 8,
  },
  modalTitulo: { fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "#1A1F2B" },
  modalData: { fontSize: 14, color: "#5A6472", marginBottom: 24 },
  modalLabel: { fontSize: 13, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 8 },
  modalInput: {
    width: "100%", padding: "13px 15px", borderRadius: 10,
    border: "1.5px solid #D8DCD2", fontSize: 15, boxSizing: "border-box",
    outline: "none", fontFamily: "inherit",
  },
  modalErro: { color: "#C0392B", fontSize: 13, marginTop: 10, fontWeight: 500 },
  modalBtn: { width: "100%", marginTop: 18, padding: "14px", fontSize: 15 },
  modalDemo: {
    marginTop: 14, fontSize: 12, color: "#9AA3B2", textAlign: "center", lineHeight: 1.5,
  },
};

const CSS = `
  .filtro-btn:hover { border-color: #8BAD3F; }
  .cta-btn:hover { background: #7A9A35; }
  .sair-btn:hover { border-color: #8BAD3F; color: #C9D9A0; }
  .evento-card:hover { box-shadow: 0 8px 24px rgba(26,31,43,.08); transform: translateY(-1px); }
  input:focus { border-color: #8BAD3F !important; }
  @media (max-width: 640px) {
    .evento-card { flex-direction: column; align-items: flex-start !important; }
  }
`;
