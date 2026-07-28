# BOT Side Panel

Extensão Chrome para apoio operacional em builders de BOT e URA, com foco em consulta, comparação e navegação rápida.

Status deste documento: atualizado com o estado real do projeto em **12/03/2026**.

## Objetivo

Reduzir tempo de análise/manutenção de fluxos, oferecendo no side panel:

- sincronização local dos dados do fluxo;
- busca rápida e busca avançada em payload;
- sincronização e análise de variáveis/TAGs;
- comparação entre dois registros sincronizados;
- consulta de alterações pendentes ainda não publicadas;
- review técnica por snapshots do mesmo BOT/URA;
- exportação de relatórios em Excel (`.xlsx`);
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

### 2.1. Tela Exportação

- Sincroniza os conectores do fluxo principal e de cada subfluxo após o full sync.
- Persiste conectores separadamente no IndexedDB e detecta quando ficaram desatualizados.
- Exporta JSON completo no modelo `root` + `subflows`, reunindo blocos, conectores,
  grupos, variáveis e TAGs.
- Reserva a mesma base de dados para a futura exportação XML compatível com draw.io.

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

### 6. Tela I.A.

- Disponível apenas para `BOT`.
- Possui dois blocos independentes:
  - `Condições`
  - `Intenções`
- `Condições`:
  - sincroniza intents/condições de IA do bot;
  - agrupa os registros por destino;
  - mostra nome, destino, tipo, confiança e status ativo/inativo;
  - permite exportação para Excel.
- `Intenções`:
  - sincroniza intenções Lex e suas frases de treino;
  - agrupa por intenção;
  - exibe total de intenções e total de frases;
  - permite exportação para Excel.
- As seções podem ser recolhidas e os grupos podem ser abertos/fechados em lote.

### 7. Tela Comparação

- Compara dois registros com full sync salvo (selecionados nos combos).
- Bloqueia comparação BOT x URA.
- Resultado inclui:
  - resumo geral de diferenças;
  - grupos recolhíveis;
  - blocos alterados com detalhes de merge/diff por campo;
  - filtro por propriedade alterada;
- links para abrir bloco A/B no builder.
- Ignora campos instáveis de comparação como `positionOnScreen` e `updatedAt`, além de IDs.

### 8. Tela Alterações Pendentes

- Disponível apenas para `BOT`.
- Consulta alterações ainda não publicadas/aplicadas do builder atual.
- Busca dados no endpoint:
  - `GET /bots/{botId}/builder-pending?page={page}&limit={limit}`
- Agrupa resultados por:
  - usuário;
  - ação (`insert`, `update`, `delete`).
- Quando existe full sync local, enriquece a listagem com título/descrição dos blocos já salvos no cache local.
- Permite abrir detalhes sob demanda por alteração usando o endpoint:
  - `GET /bots/{botId}/builder-tracking/details/{apiId}`
- Exibe diff textual e diff por chave quando o payload detalhado da alteração estiver disponível.

### 9. Tela Review Técnica

- Menu separado da tela `Comparação`.
- Permite criar snapshots imutáveis por BOT/URA, sempre vinculados ao mesmo `botId`.
- Cada snapshot salva:
  - blocos do full sync;
  - variáveis;
  - TAGs;
  - metadata de data/hora, modo e volume em cache.
- A comparação usa um `snapshot base` e permite:
  - comparar contra a base atual;
  - comparar contra outro snapshot do mesmo BOT/URA.
- A saída mostra somente diferenças:
  - `removido`;
  - `alterado`;
  - `incluido`.
- A comparação é feita por ID do item dentro da mesma base.
- A exportação em Excel gera:
  - aba principal `Review Tecnica` com resumo dos itens diferentes;
  - aba `API` apenas quando houver blocos de API alterados/incluídos com dados relevantes;
  - aba `Script` apenas quando houver blocos de Script alterados/incluídos com mais de 1 linha útil.
- O arquivo `.xlsx` usa hyperlinks internos entre a aba principal e as abas detalhadas (`API`/`Script`).

### 10. Tela Armazenamento

- Lista registros sincronizados, com métricas e datas.
- Fixar/desfixar e remover registro.
- Agrupamento por organização (empresa), com abrir/fechar grupos.
- Exibe também um grupo separado de `Snapshots` abaixo de `Bots sincronizados`.
- Permite remover snapshots individualmente.
- O cálculo de cache total considera sincronizações do bot e snapshots técnicos.
- Captura `fantasyName` por interceptação do endpoint:
  - `https://api.bots.digitalcontact.cloud/api/v3/companies/<orgId>`
- Dados de organização ficam persistidos no `meta` do bot/ura.

## Arquitetura resumida

- `content/`:
  - injeta script para captar token e dados da empresa nas chamadas da página.
- `background/`:
  - gerencia contexto, sessão de auth, sync e mensagens.
- `services/`:
  - cliente de API e serviços de sincronização (summary/full/conectores/variáveis/TAGs/IA).
- `data/`:
  - persistência local em IndexedDB (metas, grupos, itens, conectores, variáveis, TAGs, condições/intenções e snapshots da review técnica).
- `side_panel/screens/`:
  - telas principais `consulta`, `exportacao`, `variaveis`, `tags`, `ia`, `comparacao`, `alteracoes`, `reviewTecnica`, `armazenamento`.
- `side_panel/vendor/`:
  - dependências embarcadas no painel, incluindo `SheetJS` para exportação `.xlsx`.

## Limitações atuais

- Projeto sem suíte automatizada de testes.
- Cobertura de filtros específicos por tipo ainda evolutiva (BOT e URA).
- Comparação executa em memória no momento da consulta (não persiste resultado de merge).
- Snapshots antigos não recebem retroativamente novos campos capturados pela review técnica; nesses casos, é necessário criar um novo snapshot.
- Sem pipeline formal de release/versionamento automatizado.

## Manifest por navegador

- O `manifest.json` da raiz é o padrão para Chrome.
- Versões alternativas ficam em:
  - `browser/chrome/manifest.json`
  - `browser/opera/manifest.json`
- Para testar em outro navegador, copie o manifest desejado para a raiz antes de carregar a extensão.

### Observação de uso no Opera GX

- No Chrome, o painel abre pelo botão da extensão no topo.
- No Opera GX (com `sidebar_action`), o painel abre pelo ícone da extensão na **Sidebar** do Opera.
- Se a Sidebar não estiver visível, habilite nas configurações de aparência/Sidebar do Opera.

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
