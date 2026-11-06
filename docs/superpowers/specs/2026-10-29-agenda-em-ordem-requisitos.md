# Agenda em Ordem — Requisitos originais

> **06/11/2026:** o produto foi renomeado de "Agenda em Ordem" para **Clanix Agenda** (pasta e pacote `clanix-agenda`). Este documento mantém o nome antigo como registro histórico.

> Transcrição do briefing entregue pelo responsável pelo produto em 29/10/2026.
> As decisões tomadas depois deste briefing (direção visual, notificações, APK, lojas)
> estão em `2026-10-29-agenda-em-ordem-design.md` e prevalecem sobre este texto quando houver diferença.

---

# PROJETO: AGENDA EM ORDEM

Atue como um engenheiro de software sênior, arquiteto de sistemas, especialista em segurança de aplicações, designer UI/UX e desenvolvedor full-stack.

Sua missão é projetar e desenvolver um aplicativo completo, moderno, responsivo, seguro e funcional chamado "Agenda em Ordem".

Não desenvolva apenas um protótipo visual. Quero uma aplicação real, com persistência dos dados, autenticação, regras de negócio, validações, tratamento de erros, testes e arquitetura preparada para evolução.

O desenvolvimento deve ser organizado em etapas, com documentação técnica e testes ao final de cada etapa.

## 1. CONCEITO DO PRODUTO

Nome: Agenda em Ordem
Slogan: Tudo organizado em um só lugar.

O sistema é uma agenda digital para profissionais que trabalham com atendimentos marcados, especialmente:

- Manicures e pedicures;
- Cabeleireiros;
- Barbeiros;
- Salões de beleza;
- Designers de sobrancelhas;
- Profissionais de estética;
- Outros profissionais autônomos.

O objetivo é substituir agendas de papel, anotações em cadernos e controles manuais.

O sistema deve permitir que o próprio profissional visualize, cadastre, altere, cancele e remarque seus atendimentos.

IMPORTANTE:
- Não deve existir um módulo de cadastro de clientes.
- Clientes não precisam criar contas.
- O profissional informa diretamente o nome do cliente no agendamento.
- O histórico de agendamentos pode ser pesquisado pelo nome informado, mas isso não constitui um cadastro de clientes.
- Não implementar pagamentos, caixa, estoque ou gestão financeira na primeira versão.
- Não implementar agendamento público realizado pelos clientes.
- Não desenvolver um ERP para salões.

A simplicidade é um requisito central do produto.

## 2. ARQUITETURA E TECNOLOGIAS

Utilizar a seguinte stack:

Frontend:
- React com TypeScript;
- Vite;
- Tailwind CSS;
- shadcn/ui e componentes Radix acessíveis;
- Lucide Icons;
- React Router;
- TanStack Query;
- React Hook Form;
- Zod para validações;
- date-fns para datas;
- FullCalendar com plugins gratuitos e adequados ao projeto, ou solução equivalente caso exista incompatibilidade.

Backend e persistência:
- Supabase;
- PostgreSQL;
- Supabase Authentication;
- Row Level Security (RLS);
- Funções SQL/RPC para operações transacionais quando necessário;
- Migrações versionadas do banco de dados.

PWA:
- vite-plugin-pwa;
- Manifest configurado;
- Ícones instaláveis;
- Service Worker para arquivos estáticos;
- Suporte a instalação no computador e celular.

Testes:
- Vitest;
- React Testing Library;
- Playwright;
- Testes SQL de regras e permissões.

Qualidade:
- ESLint;
- Prettier;
- TypeScript em modo strict;
- Código modular;
- Componentes reutilizáveis;
- Separação clara entre UI, domínio, validação e acesso a dados.

Utilize versões estáveis e compatíveis disponíveis no momento do desenvolvimento. Confirme as APIs nas documentações oficiais e evite dependências obsoletas, experimentais ou pagas sem necessidade.

Não adicionar frameworks desnecessários.

## 3. IDENTIDADE VISUAL

A identidade visual já foi definida.

Nome de exibição:
Agenda em Ordem

Slogan:
Tudo organizado em um só lugar.

