import { ROTULO_SITUACAO, ehSituacao } from "@/lib/chamados/situacoes";
import { classificarPrazo, type ClassificacaoPrazo } from "@/lib/sla";
import { diferencaDiasCorridos, formatarDataCivil, type DataCivil } from "@/lib/datas";

const CORES: Record<string, string> = {
  rascunho: "bg-fundo text-texto-suave border-borda border-dashed",
  aguardando: "bg-acento/15 text-acento border-acento/40",
  em_atendimento: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40",
  aguardando_aluno: "bg-alerta-fundo text-alerta border-alerta/40",
  aguardando_externo: "bg-alerta-fundo text-alerta border-alerta/40",
  concluido: "bg-sucesso/15 text-sucesso border-sucesso/40",
  encerrado: "bg-fundo text-texto-suave border-borda",
};

export function SituacaoBadge({
  situacao,
  className = "",
}: {
  situacao: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${CORES[situacao] ?? CORES.aguardando} ${className}`}
    >
      {ehSituacao(situacao) ? ROTULO_SITUACAO[situacao] : situacao}
    </span>
  );
}

const ROTULO_PRAZO: Record<ClassificacaoPrazo, string> = {
  vencido: "Vencido",
  vence_hoje: "Vence hoje",
  vence_em_breve: "Vence em breve",
  no_prazo: "No prazo",
};

export function rotuloPrazo(
  prazo: DataCivil,
  hoje: DataCivil
): { classe: ClassificacaoPrazo; texto: string } {
  const classe = classificarPrazo(prazo, hoje);
  const diff = diferencaDiasCorridos(hoje, prazo);
  const texto =
    classe === "vencido"
      ? `Vencido há ${-diff} dia${-diff > 1 ? "s" : ""}`
      : classe === "vence_hoje"
        ? "Vence hoje"
        : classe === "vence_em_breve"
          ? `Vence em ${diff} dia${diff > 1 ? "s" : ""}`
          : `Até ${formatarDataCivil(prazo, "curto")}`;
  return { classe, texto };
}

export function PrazoBadge({ prazo, hoje }: { prazo: DataCivil; hoje: DataCivil }) {
  const { classe, texto } = rotuloPrazo(prazo, hoje);
  const cor =
    classe === "vencido"
      ? "bg-erro-fundo text-erro border-erro/40"
      : classe === "no_prazo"
        ? "bg-fundo text-texto-suave border-borda"
        : "bg-alerta-fundo text-alerta border-alerta/40";
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${cor}`}
      title={ROTULO_PRAZO[classe]}
    >
      {texto}
    </span>
  );
}
