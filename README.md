<p align="center"><img src="marca/logo-readme.png" alt="Arcos Jobim · Automação & Software" width="420"></p>

# Despacho de Entregas

Sistema de controle de entregas para motoristas **efetivados** e **terceirizados**: acompanha produto, saída, entrega com foto e assinatura do cliente, retorno do motorista, devoluções, defeitos e envios errados, com indicadores por motorista e mapa das rotas.

Desenvolvido por **Arcos Jobim · Automação & Software**.

## Como funciona

Site estático (HTML + JavaScript), sem servidor próprio. Dois modos, escolhidos pelo arquivo `js/config.js`:

| Modo | Quando | Onde ficam os dados |
|---|---|---|
| **Local** | `supabaseUrl` e `supabaseKey` vazios | No navegador, com dados de exemplo. Ótimo para demonstração. |
| **Online** | `supabaseUrl` e `supabaseKey` preenchidos | Supabase (banco, login, fotos e GPS). Funciona em qualquer celular. |

Mapas: **mapa real** (OpenStreetMap, gratuito) ou **mapa esquemático**. O administrador alterna entre eles na aba Mapa.

## Contas de demonstração (modo local)

| Perfil | Usuário | Senha |
|---|---|---|
| Administrador | `admin` | `admin123` |
| Motorista efetivado | `joao` | `1234` |
| Motorista terceirizado | `carlos` | `1234` |

## Passo 1 · Publicar no GitHub Pages (grátis)

1. No repositório: **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**, e salve.
3. Em 1 a 2 minutos o site abre em `https://SEU-USUARIO.github.io/despacho-entregas/`.

Pronto: já funciona no modo local, em qualquer celular ou computador.

## Passo 2 · Ligar o banco online (Supabase, grátis)

1. Crie uma conta em <https://supabase.com> e um projeto novo (região **South America (São Paulo)**).
2. **SQL Editor → New query**: cole todo o conteúdo de `banco/schema.sql` e clique em **Run**.
3. **Authentication → Providers → Email**: desligue **Confirm email**. (Necessário para o administrador criar o acesso dos motoristas pelo sistema.)
4. **Authentication → Users → Add user → Create new user**: e-mail `admin@despacho.app`, uma senha forte, marque **Auto Confirm User**.
5. No **SQL Editor**, rode:
   ```sql
   insert into public.perfis (auth_id, papel)
     select id, 'admin' from auth.users where email = 'admin@despacho.app'
     on conflict (auth_id) do nothing;
   ```
6. **Project Settings → API**: copie a **Project URL** e a chave **anon public**.
7. Abra `js/config.js` e preencha `supabaseUrl` e `supabaseKey`. Faça o commit.

> Use somente a chave **anon public**. A chave `service_role` nunca vai no site.

Depois disso, o login é o usuário e a senha reais:
- Administrador: `admin` e a senha do passo 4.
- Motoristas: o administrador cadastra em **Colaboradores → Novo colaborador** (senha com 6 ou mais caracteres). O sistema cria o acesso e o link de cada motorista.

## GPS do motorista

- O motorista toca em **Ativar localização** na tela dele e o celular pede permissão.
- Só funciona em **HTTPS** (o GitHub Pages já é) e **com a tela do site aberta**. Para rastrear com a tela bloqueada seria preciso um aplicativo nativo, etapa futura.
- A posição só é enviada **enquanto o motorista tem entregas em rota**.
- O administrador vê a posição na aba **Mapa** (marcador sólido = GPS; claro = posição simulada).
- Rastrear a posição de pessoas é dado pessoal (LGPD): combine a regra e o aviso com o cliente e com os motoristas antes de usar.

## Desenvolvedor e planos (teste grátis / Full)

Existe um usuário **desenvolvedor**, acima do administrador. Só o dono do sistema tem esse acesso. Ele vê a aba **Desenvolvedor** e controla tudo: plano da empresa, códigos de acesso e todos os usuários (criar, trocar senha, bloquear, mudar o papel, excluir), inclusive o administrador. O administrador não vê essa aba nem o perfil do desenvolvedor, e não consegue alterá-lo.

| Plano | Duração | Como libera |
|-------|---------|-------------|
| **Teste grátis** | 3 dias, contados a partir do primeiro login de qualquer usuário da empresa | Sem código |
| **Full** | Sem prazo | Código de acesso (uso único), gerado pelo desenvolvedor |

Plano vencido ou empresa bloqueada: o site mostra só a tela de bloqueio e o **banco recusa os dados** (a regra fica no Supabase, não só na tela). O plano vale para a empresa inteira. O desenvolvedor nunca é bloqueado.

Como ligar (no SQL Editor do Supabase, nesta ordem):

1. `banco/02-planos-desenvolvedor.sql`: cria as tabelas e as regras. Não bloqueia ninguém.
2. Crie o usuário desenvolvedor em **Authentication > Users** e rode `banco/03-criar-desenvolvedor.sql` (troque o e-mail de exemplo pelo seu).
3. Entre no site com o e-mail completo no campo "Usuário" e confira a aba **Desenvolvedor**.
4. Só então rode `banco/04-ativar-bloqueio.sql` para bloquear a empresa. Para liberar: aba Desenvolvedor > Códigos (gerar código Full) ou Plano (teste grátis / liberar Full).

