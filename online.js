import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const $ = id => document.getElementById(id);
const status = msg => { $('setup-status').textContent=msg; };
const cfg=window.RUEFNER_SUPABASE;
const ready=cfg?.url?.startsWith('https://') && cfg?.publishableKey && !cfg.publishableKey.includes('HIER_');
let client;
if(!ready){status('Bitte zuerst in online-config.js den öffentlichen Supabase Publishable/Anon Key eintragen.');$('login-form').hidden=true;}
else{
 client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 async function refresh(){
  try{
   const {data:{user},error}=await client.auth.getUser();if(error)throw error;
   if(!user){$('login-form').hidden=false;$('account').hidden=true;status('Bitte mit deinem bestehenden Supabase-Benutzer anmelden.');return;}
   $('login-form').hidden=true;$('account').hidden=false;
   const {data:profile,error:pe}=await client.from('player_profiles').select('username,is_admin').eq('id',user.id).single();
   if(pe){status('Angemeldet, aber Profil nicht lesbar. Bitte zuerst die RLS-Regel aus online-rls-schritt1.sql ausführen.');$('account-name').textContent='Anmeldung aktiv.';return;}
   $('account-name').textContent=`${profile.username} · ${profile.is_admin?'👑 Administrator':'Spieler'}`;
   status('Erfolgreich angemeldet! Online-Synchronisierung der Spiele ist noch nicht aktiviert.');
  }catch(e){status('Verbindung fehlgeschlagen: '+(e.message||'Unbekannter Fehler'));}
 }
 $('login-form').addEventListener('submit',async e=>{
  e.preventDefault();status('Anmeldung läuft …');
  const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
  $('password').value='';if(error){status('Anmeldung fehlgeschlagen: '+error.message);return;}await refresh();
 });
 $('logout').addEventListener('click',async()=>{await client.auth.signOut();await refresh();});
 await refresh();
}
