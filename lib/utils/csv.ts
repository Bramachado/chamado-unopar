/**
 * Geração de CSV (separador ";", UTF-8 com BOM para o Excel) com proteção contra injeção de
 * fórmulas: células que começam com = + - @ tab ou CR recebem um apóstrofo à frente, para o
 * Excel/LibreOffice tratarem o conteúdo como texto.
 */

const INICIO_PERIGOSO = /^[=+\-@\t\r]/;

export function celulaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '""';
  let texto = String(valor);
  if (INICIO_PERIGOSO.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function montarCsv(cabecalho: string[], linhas: unknown[][]): string {
  const corpo = [
    cabecalho.map(celulaCsv).join(";"),
    ...linhas.map((l) => l.map(celulaCsv).join(";")),
  ];
  return "﻿" + corpo.join("\r\n");
}
