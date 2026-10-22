const C='alves-v3';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./icone.png'])).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request;
 if(r.method!=='GET'||/firebaseio\.com|identitytoolkit|securetoken|generativelanguage/.test(r.url))return;
 const guarda=x=>{if(x.ok||x.type==='opaque'){const c=x.clone();caches.open(C).then(h=>h.put(r,c))}return x};
 if(r.mode==='navigate'){
  e.respondWith(fetch(r).then(guarda).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));return;
 }
 e.respondWith(caches.match(r).then(m=>m||fetch(r).then(guarda)));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 e.waitUntil(clients.matchAll({type:'window'}).then(l=>{for(const c of l){if('focus' in c)return c.focus()}return clients.openWindow('./')}));
});
