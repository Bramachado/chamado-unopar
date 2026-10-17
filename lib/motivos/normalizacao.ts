/**
 * Normalização e semelhança de motivos.
 *
 * - chaveTexto: mesma regra de dados.fn_chave_texto (migração 0003) — minúsculas, sem acentos,
 *   pontuação como espaço, espaços colapsados. Duplicidade EXATA = mesma (chave do nome, chave do
 *   caminho) entre motivos ativos; o índice único do banco é a garantia final.
 * - Semelhança (para aviso, nunca para unir automaticamente): mesmo caminho, ou nomes com
 *   palavras significativas muito parecidas (artigos e preposições ignorados).
 */

export function chaveTexto(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .toLowerCase()
    .trim()
    .replace(/[º°]/g, "o")
    .replace(/ª/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:/\\\-_()[\]{}"'!?>|+*&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Padroniza a grafia do nome para gravação: espaços simples e sem espaços nas pontas. */
export function padronizarNome(nome: string): string {
  return nome.replace(/\s+/g, " ").trim();
}

const PALAVRAS_VAZIAS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "com",
  "para",
  "por",
  "ao",
  "aos",
  "à",
  "se",
]);

function palavras(texto: string): Set<string> {
  return new Set(
    chaveTexto(texto)
      .split(" ")
      .filter((p) => p && !PALAVRAS_VAZIAS.has(p))
  );
}

/** Índice de Jaccard entre as palavras significativas (0 a 1). */
export function similaridadeNomes(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 && pb.size === 0) return 1;
  let inter = 0;
  for (const p of pa) if (pb.has(p)) inter++;
  return inter / (pa.size + pb.size - inter);
}

export interface MotivoComparavel {
  id: string;
  codigo: string;
  nome: string;
  filtro: string | null;
  ativo: boolean;
}

export type TipoSemelhanca = "duplicado_exato" | "mesmo_caminho" | "nome_semelhante";

export interface Semelhanca {
  motivo: MotivoComparavel;
  tipo: TipoSemelhanca;
  similaridade: number;
}

export const LIMIAR_NOME_SEMELHANTE = 0.6;

export function encontrarSemelhantes(
  candidato: { nome: string; filtro: string | null; id?: string },
  catalogo: MotivoComparavel[]
): Semelhanca[] {
  const chaveNome = chaveTexto(candidato.nome);
  const chaveFiltro = chaveTexto(candidato.filtro);
  const resultado: Semelhanca[] = [];
  for (const m of catalogo) {
    if (m.id === candidato.id) continue;
    const sim = similaridadeNomes(candidato.nome, m.nome);
    const mesmoNome = chaveTexto(m.nome) === chaveNome;
    const mesmoFiltro = chaveFiltro !== "" && chaveTexto(m.filtro) === chaveFiltro;
    let tipo: TipoSemelhanca | null = null;
    if (mesmoNome && chaveTexto(m.filtro) === chaveFiltro) tipo = "duplicado_exato";
    else if (mesmoFiltro) tipo = "mesmo_caminho";
    else if (mesmoNome || sim >= LIMIAR_NOME_SEMELHANTE) tipo = "nome_semelhante";
    if (tipo) resultado.push({ motivo: m, tipo, similaridade: Math.round(sim * 100) / 100 });
  }
  const ordem: Record<TipoSemelhanca, number> = {
    duplicado_exato: 0,
    mesmo_caminho: 1,
    nome_semelhante: 2,
  };
  return resultado.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || b.similaridade - a.similaridade);
}

/** Pares de motivos ATIVOS semelhantes entre si, para o relatório de revisão do catálogo. */
export function paresSemelhantes(
  catalogo: MotivoComparavel[]
): { a: MotivoComparavel; b: MotivoComparavel; tipo: TipoSemelhanca; similaridade: number }[] {
  const ativos = catalogo.filter((m) => m.ativo);
  const pares: {
    a: MotivoComparavel;
    b: MotivoComparavel;
    tipo: TipoSemelhanca;
    similaridade: number;
  }[] = [];
  for (let i = 0; i < ativos.length; i++) {
    const outros = ativos.slice(i + 1);
    for (const s of encontrarSemelhantes({ ...ativos[i]!, id: ativos[i]!.id }, outros)) {
      pares.push({ a: ativos[i]!, b: s.motivo, tipo: s.tipo, similaridade: s.similaridade });
    }
  }
  return pares;
}
