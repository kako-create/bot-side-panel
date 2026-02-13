# BOT Side Panel

Extensão Chrome para apoio operacional em builders de BOT e URA, com foco em consulta, comparação e navegação rápida.

Status deste documento: atualizado com o estado real do projeto em **13/02/2026**.

## Objetivo

Reduzir tempo de análise/manutenção de fluxos, oferecendo no side panel:

- sincronização local dos dados do fluxo;
- busca rápida e busca avançada em payload;
- sincronização e análise de variáveis/TAGs;
- comparação entre dois registros sincronizados;
- abertura direta do bloco no builder.

## Escopo funcional atual

### 1. Contexto e autenticação

- Captura de `botId` e URL atual do builder.
- Captura de token Bearer a partir das chamadas XHR/fetch da própria página.
- Compatível com os domínios:
  - `https://bots.digitalcontact.cloud`
  - `https://new.boteria.com.br`
- Links de abertura de bloco respeitam o domínio em uso.

### 2. Sincronização (Consulta)

- `Sinc. Busca rápida`: sincroniza resumo (grupos + itens resumidos).
- `Sinc. Busca avançada`: sincroniza payload completo dos blocos.
- Estado de sincronização com progresso e telemetria básica no painel.
- Navegação por grupos com abrir/fechar.

### 3. Modo BOT/URA centralizado

- O modo canônico é definido no **full sync** (`Sinc. Busca avançada`) e salvo em `meta.mode`.
- Regras de uso:
  - TAGs e Variáveis só sincronizam se `meta.mode` existir.
  - Comparação só executa com `mode` válido nos dois registros selecionados.
  - Não há inferência distribuída por tela para decisões críticas.

### 4. Tela Variáveis

- Sincroniza por endpoint correto conforme `meta.mode` (BOT ou URA).
- Agrupa variáveis por categoria de origem.
- Atalho de busca no payload pela aba de consulta.
- Botão de sincronização bloqueado quando modo ainda não foi definido via full sync.

### 5. Tela TAGs

- Sincroniza por endpoint correto conforme `meta.mode` (BOT ou URA).
- Exibe dois blocos:
  - TAGs sincronizadas.
  - TAGs não usadas.
- Cálculo de TAG não usada:
  - varre o full payload;
  - valida referência apenas no array `payload.tags`.
- Exibe aviso quando full sync está mais antigo que a sync de TAGs, incluindo diferença de tempo.
- Seções com botão de recolher/exibir.

### 6. Tela Comparação

- Compara dois registros com full sync salvo (selecionados nos combos).
- Bloqueia comparação BOT x URA.
- Resultado inclui:
  - resumo geral de diferenças;
  - grupos recolhíveis;
  - blocos alterados com detalhes de merge/diff por campo;
  - filtro por propriedade alterada;
  - links para abrir bloco A/B no builder.
- Ignora campos instáveis de comparação como `positionOnScreen` e `updatedAt`, além de IDs.

### 7. Tela Armazenamento

- Lista registros sincronizados, com métricas e datas.
- Fixar/desfixar e remover registro.
- Agrupamento por organização (empresa), com abrir/fechar grupos.
- Captura `fantasyName` por interceptação do endpoint:
  - `https://api.bots.digitalcontact.cloud/api/v3/companies/<orgId>`
- Dados de organização ficam persistidos no `meta` do bot/ura.

## Arquitetura resumida

- `content/`:
  - injeta script para captar token e dados da empresa nas chamadas da página.
- `background/`:
  - gerencia contexto, sessão de auth, sync e mensagens.
- `services/`:
  - cliente de API e serviços de sincronização (summary/full/variáveis/TAGs).
- `data/`:
  - persistência local em IndexedDB (metas, grupos, itens, variáveis e TAGs).
- `side_panel/screens/`:
  - telas `consulta`, `variaveis`, `tags`, `comparacao`, `armazenamento`.

## Limitações atuais

- Projeto sem suíte automatizada de testes.
- Cobertura de filtros específicos por tipo ainda evolutiva (BOT e URA).
- Comparação executa em memória no momento da consulta (não persiste resultado de merge).
- Sem pipeline formal de release/versionamento automatizado.

## Manifest por navegador

- O `manifest.json` da raiz é o padrão para Chrome.
- Versões alternativas ficam em:
  - `browser/chrome/manifest.json`
  - `browser/opera/manifest.json`
- Para testar em outro navegador, copie o manifest desejado para a raiz antes de carregar a extensão.

## Instalação local

1. Clone este repositório.
2. Abra `chrome://extensions`.
3. Ative `Modo do desenvolvedor`.
4. Clique em `Carregar sem compactação`.
5. Selecione a pasta raiz do projeto.
6. Abra um builder BOT/URA e use o side panel.

## Próximos passos recomendados

1. Ampliar cobertura de filtros específicos de tipos de bloco.
2. Definir testes mínimos (fluxos críticos de sync e comparação).
3. Estruturar versionamento e processo de release.
