const PRICE = 62;

let adults = 1;
let children = 0;

const adultCount = document.getElementById('adultCount');
const childCount = document.getElementById('childCount');
const companionsWrap = document.getElementById('companionsWrap');
const childrenWrap = document.getElementById('childrenWrap');
const summaryAdults = document.getElementById('summaryAdults');
const summaryChildren = document.getElementById('summaryChildren');
const summaryTotal = document.getElementById('summaryTotal');
const form = document.getElementById('registrationForm');
const paymentAlert = document.getElementById('paymentAlert');

const money = (n) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

function renderDynamicFields(){
  adultCount.textContent = adults;
  childCount.textContent = children;
  summaryAdults.textContent = adults;
  summaryChildren.textContent = children;
  summaryTotal.textContent = money(adults * PRICE);

  companionsWrap.innerHTML = '';
  const additional = Math.max(0, adults - 1);
  if(additional){
    const title = document.createElement('div');
    title.className='dynamic-title';
    title.textContent='Nome completo dos acompanhantes adultos';
    companionsWrap.appendChild(title);
    for(let i=1;i<=additional;i++){
      const row=document.createElement('div');
      row.className='dynamic-row companion';
      row.innerHTML=`<input required data-companion="${i}" type="text" placeholder="Nome completo do acompanhante ${i}" autocomplete="name">`;
      companionsWrap.appendChild(row);
    }
  }

  childrenWrap.innerHTML = '';
  if(children){
    const title = document.createElement('div');
    title.className='dynamic-title';
    title.textContent='Nome e idade das crianças de até 8 anos';
    childrenWrap.appendChild(title);
    for(let i=1;i<=children;i++){
      const row=document.createElement('div');
      row.className='dynamic-row';
      row.innerHTML=`<input required data-child-name="${i}" type="text" placeholder="Nome da criança ${i}" autocomplete="name"><select required data-child-age="${i}"><option value="">Idade</option>${Array.from({length:9},(_,n)=>`<option value="${n}">${n} ${n===1?'ano':'anos'}</option>`).join('')}</select>`;
      childrenWrap.appendChild(row);
    }
  }
}

document.querySelectorAll('[data-step]').forEach(btn=>btn.addEventListener('click',()=>{
  const dir=Number(btn.dataset.dir);
  if(btn.dataset.step==='adult') adults=Math.max(1,Math.min(20,adults+dir));
  if(btn.dataset.step==='child') children=Math.max(0,Math.min(20,children+dir));
  renderDynamicFields();
}));

renderDynamicFields();

function buildRegistrationId(){
  const now = new Date();
  const stamp = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('');
  return `STNB-${stamp}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!form.reportValidity()) return;

  const companionNames=[...companionsWrap.querySelectorAll('[data-companion]')].map(i=>i.value.trim()).filter(Boolean);
  const childDetails=[];
  for(let i=1;i<=children;i++){
    const name=childrenWrap.querySelector(`[data-child-name="${i}"]`)?.value.trim()||'';
    const age=childrenWrap.querySelector(`[data-child-age="${i}"]`)?.value||'';
    childDetails.push(`${name} — ${age} anos`);
  }

  const registrationId = buildRegistrationId();
  document.getElementById('adultosHidden').value=adults;
  document.getElementById('criancasHidden').value=children;
  document.getElementById('acompanhantesHidden').value=companionNames.join(' | ');
  document.getElementById('criancasDetalhesHidden').value=childDetails.join(' | ');
  document.getElementById('valorTotalHidden').value=(adults*PRICE).toFixed(2);
  document.getElementById('inscricaoIdHidden').value=registrationId;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.adultos = adults;
  payload.criancas = children;
  payload.acompanhantes = companionNames;
  payload.criancas_detalhes = childDetails;
  payload.valor_total = adults * PRICE;
  payload.inscricao_id = registrationId;

  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Registrando...';

  try{
    const res = await fetch('/api/register',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const result = await res.json().catch(()=>({}));
    if(!res.ok || !result.ok || !result.checkout_url) throw new Error(result.error || 'Falha ao gerar checkout');

    document.getElementById('successTotal').textContent=money(adults*PRICE);
    document.getElementById('successText').textContent=`Inscrição ${registrationId} registrada para ${adults} adulto(s) e ${children} criança(s).`;

    paymentAlert.innerHTML = `<strong>Pagamento único:</strong> o checkout foi gerado no valor total de <strong>${money(adults*PRICE)}</strong>. Na próxima tela você poderá escolher <strong>Pix ou cartão de crédito</strong>.`;

    const checkoutButton = document.getElementById('dynamicCheckoutButton');
    checkoutButton.href = result.checkout_url;
    checkoutButton.dataset.checkoutUrl = result.checkout_url;

    document.getElementById('success').classList.remove('hidden-section');
    document.getElementById('success').scrollIntoView({behavior:'smooth'});
  }catch(err){
    alert('Não foi possível registrar sua inscrição agora. Tente novamente.');
  }finally{
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
});
