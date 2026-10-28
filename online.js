import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const $=id=>document.getElementById(id);
const status=msg=>{$('setup-status').textContent=msg;};
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
   currentUser=user||null;$('results-panel').hidden=!user;$('login-form').hidden=!!user;$('register-form').hidden=!!user;$('account').hidden=!user;
   if(!user){status('Bitte mit Benutzername oder Administrator-E-Mail anmelden.');return;}
   const {data:profile,error:pe}=await client.from('player_profiles').select('username,is_admin,is_blocked').eq('id',user.id).single();
   if(pe||!profile){status('Angemeldet, aber Profil nicht lesbar. Bitte Administrator kontaktieren.');$('account-name').textContent='Anmeldung aktiv.';return;}
   if(profile.is_blocked){await client.auth.signOut();status('Dieses Konto ist gesperrt.');return;}
   $('account-name').textContent=`${profile.username} · ${profile.is_admin?'👑 Administrator':'Spieler'}`;
   status('Erfolgreich angemeldet! Gemeinsame Ergebnisse sind im Testbetrieb verfügbar.');await loadOnlineResults();
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
  let directory=[];
  async function loadOnlineResults(){
   if(!currentUser)return;
   const message=$('result-status');
   const {data:players,error:dirError}=await client.rpc('ruefner_player_directory');
   if(dirError){message.textContent='Spielerverzeichnis nicht verfügbar. SQL für V2.0 ausführen.';return;}
   directory=players||[];
   const me=directory.find(p=>p.id===currentUser.id);
   if(!me){message.textContent='Eigenes Profil nicht im Verzeichnis.';return;}
   const other=directory.filter(p=>p.id!==currentUser.id);
   $('opponent').replaceChildren(...other.map(p=>new Option(p.username,p.id)));
   const winnerOptions=[me,...other];
   $('winner').replaceChildren(...winnerOptions.map(p=>new Option(p.username,p.id)));
   $('opponent').onchange=()=>{const opponent=$('opponent').value;const available=directory.filter(p=>p.id===currentUser.id||p.id===opponent);$('winner').replaceChildren(...available.map(p=>new Option(p.username,p.id)));};
   $('opponent').dispatchEvent(new Event('change'));
   const {data:results,error:readError}=await client.from('ruefner_friendly_results').select('id,player_a,player_b,winner,created_at').order('created_at',{ascending:false}).limit(100);
   if(readError){message.textContent='Ergebnisse nicht lesbar: '+readError.message;return;}
   const label=id=>directory.find(p=>p.id===id)?.username||'Spieler';
   $('results-list').replaceChildren(...(results||[]).map(r=>{const div=document.createElement('div');div.className='notice';div.textContent=`${new Date(r.created_at).toLocaleDateString('de-CH')}: ${label(r.player_a)} gegen ${label(r.player_b)} · 🏆 ${label(r.winner)}`;return div;}));
   if(!results?.length)$('results-list').textContent='Noch keine gemeinsamen Ergebnisse.';
   message.textContent=other.length?'Ergebnisse sind für beide beteiligten Spieler sichtbar.':'Noch kein zweiter registrierter Spieler vorhanden.';
   $('result-form').querySelector('button').disabled=!other.length;
  }
  $('result-form').addEventListener('submit',async e=>{
   e.preventDefault();if(!currentUser)return;
   const opponent=$('opponent').value,winner=$('winner').value;
   if(!opponent||opponent===currentUser.id||![currentUser.id,opponent].includes(winner))return;
   const button=e.currentTarget.querySelector('button');button.disabled=true;
   const {error}=await client.from('ruefner_friendly_results').insert({player_a:currentUser.id,player_b:opponent,winner});
   if(error){$('result-status').textContent='Speichern fehlgeschlagen: '+error.message;button.disabled=false;return;}
   await loadOnlineResults();button.disabled=false;
  });
 $('logout').addEventListener('click',async()=>{await client.auth.signOut();await refresh();});
 await refresh();
}
