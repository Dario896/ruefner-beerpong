import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const root=document.getElementById('pl-admin-seasons');
const cfg=window.RUEFNER_SUPABASE;
if(root&&cfg?.url&&cfg?.publishableKey){
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const fields=['remaining','shots','hits','turns','bombs','combos','trickAttempts','trickHits','islandAttempts','islandHits','finishAttempts','finishHits','normalFinishes','comboFinishes','bombFinishes'];
 function openEdit(game,names){
  const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);overflow:auto;padding:18px';
  const box=document.createElement('div');box.className='panel';box.style.cssText='max-width:650px;margin:15px auto';
  const h=document.createElement('h2');h.textContent='Night '+game.night+' · '+game.stage+' bearbeiten';box.append(h);
  const form=document.createElement('form');
  const winnerLabel=document.createElement('label');winnerLabel.textContent='Sieger';const winner=document.createElement('select');winner.className='field';
  for(const pid of [game.player_a,game.player_b]){const opt=document.createElement('option');opt.value=pid;opt.textContent=names[pid]||pid;opt.selected=pid===game.winner;winner.append(opt);}
  form.append(winnerLabel,winner);
  const inputs=[game.side_a,game.side_b].map((side,i)=>{
   const heading=document.createElement('h3');heading.textContent=names[i===0?game.player_a:game.player_b]||'Spieler';form.append(heading);
   const obj={};for(const k of fields){const wrap=document.createElement('div');wrap.className='field';const label=document.createElement('label');label.textContent=k;const inp=document.createElement('input');inp.type='number';inp.min='0';inp.max=k==='remaining'?'10':'9999';inp.required=true;inp.value=String(Number(side?.[k])||0);wrap.append(label,inp);form.append(wrap);obj[k]=inp;}return obj;
  });
  const save=document.createElement('button');save.type='submit';save.className='btn';save.textContent='Änderungen speichern';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='btn secondary';cancel.textContent='Abbrechen';cancel.style.marginLeft='8px';cancel.addEventListener('click',()=>overlay.remove());form.append(save,cancel);
  form.addEventListener('submit',async ev=>{
   ev.preventDefault();const sides=inputs.map((ins,i)=>({...((i===0?game.side_a:game.side_b)||{}),...Object.fromEntries(fields.map(k=>[k,Number(ins[k].value)]))}));
   if(sides.some(x=>fields.some(k=>!Number.isInteger(x[k])||x[k]<0||x[k]>(k==='remaining'?10:9999))))return alert('Ungültige Werte');
   const wi=winner.value===game.player_a?0:1;
   if(sides[wi].remaining<1||sides[1-wi].remaining!==0)return alert('Sieger braucht mindestens einen Becher, Verlierer null.');
   if(!confirm('Begegnung und Statistik wirklich ändern?'))return;
   save.disabled=true;
   const {error}=await client.rpc('ruefner_pl_edit_match',{p_match:game.id,p_winner:winner.value,p_side_a:sides[0],p_side_b:sides[1]});
   if(error){alert('Speichern fehlgeschlagen: '+error.message);save.disabled=false;return;}
   alert('Gespeichert. Premier League in der App neu laden.');overlay.remove();await refresh();
  });box.append(form);overlay.append(box);document.body.append(overlay);
 }
 async function refresh(){
  const {data:{user}}=await client.auth.getUser();if(!user){root.textContent='Bitte anmelden.';return;}
  const {data:profile,error:pe}=await client.from('player_profiles').select('is_admin').eq('id',user.id).single();
  if(pe||!profile?.is_admin){root.textContent='Nur für Administratoren.';return;}
  const {data,error}=await client.from('ruefner_pl_seasons').select('id,title').order('created_at',{ascending:false});
  if(error){root.textContent='Saisons konnten nicht geladen werden: '+error.message;return;}
  root.replaceChildren();
  if(!data?.length){root.textContent='Noch keine Saisons vorhanden.';return;}
  for(const season of data){
   const line=document.createElement('div');line.className='row';line.style.margin='12px 0';
   const title=document.createElement('strong');title.textContent=(season.title||'Premier League');
   const button=document.createElement('button');button.className='btn secondary';button.type='button';button.textContent='Saison löschen';
   button.addEventListener('click',async()=>{
    if(!confirm('Saison "'+season.title+'" und ALLE zugehörigen PL-Spiele unwiderruflich löschen? Freundschaftsspiele bleiben erhalten.'))return;
    if(!confirm('Wirklich endgültig löschen? Dieser Schritt kann nicht rückgängig gemacht werden.'))return;
    button.disabled=true;
    const {error}=await client.rpc('ruefner_pl_delete_season',{p_season:season.id});
    if(error){alert('Löschen fehlgeschlagen: '+error.message);button.disabled=false;return;}
    alert('Saison gelöscht. Bitte die App neu laden.');await refresh();
   });
   line.append(title,button);root.append(line);
   const gamesBox=document.createElement('div');gamesBox.className='panel';gamesBox.style.margin='8px 0 20px';
   const showGames=document.createElement('button');showGames.type='button';showGames.className='btn secondary';showGames.textContent='Begegnungen bearbeiten';
   const list=document.createElement('div');list.hidden=true;
   showGames.addEventListener('click',async()=>{
    list.hidden=!list.hidden;if(list.hidden)return;
    list.textContent='Begegnungen werden geladen …';
    const {data:games,error:ge}=await client.from('ruefner_pl_matches').select('*').eq('season_id',season.id).order('night',{ascending:true});
    if(ge){list.textContent='Fehler: '+ge.message;return;}
    const {data:profiles}=await client.from('player_profiles').select('id,username');
    const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username||p.id]));
    list.replaceChildren();if(!games?.length){list.textContent='Noch keine abgeschlossenen Begegnungen.';return;}
    for(const game of games){
     const line=document.createElement('div');line.className='row';line.style.margin='10px 0';
     const label=document.createElement('span');label.textContent='Night '+game.night+' · '+game.stage+' · '+(names[game.player_a]||game.player_a)+' – '+(names[game.player_b]||game.player_b);
     const edit=document.createElement('button');edit.type='button';edit.className='btn secondary';edit.textContent='Bearbeiten';
     edit.addEventListener('click',()=>openEdit(game,names));line.append(label,edit);list.append(line);
    }
   });gamesBox.append(showGames,list);root.append(gamesBox);
  }
 }
 const adminPanel=document.getElementById('admin-panel');
 const watcher=new MutationObserver(()=>{if(adminPanel&&!adminPanel.hidden)refresh().catch(e=>root.textContent=e.message);});
 if(adminPanel){watcher.observe(adminPanel,{attributes:true,attributeFilter:['hidden']});if(!adminPanel.hidden)refresh().catch(e=>root.textContent=e.message);}
}
