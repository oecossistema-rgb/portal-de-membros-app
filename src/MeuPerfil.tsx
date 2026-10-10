import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Perfil = {
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

const CAMPOS: { id: keyof Perfil; rotulo: string; longo?: boolean; dica?: string }[] = [
  { id: "nome", rotulo: "Nome completo" },
  { id: "empresa", rotulo: "Empresa" },
  { id: "segmento", rotulo: "Segmento", dica: "Ex.: Contabilidade, Engenharia, Saúde" },
  { id: "telefone_whatsapp", rotulo: "WhatsApp", dica: "Com DDD, só números. Ex.: 71999998888" },
  { id: "cidade", rotulo: "Cidade" },
  { id: "estado", rotulo: "Estado (UF)", dica: "Ex.: BA" },
  { id: "site_instagram", rotulo: "Site ou Instagram" },
  { id: "produtos_servicos", rotulo: "Produtos e serviços", longo: true },
  { id: "modelo_negocio", rotulo: "Modelo de negócio", longo: true },
  { id: "conexoes_buscadas", rotulo: "Conexões que você busca", longo: true },
  { id: "como_pode_contribuir", rotulo: "Como você pode contribuir", longo: true },
];

export default function MeuPerfil({ userId }: { userId: string }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("membros")
        .select("id,nome,empresa,segmento,cidade,estado,telefone_whatsapp,site_instagram,foto_url,logo_url,produtos_servicos,modelo_negocio,conexoes_buscadas,como_pode_contribuir")
        .eq("auth_user_id", userId)
        .maybeSingle();
      setPerfil(data as Perfil | null);
      setCarregando(false);
    })();
  }, [userId]);

  function alterar(campo: keyof Perfil, valor: string) {
    setPerfil((p) => (p ? { ...p, [campo]: valor } : p));
    setMsg(null);
  }

  async function salvar() {
    if (!perfil) return;
    setSalvando(true);
    setMsg(null);
    const { id, ...dados } = perfil;
    const limpos = Object.fromEntries(
      Object.entries(dados).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v])
    );
    const { error } = await supabase.from("membros").update(limpos).eq("id", id);
    setSalvando(false);
    setMsg(error ? { tipo: "erro", texto: "Não foi possível salvar. Tente novamente." } : { tipo: "ok", texto: "Perfil salvo." });
  }

  async function enviarFoto(arquivo: File | undefined) {
    if (!arquivo || !perfil) return;
    if (arquivo.size > 2 * 1024 * 1024) {
      setMsg({ tipo: "erro", texto: "A foto deve ter no máximo 2 MB." });
      return;
    }
    setEnviandoFoto(true);
    setMsg(null);
    const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
    const caminho = `${userId}/foto-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("fotos-membros").upload(caminho, arquivo, { contentType: arquivo.type });
    if (error) {
      setEnviandoFoto(false);
      setMsg({ tipo: "erro", texto: "Não foi possível enviar a foto. Use JPG, PNG ou WEBP." });
      return;
    }
    const url = supabase.storage.from("fotos-membros").getPublicUrl(caminho).data.publicUrl;
    const { error: e2 } = await supabase.from("membros").update({ foto_url: url }).eq("id", perfil.id);
    setEnviandoFoto(false);
    if (e2) {
      setMsg({ tipo: "erro", texto: "Foto enviada, mas não foi possível salvar no perfil." });
      return;
    }
    setPerfil({ ...perfil, foto_url: url });
    setMsg({ tipo: "ok", texto: "Foto atualizada." });
  }

  if (carregando) return <main style={ui.lista}><div style={ui.aviso}>Carregando seu perfil...</div></main>;
  if (!perfil) return <main style={ui.lista}><div style={ui.aviso}>Seu perfil não foi encontrado. Fale com a administração do Ecossistema.</div></main>;

  return (
    <>
      <section style={ui.hero}>
        <div style={ui.heroInner}>
          <div style={ui.heroEyebrow}>Meu perfil</div>
          <h1 style={ui.heroTitle}>Como os outros membros<br />vão te encontrar.</h1>
          <p style={ui.heroSub}>Mantenha seus dados atualizados para gerar mais conexões dentro do Ecossistema.</p>
        </div>
      </section>
      <main style={ui.lista}>
        <div style={ui.cartao}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
            {perfil.foto_url ? (
              <img src={perfil.foto_url} alt="Sua foto" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#E8F0D8", color: "#6B8E23", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800 }}>
                {(perfil.nome || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <label style={{ ...ui.botaoSecundario, display: "inline-block" }}>
              {enviandoFoto ? "Enviando..." : perfil.foto_url ? "Trocar foto" : "Enviar foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={enviandoFoto}
                onChange={(e) => enviarFoto(e.target.files?.[0])} />
            </label>
          </div>

          {CAMPOS.map((c) => (
            <div key={c.id} style={{ marginBottom: 16 }}>
              <label style={ui.label} htmlFor={`p-${c.id}`}>{c.rotulo}</label>
              {c.longo ? (
                <textarea id={`p-${c.id}`} style={{ ...ui.input, minHeight: 90, resize: "vertical" }}
                  value={(perfil[c.id] as string) || ""} onChange={(e) => alterar(c.id, e.target.value)} />
              ) : (
                <input id={`p-${c.id}`} style={ui.input} value={(perfil[c.id] as string) || ""}
                  placeholder={c.dica} onChange={(e) => alterar(c.id, e.target.value)} />
              )}
            </div>
          ))}

          {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
          <button className="cta-btn" style={{ ...ui.botao, width: "100%", marginTop: 8 }} onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar meu perfil"}
          </button>
        </div>
      </main>
    </>
  );
}
