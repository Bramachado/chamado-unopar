"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatarCpf, mascararCpfExibicao } from "@/lib/utils/cpf";

interface CpfDisplayProps {
  cpf: string | null | undefined;
  className?: string;
  showToggle?: boolean;
}

export function CpfDisplay({ cpf, className = "", showToggle = true }: CpfDisplayProps) {
  const [revelado, setRevelado] = useState(false);

  if (!cpf) {
    return <span className="text-muted-foreground/60 text-xs">Nao informado</span>;
  }

  const formatado = formatarCpf(cpf);
  const mascarado = mascararCpfExibicao(cpf);

  if (!showToggle) {
    return (
      <span className={`font-mono text-xs tabular-nums whitespace-nowrap ${className}`}>
        {mascarado}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums whitespace-nowrap ${className}`}
    >
      <span>{revelado ? formatado : mascarado}</span>
      <button
        type="button"
        onClick={() => setRevelado((prev) => !prev)}
        className="text-muted-foreground/70 hover:text-foreground p-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50"
        title={revelado ? "Ocultar CPF" : "Visualizar CPF completo"}
        aria-label={revelado ? "Ocultar CPF" : "Visualizar CPF completo"}
      >
        {revelado ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}
