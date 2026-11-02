import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const root=document.getElementById('pl-admin-seasons');
const cfg=window.RUEFNER_SUPABASE;
if(root&&cfg?.url&&cfg?.publishableKey){
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
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
  }
 }
 const adminPanel=document.getElementById('admin-panel');
 const watcher=new MutationObserver(()=>{if(adminPanel&&!adminPanel.hidden)refresh().catch(e=>root.textContent=e.message);});
 if(adminPanel){watcher.observe(adminPanel,{attributes:true,attributeFilter:['hidden']});if(!adminPanel.hidden)refresh().catch(e=>root.textContent=e.message);}
}
