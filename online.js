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
   const {data:profile,error:pe}=await client.from('player_profiles').select('username,is_admin,is_blocked,is_deleted').eq('id',user.id).single();
   if(pe||!profile){status('Angemeldet, aber Profil nicht lesbar. Bitte Administrator kontaktieren.');$('account-name').textContent='Anmeldung aktiv.';return;}
   if(profile.is_blocked||profile.is_deleted){await client.auth.signOut();status('Dieses Konto ist gesperrt.');return;}
   $('account-name').textContent=`${profile.username} · ${profile.is_admin?'👑 Administrator':'Spieler'}`;
   if(user.user_metadata?.ruefner_password_change_required){
    const next=prompt('Dein Passwort wurde zurückgesetzt. Bitte jetzt ein eigenes neues Passwort wählen (mindestens 12 Zeichen):');
    if(!next||next.length<12){status('Bitte ein neues Passwort mit mindestens 12 Zeichen festlegen.');return;}
    const {error:changeError}=await client.auth.updateUser({password:next,data:{...user.user_metadata,ruefner_password_change_required:false}});
    if(changeError){status('Passwort konnte nicht geändert werden: '+changeError.message);return;}
    alert('Neues Passwort gespeichert.');
   }
   status('');$('admin-panel').hidden=!profile.is_admin;if(profile.is_admin)await loadAdmin();else if(!new URLSearchParams(location.search).has('logout'))window.location.replace('./');
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
   $('reg-password').value='';$('reg-code').value='';status('Konto erstellt. Bitte oben anmelden.');
  }catch(err){status('Registrierung fehlgeschlagen: '+(err.message||'Unbekannter Fehler'));}
  finally{$('reg-password').value='';button.disabled=false;}
 });

 let adminPlayers=[],activePlayers=[],adminGames=[],visibleGames=5,searchTerm='';
 async function adminAction(action,payload={}){
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw Error('Bitte erneut anmelden.');
  const res=await fetch(cfg.url+'/functions/v1/admin-actions',{
   method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,'Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({action,...payload})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Admin-Aktion fehlgeschlagen ('+res.status+')');
  return data;
 }
 function el(tag,text,cls){
  const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);
  if(cls)e.className=cls;return e;
 }
 function button(label,fn,secondary=true){
  const b=el('button',label,'btn'+(secondary?' secondary':''));
  b.type='button';b.addEventListener('click',fn);return b;
 }
 const label=id=>adminPlayers.find(p=>p.id===id)?.username||'Unbekannt';
 function showPlayers(){
  const root=$('admin-players');root.replaceChildren();
  for(const p of activePlayers){
   const box=el('div',undefined,'notice');
   const title=el('strong',p.username+(p.is_admin?' 👑':'')+(p.is_blocked?' · Gesperrt':''));box.append(title);
   if(!p.is_admin){
    const actions=el('div',undefined,'row');actions.style.marginTop='8px';
    actions.append(button('✏️ Name',async()=>{
     const username=prompt('Neuer Benutzername für '+p.username+':',p.username)?.trim();
     if(!username||username===p.username)return;
     try{await adminAction('rename',{playerId:p.id,username});await loadAdmin();}
     catch(e){alert(e.message)}
    }));
    actions.append(button('🔑 Passwort zurücksetzen',async()=>{
     const password=prompt('Neues vorläufiges Passwort (mindestens 12 Zeichen):');
     if(password===null)return;
     if(password.length<12){alert('Mindestens 12 Zeichen.');return;}
     if(!confirm('Passwort für '+p.username+' wirklich zurücksetzen?'))return;
     try{await adminAction('reset-password',{playerId:p.id,password});alert('Passwort zurückgesetzt. Bitte dem Spieler privat mitteilen.');}
     catch(e){alert(e.message)}
    }));
    actions.append(button(p.is_blocked?'🔓 Entsperren':'🚫 Sperren',async()=>{
     if(!confirm((p.is_blocked?'Entsperren':'Sperren')+' für '+p.username+'?'))return;
     try{await adminAction('set-blocked',{playerId:p.id,blocked:!p.is_blocked});await loadAdmin()}
     catch(e){alert(e.message)}
    }));
     actions.append(button('🗑️ Spieler endgültig löschen',async()=>{
      if(!confirm('Konto von '+p.username+' endgültig löschen? Alte Spiele und Rekorde bleiben erhalten.'))return;
      const typed=prompt('Zur Bestätigung den Spielernamen exakt eingeben: '+p.username);
      if(typed!==p.username)return alert('Abgebrochen: Name stimmt nicht überein.');
      try{
       const result=await adminAction('delete-player',{playerId:p.id});
       alert(result.message||'Konto gelöscht. Historische Spiele bleiben erhalten.');
       await loadAdmin();
      }catch(e){alert('Spieler konnte nicht gelöscht werden: '+e.message)}
     }));
     box.append(actions);
   }
   root.append(box);
  }
 }
 function showGames(){
  const root=$('admin-matches');root.replaceChildren();
  let search=document.getElementById('game-search');
  if(!search){
   search=el('input');search.id='game-search';search.placeholder='🔎 Spieler oder Datum suchen';
   search.style.marginBottom='12px';search.style.width='100%';search.style.maxWidth='560px';search.style.boxSizing='border-box';
   search.addEventListener('input',()=>{searchTerm=search.value;visibleGames=5;showGames()});
  }
  search.value=searchTerm;root.append(search);
  const q=searchTerm.toLocaleLowerCase('de');
  const filtered=adminGames.filter(g=>[label(g.player_a),label(g.player_b),label(g.winner),new Date(g.played_at).toLocaleDateString('de-CH')].join(' ').toLocaleLowerCase('de').includes(q));
  for(const g of filtered.slice(0,visibleGames)){
   const box=el('div',undefined,'notice');
   box.append(el('strong',new Date(g.played_at).toLocaleDateString('de-CH')+' · '+label(g.player_a)+' vs. '+label(g.player_b)+' · 🏆 '+label(g.winner)));
   const actions=el('div',undefined,'row');actions.style.marginTop='8px';
   actions.append(button('✏️ Sieger ändern',async()=>{
    const choice=prompt('Sieger: 1 = '+label(g.player_a)+', 2 = '+label(g.player_b));
    if(choice!=='1'&&choice!=='2')return;
    try{await adminAction('edit-winner',{matchId:g.id,winner:choice==='1'?g.player_a:g.player_b});await loadAdmin();}
    catch(e){alert(e.message)}
   }));
   actions.append(button('📊 Statistik korrigieren',async()=>{
    const side=prompt('Welche Seite bearbeiten? a = '+label(g.player_a)+', b = '+label(g.player_b));
    if(side!=='a'&&side!=='b')return;
    const field=prompt('Feld: shots, hits, bombs, combos, turns, remaining, trickAttempts, trickHits, finishAttempts, finishHits, normalFinishes, comboFinishes, bombFinishes');
    const allowed=['shots','hits','bombs','combos','turns','remaining','trickAttempts','trickHits','finishAttempts','finishHits','normalFinishes','comboFinishes','bombFinishes'];
    if(!allowed.includes(field))return alert('Ungültiges Statistikfeld');
    const raw=prompt('Neuer Wert für '+field+':');
    if(raw===null)return;
    const value=Number(raw);
    if(!Number.isFinite(value)||value<0)return alert('Ungültiger Wert');
    if(!confirm('Statistik wirklich korrigieren?'))return;
    try{await adminAction('edit-stats',{matchId:g.id,side,stats:{[field]:value}});await loadAdmin()}
    catch(e){alert(e.message)}
   }));
   actions.append(button('🗑️ Löschen',async()=>{
    if(!confirm('Spiel wirklich löschen? Eine Sicherung wird im Admin-Protokoll abgelegt.'))return;
    try{await adminAction('delete-match',{matchId:g.id});await loadAdmin();}
    catch(e){alert(e.message)}
   }));
   box.append(actions);root.append(box);
  }
  if(filtered.length>visibleGames)root.append(button('📂 Weitere 10 Spiele anzeigen ▼',()=>{visibleGames+=10;showGames()}));
  if(!filtered.length)root.append(el('p','Keine passenden Spiele.','muted'));
 }
 function showInvites(invites){
  const root=$('admin-invites');root.replaceChildren();
  for(const inv of invites){
   const state=inv.revoked_at?'Deaktiviert':inv.used_at?'Verwendet':'Offen';
   const box=el('div',undefined,'notice');box.append(el('span',new Date(inv.created_at).toLocaleDateString('de-CH')+' · '+state));
   if(state==='Offen')box.append(button('Deaktivieren',async()=>{
    if(!confirm('Einladungscode deaktivieren?'))return;
    try{await adminAction('revoke-invite',{inviteId:inv.id});await loadAdmin()}catch(e){alert(e.message)}
   }));
   root.append(box);
  }
 }
 async function loadAdmin(){
  const msg=$('admin-status');msg.textContent='Admin-Daten werden geladen …';
  try{
   const {data,error}=await client.rpc('ruefner_admin_overview');if(error)throw error;
   const deleted=await adminAction('list-deleted-players');
   const deletedIds=new Set(deleted.deletedIds||[]);
   adminPlayers=data?.players||[];adminGames=data?.games||[];
   activePlayers=adminPlayers.filter(p=>!deletedIds.has(p.id));
   showPlayers();showGames();
   const invites=await adminAction('list-invites');showInvites(invites.invites||[]);
   msg.textContent=activePlayers.length+' Spieler · '+adminGames.length+' Online-Spiele';
  }catch(e){msg.textContent='Admin-Zentrale: '+(e.message||'Unbekannter Fehler');}
 }
 $('invite-create').addEventListener('click',async()=>{
  try{
   const result=await adminAction('create-invite');
   const code=result.code;
   const root=$('admin-invites');
   const box=el('div',undefined,'notice');
   box.append(el('strong','Neuer Einmal-Code: '+code),el('p','Jetzt kopieren und privat weitergeben. Der Code wird später nicht erneut angezeigt.'));
   box.append(button('📋 Kopieren',async()=>{try{await navigator.clipboard.writeText(code);alert('Code kopiert!')}catch(e){prompt('Code kopieren:',code)}}));
   root.prepend(box);
  }catch(e){alert('Code konnte nicht erstellt werden: '+e.message)}
 });
 $('admin-reload').addEventListener('click',loadAdmin);
 $('logout').addEventListener('click',async()=>{await client.auth.signOut();await refresh();});
 await refresh();
}
