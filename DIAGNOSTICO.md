# Diagnóstico e correções — Sistema de Chamados da Secretaria (Edunorte)

Branch: `fix/secretaria-datas-indicadores-seguranca` · Outubro/2026

Este documento acompanha o pull request. Ele registra as causas confirmadas no código, o que foi corrigido, como implantar e reverter, o que precisa de decisão da gestão e o que ficou de fora.

---

## 0. Como o trabalho foi feito

- **Ambiente de testes isolado.** Um SQL Server local (Azure SQL Edge em Docker) recebe o schema de produção reconstruído (`db/migrations/0000_baseline.sql`), as migrações novas e dados fictícios que reproduzem cada evidência relatada (`db/teste/preparar.ts`). A aplicação conecta como `app_chamados`, com as mesmas permissões da produção.
- **Produção apenas consultada, nunca alterada.** Li os metadados do schema (colunas, constraints, índices, permissões) e alguns agregados: 82 chamados, 51 motivos, 12 perfis e 273 registros de auditoria, **todos com IP nulo**. Depois disso, o acesso de leitura à produção foi bloqueado pela política da sessão. Os relatórios de dados reais ficaram como scripts somente leitura, para a equipe rodar (seção 4).
- **Limite da leitura.** O usuário `app_chamados` não tem `VIEW DEFINITION`. Por isso não li o código das triggers, de `seg.definir_contexto` nem os predicados de Row-Level Security que a produção aplica. Consultas sem contexto de sessão retornam 0 linhas, o que confirma que o RLS existe. Por esse motivo, toda a autorização foi implementada **na aplicação**, sem depender do RLS.

---

## 1. Diagnóstico — causas confirmadas

### 1.1 Datas, fuso e SLA (prioridade alta)

| Evidência                                                                              | Causa confirmada no código anterior                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chamado 5858008-202610: visualização mostra 01/12 e 22/10; edição mostra 02/12 e 23/10 | As colunas `data_solicitacao` e `prazo` são `DATE`. O driver as entrega como meia-noite UTC. A **visualização** (`chamados/[id]/page.tsx`) enviava o ISO completo e o navegador formatava no fuso -03:00, voltando para o dia anterior. A **edição** usava `toISOString().slice(0,10)` e mostrava o dia certo. O valor gravado é 02/12/2026 (abertura) e 23/10/2026 (prazo): os dados do registro estão inconsistentes (abertura futura e prazo antes da abertura) **e** a visualização deslocava um dia. |
| Formulário mostra 17/10 quando ainda é 16/10                                           | O valor inicial era `new Date().toISOString().split("T")[0]`, ou seja, a data em UTC. A partir das 21h locais já é o dia seguinte. O prazo inicial era agora + 5 dias **corridos**.                                                                                                                                                                                                                                                                                                                       |
| Auditoria e listagem com datas diferentes                                              | A listagem, os contadores, as notificações e o CSV usavam `parseISO`/`new Date` em datas sem hora (deslocamento de um dia). A auditoria exibe instantes. Eram duas representações misturadas.                                                                                                                                                                                                                                                                                                             |
| Prazo vencendo "um dia antes"                                                          | Os contadores da listagem convertiam o prazo para o fuso local: um chamado que vence hoje aparecia como "vencido ontem".                                                                                                                                                                                                                                                                                                                                                                                  |
| Regra de dias úteis                                                                    | Havia **três** implementações (formulário, `lib/agente/auth.ts` e documentação), nenhuma com feriados.                                                                                                                                                                                                                                                                                                                                                                                                    |
| "Concluído no prazo"                                                                   | Comparava o **instante** da conclusão com o prazo à meia-noite UTC. Uma conclusão às 21h01 do último dia contava como atrasada.                                                                                                                                                                                                                                                                                                                                                                           |
| Edição alterava a conclusão                                                            | Salvar um chamado concluído ou encerrado gravava `data_conclusao = agora` **toda vez**, distorcendo o tempo médio e o SLA.                                                                                                                                                                                                                                                                                                                                                                                |

