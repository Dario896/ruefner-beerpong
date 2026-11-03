'use strict';
const KEY='ruefner-pong-v1';
const COM_NAMES=['Anfänger','Amateur','Fortgeschritten','Profi','Legende','Unbesiegbar'];
const COM_HIT=[.15,.25,.35,.45,.60,.90];
const COM_RERACK=[.15,.25,.4,.6,.8,.95];
const COM_TRICK=[.15,.25,.35,.45,.60,.90];
// Die Muster sind exakt den Zeichnungen auf den Reglement-Seiten 5–6 entnommen.
// Reihe 0 zeigt zur Tischmitte, die letzte Reihe steht an der hinteren Tischkante.
const formationPatterns={
  10:[[[0,0],[1,-.5],[1,.5],[2,-1],[2,0],[2,1],[3,-1.5],[3,-.5],[3,.5],[3,1.5]]],
  6:[[[0,0],[1,-.5],[1,.5],[2,-1],[2,0],[2,1]]],
  5:[[[0,-.5],[0,.5],[1,-1],[1,0],[1,1]],[[0,0],[1,-.5],[1,.5],[2,-1],[2,0]],[[0,0],[1,-.5],[1,.5],[2,0],[2,1]]],
  4:[[[0,0],[1,-.5],[1,.5],[2,0]]],
  3:[[[0,0],[1,-.5],[1,.5]]],
  2:[[[0,0],[1,-.5]],[[0,0],[1,.5]],[[0,-.5],[0,.5]]],
  1:[[[0,0]]]
};
const variantNames={6:['Grosse Pyramide'],5:['Full House 1','Full House 2','Full House 3'],4:['Vagina'],3:['Kleine Pyramide'],2:['Paar 1','Paar 2','Paar 3']};
let db=load(),view='home',match=null,ui={},pendingStart=null;
let selectedProfileId=null,profileZoom=false,profileStatusSaving=false,profileStatusEditor=false;
let trickFlashTimer=null;
function dismissTrickFlash(){if(!ui.trickFlash)return;ui.trickFlash=null;clearTimeout(trickFlashTimer);if(view==='game')render()}
function showTrickFlash(label){ui.trickFlash={label,until:Date.now()+5000};clearTimeout(trickFlashTimer);trickFlashTimer=setTimeout(()=>{ui.trickFlash=null;if(view==='game')render()},5050)}
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.players&&v.games&&v.leagues)return v}catch(e){}return {players:[],games:[],leagues:[],current:null,admin:null,record:{}}}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function id(){return Math.random().toString(36).slice(2,10)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function player(i){return db.players.find(p=>p.id===i)}
function name(i){return i==='COM'?'Rüfner 3000':(player(i)?.name||'Unbekannt')}
function avatar(i){const p=player(i),cfg=window.RUEFNER_SUPABASE;const url=p?.onlineId&&cfg?.url?cfg.url+'/storage/v1/object/public/player-avatars/'+encodeURIComponent(p.onlineId)+'/avatar.jpg'+(p.photo?.includes('?v=')?'?v='+encodeURIComponent(p.photo.split('?v=')[1]):''):p?.photo;return `<span class="avatar">${url?`<img src="${esc(url)}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${esc((p?.name||'?').slice(0,1).toUpperCase())}'">`:esc((p?.name||'🤖').slice(0,1).toUpperCase())}</span>`}
function activeLeague(){return db.leagues.find(l=>!l.closed)}
function isAdmin(){return db.current===db.admin}
function reigningChampion(){const finished=db.leagues.filter(l=>l.online&&l.closed&&champion(l)).sort((a,b)=>new Date(b.created)-new Date(a.created));return finished.length?champion(finished[0]):null}
function go(v){
 if(view===v&&v!=='profiles'){render();return;}
 window.history.pushState({ruefnerView:v,profileId:selectedProfileId},'','#'+v);
 view=v;ui={};profileZoom=false;render();
 if(v==='stats'&&onlineUserId)setTimeout(()=>{refreshCloudResults();refreshPlOnline()},0);
 if(v==='league')setTimeout(()=>loadPlOnline(true),0);
}
function openPlayerProfile(pid){
 selectedProfileId=pid;profileZoom=false;profileStatusEditor=false;
 window.history.pushState({ruefnerView:'profileDetail',profileId:pid},'','#profile-'+encodeURIComponent(pid));
 view='profileDetail';ui={};render();
}
function closeProfileZoom(){profileZoom=false;render()}
function openProfileZoom(){profileZoom=true;render()}
window.addEventListener('popstate',()=>{
 if(profileZoom){profileZoom=false;window.history.pushState({ruefnerView:view,profileId:selectedProfileId},'','#'+view);render();return;}
 if(appDialog){appDialog=null;window.history.pushState({ruefnerView:view,profileId:selectedProfileId},'','#'+view);render();return;}
 if(view==='game'&&match){
  window.history.pushState({ruefnerView:'game'},'','#game');
  showAppConfirm('Spiel wirklich verlassen? Nicht gespeicherte Daten gehen verloren.',()=>{match=null;go('home')});return;
 }
 const target=window.history.state;
 view=target?.ruefnerView||'home';selectedProfileId=target?.profileId||null;
 if(view==='playerStats'&&target?.playerStatsId)ui.playerStats=target.playerStatsId;
 if(!['home','profiles','profileDetail','training','friendship','league','stats','playerStats','plPlayerDetail','rules','game','history','firstThrow'].includes(view))view='home';
 if(view==='game'&&!match)view='home';
 ui={};render();
});
function btn(text,fn,cls=''){return `<button class="btn ${cls}" onclick="${fn}">${text}</button>`}
let onlineNavRole=null,onlineNavName='',onlineUserId=null;
function header(){
 const account=onlineNavRole==='player'?'<a class="btn secondary" href="online.html?logout=1">🚪 Abmelden</a>':`<a class="btn secondary" href="online.html">${onlineNavRole==='admin'?'👑 Admin':'🔐 Online'}</a>`;
 return `<div class="top"><div class="brand" onclick="go('home')" style="cursor:pointer"><span class="brand-lines"><span class="brand-main">Rüfner</span><span class="brand-accent">Beer Pong</span></span></div><div class="top-actions">${btn('☰ Menü',"go('home')",'secondary')}${account}</div></div>`;
}
function render(){const root=document.getElementById('app');let body='';try{body=({home,profiles,profileDetail,training,friendship,league,stats,playerStats,plPlayerDetail:plPlayerStats,rules,game,history:historyPage,firstThrow})[view]?.()||home()}catch(e){body=`<div class="notice">Fehler: ${esc(e.message)}</div>${btn('Zurück',"go('home')")}`};root.innerHTML=`<div class="shell ${view==='game'?'shell-game':''}">${view==='game'?'':header()}${body}${view==='game'?'':'<footer>Rüfner Beer Pong</footer>'}</div>${appDialogMarkup()}${profileZoomMarkup()}${profileStatusEditorMarkup()}`}
let appDialog=null;
function showAppAlert(message){appDialog={type:'alert',message:String(message)};render();}
function showAppConfirm(message,onAccept){appDialog={type:'confirm',message:String(message),onAccept};render();}
function closeAppDialog(){appDialog=null;render();}
function acceptAppDialog(){const action=appDialog?.onAccept;appDialog=null;if(action)action();else render();}
function appDialogMarkup(){if(!appDialog)return '';return `<div class="app-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Hinweis"><div class="app-dialog-card"><div class="app-dialog-icon">${appDialog.type==='confirm'?'⚠️':'🍻'}</div><h2>${appDialog.type==='confirm'?'Bist du sicher?':'Hinweis'}</h2><p>${esc(appDialog.message)}</p><div class="app-dialog-buttons">${appDialog.type==='confirm'?btn('Ja, Spiel verlassen','acceptAppDialog()','danger')+btn('Weiterspielen','closeAppDialog()','secondary'):btn('OK','closeAppDialog()')}</div></div></div>`;}
function home(){return `<div class="welcome-mini">${db.current?`${avatar(db.current)}<strong>Willkommen zurück, ${esc(name(db.current))}! 🍻</strong>`:`<strong>Willkommen bei Rüfner Beer Pong! 🍻</strong>`}</div><div class="grid">${[['🤖','Training','Du gegen Rüfner 3000. Privat, ohne Statistik.','training'],['🏓','Freundschaftsspiel','Echte Duelle mit gemeinsamer Statistik.','friendship'],['🏆','Premier League','15 Nights und ein grosses Finale.','league'],['📊','Statistiken','Ranglisten, Bomben und direkte Duelle.','stats'],['👤','Profile','Spieler verwalten und Profilbild ändern.','profiles'],['📖','Regeln','Das Rüfner Beer Pong Reglement.','rules']].map(a=>`<button class="card action" onclick="go('${a[3]}')"><div class="emoji">${a[0]}</div><h3>${a[1]}</h3><p>${a[2]}</p></button>`).join('')}</div>`}
function profileImageUrl(pid){
 const p=player(pid),cfg=window.RUEFNER_SUPABASE;
 if(!p)return '';
 if(p.onlineId&&cfg?.url){const base=cfg.url+'/storage/v1/object/public/player-avatars/'+encodeURIComponent(p.onlineId)+'/avatar.jpg';return base+(p.photo?.includes('?v=')?'?v='+encodeURIComponent(p.photo.split('?v=')[1]):'');}
 return p.photo||'';
}
function profiles(){
 if(!onlineDirectoryLoaded&&!onlineDirectoryLoading&&!onlineDirectoryError)setTimeout(loadOnlinePlayers,0);
 if(!onlineUserId)return `<div class="section"><h2>👥 Spielerprofile</h2></div><div class="notice">Bitte zuerst online anmelden.</div>${btn('🔐 Anmelden',"location.href='online.html'")}`;
 const players=db.players.filter(p=>p.onlineId&&!p.isDeleted).filter((p,i,arr)=>arr.findIndex(x=>x.onlineId===p.onlineId)===i).sort((a,b)=>a.name.localeCompare(b.name,'de'));
 return `<div class="section"><h2>👥 Spielerprofile</h2><p class="muted">Alle registrierten Spieler · Profil antippen, um mehr zu sehen.</p></div>${onlineDirectoryError?`<div class="notice">${esc(onlineDirectoryError)}</div>`:''}${onlineDirectoryLoading?'<p class="muted">Spieler werden geladen …</p>':''}<div class="profile-directory">${players.map(p=>`<button class="profile-list-card" onclick="openPlayerProfile('${esc(p.id)}')">${avatar(p.id)}<span class="profile-list-name">${esc(p.name)} ${reigningChampion()===p.id?'👑':''}</span><span class="profile-list-arrow">›</span></button>`).join('')}</div>${btn('↻ Profile aktualisieren','reloadOnlinePlayers()','secondary')}`;
}
function profileDetail(){
 const p=player(selectedProfileId);
 if(!p||p.isDeleted)return `<div class="notice">Dieses Profil ist nicht mehr verfügbar.</div>${btn('Zu den Profilen',"go('profiles')")}`;
 const own=!!onlineUserId&&p.onlineId===onlineUserId;
 const status=p.status||'';
 return `<div class="section"><h2>👤 Spielerprofil</h2></div><div class="card profile-detail"><button class="profile-photo-button" onclick="openProfileZoom()" aria-label="Profilbild vergrössern">${avatar(p.id)}</button><h2>${esc(p.name)} ${reigningChampion()===p.id?'👑':''}</h2><div class="profile-status">${status?`<p>${esc(status)}</p>`:own?'':'<p class="muted">Noch kein Status eingetragen.</p>'}</div>${own?`<div class="profile-edit-buttons">${btn('📷 Profilbild ändern',"document.getElementById('ownPhotoInput').click()",'secondary')}${btn('✏️ Status ändern','openProfileStatusEditor()','secondary')}</div><input id="ownPhotoInput" type="file" accept="image/*" style="display:none" onchange="photoProfile(event)"><div id="photoStatus" class="muted"></div>`:''}</div>`;
}
function openProfileStatusEditor(){
 const p=player(selectedProfileId);
 if(!p||!onlineUserId||p.onlineId!==onlineUserId)return;
 profileStatusEditor=true;render();
}
function closeProfileStatusEditor(){profileStatusEditor=false;render()}
function profileStatusEditorMarkup(){
 if(!profileStatusEditor)return '';
 const p=player(selectedProfileId);
 if(!p||p.onlineId!==onlineUserId)return '';
 return `<div class="app-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Status ändern"><div class="app-dialog-card profile-status-editor"><h2>Status ändern</h2><textarea id="ownProfileStatus" maxlength="160" rows="4" placeholder="Dein Status …">${esc(p.status||'')}</textarea><div class="app-dialog-buttons">${btn(profileStatusSaving?'Speichert …':'Speichern','saveProfileStatus()')}${btn('Abbrechen','closeProfileStatusEditor()','secondary')}</div></div></div>`;
}
function profileZoomMarkup(){
 if(!profileZoom)return '';
 const url=profileImageUrl(selectedProfileId),p=player(selectedProfileId);
 return `<div class="profile-zoom-overlay" role="dialog" aria-modal="true" aria-label="Profilbild" onclick="closeProfileZoom()"><button class="profile-zoom-close" onclick="closeProfileZoom()">✕</button>${url?`<img src="${esc(url)}" alt="Profilbild von ${esc(p?.name||'Spieler')}" onclick="event.stopPropagation()">`:`<div class="profile-zoom-placeholder">${esc((p?.name||'?').slice(0,1))}</div>`}</div>`;
}
async function saveProfileStatus(){
 const p=player(selectedProfileId),field=document.getElementById('ownProfileStatus');
 if(!p||p.onlineId!==onlineUserId||!field)return showAppAlert('Nur dein eigenes Profil darfst du bearbeiten.');
 const status=field.value.trim();if(status.length>160)return showAppAlert('Maximal 160 Zeichen erlaubt.');
 profileStatusSaving=true;
 try{
  const {client,user}=await cloudUser();if(user.id!==p.onlineId)throw Error('Falsches Konto.');
  const {error}=await client.rpc('ruefner_set_profile_status',{new_status:status});
  if(error)throw error;
  p.status=status;save();profileStatusSaving=false;profileStatusEditor=false;render();
 }catch(e){profileStatusSaving=false;showAppAlert('Status konnte nicht gespeichert werden: '+(e.message||e)+'. Bitte zuerst die V4.5-SQL-Datei in Supabase ausführen.');}
}
// Nur das authentifizierte Online-Profil darf das eigene Foto bearbeiten.
async function photoProfile(e){
 const f=e.target.files?.[0];if(!f)return;
 if(!onlineUserId)return showAppAlert('Bitte online anmelden.');
 if(!f.type.startsWith('image/'))return showAppAlert('Bitte ein Bild auswählen.');
 if(f.size>4e6)return showAppAlert('Bitte ein Bild unter 4 MB wählen.');
 try{
  const {client,user}=await cloudUser();if(user.id!==onlineUserId)throw Error('Anmeldung stimmt nicht überein.');
  const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>{const im=new Image();im.onerror=reject;im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=240;const ctx=c.getContext('2d');const z=Math.min(im.width,im.height);ctx.drawImage(im,(im.width-z)/2,(im.height-z)/2,z,z,0,0,240,240);c.toBlob(blob=>blob?resolve(blob):reject(Error('Bild konnte nicht verarbeitet werden.')),'image/jpeg',.8)};im.src=r.result};r.readAsDataURL(f)});
  const path=user.id+'/avatar.jpg';const {error}=await client.storage.from('player-avatars').upload(path,image,{contentType:'image/jpeg',upsert:true});if(error)throw error;
  const url=client.storage.from('player-avatars').getPublicUrl(path).data.publicUrl+'?v='+Date.now();
  const p=db.players.find(x=>x.onlineId===user.id);if(p){p.photo=url;save();}render();
 }catch(err){showAppAlert('Profilbild konnte nicht online gespeichert werden: '+(err.message||err)+'\nBitte zuerst die beiliegende Supabase-SQL-Einrichtung ausführen.');}
}
function requireProfile(){if(!onlineUserId||!db.players.some(p=>p.id===db.current&&p.onlineId===onlineUserId)){go('profiles');return false}return true}
function training(){return `<div class="section"><h2>🤖 Training</h2><p class="muted">Privat. Nur dein höchster besiegter Rüfner 3000 wird gespeichert.</p></div><div class="panel"><div class="field"><label>Schwierigkeit</label><select id="difficulty"><option value="0">Anfänger</option><option value="1">Amateur</option><option value="2">Fortgeschritten</option><option value="3">Profi</option><option value="4">Legende</option><option value="5">Unbesiegbar</option></select></div>${btn('Training starten','startTraining()')}</div>`}