Estilo:
- Minimalista;
- Moderno;
- Profissional;
- Limpo;
- Acolhedor;
- Fácil de utilizar.

A interface não deve parecer exclusivamente feminina nem masculina.

Paleta principal:

Azul-marinho: #0F2D5B
Azul principal: #3B82F6
Azul suave: #E7F1FF
Branco: #FFFFFF

Cores de apoio:
- Texto secundário: #64748B
- Bordas: #E2E8F0
- Fundo neutro: #F8FAFC
- Sucesso: verde discreto
- Atenção: âmbar discreto
- Erro: vermelho discreto

As cores de status devem manter contraste acessível.

Tipografia:
- Manrope para títulos;
- Inter para textos, formulários e elementos da interface.

Criar tokens de design centralizados.

Desenvolver:
- Logotipo principal com símbolo de calendário e confirmação;
- Ícone quadrado do aplicativo;
- Favicon;
- Versão monocromática;
- Variante para fundo claro;
- Variante para fundo escuro.

Não usar emojis como substitutos de ícones da interface.

Criar os elementos da identidade em SVG, preferindo formas vetoriais simples e originais.

Evitar excesso de sombras, gradientes e efeitos decorativos.

## 4. RESPONSIVIDADE E NAVEGAÇÃO

A aplicação deve funcionar em:

- Smartphones Android;
- iPhones;
- Tablets;
- Notebooks;
- Computadores desktop.

Abordagem mobile-first.

No desktop:
- Menu lateral;
- Área central para o conteúdo;
- Cabeçalho com título da página;
- Botão de novo agendamento sempre acessível.

No celular:
- Navegação inferior;
- Botão destacado para novo agendamento;
- Visualização adaptada da agenda;
- Formulários confortáveis para toque;
- Modais substituídos por drawers quando apropriado.

A agenda semanal deve ter uma visualização adequada para telas pequenas, sem exigir zoom horizontal excessivo.

Todos os elementos interativos devem funcionar por mouse, teclado e toque.

## 5. AUTENTICAÇÃO

O cadastro é exclusivo para usuários profissionais.

Implementar:
- Criação de conta por e-mail e senha;
- Login;
- Logout;
- Recuperação de senha;
- Verificação de e-mail quando configurada;
- Persistência segura da sessão;
- Proteção de rotas privadas;
- Estados de carregamento e erro.

Cada usuário terá sua própria agenda privada.

O usuário A nunca poderá visualizar, alterar ou excluir os agendamentos do usuário B.

Não implementar contas de clientes.

Utilizar Supabase Auth sem criar um sistema próprio de armazenamento de senhas.

## 6. TELA INICIAL — DASHBOARD

Após o login, apresentar um painel simples com:

Cabeçalho:
- Saudação ao profissional;
- Data atual;
- Botão "Novo agendamento".

Indicadores:
- Atendimentos de hoje;
- Próximo atendimento;
- Atendimentos da semana;
- Cancelamentos do mês.

Esses indicadores são apenas informativos.

Abaixo, apresentar:
- Lista de próximos atendimentos;
- Nome do cliente;
- Serviço;
- Horário;
- Status;
- Ação rápida para visualizar ou remarcar.

Exibir uma mensagem amigável quando a agenda estiver vazia.

O dashboard não deve conter gráficos financeiros ou métricas comerciais complexas.

## 7. TELA DE AGENDA

Esta é a tela mais importante do aplicativo.

Implementar quatro modos:

1. Dia;
2. Semana;
3. Mês;
4. Lista.

Recursos:
- Navegar entre datas;
- Voltar rapidamente para hoje;
- Destacar o dia atual;
- Mostrar os horários disponíveis;
- Mostrar agendamentos existentes;
- Cores discretas de status;
- Selecionar um horário livre para cadastrar;
- Clicar em um compromisso para visualizar;
- Identificar conflitos de horários;
- Mostrar estados de carregamento;
- Filtros por status.

No desktop, a visão semanal deve parecer uma agenda profissional.

No celular, priorizar a visão diária com cartões organizados por horário.