### 1.2 Pontuação de desempenho (108 pontos)

- O componente de volume era `round((resolvidos×2 + encerrados×0,5)×4)`, **sem teto**. Com 6 resolvidos ele já passa de 40. Exemplo: 7 resolvidos no prazo com tempo médio de 3 dias somam 56 + 40 + 12 = **108**.
- Existiam três fórmulas diferentes:
  - **Código:** volume sem teto; agilidade com faixas ≤2/≤4/≤5 dias corridos.
  - **Tela "Critérios":** volume relativo ao maior da equipe; agilidade com faixas ≤1/≤2/≤3/>3.
  - **`DOCUMENTACAO.md`:** volume `min(40, resolvidos×2,67)`.
- A dica "faltam X chamados" dividia a diferença por 4 pontos por chamado, coerente apenas com a fórmula errada.

### 1.3 Indicadores

- O cartão "vencidos" do Dashboard só considerava chamados **abertos no período** e com situação `aguardando`. A listagem considerava o estoque todo. As duas telas mediam coisas diferentes com o mesmo nome.
- Os contadores da listagem eram calculados no navegador sobre os **300** registros carregados.
- O tempo médio era calculado de três formas: no Dashboard, dias corridos arredondados por chamado, incluindo importados; no Desempenho, dias corridos fracionados, excluindo importados; e a documentação falava em "dias úteis".
- A linha de "média" do gráfico de tempo por motivo era uma **constante fixa no código** (2,1 dias).
- A "taxa global" era chamada de "resolução" e comparada à meta de 90% do SLA.

### 1.4 Qualidade dos dados

- O telefone era validado apenas por um filtro de caracteres: aceitava zeros e números sem DDD.
- O RA não tinha nenhuma validação.
- O CPF já era validado, mas só na criação.
- Não havia como separar registros de teste dos indicadores.
- Contas desativadas continuavam como "responsáveis" sem que nada as sinalizasse. O responsável exibido era sempre quem havia criado o chamado.

### 1.5 Catálogo de motivos

