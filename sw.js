const CACHE='faisal-workshop-v8';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin)return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>cached||caches.match('./index.html'))));});
self.addEventListener('push',event=>{
  let payload={title:"Faisal' Workshop",body:'You have a daily reminder.',url:'./',tag:'workshop-daily-reminder'};
  try{if(event.data)payload={...payload,...event.data.json()};}catch{if(event.data)payload.body=event.data.text();}
  event.waitUntil(self.registration.showNotification(payload.title||"Faisal' Workshop",{
    body:payload.body||'You have a daily reminder.',
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    tag:payload.tag||'workshop-daily-reminder',
    data:{url:payload.url||'./'},
    renotify:false
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.location.href).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){existing.navigate(target);return existing.focus();}
    return self.clients.openWindow(target);
  }));
});
