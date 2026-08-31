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

function PortalConteudo({ membro, onSair }) {
  const [filtro, setFiltro] = useState("todos");
  const [confirmacoes, setConfirmacoes] = useState({}); // { [eventoId]: nome }
  const [modalEvento, setModalEvento] = useState(null);
  const [nomeInput, setNomeInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [secao, setSecao] = useState<"agenda" | "membros">("agenda");
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
<nav
  style={{
    background: "#fff",
    borderBottom: "1px solid #E5E7E2",
    padding: "0 24px",
  }}
>
  <div
    style={{
      maxWidth: 1100,
      margin: "0 auto",
      display: "flex",
      gap: 8,
      padding: "12px 0",
    }}
  >
    <button
      onClick={() => setSecao("agenda")}
      style={{
        border: 0,
        borderRadius: 8,
        padding: "10px 16px",
        cursor: "pointer",
        fontWeight: 700,
        background: secao === "agenda" ? "#1A1F2B" : "transparent",
        color: secao === "agenda" ? "#fff" : "#1A1F2B",
      }}
    >
      Agenda
    </button>

    <button
      onClick={() => setSecao("membros")}
      style={{
        border: 0,
        borderRadius: 8,
        padding: "10px 16px",
        cursor: "pointer",
        fontWeight: 700,
        background: secao === "membros" ? "#1A1F2B" : "transparent",
        color: secao === "membros" ? "#fff" : "#1A1F2B",
      }}
    >
      Membros
    </button>
  </div>
</nav>
      {secao === "agenda" ? (
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
) : (
  <Membros />
)}

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
