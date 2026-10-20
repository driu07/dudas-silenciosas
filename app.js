/* Dudas Silenciosas v2.0 · interfaz estática compatible con GitHub Pages.
   Datos: Supabase Auth + PostgreSQL (RLS) + Realtime.
   El análisis por IA se ejecuta SOLO en Supabase Edge Function, nunca desde este JS. */
(() => {
'use strict';
const ROOT = document.getElementById('app');
const CFG = window.DS_CONFIG || {};
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(CFG.supabaseUrl || '') &&
  /^(sb_publishable_|eyJ)/.test(CFG.supabasePublishableKey || '');
const KIND = { error:'Posible error conceptual', proc:'Dificultad de procedimiento', duda:'Duda de contenido', otro:'Otra / logística' };
const DEMO = [
  ['¿por qué el 3 pasa dividiendo al otro lado?','A'],['no entiendo por qué lo que multiplica pasa dividiendo','A'],
  ['¿el número siempre cambia de operación cuando cambia de lado?','A'],['¿qué significa hacer lo mismo en ambos lados?','A'],
  ['pasar dividiendo es una regla o hay una razón?','A'],['¿por qué se puede pasar el 3 si está pegado a la x?','A'],
  ['¿cuándo se invierte el signo?','B'],['me confundo con los signos cuando el número es negativo','B'],
  ['si tengo -2x = 8 ¿x queda negativo o positivo?','B'],['no sé cuándo cambiar el signo','B'],
  ['¿qué hago si hay x en los dos lados?','C'],['en 2x + 3 = x + 7 ¿cuál x muevo primero?','C'],
  ['¿se pueden juntar las x de lados distintos?','C'],['¿qué hago si hay paréntesis?','C'],
  ['¿cómo compruebo que mi resultado está bien?','D'],['¿hay que reemplazar la x al final?','D'],
  ['¿se puede dividir por cero?','E'],['¿qué pasa si al final queda 0 = 0?','E'],
  ['¿esto entra en el control?','X'],['¿van a subir las diapositivas?','X'],
];
const DDEFS = {
 A:{label:'Por qué «pasa dividiendo»',kind:'error',gap:'Podría estarse aplicando una regla sin comprender que se opera en ambos lados.',tip:'Explicar la ecuación como balanza y dividir ambos lados por 3.'},
 B:{label:'Signos y números negativos',kind:'proc',gap:'Hay dudas al operar con valores negativos.',tip:'Resolver −2x = 8 en la pizarra dividiendo por −2.'},
 C:{label:'Incógnita en ambos lados',kind:'proc',gap:'No está claro cómo empezar cuando hay x en ambos miembros.',tip:'Desarrollar un ejemplo reuniendo los términos con x.'},
 D:{label:'Comprobar resultados',kind:'duda',gap:'Preguntas sobre verificación de soluciones.',tip:'Sustituir x en la ecuación original.'},
 E:{label:'Casos especiales',kind:'duda',gap:'Confusión sobre soluciones únicas, infinitas o imposibles.',tip:'Comparar 0 = 0 con 0 = 5.'},
 X:{label:'Preguntas logísticas',kind:'otro',gap:'Consultas administrativas.',tip:''},
};
const STOP = new Set('el la los las un una unos unas de del al a y o en por para con sin que se es son lo le como si no mas pero porque mi me tu ya hay esta este esto eso esa ese ser hace cuando tambien muy solo asi cual donde quien entiendo entendi duda dudas pregunta profe profesor clase quiero saber cosa cosas tengo tiene hacer puedo pueden estoy nosotros ustedes'.split(' '));
const S = {
  view:'home', configured, ready:!configured, tc:null, sc:null, teacher:null, classes:[], cls:null,
  doubts:[], doubtTotal:0, participants:0, pulse:{yes:0,no:0,total:0},
  student:null, studentSent:false, studentAnswer:null, studentSentCount:0,
  demo:false, demoBusy:false, loading:false, actionBusy:false, aiBusy:false, ai:null,
  channel:null, live:false, poll:null, queued:null, refreshBusy:false, refreshEpoch:0, lastSyncAt:null, syncError:'',
  openTopic:null, projector:false, confirm:null, otpSent:false, notice:'', connectError:'',
};
const $ = sel => document.querySelector(sel);
const esc = val => String(val ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = (v,n=400) => String(v ?? '').replace(/\s+/g,' ').trim().slice(0,n);
const fmt = v => v ? new Date(v).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}) : '—';
const dateFmt = v => v ? new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}) : '—';
const normal = x => clean(x,2000).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ');
const read = (key, fallback=null) => {try{const x=localStorage.getItem(key);return x===null?fallback:JSON.parse(x);}catch{return fallback;}};
const store = (key,v) => {try{localStorage.setItem(key,JSON.stringify(v));}catch{}};
const delStore = key => {try{localStorage.removeItem(key);}catch{}};
const slug = s => clean(s,40).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/g,'-') || 'clase';
const classUrl = code => location.origin + location.pathname + '#' + code;
const captchaEnabled = () => !!(CFG.turnstileSiteKey || '').trim();
let captchaWidget = null;
function captchaToken(){
  if(!captchaEnabled())return null;
  try{return captchaWidget!==null && window.turnstile ? window.turnstile.getResponse(captchaWidget)||null : null;}catch{return null;}
}
function mountCaptcha(){
  if(!captchaEnabled()||!window.turnstile||captchaWidget!==null)return;
  const spot=$('#ds-captcha');if(!spot)return;
  try{captchaWidget=window.turnstile.render(spot,{sitekey:CFG.turnstileSiteKey,theme:'auto',size:'flexible',language:'es'});}
  catch(e){console.warn('No se pudo cargar el control anti-bots.',e);}
}
window.dsTurnstileLoaded=mountCaptcha;
const isDemo = () => S.demo;
const active = () => S.cls && S.cls.status==='open';
const visibleDoubts = () => S.doubts.filter(d => !d.hidden);
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function toast(message,error=false){
  const el=document.createElement('div');el.className='toast'+(error?' err':'');el.textContent=message;
  document.getElementById('toasts').appendChild(el);setTimeout(()=>el.remove(),error?6800:3400);
}
function errMessage(e){
  const m=clean(e?.message || String(e),240);
  if(/invalid login credentials/i.test(m)) return 'Credenciales inválidas.';
  if(/rate limit/i.test(m)) return 'Se alcanzó un límite temporal de solicitudes. Prueba nuevamente.';
  if(/anonymous.*disabled|anonymous sign.*disabled/i.test(m)) return 'Activa Anonymous Sign-Ins en Supabase > Authentication.';
  if(/Failed to fetch|networkerror/i.test(m)) return 'No se pudo conectar a Supabase. Revisa internet y la configuración.';
  if(/Email rate limit exceeded/i.test(m)) return 'Límite de correos del proveedor. Revisa la configuración de correo de Supabase.';
  return m || 'Ocurrió un error inesperado.';
}
function status(){
  const el=$('#conn');if(!el)return;
  const label=!configured?'Demo · sin configurar':S.connectError?'Error de conexión':S.demo?'Simulación':S.live?'En tiempo real':S.ready?'Servidor configurado':'Conectando…';
  el.className='conn '+(S.live?'on':S.connectError?'off':!configured||S.demo?'wait':'wait');
  const target=el.querySelector('span');if(target)target.textContent=label;
  el.title=S.live?'Canal Realtime activo. Existe actualización periódica de respaldo.':
    'Cuando no hay conexión en vivo, la aplicación usa consultas periódicas si el servidor está disponible.';
}
function mount(html){
  const saved={};ROOT.querySelectorAll('input[id],textarea[id]').forEach(x=>{saved[x.id]=x.value;});
  const old=document.activeElement;const id=old?.id||null;let pos=null;
  try{pos=old.selectionStart;}catch{}
  const feed=ROOT.querySelector('.feed');const scroll=feed?.scrollTop||0;
  if(captchaWidget!==null && window.turnstile){try{window.turnstile.remove(captchaWidget);}catch{}captchaWidget=null;}
  ROOT.innerHTML=html;
  Object.entries(saved).forEach(([key,value])=>{const dest=document.getElementById(key);if(dest && dest.type!=='checkbox')dest.value=value;});
  if(id){const x=document.getElementById(id);if(x){try{x.focus({preventScroll:true});if(pos!==null)x.setSelectionRange(pos,pos);}catch{}}}
  const newFeed=ROOT.querySelector('.feed');if(newFeed)newFeed.scrollTop=scroll;
  const box=$('#qrbox');
  if(box&&S.cls&&!S.demo){
    const url=classUrl(S.cls.code);
    try{
      if(window.QRCode) new window.QRCode(box,{text:url,width:220,height:220,colorDark:'#0f1a1d',colorLight:'#ffffff'});
      else box.innerHTML='<p style="padding:16px;color:#132429">No se pudo cargar el QR. Comparte el enlace o el código.</p>';
    }catch{box.textContent='Comparte el enlace indicado abajo.';}
  }
  mountCaptcha();
  status();
}
function render(){
  let h='';
  if(S.view==='home')h=viewHome();
  else if(S.view==='teacher')h=viewTeacher();
  else if(S.view==='dash')h=viewDash();
  else if(S.view==='student')h=viewStudent();
  else h=viewHome();
  if(S.projector&&S.cls&&!S.demo)h+=viewProjector();
  if(S.confirm)h+=`<div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="cftitle"><div class="modal"><h2 id="cftitle">${esc(S.confirm.title)}</h2><p>${esc(S.confirm.message)}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="cancelConfirm">Cancelar</button><button class="btn ${S.confirm.danger?'danger':'primary'}" data-act="acceptConfirm">${esc(S.confirm.ok)}</button></div></div></div>`;
  mount(h);
}
function viewHome(){
  const joinHash=location.hash.slice(1).toUpperCase();
  const hinted=/^[A-HJ-NP-Z2-9]{6}$/.test(joinHash)?joinHash:'';
  return `<section class="stack" style="max-width:790px">
    <span class="eyebrow">FCFM · Universidad de Chile · Educación con IA</span>
    <h1>Lo que el curso no dice en voz alta, a tiempo para enseñar.</h1>
    <p class="muted" style="font-size:1.08rem">Los estudiantes comparten dudas sin identificarse ante el profesor. El tablero reúne temas recurrentes y ayuda a decidir qué explicar nuevamente.</p>
  </section>
  ${!configured?`<div class="alert" style="margin-top:18px"><b>Modo de demostración.</b> Falta completar <code>config.js</code> y configurar Supabase para recibir dudas entre dispositivos. Mientras tanto puedes explorar una clase ficticia.</div>`:''}
  ${S.connectError?`<div class="alert" style="margin-top:16px">${esc(S.connectError)}</div>`:''}
  <div class="home">
   <section class="card raised stack"><span class="eyebrow">Participar</span><h2>Soy estudiante</h2>
     <p class="small muted">Ingresa el código de la clase o escanea el QR del profesor. No necesitas escribir tu nombre ni correo.</p>
     <form class="stack" data-form="join"><label class="f">Código de seis caracteres
       <input id="join-code" class="code-input" maxlength="6" type="text" placeholder="ABC234" value="${esc(hinted)}" autocapitalize="characters" autocomplete="off" required></label>
       ${captchaEnabled()?'<div id="ds-captcha" aria-label="Verificación anti-bots"></div><p class="explain">Completa la verificación si es solicitada. Solo se necesita al ingresar por primera vez.</p>':''}
       <button class="btn primary big" type="submit" ${!configured||S.actionBusy?'disabled':''}>${S.actionBusy?'Conectando…':'Entrar a la clase'}</button></form>
   </section>
   <section class="card raised stack"><span class="eyebrow">Gestionar</span><h2>Soy profesor/a</h2>
     <p class="small muted">Accede con tu correo autorizado para crear clases, proyectar el código y revisar las dudas.</p>
     <button class="btn primary big" data-act="teacher" ${!configured?'disabled':''}>${S.teacher?'Abrir mis clases':'Acceder como profesor'}</button>
     <button class="btn big" data-act="demo">Explorar una clase de ejemplo</button>
     <p class="explain">La demostración utiliza datos ficticios y no se comparte con otros dispositivos.</p>
   </section>
  </div>
  <div class="card stack" style="margin-top:20px"><h3>Privacidad en esta actividad</h3>
  <p class="small muted">Las dudas se guardan en Supabase. El profesor no recibe nombres ni correos asociados a ellas. Se emplea un identificador interno por dispositivo/sesión para limitar el abuso. Si el docente activa el análisis con IA, los textos se envían a Anthropic. No incluyas nombres, teléfonos, información médica ni otros datos personales. Un código de clase puede compartirse, así que no representa una invitación completamente privada.</p></div>`;
}
function viewTeacher(){
  if(!configured)return viewHome();
  if(!S.teacher)return `<div class="stack" style="max-width:540px;margin:0 auto">
    <button class="btn ghost sm" data-act="home" style="align-self:start">← Volver</button>
    <span class="eyebrow">Acceso docente</span><h1>Tu espacio de clases</h1>
    <div class="card stack"><h2>Entrar con correo</h2><p class="muted small">Recibirás un enlace de acceso. Ábrelo en el navegador donde utilizarás el tablero. Tu correo debe estar en la lista de profesores autorizados de Supabase.</p>
    <form class="stack" data-form="login"><label class="f">Correo electrónico<input id="email" type="email" autocomplete="email" placeholder="profesor@universidad.cl" required></label>
    ${captchaEnabled()?'<div id="ds-captcha" aria-label="Verificación anti-bots"></div>':''}
    <button class="btn primary big" type="submit" ${S.actionBusy?'disabled':''}>${S.actionBusy?'Enviando…':'Enviar enlace de acceso'}</button></form>
    ${S.otpSent?'<div class="notice">Si Supabase aceptó la solicitud, revisa tu correo y spam. El enlace puede tardar. Si el mensaje no llega, revisa el proveedor SMTP y los límites de Auth.</div>':''}
    </div></div>`;
  return `<div class="stack" style="max-width:850px;margin:0 auto">
    <div class="row" style="justify-content:space-between;align-items:end"><div><span class="eyebrow">Panel docente</span><h1>Mis clases</h1><p class="muted small">${esc(S.teacher.email||'Profesor autenticado')}</p></div>
    <button class="btn sm" data-act="logout">Cerrar sesión</button></div>
    <form data-form="create" class="card stack"><h2>Crear una clase</h2>
       <label class="f">Nombre del curso<input id="c-title" type="text" maxlength="80" minlength="3" required placeholder="MA1101 Introducción al Álgebra"></label>
       <label class="f">Tema de hoy<input id="c-topic" type="text" maxlength="160" placeholder="Ecuaciones de primer grado"></label>
       <button class="btn primary" type="submit" ${S.actionBusy?'disabled':''}>${S.actionBusy?'Creando…':'Crear clase y abrir tablero'}</button></form>
    <div class="card stack"><div class="row" style="justify-content:space-between"><h2>Clases guardadas</h2><button class="btn sm" data-act="refreshClasses">Actualizar</button></div>
    ${S.classes.length?S.classes.map(c=>`<div class="sess"><div class="t"><b>${esc(c.title)}</b><div class="small muted">${esc(c.code)} · ${esc(c.topic||'Sin tema')} · ${c.status==='closed'?'Terminada':'Abierta'} · ${dateFmt(c.created_at)}</div></div><button class="btn sm primary" data-act="openClass" data-id="${esc(c.id)}">Abrir</button><button class="btn sm danger" data-act="deleteClass" data-id="${esc(c.id)}" title="Eliminar todos los datos">Borrar</button></div>`).join(''):'<p class="muted small">Todavía no tienes clases. Crea una arriba.</p>'}
    </div></div>`;
}
function viewStudent(){
  const st=S.student;if(!st)return viewHome();
  const closed=st.status!=='open';
  const answerKey=`ds_pulse_${st.id}_${st.pulse_version}`;
  const answered=read(answerKey,null);
  return `<div class="stu">
    <div class="row" style="justify-content:space-between"><div><span class="eyebrow">Clase ${esc(st.code)}</span><h2>${esc(st.title)}</h2>${st.topic?`<p class="small muted">${esc(st.topic)}</p>`:''}</div><button class="btn sm ghost" data-act="home">Salir</button></div>
    ${closed?`<div class="card sent"><div class="ok">✓</div><h2>La clase terminó</h2><p class="muted">Ya no recibe nuevas dudas. Gracias por participar.</p></div>`:
    `${S.studentSent?`<div class="card sent"><div class="ok">✓</div><h2>Tu duda se envió</h2><p class="muted">El docente la verá sin tu nombre.</p><button class="btn primary" data-act="another">Escribir otra duda</button></div>`:
    `<form data-form="doubt" class="card stack"><label class="f" for="d-text"><span style="font:600 1.35rem var(--f-display)">¿Qué no te quedó claro?</span><span class="hint">Explica tu duda con tus palabras (5–400 caracteres).</span></label>
    <textarea id="d-text" minlength="5" maxlength="400" required placeholder="Ejemplo: ¿por qué puedo dividir ambos lados de una ecuación por el mismo número?"></textarea>
    <button type="submit" class="btn primary big" ${S.actionBusy?'disabled':''}>${S.actionBusy?'Enviando…':'Enviar duda anónima'}</button></form>`}
    ${st.pulse_version>0?`<div class="card stack"><span class="eyebrow">Chequeo de comprensión percibida</span><h3>${esc(st.pulse_question||'¿Quedó claro lo que explicamos?')}</h3>
      ${st.pulse_open?`<p class="small muted">Tu respuesta es anónima. Puedes cambiarla mientras esté abierta.</p>
      <div class="pulse-choices"><button data-act="pulseYes" class="btn ${answered===true?'primary':''}" ${S.actionBusy?'disabled':''}>✓ Sí, lo entendí</button><button data-act="pulseNo" class="btn ${answered===false?'primary':''}" ${S.actionBusy?'disabled':''}>? Todavía tengo dudas</button></div>
      ${answered!==null?'<p class="small muted">Respuesta registrada.</p>':''}`:'<p class="small muted">Esta comprobación ya terminó.</p>'}</div>`:''}`}
    <div class="notice">No incluyas datos personales. El docente puede solicitar un análisis pedagógico mediante IA (Anthropic). Máximo 12 dudas por participante, con 8 segundos entre envíos.</div>
  </div>`;
}
function viewDash(){
  const c=S.cls;if(!c)return viewTeacher();
  const ds=S.doubts;const live=visibleDoubts();const hidden=ds.length-live.length;
  const analysis=currentAnalysis(live);const source=analysis?.source||'local';
  const n=live.length;
  const answers=S.pulse;
  return `<div class="actionbar"><button class="btn sm ghost" data-act="backClasses">← ${S.demo?'Inicio':'Mis clases'}</button>
    <span class="spacer"></span>
    <span class="pill ${S.demo?'':'live'}">${S.demo?'MODO DEMO':c.status==='open'?'CLASE ABIERTA':'CLASE TERMINADA'}</span>
    ${!S.demo?`<button class="btn sm" data-act="refreshDash">Actualizar</button><button class="btn sm" data-act="csv">Exportar CSV</button><button class="btn sm" data-act="report">Informe / PDF</button>`:
      `<button class="btn sm" data-act="csv">CSV de ejemplo</button><button class="btn sm" data-act="report">Informe de ejemplo</button>`}
  </div>
  <div class="bar">
    <div class="codebox"><span class="small" style="opacity:.85">${S.demo?'Código ilustrativo':'Código de la clase'}</span><span class="code">${esc(c.code)}</span></div>
    <div><h2 style="font-size:1.3rem">${esc(c.title)}</h2><p class="muted small">${esc(c.topic||'Tema no especificado')}</p></div>
    <div class="stat"><b class="tnum">${n}</b><span class="small muted">dudas visibles</span><p class="small muted">${hidden} ocultas · ${S.demo?'ficticias':S.participants+' participantes registrados'}</p></div>
    <div class="row">${!S.demo?`<button class="btn" data-act="proj">Proyectar código</button><button class="btn ${active()?'danger':''}" data-act="toggleClass">${active()?'Terminar clase':'Reabrir clase'}</button>`:
    `<button class="btn primary" data-act="simulate" ${S.demoBusy?'disabled':''}>${S.demoBusy?'Simulando…':'Simular dudas'}</button>`}</div>
  </div>
  ${S.demo?'<p class="notice" style="margin-bottom:14px">Esta clase contiene exclusivamente preguntas ficticias. Las etiquetas del escenario son ejemplos preparados, no resultados de un modelo de IA.</p>':''}
  ${!S.demo&&S.doubtTotal>1000?'<div class="alert" style="margin-bottom:14px">Hay más de 1000 dudas. El tablero y las exportaciones muestran solo las 1000 más recientes. Para un respaldo completo, consulta Supabase.</div>':''}
  ${S.syncError&&!S.demo?`<div class="alert" style="margin-bottom:12px">No se pudo actualizar la información de esta clase. Los datos pueden estar desactualizados. ${esc(S.syncError)} Pulsa Actualizar.</div>`:''}
  ${S.lastSyncAt&&!S.demo?`<p class="explain" style="margin:0 0 12px">Última sincronización correcta: ${esc(fmt(S.lastSyncAt))}. Respaldo automático cada 10 segundos.</p>`:''}
  ${S.loading?'<p class="muted small" style="margin-bottom:12px">Actualizando información…</p>':''}
  <div class="dash">
    <section class="stack" style="min-width:0">
      ${analysisBlock(analysis,live,source)}
      <div class="card stack"><div class="row" style="justify-content:space-between"><div><span class="eyebrow">Evaluación formativa</span><h3>¿Se percibe mayor claridad?</h3></div></div>
      ${S.demo?'<p class="muted small">En una clase real, el profesor puede lanzar una pregunta de comprobación y observar cuántos respondieron que entendieron.</p>':pulseBlock(c,answers)}
      </div>
    </section>
    <aside class="stack">
      <div class="card stack" style="gap:10px"><div class="row" style="justify-content:space-between"><h3>Dudas recibidas</h3><span class="muted small">${ds.length?'última '+fmt(ds[ds.length-1].created_at):'Sin preguntas'}</span></div>
      ${spark(ds)}
      ${ds.length?`<div class="feed">${ds.slice().reverse().slice(0,90).map(d=>`<div class="doubt ${d.hidden?'hidden-doubt':''}"><span class="t">${fmt(d.created_at)} ${d.hidden?'· OCULTA':''}</span><div class="doubt-text">${esc(d.text)}</div>
         ${!S.demo?`<div class="controls"><button class="btn sm ${d.hidden?'':'ghost'}" data-act="moderate" data-id="${esc(d.id)}" data-hidden="${d.hidden?'false':'true'}" ${S.actionBusy?'disabled':''}>${d.hidden?'Restaurar':'Ocultar'}</button></div>`:''}</div>`).join('')}</div>`:
        '<div class="empty">Todavía no hay dudas. Comparte el código de la clase o ejecuta la simulación.</div>'}
      <p class="explain">Solo el docente puede leer las dudas. Ocultar una pregunta la excluye del análisis y conserva el registro hasta eliminar la clase.</p>
      </div>
    </aside>
  </div>`;
}
function pulseBlock(c,a){
  const percent=a.total?Math.round((a.yes/a.total)*100):0;
  return `${c.pulse_version>0?`<p class="small"><b>${esc(c.pulse_question)}</b> ${c.pulse_open?'<span class="pill live">Recibiendo respuestas</span>':'<span class="pill">Cerrada</span>'}</p>
     <div class="pulse-results"><div><div class="pulse-number">${a.yes}</div><span class="small muted">Sí, comprendí</span></div><div><div class="pulse-number">${a.no}</div><span class="small muted">Aún tengo dudas</span></div></div>
     <div class="pulse-meter" aria-label="${percent}% de quienes respondieron indicó que comprendió"><span style="width:${percent}%"></span></div>
     <p class="chart-note">${percent}% de ${a.total} respuestas registradas. No es una medida de comprensión del curso completo.</p>
     ${c.pulse_open?'<button class="btn sm" data-act="closePulse">Cerrar comprobación</button>':''}`:
     '<p class="muted small">Después de explicar una dificultad, pregunta si quedó clara y recoge respuestas anónimas.</p>'}
  ${active()?`<form class="stack" data-form="pulse"><label class="f"><span class="small">${c.pulse_version>0?'Nueva pregunta de comprobación':'Lanzar comprobación'}</span>
    <input id="pulse-question" type="text" minlength="8" maxlength="180" required value="¿Quedó claro el tema que acabamos de repasar?"></label>
    <button class="btn primary" type="submit" ${S.actionBusy?'disabled':''}>${c.pulse_version>0?'Lanzar otra comprobación':'Enviar pregunta a estudiantes'}</button></form>`:''}
  <p class="explain">Se mide percepción de comprensión, no resultados objetivos de aprendizaje. Cada participante puede responder una vez y cambiar su respuesta mientras esté abierta.</p>`;
}
function currentAnalysis(ds){
  if(!ds.length)return null;
  if(S.demo)return demoAnalysis(ds);
  const fingerprint=ds.map(d=>d.id).join('|');
  if(S.ai && S.ai.fingerprint===fingerprint && S.ai.topics?.length)return {...S.ai,source:'ia'};
  return localAnalysis(ds);
}
function analysisBlock(a,live,source){
  if(!a)return `<div class="card stack" style="align-items:center;text-align:center;padding:40px 24px"><h2>El análisis aparecerá aquí</h2><p class="muted">Cuando lleguen preguntas se agruparán automáticamente. Puedes solicitar análisis semántico con Claude después.</p></div>`;
  const topics=a.topics||[];
  const main=topics.find(t=>t.id===a.main)||topics[0];
  const base=a.processed||a.count||live.length;
  const max=Math.max(1,...topics.map(t=>t.ids.length));
  const byId=new Map(live.map(d=>[d.id,d]));
  const statusLine=source==='ia'?`Análisis con Claude · ${base} de ${live.length} dudas${a.limited?' (últimas 120)':''}`:
    source==='demo'?`Análisis ilustrativo de ${live.length} dudas ficticias`:`Agrupación textual automática · ${live.length} dudas (sin IA)`;
  return `<div class="statusline"><span class="small muted">${esc(statusLine)}</span><span class="spacer"></span>
    ${!S.demo?`<button class="btn sm" data-act="analyzeAI" ${S.aiBusy||S.actionBusy?'disabled':''}>${S.aiBusy?'Analizando…':'Analizar con IA'}</button>`:''}</div>
    ${S.ai&&source!=='ia'&&!S.demo?'<p class="chart-note">Llegaron o se moderaron dudas desde el último análisis de IA. Se muestra la agrupación textual actualizada.</p>':''}
    ${main?`<div class="hl k-${esc(main.kind)}"><span class="ic">!</span><div><span class="eyebrow">Prioridad para el docente</span><h2>${esc(main.label)}</h2>
      <p><b>${main.ids.length} de ${base}</b> dudas analizadas. ${esc(main.gap)}</p>
      ${main.tip?`<p class="small" style="margin-top:7px"><b>Sugerencia de intervención:</b> ${esc(main.tip)}</p>`:''}</div></div>`:''}
    <div class="card stack"><div class="row" style="justify-content:space-between"><h3>Temas presentes</h3><span class="small muted">Selecciona para ver ejemplos</span></div>
    <div class="chart" role="list">${topics.map(t=>{const open=S.openTopic===t.id;
      return `<div role="listitem"><button class="crow k-${esc(t.kind)} ${open?'open':''}" data-act="topic" data-id="${esc(t.id)}" aria-expanded="${open}">
        <span class="lab"><b>${esc(t.label)}</b><span class="n tnum">${t.ids.length}</span></span>
        <span class="track"><span class="fill" style="width:${Math.round(100*t.ids.length/max)}%"></span></span>
        ${open?`<span class="detail"><span class="small"><span class="pill kpill">${esc(KIND[t.kind]||'Duda')}</span> ${esc(t.gap)}</span>
           ${t.ids.slice(0,8).map(id=>byId.get(id)).filter(Boolean).map(d=>`<span class="q">«${esc(clean(d.text,175))}»</span>`).join('')}
           ${t.ids.length>8?`<span class="small muted">y ${t.ids.length-8} preguntas más</span>`:''}</span>`:''}
      </button></div>`;}).join('')}</div>
    <div class="legend">${Object.entries(KIND).map(([key,val])=>`<span class="k-${key}"><i></i>${esc(val)}</span>`).join('')}</div></div>
    ${a.summary?`<div class="card"><span class="eyebrow">${source==='ia'?'Síntesis sugerida por IA':'Síntesis'}</span><p>${esc(a.summary)}</p></div>`:''}
    <p class="chart-note">Las categorías son orientativas. Solo el docente puede determinar si una pregunta evidencia realmente una concepción errónea.</p>`;
}
function viewProjector(){
  const code=S.cls.code;const url=classUrl(code);
  return `<div class="proj" role="dialog" aria-modal="true" aria-label="Ingreso a la clase">
    <p style="font-size:1.25rem;opacity:.9">Escanea el QR o escribe el código en Dudas Silenciosas</p>
    <div class="code">${esc(code)}</div>
    <div id="qrbox" class="qr"></div>
    <p class="url">${esc(url)}</p><button class="btn" data-act="copyLink">Copiar enlace</button>
    <p>Envía tu duda sin escribir tu nombre ni datos personales.</p>
    <button class="btn" data-act="closeProj">Cerrar proyección</button>
  </div>`;
}
function spark(ds){
  if(!ds.length)return `<svg class="spark" viewBox="0 0 240 46" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="45" x2="240" y2="45"/></svg>`;
  const B=24;const times=ds.map(d=>+new Date(d.created_at)).filter(Number.isFinite);if(!times.length)return '';
  const t0=Math.min(...times);const t1=Math.max(Date.now(),t0+60000);const span=(t1-t0)/B;
  const bins=new Array(B).fill(0);times.forEach(t=>{bins[Math.min(B-1,Math.max(0,Math.floor((t-t0)/span)))]++;});
  const max=Math.max(1,...bins);
  return `<svg class="spark" viewBox="0 0 240 46" preserveAspectRatio="none" role="img" aria-label="Distribución de dudas recibidas en el tiempo">${bins.map((v,i)=>v?`<rect x="${i*10+1}" y="${(46-v/max*42).toFixed(1)}" width="8" height="${(v/max*42).toFixed(1)}" rx="1.5"/>`:'').join('')}<line x1="0" y1="45.5" x2="240" y2="45.5"/></svg>`;
}
function localAnalysis(ds){
  const terms=text=>[...new Set(normal(text).split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)).map(w=>w.length>6?w.replace(/(mente|aciones|acion|ando|iendo|ados|adas|idos|idas|ando|iendo|ar|er|ir|es|s)$/,'').slice(0,7):w))];
  const OFF=/\b(prueba|control|certamen|nota|diapositiva|diapositivas|recreo|asistencia|correo|ppt|horario)\b/;
  const items=ds.map(d=>({...d,t:terms(d.text),off:OFF.test(normal(d.text))}));
  const freq={};items.forEach(it=>it.t.forEach(w=>freq[w]=(freq[w]||0)+1));
  const groups=[];
  for(const it of items.filter(x=>!x.off)){
    let best=null,score=0;
    for(const g of groups){let shared=0;for(const w of it.t){if(g.f[w])shared+=1+Math.log(1+freq[w]);}
      const denom=Math.sqrt(Math.max(it.t.length,1))*Math.sqrt(Math.max(g.items.length,1));
      if(shared/denom>score){score=shared/denom;best=g;}}
    if(best&&score>=1.12){best.items.push(it);it.t.forEach(w=>best.f[w]=(best.f[w]||0)+1);}
    else{const g={items:[it],f:{}};it.t.forEach(w=>g.f[w]=1);groups.push(g);}
  }
  groups.sort((a,b)=>b.items.length-a.items.length);
  const major=groups.filter(g=>g.items.length>=2).slice(0,5);
  const other=groups.filter(g=>!major.includes(g)).flatMap(g=>g.items);
  const label=g=>{const wc={};g.items.forEach(it=>[...new Set(normal(it.text).split(/\s+/).filter(w=>w.length>3&&!STOP.has(w)))].forEach(w=>wc[w]=(wc[w]||0)+1));
    const key=Object.entries(wc).filter(([,count])=>count>=2).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([w])=>w);
    return key.length?key.join(' ').replace(/^./,c=>c.toUpperCase()):clean(g.items[0].text,45);};
  const topics=major.map((g,i)=>({id:'g'+i,label:label(g),kind:'duda',gap:'Las preguntas comparten términos. Comprueba si expresan la misma dificultad.',tip:'Leer ejemplos y explicar nuevamente con otro ejemplo.',ids:g.items.map(d=>d.id)}));
  if(other.length)topics.push({id:'otras',label:'Otras dudas',kind:'duda',gap:'No se encontró coincidencia textual suficiente.',tip:'Revisar preguntas individualmente.',ids:other.map(d=>d.id)});
  const off=items.filter(d=>d.off);if(off.length)topics.push({id:'log',label:'Preguntas logísticas',kind:'otro',gap:'Consultas de organización.',tip:'',ids:off.map(d=>d.id)});
  topics.sort((a,b)=>b.ids.length-a.ids.length);
  const main=topics.find(t=>t.id!=='otras'&&t.kind!=='otro')||topics[0];
  return {source:'local',count:ds.length,processed:ds.length,topics,main:main?.id,
    summary:main&&main.id!=='otras'?`El grupo de preguntas más repetido comparte el tema «${main.label}». Esta clasificación utiliza coincidencias de palabras y requiere revisión docente.`:'Las preguntas presentan temas variados; conviene revisar los textos recibidos.'};
}
function demoAnalysis(ds){
  const topics=Object.entries(DDEFS).map(([k,d])=>({id:'demo'+k,...d,ids:ds.filter(x=>x.tag===k).map(x=>x.id)})).filter(t=>t.ids.length);
  topics.sort((a,b)=>b.ids.length-a.ids.length);
  return {source:'demo',count:ds.length,processed:ds.length,topics,main:topics.find(t=>t.id==='demoA')?.id||topics[0]?.id,
   summary:'En este escenario preparado, muchas dudas se refieren al sentido de «pasar dividiendo», seguidas por signos y ecuaciones con incógnitas en ambos lados.'};
}
function clearRealtime(){
  S.syncError='';S.lastSyncAt=null;
  if(S.channel){try{S.channel.client.removeChannel(S.channel.channel);}catch{}S.channel=null;}
  if(S.poll){clearInterval(S.poll);S.poll=null;}
  if(S.queued){clearTimeout(S.queued);S.queued=null;}
  S.live=false;S.refreshEpoch++;S.refreshBusy=false;status();
}
function home(){clearRealtime();S.projector=false;S.confirm=null;S.cls=null;S.student=null;S.demo=false;
  S.doubts=[];S.ai=null;S.view='home';if(location.hash&&/^[A-HJ-NP-Z2-9]{6}$/.test(location.hash.slice(1).toUpperCase()))history.replaceState(null,'',location.pathname+location.search);render();}