O usuário deve conseguir identificar rapidamente:
- Horários ocupados;
- Próximo atendimento;
- Horários livres dentro do expediente;
- Agendamentos cancelados;
- Atendimentos concluídos.

Não sobrecarregar o calendário com informações.

## 8. NOVO AGENDAMENTO

Desenvolver formulário com:

Campos obrigatórios:
- Nome do cliente;
- Serviço;
- Data;
- Horário inicial;
- Horário final ou duração.

Campos opcionais:
- Telefone;
- Observações.

Comportamento:
- Data atual como sugestão inicial;
- Duração padrão configurável;
- Serviço preenchido manualmente ou selecionado entre serviços favoritos;
- Cálculo automático do horário final;
- Validação antes de salvar;
- Confirmação visual após salvar;
- Atualização imediata da agenda após sucesso.

Não exigir cadastro prévio do cliente.

O formulário deve ser rápido e permitir cadastrar um atendimento em poucos passos.

A escolha de horário deve respeitar as regras de disponibilidade.

## 9. REGRAS DE AGENDAMENTO

Implementar as seguintes regras:

RN01: Um usuário não pode criar dois agendamentos ativos com horários sobrepostos.

RN02: A comparação deve considerar o intervalo completo, e não apenas a hora inicial.

RN03: Um atendimento das 14:00 às 15:00 impede outro das 14:30 às 15:30.

RN04: Um atendimento que termina às 15:00 permite outro que começa exatamente às 15:00.

RN05: Agendamentos cancelados não bloqueiam horários.

RN06: Agendamentos concluídos e faltas permanecem no histórico e ocupam seu intervalo histórico.

RN07: A criação e a remarcação devem validar disponibilidade também no banco de dados.

RN08: O sistema deve tratar duas tentativas simultâneas de reserva do mesmo horário.

RN09: Horário final deve ser posterior ao inicial.

RN10: Impedir durações zero ou negativas.

RN11: Não permitir intervalos fora do expediente configurado na primeira versão.

RN12: Não permitir agendamentos atravessando a meia-noite na primeira versão.

RN13: O profissional poderá cadastrar um horário passado apenas para registrar atendimento histórico, mediante confirmação explícita.

RN14: Cancelamento não deve excluir automaticamente o registro.

RN15: Toda operação deve ser restrita ao dono da agenda.

RN16: O sistema não deve salvar dados inválidos se uma validação do frontend for contornada.

RN17: Uma falha de conexão não pode ser apresentada como agendamento concluído.

RN18: Após conflito de horário, mostrar mensagem clara e permitir escolher outro horário.

RN19: Um usuário pode ter um agendamento no mesmo horário que outro usuário, porque suas agendas são independentes.

RN20: Mudanças de status e remarcações devem preservar histórico.

## 10. REMARCAÇÃO

O profissional deverá conseguir remarcar um atendimento.

Fluxo:
1. Abrir o agendamento;
2. Selecionar "Remarcar";
3. Escolher nova data;
4. Escolher novo horário;
5. Conferir disponibilidade;
6. Confirmar a mudança;
7. Atualizar agenda e histórico.

A remarcação deve preservar:
- Nome do cliente;
- Telefone;
- Serviço;
- Observações.

Registrar:
- Data e horário anteriores;
- Nova data e horário;
- Momento da alteração;
- Usuário responsável.

A alteração do agendamento e a gravação do histórico devem ser atômicas.

Se a nova data estiver ocupada, o agendamento original deve permanecer intacto.

Não duplicar compromissos desnecessariamente.

## 11. CANCELAMENTOS E STATUS

Estados possíveis:

- Agendado;
- Concluído;
- Cancelado;
- Não compareceu.

Agendamento criado inicia como "Agendado".

Permitir:
- Marcar como concluído;
- Registrar ausência;
- Cancelar;
- Remarcar um agendamento ativo;
- Consultar o histórico.

Para reativar um cancelamento, exigir nova validação de disponibilidade.

Não apagar registros ao simplesmente cancelar.

Permitir motivo opcional do cancelamento.

Utilizar confirmações para ações importantes.

## 12. EXPEDIENTE E CONFIGURAÇÕES

