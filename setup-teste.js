// setup-teste.js
const API_URL = 'http://localhost:3000/api';

async function runSetup() {
    console.log("Iniciando setup da Vitrine Viral...");

    try {
        // 1. Registrar Usuário
        console.log("1. Cadastrando usuário...");
        const registerRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Lojista Svelte",
                email: `lojista.${Date.now()}@teste.com`, // Email único a cada teste
                password: "senha123",
                phone: "11999999999"
            })
        });
        
        const registerData = await registerRes.json();
        if (!registerRes.ok) throw new Error(registerData.error || 'Erro ao criar usuário');
        
        const token = registerData.token;
        console.log("Usuário criado com sucesso!");

        // 2. Criar Loja
        console.log("2. Criando loja...");
        const storeRes = await fetch(`${API_URL}/stores`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: "Minha Loja Svelte",
                description: "Loja de teste para validar a vitrine",
                email: "loja@teste.com"
            })
        });

        const storeData = await storeRes.json();
        if (!storeRes.ok) throw new Error(storeData.error || 'Erro ao criar loja');
        
        const storeId = storeData.store.id;
        console.log("Loja criada com sucesso!");

        // 3. Cadastrar Produto de Teste
        console.log("3. Cadastrando produto...");
        const productRes = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: "Tênis Svelte Pro",
                shortDescription: "O tênis mais rápido para desenvolvedores.",
                price: 29990, // R$ 299,90 em centavos
                status: "ACTIVE"
            })
        });

        const productData = await productRes.json();
        if (!productRes.ok) throw new Error(productData.error || 'Erro ao criar produto');
        console.log("Produto criado com sucesso!");

        // Resumo
        console.log("\n=================================");
        console.log("SETUP CONCLUÍDO COM SUCESSO!");
        console.log("=================================");
        console.log(`-> STORE_ID gerado: ${storeId}`);
        console.log("-> Use este ID no seu front-end.");

    } catch (error) {
        console.error("\nErro durante o setup:", error.message);
    }
}

runSetup();