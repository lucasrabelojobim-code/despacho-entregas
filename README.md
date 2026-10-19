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
js/vendor/            Leaflet e cliente do Supabase
banco/schema.sql      tabelas e regras de segurança
marca/                logo e ícones da Arcos Jobim
```

## Pontos de atenção antes de usar com o cliente real

- Fotos e assinaturas ficam num bucket **público** com nomes difíceis de adivinhar. Para uso real, trocar para bucket privado com links temporários.
- Na demonstração, os pedidos recebem o número no navegador de quem cria. Para muitos usuários criando entregas ao mesmo tempo, passar a numeração para o banco.
- A senha de um colaborador já criado só muda pelo painel do Supabase (Authentication → Users).
- O mapa real desenha as rotas em linha reta entre as paradas. Uma etapa seguinte pode usar traçado por ruas.
