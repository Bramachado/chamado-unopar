/** Estado de carregamento (distinto de "sem dados" e de erro) enquanto a página busca os dados. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 animate-pulse">
      <span className="sr-only">Carregando…</span>
      <div className="h-7 w-64 rounded-lg bg-superficie-destaque" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-xl border border-borda bg-superficie" />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-borda bg-superficie" />
    </div>
  );
}
