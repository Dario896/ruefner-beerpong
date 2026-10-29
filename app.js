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
let trickFlashTimer=null;
function showTrickFlash(label){ui.trickFlash={label,until:Date.now()+5000};clearTimeout(trickFlashTimer);trickFlashTimer=setTimeout(()=>{ui.trickFlash=null;if(view==='game')render()},5050)}
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.players&&v.games&&v.leagues)return v}catch(e){}return {players:[],games:[],leagues:[],current:null,admin:null,record:{}}}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function id(){return Math.random().toString(36).slice(2,10)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function player(i){return db.players.find(p=>p.id===i)}
function name(i){return i==='COM'?'Rüfner 3000':(player(i)?.name||'Unbekannt')}
function avatar(i){const p=player(i);return `<span class="avatar">${p?.photo?`<img src="${p.photo}" alt="">`:esc((p?.name||'🤖').slice(0,1).toUpperCase())}</span>`}
function activeLeague(){return db.leagues.find(l=>!l.closed)}
function isAdmin(){return db.current===db.admin}
function reigningChampion(){const finished=db.leagues.filter(l=>l.closed&&champion(l)).sort((a,b)=>new Date(b.created)-new Date(a.created));return finished.length?champion(finished[0]):null}
function go(v){view=v;ui={};render()}
function btn(text,fn,cls=''){return `<button class="btn ${cls}" onclick="${fn}">${text}</button>`}
function header(){return `<div class="top"><div class="brand" onclick="go('home')" style="cursor:pointer">🏓 Rüfner <span>Beer Pong</span></div><div class="row">${db.current?`<span class="pill">${esc(name(db.current))}${reigningChampion()===db.current?' 👑':''}</span>`:''}<a class="btn secondary" style="text-decoration:none" href="online.html">🔐 Online</a>${btn('☰ Menü',"go('home')",'secondary')}</div></div>`}
function render(){const root=document.getElementById('app');let body='';try{body=({home,profiles,training,friendship,league,stats,rules,game,history,firstThrow})[view]?.()||home()}catch(e){body=`<div class="notice">Fehler: ${esc(e.message)}</div>${btn('Zurück',"go('home')")}`};root.innerHTML=`<div class="shell">${header()}${body}<footer>Rüfner Beer Pong · V2.4.1 · Spielstände auf diesem Gerät lokal gespeichert</footer></div>`}
function home(){return `<section class="hero"><div class="eyebrow">Die Liga beginnt hier</div><h1>Becher. Bomben. Ruhm. 🍻</h1><p>Training gegen Rüfner 3000, echte Duelle und Premier League.</p>${db.current?`<div class="row">${avatar(db.current)}<strong>Willkommen zurück, ${esc(name(db.current))}! 🍻</strong></div>`:`<div class="notice">Erstelle zuerst ein Spielerprofil und wähle es aus.</div>`}</section><div class="grid">${[['🤖','Training','Du gegen Rüfner 3000. Privat, ohne Statistik.','training'],['🏓','Freundschaftsspiel','Echte Duelle mit gemeinsamer Statistik.','friendship'],['🏆','Premier League','15 Nights und ein grosses Finale.','league'],['📊','Statistiken','Ranglisten, Bomben und direkte Duelle.','stats'],['👤','Profile','Spieler verwalten und Profilbild ändern.','profiles'],['📖','Regeln','Das Rüfner Beer Pong Reglement.','rules']].map(a=>`<button class="card action" onclick="go('${a[3]}')"><div class="emoji">${a[0]}</div><h3>${a[1]}</h3><p>${a[2]}</p></button>`).join('')}</div>`}
function profiles(){return `<div class="section"><h2>👤 Spielerprofile</h2><p class="muted">Lokale Profile und geladene Online-Spieler. Spielstände bleiben vorerst auf diesem Gerät.</p></div><div class="panel"><h3>Neues Profil</h3><div class="field"><label>Spielername</label><input id="newName" maxlength="28" placeholder="Name"></div>${btn('Profil erstellen','createProfile()')}</div><div class="grid">${db.players.map(p=>`<div class="card"><div class="row">${avatar(p.id)}<strong>${esc(p.name)}${reigningChampion()===p.id?' 👑':''}</strong>${p.id===db.admin?'<span class="badge">Host</span>':''}</div><div class="row" style="margin-top:14px">${btn(p.id===db.current?'✓ Aktiv':'Profil auswählen',`selectProfile('${p.id}')`,p.id===db.current?'secondary':'')}${isAdmin()?btn('Name ändern',`renameProfile('${p.id}')`,'secondary'):''}</div>${p.id===db.current?`<div class="field"><label>Profilbild ändern</label><input type="file" accept="image/*" onchange="photoProfile(event,'${p.id}')"></div>`:''}</div>`).join('')}</div>`}
function createProfile(){const el=document.getElementById('newName'),n=el.value.trim();if(n.length<2)return alert('Bitte mindestens 2 Zeichen eingeben.');if(db.players.some(p=>p.name.toLowerCase()===n.toLowerCase()))return alert('Name bereits vergeben.');const p={id:id(),name:n,photo:''};db.players.push(p);if(!db.admin)db.admin=p.id;db.current=p.id;save();render()}
function selectProfile(i){db.current=i;save();render()}
function renameProfile(i){if(!isAdmin())return;const n=prompt('Neuer Name:',name(i))?.trim();if(!n)return;if(db.players.some(p=>p.id!==i&&p.name.toLowerCase()===n.toLowerCase()))return alert('Name bereits vergeben.');player(i).name=n;save();render()}
function photoProfile(e,i){const f=e.target.files?.[0];if(!f)return;if(f.size>4e6)return alert('Bitte ein Bild unter 4 MB wählen.');const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=180;const ctx=c.getContext('2d');const z=Math.min(img.width,img.height),sx=(img.width-z)/2,sy=(img.height-z)/2;ctx.drawImage(img,sx,sy,z,z,0,0,180,180);player(i).photo=c.toDataURL('image/jpeg',.7);save();render()};img.src=r.result};r.readAsDataURL(f)}
function requireProfile(){if(!db.current){go('profiles');return false}return true}
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
   .select('id,username,is_blocked').eq('is_blocked',false).order('username');
  if(error)throw error;
  if(!Array.isArray(profiles))throw Error('Keine Spielerliste erhalten.');
  let changed=false;
  for(const p of profiles){
   if(!p.id||!p.username)continue;
   const existing=db.players.find(x=>x.name.toLocaleLowerCase('de')===p.username.toLocaleLowerCase('de'));
   if(existing){
    if(existing.onlineId!==p.id){existing.onlineId=p.id;changed=true;}
   }else{
    db.players.push({id:'online-'+p.id,onlineId:p.id,name:p.username,photo:''});
    changed=true;
   }
  }
  if(changed)save();
  onlineDirectoryLoaded=true;
 }catch(e){
  onlineDirectoryError='Spielerliste konnte nicht geladen werden: '+(e.message||'Unbekannter Fehler');
 }finally{
  onlineDirectoryLoading=false;
  if(view==='friendship'||view==='profiles')render();
 }
}
function reloadOnlinePlayers(){onlineDirectoryLoaded=false;loadOnlinePlayers();}

