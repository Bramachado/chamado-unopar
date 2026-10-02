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
  _lastUsedAt?: number;
};

export function resetPool(): void {
  try {
    if (globalParaMssql._mssqlPool) {
      globalParaMssql._mssqlPool.close().catch(() => {});
    }
  } catch {}
  globalParaMssql._mssqlPool = undefined;
  globalParaMssql._mssqlConnecting = undefined;
  globalParaMssql._lastUsedAt = undefined;
}

export async function getPool(tentativa = 1): Promise<sql.ConnectionPool> {
  // Se o pool já tem mais de 25 segundos sem uso (típico congelamento serverless), descarta para evitar socket zumbi
  if (
    globalParaMssql._lastUsedAt &&
    Date.now() - globalParaMssql._lastUsedAt > 25000 &&
    globalParaMssql._mssqlPool
  ) {
    resetPool();
  }

  if (globalParaMssql._mssqlPool && globalParaMssql._mssqlPool.connected) {
    globalParaMssql._lastUsedAt = Date.now();
    return globalParaMssql._mssqlPool;
  }

  if (globalParaMssql._mssqlConnecting) {
    return await globalParaMssql._mssqlConnecting;
  }

  const config = getConfig();
  const novoPool = new sql.ConnectionPool(config);

  novoPool.on("error", (err) => {
    console.error("[DB Pool Error]", err);
    resetPool();
  });

  const connectingPromise = novoPool
    .connect()
    .then((poolConectado) => {
      globalParaMssql._mssqlPool = poolConectado;
      globalParaMssql._mssqlConnecting = undefined;
      globalParaMssql._lastUsedAt = Date.now();
      return poolConectado;
    })
    .catch(async (err) => {
      resetPool();
      if (tentativa < 2) {
        console.warn("[DB Pool] Tentando reconectar após erro inicial...", err.message);
        await new Promise((r) => setTimeout(r, 600));
        return getPool(tentativa + 1);
      }
      throw err;
    });

  globalParaMssql._mssqlConnecting = connectingPromise;
  return await connectingPromise;
}

export { sql };
