/**
 * Ambiente dos testes de integração: aponta a aplicação para o banco de TESTES local
 * (nunca para produção). Sem TESTE_APP_SENHA os testes de integração são ignorados.
 */
export const integracaoHabilitada = Boolean(
  process.env.TESTE_APP_SENHA && process.env.TESTE_DB_SA_SENHA
);

if (integracaoHabilitada) {
  process.env.MSSQL_HOST = "localhost";
  process.env.MSSQL_PORT = process.env.TESTE_DB_PORTA ?? "14333";
  process.env.MSSQL_DATABASE = "ChamadosTeste";
  process.env.MSSQL_USER = "app_chamados";
  process.env.MSSQL_PASSWORD = process.env.TESTE_APP_SENHA;
  process.env.NEXT_PUBLIC_FUSO_INSTITUCIONAL = "America/Sao_Paulo";
  process.env.CRED_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
}
