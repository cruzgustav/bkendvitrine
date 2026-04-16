import { serve } from 'bun'
import { $ } from 'bun'
import { existsSync, mkdirSync, readdirSync, statSync, createReadStream } from 'fs'
import { join, basename } from 'path'

const PORT = 3005
const PROJECT_ROOT = '/home/z/my-project'
const OUTPUT_DIR = join(PROJECT_ROOT, 'downloads')

async function createPackage(): Promise<string | null> {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const outputFile = join(OUTPUT_DIR, 'saas-ecommerce-platform.tar.gz')
  
  // Check if package already exists and is recent (less than 1 hour old)
  if (existsSync(outputFile)) {
    const stats = statSync(outputFile)
    const ageMs = Date.now() - stats.mtimeMs
    if (ageMs < 60 * 60 * 1000) {
      console.log('📦 Using cached package')
      return outputFile
    }
  }

  console.log('📦 Creating project package...')
  
  try {
    await $`tar -czvf ${outputFile} \
      --exclude='node_modules' \
      --exclude='.next' \
      --exclude='.git' \
      --exclude='backups' \
      --exclude='logs' \
      --exclude='downloads' \
      --exclude='*.log' \
      -C ${PROJECT_ROOT}/.. \
      my-project`.quiet()
    
    console.log('✅ Package created!')
    return outputFile
  } catch (error) {
    console.error('❌ Error creating package:', error)
    return null
  }
}

serve({
  port: PORT,
  
  async fetch(req) {
    const url = new URL(req.url)
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
    
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }
    
    // Route: GET / - Info page
    if (url.pathname === '/') {
      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SaaS E-commerce Platform - Download</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    h1 {
      color: #1a1a2e;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
    }
    .feature {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    .icon {
      width: 24px;
      height: 24px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      flex-shrink: 0;
    }
    .feature-text {
      color: #333;
      line-height: 1.5;
    }
    .download-btn {
      display: block;
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      margin-top: 30px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }
    .info-box {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }
    .info-title {
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 10px;
    }
    .info-list {
      list-style: none;
    }
    .info-list li {
      padding: 6px 0;
      color: #555;
      border-bottom: 1px solid #eee;
    }
    .info-list li:last-child {
      border-bottom: none;
    }
    .file-size {
      color: #888;
      font-size: 14px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛒 SaaS E-commerce Platform</h1>
    <p class="subtitle">Plataforma completa de lojas virtuais com sistema de assinaturas</p>
    
    <div class="feature">
      <div class="icon">✓</div>
      <div class="feature-text"><strong>Backend completo</strong> com 18 modelos de dados e 15+ APIs REST</div>
    </div>
    <div class="feature">
      <div class="icon">✓</div>
      <div class="feature-text"><strong>Sistema de assinaturas</strong> com 3 planos (Starter, Professional, Enterprise)</div>
    </div>
    <div class="feature">
      <div class="icon">✓</div>
      <div class="feature-text"><strong>Integração Infinity Pay</strong> com PIX, Boleto e Cartão</div>
    </div>
    <div class="feature">
      <div class="icon">✓</div>
      <div class="feature-text"><strong>Personalização completa</strong> de cores, fontes e layout</div>
    </div>
    <div class="feature">
      <div class="icon">✓</div>
      <div class="feature-text"><strong>Documentação completa</strong> com todos os endpoints</div>
    </div>
    <div class="feature">
      <div class="icon">✓</div>
      <div class="feature-text"><strong>Sistema de backup</strong> automático para proteger seus dados</div>
    </div>
    
    <a href="/download" class="download-btn">
      📥 Baixar Projeto Completo
    </a>
    <p class="file-size" id="fileSize">Preparando arquivo...</p>
    
    <div class="info-box">
      <p class="info-title">📋 O que está incluído:</p>
      <ul class="info-list">
        <li>📁 Código fonte completo (src/)</li>
        <li>🗄️ Banco de dados SQLite com dados iniciais</li>
        <li>📄 Schema do Prisma</li>
        <li>📚 Documentação da API</li>
        <li>⚙️ Scripts de backup e seed</li>
        <li>🔧 Configurações do projeto</li>
      </ul>
    </div>
  </div>
  
  <script>
    fetch('/size')
      .then(r => r.json())
      .then(data => {
        document.getElementById('fileSize').textContent = 
          'Tamanho: ' + (data.size / 1024 / 1024).toFixed(2) + ' MB';
      })
      .catch(() => {
        document.getElementById('fileSize').textContent = 'Clique para baixar';
      });
  </script>
</body>
</html>
      `
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...corsHeaders
        }
      })
    }
    
    // Route: GET /download - Download package
    if (url.pathname === '/download') {
      const packagePath = await createPackage()
      
      if (!packagePath) {
        return new Response(JSON.stringify({ error: 'Failed to create package' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      }
      
      const file = Bun.file(packagePath)
      
      return new Response(file, {
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': 'attachment; filename="saas-ecommerce-platform.tar.gz"',
          'Content-Length': file.size.toString(),
          ...corsHeaders
        }
      })
    }
    
    // Route: GET /size - Get package size
    if (url.pathname === '/size') {
      const packagePath = await createPackage()
      
      if (!packagePath) {
        return new Response(JSON.stringify({ error: 'Failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }
      
      const file = Bun.file(packagePath)
      return new Response(JSON.stringify({ size: file.size }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }
    
    // Route: GET /api-docs - Serve API documentation
    if (url.pathname === '/api-docs') {
      const docPath = join(PROJECT_ROOT, 'API_DOCUMENTATION.md')
      const file = Bun.file(docPath)
      
      return new Response(file, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          ...corsHeaders
        }
      })
    }
    
    // 404
    return new Response('Not Found', { status: 404 })
  }
})

console.log(`🚀 Download server running at http://localhost:${PORT}`)
console.log(`📥 Download: http://localhost:${PORT}/download`)
console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`)
