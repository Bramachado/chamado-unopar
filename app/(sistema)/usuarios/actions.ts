"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { decifrarSenha, cifrarSenha } from "@/lib/crypto/cofre";
import { revalidatePath } from "next/cache";

export async function revelarSenhaExternaAction(perfilAlvoId: string): Promise<{
  sucesso: boolean;
  senhaPlana?: string;
  erro?: string;
}> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Sessão expirada." };
  }

  // 1. Validar papel estritamente no servidor
  const { data: perfilAdmin, error: erroPerfil } = await supabase
    .from("perfis")
    .select("papel, ativo")
    .eq("id", user.id)
    .single();

  if (erroPerfil || !perfilAdmin || perfilAdmin.papel !== "admin" || !perfilAdmin.ativo) {
    return { sucesso: false, erro: "Acesso negado: apenas administradoras ativas podem revelar senhas (403)." };
  }

  const cabecalhos = await headers();
  const ip = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const userAgent = cabecalhos.get("user-agent") || "Navegador Desconhecido";

  // 2. Gravar auditoria em credencial_acessos ANTES de retornar o valor
  const adminClient = criarClienteAdmin();
  const { error: erroAudit } = await adminClient.from("credencial_acessos").insert({
    perfil_alvo: perfilAlvoId,
    admin_id: user.id,
    ip,
    user_agent: userAgent,
    data_hora: new Date().toISOString(),
  });

  if (erroAudit) {
    return { sucesso: false, erro: `Falha ao registrar auditoria de acesso: ${erroAudit.message}` };
  }

  // 3. Buscar credencial cifrada no banco via adminClient
  const { data: cred, error: erroCred } = await adminClient
    .from("credenciais_externas")
    .select("senha_cifrada, iv, auth_tag")
    .eq("perfil_id", perfilAlvoId)
    .maybeSingle();

  if (erroCred || !cred) {
    return { sucesso: false, erro: "Nenhuma credencial externa cadastrada para esta usuária." };
  }

  try {
    const senhaBuffer = Buffer.from(cred.senha_cifrada, "hex");
    const ivBuffer = Buffer.from(cred.iv, "hex");
    const authTagBuffer = Buffer.from(cred.auth_tag, "hex");

    const senhaPlana = decifrarSenha(senhaBuffer, ivBuffer, authTagBuffer);
    return { sucesso: true, senhaPlana };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido ao decifrar";
    return { sucesso: false, erro: `Falha na decifragem criptográfica: ${msg}` };
  }
}

export async function salvarCredencialExternaAction(perfilId: string, senhaPlana: string) {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Sessão expirada." };
  }

  // Validar se é a própria usuária ou se é admin
  const { data: perfilLogado } = await supabase
    .from("perfis")
    .select("papel, ativo")
    .eq("id", user.id)
    .single();

  if (!perfilLogado || !perfilLogado.ativo) {
    return { sucesso: false, erro: "Acesso negado." };
  }

  if (perfilLogado.papel !== "admin" && user.id !== perfilId) {
    return { sucesso: false, erro: "Você só pode alterar sua própria senha externa." };
  }

  if (!senhaPlana || senhaPlana.trim().length === 0) {
    return { sucesso: false, erro: "Informe uma senha válida." };
  }

  try {
    const { senhaCifrada, iv, authTag } = cifrarSenha(senhaPlana);
    const adminClient = criarClienteAdmin();

    const { error } = await adminClient
      .from("credenciais_externas")
      .upsert({
        perfil_id: perfilId,
        senha_cifrada: "\\x" + senhaCifrada.toString("hex"),
        iv: "\\x" + iv.toString("hex"),
        auth_tag: "\\x" + authTag.toString("hex"),
        atualizado_em: new Date().toISOString(),
        atualizado_por: user.id,
      });

    if (error) {
      return { sucesso: false, erro: `Erro ao salvar credencial: ${error.message}` };
    }

    revalidatePath("/usuarios");
    revalidatePath("/perfil");
    return { sucesso: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro na cifragem";
    return { sucesso: false, erro: `Falha ao cifrar: ${msg}` };
  }
}

const usuarioSchema = z.object({
  nome_completo: z.string().trim().min(3, "Informe o nome completo da usuária."),
  email: z.string().trim().email("Informe um e-mail válido."),
  papel: z.enum(["admin", "coordenador", "atendente"] as const),
  senha_inicial: z.string().min(6, "A senha de acesso deve ter pelo menos 6 caracteres.").optional().or(z.literal("")),
  senha_externa: z.string().optional().or(z.literal("")),
});

export async function criarOuEditarUsuarioAction(
  _estadoAnterior: { sucesso?: boolean; erro?: string },
  formData: FormData
) {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { erro: "Sessão expirada." };

  const { data: perfilLogado } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (perfilLogado?.papel !== "admin") {
    return { erro: "Apenas administradoras podem gerenciar usuárias." };
  }

  const usuarioId = formData.get("id") ? String(formData.get("id")) : undefined;
  const dados = {
    nome_completo: String(formData.get("nome_completo") || ""),
    email: String(formData.get("email") || ""),
    papel: String(formData.get("papel") || "atendente") as "admin" | "coordenador" | "atendente",
    senha_inicial: String(formData.get("senha_inicial") || ""),
    senha_externa: String(formData.get("senha_externa") || ""),
  };

  const validacao = usuarioSchema.safeParse(dados);
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message || "Dados inválidos." };
  }

  const adminClient = criarClienteAdmin();

  if (usuarioId) {
    // Atualizar perfil
    const { error: erroPerfil } = await adminClient
      .from("perfis")
      .update({
        nome_completo: dados.nome_completo,
        email: dados.email,
        papel: dados.papel,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", usuarioId);

    if (erroPerfil) return { erro: erroPerfil.message };

    // Se informou nova senha externa
    if (dados.senha_externa) {
      await salvarCredencialExternaAction(usuarioId, dados.senha_externa);
    }

    revalidatePath("/usuarios");
    return { sucesso: true };
  } else {
    // Criar nova usuária no auth.users
    if (!dados.senha_inicial || dados.senha_inicial.length < 6) {
      return { erro: "Informe uma senha inicial de pelo menos 6 caracteres para a nova usuária." };
    }

    const { data: novoAuth, error: erroAuth } = await adminClient.auth.admin.createUser({
      email: dados.email,
      password: dados.senha_inicial,
      email_confirm: true,
      user_metadata: {
        nome_completo: dados.nome_completo,
        papel: dados.papel,
      },
    });

    if (erroAuth || !novoAuth.user) {
      return { erro: `Erro ao criar usuária no Auth: ${erroAuth?.message}` };
    }

    // Se informou senha externa
    if (dados.senha_externa) {
      await salvarCredencialExternaAction(novoAuth.user.id, dados.senha_externa);
    }

    revalidatePath("/usuarios");
    return { sucesso: true };
  }
}

export async function alternarStatusUsuarioAction(id: string, ativo: boolean) {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sucesso: false, erro: "Sessão expirada." };

  const { data: perfilLogado } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (perfilLogado?.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradoras podem desativar contas." };
  }

  if (id === user.id) {
    return { sucesso: false, erro: "Você não pode desativar sua própria conta de administradora." };
  }

  const adminClient = criarClienteAdmin();
  const { error } = await adminClient
    .from("perfis")
    .update({ ativo })
    .eq("id", id);

  if (error) return { sucesso: false, erro: error.message };

  revalidatePath("/usuarios");
  return { sucesso: true };
}
