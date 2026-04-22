async function check() {
    try {
        const tokenRes = await fetch('https://pxlxwjwlakallylewydk.supabase.co/rest/v1/whatsapp_instances?status=eq.connected&limit=1', {
            headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4bHh3andsYWthbGx5bGV3eWRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgzODA0OCwiZXhwIjoyMDg2NDE0MDQ4fQ.n8I0sq5SXlI5tAY97YSzoIxfCkQqmDbpZkWr3685TvU',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4bHh3andsYWthbGx5bGV3eWRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgzODA0OCwiZXhwIjoyMDg2NDE0MDQ4fQ.n8I0sq5SXlI5tAY97YSzoIxfCkQqmDbpZkWr3685TvU'
            }
        });
        const instances = await tokenRes.json();
        if (!instances.length) {
            console.log('Nenhuma instancia conectada');
            return;
        }
        
        const token = instances[0].instance_token;
        const baseUrl = 'https://connectyhub.uazapi.com';

        console.log(`Testando envio com token: ${token.substring(0,6)}... em ${baseUrl}`);
        
        // Testa envio SEM prefixo (direto)
        let res2 = await fetch(`${baseUrl}/send/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': token },
            body: JSON.stringify({
                number: "5511999999999",
                type: "button",
                text: "Teste btn 2 sem prefixo url:",
                choices: ["Abrir o Link|https://google.com"]
            })
        });
        console.log("Teste 2 (direto https sem prefixo url:):", res2.status, await res2.text());

        // Testa envio com "url:" prefix
        let res1 = await fetch(`${baseUrl}/send/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': token },
            body: JSON.stringify({
                number: "5511999999999",
                type: "button",
                text: "Teste btn 1",
                choices: ["Abrir|url:https://google.com"]
            })
        });
        console.log("Teste 1 (prefixo url: via doc alternativa):", res1.status, await res1.text());

        // Testa envio multiplos urls
        let res3 = await fetch(`${baseUrl}/send/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': token },
            body: JSON.stringify({
                number: "5511999999999",
                type: "button",
                text: "Teste btn 3 multiplos",
                choices: ["Site1|https://google.com", "Site2|https://bing.com"]
            })
        });
        console.log("Teste 3 (multiplos links, sem prefixo):", res3.status, await res3.text());

        // Testa envio com botao duplo URL e botao reply (limit=3)
        let res4 = await fetch(`${baseUrl}/send/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': token },
            body: JSON.stringify({
                number: "5511999999999",
                type: "button",
                text: "Teste 4 url e call e reply",
                choices: ["Sim|sim", "Ligar|call:551199999999", "Link|https://google.com"]
            })
        });
        console.log("Teste 4 (misto urls call e id):", res4.status, await res4.text());
        
    } catch (e) {
        console.error(e);
    }
}
check();