// Online-Spielerverzeichnis (V2.2): Nur für angemeldete Benutzer.
// Spielstände bleiben in dieser Zwischenversion weiterhin lokal.
let onlineDirectoryLoading=false, onlineDirectoryLoaded=false, onlineDirectoryError='';
async function loadOnlinePlayers(){
 if(onlineDirectoryLoading)return;
 const cfg=window.RUEFNER_SUPABASE;
 if(!cfg?.url||!cfg?.publishableKey||cfg.publishableKey.includes('HIER_')){
  onlineDirectoryError='Online-Konfiguration fehlt.';render();return;
 }
 onlineDirectoryLoading=true;onlineDirectoryError='';render();
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.4');
  const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user){
   onlineDirectoryError='Bitte zuerst unter 🔐 Online anmelden.';
   return;
  }
  const {data:profiles,error}=await client.from('player_profiles')
   .select('id,username,is_blocked,is_deleted,status,best_com_level').order('username');
  if(error)throw error;
  if(!Array.isArray(profiles))throw Error('Keine Spielerliste erhalten.');
  let changed=false;
  for(const p of profiles){
   if(!p.id||!p.username)continue;
   const existing=db.players.find(x=>x.onlineId===p.id)||db.players.find(x=>!x.onlineId&&x.name.toLocaleLowerCase('de')===p.username.toLocaleLowerCase('de')&&db.players.filter(y=>!y.onlineId&&y.name.toLocaleLowerCase('de')===p.username.toLocaleLowerCase('de')).length===1);
   if(existing){
    if(existing.onlineId!==p.id){existing.onlineId=p.id;changed=true;}
     if(existing.isDeleted!==!!p.is_deleted){existing.isDeleted=!!p.is_deleted;changed=true;}
     if(existing.name!==p.username){existing.name=p.username;changed=true;}
     if(existing.status!==(p.status||'')){existing.status=p.status||'';changed=true;}
    if(existing.onlineId){const shared=cfg.url+'/storage/v1/object/public/player-avatars/'+existing.onlineId+'/avatar.jpg';if(!existing.photo||!existing.photo.startsWith(shared)){existing.photo=shared;changed=true;}}
   }else{
    db.players.push({id:'online-'+p.id,onlineId:p.id,name:p.username,status:p.status||'',photo:cfg.url+'/storage/v1/object/public/player-avatars/'+p.id+'/avatar.jpg',isDeleted:!!p.is_deleted});
    changed=true;
   }
   // Online-Rekord übernehmen, ohne einen höheren lokalen Rekord zu verlieren.
   // Nur der Besitzer darf seinen lokalen Rekord an Supabase übertragen.
   const current=db.players.find(x=>x.onlineId===p.id);
   if(current){
    const remote=Number.isInteger(p.best_com_level)&&p.best_com_level>=0&&p.best_com_level<=5?p.best_com_level:-1;
    const local=Number.isInteger(db.record[current.id])?db.record[current.id]:-1;
    const best=Math.max(remote,local);
    if(best>local){db.record[current.id]=best;changed=true;}
    if(p.id===user.id&&local>remote){
     // Eine eventuell noch nicht synchronisierte Bestleistung nachtragen.
     syncComRecord(local).catch(e=>console.warn('COM-Rekord-Synchronisierung:',e));
    }
   }
   // Auch alte lokale Profile gleichen Namens ausblenden; Spiele und Ligen bleiben gespeichert.
   for(const local of db.players){
    if(local.name.toLocaleLowerCase('de')===p.username.toLocaleLowerCase('de') && local.isDeleted!==!!p.is_deleted){
     local.isDeleted=!!p.is_deleted;changed=true;
    }
   }
  }
  if(changed)save();
  onlineDirectoryLoaded=true;
 }catch(e){
  onlineDirectoryError='Spielerliste konnte nicht geladen werden: '+(e.message||'Unbekannter Fehler');
 }finally{
  onlineDirectoryLoading=false;
  if(view==='friendship'||view==='profiles'||view==='profileDetail'||view==='stats')render();
 }
}
function reloadOnlinePlayers(){onlineDirectoryLoaded=false;loadOnlinePlayers();}
async function syncComRecord(level){
 if(!Number.isInteger(level)||level<0||level>5)return;
 const {client}=await cloudUser();
 const {data,error}=await client.rpc('ruefner_save_best_com',{p_level:level});
 if(error)throw error;
 const p=db.players.find(p=>p.onlineId===onlineUserId);
 if(p){db.record[p.id]=Math.max(db.record[p.id]??-1,Number(data)??-1);save();}
}