function friendship(){
 if(!onlineDirectoryLoaded&&!onlineDirectoryLoading&&!onlineDirectoryError)setTimeout(loadOnlinePlayers,0);
 const directoryMessage=onlineDirectoryLoading?'Online-Spieler werden geladen …':onlineDirectoryError||'Online-Spieler geladen.';
 return `<div class="section"><h2>🏓 Freundschaftsspiel</h2><p class="muted">Ein Handy genügt. Die Spiele zählen derzeit zur lokalen Freundschaftsstatistik.</p></div><div class="panel"><p class="muted">${esc(directoryMessage)} ${btn('↻ Spieler aktualisieren','reloadOnlinePlayers()','secondary')}</p>${pairPicker()}${btn('Spiel starten',"startFriendly()")}</div>`;
}
function pairPicker(ids){const ps=ids||db.players.filter((p,i,arr)=>arr.findIndex(q=>q.name.toLocaleLowerCase('de')===p.name.toLocaleLowerCase('de'))===i).map(p=>p.id);return `<div class="field"><label>Spieler 1</label><select id="p1">${ps.map(p=>`<option value="${p}">${esc(name(p))}</option>`).join('')}</select></div><div class="field"><label>Spieler 2</label><select id="p2">${ps.map((p,i)=>`<option value="${p}" ${i===1?'selected':''}>${esc(name(p))}</option>`).join('')}</select></div>`}
function startTraining(){if(!requireProfile())return;startMatch(db.current,'COM','training',null,Number(document.getElementById('difficulty').value))}
function startFriendly(){if(db.players.length<2)return alert('Erstelle zuerst mindestens zwei Profile.');const a=document.getElementById('p1').value,b=document.getElementById('p2').value;if(a===b)return alert('Bitte zwei unterschiedliche Spieler wählen.');startMatch(a,b,'friendly')}
function newSide(){return {cups:Array.from({length:10},(_,i)=>i),layout:10,positions:formationCoords(10,0),reracked:false,shots:0,hits:0,bombs:0,combos:0}}
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
 beginMatch(a,b,kind,ref,difficulty,side);
}
function beginMatch(a,b,kind,ref,difficulty,firstTurn){
 match={id:id(),a,b,kind,ref,difficulty,sides:[newSide(),newSide()],turn:firstTurn,round:[],pending:null,bonus:false,comboActive:false,comboBonusThrows:0,tricks:0,bonusPhase:false,bonusType:null,awaitingTrick:false,finished:false,log:[],undo:[]};
 view='game';render();if(isComTurn())computerTurn();
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
 else{match.bonusPhase=true;match.bonusType=randomTrick();showTrickFlash(trickNames[match.bonusType]);render()}
}
function finishTrick(){
 ui.trickFlash=null;clearTimeout(trickFlashTimer);match.bonusPhase=false;match.bonusType=null;
 if(checkWin())return;
 startNextTrick();
}

