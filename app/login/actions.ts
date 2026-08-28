"use server";

import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email("Informe um endereço de e-mail válido."),
  senha: z.string().min(1, "Informe a senha de acesso."),
});

export type EstadoLogin = {
  erro?: string;
  sucesso?: boolean;
};

export async function autenticarUsuario(
  _estadoAnterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const dados = {
    email: formData.get("email"),
    senha: formData.get("senha"),
  };

  const validacao = loginSchema.safeParse(dados);
  if (!validacao.success) {
    return {
      erro: validacao.error.issues[0]?.message ?? "Dados de formulário inválidos.",
    };
  }

  const { email, senha } = validacao.data;
  const supabase = await criarClienteServidor();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (authError || !authData.user) {
    // Mensagem genérica para não vazar se o e-mail existe no banco
    return {
      erro: "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.",
    };
  }

  // Verificar se o perfil da usuária está ativo
  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select("ativo, papel, nome_completo")
    .eq("id", authData.user.id)
    .single();

  if (perfilError || !perfil) {
    await supabase.auth.signOut();
    return {
      erro: "Perfil de usuária não localizado no sistema. Contate a administração.",
    };
  }

  if (perfil.ativo === false) {
    await supabase.auth.signOut();
    return {
      erro: "Esta conta de usuária foi desativada pela coordenação/administração.",
    };
  }

  redirect("/painel");
}
