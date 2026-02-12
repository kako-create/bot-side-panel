# BOT Side Panel

Extensão de navegador (Chrome) para apoiar a operação no builder de BOT e URA, com foco em busca, sincronização de dados e navegação rápida entre blocos.

## Visão geral

O projeto centraliza, no side panel, uma visão de consulta sobre estruturas de bots e URAs já abertas no portal.
A proposta é reduzir tempo de análise e manutenção, principalmente em cenários com muitos blocos, variáveis e TAGs.

## Como funciona na prática

1. O usuário acessa o portal e abre um builder de BOT ou URA.
2. A extensão identifica o contexto atual (bot, modo e domínio do portal).
3. O painel permite sincronizar dados locais para busca rápida e busca avançada.
4. Os resultados exibem atalhos para abrir diretamente o bloco no builder.
5. Nas abas de Variáveis e TAGs, é possível sincronizar e acionar busca avançada no payload com um clique.

## Status atual do produto

### Funcional hoje

- Modo BOT e modo URA com detecção automática do contexto.
- Compatibilidade com os dois portais atuais (`https://bots.digitalcontact.cloud` e `https://new.boteria.com.br`).
- Geração de links de resultado respeitando o mesmo domínio em que o usuário está logado.
- Tela de Consulta com sincronização de busca rápida (resumo), sincronização de busca avançada (payload completo), busca por tipo e texto, busca completa no payload e filtros específicos para tipos selecionados.
- Tela de Variáveis com sincronização, agrupamento e atalho para busca avançada no payload.
- Tela de TAGs com sincronização, agrupamento e atalho para busca avançada no payload.
- Tela de Armazenamento com visão de cache por bot, fixar/desfixar e remoção de dados.

### Em evolução (incompleto)

- Cobertura de filtros específicos ainda parcial (BOT com cobertura principal dos tipos mais usados e URA com suporte inicial, ainda sem cobrir todo o catálogo).
- Ajustes finos de UX e consistência visual entre telas.
- Melhorias de mensagens de erro e diagnósticos para suporte operacional.

### Pendente (prioridade recomendada)

- Ampliar cobertura de filtros específicos para mais tipos de bloco (BOT e URA).
- Consolidar documentação funcional por fluxo de uso.
- Criar suíte mínima de testes automatizados para reduzir regressão.
- Definir pipeline de release/versionamento para publicação contínua.

## Situação realista de implementação

Este repositório está em estágio de **MVP operacional evolutivo**:

- Já é utilizável para trabalho real no dia a dia.
- Entrega ganho prático em busca e navegação.
- Ainda requer expansão de cobertura e maior maturidade de qualidade para escala.

## Instalação local (uso interno)

1. Baixe/clonar o repositório.
2. Abra `chrome://extensions`.
3. Ative `Modo do desenvolvedor`.
4. Clique em `Carregar sem compactação`.
5. Selecione a pasta raiz do projeto.
6. Abra o portal BOT/URA e use o side panel da extensão.

## Próximos passos sugeridos

1. Fechar cobertura dos filtros específicos pendentes de URA e BOT.
2. Definir um checklist de validação antes de cada release.
3. Publicar uma primeira tag/versionamento estável para uso do time.

## Licença

Definir.