Criar uma tela de configurações contendo:

Perfil:
- Nome do profissional;
- Nome de exibição do estabelecimento, opcional;
- Fuso horário;
- Alteração de senha pela autenticação segura.

Expediente:
- Dias da semana trabalhados;
- Horário de abertura;
- Horário de encerramento;
- Intervalos de almoço;
- Possibilidade de mais de um turno por dia.

Agenda:
- Duração padrão dos atendimentos;
- Intervalo visual da grade: 15, 30 ou 60 minutos;
- Primeiro dia da semana;
- Preferência de visualização inicial.

Serviços favoritos:
- Nome;
- Duração sugerida;
- Cor opcional;
- Ativar/desativar favorito.

Serviços favoritos são apenas atalhos para preencher um agendamento.

Não criar um sistema de estoque, preços, comissões ou controle financeiro.

## 13. BUSCA E HISTÓRICO

Implementar pesquisa por:
- Nome do cliente;
- Data;
- Serviço;
- Status.

Não criar tabela independente de clientes.

A busca deve consultar somente os agendamentos pertencentes ao usuário autenticado.

Exibir histórico de remarcações e cancelamentos.

Permitir exportação dos próprios agendamentos para CSV.

Exportações devem exigir autenticação e nunca incluir dados de outros usuários.

## 14. BANCO DE DADOS

Criar modelo relacional consistente.

Tabelas sugeridas:

profiles:
- id;
- display_name;
- business_name;
- timezone;
- default_duration_minutes;
- slot_interval_minutes;
- week_starts_on;
- created_at;
- updated_at.

appointments:
- id;
- owner_id;
- client_name;
- client_phone;
- service_name;
- starts_at;
- ends_at;
- status;
- notes;
- cancellation_reason;
- canceled_at;
- created_at;
- updated_at.

appointment_history:
- id;
- appointment_id;
- owner_id;
- action;
- previous_values;
- new_values;
- created_at.

business_hours:
- id;
- owner_id;
- weekday;
- start_time;
- end_time.

favorite_services:
- id;
- owner_id;
- name;
- duration_minutes;
- color;
- is_active.

Criar chaves estrangeiras e índices necessários.

Utilizar UUID para identificadores.

Armazenar instantes em timestamptz/UTC e convertê-los para o fuso horário configurado na apresentação.

Timezone inicial sugerido:
America/Sao_Paulo.

Não utilizar o fuso do navegador como única fonte de verdade.

Criar restrição de exclusão no PostgreSQL usando btree_gist e tstzrange com limites [), por owner_id, impedindo a sobreposição de agendamentos não cancelados.

A restrição deve permanecer eficaz mesmo diante de requisições concorrentes.

Para o histórico, preferir triggers ou procedimentos transacionais controlados pelo banco, evitando que o cliente consiga forjar ou modificar registros de auditoria.

Validar integridade de status, horários e propriedade dos registros no banco.

Criar migrações SQL versionadas.

## 15. SEGURANÇA

A segurança é obrigatória.

Implementar:
- Row Level Security em todas as tabelas expostas;
- Políticas por usuário autenticado;
- Princípio do menor privilégio;
- Grants explícitos e restritos;
- Proteção contra acesso de outro usuário;
- Validação no frontend e backend/banco;
- Autorização em cada operação;
- Proteção contra XSS;
- Tratamento seguro de mensagens de erro;
- Limites de tamanho em campos;
- Proteção das operações de autenticação contra abuso;
- TLS/HTTPS em produção;
- Dependências atualizadas;
- Ausência de credenciais hardcoded.

Nunca incluir no frontend:
- Supabase secret key;
- service_role key;
- Senhas;
- Segredos de infraestrutura.

Utilizar a chave publicável do Supabase somente com as políticas RLS corretamente configuradas.

Não confiar em owner_id enviado pelo navegador para autorizar operações.

Criar testes tentando:
- Ler agenda de outro usuário;
- Editar agendamento de outro usuário;
- Excluir registros de outro usuário;
- Criar agendamento em agenda alheia;
- Alterar propriedade de um registro;
- Burlar conflito de horários;
- Alterar dados de auditoria.

