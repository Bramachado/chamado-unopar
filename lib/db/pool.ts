import sql from "mssql";

function limpaVar(val?: string): string {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "");
}

function getConfig(): sql.config {
  return {
    user: limpaVar(process.env.MSSQL_USER) || "app_chamados",
    password: limpaVar(process.env.MSSQL_PASSWORD) || "",
    database: limpaVar(process.env.MSSQL_DATABASE) || "ChamadosUnopar",
    server: limpaVar(process.env.MSSQL_HOST) || "localhost",
    port: process.env.MSSQL_PORT ? parseInt(limpaVar(process.env.MSSQL_PORT), 10) : 1433,
    connectionTimeout: 15000,
    requestTimeout: 15000,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0, // Serverless: nunca manter conexões zumbis abertas durante o congelamento de contêiner
      idleTimeoutMillis: 30000,
    },
  };
}

// Singleton global persistente em ambientes Serverless/Node.js
const globalParaMssql = globalThis as unknown as {
  _mssqlPool?: sql.ConnectionPool;
  _mssqlConnecting?: Promise<sql.ConnectionPool>;
};

export async function getPool(): Promise<sql.ConnectionPool> {
  if (globalParaMssql._mssqlPool && globalParaMssql._mssqlPool.connected) {
    return globalParaMssql._mssqlPool;
  }

  if (globalParaMssql._mssqlConnecting) {
    return await globalParaMssql._mssqlConnecting;
  }

  const config = getConfig();
  const novoPool = new sql.ConnectionPool(config);

  novoPool.on("error", (err) => {
    console.error("[DB Pool Error]", err);
    globalParaMssql._mssqlPool = undefined;
    globalParaMssql._mssqlConnecting = undefined;
  });

  const connectingPromise = novoPool
    .connect()
    .then((poolConectado) => {
      globalParaMssql._mssqlPool = poolConectado;
      globalParaMssql._mssqlConnecting = undefined;
      return poolConectado;
    })
    .catch((err) => {
      globalParaMssql._mssqlConnecting = undefined;
      globalParaMssql._mssqlPool = undefined;
      throw err;
    });

  globalParaMssql._mssqlConnecting = connectingPromise;
  return await connectingPromise;
}

export { sql };
