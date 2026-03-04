# Bilhete de Ouro - Sistema de Rifas

## Execução Local
1. Instale o Node.js e o MongoDB (ou crie um cluster gratuito no MongoDB Atlas).
2. Clone o repositório.
3. Rode `npm install` na pasta raiz.
4. Renomeie `.env.example` para `.env` e preencha sua `MONGODB_URI` e um `SESSION_SECRET`.
5. Rode `npm run dev` para desenvolvimento ou `npm start` para produção.
6. Acesse `http://localhost:3000`.
7. Para o admin inicial, o sistema criará o usuário `admin` com senha `admin123` ao rodar a primeira vez (altere no painel depois).

## Deploy no Render
1. Suba este repositório para o seu GitHub.
2. No painel do Render, crie um novo **Web Service**.
3. Conecte seu repositório do GitHub.
4. Configurações:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Em **Environment Variables**, adicione as mesmas variáveis do seu arquivo `.env` (especialmente a `MONGODB_URI` de produção).
6. Clique em "Create Web Service".
