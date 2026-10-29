import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const $=id=>document.getElementById(id);
const status=msg=>{const el=$('setup-status');el.textContent=msg;el.hidden=!msg;};
const cfg=window.RUEFNER_SUPABASE;
let currentUser=null;
const ready=cfg?.url?.startsWith('https://')&&cfg?.publishableKey&&!cfg.publishableKey.includes('HIER_');
if(!ready){status('Bitte den bestehenden öffentlichen Publishable Key in online-config.js beibehalten.');}
else {
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 async function refresh(){
  try {
   const {data:{user},error}=await client.auth.getUser();
   if(error&&!String(error.message).includes('Auth session missing'))throw error;
   currentUser=user||null;$('admin-panel').hidden=true;$('registration-panel').hidden=!!user;$('login-form').hidden=!!user;$('register-form').hidden=!!user;$('account').hidden=!user;
   if(!user){status('');return;}
   const {data:profile,error:pe}=await client.from('player_profiles').select('username,is_admin,is_blocked').eq('id',user.id).single();
   if(pe||!profile){status('Angemeldet, aber Profil nicht lesbar. Bitte Administrator kontaktieren.');$('account-name').textContent='Anmeldung aktiv.';return;}
   if(profile.is_blocked){await client.auth.signOut();status('Dieses Konto ist gesperrt.');return;}
   $('account-name').textContent=`${profile.username} · ${profile.is_admin?'👑 Administrator':'Spieler'}`;
   status('');$('admin-panel').hidden=!profile.is_admin;if(profile.is_admin)await loadAdmin();else window.location.replace('./');
  }catch(e){status('Verbindung fehlgeschlagen: '+(e.message||'Unbekannter Fehler'));}
 }
 $('login-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;status('Anmeldung läuft …');
  try{
   const username=$('username').value.trim(),password=$('password').value;
   if(username.includes('@')){
    const {error}=await client.auth.signInWithPassword({email:username,password});if(error)throw error;
   }else{
    const r=await fetch(cfg.url+'/functions/v1/login-player',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey},body:JSON.stringify({username,password})});
    const data=await r.json().catch(()=>({}));if(!r.ok||!data.access_token||!data.refresh_token)throw new Error(data.error||'Anmeldung fehlgeschlagen');
    const {error}=await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});if(error)throw error;
   }
   await refresh();
  }catch(err){status('Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.');}
  finally{$('password').value='';button.disabled=false;}
 });
 $('register-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;status('Registrierung wird geprüft …');
  try{
   const r=await fetch(cfg.url+'/functions/v1/register-player',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey},body:JSON.stringify({username:$('reg-username').value.trim(),password:$('reg-password').value,invitationCode:$('reg-code').value.trim()})});
   const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Registrierung fehlgeschlagen');
   $('reg-password').value='';$('reg-code').value='';status('Testkonto erstellt. Bitte oben mit dem Benutzernamen anmelden.');
  }catch(err){status('Registrierung fehlgeschlagen: '+(err.message||'Unbekannter Fehler'));}
  finally{$('reg-password').value='';button.disabled=false;}
 });
 async function loadAdmin(){
  const msg=$('admin-status');msg.textContent='Admin-Daten werden geladen …';
  try{
   const {data,error}=await client.rpc('ruefner_admin_overview');if(error)throw error;
   const players=data?.players||[],games=data?.games||[];
   const label=id=>players.find(p=>p.id===id)?.username||'Unbekannt';
   const table=(headers,rows)=>{const t=document.createElement('table');t.className='table';const thead=t.createTHead(),tr=thead.insertRow();headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th)});const body=t.createTBody();rows.forEach(row=>{const r=body.insertRow();row.forEach(value=>{const c=r.insertCell();c.textContent=String(value??'–')})});return t};
   $('admin-players').replaceChildren(table(['Spieler','Rolle','Status'],players.map(p=>[p.username,p.is_admin?'👑 Admin':'Spieler',p.is_blocked?'Gesperrt':'Aktiv'])));
   $('admin-matches').replaceChildren(table(['Datum','Spiel','Sieger'],games.map(g=>[new Date(g.played_at).toLocaleDateString('de-CH'),label(g.player_a)+' vs. '+label(g.player_b),label(g.winner)])));
   msg.textContent=players.length+' Spieler · '+games.length+' Online-Spiele';
  }catch(e){msg.textContent='Admin-Übersicht nicht verfügbar: '+(e.message||'Unbekannter Fehler')+' — SQL für Schritt 2 zuerst ausführen.';}
 }
 $('admin-reload').addEventListener('click',loadAdmin);
 $('logout').addEventListener('click',async()=>{await client.auth.signOut();await refresh();});
 await refresh();
}