// V2.6: Freundschaftsspiele online speichern und gemeinsame Statistik laden.
// Der öffentliche Supabase-Schlüssel kommt ausschliesslich aus online-config.js.
let cloudClient=null,cloudResults=[],cloudResultsLoading=false,cloudResultsLoaded=false;
let cloudResultsError='',cloudSaving=false;
async function getCloudClient(){
 if(cloudClient)return cloudClient;
 const cfg=window.RUEFNER_SUPABASE;
 if(!cfg?.url?.startsWith('https://')||!cfg?.publishableKey||cfg.publishableKey.includes('HIER_'))
  throw Error('Online-Konfiguration fehlt.');
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.4');
 cloudClient=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 return cloudClient;
}
async function cloudUser(){
 const client=await getCloudClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)throw Error('Bitte zuerst unter 🔐 Online anmelden.');
 return {client,user};
}
// PL online: read-only public season history for all authenticated users.
let plLoading=false,plLoaded=false,plError='',plSaving=false;
function plLocalId(uid){return db.players.find(p=>p.onlineId===uid&&!p.isDeleted)?.id||uid}
function plOnlineId(pid){return cloudId(pid)|| (typeof pid==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(pid)?pid:null)}
function plName(pid){const p=player(pid);if(p)return p.name;return 'Spieler'}
async function loadPlOnline(force=false){
 if(plLoading||plLoaded&&!force)return;
 plLoading=true;plError='';if(view==='league'||view==='stats')render();
 try{
  const {client}=await cloudUser();
  if(!onlineDirectoryLoaded)await loadOnlinePlayers();
  const [ss,ms]=await Promise.all([
   client.from('ruefner_pl_seasons').select('*').order('created_at',{ascending:false}),
   client.from('ruefner_pl_matches').select('*').order('played_at',{ascending:true})
  ]);
  if(ss.error)throw ss.error;if(ms.error)throw ms.error;
  // Only PL data is synchronized. Existing friendlies, stats, and profiles are untouched.
  const oldPL=new Set(db.leagues.filter(l=>l.online).flatMap(l=>l.games));
  db.games=db.games.filter(g=>!oldPL.has(g.id));
  db.leagues=db.leagues.filter(l=>!l.online);
  for(const row of ss.data||[]){
   db.leagues.push({id:row.id,title:row.title,participants:[row.player_1,row.player_2,row.player_3,row.player_4].map(plLocalId),created:row.created_at,games:[],closed:false,online:true});
  }
  for(const row of ms.data||[]){
   const l=db.leagues.find(l=>l.id===row.season_id);if(!l)continue;
   const g={id:row.id,date:row.played_at,a:plLocalId(row.player_a),b:plLocalId(row.player_b),winner:plLocalId(row.winner),kind:'league',ref:{league:row.season_id,night:row.night,stage:row.stage},sides:[row.side_a,row.side_b]};
   db.games.push(g);l.games.push(g.id);
  }
  for(const l of db.leagues.filter(l=>l.online))l.closed=!!plGame(l,16,'final16')&&!!plGame(l,16,'third');
  plLoaded=true;
 }catch(e){plError=e.message||'Premier League konnte nicht geladen werden.';plLoaded=false;}
 finally{plLoading=false;if(view==='league'||view==='stats')render()}
}
async function createPlOnline(){
 if(plSaving)return;
 const participants=[0,1,2,3].map(i=>document.getElementById('slot'+i)?.value);
 if(participants.some(x=>!x)||new Set(participants).size!==4)return showAppAlert('Vier unterschiedliche Spieler auswählen.');
 const ids=participants.map(plOnlineId);
 if(ids.some(x=>!x))return showAppAlert('Alle vier Spieler benötigen ein Online-Konto.');
 const title=document.getElementById('seasonName')?.value.trim()||'Premier League';
 plSaving=true;
 try{const {client}=await cloudUser();const {error}=await client.rpc('ruefner_pl_create_season',{p_title:title,p_players:ids});if(error)throw error;plLoaded=false;await loadPlOnline(true);go('league');}
 catch(e){showAppAlert('Saison konnte nicht erstellt werden: '+(e.message||e));}
 finally{plSaving=false;}
}
async function savePlOnline(g){
 const {client,user}=await cloudUser();
 const l=db.leagues.find(l=>l.id===g.ref?.league);
 if(!l?.online)throw Error('Keine Online-Saison. Bitte Premier League neu laden.');
 if(!l.participants.some(p=>plOnlineId(p)===user.id))throw Error('Nur Saisonspieler dürfen Resultate speichern.');
 // RPC validates canonical player ordering; the red starter may have been the second player.
 const pairs=g.ref.night<=15?(g.ref.stage==='semi1'||g.ref.stage==='semi2'?plPairs(l,g.ref.night)[g.ref.stage==='semi1'?0:1]:[plGame(l,g.ref.night,'semi1').winner,plGame(l,g.ref.night,'semi2').winner]):(g.ref.stage==='final16'?[leagueStandings(l)[0].pid,leagueStandings(l)[1].pid]:[leagueStandings(l)[2].pid,leagueStandings(l)[3].pid]);
 const idx=pairs.map(pid=>g.a===pid?0:1);
 const {error}=await client.rpc('ruefner_pl_record_match',{p_season:l.id,p_night:g.ref.night,p_stage:g.ref.stage,p_a:plOnlineId(pairs[0]),p_b:plOnlineId(pairs[1]),p_winner:plOnlineId(g.winner),p_side_a:g.sides[idx[0]],p_side_b:g.sides[idx[1]]});
 if(error)throw error;
 plLoaded=false;await loadPlOnline(true);
 if(!plLoaded)throw Error('Ergebnis gespeichert, aber Aktualisierung fehlgeschlagen. Bitte PL neu öffnen.');
}
function refreshPlOnline(){plLoaded=false;loadPlOnline(true)}
function cloudId(localId){
 const p=player(localId);
 return p?.onlineId||null;
}
async function loadCloudResults(force=false){
 if(cloudResultsLoading||cloudResultsLoaded&&!force)return;
 cloudResultsLoading=true;cloudResultsError='';
 if(view==='stats')render();
 try{
  const {client}=await cloudUser();
  const {data,error}=await client.from('ruefner_match_results')
   .select('client_match_id,player_a,player_b,winner,side_a,side_b,played_at')
   .order('played_at',{ascending:false}).limit(1000);
  if(error)throw error;
  cloudResults=data||[];
  cloudResultsLoaded=true;
 }catch(e){cloudResultsError=e.message||'Online-Ergebnisse konnten nicht geladen werden.';}
 finally{cloudResultsLoading=false;if(view==='stats')render();}
}
function refreshCloudResults(){cloudResultsLoaded=false;loadCloudResults(true);}
// V2.8: Rollierende Statistikzeiträume. 'Letztes Jahr' bedeutet 365 Tage.
let statsPeriod='30';
function inStatsPeriod(date){
 if(statsPeriod==='all')return true;
 const t=Date.parse(date);
 if(!Number.isFinite(t))return false;
 const age=Date.now()-t;
 return age>=0&&age<=Number(statsPeriod)*86400000;
}
function periodControls(){return `<div class="panel"><div class="row">${[['30','🔥 Letzte 30 Tage'],['365','📅 Letztes Jahr'],['all','🏆 Gesamt']].map(([value,label])=>btn(label,`setStatsPeriod('${value}')`,statsPeriod===value?'':'secondary')).join('')}</div></div>`;}
function setStatsPeriod(value){if(!['30','365','all'].includes(value))return;statsPeriod=value;render();}
function allOnlineStatResults(){
 const pl=db.games.filter(g=>g.kind==='league'&&db.leagues.some(l=>l.online&&l.id===g.ref?.league))
  .map(g=>({client_match_id:g.id,player_a:plOnlineId(g.a),player_b:plOnlineId(g.b),winner:plOnlineId(g.winner),
    side_a:g.sides[0],side_b:g.sides[1],played_at:g.date}));
 const seen=new Set(cloudResults.map(g=>g.client_match_id).filter(Boolean));
 return [...cloudResults,...pl.filter(g=>!seen.has(g.client_match_id))];
}
function cloudStatsTable(){
 if(!onlineDirectoryLoaded&&!onlineDirectoryLoading&&!onlineDirectoryError)setTimeout(loadOnlinePlayers,0);
 if(!cloudResultsLoaded&&!cloudResultsLoading&&!cloudResultsError)setTimeout(loadCloudResults,0);
 if(!plLoaded&&!plLoading&&!plError)setTimeout(()=>loadPlOnline(),0);
 const periodResults=allOnlineStatResults().filter(g=>inStatsPeriod(g.played_at));
  const status=cloudResultsLoading?'Online-Statistik wird geladen …':cloudResultsError;
 const players=db.players.filter(p=>p.onlineId&&!p.isDeleted);
 const rows=players.map(p=>{
  const gs=periodResults.filter(g=>g.player_a===p.onlineId||g.player_b===p.onlineId);
  let wins=0,bombs=0,shots=0,hits=0,combos=0,diff=0;
  for(const g of gs){
   const isA=g.player_a===p.onlineId,s=isA?g.side_a:g.side_b,opp=isA?g.side_b:g.side_a;
   wins+=g.winner===p.onlineId?1:0;
   bombs+=Number(s?.bombs)||0;shots+=Number(s?.shots)||0;
   hits+=Number(s?.hits)||0;combos+=Number(s?.combos)||0;
   diff+=(Number(s?.remaining)||0)-(Number(opp?.remaining)||0);
  }
  return {p,games:gs.length,wins,bombs,shots,hits,combos,diff};
 }).sort((a,b)=>b.wins-a.wins||b.diff-a.diff);
 return `<div class="section"><h2>📊 Spielerstatistik</h2></div><div class="panel">${status?`<p class="muted">${esc(status)}</p>`:''}${cloudResultsError?'<p class="muted">Bitte online anmelden.</p>':''}<div class="table-wrap"><table class="table compact-stats"><thead><tr><th>Spieler</th><th>Spiele</th><th>Siege</th><th>Quote</th></tr></thead><tbody>${rows.map(x=>`<tr><td><button class="stats-player-link" onclick="openPlayerStats('${x.p.onlineId}')">${avatar(x.p.id)}<span>${esc(x.p.name)}</span></button></td><td>${x.games}</td><td>${x.wins}</td><td>${formatPct(x.wins,x.games)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function openPlayerStats(onlineId){ui.playerStats=onlineId;window.history.pushState({ruefnerView:'playerStats',playerStatsId:onlineId},'','#playerStats');view='playerStats';render();}
function openStatsPhoto(pid){selectedProfileId=pid;openProfileZoom();}
function formatPct(n,d){return d?(100*n/d).toFixed(1)+' %':'–';}
function formatAvg(cups,turns){return turns>0?(cups/turns).toFixed(2):'–';}
function playerStats(){
 const pid=ui.playerStats,p=db.players.find(p=>p.onlineId===pid);
 if(!p||p.isDeleted)return `<div class="notice">Spieler nicht gefunden.</div>${btn('← Zurück',"go('stats')")}`;
 const allGs=allOnlineStatResults().filter(g=>g.player_a===pid||g.player_b===pid);
 const gs=allGs.filter(g=>inStatsPeriod(g.played_at));
 let shots=0,hits=0,trickAttempts=0,trickHits=0,islandAttempts=0,islandHits=0,finishAttempts=0,finishHits=0,normalFinishes=0,comboFinishes=0,bombFinishes=0,bombs=0,combos=0,turns=0,cups=0;
 let bestWin=null,bestLoss=null,complete=0;
 for(const g of allGs){
   const isA=g.player_a===pid,s=isA?g.side_a:g.side_b,opp=isA?g.side_b:g.side_a;
   const inPeriod=inStatsPeriod(g.played_at);
   if(inPeriod){shots+=Number(s?.shots)||0;hits+=Number(s?.hits)||0;}
   if(inPeriod){bombs+=Number(s?.bombs)||0;combos+=Number(s?.combos)||0;islandAttempts+=Number(s?.islandAttempts)||0;islandHits+=Number(s?.islandHits)||0;}
   const fields=['trickAttempts','trickHits','finishAttempts','finishHits','normalFinishes','comboFinishes','bombFinishes'];
   if(inPeriod)for(const k of fields)if(s?.[k]!=null&&Number.isFinite(Number(s[k])))evalStat(k,Number(s[k]));
  function evalStat(k,v){switch(k){case 'trickAttempts':trickAttempts+=v;break;case 'trickHits':trickHits+=v;break;case 'finishAttempts':finishAttempts+=v;break;case 'finishHits':finishHits+=v;break;case 'normalFinishes':normalFinishes+=v;break;case 'comboFinishes':comboFinishes+=v;break;case 'bombFinishes':bombFinishes+=v;break;}}
  if(typeof s?.turns==='number'&&s.turns>0){
   const c=10-(Number(opp?.remaining)||0),t=s.turns,avg=c/t;
    if(inPeriod){cups+=c;turns+=t;complete++;}
   const rec={avg,opponent:(db.players.find(p=>p.onlineId===(isA?g.player_b:g.player_a))?.name||'Unbekannt'),date:g.played_at};
   if(g.winner===pid){if(!bestWin||avg>bestWin.avg)bestWin=rec;}
   else if(!bestLoss||avg>bestLoss.avg)bestLoss=rec;
  }
 }
 const row=(label,value)=>`<tr><td>${esc(label)}</td><td><strong>${esc(value)}</strong></td></tr>`;
 const card=(title,body,opened=false)=>`<details class="panel" ${opened?'open':''}><summary><strong>${title}</strong></summary><div class="table-wrap"><table class="table"><tbody>${body}</tbody></table></div></details>`;
 const rec=r=>r?`${r.avg.toFixed(2)} · gegen ${esc(r.opponent)} · ${new Date(r.date).toLocaleDateString('de-CH')}`:'–';
 const wins=gs.filter(g=>g.winner===pid).length;
 const versus=onlineUserId&&onlineUserId!==pid?gs.filter(g=>(g.player_a===onlineUserId&&g.player_b===pid)||(g.player_b===onlineUserId&&g.player_a===pid)):[];
 const myWins=versus.filter(g=>g.winner===onlineUserId).length;
 const duel=onlineUserId&&onlineUserId!==pid?card('⚔️ Direktvergleich · Du gegen '+esc(p.name),row('Spiele gegeneinander',versus.length)+row('Deine Siege',myWins)+row('Deine Niederlagen',versus.length-myWins)+row('Deine Siegquote',formatPct(myWins,versus.length)),true):'';
 return `<div class="stats-back-row">${btn('← Zur Statistik',"go('stats')",'secondary')}</div>${periodControls()}<div class="section player-stats-intro"><h2 class="player-stats-heading"><button class="stats-avatar-zoom" onclick="openStatsPhoto('${p.id}')" aria-label="Profilbild vergrössern">${avatar(p.id)}</button><span>${esc(p.name)}</span></h2>${p.status?`<p class="player-stats-status">${esc(p.status)}</p>`:''}</div>`+duel+
 card('🏆 Average',row('Gesamt-AVG',formatAvg(cups,turns))+row('Höchster Winning-AVG',rec(bestWin))+row('Höchster Losing-AVG',rec(bestLoss)),true)+
 card('🎯 Wurfstatistik',row('Geworfene Bälle',shots)+row('Treffer',hits)+row('Trefferquote',formatPct(hits,shots))+row('Trickshot-Versuche',trickAttempts||complete?trickAttempts:'–')+row('Trickshot-Trefferquote',formatPct(trickHits,trickAttempts)))+
 card('🏁 Finishstatistik',row('Finishversuche',finishAttempts||complete?finishAttempts:'–')+row('Erfolgreiche Finishes',finishHits||complete?finishHits:'–')+row('Finishquote',formatPct(finishHits,finishAttempts))+row('Normale Finishes',normalFinishes||complete?normalFinishes:'–')+row('Kombifinishes',comboFinishes||complete?comboFinishes:'–')+row('Bombenfinishes',bombFinishes||complete?bombFinishes:'–'))+
 card('💣 Spezialstatistik',row('Bomben',bombs)+row('Kombinationen',combos)+row('Island-Versuche',islandAttempts)+row('Island-Treffer',islandHits)+row('Island-Trefferquote',formatPct(islandHits,islandAttempts))+row('Becherdifferenz',(()=>{const d=gs.reduce((v,g)=>{const a=g.player_a===pid,s=a?g.side_a:g.side_b,o=a?g.side_b:g.side_a;return v+(Number(s?.remaining)||0)-(Number(o?.remaining)||0)},0);return (d>0?'+':'')+d})()))+
 (complete<gs.length?`<p class="muted">Hinweis: Average und neue Detailwerte sind nur für die ${complete} Spiele ab V2.7 verfügbar. Ältere Ergebnisse bleiben erhalten.</p>`:'');
}
async function saveFriendlyOnline(g){
 const a=cloudId(g.a),b=cloudId(g.b),winner=cloudId(g.winner);
 if(!a||!b||!winner)throw Error('Beide Spieler müssen registrierte Online-Profile sein. Bitte Spielerauswahl aktualisieren.');
 const {client,user}=await cloudUser();
 if(user.id!==a&&user.id!==b)throw Error('Nur ein beteiligter Spieler darf das Ergebnis online speichern. Bitte mit Dario oder dem Gegner anmelden.');
 const payload={
  client_match_id:g.id,player_a:a,player_b:b,winner,recorded_by:user.id,
  played_at:g.date,side_a:g.sides[0],side_b:g.sides[1]
 };
 const {error}=await client.from('ruefner_match_results').insert(payload);
 if(error&&error.code!=='23505')throw error;
 // A duplicate ID is not proof that this exact result was stored: verify it.
 if(error?.code==='23505'){
  const {data, error:readError}=await client.from('ruefner_match_results')
   .select('player_a,player_b,winner').eq('client_match_id',g.id).single();
  if(readError||data?.player_a!==a||data?.player_b!==b||data?.winner!==winner)
   throw Error('Diese Spiel-ID existiert bereits mit anderen Daten. Bitte Administrator kontaktieren.');
 }
 cloudResultsLoaded=false;cloudResultsError='';
}

function friendship(){
 if(!onlineDirectoryLoaded&&!onlineDirectoryLoading&&!onlineDirectoryError)setTimeout(loadOnlinePlayers,0);
 const directoryMessage=onlineDirectoryLoading?'Online-Spieler werden geladen …':onlineDirectoryError||'Online-Spieler geladen.';
 return `<div class="section"><h2>🏓 Freundschaftsspiel</h2><p class="muted">Ein Handy genügt. Freundschaftsspiele werden online gespeichert. Bitte vorher online anmelden.</p></div><div class="panel">${onlineDirectoryLoading||onlineDirectoryError?`<p class="muted">${esc(onlineDirectoryLoading?'Online-Spieler werden geladen …':onlineDirectoryError)}</p>`:''}${pairPicker()}${btn('Spiel starten',"startFriendly()")}</div>`;
}
function pairPicker(ids){const ps=ids||db.players.filter(p=>!p.isDeleted).filter((p,i,arr)=>arr.findIndex(q=>q.name.toLocaleLowerCase('de')===p.name.toLocaleLowerCase('de'))===i).map(p=>p.id);return `<div class="field"><label style="color:#69baff;font-weight:800">Spieler 1</label><select id="p1">${ps.map(p=>`<option value="${p}">${esc(name(p))}</option>`).join('')}</select></div><div class="field"><label style="color:#ff788e;font-weight:800">Spieler 2</label><select id="p2">${ps.map((p,i)=>`<option value="${p}" ${i===1?'selected':''}>${esc(name(p))}</option>`).join('')}</select></div>`}
function startTraining(){if(!requireProfile())return;startMatch(db.current,'COM','training',null,Number(document.getElementById('difficulty').value))}
function startFriendly(){if(db.players.length<2)return showAppAlert('Erstelle zuerst mindestens zwei Profile.');const a=document.getElementById('p1').value,b=document.getElementById('p2').value;if(a===b)return showAppAlert('Bitte zwei unterschiedliche Spieler wählen.');startMatch(a,b,'friendly')}
function newSide(){return {turns:0,finishAttempts:0,finishHits:0,normalFinishes:0,comboFinishes:0,bombFinishes:0,trickAttempts:0,trickHits:0,islandAttempts:0,islandHits:0,cups:Array.from({length:10},(_,i)=>i),layout:10,positions:formationCoords(10,0),reracked:false,shots:0,hits:0,bombs:0,combos:0}}
function formationCoords(n,v){
 const pattern=(formationPatterns[n]||formationPatterns[10])[v]||(formationPatterns[n]||formationPatterns[10])[0];
 const maxRow=Math.max(...pattern.map(([r])=>r));
 // Jeder Becher liegt auf dem ursprünglichen Dreiecksraster, keine gestreckten Reihen.
 // Hinterste Reihe immer am Tischende, unabhängig von der Becherzahl.
 return pattern.map(([r,c])=>({x:145+c*53,y:206-(maxRow-r)*46}));
}
function startMatch(a,b,kind,ref=null,difficulty=0){
 if(kind!=='training'){
  pendingStart={a,b,kind,ref,difficulty};view='firstThrow';render();return;
 }
 beginMatch(a,b,kind,ref,difficulty,0);
}
function firstThrow(){
 if(!pendingStart)return `<div class="notice">Kein Spiel ausgewählt.</div>${btn('Zurück',"go('home')")}`;
 const {a,b,kind}=pendingStart;
 return `<div class="section"><h2>🎯 Wer beginnt?</h2><p class="muted">${kind==='league'?'Premier League':'Freundschaftsspiel'} · ${esc(name(a))} gegen ${esc(name(b))}</p></div><div class="panel"><p>Wähle, wer den ersten Wurf macht:</p><div class="row">${btn(esc(name(a))+' beginnt','chooseFirstThrow(0)')}${btn(esc(name(b))+' beginnt','chooseFirstThrow(1)')}</div><p>${btn('Abbrechen',"cancelFirstThrow()",'secondary')}</p></div>`;
}
function cancelFirstThrow(){const kind=pendingStart?.kind;pendingStart=null;go(kind==='league'?'league':'friendship')}
function chooseFirstThrow(side){
 if(!pendingStart||![0,1].includes(side))return;
 const {a,b,kind,ref,difficulty}=pendingStart;pendingStart=null;
 if(kind==='league'){
  const first=side===0?a:b,second=side===0?b:a;
  beginMatch(first,second,kind,ref,difficulty,0);
 }else beginMatch(a,b,kind,ref,difficulty,side);
}
function beginMatch(a,b,kind,ref,difficulty,firstTurn){
 match={id:id(),a,b,kind,ref,difficulty,sides:[newSide(),newSide()],turn:firstTurn,round:[],pending:null,bonus:false,comboActive:false,comboBonusThrows:0,tricks:0,bonusPhase:false,bonusType:null,awaitingTrick:false,finished:false,log:[],undo:[]};
 match.sides[firstTurn].turns=1;window.history.pushState({ruefnerView:'game'},'','#game');view='game';render();if(isComTurn())computerTurn();
}
const trickNames=['Extra hoch','Unter dem Bein','Augen zu','Rückwärts','Falsche Hand','Zweimal auf den Tisch','Pfeilbogen 🏹'];
const trickWeights=[22,18,17,13,17,11,2];
const trickFactors=[.75,.55,.55,.4,.6,.35,.12];
function randomTrick(){let r=Math.random()*trickWeights.reduce((a,b)=>a+b,0);for(let i=0;i<trickWeights.length;i++){r-=trickWeights[i];if(r<0)return i}return 0}
function trickCount(){return match.tricks||0}
function startNextTrick(){
 if(trickCount()<=0){endRound();return}
 match.tricks--;
 if(isComTurn()){match.awaitingTrick=true;match.bonusPhase=false;match.bonusType=null;render()}
 else{match.bonusPhase=true;match.bonusType=match.kind==='training'?randomTrick():null;if(match.kind==='training')showTrickFlash(trickNames[match.bonusType]);render()}
}
function finishTrick(){
 ui.trickFlash=null;clearTimeout(trickFlashTimer);match.bonusPhase=false;match.bonusType=null;
 if(checkWin())return;
 startNextTrick();
}

function isComTurn(){return match.kind==='training'&&match.turn===1}
function isHumanTurn(){return !isComTurn()}
function boardIndex(){return 1-match.turn}
function islandCandidates(){
 if(!match||match.finished)return [];
 const s=match.sides[boardIndex()];
 return s.cups.filter(c=>!s.cups.some(other=>other!==c&&Math.hypot(s.positions[c].x-s.positions[other].x,s.positions[c].y-s.positions[other].y)<56));
}
function canIsland(){return !!match&&!match.finished&&!match.pending&&!ui.ownGoal&&!isComTurn()&&!match.awaitingTrick&&!match.bonusPhase&&!match.islandActive&&match.round.length<2&&islandCandidates().length>0;}
function toggleIsland(){if(!match||match.finished||match.pending||isComTurn()||match.awaitingTrick||match.bonusPhase||ui.ownGoal)return;if(ui.islandActive){ui.islandActive=false;render();return;}if(!canIsland())return;ui.islandActive=true;render();}
function islandSelectionDone(){
 match.islandChoice=null;
 processIslandChoices();
}
function chooseIslandBonus(side,c){
 const p=match?.islandChoice;
 if(!p||p.side!==side||!p.allowed.includes(c))return;
 snapshot();removeCups(side,[c]);islandSelectionDone();
}
// Island choices are deliberately deferred until BOTH throws have been recorded.
// This keeps the second throw available and preserves bombs/combinations.
function processIslandChoices(){
 if(!match||match.finished)return;
 const queue=match.islandQueue||[];
 while(queue.length){
  const q=queue.shift();
  const hitCups=new Set(match.round.filter(x=>x.cup!==undefined).map(x=>x.cup));
  const allowed=match.sides[q.side].cups.filter(c=>q.kind==='miss'||!hitCups.has(c));
  if(!allowed.length)continue;
  // If only one additional opponent cup can be removed, there is no
  // meaningful choice. Remove it automatically, including on throw two.
  // Keep processing queued penalties before showing the winner.
  if(q.kind==='hit'&&allowed.length===1){
   removeCups(q.side,[allowed[0]]);
   continue;
  }
  // When the opponent's last cups are already covered by this round's
  // successful shots and Island bonuses, the match is decided. Settle a
  // missed-Island penalty automatically rather than requesting another tap.
  // The cup is still removed so the final cup difference stays correct.
  const opponent=1-match.turn;
  const opponentWillBeEmpty=match.sides[opponent].cups.every(c=>hitCups.has(c));
  if(q.kind==='miss'&&opponentWillBeEmpty){
   removeCups(q.side,[allowed[0]]);
   continue;
  }
  match.islandChoice={kind:q.kind,side:q.side,allowed};
  render();return;
 }
 match.islandQueue=[];
 resolveRound();
}
function finishRegularThrows(){
 if(match.round.length!==2)return;
 // A bomb removes the hit cup plus three others. Every successful Island
 // removes one more. If that covers all cups, finish without any selection.
 const hits=match.round.filter(q=>q.cup!==undefined);
 const islandHits=hits.filter(q=>q.island).length;
 const target=boardIndex(),remaining=match.sides[target].cups.length;
 if(hits.length===2&&hits[0].cup===hits[1].cup&&remaining<=4+islandHits){
  const own=match.sides[match.turn];
  own.bombs++;own.finishAttempts++;own.finishHits++;own.bombFinishes++;
  removeCups(target,[...match.sides[target].cups]);
  checkWin();
  return;
 }
 // Resolve successful Island bonuses first. Only afterwards settle penalties.
 // Otherwise a miss on throw one wrongly prompts for an own cup before the
 // winning Island bonus from throw two has been selected.
 match.islandQueue=match.round.filter(q=>q.island).map(q=>({kind:q.miss?'miss':'hit',side:q.miss?match.turn:q.side})).sort((a,b)=>(a.kind==='miss')-(b.kind==='miss'));
 processIslandChoices();
}

function cupBoard(sideIndex){
 const s=match.sides[sideIndex],target=boardIndex(),pending=match.pending?.side===sideIndex,allowed=match.pending?.allowed||[];
 const islandChoice=match.islandChoice&&match.islandChoice.side===sideIndex;
 const ownGoalActive=ui.ownGoal&&sideIndex===match.turn;
 const active=match.islandChoice?islandChoice:(ui.ownGoal?ownGoalActive:(match.pending?pending:!match.finished&&isHumanTurn()&&sideIndex===target&&!match.awaitingTrick));
 return `<div class="cupfield ${sideIndex===1?'upper-field':'lower-field'} ${sideIndex===target?'attack-board':'defence-board'}" onclick="boardMiss(event,${sideIndex})"><div class="cups ${sideIndex===1?'board-top':'board-bottom'}">${s.cups.map(c=>{
  const pos=s.positions[c]||{x:145,y:115};const canTap=active&&(match.islandChoice?match.islandChoice.allowed.includes(c):(ui.ownGoal||!pending||allowed.includes(c)))&&(ui.islandActive?islandCandidates().includes(c):true);
  const depth=sideIndex===1?230-pos.y:pos.y;
  return `<button class="cup ${sideIndex===1?'red':'blue'} ${(pending&&allowed.includes(c))||(match.islandChoice?.side===sideIndex&&match.islandChoice.allowed.includes(c))||(ui.ownGoal&&sideIndex===match.turn)?'candidate':''} ${match.round.some(q=>q.cup===c&&q.side===sideIndex)?'pending':''}" style="left:${pos.x/290*100}%;top:${(sideIndex===1?230-pos.y:pos.y)/230*100}%;z-index:${Math.round(sideIndex===1?230-pos.y:pos.y)}" ${canTap?'':'disabled'} onclick="tapCup(${sideIndex},${c});event.stopPropagation()" aria-label="Becher ${c+1}"></button>`;
 }).join('')}</div></div>`;
}
function boardTableMiss(e){if(e.target.closest('button,.table-side-label,.game-actions,.game-exit,.trick-flash'))return;if(match?.pending||match?.islandChoice||match?.finished||match?.awaitingTrick||ui.ownGoal||!isHumanTurn())return;missShot()}
function boardMiss(e,side){if(ui.ownGoal)return;e.stopPropagation();if(e.target.closest('button')||match.pending||match.islandChoice||match.finished||!isHumanTurn()||match.awaitingTrick)return;missShot()}
function game(){
 if(!match)return `<div class="notice">Kein aktives Spiel.</div>`;
 const a=match.a,b=match.b,owner=match.turn;
 const notice=match.islandChoice?(match.islandChoice.kind==='hit'?'🏝️ Island getroffen! Gegner wählt einen zusätzlichen Becher.':'🏝️ Island verfehlt! Wähle einen eigenen Becher zum Entfernen.'):ui.islandActive?'🏝️ Island angesagt! Alleinstehenden Becher treffen oder auf den Tisch tippen.':ui.ownGoal?`⚽ Eigentor von ${esc(name([match.a,match.b][match.turn]))}: Tippe einen eigenen Becher an.`:match.pending?'💣 Bombe! Wähle die markierten Becher.':match.finished?'🏆 Spiel beendet.':match.awaitingTrick?'🎩 Wähle einen Trickshot für Rüfner 3000.':match.bonusPhase?`🎩 Trickshot: ${match.bonusType==null?'Frei wählbar':esc(trickNames[match.bonusType])} · jetzt ausführen!${trickCount()?' · danach noch ein Trickshot':''}`:`🎯 ${esc(name([a,b][owner]))} ist dran · Wurf ${match.round.length+1} von 2${trickCount()?' · '+trickCount()+' Trickshot(s) vorgemerkt':''}`;
 const controls=`<div class="game-actions">${btn('↶','undoShot()','secondary action-icon undo-icon')}${canRerack()?btn('🔄','showRerack()','secondary action-icon'):''}${!match.finished&&isHumanTurn()&&!match.pending&&!match.bonusPhase&&!match.awaitingTrick&&match.round.length<2?btn('🎩','requestTrick()','secondary action-icon'):''}${ui.ownGoal?btn('✕','cancelOwnGoal()','secondary action-icon own-goal-cancel'):''}${!ui.ownGoal&&!match.finished&&match.kind!=='training'&&!match.pending&&!match.islandChoice?btn('💀','deathCup()','secondary action-icon')+btn('⚽','ownGoal()','secondary action-icon'):''}${!match.finished&&!match.pending&&!match.islandChoice&&!isComTurn()&&(ui.islandActive||canIsland())?`<button class="btn secondary action-icon island-action ${ui.islandActive?'island-on':''}" onclick="toggleIsland()" aria-label="Island ansagen">🏝️</button>`:''}</div>`;
 return `<div class="game-screen">${(match.pending||match.islandChoice||ui.islandActive||match.bonusPhase||match.awaitingTrick||ui.ownGoal)?`<div class="fullscreen-status" aria-live="polite">${notice}</div>`:''}<div class="table-with-actions"><div class="matchstack" onclick="boardTableMiss(event)"><div class="table-side-label player-top ${owner===1?'is-active':''}">${avatar(b)}<div class="player-label"><span class="player-status"><strong>${esc(name(b))}</strong>${owner===1?`<span class="throw-count"> · Wurf ${Math.min(match.round.length+1,2)} von 2</span>`:''}</span></div></div>${cupBoard(1)}<div class="table-middle-line"></div>${cupBoard(0)}<div class="table-side-label player-bottom ${owner===0?'is-active':''}">${avatar(a)}<div class="player-label"><span class="player-status"><strong>${esc(name(a))}</strong>${owner===0?`<span class="throw-count"> · Wurf ${Math.min(match.round.length+1,2)} von 2</span>`:''}</span></div></div>${controls}<button class="game-exit" onclick="cancelMatch()" aria-label="Spiel abbrechen">✕</button></div></div>${ui.rerack?rerackPanel():''}${ui.trickFlash&&Date.now()<ui.trickFlash.until?`<div class="trick-flash" role="status" aria-live="polite" onclick="dismissTrickFlash();event.stopPropagation()"><div class="trick-flash-inner"><div class="trick-flash-title">🎩 TRICKSHOT!</div><div class="trick-flash-task">${esc(ui.trickFlash.label)}</div></div></div>`:''}${match.awaitingTrick?`<div class="trick-choice-backdrop" role="dialog" aria-modal="true" aria-label="Trickshot für COM wählen"><div class="trick-choice-modal"><div class="trick-choice-title">🎩 RÜFNER 3000 TRICKSHOT!</div><p>Welchen Trickshot muss der COM machen?</p><div class="trick-choice-grid">${trickNames.map((t,i)=>`<button class="btn secondary" onclick="chooseComTrick(${i})">${esc(t)}</button>`).join('')}</div></div></div>`:''}${ui.deathCup&&!match.finished?`<div class="trick-choice-backdrop" role="dialog" aria-modal="true" aria-label="Death Cup Sieger wählen"><div class="trick-choice-modal"><div class="trick-choice-title">💀 DEATH CUP!</div><p>Wer ist der Sieger?</p><div class="trick-choice-grid">${btn('🔵 '+esc(name(match.a)),'chooseDeathCupWinner(0)')}${btn('🔴 '+esc(name(match.b)),'chooseDeathCupWinner(1)')}</div><p>${btn('Abbrechen','cancelDeathCup()','secondary')}</p></div></div>`:''}${match.finished?`<div class="victory-overlay" role="dialog" aria-modal="true" aria-label="Spiel beendet"><div class="victory-card"><div class="victory-trophy">🏆</div><h2>${esc(name(match.winner))} gewinnt!</h2>${match.kind==='training'?'':'<p>Was möchtest du mit dem Ergebnis machen?</p>'}<div class="victory-buttons">${match.kind==='training'?btn('🏠 Zurück zum Menü','finishMatch()'):btn(match.kind==='league'?'🏆 Ergebnis abschliessen':cloudSaving?'Speichert online …':'💾 Ergebnis speichern','finishMatch()',cloudSaving?'secondary':'')+(match.kind==='league'?'':btn('Nicht speichern','discardFinishedMatch()','secondary'))}${btn('↶ Letzten Wurf rückgängig','undoShot()','secondary')}</div></div></div>`:''}<div class="panel match-stats"><div class="row between"><span class="muted">${esc(name(a))}: ${match.sides[0].hits}/${match.sides[0].shots} Treffer · ${match.sides[0].bombs} Bomben</span><span class="muted">${esc(name(b))}: ${match.sides[1].hits}/${match.sides[1].shots} Treffer · ${match.sides[1].bombs} Bomben</span></div></div></div>`;
}
function snapshot(){match.undo.push(JSON.stringify({...match,undo:[]}));if(match.undo.length>30)match.undo.shift()}
function undoShot(){if(!match?.undo.length)return;const old=match.undo.pop(),remaining=match.undo;match=JSON.parse(old);match.undo=remaining;ui.rerack=false;ui.islandActive=false;render()}
function removeCups(side,cups){const s=match.sides[side];s.cups=s.cups.filter(c=>!cups.includes(c))}
// Equilateral triangular cup grid: avoid tiny pixel rounding differences (53 vs 46).
function bombDistance(origin,pos){
 const dx=(pos.x-origin.x)/53,dy=(pos.y-origin.y)/46;
 return Math.round((4*dx*dx+3*dy*dy)*10000)/10000;
}
function settleBomb(){
 const p=match.pending;if(!p)return;
 const side=match.sides[p.side];
 while(p.remaining>0&&side.cups.length){
  const ordered=side.cups.map(c=>({c,d:bombDistance(p.origin,side.positions[c])})).sort((a,b)=>a.d-b.d);
  const boundary=ordered[Math.min(p.remaining-1,ordered.length-1)].d;
  const forced=ordered.filter(o=>o.d<boundary-0.0001).map(o=>o.c);
  if(!forced.length){p.allowed=ordered.filter(o=>Math.abs(o.d-boundary)<0.0001).map(o=>o.c);break;}
  removeCups(p.side,forced);p.remaining-=forced.length;
 }
 if(p.remaining<=0||!side.cups.length){match.pending=null;afterBomb();return;}
 if(p.allowed.length===p.remaining){removeCups(p.side,p.allowed);match.pending=null;afterBomb();return;}
}
function tapCup(side,c){
 if(!match||match.finished)return;
 if(match.islandChoice){chooseIslandBonus(side,c);return;}
 if(ui.ownGoal){
  if(side!==match.turn||!match.sides[side].cups.includes(c))return;
  snapshot();ui.ownGoal=false;removeCups(side,[c]);if(!checkWin())render();return;
 }
 if(match.pending){
  if(side!==match.pending.side||!match.pending.allowed.includes(c))return;
  snapshot();removeCups(side,[c]);match.pending.remaining--;
  if(match.pending.remaining<=0||!match.sides[side].cups.length){match.pending=null;afterBomb();}
  else settleBomb();
  render();return;
 }
 if(side!==boardIndex()||isComTurn()||match.awaitingTrick)return;
 if(ui.islandActive&&!islandCandidates().includes(c))return;
 snapshot();recordHit(side,c);
}
function recordHit(side,c){
 const own=match.sides[match.turn];const lastCup=match.sides[side].cups.length===1;const firstRegular=match.round.length===0&&!match.bonusPhase&&!match.comboActive&&!match.comboBonusThrows;own.shots++;own.hits++;if(ui.islandActive){own.islandAttempts++;own.islandHits++;}if(lastCup){own.finishAttempts++;own.finishHits++;own.normalFinishes++;if(firstRegular)match.halfTurnWinner=match.turn;}if(match.bonusPhase){own.trickAttempts++;own.trickHits++;}
 if(match.bonusPhase){removeCups(side,[c]);finishTrick();return}
 const island=!!ui.islandActive;ui.islandActive=false;
 if(match.comboBonusThrows>0)match.comboBonusThrows--;match.round.push({side,cup:c,island});
 // With only two cups left, a successful Island on the first throw
 // necessarily removes both cups: the hit cup and one Island bonus cup.
 if(island&&match.round.length===1&&match.sides[side].cups.length===2){
  own.finishAttempts++;own.finishHits++;own.normalFinishes++;
  removeCups(side,[...match.sides[side].cups]);checkWin();return;
 }
 if(match.sides[side].cups.length===1){removeCups(side,[c]);checkWin();return}
 if(match.round.length<2){render();return}
 finishRegularThrows();
}
function missShot(){
 if(!match||match.finished||match.pending||match.islandChoice||isComTurn()||match.awaitingTrick)return;
 snapshot();match.sides[match.turn].shots++;if(ui.islandActive)match.sides[match.turn].islandAttempts++;if(match.sides[boardIndex()].cups.length===1)match.sides[match.turn].finishAttempts++;if(match.bonusPhase)match.sides[match.turn].trickAttempts++;
 if(match.bonusPhase){finishTrick();return}
 const island=!!ui.islandActive;ui.islandActive=false;
 if(match.comboBonusThrows>0)match.comboBonusThrows--;match.round.push({miss:true,island});
 if(match.round.length===2)finishRegularThrows();else render();
}
function resolveRound(){const r=match.round,side=boardIndex(),own=match.sides[match.turn];if(r.length!==2)return;const hits=r.filter(q=>q.cup!==undefined);if(hits.length===2&&hits[0].cup===hits[1].cup){own.bombs++;if(match.sides[side].cups.length<=4){own.finishAttempts++;own.finishHits++;own.bombFinishes++;}const c=hits[0].cup,origin=match.sides[side].positions[c];removeCups(side,[c]);if(match.sides[side].cups.length<=3){removeCups(side,[...match.sides[side].cups]);afterBomb();return}const remaining=3;if(remaining){match.pending={side,origin,remaining,allowed:[]};settleBomb();if(match.pending&&match.kind==='training'&&side===1){autoBomb();return}render();return}afterBomb();return}if(hits.length===2){own.combos++;if(match.sides[side].cups.length===2){own.finishAttempts++;own.finishHits++;own.comboFinishes++;}match.comboActive=true;match.comboBonusThrows=2;ui.rerack=false;removeCups(side,hits.map(q=>q.cup));match.round=[];if(checkWin())return;render();if(isComTurn())setTimeout(computerTurn,300);return}if(hits.length)removeCups(side,[hits[0].cup]);afterNormalRound()}
function afterBomb(){if(checkWin())return;match.round=[];match.bonus=false;match.comboActive=true;match.comboBonusThrows=2;ui.rerack=false;render();if(isComTurn())setTimeout(computerTurn,350)}
function afterNormalRound(){
 if(checkWin())return;
 match.round=[];
 startNextTrick();
}
function checkWin(){
 if(match.sides[0].cups.length&&match.sides[1].cups.length)return false;
 ui.trickFlash=null;clearTimeout(trickFlashTimer);match.finished=true;match.winner=match.sides[0].cups.length===0&&match.sides[1].cups.length===0?[match.a,match.b][match.turn]:(match.sides[0].cups.length===0?match.b:match.a);
 match.round=[];match.pending=null;match.islandChoice=null;match.islandQueue=[];ui.islandActive=false;match.bonus=false;match.tricks=0;match.bonusPhase=false;match.awaitingTrick=false;
 render();return true;
}
function endRound(){
 if(checkWin())return;
 match.round=[];match.islandChoice=null;match.islandQueue=[];ui.islandActive=false;match.bonus=false;match.tricks=0;match.bonusPhase=false;match.bonusType=null;match.awaitingTrick=false;
 match.turn=1-match.turn;match.sides[match.turn].turns++;match.comboActive=false;match.comboBonusThrows=0;ui.rerack=false;render();
 if(isComTurn())setTimeout(computerTurn,500);
}
function autoBomb(){
 while(match.pending){
  const p=match.pending,c=p.allowed[Math.floor(Math.random()*p.allowed.length)];
  if(c===undefined)break;
  removeCups(p.side,[c]);p.remaining--;
  if(p.remaining<=0||!match.sides[p.side].cups.length){match.pending=null;afterBomb();break;}
  settleBomb();
 }
 render();
}
function requestTrick(){
 if(!match||match.finished||match.pending||isComTurn()||match.bonusPhase||match.awaitingTrick||match.round.length>=2)return;
 snapshot();match.tricks=(match.tricks||0)+1;
 // Der zurückgekommene Ball ist ein Fehlwurf; der Zusatzwurf erfolgt erst nach beiden Normalwürfen.
 match.sides[match.turn].shots++;if(match.sides[boardIndex()].cups.length===1)match.sides[match.turn].finishAttempts++;if(match.comboBonusThrows>0)match.comboBonusThrows--;match.round.push({miss:true,returned:true});
 if(match.round.length===2)resolveRound();else render();
}
function chooseComTrick(i){if(!match?.awaitingTrick||i<0||i>=trickNames.length)return;snapshot();match.awaitingTrick=false;match.bonusType=i;match.bonusPhase=true;showTrickFlash(trickNames[i]);render();setTimeout(computerTurn,650)}
function computerTurn(){
 if(!isComTurn()||match.finished||match.pending||match.awaitingTrick)return;
 if(match.bonusPhase){
  snapshot();
  const p=COM_TRICK[match.difficulty]*trickFactors[match.bonusType];
  const target=match.sides[0];match.sides[1].shots++;match.sides[1].trickAttempts++;if(target.cups.length===1)match.sides[1].finishAttempts++;
  if(Math.random()<p&&target.cups.length){
   match.sides[1].hits++;match.sides[1].trickHits++;if(target.cups.length===1){match.sides[1].finishHits++;match.sides[1].normalFinishes++;}
   const c=target.cups[Math.floor(Math.random()*target.cups.length)];removeCups(0,[c]);
  }
  finishTrick();return;
 }
 if(canComRerack()&&Math.random()<COM_RERACK[match.difficulty]){
  const n=match.sides[0].cups.length;applyRerack(0,Math.floor(Math.random()*(variantNames[n]?.length||1)),false);
 }
 const p=COM_HIT[match.difficulty];const s=match.sides[1];snapshot();s.shots++;if(match.sides[0].cups.length===1)s.finishAttempts++;if(match.comboBonusThrows>0)match.comboBonusThrows--;
 if(Math.random()<.05){
  match.tricks=(match.tricks||0)+1;match.round.push({miss:true,returned:true});
 }else if(Math.random()<p&&match.sides[0].cups.length){
  s.hits++;if(match.sides[0].cups.length===1){s.finishHits++;s.normalFinishes++;}const target=match.sides[0],c=target.cups[Math.floor(Math.random()*target.cups.length)];
  match.round.push({side:0,cup:c});
  if(target.cups.length===1){if(match.round.length===1&&!match.comboActive)match.halfTurnWinner=1;removeCups(0,[c]);checkWin();return}
 }else match.round.push({miss:true});
 if(match.round.length===2)resolveRound();else{render();setTimeout(computerTurn,550)}
}
function canComRerack(){if(!match||match.kind!=='training'||match.turn!==1||match.finished||match.pending||match.round.length||match.comboActive||match.comboBonusThrows>0||match.bonusPhase||match.awaitingTrick)return false;const s=match.sides[0];return !s.reracked&&s.cups.length>=2&&s.cups.length<=6}
function canRerack(){if(match?.kind==='league')return false;if(!match||match.finished||match.pending||match.islandChoice||ui.islandActive||match.round.length!==0||match.comboActive||match.comboBonusThrows>0||match.bonusPhase||match.awaitingTrick||isComTurn())return false;const s=match.sides[boardIndex()];return !s.reracked&&s.cups.length>=2&&s.cups.length<=6}
function showRerack(){if(match?.kind==='league'||!canRerack())return;ui.rerack=true;render()}
function formationPreview(n,v,side){
 const coords=formationCoords(n,v);
 return `<svg viewBox="0 0 190 130" aria-hidden="true">${coords.map(q=>`<circle cx="${95+(q.x-145)*.8}" cy="${side===1?130-(13+(q.y-(206-3*46))*.68):13+(q.y-(206-3*46))*.68}" r="15" fill="${side===1?'#d64b52':'#377fe5'}" stroke="#f6f7fb" stroke-width="3"/>`).join('')}</svg>`;
}
function rerackPanel(){const side=boardIndex(),n=match.sides[side].cups.length;return `<div class="rerack-backdrop" onclick="if(event.target===this)closeRerack()"><div class="panel rerack-panel" role="dialog" aria-modal="true" aria-label="Formation auswählen"><h3>🔄 Formation auswählen</h3><div class="formation-grid">${(variantNames[n]||[]).map((_,i)=>`<button class="formation-choice" onclick="applyRerack(${side},${i},true)" aria-label="Formation ${i+1}">${formationPreview(n,i,side)}</button>`).join('')}</div>${btn('Abbrechen','closeRerack()','secondary')}</div></div>`}
function closeRerack(){ui.rerack=false;render()}
function applyRerack(side,v,redraw=true){if(match?.kind==='league')return;if(!match||side!==boardIndex())return;const s=match.sides[side],n=s.cups.length;if(s.reracked||n<2||n>6||match.round.length||(isComTurn()? !canComRerack():!canRerack()))return;const positions=formationCoords(n,v);s.positions={};s.cups.forEach((c,i)=>s.positions[c]=positions[i]);s.reracked=true;ui.rerack=false;if(redraw)render()}
function deathCup(){if(!match||match.kind==='training'||match.finished||match.pending)return;ui.deathCup=true;render()}
function cancelDeathCup(){ui.deathCup=false;render()}
function chooseDeathCupWinner(side){
 if(!match||!ui.deathCup||match.finished||![0,1].includes(side))return;
 snapshot();match.finished=true;match.winner=[match.a,match.b][side];match.round=[];match.pending=null;match.islandChoice=null;match.islandQueue=[];ui.islandActive=false;match.bonus=false;match.tricks=0;match.bonusPhase=false;match.awaitingTrick=false;match.comboActive=false;
 ui.deathCup=false;render();
}
function ownGoal(){if(!match||match.kind==='training'||match.finished||match.pending)return;ui.ownGoal=true;ui.rerack=false;render()}
function cancelOwnGoal(){ui.ownGoal=false;render()}
function discardFinishedMatch(){if(!match?.finished)return;match=null;go('home')}
function cancelMatch(){if(!match)return go('home');showAppConfirm('Spiel wirklich verlassen? Nicht gespeicherte Daten gehen verloren.',()=>{match=null;go('home')})}
async function finishMatch(){
 if(!match?.finished||cloudSaving)return;
 if(match.kind==='league'){
  const l=db.leagues.find(x=>x.id===match.ref?.league);
  if(!l||plCurrentNight(l)!==match.ref.night||plGame(l,match.ref.night,match.ref.stage)){
   showAppAlert('Diese Begegnung wurde bereits abgeschlossen oder ist gesperrt.');return;
  }
 }
 const g={id:match.id,date:new Date().toISOString(),a:match.a,b:match.b,winner:match.winner,kind:match.kind,ref:match.ref,sides:match.sides.map((s,i)=>({remaining:s.cups.length,shots:s.shots,hits:s.hits,bombs:s.bombs,combos:s.combos,turns:s.turns-(match.halfTurnWinner===i?.5:0),trickAttempts:s.trickAttempts,trickHits:s.trickHits,islandAttempts:s.islandAttempts,islandHits:s.islandHits,finishAttempts:s.finishAttempts,finishHits:s.finishHits,normalFinishes:s.normalFinishes,comboFinishes:s.comboFinishes,bombFinishes:s.bombFinishes}))};
 if(g.kind==='friendly'||g.kind==='league'){
  cloudSaving=true;render();
  try{if(g.kind==='league')await savePlOnline(g);else await saveFriendlyOnline(g);}
  catch(e){cloudSaving=false;render();showAppAlert('Online-Speichern fehlgeschlagen: '+(e.message||'Unbekannter Fehler')+'\nDas Spiel ist noch offen. Bitte erneut versuchen.');return;}
  cloudSaving=false;
 }
 if(g.kind==='league'){match=null;go('league');return;}
 if(g.kind==='training'){
  if(match.winner===match.a){
   const old=db.record[match.a]??-1;
   db.record[match.a]=Math.max(old,match.difficulty);
   save();
   if(db.record[match.a]>old){
    // Der lokale Rekord bleibt auch bei einem kurzfristigen Netzfehler erhalten.
    try{await syncComRecord(db.record[match.a]);}
    catch(e){console.warn('COM-Rekord noch nicht online:',e);}
   }
  }
 }else{
  if(!db.games.some(x=>x.id===g.id))db.games.push(g);
  if(g.kind==='league'){
   const l=db.leagues.find(l=>l.id===match.ref.league);
   if(l){
    if(!l.games.includes(g.id))l.games.push(g.id);
    if(match.ref.night===16&&plGame(l,16,'final16')&&plGame(l,16,'third'))l.closed=true;
   }
  }
 }
 save();match=null;go(g.kind==='training'?'home':g.kind==='league'?'league':'stats');
}
function league(){if(!plLoaded&&!plLoading&&!plError)setTimeout(()=>loadPlOnline(),0);const l=db.leagues.filter(x=>x.online).find(x=>!x.closed);return (plError?`<div class="notice">Online-Fehler: ${esc(plError)} ${btn('Erneut versuchen','refreshPlOnline()','secondary')}</div>`:plLoading?'<p class="muted">Premier League wird geladen …</p>':'')+ `<div class="section row between"><h2>🏆 Premier League</h2></div>${!l?`<div class="panel"><h3>Keine aktive Saison</h3><p class="muted">15 Nights und Finalabend.</p>${onlineNavRole==='admin'?btn('Saison erstellen','createLeagueForm()'):''}</div>`:leagueDetail(l)}<div class="section"><h2>Saisonarchiv</h2></div>${db.leagues.filter(x=>x.online&&x.closed).map(x=>`<div class="panel"><strong>${esc(x.title)}</strong> ${btn('Ansehen',`showArchived('${x.id}')`,'secondary')}</div>`).join('')||'<p class="muted">Noch keine abgeschlossenen Saisons.</p>'}`}
function createLeagueForm(){if(onlineNavRole!=='admin')return showAppAlert('Nur der Administrator kann eine Saison erstellen.');if(db.leagues.some(l=>l.online&&!l.closed))return showAppAlert('Es läuft bereits eine Saison.');renderLeagueForm()}
function renderLeagueForm(){
 const ps=db.players.filter(p=>p.onlineId&&!p.isDeleted);
 const choices=ps.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
 document.getElementById('app').innerHTML=`<div class="shell">${header()}<div class="panel"><h2>Neue Premier League</h2><div class="field"><label>Saisonname</label><input id="seasonName" value="Premier League ${new Date().getFullYear()}"></div>${[0,1,2,3].map(i=>`<div class="field"><label>Spieler ${i+1}</label><select id="slot${i}"><option value="">Bitte wählen</option>${choices}</select></div>`).join('')}${btn('Saison starten','createPlOnline()')} ${btn('Abbrechen',"go('league')",'secondary')}</div></div>`;
}
function createLeague(){
 if(!isAdmin()||activeLeague())return;
 const participants=[0,1,2,3].map(i=>document.getElementById('slot'+i)?.value);
 if(participants.some(x=>!x)||new Set(participants).size!==4)return showAppAlert('Vier verschiedene registrierte Spieler auswählen.');
 if(participants.some(pid=>!player(pid)||player(pid).isDeleted))return showAppAlert('Ungültiger Spieler.');
 const title=document.getElementById('seasonName').value.trim()||'Premier League';
 db.leagues.push({id:id(),title,participants,created:new Date().toISOString(),games:[],closed:false});save();go('league');
}
const PL_PAIRS=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];
function plPairs(l,n){return PL_PAIRS[(n-1)%3].map(pair=>pair.map(i=>l.participants[i]));}
function plGame(l,n,stage){return nightGames(l,n).find(g=>g.ref?.stage===stage)}
function plCurrentNight(l){for(let n=1;n<=15;n++)if(!nightResult(l,n))return n;return 16;}
function plResultLine(g){const w=g.winner===g.a?0:1,loser=1-w;return `<span class="badge">🔒 ${esc(name(g.winner))} ${g.sides[w].remaining}:0 ${esc(name(loser===0?g.a:g.b))}</span>`;}
function startPlGame(lid,n,stage,a,b){
 const l=db.leagues.find(x=>x.id===lid);
 if(!l||!l.online||l.closed||plCurrentNight(l)!==n||plGame(l,n,stage))return showAppAlert('Diese Begegnung ist gesperrt.');
 if(!onlineUserId||!l.participants.some(p=>plOnlineId(p)===onlineUserId))return showAppAlert('Nur Saisonspieler dürfen PL-Begegnungen spielen.');
 if(n<=15){
  const pairs=plPairs(l,n);
  if(stage==='semi1'||stage==='semi2'){
   const expected=pairs[stage==='semi1'?0:1];
   if(a!==expected[0]||b!==expected[1])return;
  }else if(stage==='final'){
   const x=plGame(l,n,'semi1'),y=plGame(l,n,'semi2');
   if(!x||!y||a!==x.winner||b!==y.winner)return;
  }else return;
 }else{
  const rows=leagueStandings(l),expected=stage==='final16'?[rows[0].pid,rows[1].pid]:stage==='third'?[rows[2].pid,rows[3].pid]:[];
  if(a!==expected[0]||b!==expected[1])return;
  // Platz 1 bzw. 3 beginnt und spielt ROT.
  beginMatch(a,b,'league',{league:lid,night:n,stage},0);return;
 }
 startMatch(a,b,'league',{league:lid,night:n,stage});
}
function leagueGames(l){return l.games.map(i=>db.games.find(g=>g.id===i)).filter(Boolean)}
function nightGames(l,n){return leagueGames(l).filter(g=>g.ref?.night===n)}
function nightResult(l,n){const gs=nightGames(l,n),final=gs.find(g=>g.ref.stage==='final');return final?{winner:final.winner,runner:final.a===final.winner?final.b:final.a}:null}
function leagueStandings(l){const ps=l.participants.map(pid=>({pid,points:0,nights:0,diff:0,bombs:0,combos:0,wins:0,losses:0,shots:0,hits:0,turns:0,cups:0,trickAttempts:0,trickHits:0,islandAttempts:0,islandHits:0,finishAttempts:0,finishHits:0}));for(let n=1;n<=15;n++){const result=nightResult(l,n);if(result){ps.find(x=>x.pid===result.winner).points+=5;ps.find(x=>x.pid===result.winner).nights++;ps.find(x=>x.pid===result.runner).points+=2}}for(const g of leagueGames(l)){for(let i=0;i<2;i++){const pid=i===0?g.a:g.b,x=ps.find(p=>p.pid===pid);if(!x)continue;const side=g.sides[i],opp=g.sides[1-i];x.diff+=side.remaining-opp.remaining;x.bombs+=Number(side.bombs)||0;x.combos+=Number(side.combos)||0;x.shots+=Number(side.shots)||0;x.hits+=Number(side.hits)||0;x.turns+=Number(side.turns)||0;x.cups+=10-(Number(opp.remaining)||0);
 for(const k of ['trickAttempts','trickHits','islandAttempts','islandHits','finishAttempts','finishHits'])x[k]+=Number(side[k])||0;if(g.winner===pid)x.wins++;else x.losses++}}return ps.sort((a,b)=>b.points-a.points||b.nights-a.nights||b.diff-a.diff||b.bombs-a.bombs)}
function leagueDetail(l){const standings=leagueStandings(l);const next=plCurrentNight(l);const done=nightGames(l,Math.min(next,16));return `<div class="hero"><div class="eyebrow">Saison ${esc(l.title)}</div><h1>${l.closed?'Saison abgeschlossen 👑':`Night ${next<=15?next:'16 · Finalabend'}`}</h1><p>${esc(l.participants.map(name).join(' · '))}</p></div><div class="panel"><h3>Rangliste · reguläre Saison</h3>${standingsTable(standings,l)}</div>${!l.closed?`<div class="panel"><h3>${next<=15?`Night ${next} · Halbfinals & Finale`:'Night 16 · Finalabend'}</h3>${next<=15?regularNight(l,next):finalNight(l)}</div>`:`<div class="panel"><h3>👑 Champion: ${esc(name(champion(l)))}</h3></div>`}<div class="panel"><h3>Alle Spielabende</h3>${Array.from({length:16},(_,i)=>{const gs=nightGames(l,i+1);return gs.length?`<details><summary>${i===15?'Finalabend':`Night ${i+1}`} · ${gs.length} Spiele</summary>${gs.map(g=>`<p>${esc(name(g.a))} ${g.sides[0].remaining} : ${g.sides[1].remaining} ${esc(name(g.b))} · Sieger: ${esc(name(g.winner))}</p>`).join('')}</details>`:''}).join('')||'<p class="muted">Noch keine Spiele erfasst.</p>'}</div>`}
function plPlayerDetail(lid,pid){
 const l=db.leagues.find(x=>x.id===lid&&x.online);if(!l||!l.participants.includes(pid))return showAppAlert('Spieler nicht in dieser Saison.');
 ui.plDetail={lid,pid};view='plPlayerDetail';render();
}
function plPlayerStats(){
 const {lid,pid}=ui.plDetail||{},l=db.leagues.find(x=>x.id===lid&&x.online);
 if(!l)return '<div class="notice">Saison nicht gefunden.</div>';
 const x=leagueStandings(l).find(x=>x.pid===pid);if(!x)return '<div class="notice">Spieler nicht gefunden.</div>';
 const p=player(pid),games=leagueGames(l).filter(g=>g.a===pid||g.b===pid);
 let bestWin=null,bestLoss=null,turns=0,cups=0,normalFinishes=0,comboFinishes=0,bombFinishes=0;
 for(const g of games){
  const isA=g.a===pid,side=g.sides[isA?0:1],opp=g.sides[isA?1:0],t=Number(side?.turns)||0;
  normalFinishes+=Number(side?.normalFinishes)||0;comboFinishes+=Number(side?.comboFinishes)||0;bombFinishes+=Number(side?.bombFinishes)||0;
  if(t>0){const c=10-(Number(opp?.remaining)||0),avg=c/t;
   turns+=t;cups+=c;
   const r={avg,opponent:name(isA?g.b:g.a),date:g.date};
   if(g.winner===pid){if(!bestWin||avg>bestWin.avg)bestWin=r;}
   else if(!bestLoss||avg>bestLoss.avg)bestLoss=r;
  }
 }
 const row=(a,b)=>`<tr><td>${esc(a)}</td><td><strong>${esc(String(b))}</strong></td></tr>`;
 const card=(title,items,open=false)=>`<details class="panel" ${open?'open':''}><summary><strong>${title}</strong></summary><div class="table-wrap"><table class="table"><tbody>${items}</tbody></table></div></details>`;
 const rec=r=>r?`${r.avg.toFixed(2)} · gegen ${esc(r.opponent)} · ${new Date(r.date).toLocaleDateString('de-CH')}`:'–';
 const diff=(x.diff>0?'+':'')+x.diff;
 const me=db.players.find(p=>p.onlineId===onlineUserId);
 const myPid=me?.id;
 const versus=myPid&&myPid!==pid?games.filter(g=>g.a===myPid||g.b===myPid):[];
 const myWins=versus.filter(g=>g.winner===myPid).length;
 const duel=myPid&&myPid!==pid?card('⚔️ Direktvergleich · Du gegen '+esc(name(pid)),
  row('Spiele gegeneinander',versus.length)+row('Deine Siege',myWins)+row('Deine Niederlagen',versus.length-myWins)+row('Deine Siegquote',formatPct(myWins,versus.length)),true):'';
 return `<div class="stats-back-row">${btn('← Zur Premier League',"go('league')",'secondary')}</div><div class="section player-stats-intro"><h2 class="player-stats-heading">${p?`<button class="stats-avatar-zoom" onclick="openStatsPhoto('${p.id}')" aria-label="Profilbild vergrössern">${avatar(p.id)}</button>`:''}<span>${esc(name(pid))}</span></h2>${p?.status?`<p class="player-stats-status">${esc(p.status)}</p>`:''}<p class="muted">${esc(l.title)} · ${x.points} Punkte · ${x.nights} gewonnene Nights</p></div>`+duel+
 card('🏆 Premier League',row('Punkte',x.points)+row('Gewonnene Nights',x.nights)+row('Spiele',x.wins+x.losses)+row('Siege',x.wins)+row('Niederlagen',x.losses),true)+
 card('🏆 Average',row('Gesamt-AVG',formatAvg(cups,turns))+row('Höchster Winning-AVG',rec(bestWin))+row('Höchster Losing-AVG',rec(bestLoss)),true)+
 card('🎯 Wurfstatistik',row('Geworfene Bälle',x.shots)+row('Treffer',x.hits)+row('Trefferquote',formatPct(x.hits,x.shots))+row('Trickshot-Versuche',x.trickAttempts)+row('Trickshot-Trefferquote',formatPct(x.trickHits,x.trickAttempts)))+
 card('🏁 Finishstatistik',row('Finishversuche',x.finishAttempts)+row('Erfolgreiche Finishes',x.finishHits)+row('Finishquote',formatPct(x.finishHits,x.finishAttempts))+row('Normale Finishes',normalFinishes)+row('Kombifinishes',comboFinishes)+row('Bombenfinishes',bombFinishes))+
 card('💣 Spezialstatistik',row('Bomben',x.bombs)+row('Kombinationen',x.combos)+row('Island-Versuche',x.islandAttempts)+row('Island-Treffer',x.islandHits)+row('Island-Trefferquote',formatPct(x.islandHits,x.islandAttempts))+row('Becherdifferenz',diff));
}
function standingsTable(rows,detailLeague=null){return `<style>
/* PL tables have SIX columns, unlike the four-column player stats. */
.pl-standings{width:100%;table-layout:fixed;border-collapse:collapse}
.pl-standings th:first-child,.pl-standings td:first-child{width:7%;text-align:left}
.pl-standings th:nth-child(2),.pl-standings td:nth-child(2){width:35%;text-align:left}
.pl-standings th:nth-child(n+3),.pl-standings td:nth-child(n+3){width:14.5%;text-align:center}
.pl-standings td,.pl-standings th{padding:9px 4px}
.pl-standings .stats-player-link{display:flex;gap:7px;align-items:center;max-width:100%;min-width:0;width:100%;}
.pl-standings .stats-player-link .avatar{width:30px;height:30px;flex:0 0 30px}
.pl-standings .stats-player-link span:last-child{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;overflow-wrap:normal}
@media(max-width:520px){
 .pl-standings th,.pl-standings td{padding:8px 2px;font-size:11px}
 .pl-standings th:first-child,.pl-standings td:first-child{width:6%}
 .pl-standings th:nth-child(2),.pl-standings td:nth-child(2){width:34%}
 .pl-standings th:nth-child(n+3),.pl-standings td:nth-child(n+3){width:15%}
 .pl-standings .stats-player-link{gap:4px;font-size:11px}
 .pl-standings .stats-player-link .avatar{width:23px;height:23px;flex-basis:23px}
}
</style><div class="table-wrap"><table class="table compact-stats pl-standings"><thead><tr><th>#</th><th>Spieler</th><th>Pkt.</th><th>Nights</th><th>+/-</th><th>💣</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${i+1}</td><td>${detailLeague?`<button class="stats-player-link" onclick="plPlayerDetail('${detailLeague.id}','${x.pid}')">${avatar(x.pid)}<span>${esc(name(x.pid))}</span></button>`:`<span class="stats-player-link">${avatar(x.pid)}<span>${esc(name(x.pid))}</span></span>`}</td><td><strong>${x.points}</strong></td><td>${x.nights}</td><td>${x.diff>0?'+':''}${x.diff}</td><td>${x.bombs}</td></tr>`).join('')}</tbody></table></div>`}
function regularNight(l,n){
 const pairs=plPairs(l,n);
 const semi=pairs.map((pair,i)=>{
  const stage='semi'+(i+1),g=plGame(l,n,stage);
  return `<div class="panel"><strong>Halbfinale ${i+1}</strong><p>${esc(name(pair[0]))} – ${esc(name(pair[1]))}</p>${g?plResultLine(g):btn('Spielen',`startPlGame('${l.id}',${n},'${stage}','${pair[0]}','${pair[1]}')`)}</div>`;
 }).join('');
 const a=plGame(l,n,'semi1'),b=plGame(l,n,'semi2'),fin=plGame(l,n,'final');
 return semi+`<div class="panel"><strong>Finale</strong><p>${a&&b?esc(name(a.winner))+' – '+esc(name(b.winner)):'Wartet auf beide Halbfinals'}</p>${fin?plResultLine(fin):a&&b?btn('Finale spielen',`startPlGame('${l.id}',${n},'final','${a.winner}','${b.winner}')`):'<span class="muted">Gesperrt</span>'}</div>`;
}
function finalNight(l){
 const rows=leagueStandings(l);
 return [['third',rows[2].pid,rows[3].pid,'Kleines Finale'],['final16',rows[0].pid,rows[1].pid,'Grosses Finale']].map(([stage,a,b,label])=>{
  const g=plGame(l,16,stage);
  return `<div class="panel"><h3>${label}</h3><p>${esc(name(a))} – ${esc(name(b))}</p>${g?plResultLine(g):btn('Spielen',`startPlGame('${l.id}',16,'${stage}','${a}','${b}')`)}</div>`;
 }).join('');
}
function champion(l){return leagueGames(l).find(g=>g.ref?.stage==='final16')?.winner}
function plDeleteSeasonConfirm(lid){
 if(onlineNavRole!=='admin')return;
 const l=db.leagues.find(x=>x.id===lid&&x.online);if(!l)return;
 showAppConfirm(`Saison "${l.title}" und alle ihre Premier-League-Ergebnisse endgültig löschen? Freundschaftsspiele bleiben erhalten.`,()=>plDeleteSeason(lid));
}
async function plDeleteSeason(lid){
 try{
  const {client}=await cloudUser();
  const {error}=await client.rpc('ruefner_pl_delete_season',{p_season:lid});
  if(error)throw error;
  plLoaded=false;await loadPlOnline(true);go('league');
 }catch(e){showAppAlert('Saison konnte nicht gelöscht werden: '+(e.message||e));}
}
function plEditMatch(gid){
 if(onlineNavRole!=='admin')return;
 const g=db.games.find(x=>x.id===gid&&x.kind==='league');if(!g)return;
 const l=db.leagues.find(x=>x.id===g.ref.league);if(!l)return;
 const finalAlreadyPlayed=g.ref.stage.startsWith('semi')&&!!plGame(l,g.ref.night,'final');
 const winnerChoices=[g.a,g.b].map(pid=>`<option value="${esc(pid)}" ${g.winner===pid?'selected':''}>${esc(name(pid))}</option>`).join('');
 const fields=['remaining','shots','hits','turns','bombs','combos','trickAttempts','trickHits','islandAttempts','islandHits','finishAttempts','finishHits','normalFinishes','comboFinishes','bombFinishes'];
 const inputs=g.sides.map((side,i)=>`<div class="panel"><h3>${esc(name(i===0?g.a:g.b))}</h3>${fields.map(k=>`<div class="field"><label>${esc(k)}</label><input type="number" min="0" max="${k==='remaining'?10:9999}" id="pl_${i}_${k}" value="${Number(side[k])||0}"></div>`).join('')}</div>`).join('');
 ui.plEdit=gid;
 document.getElementById('app').innerHTML=`<div class="shell">${header()}<h2>PL-Begegnung bearbeiten</h2><p>${esc(l.title)} · Night ${g.ref.night}</p><div class="panel"><label>Sieger</label><select id="pl_winner" ${finalAlreadyPlayed?'disabled':''}>${winnerChoices}</select>${finalAlreadyPlayed?'<p class="muted">Nach einem gespielten Finale kann der Halbfinalsieger nicht geändert werden.</p>':''}</div>${inputs}${btn('Änderungen speichern',`plSaveMatchEdit('${gid}')`)} ${btn('Abbrechen',"go('league')",'secondary')}</div>`;
}
async function plSaveMatchEdit(gid){
 if(onlineNavRole!=='admin')return;
 const g=db.games.find(x=>x.id===gid&&x.kind==='league');if(!g)return;
 const fields=['remaining','shots','hits','turns','bombs','combos','trickAttempts','trickHits','islandAttempts','islandHits','finishAttempts','finishHits','normalFinishes','comboFinishes','bombFinishes'];
 const sides=g.sides.map((side,i)=>({...side,...Object.fromEntries(fields.map(k=>[k,Number(document.getElementById('pl_'+i+'_'+k)?.value)]))}));
 if(sides.some(x=>fields.some(k=>!Number.isInteger(x[k])||x[k]<0||x[k]>(k==='remaining'?10:9999))))return showAppAlert('Ungültige Statistikwerte.');
 if(sides.some(x=>x.hits>x.shots||x.islandHits>x.islandAttempts||x.trickHits>x.trickAttempts||x.finishHits>x.finishAttempts))return showAppAlert('Treffer dürfen Versuche nicht übersteigen.');
 const winner=document.getElementById('pl_winner').value;
 const wi=winner===g.a?0:1;
 if(sides[wi].remaining<1||sides[1-wi].remaining!==0)return showAppAlert('Der Gewinner muss mindestens einen Becher und der Verlierer null Becher haben.');
 try{
  const {client}=await cloudUser();
  const {error}=await client.rpc('ruefner_pl_edit_match',{p_match:gid,p_winner:plOnlineId(winner),p_side_a:sides[0],p_side_b:sides[1]});
  if(error)throw error;
  plLoaded=false;await loadPlOnline(true);go('league');
 }catch(e){showAppAlert('Bearbeitung fehlgeschlagen: '+(e.message||e));}
}
function showArchived(i){const l=db.leagues.find(x=>x.id===i);if(!l)return;ui.archive=i;document.getElementById('app').innerHTML=`<div class="shell">${header()}${btn('← Zurück',"go('league')",'secondary')}${leagueDetail(l)}</div>`}
function historyPage(){return `<h2>Spiele</h2>${db.games.map(g=>`<div class="panel">${esc(name(g.a))} gegen ${esc(name(g.b))} · ${esc(name(g.winner))} gewinnt</div>`).join('')}`}
// Die lokale PL-Statistik bleibt sichtbar; lokale Freundschaftsspiele nicht.
function leagueStatsOverview(){
 if(!plLoaded&&!plLoading&&!plError)setTimeout(()=>loadPlOnline(),0);const leagues=db.leagues.filter(l=>l.online);
 if(!leagues.length)return `<div class="section"><h2>🏆 Premier-League-Statistik</h2></div><div class="panel"><p class="muted">Noch keine Premier-League-Saison vorhanden.</p></div>`;
 return `<div class="section"><h2>🏆 Premier-League-Statistik</h2></div>`+leagues.map(l=>{
  const standings=leagueStandings(l).filter(x=>!player(x.pid)?.isDeleted);
  return `<div class="panel"><h3>${esc(l.title)} ${l.closed?'· Abgeschlossen':'· Aktiv'}</h3>${standingsTable(standings)}</div>`;
 }).join('');
}
function stats(){
 // Online-Freundschaftsspiele sind die einzige Quelle für die gemeinsame Rangliste.
 // Lokale Trainingsergebnisse bleiben privat; die Premier League wird separat online angebunden.
 return `${periodControls()}${cloudStatsTable()}${leagueStatsOverview()}<div class="section"><h2>🤖 Höchster besiegter Rüfner 3000</h2></div><div class="panel">${db.players.filter(p=>!p.isDeleted).map(p=>`<p>${esc(p.name)}: <strong>${COM_NAMES[db.record[p.id]]||'Noch keiner'}</strong></p>`).join('')}</div>`;
}
function rules(){const sections=[['Aufstellen','10 Becher in Pyramidenform (4–3–2–1), mittig und ca. 10 cm von der Tischkante.'],['Anspiel','Ein Team beginnt mit zwei Würfen. Bei Uneinigkeit: Schere, Stein, Papier.'],['Werfen','Pro Team zwei Bälle pro Runde. Der Ellenbogen bleibt hinter der Tischkante.'],['Abwehren','Nicht direkte Würfe dürfen abgewehrt werden; direkte Würfe nicht. Bälle im Becher dürfen nicht herausgeblasen werden.'],['Kombinationen','Zwei unterschiedliche Becher: beide weg und zwei neue Würfe. Derselbe Becher: Bombe, dieser und drei nächstgelegene Becher weg, danach zwei neue Würfe.'],['Trickshot','Kommt der Ball ohne Fremdeinwirkung über die Tischmitte zurück, gibt es einen Trickshot.'],['Death Cup','Treffer in einen bereits getroffenen, aber noch stehenden Becher beendet das Spiel sofort.'],['Eigentor & umfallende Becher','Eigentore und umgefallene Becher haben eigene Strafregeln.'],['Island','Steht ein gegnerischer Becher allein, darf vor dem Wurf Island angesagt werden. Treffer: Gegner wählt einen zusätzlichen Becher zum Entfernen. Fehlwurf oder falscher Becher: ein eigener Becher wird entfernt. Island kann mit Kombinationen und Bomben kombiniert werden.'],['Zusammenstellen','Einmal pro Spiel, zu Beginn eines regulären eigenen Wurfs – niemals während einer Kombination oder ihrer Zusatzwürfe. Bei 6 Bechern grosse Pyramide; 5 Full House (3 Varianten); 4 Vagina; 3 kleine Pyramide; 2 Paar (3 Varianten).'],['Trinken','Getroffene Becher werden ausgetrunken; die Originalregeln enthalten zusätzliche Zeit- und Strafbestimmungen.']];return `<div class="section"><h2>📖 Rüfner Beer Pong Reglement</h2><p class="muted">Kurzübersicht. Das vollständige Originaldokument liegt der App bei.</p></div>${sections.map(([h,p])=>`<details><summary>${h}</summary><p>${p}</p></details>`).join('')}<div class="panel"><a class="btn" style="display:inline-block;text-decoration:none" href="reglement.pdf" target="_blank" rel="noopener">📄 Vollständiges Reglement (PDF)</a></div>`}
window.history.replaceState({ruefnerView:'home'},'','#home');
render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js?v=37').catch(()=>{});

// V2.8: Authentifizierte Rolle steuert die Online-Navigation, nicht das lokale Host-Profil.
(async function syncOnlineNavigation(){
 try{
  const cfg=window.RUEFNER_SUPABASE;if(!cfg?.url||!cfg?.publishableKey)return;
  const client=await getCloudClient();const {data:{user}}=await client.auth.getUser();if(!user)return;
  const {data:profile,error}=await client.from('player_profiles').select('username,is_admin,is_blocked,is_deleted').eq('id',user.id).single();
  if(error||!profile||profile.is_blocked||profile.is_deleted)return;
  onlineNavRole=profile.is_admin?'admin':'player';onlineNavName=profile.username;onlineUserId=user.id;
  await loadOnlinePlayers();
  const mine=db.players.find(p=>p.onlineId===user.id&&!p.isDeleted);if(mine){db.current=mine.id;save();}
  render();
 }catch(e){/* Ohne Verbindung bleibt die Anmeldung erreichbar. */}
})();
