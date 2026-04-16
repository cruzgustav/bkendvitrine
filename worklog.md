---
Task ID: 1
Agent: Super Z (main)
Task: Adaptar backend tabackvitrine para CORS + Cloudflare Workers

Work Log:
- Analisou todo o código-fonte do projeto (32+ arquivos de rotas API, libs, configurações)
- Criou src/middleware.ts com CORS global (preflight OPTIONS + headers em todas as respostas)
- Removeu CORS manual do src/app/api/stores/route.ts (OPTIONS handler)
- Removeu headers() CORS do next.config.ts (agora tratado pelo middleware)
- Adaptou next.config.ts: adicionou images.unoptimized para Cloudflare
- Instalou @opennextjs/cloudflare e wrangler como devDependencies
- Criou open-next.config.ts com configuração completa para Cloudflare Workers
- Criou wrangler.jsonc com configuração do Worker (nodejs_compat, environments)
- Adicionou scripts cf:build, cf:preview, cf:deploy, cf:deploy:staging, cf:deploy:prod no package.json
- Marcou rotas backup/route.ts e restore/route.ts com export const runtime = 'nodejs'
- Criou .env.example documentando todas as variáveis de ambiente
- Ajustou middleware para runtime 'experimental-edge' (requerido pelo OpenNext Cloudflare)
- Testou build do Next.js com sucesso
- Testou build do OpenNext Cloudflare com sucesso (worker.js gerado)

Stage Summary:
- CORS global funcionando via middleware.ts (edge runtime)
- Build do Cloudflare Workers passando (npx @opennextjs/cloudflare build)
- Nenhuma funcionalidade alterada - mesmas rotas, mesmas respostas
- Arquivos criados: middleware.ts, open-next.config.ts, wrangler.jsonc, .env.example
- Arquivos modificados: next.config.ts, package.json, stores/route.ts, backup/route.ts, restore/route.ts