Todos esses acessos indevidos devem ser bloqueados.

Seguir princípios aplicáveis do OWASP ASVS.

## 16. PRIVACIDADE E LGPD

O sistema manipulará informações pessoais.

Aplicar minimização de dados:
- Nome obrigatório;
- Telefone opcional;
- Observações opcionais;
- Nenhuma coleta desnecessária.

Não enviar dados dos clientes para serviços de analytics ou publicidade.

Preparar:
- Política de privacidade;
- Mecanismo de exportação;
- Fluxo seguro de exclusão de conta e dados;
- Orientações de retenção de informações.

Não incluir informações pessoais nos logs técnicos desnecessariamente.

## 17. PWA E CONECTIVIDADE

O aplicativo deve ser instalável.

Implementar:
- Nome e ícones no Manifest;
- Splash e tema adequados;
- Layout independente de tamanho de tela;
- Service Worker para recursos estáticos;
- Notificação de nova versão;
- Indicador de conexão.

No MVP, a conexão com o banco é necessária para salvar alterações.

Não implementar uma sincronização offline complexa sem controles de conflito.

Se a internet cair:
- Informar claramente a falta de conexão;
- Não apresentar salvamento como concluído;
- Permitir nova tentativa;
- Não deixar dados privados persistidos indevidamente em caches públicos;
- Evitar perda silenciosa de informações digitadas.

O objetivo é sincronizar a mesma agenda entre celular e computador.

## 18. EXPERIÊNCIA DO USUÁRIO

Priorizar:
- Facilidade para marcar horários;
- Poucos cliques;
- Textos em português brasileiro;
- Formato DD/MM/AAAA;
- Relógio de 24 horas;
- Mensagens claras;
- Estados vazios amigáveis;
- Feedback ao salvar;
- Confirmação ao cancelar;
- Acessibilidade;
- Navegação por teclado;
- Contraste adequado;
- Compatibilidade com toque;
- Indicadores visuais não dependentes apenas da cor.

Evitar interfaces visualmente poluídas.

Criar componentes de loading, erro, vazio e sucesso.

Não utilizar dados fictícios em produção.

Dados de demonstração podem existir apenas em ambiente local controlado.

## 19. TELAS OBRIGATÓRIAS

Implementar:

1. Login e recuperação de acesso;
2. Dashboard;
3. Agenda;
4. Novo agendamento;
5. Detalhes do atendimento;
6. Remarcação;
7. Histórico e pesquisa;
8. Configurações;
9. Página não encontrada.

O modal ou drawer de novo agendamento pode ser reutilizado para edição, desde que cada fluxo preserve suas regras.

## 20. TESTES OBRIGATÓRIOS

Criar testes de:
- Login e logout;
- Cadastro de profissional;
- Criação de agendamento;
- Validação de campos;
- Conflito parcial de horários;
- Conflito total de horários;
- Horários adjacentes;
- Agendamentos de usuários distintos;
- Remarcação bem-sucedida;
- Remarcação para horário ocupado;
- Cancelamento;
- Reativação de cancelamento;
- Histórico de alterações;
- Fuso horário;
- Expediente;
- Busca;
- Exportação;
- RLS;
- Navegação responsiva;
- Tratamento de falhas de conexão.

Incluir testes de concorrência para garantir que duas solicitações simultâneas não reservem o mesmo intervalo.

Não considerar uma etapa concluída apenas porque a tela renderiza.

## 21. ORGANIZAÇÃO DO PROJETO

Manter uma estrutura clara, por exemplo:

```
src/
  app/
  components/
    ui/
    layout/
  features/
    auth/
    dashboard/
    appointments/
    calendar/
    settings/
    history/
  hooks/
  lib/
  services/
  types/
  styles/

supabase/
  migrations/
  tests/

tests/
  e2e/

public/

docs/
```

Adaptar conforme necessário, evitando abstrações excessivas.

Criar:
- README.md;
- .env.example;
- Documentação da arquitetura;
- Modelo do banco;
- Regras de negócio;
- Guia de instalação;
- Guia de configuração do Supabase;
- Guia de testes;
- Instruções de deploy.

