// Cartão de boas-vindas (imagem 1080x1080, visual 3D) personalizado com o nome do membro.
// É montado como SVG e convertido em PNG na hora do envio; nada fica guardado.
// Sem dependências: o mesmo arquivo é usado pela função e pelo teste local.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// "SANDRO SANPER DE OLIVEIRA" -> "Sandro Sanper": primeiro e segundo nome, com iniciais maiúsculas.
export function nomeCartao(nome: string): string {
  const minusc = new Set(["da", "de", "do", "das", "dos", "e"]);
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean).map((p, i) =>
    i > 0 && minusc.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  if (partes.length <= 2) return partes.join(" ");
  // primeiro + próximo nome que não seja preposição
  const seg = partes.slice(1).find((p) => !minusc.has(p));
  return [partes[0], seg].filter(Boolean).join(" ");
}

export function svgCartao(nome: string, logoPngBase64: string): string {
  const n = nomeCartao(nome) || "membro";
  // Tamanho da letra do nome: o maior que cabe em ~700px de largura (Inter Bold ≈ 0,62 da altura por letra).
  const tam = Math.round(Math.max(52, Math.min(96, 700 / (0.62 * Math.max(n.length, 1)))));
  // Piso em perspectiva (linhas convergindo para o centro): dá a sensação de profundidade.
  const piso: string[] = [];
  for (let i = -10; i <= 10; i++) piso.push(`<line x1="${540 + i * 22}" y1="760" x2="${540 + i * 150}" y2="1080" />`);
  for (const y of [775, 800, 835, 880, 940, 1010]) piso.push(`<line x1="0" y1="${y}" x2="1080" y2="${y}" />`);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <radialGradient id="fundo" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#0E2A1A"/><stop offset="0.55" stop-color="#05110B"/><stop offset="1" stop-color="#010302"/>
    </radialGradient>
    <radialGradient id="brilho" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#2BE36B" stop-opacity="0.38"/><stop offset="1" stop-color="#2BE36B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vidro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.13"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.05"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="borda" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.45"/><stop offset="0.5" stop-color="#2BE36B" stop-opacity="0.25"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="selo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6CF59C"/><stop offset="0.55" stop-color="#22C55E"/><stop offset="1" stop-color="#0E8A3E"/>
    </linearGradient>
    <linearGradient id="seloLado" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0B6E31"/><stop offset="1" stop-color="#063D1C"/>
    </linearGradient>
    <linearGradient id="reflexo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="pisoCor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2BE36B" stop-opacity="0.45"/><stop offset="1" stop-color="#2BE36B" stop-opacity="0.05"/>
    </linearGradient>
    <filter id="sombra" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="40" stdDeviation="40" flood-color="#000000" flood-opacity="0.75"/>
    </filter>
    <filter id="luzAzul" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="luzVerde" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
    <clipPath id="redondo"><circle cx="540" cy="190" r="70"/></clipPath>
  </defs>

  <rect width="1080" height="1080" fill="url(#fundo)"/>
  <ellipse cx="540" cy="470" rx="520" ry="380" fill="url(#brilho)"/>
  <g stroke="url(#pisoCor)" stroke-width="1.6">${piso.join("")}</g>

  <!-- logo com luz azul -->
  <circle cx="540" cy="190" r="80" fill="none" stroke="#3BA7FF" stroke-width="10" opacity="0.8" filter="url(#luzAzul)"/>
  <circle cx="540" cy="190" r="72" fill="none" stroke="#5FB8FF" stroke-width="3"/>
  <image x="470" y="120" width="140" height="140" clip-path="url(#redondo)" xlink:href="data:image/png;base64,${logoPngBase64}" href="data:image/png;base64,${logoPngBase64}"/>

  <!-- cartão de vidro flutuando -->
  <g filter="url(#sombra)">
    <rect x="130" y="320" width="820" height="590" rx="56" fill="#0A1A12" fill-opacity="0.82"/>
  </g>
  <rect x="130" y="320" width="820" height="590" rx="56" fill="url(#vidro)" stroke="url(#borda)" stroke-width="3"/>
  <path d="M186 324 H894 Q946 324 946 376 V420 Q540 360 134 430 V376 Q134 324 186 324 Z" fill="#FFFFFF" opacity="0.05"/>

  <!-- selo 3D de aprovado -->
  <ellipse cx="540" cy="512" rx="96" ry="26" fill="#000000" opacity="0.45" filter="url(#luzVerde)"/>
  <circle cx="540" cy="440" r="78" fill="#2BE36B" opacity="0.55" filter="url(#luzVerde)"/>
  <circle cx="540" cy="452" r="74" fill="url(#seloLado)"/>
  <circle cx="540" cy="438" r="74" fill="url(#selo)"/>
  <ellipse cx="540" cy="404" rx="52" ry="26" fill="url(#reflexo)" opacity="0.55"/>
  <path d="M506 440 L530 464 L578 414" fill="none" stroke="#06371A" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" transform="translate(0,5)"/>
  <path d="M506 440 L530 464 L578 414" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>

  <text x="540" y="580" text-anchor="middle" font-family="Inter" font-weight="700" font-size="26" letter-spacing="9" fill="#4AF08A">ACESSO APROVADO</text>
  <text x="540" y="636" text-anchor="middle" font-family="Inter" font-weight="600" font-size="38" fill="#E9F0EC">Bem-vindo(a),</text>
  <text x="540" y="${648 + tam}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${tam}" fill="#FFFFFF">${esc(n)}!</text>
  <text x="540" y="${712 + tam + 18}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="30" fill="#C9D3CD">Seu perfil no Portal de Membros está liberado.</text>
  <text x="540" y="${712 + tam + 62}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="30" fill="#C9D3CD">Agora é conexão, negócio e crescimento.</text>

  <text x="540" y="990" text-anchor="middle" font-family="Inter" font-weight="600" font-size="22" letter-spacing="12" fill="#FFFFFF" opacity="0.85">ECOSSISTEMA</text>
  <text x="540" y="1028" text-anchor="middle" font-family="Inter" font-weight="800" font-size="30" letter-spacing="3" fill="#FFFFFF">MASTER BUSINESS</text>
</svg>`;
}