function isComTurn(){return match.kind==='training'&&match.turn===1}
function isHumanTurn(){return !isComTurn()}
function boardIndex(){return 1-match.turn}
function cupBoard(sideIndex){const s=match.sides[sideIndex],target=boardIndex(),pending=match.pending?.side===sideIndex,allowed=match.pending?.allowed||[];const active=match.pending?pending:!match.finished&&isHumanTurn()&&sideIndex===target&&!match.awaitingTrick;return `<div class="cupfield ${sideIndex===1?'upper-field':'lower-field'} ${sideIndex===target?'attack-board':'defence-board'}" onclick="boardMiss(event,${sideIndex})"><div class="cups ${sideIndex===1?'board-top':'board-bottom'}">${s.cups.map(c=>{const pos=s.positions[c]||{x:145,y:115};const canTap=active&&(!pending||allowed.includes(c));return `<button class="cup ${sideIndex===1?'red':'blue'} ${pending&&allowed.includes(c)?'candidate':''} ${match.round.some(q=>q.cup===c&&q.side===sideIndex)?'pending':''}" style="left:${pos.x/290*100}%;top:${pos.y/230*100}%" ${canTap?'':'disabled'} onclick="tapCup(${sideIndex},${c});event.stopPropagation()" aria-label="Becher ${c+1}">${c+1}</button>`}).join('')}</div></div>`}
function boardMiss(e,side){if(e.target.closest('button')||side!==boardIndex()||match.pending||match.finished||!isHumanTurn()||match.awaitingTrick)return;missShot()}
function game(){
 if(!match)return `<div class="notice">Kein aktives Spiel.</div>`;
 const a=match.a,b=match.b,owner=match.turn;
 const notice=match.pending?'💣 Bombe! Wähle die markierten Becher.':match.finished?'🏆 Spiel beendet.':match.awaitingTrick?'🎩 Wähle einen Trickshot für Rüfner 3000.':match.bonusPhase?`🎩 Trickshot: ${esc(trickNames[match.bonusType])} · jetzt ausführen!${trickCount()?' · danach noch ein Trickshot':''}`:`🎯 ${esc(name([a,b][owner]))} ist dran · Wurf ${match.round.length+1} von 2${trickCount()?' · '+trickCount()+' Trickshot(s) vorgemerkt':''}`;
 const controls=`<div class="game-actions">${btn('↶','undoShot()','secondary action-icon')}${canRerack()?btn('🔄','showRerack()','secondary action-icon'):''}${!match.finished&&isHumanTurn()&&!match.pending&&!match.bonusPhase&&!match.awaitingTrick&&match.round.length<2?btn('🎩','requestTrick()','secondary action-icon'):''}${!match.finished&&match.kind!=='training'&&!match.pending?btn('💀','deathCup()','secondary action-icon')+btn('⚽','ownGoal()','secondary action-icon'):''}</div>`;
 return `<div class="game-screen"><div class="section row between game-title"><h2>${match.kind==='training'?'🤖 Training':match.kind==='league'?'🏆 Premier League':'🏓 Freundschaftsspiel'}</h2>${btn('Abbrechen','cancelMatch()','secondary')}</div><div class="notice match-notice">${notice}</div><div class="table-with-actions"><div class="matchstack"><div class="table-side-label">🔴 ${esc(name(b))} · ${match.sides[1].cups.length}</div>${cupBoard(1)}<div class="table-middle-line"></div>${cupBoard(0)}<div class="table-side-label">🔵 ${esc(name(a))} · ${match.sides[0].cups.length}</div>${controls}</div></div>${ui.rerack?rerackPanel():''}${ui.trickFlash&&Date.now()<ui.trickFlash.until?`<div class="trick-flash" role="status" aria-live="polite"><div class="trick-flash-inner"><div class="trick-flash-title">🎩 TRICKSHOT!</div><div class="trick-flash-task">${esc(ui.trickFlash.label)}</div></div></div>`:''}${match.awaitingTrick?`<div class="trick-choice-backdrop" role="dialog" aria-modal="true" aria-label="Trickshot für COM wählen"><div class="trick-choice-modal"><div class="trick-choice-title">🎩 RÜFNER 3000 TRICKSHOT!</div><p>Welchen Trickshot muss der COM machen?</p><div class="trick-choice-grid">${trickNames.map((t,i)=>`<button class="btn secondary" onclick="chooseComTrick(${i})">${esc(t)}</button>`).join('')}</div></div></div>`:''}${ui.deathCup&&!match.finished?`<div class="trick-choice-backdrop" role="dialog" aria-modal="true" aria-label="Death Cup Sieger wählen"><div class="trick-choice-modal"><div class="trick-choice-title">💀 DEATH CUP!</div><p>Wer ist der Sieger?</p><div class="trick-choice-grid">${btn('🔵 '+esc(name(match.a)),'chooseDeathCupWinner(0)')}${btn('🔴 '+esc(name(match.b)),'chooseDeathCupWinner(1)')}</div><p>${btn('Abbrechen','cancelDeathCup()','secondary')}</p></div></div>`:''}${match.finished?`<div class="panel finish-panel"><h2>🏆 ${esc(name(match.winner))} gewinnt!</h2><p class="muted">Vertippt? ↶ am Tisch macht den letzten Wurf rückgängig.</p>${btn('Ergebnis speichern','finishMatch()')}${btn('Nicht speichern','cancelMatch()','secondary')}</div>`:''}<div class="panel match-stats"><div class="row between"><span class="muted">${esc(name(a))}: ${match.sides[0].hits}/${match.sides[0].shots} Treffer · ${match.sides[0].bombs} Bomben</span><span class="muted">${esc(name(b))}: ${match.sides[1].hits}/${match.sides[1].shots} Treffer · ${match.sides[1].bombs} Bomben</span></div></div></div>`;
}
function snapshot(){match.undo.push(JSON.stringify({...match,undo:[]}));if(match.undo.length>30)match.undo.shift()}
function undoShot(){if(!match?.undo.length)return;const old=match.undo.pop(),remaining=match.undo;match=JSON.parse(old);match.undo=remaining;ui.rerack=false;render()}
function removeCups(side,cups){const s=match.sides[side];s.cups=s.cups.filter(c=>!cups.includes(c))}
function nearestCandidates(side,origin,remaining){const s=match.sides[side];if(!s.cups.length)return [];const dist=s.cups.map(c=>({c,d:(s.positions[c].x-origin.x)**2+(s.positions[c].y-origin.y)**2})).sort((a,b)=>a.d-b.d);const threshold=dist[Math.min(remaining-1,dist.length-1)].d;return dist.filter(o=>o.d<=threshold+1).map(o=>o.c)}
function tapCup(side,c){if(!match||match.finished)return;if(match.pending){if(side!==match.pending.side||!match.pending.allowed.includes(c))return;snapshot();const p=match.pending;removeCups(side,[c]);p.remaining--;if(!p.remaining||!match.sides[side].cups.length){match.pending=null;afterBomb()}else{p.allowed=p.allowed.filter(x=>match.sides[side].cups.includes(x));if(!p.allowed.length){match.pending=null;afterBomb()}}render();return}if(side!==boardIndex()||isComTurn()||match.awaitingTrick)return;snapshot();recordHit(side,c)}
function recordHit(side,c){
 const own=match.sides[match.turn];own.shots++;own.hits++;
 if(match.bonusPhase){removeCups(side,[c]);finishTrick();return}
 if(match.comboBonusThrows>0)match.comboBonusThrows--;match.round.push({side,cup:c});
 if(match.sides[side].cups.length===1){removeCups(side,[c]);checkWin();return}
 if(match.round.length<2){render();return}
 resolveRound();
}
function missShot(){
 if(!match||match.finished||match.pending||isComTurn()||match.awaitingTrick)return;
 snapshot();match.sides[match.turn].shots++;
 if(match.bonusPhase){finishTrick();return}
 if(match.comboBonusThrows>0)match.comboBonusThrows--;match.round.push({miss:true});
 if(match.round.length===2)resolveRound();else render();
}
function resolveRound(){const r=match.round,side=boardIndex(),own=match.sides[match.turn];if(r.length!==2)return;const hits=r.filter(q=>q.cup!==undefined);if(hits.length===2&&hits[0].cup===hits[1].cup){own.bombs++;const c=hits[0].cup,origin=match.sides[side].positions[c];removeCups(side,[c]);if(match.sides[side].cups.length<=3){removeCups(side,[...match.sides[side].cups]);afterBomb();return}const remaining=3;if(remaining){match.pending={side,origin,remaining,allowed:nearestCandidates(side,origin,remaining)};if(match.kind==='training'&&side===1){autoBomb();return}render();return}afterBomb();return}if(hits.length===2){own.combos++;match.comboActive=true;match.comboBonusThrows=2;ui.rerack=false;removeCups(side,hits.map(q=>q.cup));match.round=[];if(checkWin())return;render();if(isComTurn())setTimeout(computerTurn,300);return}if(hits.length)removeCups(side,[hits[0].cup]);afterNormalRound()}
function afterBomb(){if(checkWin())return;match.round=[];match.bonus=false;match.comboActive=true;match.comboBonusThrows=2;ui.rerack=false;render();if(isComTurn())setTimeout(computerTurn,350)}
function afterNormalRound(){
 if(checkWin())return;
 match.round=[];
 startNextTrick();
}
function checkWin(){
 if(match.sides[0].cups.length&&match.sides[1].cups.length)return false;
 ui.trickFlash=null;clearTimeout(trickFlashTimer);match.finished=true;match.winner=match.sides[0].cups.length===0?match.b:match.a;
 match.round=[];match.pending=null;match.bonus=false;match.tricks=0;match.bonusPhase=false;match.awaitingTrick=false;
 render();return true;
}
function endRound(){
 if(checkWin())return;
 match.round=[];match.bonus=false;match.tricks=0;match.bonusPhase=false;match.bonusType=null;match.awaitingTrick=false;
 match.turn=1-match.turn;match.comboActive=false;match.comboBonusThrows=0;ui.rerack=false;render();
 if(isComTurn())setTimeout(computerTurn,500);
}
function autoBomb(){while(match.pending){const p=match.pending,c=p.allowed[Math.floor(Math.random()*p.allowed.length)];removeCups(p.side,[c]);p.remaining--;if(!p.remaining||!match.sides[p.side].cups.length){match.pending=null;afterBomb();break}p.allowed=p.allowed.filter(x=>match.sides[p.side].cups.includes(x))}render()}
function requestTrick(){
 if(!match||match.finished||match.pending||isComTurn()||match.bonusPhase||match.awaitingTrick||match.round.length>=2)return;
 snapshot();match.tricks=(match.tricks||0)+1;
 // Der zurückgekommene Ball ist ein Fehlwurf; der Zusatzwurf erfolgt erst nach beiden Normalwürfen.
 match.sides[match.turn].shots++;if(match.comboBonusThrows>0)match.comboBonusThrows--;match.round.push({miss:true,returned:true});
 if(match.round.length===2)resolveRound();else render();
}
function chooseComTrick(i){if(!match?.awaitingTrick||i<0||i>=trickNames.length)return;snapshot();match.awaitingTrick=false;match.bonusType=i;match.bonusPhase=true;showTrickFlash(trickNames[i]);render();setTimeout(computerTurn,650)}
function computerTurn(){
 if(!isComTurn()||match.finished||match.pending||match.awaitingTrick)return;
 if(match.bonusPhase){
  snapshot();
  const p=COM_TRICK[match.difficulty]*trickFactors[match.bonusType];
  const target=match.sides[0];match.sides[1].shots++;
  if(Math.random()<p&&target.cups.length){
   match.sides[1].hits++;
   const c=target.cups[Math.floor(Math.random()*target.cups.length)];removeCups(0,[c]);
  }
  finishTrick();return;
 }
 if(canComRerack()&&Math.random()<COM_RERACK[match.difficulty]){
  const n=match.sides[0].cups.length;applyRerack(0,Math.floor(Math.random()*(variantNames[n]?.length||1)),false);
 }
 const p=COM_HIT[match.difficulty];const s=match.sides[1];snapshot();s.shots++;if(match.comboBonusThrows>0)match.comboBonusThrows--;
 if(Math.random()<.05){
  match.tricks=(match.tricks||0)+1;match.round.push({miss:true,returned:true});
 }else if(Math.random()<p&&match.sides[0].cups.length){
  s.hits++;const target=match.sides[0],c=target.cups[Math.floor(Math.random()*target.cups.length)];
  match.round.push({side:0,cup:c});
  if(target.cups.length===1){removeCups(0,[c]);checkWin();return}
 }else match.round.push({miss:true});
 if(match.round.length===2)resolveRound();else{render();setTimeout(computerTurn,550)}
}
function canComRerack(){if(!match||match.kind!=='training'||match.turn!==1||match.finished||match.pending||match.round.length||match.comboActive||match.comboBonusThrows>0||match.bonusPhase||match.awaitingTrick)return false;const s=match.sides[0];return !s.reracked&&s.cups.length>=2&&s.cups.length<=6}
function canRerack(){if(!match||match.finished||match.pending||match.round.length!==0||match.comboActive||match.comboBonusThrows>0||match.bonusPhase||match.awaitingTrick||isComTurn())return false;const s=match.sides[boardIndex()];return !s.reracked&&s.cups.length>=2&&s.cups.length<=6}
function showRerack(){if(!canRerack())return;ui.rerack=true;render()}
function formationPreview(n,v,side){
 const coords=formationCoords(n,v);
 return `<svg viewBox="0 0 190 130" aria-hidden="true">${coords.map(q=>`<circle cx="${95+(q.x-145)*.8}" cy="${13+(q.y-(206-3*46))*.68}" r="15" fill="${side===1?'#d64b52':'#377fe5'}" stroke="#f6f7fb" stroke-width="3"/>`).join('')}</svg>`;
}
function rerackPanel(){const side=boardIndex(),n=match.sides[side].cups.length;return `<div class="rerack-backdrop" onclick="if(event.target===this)closeRerack()"><div class="panel rerack-panel" role="dialog" aria-modal="true" aria-label="Formation auswählen"><h3>🔄 Formation auswählen</h3><div class="formation-grid">${(variantNames[n]||[]).map((_,i)=>`<button class="formation-choice" onclick="applyRerack(${side},${i},true)" aria-label="Formation ${i+1}">${formationPreview(n,i,side)}</button>`).join('')}</div>${btn('Abbrechen','closeRerack()','secondary')}</div></div>`}
function closeRerack(){ui.rerack=false;render()}
function applyRerack(side,v,redraw=true){if(!match||side!==boardIndex())return;const s=match.sides[side],n=s.cups.length;if(s.reracked||n<2||n>6||match.round.length||(isComTurn()? !canComRerack():!canRerack()))return;const positions=formationCoords(n,v);s.positions={};s.cups.forEach((c,i)=>s.positions[c]=positions[i]);s.reracked=true;ui.rerack=false;if(redraw)render()}
function deathCup(){if(!match||match.kind==='training'||match.finished||match.pending)return;ui.deathCup=true;render()}
function cancelDeathCup(){ui.deathCup=false;render()}
function chooseDeathCupWinner(side){
 if(!match||!ui.deathCup||match.finished||![0,1].includes(side))return;
 snapshot();match.finished=true;match.winner=[match.a,match.b][side];match.round=[];match.pending=null;match.bonus=false;match.tricks=0;match.bonusPhase=false;match.awaitingTrick=false;match.comboActive=false;
 ui.deathCup=false;render();
}
function ownGoal(){if(!match||match.kind==='training'||match.finished||match.pending)return;const side=match.turn,s=match.sides[side];if(!s.cups.length)return;const choice=prompt(`Eigentor: Welcher eigene Becher von ${name([match.a,match.b][side])}? (${s.cups.map(c=>c+1).join(', ')})`);if(choice===null)return;const c=Number(choice)-1;if(!s.cups.includes(c))return alert('Ungültiger Becher.');snapshot();removeCups(side,[c]);checkWin();render()}
function cancelMatch(){if(!confirm('Spiel wirklich verlassen? Nicht gespeicherte Daten gehen verloren.'))return;match=null;go('home')}
function finishMatch(){if(!match?.finished)return;const g={id:match.id,date:new Date().toISOString(),a:match.a,b:match.b,winner:match.winner,kind:match.kind,ref:match.ref,sides:match.sides.map(s=>({remaining:s.cups.length,shots:s.shots,hits:s.hits,bombs:s.bombs,combos:s.combos}))};if(match.kind==='training'){if(match.winner===match.a)db.record[match.a]=Math.max(db.record[match.a]??-1,match.difficulty)}else{db.games.push(g);if(match.kind==='league'){const l=db.leagues.find(l=>l.id===match.ref.league);if(l){l.games.push(g.id);if(match.ref.stage==='final16'&&l.games.filter(i=>db.games.find(g=>g.id===i)?.ref?.stage==='final16').length===2)l.closed=true}}}save();match=null;go(g.kind==='league'?'league':'stats')}
function league(){const l=activeLeague();return `<div class="section row between"><h2>🏆 Premier League</h2>${isAdmin()?btn('Neue Saison','createLeagueForm()','secondary'):''}</div>${!l?`<div class="panel"><h3>Keine aktive Saison</h3><p class="muted">15 reguläre Nights, danach das grosse Finale.</p>${isAdmin()?btn('Saison erstellen','createLeagueForm()'):''}</div>`:leagueDetail(l)}<div class="section"><h2>📚 Saisonarchiv</h2></div>${db.leagues.filter(x=>x.closed).map(x=>`<div class="panel"><div class="row between"><strong>${esc(x.title)}</strong>${btn('Ansehen',`showArchived('${x.id}')`,'secondary')}</div></div>`).join('')||'<p class="muted">Noch keine abgeschlossenen Saisons.</p>'}`}
function createLeagueForm(){if(!isAdmin())return alert('Nur der Host darf eine Saison erstellen.');if(activeLeague())return alert('Zuerst die aktive Saison abschliessen.');ui.create=true;renderLeagueForm()}
function renderLeagueForm(){const ps=db.players.filter(p=>p.id!==db.current);document.getElementById('app').innerHTML=`<div class="shell">${header()}<div class="panel"><h2>🏆 Neue Premier League</h2><div class="field"><label>Saisonname</label><input id="seasonName" value="Premier League ${new Date().getFullYear()}"></div><p>Host: ${esc(name(db.current))}</p>${[1,2,3].map(i=>`<div class="field"><label>Mitspieler ${i}</label><select id="inv${i}">${ps.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>`).join('')}${btn('Saison starten','createLeague()')} ${btn('Abbrechen',"go('league')",'secondary')}</div></div>`}
function createLeague(){if(!isAdmin())return;const participants=[db.current,...[1,2,3].map(i=>document.getElementById('inv'+i).value)];if(new Set(participants).size!==4)return alert('Bitte drei unterschiedliche Freunde auswählen.');const title=document.getElementById('seasonName').value.trim()||'Premier League';db.leagues.push({id:id(),title,participants,created:new Date().toISOString(),games:[],closed:false});save();go('league')}
function leagueGames(l){return l.games.map(i=>db.games.find(g=>g.id===i)).filter(Boolean)}
function nightGames(l,n){return leagueGames(l).filter(g=>g.ref?.night===n)}
function nightResult(l,n){const gs=nightGames(l,n),final=gs.find(g=>g.ref.stage==='final');return final?{winner:final.winner,runner:final.a===final.winner?final.b:final.a}:null}
function leagueStandings(l){const ps=l.participants.map(pid=>({pid,points:0,nights:0,diff:0,bombs:0,wins:0,losses:0,shots:0,hits:0}));for(let n=1;n<=15;n++){const result=nightResult(l,n);if(result){ps.find(x=>x.pid===result.winner).points+=5;ps.find(x=>x.pid===result.winner).nights++;ps.find(x=>x.pid===result.runner).points+=2}}for(const g of leagueGames(l)){for(let i=0;i<2;i++){const pid=i===0?g.a:g.b,x=ps.find(p=>p.pid===pid);if(!x)continue;const side=g.sides[i],opp=g.sides[1-i];x.diff+=side.remaining-opp.remaining;x.bombs+=side.bombs;x.shots+=side.shots;x.hits+=side.hits;if(g.winner===pid)x.wins++;else x.losses++}}return ps.sort((a,b)=>b.points-a.points||b.nights-a.nights||b.diff-a.diff||b.bombs-a.bombs)}
function leagueDetail(l){const standings=leagueStandings(l);const completed=Array.from({length:15},(_,i)=>nightResult(l,i+1)).filter(Boolean).length;const next=completed+1;const done=nightGames(l,Math.min(next,16));return `<div class="hero"><div class="eyebrow">Saison ${esc(l.title)}</div><h1>${l.closed?'Saison abgeschlossen 👑':`Night ${next<=15?next:'16 · Finalabend'}`}</h1><p>${esc(l.participants.map(name).join(' · '))}</p></div><div class="panel"><h3>Rangliste · reguläre Saison</h3>${standingsTable(standings)}</div>${!l.closed?`<div class="panel"><h3>${next<=15?`Night ${next} · Halbfinals & Finale`:'Night 16 · Finalabend'}</h3>${next<=15?regularNight(l,next):finalNight(l)}</div>`:`<div class="panel"><h3>👑 Champion: ${esc(name(champion(l)))}</h3></div>`}<div class="panel"><h3>📊 Liga-Spielerstatistik</h3><div class="table-wrap"><table class="table"><thead><tr><th>Spieler</th><th>Spiele</th><th>Siege</th><th>Trefferquote</th><th>💣</th></tr></thead><tbody>${standings.map(x=>`<tr><td>${esc(name(x.pid))}</td><td>${x.wins+x.losses}</td><td>${x.wins}</td><td>${x.shots?(100*x.hits/x.shots).toFixed(1)+' %':'–'}</td><td>${x.bombs}</td></tr>`).join('')}</tbody></table></div></div><div class="panel"><h3>Alle Spielabende</h3>${Array.from({length:16},(_,i)=>{const gs=nightGames(l,i+1);return gs.length?`<details><summary>${i===15?'Finalabend':`Night ${i+1}`} · ${gs.length} Spiele</summary>${gs.map(g=>`<p>${esc(name(g.a))} ${g.sides[0].remaining} : ${g.sides[1].remaining} ${esc(name(g.b))} · Sieger: ${esc(name(g.winner))}</p>`).join('')}</details>`:''}).join('')||'<p class="muted">Noch keine Spiele erfasst.</p>'}</div>`}
function standingsTable(rows){return `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Spieler</th><th>Pkt.</th><th>Nights</th><th>+/-</th><th>💣</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(name(x.pid))}</td><td><strong>${x.points}</strong></td><td>${x.nights}</td><td>${x.diff>0?'+':''}${x.diff}</td><td>${x.bombs}</td></tr>`).join('')}</tbody></table></div>`}
function regularNight(l,n){const gs=nightGames(l,n),semi=gs.filter(g=>g.ref.stage==='semi'),fin=gs.find(g=>g.ref.stage==='final');let html=gs.map(g=>`<p>✓ ${esc(name(g.a))} gegen ${esc(name(g.b))} · Sieger: <strong>${esc(name(g.winner))}</strong></p>`).join('');if(semi.length<2){const used=semi.flatMap(g=>[g.a,g.b]),avail=l.participants.filter(p=>!used.includes(p));html+=`<p class="muted">Halbfinale ${semi.length+1}</p>${isAdmin()?`<div class="row"><select id="semiA" class="select">${avail.map(p=>`<option value="${p}">${esc(name(p))}</option>`).join('')}</select><select id="semiB">${avail.map((p,i)=>`<option value="${p}" ${i===1?'selected':''}>${esc(name(p))}</option>`).join('')}</select>${btn('Match starten',`startLeagueSemi('${l.id}',${n})`)}</div>`:'<p>Host startet das Match.</p>'}`}else if(!fin){const winners=semi.map(g=>g.winner);html+=`<p>Finale: <strong>${esc(name(winners[0]))} – ${esc(name(winners[1]))}</strong></p>${isAdmin()?btn('Finale starten',`startMatch('${winners[0]}','${winners[1]}','league',{league:'${l.id}',night:${n},stage:'final'})`):''}`}else html+='<p class="badge">✓ Night abgeschlossen</p>';return html}
function startLeagueSemi(lid,n){const a=document.getElementById('semiA').value,b=document.getElementById('semiB').value;if(a===b)return alert('Bitte zwei verschiedene Spieler auswählen.');startMatch(a,b,'league',{league:lid,night:n,stage:'semi'})}
function finalNight(l){const rows=leagueStandings(l),gs=nightGames(l,16);return [['third',rows[2].pid,rows[3].pid,'Spiel um Platz 3'],['final16',rows[0].pid,rows[1].pid,'Grand Final']].map(([stage,a,b,label])=>{const g=gs.find(g=>g.ref.stage===stage);return `<div class="panel"><h3>${label}</h3><p>${esc(name(a))} ⚔️ ${esc(name(b))}</p>${g?`<span class="badge">Sieger: ${esc(name(g.winner))}</span>`:isAdmin()?btn('Match starten',`startMatch('${a}','${b}','league',{league:'${l.id}',night:16,stage:'${stage}'})`):''}</div>`}).join('')}
function champion(l){return leagueGames(l).find(g=>g.ref?.stage==='final16')?.winner}
function showArchived(i){const l=db.leagues.find(x=>x.id===i);if(!l)return;ui.archive=i;document.getElementById('app').innerHTML=`<div class="shell">${header()}${btn('← Zurück',"go('league')",'secondary')}${leagueDetail(l)}</div>`}
function history(){return `<h2>Spiele</h2>${db.games.map(g=>`<div class="panel">${esc(name(g.a))} gegen ${esc(name(g.b))} · ${esc(name(g.winner))} gewinnt</div>`).join('')}`}
function stats(){const friend=db.games.filter(g=>g.kind==='friendly'),rows=db.players.map(p=>{const gs=friend.filter(g=>g.a===p.id||g.b===p.id);let wins=0,bombs=0,shots=0,hits=0,combos=0,diff=0;for(const g of gs){const i=g.a===p.id?0:1,s=g.sides[i];wins+=g.winner===p.id?1:0;bombs+=s.bombs;shots+=s.shots;hits+=s.hits;combos+=s.combos;diff+=s.remaining-g.sides[1-i].remaining}return {p,games:gs.length,wins,bombs,shots,hits,combos,diff}}).sort((a,b)=>b.wins-a.wins||b.diff-a.diff);return `<div class="section"><h2>📊 Freundschaftsspiel-Statistik</h2></div><div class="panel table-wrap"><table class="table"><thead><tr><th>Spieler</th><th>Spiele</th><th>Siege</th><th>Quote</th><th>💣</th><th>Kombi</th><th>+/-</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.p.name)}</td><td>${x.games}</td><td>${x.wins}</td><td>${x.shots?(100*x.hits/x.shots).toFixed(1)+' %':'–'}</td><td>${x.bombs}</td><td>${x.combos}</td><td>${x.diff}</td></tr>`).join('')}</tbody></table></div><div class="section"><h2>🤖 Höchster besiegter Rüfner 3000</h2></div><div class="panel">${db.players.map(p=>`<p>${esc(p.name)}: <strong>${COM_NAMES[db.record[p.id]]||'Noch keiner'}</strong></p>`).join('')}</div><div class="section"><h2>🏆 Premier-League-Titel</h2></div><div class="panel">${db.players.map(p=>`<p>${esc(p.name)}: ${db.leagues.filter(l=>l.closed&&champion(l)===p.id).length} Meistertitel</p>`).join('')}</div>`}
function rules(){const sections=[['Aufstellen','10 Becher in Pyramidenform (4–3–2–1), mittig und ca. 10 cm von der Tischkante.'],['Anspiel','Ein Team beginnt mit zwei Würfen. Bei Uneinigkeit: Schere, Stein, Papier.'],['Werfen','Pro Team zwei Bälle pro Runde. Der Ellenbogen bleibt hinter der Tischkante.'],['Abwehren','Nicht direkte Würfe dürfen abgewehrt werden; direkte Würfe nicht. Bälle im Becher dürfen nicht herausgeblasen werden.'],['Kombinationen','Zwei unterschiedliche Becher: beide weg und zwei neue Würfe. Derselbe Becher: Bombe, dieser und drei nächstgelegene Becher weg, danach zwei neue Würfe.'],['On Fire (Doppel)','Drei Treffer hintereinander: weiterschiessen bis zum Fehlwurf. Im Einzeltraining nicht separat aktiv.'],['Trickshot','Kommt der Ball ohne Fremdeinwirkung über die Tischmitte zurück, gibt es einen Trickshot.'],['Death Cup','Treffer in einen bereits getroffenen, aber noch stehenden Becher beendet das Spiel sofort.'],['Eigentor & umfallende Becher','Eigentore und umgefallene Becher haben eigene Strafregeln.'],['Zusammenstellen','Einmal pro Spiel, zu Beginn eines regulären eigenen Wurfs – niemals während einer Kombination oder ihrer Zusatzwürfe. Bei 6 Bechern grosse Pyramide; 5 Full House (3 Varianten); 4 Vagina; 3 kleine Pyramide; 2 Paar (3 Varianten).'],['Trinken','Getroffene Becher werden ausgetrunken; die Originalregeln enthalten zusätzliche Zeit- und Strafbestimmungen.']];return `<div class="section"><h2>📖 Rüfner Beer Pong Reglement</h2><p class="muted">Kurzübersicht. Das vollständige Originaldokument liegt der App bei.</p></div>${sections.map(([h,p])=>`<details><summary>${h}</summary><p>${p}</p></details>`).join('')}<div class="panel"><a class="btn" style="display:inline-block;text-decoration:none" href="reglement.pdf" target="_blank" rel="noopener">📄 Vollständiges Reglement (PDF)</a></div>`}
render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