Nunca colocar valores secretos reais no repositório.

## 22. ETAPAS DE DESENVOLVIMENTO

ETAPA 01 — Planejamento
- Revisar requisitos;
- Documentar arquitetura;
- Definir modelo de dados;
- Identificar riscos;
- Elaborar plano de execução.

ETAPA 02 — Fundação
- Criar projeto;
- Instalar dependências;
- Configurar TypeScript;
- Configurar Tailwind;
- Configurar design system;
- Configurar rotas e estrutura.

ETAPA 03 — Identidade e layout
- Criar logotipo vetorial;
- Criar layout desktop;
- Criar layout mobile;
- Criar componentes principais;
- Implementar estados de interface.

ETAPA 04 — Banco e autenticação
- Criar migrações;
- Configurar Supabase;
- Implementar autenticação;
- Configurar RLS;
- Testar isolamento de dados.

ETAPA 05 — Agendamentos
- Criar formulários;
- Criar operações CRUD;
- Implementar disponibilidade;
- Validar conflitos;
- Testar criação e edição.

ETAPA 06 — Calendário
- Implementar visões;
- Implementar navegação;
- Integrar dados reais;
- Adaptar para dispositivos móveis.

ETAPA 07 — Remarcação e histórico
- Implementar cancelamentos;
- Implementar remarcações;
- Implementar auditoria;
- Implementar pesquisa.

ETAPA 08 — Dashboard e configurações
- Criar indicadores;
- Implementar expediente;
- Configurar serviços favoritos;
- Implementar preferências.

ETAPA 09 — PWA e refinamento
- Configurar instalação;
- Criar ícones;
- Tratar conectividade;
- Revisar acessibilidade;
- Revisar responsividade.

ETAPA 10 — Segurança e testes finais
- Executar testes;
- Revisar RLS;
- Validar concorrência;
- Revisar permissões;
- Revisar dependências;
- Corrigir problemas;
- Preparar deploy.

## 23. CRITÉRIOS DE ACEITAÇÃO

O MVP estará concluído quando:

- Um profissional conseguir criar conta e entrar;
- Sua agenda estiver isolada;
- Conseguir marcar atendimento em segundos;
- Conseguir editar e remarcar;
- Conseguir cancelar;
- Não conseguir reservar horário conflitante;
- Visualizar agenda diária e semanal;
- Visualizar agenda mensal e em lista;
- Consultar histórico;
- Personalizar expediente;
- Utilizar no celular e computador;
- Instalar como PWA;
- Sincronizar os dados online;
- Não perder alterações silenciosamente;
- Passar nos testes de segurança;
- Possuir documentação de instalação e manutenção.

## 24. INSTRUÇÕES FINAIS PARA O CLAUDE CODE

Antes de escrever código:

1. Analise todos os requisitos.
2. Identifique dependências e conflitos.
3. Defina as decisões arquiteturais.
4. Crie o plano de implementação.
5. Registre o escopo do MVP.
6. Comece a implementação pelas fundações.

Durante o desenvolvimento:

- Execute as etapas na ordem adequada.
- Não implemente funções fora do escopo sem necessidade.
- Não simule persistência quando já deveria existir banco de dados.
- Não use funcionalidades falsas apenas para demonstrar uma tela.
- Não ignore falhas de segurança ou erros de compilação.
- Não modifique regras de negócio silenciosamente.
- Mantenha o projeto executável.
- Escreva testes para regras importantes.
- Revise a responsividade.
- Documente decisões relevantes.

Caso faltem credenciais ou serviços externos, prepare toda a implementação, documente exatamente o que deve ser configurado e continue nas partes que não dependem dessas credenciais. Não invente valores.

Ao concluir cada etapa, apresente:
- O que foi implementado;
- Arquivos principais;
- Testes executados;
- Resultados;
- Pendências;
- Próximos passos.

Não declare uma funcionalidade como pronta sem verificar seu funcionamento.

Priorize uma aplicação realmente utilizável, segura, rápida, bonita e simples de manter.
