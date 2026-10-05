import{KEY,restore,safeRoute,sessionId,visibleTabs,choose,addPane,setLayout}from'./state.mjs';
let state;try{state=restore(localStorage.getItem(KEY));}catch{state=restore(null);}
const frames=new Map(),sessions=new Map(),tabs=document.querySelector('#tabs'),panes=document.querySelector('#panes'),list=document.querySelector('#session-list');
const write=()=>{try{localStorage.setItem(KEY,JSON.stringify({tabs:state.tabs,selected:state.selected,layout:state.layout,slots:state.slots,widths:state.widths}));}catch{}};
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;};
function select(key){state.maximized=null;choose(state,key);render();}
function append(key){state.maximized=null;if(!addPane(state,key))document.querySelector('#status').textContent='Six panels already open. Replace the left chat or close a panel.';render();}
function close(key){
 const matching=[...frames.entries()].filter(([,e])=>e.tabKey===key);
 for(const [,entry]of matching)try{const draft=entry.iframe.contentDocument?.querySelector('textarea,[contenteditable="true"],[contenteditable="plaintext-only"]');if((draft?.value??draft?.textContent??'').trim()){if(!confirm('Close this tab? Its native draft may remain saved, but this view will be unloaded.'))return;break;}}catch{}
 for(const [viewKey,entry]of matching){entry.pane.remove();frames.delete(viewKey);}state.tabs=state.tabs.filter(t=>t.key!==key);state.slots=(state.slots??[]).filter(k=>k!==key);if(state.selected===key)state.selected=state.slots[0]??state.tabs[0]?.key??null;if(!state.slots.length&&state.selected)state.slots=[state.selected];render();
}
function open(route,mode='replace'){
 route=safeRoute(route);if(!route||route==='/sessions'||route==='/sessions/')return;
 const id=sessionId(route),existing=state.tabs.find(t=>id&&id!=='new'?sessionId(t.route)===id:t.route===route);
 if(existing){mode==='add'?append(existing.key):select(existing.key);return;}
 if(state.tabs.length>=24){document.querySelector('#status').textContent='Close a tab before opening more (24-tab limit).';return;}
 const title=sessions.get(id)?.name??(id==='new'?'New session':id?id.slice(0,8):route.startsWith('/settings')?'Settings':'Workspace browser');
 const tab={key:crypto.randomUUID(),route,title};state.tabs.push(tab);mode==='add'?append(tab.key):select(tab.key);if(innerWidth<650)document.body.classList.add('hide-sidebar');
}
function ensure(tab,viewKey){
 let entry=frames.get(viewKey);if(entry)return entry;
 const pane=el('section','pane');pane.dataset.key=tab.key;const header=el('div','pane-header');const dot=el('span','dot');const title=el('span','pane-title',tab.title);const actions=el('div','pane-actions');
 const focus=el('button','','⤢');focus.title='Maximize / restore pane';focus.setAttribute('aria-label','Maximize '+tab.title);focus.onclick=()=>{if(!state.maximized){state.maximized=tab.key;}else state.maximized=null;state.selected=tab.key;render();};
 const native=el('a','','↗');native.href=tab.route;native.target='_blank';native.rel='noopener';native.title='Open full native interface';
 const remove=el('button','','×');remove.title='Close tab';remove.onclick=()=>close(tab.key);actions.append(focus,native,remove);header.append(dot,title,actions);
 const iframe=el('iframe');iframe.dataset.personaRole='chat';iframe.title=tab.title;iframe.src=tab.route;header.onpointerdown=()=>{if(state.selected!==tab.key){state.selected=tab.key;render();}};
 const splitter=el('div','pane-resize');splitter.tabIndex=0;splitter.setAttribute('role','separator');splitter.setAttribute('aria-label','Resize chat columns');splitter.setAttribute('aria-orientation','vertical');
 let drag;
 splitter.onpointerdown=e=>{const shown=visibleTabs(state),index=Number(pane.dataset.index);if(index<0||index>=shown.length-1||state.maximized)return;const weights=columnWidths(),sum=weights.reduce((a,b)=>a+b,0);drag={index,x:e.clientX,weights,total:panes.getBoundingClientRect().width,sum};splitter.setPointerCapture(e.pointerId);document.body.classList.add('resizing');e.preventDefault();};
 splitter.onpointermove=e=>{if(!drag)return;const {index,x,weights,total,sum}=drag,pair=weights[index]+weights[index+1],left=Math.max(pair*.1,Math.min(pair*.9,weights[index]+(e.clientX-x)/total*sum)),next=[...weights];next[index]=left;next[index+1]=pair-left;state.widths??={};state.widths[state.layout]=next;applyWidths();};
 const end=()=>{drag=null;document.body.classList.remove('resizing');write();};splitter.onpointerup=end;splitter.onpointercancel=end;splitter.onlostpointercapture=end;
 splitter.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key)||state.maximized)return;const shown=visibleTabs(state),i=Number(pane.dataset.index);if(i<0||i>=shown.length-1)return;e.preventDefault();const w=columnWidths(),pair=w[i]+w[i+1],left=Math.max(pair*.1,Math.min(pair*.9,w[i]+(e.key==='ArrowRight'?.05:-.05)*pair));w[i]=left;w[i+1]=pair-left;state.widths??={};state.widths[state.layout]=w;applyWidths();write();};
 pane.append(header,iframe,splitter);panes.append(pane);entry={pane,iframe,title,dot,native,splitter,tabKey:tab.key};frames.set(viewKey,entry);return entry;
}
function columnWidths(){return state.widths?.[state.layout]?.length===state.layout?[...state.widths[state.layout]]:Array(state.layout).fill(1);}
function applyWidths(){const visible=state.maximized?1:visibleTabs(state).length;panes.style.gridTemplateColumns=columnWidths().slice(0,visible).map(w=>'minmax(160px,'+w+'fr)').join(' ')||'1fr';}
function render(){
 tabs.replaceChildren();if(state.maximized&&!state.tabs.some(t=>t.key===state.maximized))state.maximized=null;const visible=state.maximized?[state.tabs.find(t=>t.key===state.maximized)]:visibleTabs(state);panes.dataset.layout=String(state.layout);
 for(const entry of frames.values())entry.pane.hidden=true;
 for(const tab of state.tabs){
  const session=sessions.get(sessionId(tab.route));if(session)tab.title=session.name;
  const button=el('div','tab');button.setAttribute('role','tab');button.tabIndex=state.selected===tab.key?0:-1;button.setAttribute('aria-selected',String(state.selected===tab.key));button.onclick=()=>select(tab.key);button.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')select(tab.key);};button.draggable=true;button.ondragstart=e=>e.dataTransfer.setData('text/persona-tab',tab.key);button.ondragover=e=>e.preventDefault();button.ondrop=e=>{e.preventDefault();const key=e.dataTransfer.getData('text/persona-tab'),from=state.tabs.findIndex(t=>t.key===key),to=state.tabs.indexOf(tab);if(from>=0){state.tabs.splice(to,0,state.tabs.splice(from,1)[0]);render();}};
  const dot=el('span','dot'+(session?.thinking?' working':''));dot.title=session?.thinking?'Working':session?.active?'Connected':'Offline';const label=el('span','label',tab.title);button.title=tab.title;const plus=el('button','add-pane','+');plus.setAttribute('aria-label','Add '+tab.title+' to panels');plus.title='Add chat on the right';plus.onclick=e=>{e.stopPropagation();append(tab.key);};const remove=el('button','close','×');remove.setAttribute('aria-label','Close '+tab.title);remove.onclick=e=>{e.stopPropagation();close(tab.key);};button.append(dot,label,plus,remove);tabs.append(button);
 }
 visible.forEach((tab,index)=>{const slot=state.maximized?(state.slots??[]).indexOf(tab.key):index,entry=ensure(tab,tab.key+(slot===0?':left':':right'));entry.pane.hidden=false;entry.pane.style.order=index;entry.pane.dataset.index=index;entry.splitter.hidden=!!state.maximized||index===visible.length-1;entry.pane.classList.toggle('active',tab.key===state.selected);entry.title.textContent=tab.title;entry.iframe.title=tab.title;entry.native.href=tab.route;entry.dot.classList.toggle('working',!!sessions.get(sessionId(tab.route))?.thinking);});applyWidths();
 document.querySelector('#empty').hidden=!!state.tabs.length;
 for(const b of document.querySelectorAll('[data-layout]'))b.setAttribute('aria-pressed',String(Number(b.dataset.layout)===state.layout));
 document.title=(state.tabs.find(t=>t.key===state.selected)?.title??'Workspace')+' · Persona Workflow';write();
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.source!=='persona-workspace'||event.data.version!==1)return;
 const isList=event.source===list.contentWindow,entry=[...frames.entries()].find(([,e])=>e.iframe.contentWindow===event.source);if(!isList&&!entry)return;
 const data=event.data;
 if(data.type==='theme'&&isList){for(const [key,value]of Object.entries(data.theme??{}))if(['bg','text','muted','line','panel'].includes(key)&&typeof value==='string'&&CSS.supports('color',value))document.documentElement.style.setProperty('--'+key,value);}
 if(data.type==='sessions'&&Array.isArray(data.sessions)){for(const s of data.sessions)if(typeof s.id==='string'&&typeof s.name==='string')sessions.set(s.id,{...sessions.get(s.id),...s,name:s.name.slice(0,100)});render();}
 if(data.type==='focus'&&entry&&state.selected!==entry[1].tabKey){state.selected=entry[1].tabKey;render();}
 if(data.type==='tab-shortcut'&&Number.isInteger(data.index)&&state.tabs[data.index])select(state.tabs[data.index].key);
 if(data.type==='route'){
  const route=safeRoute(data.route);if(!route)return;
  if(isList){if(route!=='/sessions'&&route!=='/sessions/'){state.maximized=null;open(route,data.mode);if(!/^\/sessions\/[a-zA-Z0-9_-]+$/.test(route)){list.src='/sessions';}}}
  else{const tab=state.tabs.find(t=>t.key===entry[1].tabKey);if(tab){tab.route=route;render();}}
 }
});
for(const b of document.querySelectorAll('[data-layout]'))b.onclick=()=>{state.maximized=null;setLayout(state,Number(b.dataset.layout));render();};
document.querySelector('#new').onclick=document.querySelector('#start').onclick=()=>open('/sessions/new');
document.querySelector('#sidebar-toggle').onclick=()=>document.body.classList.toggle('hide-sidebar');
document.addEventListener('keydown',e=>{if(e.altKey&&/^[1-9]$/.test(e.key)){const tab=state.tabs[Number(e.key)-1];if(tab){e.preventDefault();select(tab.key);}}});
const resizer=document.querySelector('#sidebar-resize');resizer.onpointerdown=e=>{resizer.setPointerCapture(e.pointerId);document.body.classList.add('resizing');};resizer.onpointermove=e=>{if(resizer.hasPointerCapture(e.pointerId))document.documentElement.style.setProperty('--sidebar',Math.max(220,Math.min(440,e.clientX))+'px');};resizer.onpointerup=e=>{resizer.releasePointerCapture(e.pointerId);document.body.classList.remove('resizing');};resizer.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const w=document.querySelector('#sidebar').getBoundingClientRect().width;document.documentElement.style.setProperty('--sidebar',Math.max(220,Math.min(440,w+(e.key==='ArrowRight'?15:-15)))+'px');};
if(innerWidth<650)document.body.classList.add('hide-sidebar');
const requested=safeRoute(new URL(location.href).searchParams.get('open')??'');if(requested)open(requested);render();