function backClasses(){
  clearRealtime();S.projector=false;S.cls=null;S.demo=false;S.doubts=[];S.ai=null;
  S.view=S.teacher?'teacher':'home';render();if(S.view==='teacher')loadClasses();
}
function demo(){clearRealtime();S.demo=true;S.view='dash';S.doubts=[];S.doubtTotal=0;S.participants=0;S.ai=null;
  S.cls={id:'demo',code:'DEMO00',title:'MA1101 Introducción al Álgebra · Sección 3 (ejemplo)',topic:'Ecuaciones de primer grado',status:'open',pulse_version:0};S.demoBusy=false;S.openTopic=null;render();}
async function simulate(){
  if(!S.demo||S.demoBusy)return;S.demoBusy=true;S.doubts=[];S.doubtTotal=0;render();
  for(let i=0;i<DEMO.length;i++){
    if(!S.demo||S.view!=='dash')break;
    const [text,tag]=DEMO[i];
    S.doubts.push({id:'demo-'+i,text,tag,hidden:false,created_at:new Date().toISOString()});S.doubtTotal=S.doubts.length;
    render();await sleep(350);
  }
  S.demoBusy=false;render();
}
async function init(){
  render();
  if(!configured)return;
  try{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.81.1/+esm');
    const opts=k=>({auth:{storageKey:k,autoRefreshToken:true,persistSession:true,detectSessionInUrl:k==='ds-teacher-v2'}});
    S.tc=createClient(CFG.supabaseUrl,CFG.supabasePublishableKey,opts('ds-teacher-v2'));
    S.sc=createClient(CFG.supabaseUrl,CFG.supabasePublishableKey,opts('ds-student-v2'));
    S.tc.auth.onAuthStateChange((event,session)=>{
      const user=session?.user&&!session.user.is_anonymous?session.user:null;
      const changed=(S.teacher?.id||null)!==(user?.id||null);
      S.teacher=user;
      if(changed && user){setTimeout(()=>{if(S.view==='home'||S.view==='teacher'){S.view='teacher';loadClasses();}},40);}
      else if(changed&&!user && ['teacher','dash'].includes(S.view)&&!S.demo){setTimeout(home,40);}
    });
    const {data,error}=await S.tc.auth.getSession();if(error)throw error;
    S.teacher=data.session?.user&&!data.session.user.is_anonymous?data.session.user:null;
    S.ready=true;S.connectError='';
    const hash=location.hash.slice(1).toUpperCase();
    if(/^[A-HJ-NP-Z2-9]{6}$/.test(hash)){render();await joinClass(hash);}
    else if(S.teacher){S.view='teacher';await loadClasses();}
    else render();
  }catch(e){S.ready=false;S.connectError=errMessage(e);render();}
}
async function loadClasses(){
  if(!S.tc||!S.teacher)return;
  const {data,error}=await S.tc.from('ds_classes').select('id,code,teacher_id,title,topic,status,pulse_question,pulse_version,pulse_open,created_at')
    .eq('teacher_id',S.teacher.id).order('created_at',{ascending:false}).limit(100);
  if(error){toast('No pude cargar las clases: '+errMessage(error),true);return;}
  S.classes=data||[];if(S.view==='teacher')render();
}
async function teacher(){if(!configured)return;clearRealtime();S.view='teacher';render();if(S.teacher)await loadClasses();}
async function sendLogin(email){
  if(!S.tc)return;
  const token=captchaToken();
  if(captchaEnabled()&&!token)return toast('Completa la verificación anti-bots antes de continuar.',true);
  S.actionBusy=true;render();
  const options={emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true};
  if(token)options.captchaToken=token;
  const {error}=await S.tc.auth.signInWithOtp({email:clean(email,160),options});
  S.actionBusy=false;if(error)toast(errMessage(error),true);else{S.otpSent=true;toast('Se solicitó un enlace de acceso. Revisa tu correo.');}
  render();
}
async function logout(){if(!S.tc)return;clearRealtime();const {error}=await S.tc.auth.signOut();if(error)toast(errMessage(error),true);S.teacher=null;S.classes=[];home();}
async function createClass(title,topic){
  if(!S.tc||!S.teacher)return;
  S.actionBusy=true;render();
  const {data,error}=await S.tc.rpc('ds_create_class',{p_title:title,p_topic:topic});S.actionBusy=false;
  if(error){toast(errMessage(error),true);render();return;}
  await loadClasses();await openClass(data);
  toast('Clase creada. Código '+data.code);
}
async function openClass(c){
  if(!c)return;
  clearRealtime();S.demo=false;S.view='dash';S.cls={...c};S.doubts=[];S.doubtTotal=0;S.participants=0;
  S.pulse={yes:0,no:0,total:0};S.ai=read('ds_ai_'+c.id,null);S.openTopic=null;S.projector=false;S.syncError='';S.lastSyncAt=null;
  S.loading=true;render();await refreshDash(true);watchTeacher();
}
async function refreshDash(force=false){
  if(!S.tc||!S.cls||S.demo||S.view!=='dash')return;
  if(S.refreshBusy&&!force)return;
  const epoch=S.refreshEpoch;const id=S.cls.id;
  S.refreshBusy=true;
  try{
    const result=await Promise.all([
      S.tc.from('ds_doubts').select('id,class_id,text,hidden,created_at',{count:'exact'}).eq('class_id',id)
        .order('created_at',{ascending:false}).limit(1000),
      S.tc.rpc('ds_participant_count',{p_class_id:id}),
      S.tc.rpc('ds_pulse_results',{p_class_id:id}),
      S.tc.from('ds_classes').select('id,code,title,topic,status,pulse_question,pulse_version,pulse_open,created_at').eq('id',id).single(),
    ]);
    if(epoch!==S.refreshEpoch||S.cls?.id!==id||S.view!=='dash')return;
    const [d,p,a,c]=result;
    if(d.error||p.error||a.error||c.error){throw d.error||p.error||a.error||c.error;}
    S.doubts=(d.data||[]).reverse();S.doubtTotal=d.count||0;S.participants=Number(p.data)||0;
    S.pulse={yes:Number(a.data?.[0]?.yes_count||0),no:Number(a.data?.[0]?.no_count||0),total:Number(a.data?.[0]?.total_count||0)};
    S.cls={...S.cls,...c.data};S.loading=false;S.lastSyncAt=new Date().toISOString();S.syncError='';render();
  }catch(e){S.loading=false;S.syncError=errMessage(e);if(S.view==='dash'&&S.cls?.id===id)render();if(force)toast('Error al actualizar tablero: '+S.syncError,true);}
  finally{if(epoch===S.refreshEpoch)S.refreshBusy=false;}
}
function scheduleRefresh(){
  if(S.queued)clearTimeout(S.queued);
  S.queued=setTimeout(()=>{S.queued=null;S.view==='dash'?refreshDash():refreshStudent();},250);
}
function watchTeacher(){
  if(!S.tc||!S.cls||S.demo)return;
  const id=S.cls.id;const client=S.tc;
  const ch=client.channel('ds-profesor-'+id)
    .on('postgres_changes',{event:'*',schema:'public',table:'ds_doubts',filter:'class_id=eq.'+id},scheduleRefresh)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ds_classes',filter:'id=eq.'+id},scheduleRefresh)
    .subscribe(v=>{S.live=v==='SUBSCRIBED';status();});
  S.channel={client,channel:ch};S.poll=setInterval(()=>{if(S.view==='dash'&&!S.demo)refreshDash();},10000);
}
async function joinClass(code){
  if(!S.sc||S.actionBusy)return;
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return toast('El código debe tener seis caracteres válidos.',true);
  try{
    const {data:auth,error:authErr}=await S.sc.auth.getSession();if(authErr)throw authErr;
    const token=auth.session?null:captchaToken();
    if(!auth.session&&captchaEnabled()&&!token){
      S.view='home';render();toast('Para entrar por primera vez, completa la verificación anti-bots.',true);return;
    }
    S.actionBusy=true;render();
    if(!auth.session){const {error}=await S.sc.auth.signInAnonymously(token?{options:{captchaToken:token}}:undefined);if(error)throw error;}
    const {data,error}=await S.sc.rpc('ds_join_class',{p_code:code});if(error)throw error;
    if(!data?.length)throw new Error('Código no encontrado o demasiados intentos. Revisa el código y reintenta más adelante.');
    clearRealtime();S.student=data[0];S.studentSent=false;S.view='student';S.actionBusy=false;
    if(location.hash!=='#'+code)history.replaceState(null,'',location.pathname+location.search+'#'+code);
    render();watchStudent();
  }catch(e){S.actionBusy=false;toast(errMessage(e),true);render();}
}
function watchStudent(){
  if(!S.student||!S.sc)return;
  const id=S.student.id;
  const client=S.sc;
  const ch=client.channel('ds-estudiante-'+id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ds_classes',filter:'id=eq.'+id},scheduleRefresh)
    .subscribe(v=>{S.live=v==='SUBSCRIBED';status();});
  S.channel={client,channel:ch};S.poll=setInterval(refreshStudent,12000);
}
async function refreshStudent(){
  if(!S.sc||!S.student||S.view!=='student')return;
  const id=S.student.id;
  const {data,error}=await S.sc.from('ds_classes').select('id,code,title,topic,status,pulse_question,pulse_version,pulse_open,created_at').eq('id',id).single();
  if(error){if(error.code==='PGRST116'){toast('Esta clase ya no existe.',true);home();}return;}
  if(S.student?.id===id){S.student={...S.student,...data};render();}
}

async function submitDoubt(text) {
  if (!S.student || S.actionBusy) return;

  const msg = clean(text, 400);

  if (msg.length < 5) {
    return toast("Escribe al menos 5 caracteres.", true);
  }

  S.actionBusy = true;
  render();

  try {
    // Revisar la pregunta con Gemini
    const { data, error } = await S.sc.functions.invoke(
      "moderar-duda",
      {
        body: { text: msg }
      }
    );

    if (error) {
      throw new Error(
        "No fue posible revisar la pregunta. Intenta nuevamente."
      );
    }

    // Si Gemini no aprueba, no enviar
    if (data?.decision !== "approve") {
      toast(
        data?.message ||
        "Tu pregunta necesita ser reformulada.",
        true
      );
      return;
    }

    // Guardar la pregunta aprobada
    const { error: saveError } = await S.sc.rpc(
      "ds_submit_doubt",
      {
        p_class_id: S.student.id,
        p_text: msg
      }
    );

    if (saveError) throw saveError;

    S.studentSent = true;
    S.studentSentCount++;

  } catch (e) {
    toast(errMessage(e), true);

  } finally {
    S.actionBusy = false;
    render();
  }
}

async function answerPulse(value){
  if(!S.student||S.actionBusy)return;
  S.actionBusy=true;render();
  const {error}=await S.sc.rpc('ds_answer_pulse',{p_class_id:S.student.id,p_version:S.student.pulse_version,p_understood:value});
  S.actionBusy=false;
  if(error)toast(errMessage(error),true);
  else{store(`ds_pulse_${S.student.id}_${S.student.pulse_version}`,value);toast('Respuesta registrada.');}
  render();
}
async function runAction(fn,success){
  if(S.actionBusy)return;
  S.actionBusy=true;render();
  try{await fn();if(success)toast(success);}catch(e){toast(errMessage(e),true);}
  finally{S.actionBusy=false;render();}
}
async function callTeacher(name,params){
  const {data,error}=await S.tc.rpc(name,params);if(error)throw error;return data;
}
function confirmAction(title,message,ok,run,danger=false){S.confirm={title,message,ok,run,danger};render();}
async function toggleClass(){
  if(!S.cls||S.demo)return;
  const close=active();
  confirmAction(close?'Terminar la clase':'Reabrir la clase',
    close?'Al terminar, ningún estudiante podrá enviar más dudas o responder comprobaciones. Podrás reabrirla.':'La clase volverá a aceptar nuevas dudas.',
    close?'Terminar':'Reabrir',async()=>{
      await runAction(async()=>{await callTeacher('ds_set_class_status',{p_class_id:S.cls.id,p_status:close?'closed':'open'});await refreshDash(true);},close?'Clase terminada.':'Clase reabierta.');
    },close);
}
async function moderate(id,hidden){
  await runAction(async()=>{await callTeacher('ds_set_doubt_hidden',{p_doubt_id:id,p_hidden:hidden});await refreshDash(true);},hidden?'Duda oculta del análisis.':'Duda restaurada.');
}
async function startPulse(question){
  await runAction(async()=>{await callTeacher('ds_start_pulse',{p_class_id:S.cls.id,p_question:question});await refreshDash(true);},'Pregunta de comprobación enviada.');
}
async function closePulse(){await runAction(async()=>{await callTeacher('ds_close_pulse',{p_class_id:S.cls.id});await refreshDash(true);},'Comprobación cerrada.');}
function deleteClass(id){
  const c=S.classes.find(x=>x.id===id);if(!c)return;
  confirmAction('Eliminar clase y todas sus dudas',`Se borrarán DEFINITIVAMENTE «${c.title}», sus preguntas, participantes y respuestas de comprobación. Exporta el informe antes si quieres conservarlo.`,
   'Eliminar definitivamente',async()=>{
     await runAction(async()=>{await callTeacher('ds_delete_class',{p_class_id:id});await loadClasses();},'Clase y datos eliminados.');
   },true);
}
async function analyzeAI(){
  if(S.demo||!S.cls||S.aiBusy||!visibleDoubts().length)return;
  S.aiBusy=true;render();
  try{
    const {data,error}=await S.tc.functions.invoke('analizar-dudas',{body:{classId:S.cls.id}});
    if(error){
      // Supabase puede devolver HTTP no-2xx dentro del contexto del error.
      const context=error.context;
      let details='';if(context&&typeof context.json==='function'){try{details=(await context.json())?.error||'';}catch{}}
      throw new Error(details||error.message||'No se pudo analizar con IA.');
    }
    if(!data?.topics?.length)throw new Error(data?.error||'La IA no entregó temas válidos.');
    await refreshDash(true);
    S.ai={...data,fingerprint:visibleDoubts().map(d=>d.id).join('|'),source:'ia'};
    store('ds_ai_'+S.cls.id,S.ai);toast('El análisis pedagógico con IA está listo.');
  }catch(e){toast('IA: '+errMessage(e),true);}
  finally{S.aiBusy=false;render();}
}
function csvSafe(v){
  let s=String(v??'').replace(/\u0000/g,'').replace(/\r\n/g,' ').replace(/[\r\n]/g,' ');
  if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function download(filename,data,type){
  const a=document.createElement('a');const url=URL.createObjectURL(new Blob([data],{type}));
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function csv(){
  if(!S.cls)return;
  const rows=[['fecha','hora','clase','duda','estado'],...S.doubts.map(d=>{
    const date=new Date(d.created_at);return [date.toLocaleDateString('es-CL'),fmt(d.created_at),S.cls.title,d.text,d.hidden?'oculta':'visible'];
  })];
  const content='\ufeff'+rows.map(row=>row.map(csvSafe).join(';')).join('\r\n');
  download(`dudas-${slug(S.cls.title)}.csv`,content,'text/csv;charset=utf-8');
  if(S.doubtTotal>1000&&!S.demo)toast('El CSV contiene las últimas 1000 dudas. Para un respaldo completo, exporta los datos desde Supabase.',true);
}
function report(){
  if(!S.cls)return;
  const ds=visibleDoubts();const a=currentAnalysis(ds);const p=S.pulse;
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe · ${esc(S.cls.title)}</title><style>
   body{font:15px/1.6 system-ui,Arial,sans-serif;color:#132429;max-width:830px;margin:45px auto;padding:0 25px}
   h1{font-size:30px;margin-bottom:6px}h2{color:#2c5b66;margin-top:35px;border-bottom:1px solid #cfdad9;padding-bottom:8px}
   table{width:100%;border-collapse:collapse;margin:12px 0 20px}th,td{border-bottom:1px solid #ddd;text-align:left;padding:10px;vertical-align:top}
   p{margin:8px 0}.note{background:#eef2f1;padding:12px;border-radius:8px}.muted{color:#53676d}li{margin-bottom:8px}
   @media print{body{margin:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}}
   </style></head><body><div class="muted">DUDAS SILENCIOSAS · REPORTE DE CLASE</div>
   <h1>${esc(S.cls.title)}</h1><p>${esc(S.cls.topic||'Sin tema')}</p><p class="muted">Código ${esc(S.cls.code)} · Reporte generado ${esc(new Date().toLocaleString('es-CL'))} ${S.demo?'· DATOS FICTICIOS':''}</p>
   <h2>Resumen de participación</h2><p>${ds.length} dudas visibles, ${S.doubts.length-ds.length} ocultas, ${S.demo?'participación simulada':S.participants+' participantes registrados (no equivale a asistentes totales)'}.</p>
   <h2>Temas detectados</h2><p class="note">${esc(a?.summary||'Todavía no hay dudas.')}</p>
   <table><thead><tr><th>Tema</th><th>Dudas</th><th>Dificultad sugerida</th><th>Acción pedagógica</th></tr></thead><tbody>${(a?.topics||[]).map(t=>`<tr><td>${esc(t.label)}</td><td>${t.ids.length}</td><td>${esc(t.gap)}</td><td>${esc(t.tip)}</td></tr>`).join('')}</tbody></table>
   <p class="muted">Tipo de análisis: ${esc(a?.source==='ia'?'Claude / IA generativa':S.demo?'Ejemplo preparado':'Coincidencias textuales, sin IA')}. Son indicios exploratorios, no diagnósticos individuales.</p>
   <h2>Comprobación posterior</h2><p>${esc(S.cls.pulse_question||'No se realizó una comprobación.')}</p>
   <p>Comprendió: ${p.yes}; todavía tiene dudas: ${p.no}; total de respuestas: ${p.total}. ${p.total?'Proporción de «Sí»: '+Math.round(100*p.yes/p.total)+'% entre quienes respondieron.':''}</p>
   <h2>Preguntas recibidas (visibles)</h2><ol>${ds.map(d=>`<li>${esc(d.text)} <span class="muted">(${fmt(d.created_at)})</span></li>`).join('')||'<li>No hay preguntas.</li>'}</ol>
   <p class="muted">Evita redistribuir dudas textuales que puedan contener información sensible. El responsable de la clase debe aplicar sus protocolos institucionales.</p>
   <p><button onclick="window.print()">Imprimir / Guardar en PDF</button></p></body></html>`;
  download(`informe-${slug(S.cls.title)}.html`,html,'text/html;charset=utf-8');
  toast('Informe descargado. Ábrelo y usa Imprimir → Guardar como PDF.');
}
function copyLink(){const v=classUrl(S.cls.code);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(v).then(()=>toast('Enlace copiado.')).catch(()=>window.prompt('Copia el enlace:',v));else window.prompt('Copia el enlace:',v);}
const ACTIONS={
  home,teacher,demo,simulate,logout,backClasses,refreshClasses:loadClasses,
  openClass:el=>openClass(S.classes.find(c=>c.id===el.dataset.id)),deleteClass:el=>deleteClass(el.dataset.id),
  refreshDash:()=>refreshDash(true),topic:el=>{S.openTopic=S.openTopic===el.dataset.id?null:el.dataset.id;render();},
  another:()=>{S.studentSent=false;render();$('#d-text')?.focus();},
  pulseYes:()=>answerPulse(true),pulseNo:()=>answerPulse(false),
  toggleClass,proj:()=>{S.projector=true;render();},closeProj:()=>{S.projector=false;render();},copyLink,
  closePulse,moderate:el=>moderate(el.dataset.id,el.dataset.hidden==='true'),
  analyzeAI,csv,report,
  cancelConfirm:()=>{S.confirm=null;render();},
  acceptConfirm:()=>{const c=S.confirm;S.confirm=null;render();if(c)c.run();},
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  const fn=ACTIONS[el.dataset.act];if(!fn)return;
  e.preventDefault();Promise.resolve(fn(el)).catch(err=>toast(errMessage(err),true));
});
document.addEventListener('input',e=>{if(e.target.id==='join-code')e.target.value=e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'');});
document.addEventListener('submit',e=>{
  const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();
  const val=id=>document.getElementById(id)?.value?.trim()||'';
  const submit={
    join:()=>joinClass(val('join-code').toUpperCase()),login:()=>sendLogin(val('email')),
    create:()=>createClass(val('c-title'),val('c-topic')),
    doubt:()=>submitDoubt(val('d-text')),
    pulse:()=>startPulse(val('pulse-question')),
  }[form.dataset.form];
  if(submit)Promise.resolve(submit()).catch(err=>toast(errMessage(err),true));
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(S.confirm)S.confirm=null;else if(S.projector)S.projector=false;else return;render();}});
window.addEventListener('hashchange',()=>{
  const code=location.hash.slice(1).toUpperCase();
  if(/^[A-HJ-NP-Z2-9]{6}$/.test(code) && S.sc && (!S.student || S.student.code!==code))joinClass(code);
});
init();
})();
