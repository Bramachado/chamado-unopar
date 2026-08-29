import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

async function provisionarUsuariosTeste() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
    process.exit(1);
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const usuarios = [
    {
      email: "teste.admin@unopar.br",
      password: "SenhaSegura@2026Admin",
      nome_completo: "Usuária Teste Admin",
      papel: "admin",
      envEmail: "TEST_EMAIL_ADMIN",
      envSenha: "TEST_SENHA_ADMIN",
    },
    {
      email: "teste.coord@unopar.br",
      password: "SenhaSegura@2026Coord",
      nome_completo: "Usuária Teste Coordenadora",
      papel: "coordenador",
      envEmail: "TEST_EMAIL_COORD",
      envSenha: "TEST_SENHA_COORD",
    },
    {
      email: "teste.atend@unopar.br",
      password: "SenhaSegura@2026Atend",
      nome_completo: "Usuária Teste Atendente",
      papel: "atendente",
      envEmail: "TEST_EMAIL_ATEND",
      envSenha: "TEST_SENHA_ATEND",
    },
  ];

  console.log("Iniciando provisionamento das usuárias de teste no Supabase Auth...");

  for (const u of usuarios) {
    // Verificar se usuário já existe
    const { data: listaUsuarios } = await adminClient.auth.admin.listUsers();
    const existente = listaUsuarios?.users?.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());

    let userId: string;

    if (existente) {
      console.log(`Usuária ${u.email} já existe no Auth (ID: ${existente.id}). Atualizando senha e metadados...`);
      const { error } = await adminClient.auth.admin.updateUserById(existente.id, {
        password: u.password,
        user_metadata: {
          nome_completo: u.nome_completo,
          papel: u.papel,
        },
      });
      if (error) console.error(`Erro ao atualizar ${u.email}:`, error.message);
      userId = existente.id;
    } else {
      console.log(`Criando usuária ${u.email} (${u.papel})...`);
      const { data: novo, error } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          nome_completo: u.nome_completo,
          papel: u.papel,
        },
      });
      if (error || !novo.user) {
        console.error(`Erro ao criar ${u.email}:`, error?.message);
        continue;
      }
      userId = novo.user.id;
    }

    // Garantir sincronização na tabela perfis
    const { error: erroPerfil } = await adminClient.from("perfis").upsert({
      id: userId,
      nome_completo: u.nome_completo,
      email: u.email,
      papel: u.papel,
      ativo: true,
    });

    if (erroPerfil) {
      console.error(`Erro ao sincronizar perfil para ${u.email}:`, erroPerfil.message);
    } else {
      console.log(`Perfil sincronizado com sucesso para ${u.email} (papel: ${u.papel}).`);
    }
  }

  // Atualizar .env.local com as credenciais de teste
  const envPath = path.resolve(process.cwd(), ".env.local");
  let conteudoEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  for (const u of usuarios) {
    if (!conteudoEnv.includes(`${u.envEmail}=`)) {
      conteudoEnv += `\n${u.envEmail}=${u.email}\n${u.envSenha}=${u.password}`;
    }
  }

  fs.writeFileSync(envPath, conteudoEnv.trim() + "\n", "utf8");
  console.log("Arquivo .env.local atualizado com as credenciais de teste.");
}

provisionarUsuariosTeste().catch((err) => {
  console.error("Erro fatal ao provisionar usuárias:", err);
  process.exit(1);
});