- `nome_normalizado` só converte para minúsculas: mantém acentos e espaços internos. A verificação de semelhança usava `LIKE` de substring, então "Problema com conteúdo" e "Problema com o conteúdo" (#47 e #51) passavam despercebidos.
- Não havia controle de concorrência na criação.
- Qualquer perfil, inclusive atendente, podia criar, editar ou desativar motivos.
- Na produção existem outros pares com o mesmo caminho: #3/#14, #21/#30, #20/#35, #39/#44.

### 1.6 Fluxo

- Só havia 4 situações.
- A situação podia ir de qualquer valor para qualquer outro, sem resolução, sem motivo de encerramento e sem justificativa de reabertura.
- O histórico ficava em texto concatenado no campo "observação".
- Não havia controle de edição simultânea: a última gravação sobrescrevia em silêncio.

### 1.7 Segurança, cofre e auditoria (achados críticos)

1. **Chave do cofre no código-fonte.** `lib/crypto/cofre.ts` tinha uma chave "padrão" igual à `CRED_ENCRYPTION_KEY` de produção, versionada no GitHub.
2. **Senha de login recuperável.** Criar ou editar um usuário gravava a senha de **login** no cofre, com cifra reversível. A tela de usuários dizia isso explicitamente.
3. **Acesso a outro polo pelo ID.** Detalhe, edição, gravação, anexos (envio, download e exclusão), busca de vínculo e exportação CSV não verificavam polo nem escopo. Indicadores e ranking de outros polos também ficavam visíveis para atendentes.
4. **Exclusão de anexo quebrada e sem autorização.** O `DELETE` em `arquivos_chamados` não tem permissão no banco, e a rota tentava apagar a trilha de auditoria.
5. **Anexos validados só pelo tipo informado pelo navegador.** O formulário aceitava `.doc` e `.docx`, que o servidor recusava. O conteúdo era gravado em base64 **dentro de `auditoria.logs`**, que a tela e a exportação de auditoria devolviam por inteiro.
6. **IP 127.0.0.1.** As triggers não gravam IP (coluna sempre NULL) e a interface exibia `ip || "127.0.0.1"`. No cofre, `X-Forwarded-For` era aceito sem verificar o proxy.
7. **Auditoria expunha dados sensíveis.** A trigger de perfis gravava o `senha_hash` completo, exibido na tela e no CSV. `campos_alterados` nunca era preenchido.
8. **Login:** sem limite de tentativas; informava "conta desativada" antes de conferir a senha; desativar a conta ou trocar a senha não encerrava as sessões abertas; senha mínima de 6 caracteres.
9. **CSV sem proteção contra fórmulas** (`=`, `+`, `-`, `@`).
10. **Regra de escrita no banco (RLS) mais restrita que o sistema promete.** A política `seg.pol_chamados` (lida durante a preparação da migração) só permite `UPDATE` para papel `admin` ou para a atendente que **criou** o chamado, com o papel tirado do contexto informado pela aplicação. Na produção, a coordenação não altera nenhum chamado, e uma colega do mesmo polo não consegue complementar, transferir ou registrar interação, embora a documentação descreva edição colaborativa. Proposta: migração 0005 (seção 3), que exige decisão.
11. **Textos incorretos:**
    - "Criptografia de ponta a ponta": o servidor decifra, então é criptografia em repouso.
    - "Trilha imutável": a aplicação só tem `INSERT`, mas administradores do banco podem alterar.

---

## 2. Correções implementadas

| Problema                  | Correção                                                                                                                                                                                                                                                                                                                                                                                                                                    | Onde                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Datas civis × instantes   | Datas civis trafegam como `AAAA-MM-DD` (lidas com `CONVERT(char(10), …, 23)`), nunca passam por fuso. Instantes ficam em UTC e são exibidos no fuso institucional configurável (`NEXT_PUBLIC_FUSO_INSTITUCIONAL`, padrão `America/Sao_Paulo`).                                                                                                                                                                                              | `lib/datas.ts`                                              |
| Regra única de SLA        | 5 dias úteis; o dia da abertura não conta; sábados, domingos e feriados nacionais (incluindo Sexta-feira Santa e 20/11) não contam; feriados estaduais, municipais e institucionais vêm de `dados.feriados`. Mudança de situação **não** pausa o prazo.                                                                                                                                                                                     | `lib/sla.ts`, migração 0001                                 |
| Prazo automático × manual | O servidor calcula `prazo_calculado`. O ajuste manual exige justificativa e registra autor e data (em colunas e em evento de histórico). O servidor recusa abertura futura e prazo anterior à abertura. **Abrir e salvar sem mexer nas datas não altera nada**, mesmo em registros antigos inconsistentes, que só geram um aviso.                                                                                                           | `lib/chamados/repositorio.ts`                               |
| Conclusão                 | É definida só ao finalizar, preservada nas edições e limpa na reabertura.                                                                                                                                                                                                                                                                                                                                                                   | `lib/chamados/situacoes.ts`                                 |
| Fluxo                     | Situações novas: em atendimento, aguardando aluno, aguardando retorno externo/PAD; "Resolvido" e "Encerrado sem solução" mantêm os códigos antigos. Transições permitidas definidas em código. Campos obrigatórios: resolução, motivo de encerramento e justificativa de reabertura. Responsável separado do criador, transferência com motivo, interação e próxima ação, status externo e histórico estruturado (`dados.chamado_eventos`). | migração 0002, repositório, tela de detalhe                 |
| Concorrência              | Gravação condicionada à versão (`atualizado_em`). Se outra pessoa salvou antes, a tela avisa e oferece recarregar.                                                                                                                                                                                                                                                                                                                          | repositório                                                 |
| Pontuação                 | Implementação única. Volume relativo ao maior volume da equipe (≤ 40 por construção), prazo proporcional (≤ 40), agilidade por faixas de **dias úteis** (≤ 20). A nota é a soma dos componentes exibidos e não há limitador artificial. Detalhamento por pessoa, com link para os chamados considerados. Versão da fórmula: `2026-10`.                                                                                                      | `lib/indicadores/pontuacao.ts`                              |
| Indicadores               | Definições centralizadas: abertos no período, resolvidos e encerrados no período, estoque atual, vencidos em aberto, resolvidos no prazo. A taxa de resolução (coorte) fica separada da taxa de SLA. Tempo médio em dias úteis, ponderado por chamado. Denominador zero mostra "—". Os cartões levam à listagem com filtros equivalentes, e a exportação usa o mesmo filtro.                                                                | `lib/indicadores/*`, `lib/chamados/filtros.ts`              |
| Listagem                  | Filtros, contadores e paginação no servidor. "Sob minha responsabilidade" passa a usar o responsável atual. Filtros por conclusão, responsável e "vence em até 2 dias". Os filtros são preservados ao abrir e voltar de um chamado. CPF mascarado.                                                                                                                                                                                          | `chamados/page.tsx`, `tabela-chamados.tsx`                  |
| Qualidade de dados        | Telefone normalizado (DDD válido, sem sequências repetidas, opcional de verdade). RA validado (rejeita só zeros e RA igual ao CPF; alerta quando tem formato de CPF). Valores legados só são revalidados se forem alterados. Marcação manual de registro de teste, com justificativa e fora dos indicadores. Pendências por responsável e reatribuição em lote.                                                                             | `lib/utils/*`, repositório, tela Equipe                     |
| Motivos                   | Chave normalizada (sem acentos, caixa ou pontuação; espaços colapsados), igual em código e banco (`dados.fn_chave_texto`). Aviso de duplicidade exata e de semelhantes antes de criar. Índice único filtrado com criações serializadas. Consolidação (admin) move os chamados com evento e auditoria e desativa a origem com justificativa. Catálogo restrito a administração e coordenação.                                                | migração 0003, `lib/motivos/*`                              |
| Autorização               | Política única por papel e polo (`lib/auth/autorizacao.ts`), aplicada em leitura, edição, exclusão, anexos, vínculos, exportações, indicadores e notificações. Acesso por ID fora do escopo devolve 404.                                                                                                                                                                                                                                    | todas as rotas de chamados                                  |
| Cofre                     | Sem chave embutida. A senha de login fica só em bcrypt (custo 12, mínimo de 8 caracteres) e não vai mais para o cofre. Revelar exige reautenticação e justificativa, e registra IP confiável, navegador e justificativa.                                                                                                                                                                                                                    | `lib/crypto/cofre.ts`, `usuarios/actions.ts`, migração 0004 |
| Sessão e login            | `sessao_valida_desde`: desativar a conta ou trocar a senha encerra as sessões. Limite de 5 tentativas em 15 minutos por e-mail e IP. Mensagens que não revelam se a conta existe.                                                                                                                                                                                                                                                           | `lib/auth/*`, `login/actions.ts`                            |
| Auditoria                 | As triggers gravam IP, campos alterados e dados sensíveis redigidos (hash, cofre, CPF mascarado), na mesma transação. A trilha e os eventos são somente inclusão para a aplicação (`DENY UPDATE/DELETE`). Tela e CSV usam o mesmo filtro, excluem conteúdo técnico e redigem registros antigos.                                                                                                                                             | migração 0004, `lib/auditoria/*`                            |
| Anexos                    | Validação por extensão, conteúdo (assinatura de bytes) e tamanho. Gravação na mesma transação do chamado, em `dados.arquivos_conteudo`. Download autorizado, sem cache, `nosniff` e sandbox; tipos não exibíveis são sempre baixados. Exclusão lógica, só por quem anexou ou por admin.                                                                                                                                                     | `lib/storage/*`, `api/anexos`                               |
| CSV e requisição          | Proteção contra fórmulas; exportação auditada; cabeçalhos de segurança; limite de corpo das Server Actions compatível com anexos de 10 MB.                                                                                                                                                                                                                                                                                                  | `lib/utils/csv.ts`, `next.config.ts`                        |
| Usabilidade               | Seletor de data acessível por teclado, com limites e "hoje" no fuso institucional. Rótulos e mensagens de erro ligados aos campos. Nome do motivo junto ao código nos gráficos. Estados distintos para carregamento, vazio e erro. Paginação.                                                                                                                                                                                               | componentes                                                 |

---

## 3. Migrações e plano de reversão

| Versão | Conteúdo                                                                                                                                                                                                                                                                                                             | Reversão (`db/migrations/rollback/`)                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0000   | **Somente testes.** Baseline reconstruído da produção. Não aplicar em produção.                                                                                                                                                                                                                                      | —                                                                                                                                        |
| 0001   | Prazo calculado e ajuste manual; tabela `dados.feriados`.                                                                                                                                                                                                                                                            | Perde a marcação de ajuste e os feriados cadastrados (exportar antes).                                                                   |
| 0002   | Novas situações, responsável, resolução, encerramento, próxima ação, status externo, `eh_teste`, `dados.chamado_eventos`, índices. **Não altera registros existentes** (o responsável antigo é resolvido com `COALESCE` com o criador).                                                                              | As situações novas voltam para `aguardando`; histórico e campos novos são perdidos (exportar antes).                                     |
| 0003   | `dados.fn_chave_texto`, chaves calculadas, índice único filtrado, colunas de consolidação. **Para e lista** os grupos se houver duplicidade exata ativa; nada é unido.                                                                                                                                               | Chamados já consolidados não voltam sozinhos: o motivo de origem está em `chamado_eventos` e na auditoria.                               |
| 0004   | Triggers de auditoria (IP, campos alterados, redação), `revelar_credencial` com justificativa, `sessao_valida_desde`, exclusão lógica de anexos, `dados.arquivos_conteudo`, `DENY` na trilha.                                                                                                                        | Restaura a procedure. **As triggers anteriores precisam ser exportadas da produção antes** (o usuário da aplicação não consegue lê-las). |
| 0005   | Regra de escrita (RLS) de `dados.chamados` igual à da aplicação: admin, mesmo polo ou (sem polo) criadora/responsável; papel lido de `dados.perfis`. **Requer decisão da gestão** (pendência 13). Sem ela, transferência, interação e reatribuição feitas por quem não é admin nem criadora são barradas pelo banco. | Restaura exatamente a regra anterior.                                                                                                    |

As cinco migrações e as cinco reversões foram aplicadas, revertidas e reaplicadas no banco de testes, que reproduz a RLS da produção, sem perda de chamados (`db/teste/testar-reversao.ts`). A reversão da 0002 desliga a RLS só durante o `UPDATE` de situações, porque sem contexto de sessão as linhas ficam invisíveis.

**Situação em 17/10/2026:** etapa "preparar" executada na produção, com backup `ChamadosUnopar_antes_migracoes_20261017T035259.bak` verificado e definições exportadas (9 módulos e 3 predicados RLS). As migrações ainda não foram aplicadas.

**Ordem de implantação:**

1. Backup completo.
2. Exportar com `dbo` as definições atuais das triggers, de `seg.definir_contexto` e das políticas RLS.
3. Aplicar 0001 a 0004 com um usuário DDL: `npm run db:migrar -- --confirmo-banco-remoto`.
4. Publicar a aplicação.

Entre os passos 3 e 4, a versão antiga continua funcionando, **exceto** a revelação de credencial, que passa a exigir justificativa.

---

## 4. Proposta de saneamento (nada foi executado)

`scripts/relatorio-inconsistencias.ts` só faz leitura, numa transação desfeita no final, e gera um CSV com categoria, registro, detalhe e ação sugerida:

- datas inconsistentes (prazo anterior à abertura, abertura futura, conclusão ausente ou incoerente);
- prazos fora da regra, sinalizando os **compatíveis com deslocamento de um dia** (padrão do bug de fuso) para conferência. Eles **não** são corrigidos somando ou subtraindo um dia;
- telefones inválidos, CPF inválido, RA igual ao CPF ou com formato de CPF;
- pendências de contas desativadas;
- **candidatos** a registro de teste (pelo nome), apenas para revisão. A marcação é manual, por admin, e nada é excluído;
- pares de motivos semelhantes;
- contas sem senha definida;
- credenciais do cofre gravadas pela versão anterior.

No banco de testes, o relatório encontrou exatamente as evidências relatadas (chamado 5858008, telefone com zeros, telefone sem DDD, RA igual ao CPF, aluno teste, pendência de conta desativada, #47 × #51).

**Uso na produção:**

```
MSSQL_HOST=... MSSQL_USER=app_chamados MSSQL_PASSWORD=... MSSQL_DATABASE=ChamadosUnopar \
RELATORIO_ADMIN_ID=<id de um admin> npx tsx scripts/relatorio-inconsistencias.ts > inconsistencias.csv
```

**Saneamento sugerido, com aprovação item a item:**

1. Revisar o CSV com a coordenação.
2. Corrigir as datas pela tela, com justificativa.
3. Marcar testes pela tela.
4. Reatribuir pendências pela tela Equipe.
5. Consolidar motivos pela tela Motivos.
6. Trocar as senhas de login das contas que têm entrada no cofre e recadastrar no cofre só as senhas do PAD/AVA.

---

## 5. Testes e checks executados (resultados reais)

| Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Resultado                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | sem erros                                                                                                                                                 |
| `npm test`: unitários (datas, virada do dia em UTC, SLA com fins de semana, feriados, virada de mês e de ano, pontuação com resultados conhecidos, indicadores, transições, telefone, RA, CSV, motivos, IP, limite de login, anexos, autorização, cofre)                                                                                                                                                                                                                                                                  | **48/48**                                                                                                                                                 |
| `npm run test:integracao` (banco de testes, como `app_chamados`): datas exatas, salvar sem alterar, virada UTC, prazo manual, edição simultânea, dados legados, conclusão preservada, reabertura, acesso por ID negado, transferência, IP e atomicidade da auditoria, trilha somente inclusão, anexos, cofre, reatribuição em lote, reconciliação Dashboard × listagem, conclusão às 23h30 no prazo, escopo de polo nos indicadores, pontuação reproduzível, motivos (permissão, duplicidade, concorrência, consolidação) | **24/24** (inclui a RLS real da produção e o `UPDATE` direto no banco barrado fora do escopo)                                                             |
| `next build` (produção)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | sucesso (o único aviso, da biblioteca `jose` no middleware, já existia)                                                                                   |
| Fumaça: build de produção × banco de testes, 16 rotas × 3 perfis (`db/teste/fumaca.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                   | **48/48** status esperados; atendente de outro polo recebe 404, e não admin, redirecionamento; nenhum dado vazou no corpo da resposta; nenhum erro no log |
| Reversão das migrações                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | aplicadas, revertidas e reaplicadas sem perda de chamados                                                                                                 |
| `next lint`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **não executado**: o ESLint nunca foi configurado no projeto (o comando abre um assistente interativo)                                                    |

**O que não foi verificado:**

- uso da interface com leitor de tela;
- contraste medido;
- comportamento com os dados reais de produção;
- predicados de RLS da produção.

---

## 6. Pendências e decisões da gestão

1. **Rotacionar a `CRED_ENCRYPTION_KEY` (urgente).** A chave antiga está no histórico do GitHub. O mesmo vale para a senha do `app_chamados` e para o `AUTH_SECRET`, que circularam fora do cofre durante este trabalho.
2. **Credenciais existentes no cofre** podem ser cópias das senhas de login. Decidir: trocar as senhas de login e recadastrar só as do PAD/AVA.
3. **Fórmula de pontuação:** confirmar a regra adotada (a mesma explicada na tela) e as decisões que a acompanham:
   - período pela data de conclusão;
   - encerrados com peso 0,5 e só no volume;
   - tempo em dias úteis;
   - quem fica sem nota.

   A `DOCUMENTACAO.md` tinha outra fórmula (saturação em 15 resolvidos).

4. **Fuso institucional:** os polos ficam no Pará (`America/Belem`), mas a referência pedida foi `America/Sao_Paulo`. Hoje o deslocamento é igual (-03:00); só diverge se o horário de verão voltar.
5. **Feriados:** cadastrar em `dados.feriados` os estaduais (ex.: 15/08, Adesão do Pará), os municipais de Parauapebas, Canaã e Eldorado e os recessos. Definir se pontos facultativos (Carnaval, Corpus Christi) contam. Ainda não há tela de cadastro (é feito por SQL).
6. **Pausa de SLA** em "aguardando aluno/externo": hoje **não pausa**. Se a instituição quiser pausar, a regra precisa ser definida antes de ser implementada.
7. **Abertura retroativa:** abertura futura é proibida, mas não há limite para datas passadas (necessário para importações). Definir se deve haver limite.
8. **Rascunho conta como pendência e para o SLA.** Confirmar.
9. **Escopo da coordenação:** agora é o próprio polo, como já acontecia na listagem. Antes o Dashboard mostrava todos os polos. Definir se a coordenação deve ver o consolidado.
10. **Formato do RA:** não há regra institucional documentada. Informar o padrão para endurecer a validação.
11. **Troca de senha:** hoje só administradores trocam a própria senha (regra mantida). Avaliar liberar para todos.
12. **API do agente (Prisma):** transições agora exigem `resolucao`, `motivo_encerramento` ou `justificativa`, como na tela. Ajustar o agente antes de publicar.
13. **Regra de escrita do banco (0005):** aprovar o modelo "mesmo polo pode alterar". Sem a 0005, valem as permissões atuais da produção: só admin ou a atendente que criou o chamado alteram.
14. **`PROXIES_CONFIAVEIS=1`** no Easypanel (Traefik), para o IP aparecer na auditoria.

---

## 7. Publicação e verificação após a implantação

1. Configurar o ambiente:
   - `CRED_ENCRYPTION_KEY` (nova, depois de recifrar o cofre: `scripts/rotacionar-chave.md`);
   - `AUTH_SECRET` (novo; derruba as sessões atuais);
   - `PROXIES_CONFIAVEIS=1`;
   - `NEXT_PUBLIC_FUSO_INSTITUCIONAL`, que deve estar presente **no build**.
2. Backup, exportação das definições com `dbo`, migrações 0001 a 0004 e depois o deploy da imagem.
3. Verificar:
   - abrir 5858008-202610: visualização e edição mostram as mesmas datas (02/12 e 23/10) e o aviso de inconsistência;
   - criar um chamado depois das 21h: a abertura sugerida é o dia local;
   - Dashboard: abrir cada cartão e conferir que a contagem da listagem é a mesma; exportar o CSV e conferir o número de linhas;
   - Desempenho: nenhuma nota acima de 100; abrir o detalhamento e conferir a soma;
   - auditoria: uma alteração nova mostra IP e campos alterados; registros de perfis mostram `[redigido]`;
   - atendente: abrir o ID de um chamado de outro polo resulta em "não encontrado";
   - cofre: revelar sem senha ou sem justificativa é recusado; a revelação aparece no histórico com a justificativa.
4. Rodar o relatório de inconsistências e iniciar o saneamento.

---

## 8. Limitações conhecidas

- Os filtros por coluna "estilo Excel" da listagem atuam só na página carregada (está indicado na tela). Os demais filtros são aplicados no servidor.
- As fotos de perfil continuam guardadas em `auditoria.logs` (`perfis_avatar`): ficaram fora das telas de auditoria, mas a mudança de armazenamento ficou para depois.
- O limite de tentativas de login fica na memória do processo e é suficiente para um contêiner. Com mais de uma instância, precisa ir para o banco.
- Feriados: há a regra e a tabela, mas falta a tela de cadastro.
- A acessibilidade foi melhorada no seletor de data, nos formulários e nos diálogos, sem auditoria completa.
