import sql from "mssql";

function getConfig(): sql.config {
  return {
    user: process.env.MSSQL_USER || "app_chamados",
    password: process.env.MSSQL_PASSWORD || "",
    database: process.env.MSSQL_DATABASE || "ChamadosUnopar",
    server: process.env.MSSQL_HOST || "localhost",
    port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT, 10) : 1433,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

let globalPool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (globalPool && globalPool.connected) {
    return globalPool;
  }
  if (globalPool && globalPool.connecting) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getPool();
  }
  const config = getConfig();
  globalPool = new sql.ConnectionPool(config);
  await globalPool.connect();
  return globalPool;
}

export { sql };
