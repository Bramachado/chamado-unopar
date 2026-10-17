/**
 * Autorização por papel, polo e recurso — verificada no SERVIDOR em toda leitura e escrita.
 * (A produção também aplica RLS no SQL Server, mas os predicados não estão versionados; a
 * aplicação não depende deles.)
 *
 * Escopo de chamados:
 *  - admin: todos os polos.
 *  - coordenador e atendente com polo: apenas o próprio polo.
 *  - coordenador e atendente sem polo: apenas chamados que criou ou pelos quais é responsável.
 * Dentro do escopo, a edição é colaborativa (qualquer pessoa do polo complementa o chamado).
 * Excluir chamado: admin ou quem criou. Excluir anexo: admin ou quem anexou.
 */

export type Papel = "admin" | "coordenador" | "atendente";

export interface PerfilAutorizacao {
  id: string;
  papel: string;
  polo_id?: string | null;
}

export interface ChamadoAutorizacao {
  polo_id?: string | null;
  criado_por?: string | null;
  responsavel_id?: string | null;
}

export type EscopoChamados =
  { tipo: "todos" } | { tipo: "polo"; poloId: string } | { tipo: "proprios"; usuarioId: string };

export function escopoDeChamados(perfil: PerfilAutorizacao): EscopoChamados {
  if (perfil.papel === "admin") return { tipo: "todos" };
  if (perfil.polo_id) return { tipo: "polo", poloId: perfil.polo_id.toLowerCase() };
  return { tipo: "proprios", usuarioId: perfil.id.toLowerCase() };
}

const igual = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function podeVerChamado(perfil: PerfilAutorizacao, chamado: ChamadoAutorizacao): boolean {
  const escopo = escopoDeChamados(perfil);
  if (escopo.tipo === "todos") return true;
  if (escopo.tipo === "polo") return igual(chamado.polo_id, escopo.poloId);
  return (
    igual(chamado.criado_por, escopo.usuarioId) || igual(chamado.responsavel_id, escopo.usuarioId)
  );
}

export const podeEditarChamado = podeVerChamado;

/** Polo que pode ser gravado num chamado: não-admin fica sempre no próprio polo. */
export function poloPermitidoParaGravacao(
  perfil: PerfilAutorizacao,
  poloSolicitado: string | null
): string | null {
  if (perfil.papel === "admin") return poloSolicitado || perfil.polo_id || null;
  return perfil.polo_id || null;
}

export function podeExcluirChamado(
  perfil: PerfilAutorizacao,
  chamado: ChamadoAutorizacao
): boolean {
  return (
    podeVerChamado(perfil, chamado) &&
    (perfil.papel === "admin" || igual(chamado.criado_por, perfil.id))
  );
}

export function podeExcluirAnexo(
  perfil: PerfilAutorizacao,
  anexo: { criado_por: string }
): boolean {
  return perfil.papel === "admin" || igual(anexo.criado_por, perfil.id);
}

export const podeGerirMotivos = (p: PerfilAutorizacao) =>
  p.papel === "admin" || p.papel === "coordenador";
export const podeConsolidarMotivos = (p: PerfilAutorizacao) => p.papel === "admin";
export const podeMarcarTeste = (p: PerfilAutorizacao) => p.papel === "admin";
export const podeVerAuditoria = (p: PerfilAutorizacao) => p.papel === "admin";
export const podeGerirUsuarios = (p: PerfilAutorizacao) => p.papel === "admin";
export const podeReatribuirEmLote = (p: PerfilAutorizacao) =>
  p.papel === "admin" || p.papel === "coordenador";

/** Pode ser responsável por chamado do polo: perfil ativo do mesmo polo (ou admin). */
export function podeSerResponsavel(
  candidato: { ativo: boolean; papel: string; polo_id?: string | null },
  poloDoChamado: string | null
): boolean {
  if (!candidato.ativo) return false;
  if (candidato.papel === "admin") return true;
  return !poloDoChamado || igual(candidato.polo_id, poloDoChamado);
}
