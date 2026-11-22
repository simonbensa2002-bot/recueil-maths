// Service worker : l'appli s'ouvre sans réseau après la première visite.
const SHELL='recueil-shell-v1';
const FILES=['./','index.html','style.css','app.js','manifest.webmanifest','data/docs.json','vendor/pdf.min.js','vendor/pdf.worker.min.js','vendor/tex-svg.js','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys()){ if(k.startsWith('recueil-shell-')&&k!==SHELL) await caches.delete(k); }
  await self.clients.claim();
})())});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  // Les PDF : réponse complète (pas de Range), cache d'abord, mémorisés après la première ouverture.
  e.respondWith((async()=>{
    const hit=await caches.match(r.url.split('#')[0],{ignoreSearch:true});
    const refresh=fetch(r).then(async res=>{
      if(res&&res.ok&&res.status===200){const c=await caches.open(r.url.includes('/pdf/')?'recueil-pdf-v1':SHELL);c.put(r,res.clone());}
      return res;
    }).catch(()=>null);
    if(hit){ e.waitUntil(refresh); return hit; }
    const res=await refresh;
    return res||(r.mode==='navigate'?caches.match('index.html'):new Response('',{status:504}));
  })());
});
