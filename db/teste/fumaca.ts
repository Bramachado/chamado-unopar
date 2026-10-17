/**
 * Teste de fumaça: com a aplicação rodando contra o banco de TESTES, emite sessões de teste
 * (AUTH_SECRET do ambiente de teste) e visita as rotas, verificando status e erros.
 *   BASE_URL=http://localhost:3105 AUTH_SECRET=... npx tsx db/teste/fumaca.ts
 */
import { SignJWT } from "jose";
import { IDS } from "./ids";

const BASE = process.env.BASE_URL ?? "http://localhost:3105";

async function token(id: string, papel: string, polo: string | null) {
  return new SignJWT({
    id,
    email: `${id}@teste.local`,
    nome_completo: "Teste",
    papel,
    polo_id: polo,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
}

async function main() {
  const perfis = [
    { nome: "admin", id: IDS.admin, papel: "admin", polo: null },
    { nome: "coordenacao", id: IDS.coordPQB, papel: "coordenador", polo: IDS.poloPQB },
    { nome: "atendente CCJ", id: IDS.atendCCJ, papel: "atendente", polo: IDS.poloCCJ },
  ];
  const rotas = [
    "/painel",
    "/painel?periodo=ultimos_12_meses",
    "/chamados",
    "/chamados?escopo=todos&filtro_prazo=vencidos",
    "/chamados?escopo=todos&situacao=pendentes&reincidentes=true",
    "/chamados/novo",
    `/chamados/${IDS.chNoLimite}`,
    `/chamados/${IDS.chNoLimite}/editar`,
    "/chamados/exportar?escopo=todos",
    "/desempenho",
    "/motivos",
    "/perfil",
    "/usuarios",
    "/auditoria",
    "/auditoria/exportar",
    "/configuracoes",
  ];
  let falhas = 0;
  for (const p of perfis) {
    const cookie = `chamados_unopar_session=${await token(p.id, p.papel, p.polo)}`;
    for (const r of rotas) {
      const res = await fetch(BASE + r, { headers: { cookie }, redirect: "manual" });
      const corpo = await res.text();
      const erroNaPagina =
        /Application error|Erro ao processar|Unhandled Runtime Error|digest/i.test(corpo) &&
        res.status >= 500;
      const esperado =
        (r.startsWith("/usuarios") || r.startsWith("/auditoria")) && p.papel !== "admin"
          ? [307, 308, 403]
          : r.includes(IDS.chNoLimite) && p.polo === IDS.poloCCJ
            ? [404]
            : [200];
      const ok = esperado.includes(res.status) && !erroNaPagina;
      if (!ok) falhas++;
      console.log(
        `${ok ? "OK  " : "FALHA"} ${p.nome.padEnd(13)} ${String(res.status).padEnd(4)} ${r}`
      );
    }
  }
  if (falhas) {
    console.error(`${falhas} falha(s)`);
    process.exit(1);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
