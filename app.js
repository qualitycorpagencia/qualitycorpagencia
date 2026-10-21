const PRICE = 62;
const PIX_CODE = "00020101021126360014br.gov.bcb.pix0114+5519983673456520400005303986540562.005802BR5915MARCIO SANTA FE6009SAO PAULO622905251M5G4QPHFYJ9V3YN41R0V7526630429FB";
const CARD_PAYMENT_URL = "https://link.infinitepay.io/qualitycorp/VC1D-F0yoFqtzHG-62,00";

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
const copyPixButton = document.getElementById('copyPixButton');
const cardPaymentButton = document.getElementById('cardPaymentButton');
const pixCode = document.getElementById('pixCode');
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
    title.textContent='Crianças de até 8 anos';
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
pixCode.value = PIX_CODE;

function buildRegistrationId(){
  const now = new Date();
  const stamp = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('');
  return `STNB-${stamp}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

copyPixButton.addEventListener('click', async ()=>{
  try{
    await navigator.clipboard.writeText(PIX_CODE);
    const original = copyPixButton.textContent;
    copyPixButton.textContent = 'Código Pix copiado ✓';
    setTimeout(()=> copyPixButton.textContent = original, 2200);
  }catch{
    pixCode.focus();
    pixCode.select();
    document.execCommand('copy');
  }
});

cardPaymentButton.addEventListener('click', ()=>{
  window.open(CARD_PAYMENT_URL,'_blank','noopener,noreferrer');
});

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

  const data = new URLSearchParams(new FormData(form));
  try{
    const res=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data.toString()});
    if(!res.ok) throw new Error('Falha ao registrar inscrição');

    document.getElementById('successTotal').textContent=money(adults*PRICE);
    document.getElementById('successText').textContent=`Inscrição ${registrationId} registrada para ${adults} adulto(s) e ${children} criança(s).`;

    paymentAlert.innerHTML = adults === 1
      ? `<strong>1 adulto:</strong> faça 1 pagamento de ${money(PRICE)} por Pix ou cartão.`
      : `<strong>${adults} adultos:</strong> o total é <strong>${money(adults*PRICE)}</strong>. Como os links de pagamento são de ${money(PRICE)} por pessoa, faça <strong>${adults} pagamentos de ${money(PRICE)}</strong> — um para cada adulto.`;

    document.getElementById('success').classList.remove('hidden-section');
    document.getElementById('success').scrollIntoView({behavior:'smooth'});
    document.querySelector('.mobile-cta').style.display='none';
  }catch(err){
    alert('Não foi possível registrar sua inscrição agora. Tente novamente.');
  }
});
