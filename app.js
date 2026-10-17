import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CONFIG = {
  // Create a free project at https://supabase.com and paste its Project URL + anon/publishable key here.
  // Never put a Supabase service_role key in frontend code.
  supabaseUrl: '',
  supabaseAnonKey: ''
};
const CLOUD_READY = /^https:\/\/.+/.test(CONFIG.supabaseUrl) && CONFIG.supabaseAnonKey.length > 20;
const supabase = CLOUD_READY ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const today = new Date();
const dayKey = `faisal-workshop-tasks-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const LOCAL_TASKS = 'fw_tasks';
const LOCAL_NOTES = 'fw_notes';
const LOCAL_FILES = 'fw_files';
let tasks = readLocal(LOCAL_TASKS, []);
let notes = readLocal(LOCAL_NOTES, []);
let files = [];
let selectedNoteId = null;
let user = null;
let authMode = 'signin';
let toastTimer;

function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showToast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2400); }
function fileSize(bytes) { return bytes<1024?bytes+' B':bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(1)+' MB'; }
function setStatus(text, online=false) { $('#syncStatus').innerHTML='<i></i> '+escapeHtml(text); $('#syncStatus').classList.toggle('online',online); }
function setDate() { $('#todayDate').textContent=today.toLocaleDateString(undefined,{month:'short',day:'numeric'}); $('#todayWeekday').textContent=today.toLocaleDateString(undefined,{weekday:'long',year:'numeric'}); $('#todayLabel').textContent='TODAY'; $('#year').textContent=today.getFullYear(); }
function saveLocalTasks() { writeLocal(LOCAL_TASKS,tasks); }
function saveLocalNotes() { writeLocal(LOCAL_NOTES,notes); }
function saveLocalFiles() { writeLocal(LOCAL_FILES,files.map(f=>({id:f.id,name:f.name,type:f.type,size:f.size,data:f.data,created:f.created}))); }
async function migrateLegacyLocalData() {
  if (!localStorage.getItem(LOCAL_TASKS)) {
    const legacyTaskKey = Object.keys(localStorage).find(k => /^hub_\d{4}-\d{2}-\d{2}$/.test(k));
    if (legacyTaskKey) { const old=readLocal(legacyTaskKey,[]); tasks=old.map(t=>({...t,id:t.id||crypto.randomUUID(),created_at:t.created_at||new Date().toISOString()})); saveLocalTasks(); }
  }
  if (!localStorage.getItem(LOCAL_NOTES) && localStorage.getItem('hub_notes')) {
    notes=readLocal('hub_notes',[]).map(n=>({...n,id:n.id||crypto.randomUUID(),updated_at:n.updated_at||new Date(n.updated||Date.now()).toISOString()})); saveLocalNotes();
  }
  if (!localStorage.getItem(LOCAL_FILES)) {
    try { const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('FaisalDailyHubDB',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      if(db.objectStoreNames.contains('files')) { const oldFiles=await new Promise((resolve,reject)=>{const req=db.transaction('files').objectStore('files').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
        for(const f of oldFiles) { const blob=f.blob||f; const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);}); files.push({id:f.id||crypto.randomUUID(),name:f.name||'file',type:f.type||blob.type||'',size:f.size||blob.size||0,data,created:new Date().toISOString()}); }
        if(files.length)saveLocalFiles();
      } db.close();
    } catch(e) { console.warn('Legacy file migration skipped',e); }
  }
}
function renderTasks() {
  const complete=tasks.filter(t=>t.done).length, percent=tasks.length?Math.round(complete/tasks.length*100):0;
  $('#taskCount').textContent=tasks.length; $('#progressText').textContent=`${percent}% complete · ${complete}/${tasks.length}`; $('#progressBar').style.width=percent+'%';
  $('#taskEmpty').classList.toggle('hidden',tasks.length>0);
  $('#taskList').innerHTML=tasks.map(t=>`<div class="task-row ${t.done?'done':''}"><input type="checkbox" data-check="${escapeHtml(t.id)}" ${t.done?'checked':''} aria-label="Complete task"><span class="task-name">${escapeHtml(t.title)}</span><small class="task-time">${escapeHtml(t.time||'')}</small><button class="delete-task" data-delete-task="${escapeHtml(t.id)}" aria-label="Delete task">×</button></div>`).join('');
}
function renderNotes() {
  $('#noteCount').textContent=notes.length;
  $('#noteList').innerHTML=notes.map(n=>`<button class="note-item ${n.id===selectedNoteId?'active':''}" data-note-id="${escapeHtml(n.id)}"><strong>${escapeHtml(n.title||'Untitled note')}</strong><small>${new Date(n.updated_at||n.updated||Date.now()).toLocaleDateString()}</small></button>`).join('') || '<div class="empty-state"><strong>No notes yet</strong><p>Create your first note.</p></div>';
}
function renderFiles() {
  $('#fileCount').textContent=files.length; $('#fileEmpty').classList.toggle('hidden',files.length>0);
  $('#fileGrid').innerHTML=files.map(f=>`<article class="file-card"><div class="file-preview">${f.type?.startsWith('image/')&&f.data?'<img src="'+f.data+'" alt="">':'▤'}</div><div class="file-name">${escapeHtml(f.name)}</div><div class="file-meta">${fileSize(f.size||0)}</div><div class="file-actions"><button class="button button-light" data-download-file="${escapeHtml(f.id)}">Download</button><button class="button button-light" data-delete-file="${escapeHtml(f.id)}">Delete</button></div></article>`).join('');
}
function renderAll() { renderTasks(); renderNotes(); renderFiles(); }

async function cloudLoad() {
  if (!supabase || !user) return;
  const [taskRes,noteRes,fileRes] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at',{ascending:true}),
    supabase.from('notes').select('*').order('updated_at',{ascending:false}),
    supabase.from('files').select('*').order('created_at',{ascending:false})
  ]);
  for (const res of [taskRes,noteRes,fileRes]) if(res.error) throw res.error;
  tasks=taskRes.data||[]; notes=noteRes.data||[]; files=(fileRes.data||[]).map(f=>({...f,cloud:true}));
  renderAll();
}
async function refreshAuth() {
  if (!CLOUD_READY) { setStatus('Local mode',false); $('#accountButton').textContent='Set up cloud sync'; $('#fileNotice').textContent='Local mode saves data in this browser only. Configure Supabase to sync your tasks, notes, and files across your phone and laptop.'; return; }
  const {data:{session}}=await supabase.auth.getSession(); user=session?.user||null;
  if(user) {
    $('#accountButton').textContent='Sign out'; setStatus('Cloud sync',true);
    try { await cloudLoad(); $('#fileNotice').textContent='Signed in. Files are stored in your private account space.'; }
    catch(e) { showToast('Could not load cloud data: '+e.message); }
  } else { $('#accountButton').textContent='Sign in / Sync'; setStatus('Signed out',false); tasks=readLocal(LOCAL_TASKS,[]); notes=readLocal(LOCAL_NOTES,[]); files=readLocal(LOCAL_FILES,[]); renderAll(); }
}
async function upsertTask(task) {
  if(supabase&&user) { const {error}=await supabase.from('tasks').upsert({...task,user_id:user.id}); if(error) throw error; }
  else saveLocalTasks();
}
async function upsertNote(note) {
  if(supabase&&user) { const payload={...note,user_id:user.id}; const {error}=await supabase.from('notes').upsert(payload); if(error) throw error; }
  else saveLocalNotes();
}
async function removeCloudRow(table,id) { const {error}=await supabase.from(table).delete().eq('id',id); if(error) throw error; }
function openAuth() {
  if(!CLOUD_READY) { showToast('Cloud sync needs a Supabase project. See README.md in your VS Code folder.'); return; }
  if(user) { supabase.auth.signOut().then(()=>{user=null;setStatus('Signed out',false);$('#accountButton').textContent='Sign in / Sync';showToast('Signed out');}); return; }
  $('#authMessage').textContent=''; $('#authDialog').showModal();
}
function setAuthMode(mode) { authMode=mode; $('#authTitle').textContent=mode==='signup'?'Create your account':'Sign in to sync'; $('#authSubmit').textContent=mode==='signup'?'Create account':'Sign in'; $('#toggleAuthMode').textContent=mode==='signup'?'Already have an account? Sign in':'Need an account? Create one'; $('#authPassword').autocomplete=mode==='signup'?'new-password':'current-password'; }
$$('.tab').forEach(btn=>btn.addEventListener('click',()=>{ $$('.tab').forEach(b=>b.classList.toggle('active',b===btn)); $$('.panel').forEach(p=>p.classList.toggle('active',p.id===btn.dataset.tab)); }));
$('#addTaskButton').addEventListener('click',()=>{$('#taskForm').classList.remove('hidden');$('#taskTitle').focus();});
$('#cancelTask').addEventListener('click',()=>{$('#taskForm').reset();$('#taskForm').classList.add('hidden');});
$('#taskForm').addEventListener('submit',async e=>{e.preventDefault();const task={id:crypto.randomUUID(),title:$('#taskTitle').value.trim(),time:$('#taskTime').value,done:false,created_at:new Date().toISOString()};if(!task.title)return;tasks.push(task);try{await upsertTask(task);renderTasks();e.target.reset();e.target.classList.add('hidden');showToast('Task saved');}catch(err){tasks=tasks.filter(t=>t.id!==task.id);showToast('Save failed: '+err.message);}});
$('#taskList').addEventListener('change',async e=>{const id=e.target.dataset.check;if(!id)return;const task=tasks.find(t=>t.id===id);if(!task)return;task.done=e.target.checked;try{await upsertTask(task);renderTasks();}catch(err){task.done=!e.target.checked;renderTasks();showToast('Update failed: '+err.message);}});
$('#taskList').addEventListener('click',async e=>{const id=e.target.dataset.deleteTask;if(!id)return;const old=tasks;tasks=tasks.filter(t=>t.id!==id);try{if(supabase&&user)await removeCloudRow('tasks',id);else saveLocalTasks();renderTasks();showToast('Task deleted');}catch(err){tasks=old;renderTasks();showToast('Delete failed: '+err.message);}});
function loadNote(id=null) { selectedNoteId=id;const note=notes.find(n=>n.id===id);$('#noteTitle').value=note?.title||'';$('#noteBody').value=note?.body||'';$('#noteStatus').textContent=note?'Last saved '+new Date(note.updated_at||note.updated).toLocaleString():'New note';$('#deleteNoteButton').classList.toggle('hidden',!note);renderNotes(); }
$('#newNoteButton').addEventListener('click',()=>loadNote());
$('#noteList').addEventListener('click',e=>{const btn=e.target.closest('[data-note-id]');if(btn)loadNote(btn.dataset.noteId);});
$('#noteForm').addEventListener('submit',async e=>{e.preventDefault();const existing=notes.find(n=>n.id===selectedNoteId);const note={id:existing?.id||crypto.randomUUID(),title:$('#noteTitle').value.trim(),body:$('#noteBody').value,updated_at:new Date().toISOString()};if(!note.title){showToast('Please add a title');return;}if(existing)notes=notes.map(n=>n.id===existing.id?{...n,...note}:n);else{notes.unshift(note);selectedNoteId=note.id;}try{await upsertNote(note);renderNotes();$('#noteStatus').textContent='Saved just now';$('#deleteNoteButton').classList.remove('hidden');showToast('Note saved');}catch(err){showToast('Save failed: '+err.message);}});
$('#deleteNoteButton').addEventListener('click',async()=>{if(!selectedNoteId)return;const id=selectedNoteId,old=notes;notes=notes.filter(n=>n.id!==id);try{if(supabase&&user)await removeCloudRow('notes',id);else saveLocalNotes();loadNote();renderNotes();showToast('Note deleted');}catch(err){notes=old;renderNotes();showToast('Delete failed: '+err.message);}});
$('#fileInput').addEventListener('change',async e=>{const picked=[...e.target.files];for(const f of picked){if(f.size>25*1024*1024){showToast(f.name+' is larger than 25 MB');continue;}try{if(supabase&&user){const path=user.id+'/'+crypto.randomUUID()+'-'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');const {error:uploadError}=await supabase.storage.from('workshop-files').upload(path,f,{upsert:false});if(uploadError)throw uploadError;const row={id:crypto.randomUUID(),name:f.name,path,type:f.type||'',size:f.size};const {error:rowError}=await supabase.from('files').insert({...row,user_id:user.id});if(rowError)throw rowError;files.unshift(row);}else{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});files.unshift({id:crypto.randomUUID(),name:f.name,type:f.type,size:f.size,data,created:new Date().toISOString()});saveLocalFiles();}}catch(err){showToast('Could not save '+f.name+': '+err.message);}}renderFiles();e.target.value='';});
$('#fileGrid').addEventListener('click',async e=>{const dl=e.target.dataset.downloadFile,del=e.target.dataset.deleteFile;if(dl){const f=files.find(x=>x.id===dl);if(!f)return;try{let url=f.data;if(f.cloud&&supabase&&user){const {data,error}=await supabase.storage.from('workshop-files').createSignedUrl(f.path,60);if(error)throw error;url=data.signedUrl;}if(!url){showToast('File data is unavailable');return;}const a=document.createElement('a');a.href=url;a.download=f.name;a.target='_blank';a.rel='noopener';a.click();}catch(err){showToast('Download failed: '+err.message);}return;}if(del){const f=files.find(x=>x.id===del);if(!f)return;try{if(f.cloud&&supabase&&user){const {error}=await supabase.storage.from('workshop-files').remove([f.path]);if(error)throw error;await removeCloudRow('files',del);}else{files=files.filter(x=>x.id!==del);saveLocalFiles();}if(f.cloud)files=files.filter(x=>x.id!==del);renderFiles();showToast('File deleted');}catch(err){showToast('Delete failed: '+err.message);}}});
$('#accountButton').addEventListener('click',openAuth);
$('#closeAuth').addEventListener('click',()=>$('#authDialog').close());
$('#toggleAuthMode').addEventListener('click',()=>setAuthMode(authMode==='signup'?'signin':'signup'));
$('#authForm').addEventListener('submit',async e=>{e.preventDefault();if(!supabase)return;const email=$('#authEmail').value.trim(),password=$('#authPassword').value;$('#authMessage').textContent='Please wait…';$('#authSubmit').disabled=true;try{const result=authMode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});if(result.error)throw result.error;if(authMode==='signup'&&!result.data.session){$('#authMessage').textContent='Account created. Check your email to confirm it, then sign in.';return;}$('#authDialog').close();await refreshAuth();showToast(authMode==='signup'?'Account created':'Signed in');}catch(err){$('#authMessage').textContent=err.message;}finally{$('#authSubmit').disabled=false;}});
$('#exportButton').addEventListener('click',()=>{const payload={app:"Faisal' Workshop",version:1,exportedAt:new Date().toISOString(),tasks,notes,files:files.filter(f=>!f.cloud)};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='faisal-workshop-backup.json';a.click();URL.revokeObjectURL(url);showToast('Backup exported');});
$('#importInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.tasks)||!Array.isArray(data.notes))throw new Error('This is not a valid Workshop backup');if(supabase&&user)throw new Error('For a signed-in account, import is local-only in this version. Sign out to restore a local backup.');tasks=data.tasks;notes=data.notes;files=Array.isArray(data.files)?data.files:[];saveLocalTasks();saveLocalNotes();saveLocalFiles();selectedNoteId=null;renderAll();loadNote();showToast('Backup restored');}catch(err){showToast(err.message);}e.target.value='';});
async function init(){setDate();await migrateLegacyLocalData();if(!CLOUD_READY){files=readLocal(LOCAL_FILES,files);renderAll();loadNote();setStatus('Local mode',false);$('#accountButton').textContent='Set up cloud sync';$('#fileNotice').textContent='Local mode saves data in this browser only. Configure Supabase to sync your tasks, notes, and files across your phone and laptop.';return;}files=readLocal(LOCAL_FILES,files);await refreshAuth();supabase.auth.onAuthStateChange(()=>{setTimeout(()=>refreshAuth(),0);});}
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setAuthMode('signin');init().catch(err=>{console.error(err);showToast('App loaded with limited offline mode');});
