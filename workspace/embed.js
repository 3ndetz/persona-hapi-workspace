(()=>{
 const role=window.frameElement?.dataset.personaRole;
 const emit=(type,data={})=>parent.postMessage({source:'persona-workspace',version:1,type,...data},location.origin);
 if(!role){
  // Discoverable opt-in entry; native routes and all their controls stay intact.
  if(window.top!==window)return;
  const add=()=>{if(!document.body||document.getElementById('persona-workspace-entry'))return;const a=document.createElement('a');a.id='persona-workspace-entry';a.href='/workspace';a.textContent='Workspace ↗';a.title='Tabbed workspace with up to six chats';Object.assign(a.style,{position:'fixed',right:'12px',top:'4px',zIndex:'40',font:'10px Segoe UI,sans-serif',color:'var(--app-hint,#718096)',background:'var(--app-bg,#fff)',borderRadius:'5px',padding:'1px 5px'});document.body.append(a);};add();return;
 }
 const css=document.createElement('style');css.textContent=role==='chat'?'[data-persona-sidebar],.sidebar-resize-handle{display:none!important}':'[data-persona-sidebar]{display:flex!important;width:100%!important;max-width:none!important}[data-persona-sidebar]~*{display:none!important}.sidebar-resize-handle{display:none!important}';document.head.append(css);
 if(role==='chat'){const compact=document.createElement('style');compact.textContent='[data-persona-chat-header]{padding:5px 8px!important;gap:4px!important}[data-persona-chat-header] button{width:26px!important;height:26px!important}[data-persona-chat-header] .text-lg{font-size:14px!important}[data-persona-chat-header] .text-xs{font-size:10px!important}';document.head.append(compact);}
 let previous='',previousTitle='',warned=false,pendingAdd=false;
 if(role==='list'){
  const compact=document.createElement('style');compact.textContent='.session-list-item{position:relative;padding-right:30px!important}.persona-add-chat{position:absolute;right:5px;top:8px;width:22px;height:22px;display:grid;place-items:center;border-radius:4px;font:18px/1 system-ui;color:var(--app-hint,#718096)}.persona-add-chat:hover{background:var(--app-secondary-bg,#eef0f5);color:var(--app-link,#6559df)}';document.head.append(compact);
 }
 function refresh(){
  const sidebar=document.querySelector('[style*="--sidebar-w"]');if(sidebar)sidebar.setAttribute('data-persona-sidebar','');
  if(role==='chat'){const header=document.querySelector('[data-testid="session-header-age"]')?.closest('[class~="max-w-content"]');if(header)header.setAttribute('data-persona-chat-header','');}
  if(role==='list')for(const row of document.querySelectorAll('.session-list-item')){
   if(row.querySelector('.persona-add-chat'))continue;
   const plus=document.createElement('span');plus.className='persona-add-chat';plus.textContent='+';plus.tabIndex=0;plus.setAttribute('role','button');plus.setAttribute('aria-label','Add chat on the right');plus.title='Add chat on the right';
   for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend'])plus.addEventListener(type,e=>e.stopPropagation());
   plus.onclick=e=>{e.preventDefault();e.stopPropagation();pendingAdd=true;row.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));};plus.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();plus.click();}};row.append(plus);
  }
  const route=location.pathname+location.search;
  if(route!==previous){previous=route;emit('route',{route,mode:pendingAdd?'add':'replace'});pendingAdd=false;
   // Return the list frame to its index. Otherwise its hidden native chat
   // would keep an extra stream and could open onboarding dialogs over the list.
   if(role==='list'&&/^\/sessions\/[a-zA-Z0-9_-]+$/.test(location.pathname)&&!location.pathname.endsWith('/new')){
    history.replaceState(history.state,'','/sessions');window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}));
   }
  }
  const id=location.pathname.match(/^\/sessions\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1];
  if(id&&id!=='new'&&document.title!==previousTitle){previousTitle=document.title;const name=document.title.replace(/\s*[-·|]\s*(?:HAPI|Persona Workflow).*$/i,'');if(name&&name!=='Persona Workflow'&&name!=='HAPI')emit('sessions',{sessions:[{id,name}]});}
  if(sidebar&&!warned){warned=true;emit('adapter',{compatible:true});}
 }
 const observer=new MutationObserver(refresh);observer.observe(document.documentElement,{childList:true,subtree:true});refresh();
 window.addEventListener('popstate',refresh);setInterval(refresh,1000);
 window.addEventListener('focus',()=>emit('focus'));
 document.addEventListener('keydown',event=>{if(event.altKey&&/^[1-9]$/.test(event.key)){event.preventDefault();emit('tab-shortcut',{index:Number(event.key)-1});}});
 // Observe only existing GET responses; never send API writes or transfer tokens.
 const nativeFetch=window.fetch;
 const summarize=s=>({id:s.id,name:s.metadata?.name??s.metadata?.summary?.text??s.id.slice(0,8),thinking:!!s.thinking,active:!!s.active});
 window.fetch=async(...args)=>{
  const response=await nativeFetch(...args);
  try{const input=args[0],url=new URL(typeof input==='string'?input:input.url,location.href);const method=(args[1]?.method??input?.method??'GET').toUpperCase();
   if(method==='GET'&&/^\/api\/sessions(?:\/[a-zA-Z0-9_-]+)?$/.test(url.pathname)&&response.ok){
    void response.clone().json().then(value=>{const sessions=value.sessions??(value.session?[value.session]:[]);emit('sessions',{sessions:sessions.map(summarize)});}).catch(()=>{});
   }
  }catch{}return response;
 };
 const NativeEventSource=window.EventSource;
 if(NativeEventSource)window.EventSource=class extends NativeEventSource{constructor(...args){super(...args);this.addEventListener('message',event=>{try{const value=JSON.parse(event.data);if(['session-updated','session-added'].includes(value.type)&&value.data?.id)emit('sessions',{sessions:[summarize(value.data)]});}catch{}});}};
 let previousTheme='';setInterval(()=>{const style=getComputedStyle(document.documentElement),theme=Object.fromEntries(Object.entries({bg:'--app-bg',text:'--app-fg',muted:'--app-hint',line:'--app-border',panel:'--app-subtle-bg'}).map(([key,property])=>[key,style.getPropertyValue(property).trim()]));const key=JSON.stringify(theme);if(key!==previousTheme){previousTheme=key;emit('theme',{theme});}},1500);
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.source!=='persona-workspace')return;if(event.data.type==='focus')document.querySelector('textarea,[contenteditable="true"],[contenteditable="plaintext-only"]')?.focus();});
})();
