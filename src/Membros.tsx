import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

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
};

export default function Membros() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [busca, setBusca] = useState("");
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
        como_pode_contribuir
      `)
      .eq("ativo", true)
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
          {membrosFiltrados.length} membros
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
                    onClick={() => setSelecionado(membro)}
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
            style={styles.modal}
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
                />
              ) : (
                <div style={styles.modalAvatar}>
                  {(selecionado.nome || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div>
                <h2 style={styles.modalNome}>
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

            {selecionado.site_instagram && (
              <Bloco
                titulo="Site / Instagram"
                texto={selecionado.site_instagram}
              />
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
    maxWidth: 1100,
    margin: "0 auto",
    padding: "40px 24px 70px",
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
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: 700,
    color: "#8BAD3F",
  },

  titulo: {
    fontSize: 38,
    margin: "6px 0",
    color: "#1A1F2B",
  },

  subtitulo: {
    margin: 0,
    color: "#667085",
  },

  contador: {
    fontSize: 13,
    fontWeight: 700,
    background: "#E9EEDB",
    color: "#46551F",
    padding: "8px 14px",
    borderRadius: 20,
  },

  busca: {
    width: "100%",
    boxSizing: "border-box",
    padding: "15px 18px",
    borderRadius: 12,
    border: "1px solid #D7DBD0",
    fontSize: 15,
    outline: "none",
    marginBottom: 30,
    background: "#FFFFFF",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(250px, 1fr))",
    gap: 20,
  },

  card: {
    background: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #E5E7E2",
    boxShadow: "0 4px 14px rgba(0,0,0,.05)",
  },

  fotoArea: {
    height: 190,
    background: "#EEF1E8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  foto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: "50%",
    background: "#1A1F2B",
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  cardConteudo: {
    padding: 20,
  },

  nome: {
    fontSize: 18,
    margin: "0 0 5px",
    color: "#1A1F2B",
  },

  empresa: {
    fontWeight: 600,
    fontSize: 14,
    color: "#46551F",
    marginBottom: 5,
  },

  segmento: {
    fontSize: 13,
    color: "#667085",
    minHeight: 36,
  },

  local: {
    marginTop: 10,
    fontSize: 12,
    color: "#8A919D",
  },

  acoes: {
    display: "flex",
    gap: 8,
    marginTop: 18,
  },

  perfilBtn: {
    flex: 1,
    border: "1px solid #1A1F2B",
    background: "#FFFFFF",
    color: "#1A1F2B",
    padding: "9px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  whatsappBtn: {
    flex: 1,
    border: 0,
    background: "#1A1F2B",
    color: "#FFFFFF",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },

  mensagem: {
    textAlign: "center",
    padding: 50,
    color: "#667085",
  },

  erro: {
    textAlign: "center",
    padding: 30,
    color: "#A33",
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
    background: "#FFFFFF",
    width: "100%",
    maxWidth: 650,
    maxHeight: "85vh",
    overflowY: "auto",
    borderRadius: 18,
    padding: 28,
  },

  fechar: {
    position: "absolute",
    top: 12,
    right: 16,
    border: 0,
    background: "transparent",
    fontSize: 30,
    cursor: "pointer",
  },

  modalTopo: {
    display: "flex",
    gap: 20,
    alignItems: "center",
    marginBottom: 24,
  },

  modalFoto: {
    width: 100,
    height: 100,
    borderRadius: 14,
    objectFit: "cover",
  },

  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 14,
    background: "#1A1F2B",
    color: "#FFFFFF",
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
    color: "#46551F",
  },

  modalSegmento: {
    marginTop: 4,
    color: "#667085",
  },

  bloco: {
    padding: "16px 0",
    borderTop: "1px solid #ECEEE8",
  },

  blocoTitulo: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#8BAD3F",
    marginBottom: 6,
  },

  blocoTexto: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#333A45",
    whiteSpace: "pre-wrap",
  },
};
