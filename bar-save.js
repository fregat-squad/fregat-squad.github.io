(() => {
  const rules=window.fregatBarRules, key="fregat-bar-profile-v2";
  const endpoint=location.protocol==="file:" || (["localhost","127.0.0.1"].includes(location.hostname)&&location.port==="4197")
    ? "http://127.0.0.1:4297/.netlify/functions/bar"
    : ["fregatsquad.ru","www.fregatsquad.ru","fregat-squad.github.io"].includes(location.hostname)
      ? "https://fregat-squad-multiplayer.netlify.app/.netlify/functions/bar" : "/.netlify/functions/bar";
  let cached, pendingTimer, busy=false, lastError="", memoryOnly=false;
  function read() {
    try {
      const saved=!memoryOnly && JSON.parse(localStorage.getItem(key));
      if(saved && saved.token && Array.isArray(saved.events)){
        saved.state=rules.restore(saved.state);
        return cached=saved;
      }
      if(!cached)cached={state:rules.restore(JSON.parse(localStorage.getItem("fregat-bar-v1"))),token:crypto.randomUUID(),name:"",seq:0,events:[],joined:false};
    } catch { cached??={state:rules.fresh(),token:crypto.randomUUID(),name:"",seq:0,events:[],joined:false}; }
    return cached;
  }
  function write(p){
    cached=p;
    try{localStorage.setItem(key,JSON.stringify(p));}
    catch{memoryOnly=true;}
    window.dispatchEvent(new Event("bar:change"));
  }
  const lock=fn=>navigator.locks?navigator.locks.request(key,fn):Promise.resolve(fn());
  function schedule(delay=650){
    if(!pendingTimer)pendingTimer=setTimeout(()=>{pendingTimer=0;sync();},delay);
  }
  function action(kind,id=""){
    return lock(()=>{
      const p=read(),at=Date.now();
      if(!rules.act(p.state,kind,id,at))return false;
      if(p.name){p.events.push({kind,id,at,seq:++p.seq});schedule();}
      write(p);return true;
    });
  }
  function register(name){
    return lock(()=>{
      const p=read();
      if(!p.name){p.base={...p.state};p.joined=false;}
      p.name=name;write(p);schedule(1);
    });
  }
  function packet(p){return {token:p.token,name:p.name,base:p.base,events:p.events.slice(0,150)};}
  async function sync(){
    if(busy)return;
    const p=read();if(!p.name || (p.joined && !p.events.length))return;
    busy=true;
    try{
      const r=await fetch(endpoint,{method:"POST",body:JSON.stringify(packet(p)),signal:AbortSignal.timeout(8000)});
      if(!r.ok)throw Error();
      const data=await r.json();
      await lock(()=>{
        const latest=read();
        // Another tab can acknowledge a newer batch before this request returns.
        const alreadyAcked=latest.seq-latest.events.length;
        if(latest.token!==p.token || data.seq<alreadyAcked)return;
        latest.joined=true;latest.events=latest.events.filter(e=>e.seq>data.seq);
        latest.state=rules.restore(data.state);
        for(const e of latest.events)rules.act(latest.state,e.kind,e.id,e.at);
        lastError="";write(latest);
      });
      window.dispatchEvent(new Event("bar:synced"));
    }catch{lastError="Нет связи. Изменения ждут отправки.";window.dispatchEvent(new Event("bar:change"));}
    finally{busy=false;const latest=read();if(latest.name && (!latest.joined || latest.events.length))schedule(lastError?5000:100);}
  }
  function current(){const p=read(),s={...p.state};rules.accrue(s,Date.now());return s;}
  window.addEventListener("storage",e=>{if(e.key===key)window.dispatchEvent(new Event("bar:change"));});
  window.addEventListener("online",()=>schedule(0));
  function flush(){const p=read();if(p.name && (!p.joined || p.events.length))navigator.sendBeacon?.(endpoint,JSON.stringify(packet(p)));}
  window.addEventListener("pagehide",flush);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)flush();else sync();});
  window.fregatBarSave={current,action,register,sync,endpoint,profile:read,
    status:()=>memoryOnly?"Хранилище браузера недоступно.":lastError || (!read().joined || read().events.length?"Синхронизация…":"Профиль сохранён")};
})();
