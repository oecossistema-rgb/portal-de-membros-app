import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { CartaoResumo } from "./ResumoPerfil";
import type { Resumo } from "./ResumoPerfil";
import { OportunidadesDoMembro } from "./Painel";

type Membro = {
  id: string;
  nome: string | null;
  empresa: string | null;
  segmento: string | null;
  cidade: string | null;
  estado: string | null;
  telefone_whatsapp: string | null;
  site_instagram: string | null;
  foto_url: string | null;
  logo_url: string | null;
  produtos_servicos: string | null;
  modelo_negocio: string | null;
  conexoes_buscadas: string | null;
  como_pode_contribuir: string | null;
  email: string | null;
  resumo_publico: Resumo | null;
};

export default function Membros({ busca: buscaTopo = "", admin = false }: { busca?: string; admin?: boolean } = {}) {
  const [aba, setAba] = useState<"resumo" | "oportunidades">("resumo");
  const [membros, setMembros] = useState<Membro[]>([]);
  const [busca, setBusca] = useState(buscaTopo);
  useEffect(() => { setBusca(buscaTopo); }, [buscaTopo]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState<Membro | null>(null);

  useEffect(() => {
    carregarMembros();
  }, []);

  async function carregarMembros() {
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase
      .from("membros")
      .select(`
        id,
        nome,
        empresa,
        segmento,
        cidade,
        estado,
        telefone_whatsapp,
        site_instagram,
        foto_url,
        logo_url,
        produtos_servicos,
        modelo_negocio,
        conexoes_buscadas,
        como_pode_contribuir,
        email,
        resumo_publico
      `)
      .eq("ativo", true)
      .eq("equipe", false)
      .order("nome", { ascending: true });

    if (error) {
      console.error(error);
      setErro("Não foi possível carregar os membros.");
      setCarregando(false);
      return;
    }

    setMembros(data || []);
    setCarregando(false);
  }

  const membrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) return membros;

    return membros.filter((membro) => {
      return [
        membro.nome,
        membro.empresa,
        membro.segmento,
        membro.cidade,
        membro.estado,
      ]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLowerCase().includes(termo)
        );
    });
  }, [busca, membros]);

  function abrirWhatsapp(numero: string) {
    const telefone = numero.replace(/\D/g, "");

    if (!telefone) return;

    const telefoneFinal = telefone.startsWith("55")
      ? telefone
      : `55${telefone}`;

    window.open(
      `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(
        "Olá! Vi seu perfil no Portal de Membros do Ecossistema Master Business."
      )}`,
      "_blank"
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topo}>
        <div>
          <div style={styles.eyebrow}>Ecossistema Master Business</div>
          <h1 style={styles.titulo}>Membros</h1>
          <p style={styles.subtitulo}>
            Conecte-se com empresários e profissionais do Ecossistema.
          </p>
        </div>

        <div style={styles.contador}>
          {busca.trim() ? membrosFiltrados.length : membros.length} membros
        </div>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, empresa, segmento ou cidade..."
        style={styles.busca}
      />

      {carregando && (
        <div style={styles.mensagem}>Carregando membros...</div>
      )}

      {erro && (
        <div style={styles.erro}>
          {erro}
          <button onClick={carregarMembros} style={styles.tentar}>
            Tentar novamente
          </button>
        </div>
      )}

      {!carregando && !erro && (
        <div style={styles.grid}>
          {membrosFiltrados.map((membro) => (
            <article key={membro.id} style={styles.card}>
              <div style={styles.fotoArea}>
                {membro.foto_url ? (
                  <img
                    src={membro.foto_url}
                    alt={membro.nome || "Membro"}
                    style={styles.foto}
                    loading="lazy"
                    onError={(e) => {
                      const el = e.currentTarget; el.style.display = "none";
                      const ini = document.createElement("div"); Object.assign(ini.style, { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "44px", fontWeight: "600", color: "var(--p-accent-text)", background: "var(--p-accent-bg)" });
                      ini.textContent = (membro.nome || "?").charAt(0).toUpperCase(); el.parentElement?.appendChild(ini);
                    }}
                  />
                ) : (
                  <div style={styles.avatar}>
                    {(membro.nome || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div style={styles.cardConteudo}>
                <h2 style={styles.nome}>
                  {membro.nome || "Nome não informado"}
                </h2>

                {membro.empresa && (
                  <div style={styles.empresa}>{membro.empresa}</div>
                )}

                {membro.segmento && (
                  <div style={styles.segmento}>{membro.segmento}</div>
                )}

                {(membro.cidade || membro.estado) && (
                  <div style={styles.local}>
                    {[membro.cidade, membro.estado]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                )}

                <div style={styles.acoes}>
                  <button
                    style={styles.perfilBtn}
                    onClick={() => { setAba("resumo"); setSelecionado(membro); }}
                  >
                    Ver perfil
                  </button>

                  {membro.telefone_whatsapp && (
                    <button
                      style={styles.whatsappBtn}
                      onClick={() =>
                        abrirWhatsapp(membro.telefone_whatsapp!)
                      }
                    >
                      WhatsApp
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!carregando &&
        !erro &&
        membrosFiltrados.length === 0 && (
          <div style={styles.mensagem}>
            Nenhum membro encontrado.
          </div>
        )}

      {selecionado && (
        <div
          style={styles.overlay}
          onClick={() => setSelecionado(null)}
        >
          <div
            style={admin && aba === "oportunidades" ? { ...styles.modal, maxWidth: 1120 } : styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelecionado(null)}
              style={styles.fechar}
            >
              ×
            </button>

            <div style={styles.modalTopo}>
              {selecionado.foto_url ? (
                <img
                  src={selecionado.foto_url}
                  alt={selecionado.nome || "Membro"}
                  style={styles.modalFoto}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div style={styles.modalAvatar}>
                  {(selecionado.nome || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div>
                <h2
                  style={{
                    ...styles.modalNome,
                    color: "var(--p-text)",
                    fontSize: 26,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    margin: "0 0 6px",
                  }}
                >
                  {selecionado.nome}
                </h2>

                <div style={styles.modalEmpresa}>
                  {selecionado.empresa}
                </div>

                <div style={styles.modalSegmento}>
                  {selecionado.segmento}
                </div>
              </div>
            </div>

            {admin && (
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                {([["resumo", "Resumo"], ["oportunidades", "Oportunidades"]] as const).map(([id, r]) => (
                  <button key={id} onClick={() => setAba(id)} style={{ background: aba === id ? "color-mix(in srgb, var(--p-accent) 12%, transparent)" : "var(--p-card)", color: "var(--p-text)", border: `1px solid ${aba === id ? "var(--p-accent)" : "var(--p-line2)"}`, borderRadius: 100, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
                ))}
                <span style={{ alignSelf: "center", fontSize: 12, color: "var(--p-muted)" }}>Só administradores veem esta aba.</span>
              </div>
            )}

            {admin && aba === "oportunidades" ? (
              <div className="pv" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <OportunidadesDoMembro membroId={selecionado.id} nome={selecionado.nome || ""} />
              </div>
            ) : selecionado.resumo_publico ? (
              <div style={{ marginTop: 20 }}>
                <CartaoResumo resumo={selecionado.resumo_publico} />
              </div>
            ) : (
              <>
            {(selecionado.cidade || selecionado.estado) && (
              <Bloco
                titulo="Localização"
                texto={[selecionado.cidade, selecionado.estado]
                  .filter(Boolean)
                  .join(" / ")}
              />
            )}

            {selecionado.produtos_servicos && (
              <Bloco
                titulo="Produtos e serviços"
                texto={selecionado.produtos_servicos}
              />
            )}

            {selecionado.modelo_negocio && (
              <Bloco
                titulo="Modelo de negócio"
                texto={selecionado.modelo_negocio}
              />
            )}

            {selecionado.conexoes_buscadas && (
              <Bloco
                titulo="Conexões que busca"
                texto={selecionado.conexoes_buscadas}
              />
            )}

            {selecionado.como_pode_contribuir && (
              <Bloco
                titulo="Como pode contribuir"
                texto={selecionado.como_pode_contribuir}
              />
            )}

            {selecionado.email && (
              <Bloco titulo="E-mail" texto={selecionado.email} />
            )}

            {selecionado.site_instagram && (
              <Bloco
                titulo="Site / Instagram"
                texto={selecionado.site_instagram}
              />
            )}
              </>
            )}

            {selecionado.telefone_whatsapp && (
              <button
                style={{
                  ...styles.whatsappBtn,
                  width: "100%",
                  marginTop: 20,
                }}
                onClick={() =>
                  abrirWhatsapp(selecionado.telefone_whatsapp!)
                }
              >
                Conversar pelo WhatsApp
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Bloco({
  titulo,
  texto,
}: {
  titulo: string;
  texto: string;
}) {
  return (
    <div style={styles.bloco}>
      <div style={styles.blocoTitulo}>{titulo}</div>
      <div style={styles.blocoTexto}>{texto}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    textAlign: "left",
  },

  topo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 20,
    marginBottom: 28,
  },

  eyebrow: {
    fontSize: 14,
    letterSpacing: 0,
    fontWeight: 600,
    color: "var(--p-accent-text)",
  },

  titulo: {
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: -0.5,
    margin: "8px 0 6px",
    color: "var(--p-text)",
  },

  subtitulo: {
    margin: 0,
    color: "var(--p-muted)",
  },

  contador: {
    fontSize: 13,
    fontWeight: 700,
    background: "color-mix(in srgb, var(--p-accent) 10%, transparent)",
    color: "var(--p-accent)",
    padding: "8px 14px",
    borderRadius: 20,
  },

  busca: {
    width: "100%",
    boxSizing: "border-box",
    padding: "15px 18px",
    borderRadius: 12,
    border: "1px solid var(--p-line)",
    fontSize: 15,
    outline: "none",
    marginBottom: 22,
    background: "var(--p-field)",
    color: "var(--p-text)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  },

  card: {
    background: "linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid var(--p-line)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
    display: "flex",
    flexDirection: "column",
    minHeight: 330,
  },

  fotoArea: {
    // Foto grande, quadrada, ocupando a largura do cartão (dá para reconhecer a pessoa).
    aspectRatio: "1 / 1",
    width: "100%",
    background: "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--p-accent) 18%, transparent) 0%, color-mix(in srgb, var(--p-accent) 0%, transparent) 60%), var(--p-card2)",
    borderBottom: "1px solid var(--p-line)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  foto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center 30%",
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 28,
    background: "linear-gradient(145deg,var(--p-line),var(--p-accent-bg))",
    border: "1px solid var(--p-line2)",
    boxShadow: "0 0 22px -8px var(--p-accent)",
    color: "var(--p-accent)",
    fontSize: 28,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  cardConteudo: {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },

  nome: {
    fontSize: 16,
    fontWeight: 700,
    margin: "0 0 5px",
    color: "var(--p-text)",
  },

  empresa: {
    fontWeight: 600,
    fontSize: 14,
    color: "var(--p-accent)",
    marginBottom: 5,
  },

  segmento: {
    fontSize: 13,
    color: "var(--p-muted)",
    minHeight: 36,
  },

  local: {
    marginTop: 10,
    fontSize: 12,
    color: "var(--p-muted)",
  },

  acoes: {
    display: "flex",
    gap: 8,
    marginTop: "auto",
    paddingTop: 18,
  },

  perfilBtn: {
    flex: 1,
    border: "1px solid var(--p-line2)",
    background: "linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)",
    color: "var(--p-text)",
    padding: "9px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  whatsappBtn: {
    flex: 1,
    border: 0,
    background: "linear-gradient(180deg,var(--p-accent) 0%,var(--p-accent) 100%)",
    color: "var(--p-on-accent)",
    padding: "10px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },

  mensagem: {
    textAlign: "center",
    padding: 50,
    color: "var(--p-muted)",
  },

  erro: {
    textAlign: "center",
    padding: 30,
    color: "var(--p-danger)",
  },

  tentar: {
    marginLeft: 12,
    padding: "8px 14px",
    cursor: "pointer",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    position: "relative",
    background: "linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)",
    width: "100%",
    maxWidth: 720,
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    borderRadius: 20,
    padding: "clamp(18px, 4vw, 32px)",
    boxSizing: "border-box",
    boxShadow: "0 28px 80px rgba(0,0,0,.28)",
  },

  fechar: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    border: 0,
    borderRadius: "50%",
    background: "var(--p-hover)",
    color: "var(--p-text)",
    fontSize: 25,
    lineHeight: 1,
    cursor: "pointer",
    zIndex: 2,
  },

  modalTopo: {
    display: "flex",
    flexWrap: "wrap",
    gap: 22,
    alignItems: "center",
    marginBottom: 8,
    paddingRight: 46,
    paddingBottom: 24,
    borderBottom: "1px solid var(--p-line)",
  },

  modalFoto: {
    width: 168,
    height: 168,
    borderRadius: 24,
    objectFit: "cover",
    objectPosition: "center 30%",
    boxShadow: "var(--p-shadow-hover)",
    flex: "0 0 auto",
  },

  modalAvatar: {
    width: 168,
    height: 168,
    borderRadius: 24,
    flex: "0 0 auto",
    background: "linear-gradient(180deg,var(--p-accent) 0%,var(--p-accent) 100%)",
    color: "var(--p-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
    fontWeight: 700,
  },

  modalNome: {
    margin: 0,
    fontSize: 24,
  },

  modalEmpresa: {
    marginTop: 5,
    fontWeight: 700,
    color: "var(--p-accent)",
  },

  modalSegmento: {
    marginTop: 4,
    color: "var(--p-muted)",
  },

  bloco: {
    padding: "16px 0",
    borderTop: "1px solid var(--p-line)",
  },

  blocoTitulo: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "var(--p-accent)",
    marginBottom: 6,
  },

  blocoTexto: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--p-text2)",
    whiteSpace: "pre-wrap",
  },
};