> Outros desenvolvedores só podem ser criados pelo SQL Editor (arquivo 03), nunca pelo site.

## Estrutura

```
index.html            página única
css/                  estilo e Leaflet
js/config.js          modo local ou online, mapa e GPS
js/dados-local.js     dados no navegador
js/dados-online.js    dados no Supabase
js/regras.js          regras e indicadores
js/mapa.js            mapa esquemático
js/mapa-real.js       mapa OpenStreetMap + GPS
js/telas-admin.js     telas do administrador
js/telas-motorista.js telas do motorista
js/plano.js           plano da empresa: tela de bloqueio, aviso e código
js/desenvolvedor.js   aba Desenvolvedor (plano, códigos, usuários)
js/vendor/            Leaflet e cliente do Supabase
banco/schema.sql      tabelas e regras de segurança
banco/02-...-04-...   desenvolvedor, planos e bloqueio (rodar nesta ordem)
marca/                logo e ícones da Arcos Jobim
```

## Pontos de atenção antes de usar com o cliente real

- Fotos e assinaturas ficam num bucket **público** com nomes difíceis de adivinhar. Para uso real, trocar para bucket privado com links temporários.
- Na demonstração, os pedidos recebem o número no navegador de quem cria. Para muitos usuários criando entregas ao mesmo tempo, passar a numeração para o banco.
- A senha de um colaborador já criado só muda pelo painel do Supabase (Authentication → Users).
- O mapa real desenha as rotas em linha reta entre as paradas. Uma etapa seguinte pode usar traçado por ruas.

## Local da empresa, entrega ou coleta, histórico e tempo até a parada

- **Local da empresa no mapa:** só o desenvolvedor define, em *Desenvolvedor > Empresa* (busca por endereço, clique no mapa ou arrastar o ícone **E**). Administradores e motoristas apenas veem. Fica guardado no banco (`banco/05-empresa-coleta.sql`).
- **Entrega ou coleta:** ao criar um pedido, escolha o *Tipo*. A coleta segue o mesmo caminho (saída, conclusão, retorno), com nomes próprios ("Coletada", "Saí para coleta") e marcador quadrado no mapa.
- **Histórico:** aba nova para administrador e desenvolvedor. Clique num dia do calendário (ou em dois dias para marcar um período), use os atalhos (Hoje, Ontem, 7 dias, 30 dias, Este mês, Mês passado) e veja indicadores, gráficos de rendimento, desempenho por motorista, ocorrências, abastecimento e a lista completa do que aconteceu.
- **Tempo até a próxima parada:** no mapa do administrador/desenvolvedor, cada motorista mostra "chega em ~N min". A conta usa as ruas (serviço OSRM) a partir do GPS do celular (ou da posição simulada). É uma estimativa e não considera trânsito; sem internet de rotas, usa a linha reta.

Ordem para atualizar um site que já está no ar: rode o `banco/05-empresa-coleta.sql` no Supabase e depois envie os arquivos do site ao GitHub.

## Limpar histórico (só o desenvolvedor)

Em **Desenvolvedor → Limpar histórico** você escolhe um período no calendário (ou o atalho **Tudo**) e marca o que apagar: entregas e coletas (com as ocorrências), abastecimentos, posições de GPS, fotos e assinaturas. Pedidos ainda em aberto são mantidos, a menos que você marque para incluí-los.

Fluxo: **Conferir** (mostra quantos registros serão apagados) → digitar **APAGAR** → o site baixa um backup em CSV (opcional, recomendado) → apaga. Apagar é permanente.

Para funcionar, rode **uma vez** `banco/06-limpar-historico.sql` no Supabase (SQL Editor → Run) antes de publicar os arquivos novos. O banco recusa qualquer usuário que não seja desenvolvedor.

## App no celular: ArcoRota Admin e ArcoRota Motorista

O sistema chama-se **ArcoRota** e tem dois apps instaláveis (PWA), com o mesmo site e o mesmo banco:

- **ArcoRota Admin** (`admin.html`, faixa azul no ícone): administrador e desenvolvedor.
- **ArcoRota Motorista** (`colaborador.html`, faixa verde): colaboradores efetivados e terceirizados.

Cada app só aceita o seu tipo de usuário. A página geral (`index.html`) continua funcionando e mostra os dois botões de instalação.

- **Android (Chrome):** botão "Instalar" na tela de login ou menu ⋮ → Instalar aplicativo.
- **iPhone (Safari):** Compartilhar → Adicionar à Tela de Início.
- **Atualizações:** é só publicar no GitHub. O app busca a versão nova quando há internet e mostra "Nova versão disponível · Atualizar" se estiver aberto. A cada publicação, troque o `?v=` nos 3 arquivos HTML (`index.html`, `admin.html`, `colaborador.html`); o aviso usa o `?v=` do `js/app.js`.
- O GPS no iPhone só atualiza com o app aberto na tela (regra da Apple).
