# Procedimento Operacional Padrão: Rotação de Chave Criptográfica

Este documento descreve o procedimento para rotacionar a chave `CRED_ENCRYPTION_KEY` utilizada pelo cofre de senhas da tabela `credenciais_externas`.

---

## 1. Contexto de Segurança

As senhas da plataforma externa são armazenadas na tabela `credenciais_externas` utilizando cifragem autenticada **AES-256-GCM** com IV aleatório de 12 bytes por registro.
A chave é fornecida pela variável de ambiente `CRED_ENCRYPTION_KEY` (32 bytes codificados em Base64).

---

## 2. Pré-requisitos

1. Acesso administrativo ao servidor / VPS (EasyPanel / Hostinger).
2. Nova chave de 32 bytes gerada:
   ```bash
   openssl rand -base64 32
   ```
3. Backup prévio do banco de dados antes da rotação.

---

## 3. Procedimento de Rotação

### Passo 1: Gerar a nova chave
Execute no terminal local ou do servidor:
```bash
NOVA_CHAVE=$(openssl rand -base64 32)
echo "Nova chave gerada: $NOVA_CHAVE"
```

### Passo 2: Executar script de recifragem
O script de recifragem lê os registros com a chave antiga, decifra em memória e regrava com a nova chave e novos IVs:
```bash
npx tsx scripts/executar-rotacao-chave.ts --chave-antiga "$CRED_ENCRYPTION_KEY" --nova-chave "$NOVA_CHAVE"
```

### Passo 3: Atualizar variável de ambiente no servidor
No painel do EasyPanel / Hostinger, atualize a variável:
```env
CRED_ENCRYPTION_KEY=<NOVA_CHAVE>
```

### Passo 4: Reiniciar a aplicação
Reinicie o container da aplicação Next.js para carregar a nova variável.

### Passo 5: Validação
1. Acesse o sistema como Administradora.
2. Acesse a tela de Usuárias e solicite a revelação de uma credencial para confirmar a integridade pós-rotação.
3. Verifique se o acesso foi registrado em `credencial_acessos`.
