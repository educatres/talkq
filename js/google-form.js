import {formResponseUrl} from './utils.js';
export async function submitEvent(config,event){const fd=new FormData();for(const [name,entry] of Object.entries(config.fields)){if(!entry)continue;let value=event[name]??'';if(typeof value==='boolean')value=String(value);fd.append(entry,value)}await fetch(formResponseUrl(config.formUrl),{method:'POST',mode:'no-cors',body:fd})}
