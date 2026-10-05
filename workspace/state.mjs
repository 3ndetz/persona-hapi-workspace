export const KEY='persona.workspace.v1';
export function safeRoute(value){
 try{const u=new URL(value,'https://workspace.invalid');if(u.origin!=='https://workspace.invalid'||!/^\/(?:sessions(?:\/[a-zA-Z0-9_-]+(?:\/(?:files|file|terminal))?)?|settings(?:\/[a-zA-Z0-9_/-]+)?|browse)\/?$/.test(u.pathname))return null;
  for(const key of [...u.searchParams.keys()])if(/token|auth|secret|key/i.test(key))u.searchParams.delete(key);
  return u.pathname+u.search;
 }catch{return null;}
}
export function sessionId(route){return route?.match(/^\/sessions\/([a-zA-Z0-9_-]+)(?:\/|\?|$)/)?.[1];}
export function restore(raw){
 let data;try{data=JSON.parse(raw);}catch{return {tabs:[],selected:null,layout:1};}
 const tabs=Array.isArray(data?.tabs)?data.tabs.filter(t=>t&&typeof t.key==='string'&&safeRoute(t.route)).slice(0,24).map(t=>({key:t.key.slice(0,100),route:safeRoute(t.route),title:String(t.title??'Session').slice(0,100)})):[];
 const widths={};for(let n=1;n<=6;n++){const w=data?.widths?.[n];if(Array.isArray(w)&&w.length===n&&w.every(v=>Number.isFinite(v)&&v>0&&v<=100))widths[n]=w;}
 return {tabs,selected:tabs.some(t=>t.key===data?.selected)?data.selected:tabs[0]?.key??null,layout:[1,2,3,4,5,6].includes(data?.layout)?data.layout:1,...(Array.isArray(data?.slots)?{slots:data.slots.filter(key=>tabs.some(t=>t.key===key)).slice(0,6)}:{}),...(Object.keys(widths).length?{widths}:{})};
}
export function visibleTabs(state){
 const selected=state.tabs.find(t=>t.key===state.selected);
 const assigned=(state.slots??[]).map(k=>state.tabs.find(t=>t.key===k)).filter(Boolean);
 return (assigned.length?assigned:selected?[selected]:[]).slice(0,state.layout);
}
export function choose(state,key){
 if(!state.tabs.some(t=>t.key===key))return;
 const slots=visibleTabs(state).map(t=>t.key);state.selected=key;
 // The right-hand views stay fixed even when the same session is chosen on the left.
 slots[0]=key;
 state.slots=slots;
}
export function addPane(state,key){
 if(!state.tabs.some(t=>t.key===key))return false;
 const slots=visibleTabs(state).map(t=>t.key);
 if(slots.includes(key)){state.selected=key;return true;}
 if(slots.length>=6)return false;
 slots.push(key);state.slots=slots;state.layout=slots.length;state.selected=key;return true;
}
export function setLayout(state,count){
 if(![1,2,3,4,5,6].includes(count))return;
 const assigned=(state.slots??[]).filter(k=>state.tabs.some(t=>t.key===k));
 state.slots=[...assigned,...state.tabs.map(t=>t.key).filter(k=>!assigned.includes(k))].slice(0,count);state.layout=count;
}
