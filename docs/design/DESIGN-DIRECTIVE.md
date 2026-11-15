# DESIGN DIRECTIVE — SECRET ORGANIZATION

## 1. Objetivo

Quero estabelecer uma identidade visual completa para este gestor de tarefas, inspirada na atmosfera visual de A Vigília, de Ordem Paranormal.

A direção criativa é:

**SECRET ORGANIZATION — Cinematic, Dark, Immersive.**

A aplicação deve transmitir a sensação de estar utilizando o sistema interno de uma organização secreta responsável por investigar, organizar e acompanhar operações confidenciais.

Não quero uma interface genérica de SaaS com tema escuro. Quero uma identidade visual reconhecível, consistente e com personalidade.

A imagem em `docs/design/vigilia-reference.png` é a principal referência visual. Analise-a antes de implementar qualquer alteração.

## 2. Interpretação da referência

Extraia os seguintes elementos visuais:

- Atmosfera cinematográfica e sombria.
- Predominância de azul profundo, preto e tons frios.
- Iluminação azulada e ciano.
- Texturas de papel envelhecido, ruído, desgaste e granulação.
- Composição editorial com molduras e sobreposições.
- Tipografia gótica e medieval aplicada de maneira seletiva.
- Sensação de mistério, investigação e organização clandestina.

Não reproduza diretamente a composição da imagem.

Traduza esses elementos para uma interface digital de produtividade.

## 3. Direção visual

A interface deve combinar três linguagens:

**A. Classified Archive**
- Painéis que remetem a arquivos confidenciais.
- Identificadores e códigos de operações.
- Hierarquia visual editorial.
- Divisórias e bordas discretas.

**B. Cinematic Atmosphere**
- Fundos escuros com profundidade.
- Gradientes azulados.
- Iluminação ambiental sutil.
- Texturas granuladas e ruído controlado.

**C. Operational Interface**
- Componentes objetivos.
- Informações bem organizadas.
- Indicadores de status.
- Navegação intuitiva.
- Feedback visual claro.

A experiência deve parecer uma mistura de arquivo investigativo e central de operações.

## 4. Design tokens

Utilize a seguinte paleta como ponto de partida:

- Void Black: #080D13
- Deep Navy: #111C27
- Midnight Blue: #1C3040
- Cold Blue: #397A98
- Spectral Cyan: #A6D5E5
- Ash White: #D6DCE0
- Dust Grey: #777D83
- Blood Red: #792F3B
- Aged Gold: #B59A68

Estabeleça tokens semânticos para:
- Background
- Surface
- Elevated Surface
- Primary Text
- Secondary Text
- Border
- Accent
- Success
- Warning
- Danger

Não utilize todas as cores indiscriminadamente.

O ciano deve destacar elementos ativos. O vermelho deve ser reservado para alertas e situações críticas.

## 5. Tipografia

Estabeleça uma hierarquia tipográfica:

- Cinzel: títulos institucionais e elementos editoriais.
- Inter: textos, navegação, formulários e componentes.
- JetBrains Mono: códigos, identificadores, datas e metadados.

Evite utilizar tipografia decorativa em textos funcionais.

A legibilidade deve prevalecer sobre a estética.

## 6. Componentes e identidade

Desenvolva uma linguagem visual consistente para:

- Sidebar de navegação.
- Header.
- Dashboard.
- Cards de projetos.
- Lista de tarefas.
- Kanban.
- Calendário.
- Modal de criação e edição.
- Formulários.
- Menus contextuais.
- Notificações.
- Indicadores de prioridade.
- Estados vazios.
- Estados de carregamento.

Os componentes devem compartilhar bordas, espaçamentos, superfícies, tipografia e comportamento visual.

Utilize bordas finas, superfícies profundas e destaques luminosos sutis.

Texturas devem ser utilizadas com moderação, especialmente em áreas de leitura e interação.

## 7. Microinterações

A interface deve apresentar interações discretas e imersivas:

- Transições suaves entre páginas.
- Hover com iluminação azul discreta.
- Feedback visual ao concluir uma tarefa.
- Animações sutis de entrada de painéis.
- Transições de estado.
- Indicadores de carregamento coerentes com a identidade visual.

Evite animações exageradas, efeitos de glitch excessivos e movimentos que prejudiquem a produtividade.

## 8. Regras de UX

Este é um gestor de tarefas, não uma página promocional.

Portanto:

- A interface deve ser rápida e intuitiva.
- Informações precisam ser facilmente escaneáveis.
- A hierarquia visual deve ser evidente.
- O contraste deve respeitar a acessibilidade.
- A interface deve funcionar em diferentes resoluções.
- Elementos decorativos nunca podem competir com informações importantes.

A estética deve complementar a funcionalidade, nunca substituí-la.

## 9. Regras de implementação

Antes de alterar o código:

1. Analise a estrutura atual do projeto.
2. Identifique framework, bibliotecas e arquitetura.
3. Identifique as páginas e componentes existentes.
4. Identifique os padrões visuais atuais.
5. Avalie o que pode ser reaproveitado.
6. Defina uma estratégia de implementação.

Não substitua funcionalidades existentes apenas para conseguir reproduzir a estética.

Crie um sistema de design reutilizável, preferencialmente baseado em tokens CSS e componentes compartilhados.

Evite duplicação de estilos e valores arbitrários.

## 10. Processo de trabalho

Trabalhe em etapas:

**ETAPA 1 — Design Audit**

Analise a referência e o projeto atual. Apresente a direção visual proposta e os componentes que precisam ser modificados.

**ETAPA 2 — Design System**

Implemente tokens, tipografia, superfícies, bordas, sombras e padrões de componentes.

**ETAPA 3 — Core Interface**

Aplique a identidade na navegação, header e dashboard.

**ETAPA 4 — Application Components**

Aplique o sistema aos projetos, tarefas, formulários, modais e demais páginas.

**ETAPA 5 — Polish**

Revise responsividade, acessibilidade, consistência, microinterações e detalhes visuais.

Não tente executar todas as etapas de maneira desordenada.

Comece pela auditoria e apresente um plano de implementação antes de modificar os arquivos.

## Resultado esperado

Quero uma interface que pareça o sistema operacional interno de uma organização secreta.

Uma experiência visual cinematográfica, misteriosa, sofisticada e imersiva, mas que continue sendo um excelente gestor de tarefas.

**Referência estética: A Vigília.**

**Resultado desejado: uma central de operações secreta, funcional e com identidade própria.**