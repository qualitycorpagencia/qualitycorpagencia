# Churrasco STNB: integra��o Asaas

Estado: implementa��o preparada; n�o ativada nem homologada contra conta Asaas real.

Endere�o p�blico a preservar: https://confraternizacaostnb2026.netlify.app/

## Conte�do

- `api/register.js`: ativa o novo checkout somente com `STNB_PAYMENT_PROVIDER=asaas`.
- `lib/stnb-asaas.js`: total calculado no servidor, reserva contra duplicidade, checkout Pix/cart�o � vista, confirma��o autenticada e consulta de status sem dados pessoais.
- `api/asaas-webhook.js`: eventos CHECKOUT_PAID, CHECKOUT_CANCELED e CHECKOUT_EXPIRED.
- `api/payment-status.js`: status m�nimo mediante token aleat�rio; nunca confirma por redirecionamento.
- `api/infinitepay-webhook.js`: mant�m as notifica��es de inscri��es antigas na InfinitePay.
- `stnb-netlify/`: frontend para publicar no projeto Netlify EXISTENTE c0f3983f-69ca-4de5-bc38-175dfee51944. N�o criar outro projeto ou mudar o nome.

## Configura��o de servidor

As vari�veis abaixo s�o privadas. Nunca inclu�-las no frontend, neste documento ou em commits.

- `ASAAS_ENV`: sandbox na homologa��o; production na produ��o.
- `ASAAS_API_KEY`: chave do ambiente correspondente, cadastrada como segredo.
- `ASAAS_WEBHOOK_TOKEN`: segredo aleat�rio com pelo menos 32 caracteres, igual ao authToken cadastrado no webhook.
- `STNB_PAYMENT_PROVIDER`: asaas apenas ap�s homologa��o e configura��o do webhook.
- Preservar `BLOB_READ_WRITE_TOKEN` e `ADMIN_DASHBOARD_KEY` existentes.
- Sandbox exige `STNB_ASAAS_SANDBOX_BLOB_TOKEN` de OUTRO store privado; n�o recebe o token do store de produ��o. Sandbox � recusado em VERCEL_ENV=production.

Webhook em produ��o: https://confraternizacaostnb2026.vercel.app/api/asaas-webhook

Cadastrar entrega SEQUENTIALLY para CHECKOUT_PAID, CHECKOUT_CANCELED e CHECKOUT_EXPIRED. Usar um endpoint de Preview p�blico adequado na homologa��o. N�o desativar prote��o de todo o projeto.

## Publica��o

1. Homologar num ambiente separado com credenciais sandbox: gera��o, checkout, notifica��o, consulta e painel.
2. Conferir aprova��o da conta, Pix/cart�o dispon�veis e limites/taxas na conta Asaas do titular.
3. Configurar segredo/API/webhook em produ��o; preservar token e inscri��es do Blob.
4. Publicar a API a partir da branch do evento, sem tocar na main. Confirmar a op��o Asaas ativa no servidor.
5. Publicar a pasta stnb-netlify no projeto Netlify existente. A p�gina de obrigado agora � local e retorna ao mesmo dom�nio.
6. Verificar o dom�nio divulgado, formul�rio e checkout. N�o pagar valores reais para testar.

## Limites e cuidados

- N�o foi criada inscri��o ou cobran�a real nos testes locais.
- N�o foi confirmada a exclus�o segura de inscri��es reais de teste, ent�o n�o cri�-las em produ��o.
- Nenhuma inscri��o antiga � migrada automaticamente. Para algu�m que j� se inscreveu, consultar primeiro o painel e confirmar o pagamento antes de reemitir. N�o instruir novo cadastro sem conferir, para evitar duplicidade.
- Links InfinitePay j� entregues continuam apontando para a InfinitePay. Trocar o site n�o cancela esses links externos. A desativa��o deles exige verificar as op��es da conta original e conciliar eventuais pagamentos.
- O checkout Asaas expira no m�ximo em 24 horas e nunca ultrapassa o prazo de 20/11/2026. Reemiss�o de link expirado requer atendimento da organiza��o nesta vers�o.
- Estornos/chargebacks do Asaas ainda exigem concilia��o administrativa. Os eventos deste pacote cobrem o checkout, n�o todas as altera��es financeiras posteriores.
- Ap�s erro de rede amb�guo, a reserva bloqueia nova cobran�a autom�tica; reconciliar no Asaas antes de liberar outra tentativa.
- A compatibilidade do SDK instalado com grava��es condicionais e leitura privada deve ser verificada no build real. Os testes locais usam um adaptador de armazenamento em mem�ria.

## Testes locais

`node --test asaas.test.cjs`

Documenta��o oficial consultada: https://docs.asaas.com/docs/checkout-asaas, https://docs.asaas.com/reference/criar-novo-checkout, https://docs.asaas.com/docs/eventos-para-checkout e https://vercel.com/docs/vercel-blob/using-blob-sdk.

