/* ALVES Pro – melhorias.js | carregar DEPOIS do script principal, antes de </body> */
(function(){
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const dia=ms=>new Date(Date.now()+ms*864e5);
window.hojeLocal=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());

/* 1. Zoom liberado (acessibilidade) */
const vp=document.querySelector('meta[name=viewport]');if(vp)vp.content='width=device-width, initial-scale=1, viewport-fit=cover';
const opA=document.querySelector('#ap_tipo option[value=aluguel]');if(opA)opA.textContent='🏠 Aluguel';

/* 2. Anti-XSS: neutraliza < > e links perigosos nos dados (nuvem e local) */
function sanear(o,k){
 if(typeof o==='string'){
  if(o.startsWith('data:image/'))return o;
  if(k==='link'||k==='logo')return /^https?:\/\//i.test(o)?o.replace(/["'<>\s]/g,''):'';
  return o.replace(/</g,'‹').replace(/>/g,'›');
 }
 if(Array.isArray(o))return o.map(x=>sanear(x,k));
 if(o&&typeof o==='object')for(const key in o)o[key]=sanear(o[key],key);
 return o;
}
const _cd=window.carregarDados;
window.carregarDados=function(){
 sanear(DB);
 if(DB.config&&DB.config.ia_api_key){ /* migra a chave de IA para fora do banco */
  localStorage.setItem('alvesIAKey',DB.config.ia_api_key);delete DB.config.ia_api_key;saveDB().catch(()=>{});
 }
 _cd();
};

/* 3. Chave de IA só neste aparelho */
const _sc=window.salvarConfig;
window.salvarConfig=function(){
 const i=$('cfg_ia_api_key'),k=i.value.trim();
 k?localStorage.setItem('alvesIAKey',k):localStorage.removeItem('alvesIAKey');
 i.value='';_sc();i.value=k;
};
const _cc=window.carregarConfiguracoes;
window.carregarConfiguracoes=function(){_cc();const i=$('cfg_ia_api_key');if(i)i.value=localStorage.getItem('alvesIAKey')||''};
const _ia=window.gerarDescricaoOrcamentoIA;
window.gerarDescricaoOrcamentoIA=async function(){
 DB.config=DB.config||{};DB.config.ia_api_key=localStorage.getItem('alvesIAKey')||'';
 try{await _ia()}finally{delete DB.config.ia_api_key}
};

/* 4. Estoque baixa ao salvar pedido (e devolve ao editar/excluir) */
const somaEst=a=>{const m={};(a||[]).filter(i=>i.tipo_item==='estoque'&&i.id_referencia).forEach(i=>m[i.id_referencia]=(m[i.id_referencia]||0)+(i.qtd||0));return m};
const ajustaEst=(a,b)=>new Set([...Object.keys(a),...Object.keys(b)]).forEach(k=>{
 const e=DB.estoque.find(x=>x.id==k);if(e)e.quantidade=Math.max(0,(e.quantidade||0)-((b[k]||0)-(a[k]||0)));
});
const _sp=window.salvarPedido;
window.salvarPedido=function(){
 try{
  garantirArraysDB();
  const t=$('f_tipo').value,s=$('f_status').value,id=$('f_id').value;
  const vira=t==='servico'||(t==='orcamento'&&s==='aprovado');
  if(t!=='compra'){
   const rec=id?DB.servicos.find(x=>x.id==id):null;
   const antes=rec&&rec.tipo==='servico'?somaEst(rec.itens_usados):{};
   ajustaEst(antes,vira?somaEst(itensNoPedido):{});
  }
 }catch(e){console.error(e)}
 _sp();
};
const _er=window.excluirRegistro;
window.excluirRegistro=function(t,id){
 const rec=t==='servicos'?DB.servicos.find(x=>x.id==id):null;
 _er(t,id);
 if(rec&&rec.tipo==='servico'&&!DB.servicos.find(x=>x.id==id)){ajustaEst(somaEst(rec.itens_usados),{});saveDB()}
};

/* 5. Caixa real: inclui pagamentos do "A Pagar" nas saídas */
function ajustaCaixa(){
 if(!$('tela_home').classList.contains('ativa'))return;
 const mA=$('filtro_mes').value,yA=String(new Date().getFullYear());
 const nm=d=>d&&d.slice(0,4)===yA&&d.slice(5,7)===mA;
 let rec=0;
 DB.servicos.forEach(p=>{if(p.tipo!=='servico')return;
  [[p.pago_entrada,p.data_entrada],[p.pago_parcela1,p.data_parcela1],[p.pago_parcela2,p.data_parcela2],[p.pago_parcela3,p.data_parcela3]]
   .forEach(([v,d])=>{if(v>0&&nm(d||p.data))rec+=v})});
 const gas=DB.gastos.filter(g=>nm(g.data)).reduce((a,g)=>a+(g.valor||0),0);
 const ap=DB.a_pagar.reduce((s,a)=>s+(a.pagamentos||[]).filter(p=>nm(p.data)).reduce((x,p)=>x+(p.valor||0),0),0);
 const liq=rec-gas-ap;
 $('h_gastos').innerText='R$ '+formatMoeda(gas+ap);
 $('h_gastos').previousElementSibling.innerHTML='<i class="fas fa-arrow-down"></i> Saídas (Gastos + A Pagar)';
 $('h_lucro').innerText='R$ '+formatMoeda(liq);
 $('h_lucro').style.color=liq<0?'var(--red)':'var(--blue)';
}
const _rg=window.renderizarGrafico;
window.renderizarGrafico=function(){_rg();setTimeout(ajustaCaixa,500)};

/* 6. Alertas no Painel */
function alertas(){
 const h=$('tela_home');if(!h||typeof DB==='undefined')return;
 let box=$('alertas_home');if(!box){box=document.createElement('div');box.id='alertas_home';h.prepend(box)}
 const hj=hojeLocal(),am=hojeLocal(dia(1)),lim=hojeLocal(dia(7)),L=[];
 (DB.a_pagar||[]).forEach(a=>{
  const r=(a.valor_total||0)-(a.pagamentos||[]).reduce((s,p)=>s+(p.valor||0),0);
  if(r>0.01&&a.data_vencimento&&a.data_vencimento<=lim){const v=a.data_vencimento<hj;
   L.push([v?'var(--red)':'var(--orange)',(v?'⚠️ Vencido em ':'⏰ Vence em ')+formatarDataBR(a.data_vencimento)+' — '+a.nome+' (R$ '+formatMoeda(r)+')'])}});
 (DB.servicos||[]).forEach(p=>{
  if(p.tipo==='compromisso'&&p.status==='pendente'&&(p.data===hj||p.data===am))L.push(['var(--purple)','📅 '+(p.data===hj?'Hoje':'Amanhã')+': '+p.cliente]);
  if(p.tipo==='servico'&&p.status==='concluido'&&(p.total||0)-(p.pago||0)>0.01)L.push(['var(--cyan)','💰 '+p.cliente+' ainda deve R$ '+formatMoeda(p.total-p.pago)])});
 box.innerHTML=L.length?'<div style="background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:12px;margin-bottom:15px;font-size:12px;line-height:1.7"><b style="color:var(--gold)">🔔 ATENÇÃO</b>'+L.slice(0,10).map(([c,t])=>'<div style="color:'+c+'">'+t+'</div>').join('')+'</div>':'';
}

/* 7. Performance: junta várias renderizações seguidas em uma só */
const _rt=window.renderizarTudo;let tmr;
window.renderizarTudo=function(){cancelAnimationFrame(tmr);tmr=requestAnimationFrame(()=>{_rt();alertas()})};

/* 8. Notificações: só pede permissão após um toque; usa data local */
window.checarAgendaNotif=function(){
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 const am=hojeLocal(dia(1));
 dadosPedidos.forEach(p=>{if(p.tipo==='compromisso'&&p.status==='pendente'&&p.data===am){
  const k='n_'+p.id+'_'+am;
  if(!localStorage.getItem(k)){new Notification('Agenda: '+p.cliente,{body:p.servico||'Lembrete p/ amanhã'});localStorage.setItem(k,'1')}}});
};
document.addEventListener('click',()=>{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()},{once:true});

/* 9. Backup/limpeza mais seguros */
const _ib=window.importarBackup;
window.importarBackup=function(e){
 const f=e.target.files[0];if(!f)return;e.target.value='';
 const r=new FileReader();
 r.onload=ev=>{
  try{const d=JSON.parse(ev.target.result);if(!d||typeof d!=='object'||!('servicos' in d||'estoque' in d||'config' in d))throw 0}
  catch(_){return showToast('Arquivo inválido!','error')}
  if(!confirm('Isto SUBSTITUI todos os dados atuais (um backup de segurança será baixado antes). Continuar?'))return;
  exportarBackup();_ib({target:{files:[f],value:''}});
 };
 r.readAsText(f);
};
window.limparBancoDados=function(){
 if(prompt('Isto apaga TUDO na nuvem. Digite APAGAR para confirmar:')!=='APAGAR')return showToast('Cancelado','info');
 exportarBackup();
 database.ref('alvesProDB').remove().then(()=>{localStorage.removeItem('alvesProDB');location.reload()}).catch(e=>showToast('Erro: '+e.message,'error'));
};

/* 10. Login (Firebase Auth) – protege o banco */
const _init=window.initDB;let iniciado=false;
function telaLogin(){
 if($('login_ov'))return;
 const d=document.createElement('div');d.id='login_ov';
 d.style.cssText='position:fixed;inset:0;background:#0f1117;z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px';
 d.innerHTML='<div style="background:var(--card);border:1px solid var(--gold);border-radius:15px;padding:25px;width:100%;max-width:340px;text-align:center"><h3 style="color:var(--gold);margin:0 0 15px">🔒 ALVES Pro</h3><input id="lg_email" type="email" placeholder="E-mail" autocomplete="username"><input id="lg_senha" type="password" placeholder="Senha" autocomplete="current-password"><button id="lg_btn" style="width:100%;padding:14px;background:var(--blue);border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer">ENTRAR</button></div>';
 document.body.appendChild(d);
 const go=()=>firebase.auth().signInWithEmailAndPassword($('lg_email').value.trim(),$('lg_senha').value).catch(()=>showToast('E-mail ou senha incorretos','error'));
 $('lg_btn').onclick=go;$('lg_senha').onkeypress=e=>{if(e.key==='Enter')go()};
}
function botaoSair(){
 if($('btn_sair'))return;
 const b=document.createElement('button');b.id='btn_sair';b.className='btn-outline';
 b.style.cssText='color:var(--red);border-color:var(--red);margin-top:10px';
 b.innerHTML='<i class="fas fa-sign-out-alt"></i> SAIR';
 b.onclick=()=>firebase.auth().signOut().then(()=>location.reload());
 $('tela_config').appendChild(b);
}
window.initDB=function(){
 if(!firebase.auth){_init();return}
 firebase.auth().onAuthStateChanged(u=>{
  if(u){const o=$('login_ov');if(o)o.remove();if(!iniciado){iniciado=true;_init()}botaoSair()}
  else telaLogin();
 });
};
})();
