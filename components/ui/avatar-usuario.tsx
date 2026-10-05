"use client";

import { useState } from "react";
import { extrairIniciaisNome } from "@/lib/utils/iniciais";

interface AvatarUsuarioProps {
  nome: string;
  fotoUrl?: string | null;
  tamanho?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  indicadorStatus?: boolean;
  statusOnline?: boolean;
}

const mapTamanhos = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-14 w-14 text-base font-bold",
  "2xl": "h-24 w-24 text-2xl font-bold",
};

export function AvatarUsuario({
  nome,
  fotoUrl,
  tamanho = "md",
  className = "",
  indicadorStatus = false,
  statusOnline = true,
}: AvatarUsuarioProps) {
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const classesTamanho = mapTamanhos[tamanho] || mapTamanhos.md;
  const iniciais = extrairIniciaisNome(nome);

  const temFotoValida = Boolean(fotoUrl && !erroCarregamento);

  return (
    <div className={`relative inline-flex shrink-0 select-none rounded-full ${className}`}>
      {temFotoValida ? (
        <img
          src={fotoUrl!}
          alt={nome || "Foto de perfil"}
          onError={() => setErroCarregamento(true)}
          className={`rounded-full object-cover border border-borda/80 shadow-xs ${classesTamanho}`}
        />
      ) : (
        <div
          title={nome}
          className={`flex items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 font-semibold text-white tracking-wider shadow-xs border border-white/10 ${classesTamanho}`}
        >
          <span>{iniciais}</span>
        </div>
      )}

      {indicadorStatus && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-superficie ${
            tamanho === "xs" || tamanho === "sm" ? "h-2 w-2" : "h-3 w-3"
          } ${statusOnline ? "bg-emerald-500" : "bg-slate-400"}`}
        />
      )}
    </div>
  );
}
