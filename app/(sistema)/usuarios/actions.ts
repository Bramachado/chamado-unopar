"use server";

import { criarClienteAdmin } from "@/lib/supabase/admin";
import { obterPerfilAtual } from "@/lib/auth/perfil";
import { cifrarSenha, decifrarSenha } from "@/lib/crypto/cofre";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function revelarSenhaExternaAction(perfilIdAlvo: string) {
  const perfil = await obterPerfilAtual();
  if (perfil.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradoras podem visualizar senhas da plataforma externa." };
  }

  const supabaseAdmin = criarClienteAdmin();

  // 1. Obter IP e User Agent
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "127.0.0.1";
  const userAgent = headerList.get("user-agent") || "Desconhecido";

  // 2. Gravar auditoria em credencial_acessos ANTES de decifrar
  await supabaseAdmin.from("credencial_acessos").insert({
    perfil_alvo_id: perfilIdAlvo,
    acessado_por: perfil.id,
    ip,
    user_agent: userAgent,
  });

  // 3. Buscar credencial cifrada
  const { data: cred, error } = await supabaseAdmin
    .from("credenciais_externas")
    .select("senha_cifrada, iv, auth_tag")
    .eq("perfil_id", perfilIdAlvo)
    .single();

  if (error || !cred) {
    return { sucesso: false, erro: "Nenhuma credencial externa cadastrada para esta usuária." };
  }

  // 4. Decifrar no servidor
  try {
    const senhaPlana = decifrarSenha(cred.senha_cifrada, cred.iv, cred.auth_tag);
    return { sucesso: true, senhaPlana };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao decifrar credencial.";
    return { sucesso: false, erro: msg };
  }
}

export async function alternarStatusUsuarioAction(idAlvo: string, novoAtivo: boolean) {
  const perfil = await obterPerfilAtual();
  if (perfil.papel !== "admin") {
    return { sucesso: false, erro: "Apenas administradoras podem alterar o status de usuárias." };
  }

  // Impedir que a administradora desative a própria conta
  if (perfil.id === idAlvo && !novoAtivo) {
    return { sucesso: false, erro: "Você não pode desativar sua própria conta de administradora." };
  }

  const supabaseAdmin = criarClienteAdmin();
  const { error } = await supabaseAdmin
    .from("perfis")
    .update({ ativo: novoAtivo })
    .eq("id", idAlvo);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/usuarios");
  return { sucesso: true };
}

export async function salvarCredencialExternaAction(perfilIdAlvo: string, senhaPlana: string) {
  const perfil = await obterPerfilAtual();
  const ehAdmin = perfil.papel === "admin";
  const ehPropria = perfil.id === perfilIdAlvo;

  if (!ehAdmin && !ehPropria) {
    return { sucesso: false, erro: "Permissão negada para atualizar esta credencial." };
  }

  const { senhaCifrada, iv, authTag } = cifrarSenha(senhaPlana);
  const supabaseAdmin = criarClienteAdmin();

  const { error } = await supabaseAdmin
    .from("credenciais_externas")
    .upsert({
      perfil_id: perfilIdAlvo,
      senha_cifrada: senhaCifrada,
      iv,
      auth_tag: authTag,
      atualizado_em: new Date().toISOString(),
    });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/usuarios");
  revalidatePath("/perfil");
  return { sucesso: true };
}

export async function criarOuEditarUsuarioAction(_prevState: unknown, formData: FormData) {
  const perfil = await obterPerfilAtual();
  if (perfil.papel !== "admin") {
    return { erro: "Apenas administradoras podem cadastrar ou editar usuárias." };
  }

  const id = formData.get("id") as string | null;
  const nomeCompleto = formData.get("nome_completo") as string;
  const email = formData.get("email") as string;
  const papel = formData.get("papel") as "admin" | "coordenador" | "atendente";
  const senhaInicial = formData.get("senha_inicial") as string | null;
  const senhaExterna = formData.get("senha_externa") as string | null;

  if (!nomeCompleto || !email || !papel) {
    return { erro: "Todos os campos obrigatórios devem ser preenchidos." };
  }

  const supabaseAdmin = criarClienteAdmin();

  if (id) {
    // Edição
    const { error: erroPerfil } = await supabaseAdmin
      .from("perfis")
      .update({
        nome_completo: nomeCompleto,
        email,
        papel,
      })
      .eq("id", id);

    if (erroPerfil) return { erro: erroPerfil.message };

    // Se informou nova senha externa
    if (senhaExterna && senhaExterna.trim().length > 0) {
      await salvarCredencialExternaAction(id, senhaExterna.trim());
    }
  } else {
    // Criação
    if (!senhaInicial || senhaInicial.length < 8) {
      return { erro: "A senha inicial deve conter no mínimo 8 caracteres." };
    }

    const { data: authUser, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senhaInicial,
      email_confirm: true,
      user_metadata: {
        nome_completo: nomeCompleto,
        papel,
      },
    });

    if (erroAuth || !authUser.user) {
      return { erro: erroAuth?.message || "Erro ao criar usuária no sistema de autenticação." };
    }

    // Sincronizar na tabela perfis
    await supabaseAdmin.from("perfis").upsert({
      id: authUser.user.id,
      nome_completo: nomeCompleto,
      email,
      papel,
      ativo: true,
    });

    // Se informou senha externa
    if (senhaExterna && senhaExterna.trim().length > 0) {
      await salvarCredencialExternaAction(authUser.user.id, senhaExterna.trim());
    }
  }

  revalidatePath("/usuarios");
  return { sucesso: true };
}
