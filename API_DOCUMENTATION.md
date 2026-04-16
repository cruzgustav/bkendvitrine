# 📚 Documentação Completa da API - SaaS E-commerce Platform

## 🔐 Autenticação

Todas as APIs protegidas requerem o header:
```
Authorization: Bearer <token>
```

O token é obtido através do endpoint de login.

---

## 📋 Índice

1. [Autenticação](#1-autenticação)
2. [Lojas (Stores)](#2-lojas-stores)
3. [Categorias](#3-categorias)
4. [Produtos](#4-produtos)
5. [Imagens de Produtos](#5-imagens-de-produtos)
6. [Planos](#6-planos)
7. [Assinaturas](#7-assinaturas)
8. [Pagamentos](#8-pagamentos)
9. [Pedidos](#9-pedidos)
10. [Clientes](#10-clientes)
11. [Cupons](#11-cupons)
12. [Personalização](#12-personalização)
13. [Configurações](#13-configurações)
14. [Backup](#14-backup)
15. [Restauração](#15-restauração)

---

## 1. Autenticação

### 1.1 Registrar Usuário

**POST** `/api/auth/register`

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "senha123",
  "phone": "11999999999"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Sim | Nome do usuário (mín. 2 caracteres) |
| email | string | Sim | Email válido e único |
| password | string | Sim | Senha (mín. 6 caracteres) |
| phone | string | Não | Telefone |

**Resposta de Sucesso (201):**
```json
{
  "message": "Usuário criado com sucesso",
  "user": {
    "id": "clx123456",
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "role": "USER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Resposta de Erro (400):**
```json
{
  "error": "Este email já está cadastrado"
}
```

---

### 1.2 Login

**POST** `/api/auth/login`

**Body:**
```json
{
  "email": "joao@email.com",
  "password": "senha123"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| email | string | Sim | Email do usuário |
| password | string | Sim | Senha |

**Resposta de Sucesso (200):**
```json
{
  "message": "Login realizado com sucesso",
  "user": {
    "id": "clx123456",
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "avatar": null,
    "role": "USER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Resposta de Erro (401):**
```json
{
  "error": "Email ou senha incorretos"
}
```

---

### 1.3 Obter Perfil

**GET** `/api/auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "user": {
    "id": "clx123456",
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "avatar": null,
    "role": "USER",
    "emailVerified": null,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 1.4 Atualizar Perfil

**PUT** `/api/auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "João Silva Jr",
  "phone": "11888888888",
  "avatar": "https://exemplo.com/avatar.jpg"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Não | Novo nome (mín. 2 caracteres) |
| phone | string | Não | Novo telefone |
| avatar | string | Não | URL do avatar (deve ser URL válida) |

**Resposta de Sucesso (200):**
```json
{
  "message": "Perfil atualizado com sucesso",
  "user": {
    "id": "clx123456",
    "name": "João Silva Jr",
    "email": "joao@email.com",
    "phone": "11888888888",
    "avatar": "https://exemplo.com/avatar.jpg",
    "role": "USER"
  }
}
```

---

### 1.5 Alterar Senha

**PUT** `/api/auth/password`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "currentPassword": "senha123",
  "newPassword": "novaSenha456"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| currentPassword | string | Sim | Senha atual |
| newPassword | string | Sim | Nova senha (mín. 6 caracteres) |

**Resposta de Sucesso (200):**
```json
{
  "message": "Senha alterada com sucesso"
}
```

**Resposta de Erro (400):**
```json
{
  "error": "Senha atual incorreta"
}
```

---

## 2. Lojas (Stores)

### 2.1 Obter Loja do Usuário

**GET** `/api/stores`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "store": {
    "id": "clx123456",
    "userId": "clx123456",
    "name": "Minha Loja",
    "slug": "minha-loja",
    "description": "Descrição da loja",
    "logo": null,
    "banner": null,
    "email": "contato@minhaloja.com",
    "phone": "11999999999",
    "whatsapp": "11999999999",
    "instagram": "@minhaloja",
    "facebook": null,
    "twitter": null,
    "tiktok": null,
    "website": null,
    "address": "Rua Exemplo, 123",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567",
    "country": "Brasil",
    "currency": "BRL",
    "timezone": "America/Sao_Paulo",
    "isActive": true,
    "isVerified": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "categories": [],
    "customization": {
      "id": "clx123456",
      "storeId": "clx123456",
      "primaryColor": "#000000",
      "secondaryColor": "#666666",
      "accentColor": "#FF6B6B",
      "backgroundColor": "#FFFFFF",
      "textColor": "#333333",
      "headingFont": "Inter",
      "bodyFont": "Inter",
      "layoutStyle": "modern",
      "productCardStyle": "card",
      "productsPerPage": 12,
      "showBanner": true,
      "bannerTitle": null,
      "bannerSubtitle": null,
      "showFeatured": true,
      "showNewArrivals": true,
      "showCategories": true,
      "customCss": null,
      "customJs": null,
      "showReviews": true,
      "showSalesCount": false
    },
    "settings": {
      "id": "clx123456",
      "storeId": "clx123456",
      "businessHours": null,
      "emailNotifications": true,
      "smsNotifications": false,
      "orderConfirmation": true,
      "orderShipped": true,
      "orderDelivered": true,
      "freeShippingMin": null,
      "defaultShipping": 0,
      "taxEnabled": false,
      "taxRate": 0,
      "taxIncluded": true,
      "requireLogin": false,
      "guestCheckout": true,
      "minOrderAmount": null,
      "acceptCreditCard": true,
      "acceptPix": true,
      "acceptBoleto": true,
      "termsUrl": null,
      "privacyUrl": null,
      "refundPolicy": null
    },
    "_count": {
      "products": 0,
      "orders": 0,
      "customers": 0
    }
  }
}
```

---

### 2.2 Criar Loja

**POST** `/api/stores`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Minha Loja Virtual",
  "description": "Uma loja incrível com os melhores produtos",
  "email": "contato@minhaloja.com",
  "phone": "11999999999",
  "whatsapp": "11999999999",
  "instagram": "@minhaloja",
  "facebook": "https://facebook.com/minhaloja",
  "twitter": "https://twitter.com/minhaloja",
  "tiktok": "@minhaloja",
  "website": "https://minhaloja.com",
  "address": "Rua Exemplo, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567",
  "country": "Brasil"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Sim | Nome da loja (mín. 2 caracteres) |
| description | string | Não | Descrição da loja |
| email | string | Não | Email de contato |
| phone | string | Não | Telefone |
| whatsapp | string | Não | WhatsApp |
| instagram | string | Não | Instagram |
| facebook | string | Não | Facebook |
| twitter | string | Não | Twitter |
| tiktok | string | Não | TikTok |
| website | string | Não | Website (URL válida) |
| address | string | Não | Endereço |
| city | string | Não | Cidade |
| state | string | Não | Estado |
| zipCode | string | Não | CEP |
| country | string | Não | País (padrão: Brasil) |

**Resposta de Sucesso (201):**
```json
{
  "message": "Loja criada com sucesso",
  "store": {
    "id": "clx123456",
    "userId": "clx123456",
    "name": "Minha Loja Virtual",
    "slug": "minha-loja-virtual",
    "description": "Uma loja incrível com os melhores produtos",
    "email": "contato@minhaloja.com",
    "phone": "11999999999",
    "whatsapp": "11999999999",
    "instagram": "@minhaloja",
    "facebook": "https://facebook.com/minhaloja",
    "twitter": "https://twitter.com/minhaloja",
    "tiktok": "@minhaloja",
    "website": "https://minhaloja.com",
    "address": "Rua Exemplo, 123",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567",
    "country": "Brasil",
    "currency": "BRL",
    "timezone": "America/Sao_Paulo",
    "isActive": false,
    "isVerified": false,
    "customization": { ... },
    "settings": { ... }
  }
}
```

**Resposta de Erro (400):**
```json
{
  "error": "Você já possui uma loja"
}
```

---

### 2.3 Obter Loja por ID (Público)

**GET** `/api/stores/[id]`

**Resposta de Sucesso (200):**
```json
{
  "store": {
    "id": "clx123456",
    "name": "Minha Loja",
    "slug": "minha-loja",
    "description": "Descrição da loja",
    "logo": "https://exemplo.com/logo.png",
    "banner": "https://exemplo.com/banner.png",
    "email": "contato@minhaloja.com",
    "phone": "11999999999",
    "whatsapp": "11999999999",
    "instagram": "@minhaloja",
    "facebook": null,
    "twitter": null,
    "tiktok": null,
    "website": "https://minhaloja.com",
    "address": "Rua Exemplo, 123",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567",
    "country": "Brasil",
    "currency": "BRL",
    "isActive": true,
    "customization": { ... },
    "categories": [ ... ]
  }
}
```

---

### 2.4 Atualizar Loja

**PUT** `/api/stores/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Novo Nome da Loja",
  "description": "Nova descrição",
  "logo": "https://exemplo.com/logo.png",
  "banner": "https://exemplo.com/banner.png",
  "email": "novo@email.com",
  "phone": "11888888888",
  "isActive": true,
  "currency": "BRL",
  "timezone": "America/Sao_Paulo"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Não | Nome da loja |
| description | string | Não | Descrição |
| logo | string | Não | URL do logo |
| banner | string | Não | URL do banner |
| email | string | Não | Email de contato |
| phone | string | Não | Telefone |
| whatsapp | string | Não | WhatsApp |
| instagram | string | Não | Instagram |
| facebook | string | Não | Facebook |
| twitter | string | Não | Twitter |
| tiktok | string | Não | TikTok |
| website | string | Não | Website |
| address | string | Não | Endereço |
| city | string | Não | Cidade |
| state | string | Não | Estado |
| zipCode | string | Não | CEP |
| country | string | Não | País |
| currency | string | Não | Moeda (ex: BRL, USD) |
| timezone | string | Não | Fuso horário |
| isActive | boolean | Não | Se a loja está ativa |

**Resposta de Sucesso (200):**
```json
{
  "message": "Loja atualizada com sucesso",
  "store": { ... }
}
```

---

### 2.5 Desativar Loja

**DELETE** `/api/stores/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Loja desativada com sucesso"
}
```

---

## 3. Categorias

### 3.1 Listar Categorias

**GET** `/api/categories`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "categories": [
    {
      "id": "clx123456",
      "storeId": "clx123456",
      "name": "Eletrônicos",
      "slug": "eletronicos",
      "description": "Produtos eletrônicos",
      "image": "https://exemplo.com/categoria.jpg",
      "color": "#3B82F6",
      "icon": "smartphone",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "_count": {
        "products": 15
      }
    }
  ]
}
```

---

### 3.2 Criar Categoria

**POST** `/api/categories`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Eletrônicos",
  "description": "Produtos eletrônicos e gadgets",
  "image": "https://exemplo.com/categoria.jpg",
  "color": "#3B82F6",
  "icon": "smartphone",
  "sortOrder": 1
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Sim | Nome da categoria (mín. 2 caracteres) |
| description | string | Não | Descrição |
| image | string | Não | URL da imagem |
| color | string | Não | Cor em hexadecimal (ex: #3B82F6) |
| icon | string | Não | Nome do ícone |
| sortOrder | number | Não | Ordem de exibição (padrão: próximo número) |

**Resposta de Sucesso (201):**
```json
{
  "message": "Categoria criada com sucesso",
  "category": {
    "id": "clx123456",
    "storeId": "clx123456",
    "name": "Eletrônicos",
    "slug": "eletronicos",
    "description": "Produtos eletrônicos e gadgets",
    "image": "https://exemplo.com/categoria.jpg",
    "color": "#3B82F6",
    "icon": "smartphone",
    "sortOrder": 1,
    "isActive": true
  }
}
```

---

### 3.3 Obter Categoria por ID

**GET** `/api/categories/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "category": {
    "id": "clx123456",
    "storeId": "clx123456",
    "name": "Eletrônicos",
    "slug": "eletronicos",
    "description": "Produtos eletrônicos",
    "image": "https://exemplo.com/categoria.jpg",
    "color": "#3B82F6",
    "icon": "smartphone",
    "sortOrder": 1,
    "isActive": true,
    "products": [
      {
        "id": "clx123456",
        "name": "Smartphone XYZ",
        "price": 199900,
        "images": [ ... ]
      }
    ],
    "_count": {
      "products": 15
    }
  }
}
```

---

### 3.4 Atualizar Categoria

**PUT** `/api/categories/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Eletrônicos e Gadgets",
  "description": "Nova descrição",
  "image": "https://exemplo.com/nova-imagem.jpg",
  "color": "#10B981",
  "icon": "laptop",
  "sortOrder": 2,
  "isActive": true
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Categoria atualizada com sucesso",
  "category": { ... }
}
```

---

### 3.5 Excluir Categoria

**DELETE** `/api/categories/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Categoria excluída com sucesso"
}
```

**Resposta de Erro (400):**
```json
{
  "error": "Não é possível excluir uma categoria com produtos. Mova os produtos primeiro."
}
```

---

## 4. Produtos

### 4.1 Listar Produtos

**GET** `/api/products`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| status | string | Filtrar por status (DRAFT, ACTIVE, INACTIVE) |
| categoryId | string | Filtrar por categoria |
| search | string | Buscar por nome, descrição ou SKU |
| page | number | Página (padrão: 1) |
| limit | number | Itens por página (padrão: 20) |

**Exemplo:**
```
GET /api/products?status=ACTIVE&categoryId=clx123&page=1&limit=10
```

**Resposta de Sucesso (200):**
```json
{
  "products": [
    {
      "id": "clx123456",
      "storeId": "clx123456",
      "categoryId": "clx123456",
      "sku": "PROD-001",
      "name": "Smartphone XYZ Pro",
      "slug": "smartphone-xyz-pro",
      "description": "Smartphone com câmera de 108MP...",
      "shortDescription": "O melhor smartphone do mercado",
      "price": 199900,
      "comparePrice": 249900,
      "costPrice": 150000,
      "quantity": 50,
      "lowStockThreshold": 10,
      "weight": 180,
      "width": 7.5,
      "height": 16,
      "length": 0.8,
      "brand": "XYZ",
      "model": "Pro 2024",
      "barcode": "7891234567890",
      "tags": "[\"smartphone\", \"celular\", \"tecnologia\"]",
      "status": "ACTIVE",
      "isFeatured": true,
      "isNew": true,
      "isDigital": false,
      "digitalFile": null,
      "seoTitle": "Smartphone XYZ Pro - Melhor Preço",
      "seoDescription": "Compre o Smartphone XYZ Pro...",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "category": {
        "id": "clx123456",
        "name": "Eletrônicos"
      },
      "images": [
        {
          "id": "clx123456",
          "url": "https://exemplo.com/produto.jpg",
          "alt": "Smartphone XYZ Pro",
          "isPrimary": true,
          "sortOrder": 0
        }
      ],
      "variants": [
        {
          "id": "clx123456",
          "name": "Preto 128GB",
          "sku": "PROD-001-PRETO-128",
          "price": 199900,
          "quantity": 30,
          "options": "{\"cor\": \"Preto\", \"armazenamento\": \"128GB\"}"
        }
      ],
      "_count": {
        "orderItems": 15,
        "reviews": 8
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### 4.2 Criar Produto

**POST** `/api/products`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "categoryId": "clx123456",
  "sku": "PROD-001",
  "name": "Smartphone XYZ Pro",
  "description": "Smartphone com câmera de 108MP, processador de última geração...",
  "shortDescription": "O melhor smartphone do mercado",
  "price": 199900,
  "comparePrice": 249900,
  "costPrice": 150000,
  "quantity": 50,
  "lowStockThreshold": 10,
  "weight": 180,
  "width": 7.5,
  "height": 16,
  "length": 0.8,
  "brand": "XYZ",
  "model": "Pro 2024",
  "barcode": "7891234567890",
  "tags": ["smartphone", "celular", "tecnologia"],
  "status": "ACTIVE",
  "isFeatured": true,
  "isNew": true,
  "isDigital": false,
  "seoTitle": "Smartphone XYZ Pro - Melhor Preço",
  "seoDescription": "Compre o Smartphone XYZ Pro com o melhor preço",
  "images": [
    {
      "url": "https://exemplo.com/produto-1.jpg",
      "alt": "Smartphone XYZ Pro - Frente",
      "isPrimary": true
    },
    {
      "url": "https://exemplo.com/produto-2.jpg",
      "alt": "Smartphone XYZ Pro - Verso"
    }
  ],
  "variants": [
    {
      "name": "Preto 128GB",
      "sku": "PROD-001-PRETO-128",
      "price": 199900,
      "quantity": 30,
      "options": {
        "cor": "Preto",
        "armazenamento": "128GB"
      }
    },
    {
      "name": "Branco 256GB",
      "sku": "PROD-001-BRANCO-256",
      "price": 249900,
      "quantity": 20,
      "options": {
        "cor": "Branco",
        "armazenamento": "256GB"
      }
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| categoryId | string | Não | ID da categoria |
| sku | string | Não | Código SKU |
| name | string | Sim | Nome do produto (mín. 2 caracteres) |
| description | string | Não | Descrição completa |
| shortDescription | string | Não | Descrição curta |
| price | number | Sim | Preço em centavos (ex: 199900 = R$ 1.999,00) |
| comparePrice | number | Não | Preço original para desconto |
| costPrice | number | Não | Preço de custo |
| quantity | number | Não | Quantidade em estoque (padrão: 0) |
| lowStockThreshold | number | Não | Alerta de estoque baixo (padrão: 5) |
| weight | number | Não | Peso em gramas |
| width | number | Não | Largura em cm |
| height | number | Não | Altura em cm |
| length | number | Não | Comprimento em cm |
| brand | string | Não | Marca |
| model | string | Não | Modelo |
| barcode | string | Não | Código de barras |
| tags | string[] | Não | Array de tags |
| status | string | Não | Status (DRAFT, ACTIVE, INACTIVE) |
| isFeatured | boolean | Não | Destaque |
| isNew | boolean | Não | Produto novo |
| isDigital | boolean | Não | Produto digital |
| digitalFile | string | Não | URL do arquivo digital |
| seoTitle | string | Não | Título para SEO |
| seoDescription | string | Não | Descrição para SEO |
| images | array | Não | Array de imagens |
| variants | array | Não | Array de variantes |

**Resposta de Sucesso (201):**
```json
{
  "message": "Produto criado com sucesso",
  "product": {
    "id": "clx123456",
    "name": "Smartphone XYZ Pro",
    "slug": "smartphone-xyz-pro",
    "price": 199900,
    "status": "ACTIVE",
    "images": [ ... ],
    "variants": [ ... ]
  }
}
```

---

### 4.3 Obter Produto por ID

**GET** `/api/products/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "product": {
    "id": "clx123456",
    "storeId": "clx123456",
    "categoryId": "clx123456",
    "sku": "PROD-001",
    "name": "Smartphone XYZ Pro",
    "slug": "smartphone-xyz-pro",
    "description": "...",
    "price": 199900,
    "status": "ACTIVE",
    "category": { ... },
    "images": [ ... ],
    "variants": [ ... ],
    "reviews": [ ... ],
    "_count": {
      "orderItems": 15,
      "reviews": 8
    }
  }
}
```

---

### 4.4 Atualizar Produto

**PUT** `/api/products/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Smartphone XYZ Pro 2",
  "price": 219900,
  "quantity": 45,
  "status": "ACTIVE",
  "isFeatured": false
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Produto atualizado com sucesso",
  "product": { ... }
}
```

---

### 4.5 Excluir Produto

**DELETE** `/api/products/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Produto excluído com sucesso"
}
```

**Se produto tem pedidos:**
```json
{
  "message": "Produto marcado como descontinuado (possui pedidos vinculados)"
}
```

---

## 5. Imagens de Produtos

### 5.1 Listar Imagens

**GET** `/api/products/[id]/images`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "images": [
    {
      "id": "clx123456",
      "productId": "clx123456",
      "url": "https://exemplo.com/produto.jpg",
      "alt": "Smartphone XYZ Pro",
      "sortOrder": 0,
      "isPrimary": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 5.2 Adicionar Imagem

**POST** `/api/products/[id]/images`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "url": "https://exemplo.com/nova-imagem.jpg",
  "alt": "Nova imagem do produto",
  "isPrimary": false
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| url | string | Sim | URL da imagem |
| alt | string | Não | Texto alternativo |
| isPrimary | boolean | Não | Se é a imagem principal |

**Resposta de Sucesso (201):**
```json
{
  "message": "Imagem adicionada com sucesso",
  "image": {
    "id": "clx123456",
    "productId": "clx123456",
    "url": "https://exemplo.com/nova-imagem.jpg",
    "alt": "Nova imagem do produto",
    "isPrimary": false,
    "sortOrder": 1
  }
}
```

---

### 5.3 Atualizar Ordem das Imagens

**PUT** `/api/products/[id]/images`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "images": [
    {
      "id": "clx123456",
      "sortOrder": 0,
      "isPrimary": true
    },
    {
      "id": "clx123457",
      "sortOrder": 1,
      "isPrimary": false
    }
  ]
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Imagens atualizadas com sucesso"
}
```

---

### 5.4 Excluir Imagem

**DELETE** `/api/products/[id]/images?imageId=clx123456`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Imagem excluída com sucesso"
}
```

---

## 6. Planos

### 6.1 Listar Planos (Público)

**GET** `/api/plans`

**Resposta de Sucesso (200):**
```json
{
  "plans": [
    {
      "id": "clx123456",
      "name": "Starter",
      "slug": "starter",
      "description": "Perfeito para começar sua loja virtual",
      "priceMonthly": 4900,
      "priceYearly": 47000,
      "maxProducts": 50,
      "maxCategories": 10,
      "maxOrders": 500,
      "maxStorageMb": 500,
      "customDomain": false,
      "analytics": false,
      "priority": 1,
      "features": [
        "Até 50 produtos",
        "Até 10 categorias",
        "Até 500 pedidos/mês",
        "500MB de armazenamento",
        "Suporte por email",
        "Relatórios básicos",
        "Integração com Infinity Pay"
      ],
      "isActive": true
    },
    {
      "id": "clx123457",
      "name": "Professional",
      "slug": "professional",
      "description": "Para lojas em crescimento",
      "priceMonthly": 9900,
      "priceYearly": 95000,
      "maxProducts": 500,
      "maxCategories": 50,
      "maxOrders": 5000,
      "maxStorageMb": 2000,
      "customDomain": true,
      "analytics": true,
      "priority": 2,
      "features": [ ... ],
      "isActive": true
    },
    {
      "id": "clx123458",
      "name": "Enterprise",
      "slug": "enterprise",
      "description": "Para grandes operações",
      "priceMonthly": 29900,
      "priceYearly": 287000,
      "maxProducts": -1,
      "maxCategories": -1,
      "maxOrders": -1,
      "maxStorageMb": 10000,
      "customDomain": true,
      "analytics": true,
      "priority": 3,
      "features": [ ... ],
      "isActive": true
    }
  ]
}
```

> **Nota:** Valores em centavos. priceMonthly: 4900 = R$ 49,00

---

## 7. Assinaturas

### 7.1 Obter Assinatura do Usuário

**GET** `/api/subscriptions`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "subscription": {
    "id": "clx123456",
    "userId": "clx123456",
    "planId": "clx123456",
    "status": "ACTIVE",
    "billingCycle": "MONTHLY",
    "currentPeriodStart": "2024-01-15T10:30:00.000Z",
    "currentPeriodEnd": "2024-02-15T10:30:00.000Z",
    "cancelledAt": null,
    "cancelAtPeriodEnd": false,
    "trialStart": null,
    "trialEnd": null,
    "plan": {
      "id": "clx123456",
      "name": "Professional",
      "priceMonthly": 9900,
      "priceYearly": 95000
    },
    "payments": [
      {
        "id": "clx123456",
        "amount": 9900,
        "status": "PAID",
        "method": "PIX",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

### 7.2 Criar Assinatura

**POST** `/api/subscriptions`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "planId": "clx123456",
  "billingCycle": "MONTHLY"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| planId | string | Sim | ID do plano |
| billingCycle | string | Sim | MONTHLY ou YEARLY |

**Resposta de Sucesso (201):**
```json
{
  "message": "Assinatura criada. Aguarde o pagamento.",
  "subscription": {
    "id": "clx123456",
    "status": "PENDING",
    "billingCycle": "MONTHLY",
    "currentPeriodStart": "2024-01-15T10:30:00.000Z",
    "currentPeriodEnd": "2024-02-15T10:30:00.000Z",
    "plan": { ... }
  },
  "payment": {
    "id": "clx123456",
    "amount": 9900,
    "status": "PENDING",
    "method": "PIX"
  }
}
```

---

### 7.3 Cancelar Assinatura

**DELETE** `/api/subscriptions/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Assinatura será cancelada ao final do período atual"
}
```

---

## 8. Pagamentos

### 8.1 Listar Pagamentos

**GET** `/api/payments`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| status | string | Filtrar por status (PENDING, PAID, FAILED, REFUNDED) |
| page | number | Página (padrão: 1) |
| limit | number | Itens por página (padrão: 20) |

**Resposta de Sucesso (200):**
```json
{
  "payments": [
    {
      "id": "clx123456",
      "userId": "clx123456",
      "orderId": null,
      "subscriptionId": "clx123456",
      "infinityPayId": "INF-123456-ABC",
      "paymentIntentId": "PI-123456-ABCDEF",
      "amount": 9900,
      "currency": "BRL",
      "status": "PAID",
      "method": "PIX",
      "cardBrand": null,
      "cardLast4": null,
      "installments": 1,
      "pixQrCode": "data:image/png;base64,...",
      "pixCode": "00020126580014...",
      "pixExpiresAt": "2024-01-15T11:00:00.000Z",
      "boletoUrl": null,
      "boletoBarcode": null,
      "boletoExpiresAt": null,
      "paidAt": "2024-01-15T10:35:00.000Z",
      "failedAt": null,
      "refundedAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "order": null,
      "subscription": {
        "id": "clx123456",
        "plan": {
          "name": "Professional"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

### 8.2 Criar Pagamento

**POST** `/api/payments`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "subscriptionId": "clx123456",
  "amount": 9900,
  "currency": "BRL",
  "method": "PIX",
  "installments": 1
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| orderId | string | Não | ID do pedido (se for pagamento de pedido) |
| subscriptionId | string | Não | ID da assinatura (se for pagamento de assinatura) |
| amount | number | Sim | Valor em centavos |
| currency | string | Não | Moeda (padrão: BRL) |
| method | string | Sim | CREDIT_CARD, DEBIT_CARD, PIX, BOLETO, BANK_TRANSFER |
| cardToken | string | Não | Token do cartão (se cartão) |
| cardBrand | string | Não | Bandeira do cartão |
| cardLast4 | string | Não | Últimos 4 dígitos |
| installments | number | Não | Parcelas (1-12) |

**Resposta de Sucesso (201):**
```json
{
  "message": "Pagamento criado com sucesso",
  "payment": {
    "id": "clx123456",
    "infinityPayId": "INF-123456-ABC",
    "amount": 9900,
    "status": "PENDING",
    "method": "PIX"
  },
  "paymentInstructions": {
    "title": "Pagamento via PIX",
    "qrCode": "data:image/png;base64,...",
    "pixCode": "00020126580014...",
    "expiresIn": "30 minutos"
  }
}
```

---

### 8.3 Obter Pagamento por ID

**GET** `/api/payments/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "payment": {
    "id": "clx123456",
    "amount": 9900,
    "status": "PAID",
    "method": "PIX",
    "pixCode": "...",
    "paidAt": "2024-01-15T10:35:00.000Z"
  }
}
```

---

### 8.4 Webhook Infinity Pay

**POST** `/api/payments/webhook`

Este endpoint recebe notificações da Infinity Pay.

**Body (exemplo):**
```json
{
  "id": "INF-123456-ABC",
  "event": "payment.confirmed",
  "data": {
    "id": "INF-123456-ABC",
    "status": "paid",
    "amount": 9900,
    "paid_at": "2024-01-15T10:35:00.000Z"
  }
}
```

**Resposta de Sucesso (200):**
```json
{
  "received": true
}
```

---

## 9. Pedidos

### 9.1 Listar Pedidos

**GET** `/api/orders`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| status | string | Filtrar por status |
| paymentStatus | string | Filtrar por status de pagamento |
| search | string | Buscar por número, nome ou email |
| page | number | Página (padrão: 1) |
| limit | number | Itens por página (padrão: 20) |

**Resposta de Sucesso (200):**
```json
{
  "orders": [
    {
      "id": "clx123456",
      "storeId": "clx123456",
      "customerId": "clx123456",
      "orderNumber": "ORD-M8K2L5-ABC123",
      "status": "DELIVERED",
      "paymentStatus": "PAID",
      "paymentMethod": "PIX",
      "subtotal": 199900,
      "discount": 0,
      "shipping": 1500,
      "tax": 0,
      "total": 201400,
      "customerName": "Maria Silva",
      "customerEmail": "maria@email.com",
      "customerPhone": "11999999999",
      "shippingAddress": "Rua das Flores, 123",
      "shippingCity": "São Paulo",
      "shippingState": "SP",
      "shippingZipCode": "01234-567",
      "shippingCountry": "Brasil",
      "trackingNumber": "BR123456789",
      "shippingCarrier": "Correios",
      "shippedAt": "2024-01-16T10:00:00.000Z",
      "deliveredAt": "2024-01-20T14:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "items": [
        {
          "id": "clx123456",
          "productName": "Smartphone XYZ Pro",
          "variantName": "Preto 128GB",
          "quantity": 1,
          "price": 199900,
          "total": 199900,
          "product": {
            "images": [
              {
                "url": "https://exemplo.com/produto.jpg",
                "isPrimary": true
              }
            ]
          }
        }
      ],
      "customer": {
        "id": "clx123456",
        "email": "maria@email.com",
        "name": "Maria Silva"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### 9.2 Criar Pedido

**POST** `/api/orders`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "items": [
    {
      "productId": "clx123456",
      "variantId": "clx123456",
      "quantity": 2
    }
  ],
  "customerEmail": "maria@email.com",
  "customerName": "Maria Silva",
  "customerPhone": "11999999999",
  "shippingAddress": "Rua das Flores, 123",
  "shippingCity": "São Paulo",
  "shippingState": "SP",
  "shippingZipCode": "01234-567",
  "shippingCountry": "Brasil",
  "notes": "Por favor, embalar para presente",
  "couponCode": "DESCONTO10"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| items | array | Sim | Array de itens do pedido |
| items[].productId | string | Sim | ID do produto |
| items[].variantId | string | Não | ID da variante |
| items[].quantity | number | Sim | Quantidade |
| customerEmail | string | Sim | Email do cliente |
| customerName | string | Não | Nome do cliente |
| customerPhone | string | Não | Telefone |
| shippingAddress | string | Não | Endereço de entrega |
| shippingCity | string | Não | Cidade |
| shippingState | string | Não | Estado |
| shippingZipCode | string | Não | CEP |
| shippingCountry | string | Não | País |
| notes | string | Não | Observações |
| couponCode | string | Não | Código do cupom |

**Resposta de Sucesso (201):**
```json
{
  "message": "Pedido criado com sucesso",
  "order": {
    "id": "clx123456",
    "orderNumber": "ORD-M8K2L5-ABC123",
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "subtotal": 399800,
    "discount": 39980,
    "shipping": 0,
    "tax": 0,
    "total": 359820,
    "items": [ ... ]
  }
}
```

---

### 9.3 Obter Pedido por ID

**GET** `/api/orders/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "order": {
    "id": "clx123456",
    "orderNumber": "ORD-M8K2L5-ABC123",
    "status": "SHIPPED",
    "paymentStatus": "PAID",
    "subtotal": 199900,
    "total": 201400,
    "items": [ ... ],
    "customer": { ... },
    "payments": [ ... ]
  }
}
```

---

### 9.4 Atualizar Pedido

**PUT** `/api/orders/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "status": "SHIPPED",
  "trackingNumber": "BR123456789",
  "shippingCarrier": "Correios",
  "internalNotes": "Enviado via SEDEX"
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| status | string | PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED |
| paymentStatus | string | PENDING, PAID, FAILED, REFUNDED |
| paymentMethod | string | Método de pagamento |
| trackingNumber | string | Código de rastreio |
| shippingCarrier | string | Transportadora |
| internalNotes | string | Notas internas |

**Resposta de Sucesso (200):**
```json
{
  "message": "Pedido atualizado com sucesso",
  "order": { ... }
}
```

---

## 10. Clientes

### 10.1 Listar Clientes

**GET** `/api/customers`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| search | string | Buscar por nome, email ou telefone |
| page | number | Página |
| limit | number | Itens por página |

**Resposta de Sucesso (200):**
```json
{
  "customers": [
    {
      "id": "clx123456",
      "storeId": "clx123456",
      "email": "maria@email.com",
      "name": "Maria Silva",
      "phone": "11999999999",
      "company": "Empresa ABC",
      "notes": "Cliente VIP",
      "totalOrders": 5,
      "totalSpent": 523400,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "_count": {
        "orders": 5
      }
    }
  ],
  "pagination": { ... }
}
```

---

### 10.2 Criar Cliente

**POST** `/api/customers`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "email": "novo@email.com",
  "name": "Novo Cliente",
  "phone": "11888888888",
  "company": "Empresa XYZ",
  "notes": "Cliente corporativo"
}
```

**Resposta de Sucesso (201):**
```json
{
  "message": "Cliente criado com sucesso",
  "customer": { ... }
}
```

---

### 10.3 Obter Cliente por ID

**GET** `/api/customers/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "customer": {
    "id": "clx123456",
    "email": "maria@email.com",
    "name": "Maria Silva",
    "totalOrders": 5,
    "totalSpent": 523400,
    "orders": [ ... ],
    "_count": {
      "orders": 5
    }
  }
}
```

---

### 10.4 Atualizar Cliente

**PUT** `/api/customers/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Maria Silva Jr",
  "phone": "11777777777",
  "notes": "Cliente VIP atualizado"
}
```

---

### 10.5 Excluir Cliente

**DELETE** `/api/customers/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Cliente excluído com sucesso"
}
```

---

## 11. Cupons

### 11.1 Listar Cupons

**GET** `/api/coupons`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "coupons": [
    {
      "id": "clx123456",
      "storeId": "clx123456",
      "code": "DESCONTO10",
      "description": "Desconto de 10% para novos clientes",
      "type": "PERCENTAGE",
      "value": 10,
      "minPurchase": 10000,
      "maxDiscount": 5000,
      "usageLimit": 100,
      "usageCount": 25,
      "perCustomer": 1,
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-12-31T23:59:59.000Z",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00.000Z"
    }
  ]
}
```

---

### 11.2 Criar Cupom

**POST** `/api/coupons`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "code": "PROMO20",
  "description": "Promoção de 20% de desconto",
  "type": "PERCENTAGE",
  "value": 20,
  "minPurchase": 15000,
  "maxDiscount": 10000,
  "usageLimit": 50,
  "perCustomer": 1,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-03-31T23:59:59.000Z"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| code | string | Sim | Código do cupom (3-20 caracteres) |
| description | string | Não | Descrição |
| type | string | Sim | PERCENTAGE ou FIXED |
| value | number | Sim | Valor do desconto |
| minPurchase | number | Não | Compra mínima em centavos |
| maxDiscount | number | Não | Desconto máximo em centavos |
| usageLimit | number | Não | Limite total de uso |
| perCustomer | number | Não | Limite por cliente |
| startDate | string | Não | Data de início (ISO 8601) |
| endDate | string | Não | Data de fim (ISO 8601) |

**Resposta de Sucesso (201):**
```json
{
  "message": "Cupom criado com sucesso",
  "coupon": { ... }
}
```

---

### 11.3 Obter Cupom por ID

**GET** `/api/coupons/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

---

### 11.4 Atualizar Cupom

**PUT** `/api/coupons/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "description": "Nova descrição",
  "value": 15,
  "isActive": true
}
```

---

### 11.5 Excluir Cupom

**DELETE** `/api/coupons/[id]`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 12. Personalização

### 12.1 Obter Personalização

**GET** `/api/customization`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "customization": {
    "id": "clx123456",
    "storeId": "clx123456",
    "primaryColor": "#3B82F6",
    "secondaryColor": "#6B7280",
    "accentColor": "#10B981",
    "backgroundColor": "#FFFFFF",
    "textColor": "#1F2937",
    "headingFont": "Inter",
    "bodyFont": "Inter",
    "layoutStyle": "modern",
    "productCardStyle": "card",
    "productsPerPage": 12,
    "showBanner": true,
    "bannerTitle": "Bem-vindo à nossa loja!",
    "bannerSubtitle": "Confira as novidades",
    "showFeatured": true,
    "showNewArrivals": true,
    "showCategories": true,
    "customCss": "/* CSS personalizado */",
    "customJs": "// JS personalizado",
    "showReviews": true,
    "showSalesCount": false
  }
}
```

---

### 12.2 Atualizar Personalização

**PUT** `/api/customization`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "primaryColor": "#3B82F6",
  "secondaryColor": "#6B7280",
  "accentColor": "#10B981",
  "backgroundColor": "#FFFFFF",
  "textColor": "#1F2937",
  "headingFont": "Poppins",
  "bodyFont": "Inter",
  "layoutStyle": "modern",
  "productCardStyle": "grid",
  "productsPerPage": 24,
  "showBanner": true,
  "bannerTitle": "Promoção de Verão!",
  "bannerSubtitle": "Até 50% de desconto",
  "showFeatured": true,
  "showNewArrivals": true,
  "showCategories": true,
  "customCss": ".product-card { border-radius: 16px; }",
  "showReviews": true,
  "showSalesCount": true
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| primaryColor | string | Cor principal (hex) |
| secondaryColor | string | Cor secundária (hex) |
| accentColor | string | Cor de destaque (hex) |
| backgroundColor | string | Cor de fundo (hex) |
| textColor | string | Cor do texto (hex) |
| headingFont | string | Fonte dos títulos |
| bodyFont | string | Fonte do corpo |
| layoutStyle | string | Estilo do layout (modern, classic, minimal) |
| productCardStyle | string | Estilo do card (card, list, grid) |
| productsPerPage | number | Produtos por página (6-48) |
| showBanner | boolean | Mostrar banner |
| bannerTitle | string | Título do banner |
| bannerSubtitle | string | Subtítulo do banner |
| showFeatured | boolean | Mostrar produtos em destaque |
| showNewArrivals | boolean | Mostrar novos produtos |
| showCategories | boolean | Mostrar categorias |
| customCss | string | CSS personalizado |
| customJs | string | JavaScript personalizado |
| showReviews | boolean | Mostrar avaliações |
| showSalesCount | boolean | Mostrar contador de vendas |

---

## 13. Configurações

### 13.1 Obter Configurações

**GET** `/api/settings`

**Headers:**
```
Authorization: Bearer <token>
```

**Resposta de Sucesso (200):**
```json
{
  "settings": {
    "id": "clx123456",
    "storeId": "clx123456",
    "businessHours": "{\"mon\":{\"open\":\"09:00\",\"close\":\"18:00\"},\"tue\":{\"open\":\"09:00\",\"close\":\"18:00\"}}",
    "emailNotifications": true,
    "smsNotifications": false,
    "orderConfirmation": true,
    "orderShipped": true,
    "orderDelivered": true,
    "freeShippingMin": 20000,
    "defaultShipping": 1500,
    "taxEnabled": true,
    "taxRate": 12,
    "taxIncluded": true,
    "requireLogin": false,
    "guestCheckout": true,
    "minOrderAmount": 5000,
    "acceptCreditCard": true,
    "acceptPix": true,
    "acceptBoleto": true,
    "termsUrl": "https://minhaloja.com/termos",
    "privacyUrl": "https://minhaloja.com/privacidade",
    "refundPolicy": "Política de reembolso..."
  }
}
```

---

### 13.2 Atualizar Configurações

**PUT** `/api/settings`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "businessHours": "{\"mon\":{\"open\":\"08:00\",\"close\":\"20:00\"}}",
  "emailNotifications": true,
  "smsNotifications": true,
  "freeShippingMin": 15000,
  "defaultShipping": 0,
  "taxEnabled": true,
  "taxRate": 12,
  "taxIncluded": true,
  "requireLogin": false,
  "guestCheckout": true,
  "acceptCreditCard": true,
  "acceptPix": true,
  "acceptBoleto": false,
  "termsUrl": "https://minhaloja.com/termos",
  "privacyUrl": "https://minhaloja.com/privacidade"
}
```

---

## 14. Backup

### 14.1 Status de Backup

**GET** `/api/backup`

**Headers:**
```
Authorization: Bearer <token>
```

> **Nota:** Requer role ADMIN

**Resposta de Sucesso (200):**
```json
{
  "health": {
    "status": "healthy",
    "databaseExists": true,
    "databasePath": "/home/z/my-project/db/custom.db",
    "tables": {
      "users": 5,
      "stores": 3,
      "products": 45,
      "categories": 8,
      "orders": 120,
      "customers": 85,
      "payments": 150,
      "subscriptions": 3,
      "plans": 3
    },
    "lastBackup": "2024-01-15T10:30:00.000Z",
    "totalBackups": 10
  },
  "backups": [
    {
      "filename": "db-backup-2024-01-15T10-30-00.db",
      "path": "/home/z/my-project/backups/db-backup-2024-01-15T10-30-00.db",
      "size": 229376,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "type": "database"
    }
  ],
  "backupDirectory": "/home/z/my-project/backups"
}
```

---

### 14.2 Criar Backup

**POST** `/api/backup`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| type | string | Tipo: all (padrão), db, ou json |

**Resposta de Sucesso (200):**
```json
{
  "message": "Backup criado com sucesso",
  "backups": {
    "database": "/home/z/my-project/backups/db-backup-2024-01-15T10-30-00.db",
    "json": "/home/z/my-project/backups/data-backup-2024-01-15T10-30-00.json"
  }
}
```

---

## 15. Restauração

### 15.1 Restaurar Backup

**POST** `/api/restore`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "backupFile": "db-backup-2024-01-15T10-30-00.db",
  "type": "database"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| backupFile | string | Sim | Nome do arquivo de backup |
| type | string | Sim | Tipo: database ou json |

**Resposta de Sucesso (200):**
```json
{
  "message": "Banco de dados restaurado com sucesso",
  "previousBackupCreated": "/home/z/my-project/db/custom.db.pre-restore-1705315800000",
  "note": "Reinicie o servidor para aplicar as alterações"
}
```

---

## 📝 Notas Importantes

### Valores Monetários
Todos os valores monetários são armazenados em **centavos**:
- R$ 49,00 = `4900`
- R$ 199,90 = `19990`
- R$ 1.999,00 = `199900`

### Datas
Todas as datas estão no formato **ISO 8601**:
```
2024-01-15T10:30:00.000Z
```

### Status de Pedidos
| Status | Descrição |
|--------|-----------|
| PENDING | Aguardando confirmação |
| CONFIRMED | Confirmado |
| PROCESSING | Em processamento |
| SHIPPED | Enviado |
| DELIVERED | Entregue |
| CANCELLED | Cancelado |
| REFUNDED | Reembolsado |

### Status de Pagamento
| Status | Descrição |
|--------|-----------|
| PENDING | Aguardando pagamento |
| PAID | Pago |
| FAILED | Falhou |
| REFUNDED | Reembolsado |
| PARTIALLY_REFUNDED | Parcialmente reembolsado |

### Status de Assinatura
| Status | Descrição |
|--------|-----------|
| PENDING | Aguardando pagamento |
| ACTIVE | Ativa |
| PAST_DUE | Pagamento atrasado |
| CANCELLED | Cancelada |
| EXPIRED | Expirada |
| TRIAL | Período de teste |

---

## 🚀 Comandos Úteis

```bash
# Criar backup manual
bun run backup

# Inicializar dados do sistema
bun run seed

# Verificar qualidade do código
bun run lint

# Sincronizar banco de dados
bun run db:push
```

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação do Prisma: https://pris.ly/d/prisma-schema
- Infinity Pay API: https://docs.infinitypay.com.br

---

**Versão:** 1.0.0  
**Última atualização:** Janeiro 2024
