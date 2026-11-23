(() => {
  const rules = window.fregatBarRules, save = window.fregatBarSave;
  const game = document.querySelector(".bar-game");
  const find = selector => game.querySelector(selector);
  const glass = find(".bar-glass"), counter = find(".bar-counter"), tap = find("#bar-tap");
  const sip = find("#bar-sip"), message = find("#bar-message"), photo = find("#bar-photo");
  const number = new Intl.NumberFormat("ru-RU");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let panel = "shelf", nextRanking = 0, loadingRank = false;
  const rows = new Map();
  const imageURL = item => "media/bar/" + item.img;

  function animateGlass(node, frames, duration) {
    if (reduced.matches) return;
    node.getAnimations().forEach(a => a.cancel());
    node.animate(frames, {duration, easing:"ease-out"});
  }
  function burst(value) {
    if (reduced.matches) return;
    const coin = document.createElement("span");
    coin.className="bar-float";coin.setAttribute("aria-hidden","true");coin.textContent="+"+value;tap.append(coin);
    coin.animate([{opacity:1,translate:"0 0"},{opacity:0,translate:(Math.random()*60-30)+"px -55px"}],
      {duration:520,easing:"ease-out"}).onfinish=()=>coin.remove();
  }
  function drinkEffect(item) {
    message.textContent = item.name + " · " + item.effect;
    if (reduced.matches) return;
    counter.querySelector(".bar-fx")?.remove();
    const layer=document.createElement("div");
    layer.className="bar-fx fx-"+item.id;layer.setAttribute("aria-hidden","true");
    counter.append(layer);
    const pattern={
      baltika:[22,.05,-1], bear:[17,-.25,1], hunt:[15,1,.6],
      stoparik:[18,-.35,1], flask:[4,0,0], ice:[20,-.65,1],
      tsar:[10,0,-1], beam:[19,.2,-1], jager:[16,1,-.4], steersman:[20,-.2,-1]
    }[item.id];
    for(let i=0;i<pattern[0];i++){
      const dot=document.createElement("i");
      dot.textContent=item.id==="flask"?"":item.glyph;
      const ring=item.id==="flask";
      dot.style.left=(ring?50:pattern[1]===1?Math.random()*75:Math.random()*100)+"%";
      dot.style.top=(ring?54:pattern[2]<0?55+Math.random()*40:Math.random()*65)+"%";
      dot.style.fontSize=(14+Math.random()*24)+"px";
      layer.append(dot);
      const dx=pattern[1]*150+(Math.random()-.5)*55,dy=pattern[2]*(80+Math.random()*100);
      dot.animate([{opacity:0,transform:ring?"translate(-50%,-50%) scale(.2)":"scale(.5)"},
        {opacity:.89,offset:.25},{opacity:0,transform:ring?"translate(-50%,-50%) scale(4)":"translate("+dx+"px,"+dy+"px) rotate("+Math.round(dx)+"deg)"}],
        {duration:1400,delay:ring?i*180:Math.random()*270,fill:"both"});
    }
    setTimeout(()=>layer.remove(),2150);
  }
  function showPhoto(item) {
    const img=photo.querySelector("img");
    img.src=imageURL(item);img.alt=item.name;find("#bar-caption").textContent=item.name;
    photo.querySelector("p").textContent=item.type||item.info;
    photo.showModal();
  }
  photo.querySelector("button").onclick=()=>photo.close();
  photo.addEventListener("click",e=>{if(e.target===photo)photo.close();});
  async function buy(item,kind) {
    if(!await save.action(kind,item.id))return;
    if(kind==="pour"){
      message.textContent=item.name+" в рюмке.";
      animateGlass(find(".bar-fill"),[{transform:"translateY(130px)"},{transform:"translateY(-3px)"},{transform:"none"}],520);
    }else message.textContent=kind==="eat"?item.name+" · бонус на 120 тапов.":item.name+" · уровень "+save.current()[item.id];
  }
  function row(item,target,kind) {
    const wrap=document.createElement("div");wrap.className="bar-row";
    const thumb=document.createElement("button");thumb.type="button";thumb.className="bar-thumb "+item.id;
    thumb.setAttribute("aria-label","Увеличить фото · "+item.name);
    const img=document.createElement("img");img.alt="";img.src=imageURL(item);thumb.append(img);
    thumb.onclick=()=>showPhoto(item);
    const words=document.createElement("span");
    const name=document.createElement("strong");name.textContent=item.name;
    const detail=document.createElement("small");detail.textContent=item.type||item.info;
    words.append(name,detail);
    const button=document.createElement("button");button.className="bar-price";button.type="button";
    button.onclick=()=>buy(item,kind);wrap.append(thumb,words,button);target.append(wrap);
    rows.set(item.id,{button,detail});
  }
  rules.drinks.forEach(d=>row(d,find("#bar-drinks"),"pour"));
  rules.snacks.forEach(d=>row(d,find("#bar-food"),"eat"));
  rules.upgrades.forEach(d=>row(d,find("#bar-equipment"),"upgrade"));
  function display(item,text,disabled) {
    const button=rows.get(item.id).button;
    button.textContent=text;button.disabled=disabled;
    button.setAttribute("aria-label",item.name+" · "+text);
  }
  function render() {
    if(game.hidden)return;
    const s=save.current(), chosen=rules.drinks.find(d=>d.id===s.selected);
    find("#bar-balance").textContent=number.format(s.coins);find("#bar-power").textContent="+"+rules.power(s);
    find("#bar-rate").textContent=rules.rate(s);
    find("#bar-serving").textContent=s.full&&chosen?chosen.name:"Пустая рюмка";
    sip.hidden=!chosen;sip.textContent=s.full?"Выпить":"Налить ещё";
    counter.classList.toggle("has-drink",s.full);if(chosen)counter.style.setProperty("--liquid",chosen.color);
    find("#bar-count").textContent=s.owned.length+" / "+rules.drinks.length;
    for(const d of rules.drinks){
      const owned=s.owned.includes(d.id),poured=s.full&&chosen===d;
      display(d,poured?"В рюмке":owned?"Налить":number.format(d.cost)+" FC",poured||(!owned&&s.coins<d.cost));
    }
    for(const u of rules.upgrades){
      const due=rules.price(u,s[u.id]),max=s[u.id]>=rules.levelCap;
      rows.get(u.id).detail.textContent=u.info+" · Ур. "+s[u.id];
      display(u,max?"Макс.":number.format(due)+" FC",max||s.coins<due);
    }
    for(const food of rules.snacks){
      rows.get(food.id).detail.textContent="+"+food.boost+" FC за тап · 120 тапов";
      display(food,number.format(food.cost)+" FC",s.coins<food.cost||!!s.bites);
    }
    find("#bar-bites").textContent=s.bites?rules.snacks.find(i=>i.id===s.snack).name+" · осталось тапов: "+s.bites:"Выбери закуску для прибавки к следующим 120 тапам.";
    const p=save.profile();
    find("#bar-enroll").hidden=!!p.name;
    find("#bar-profile").textContent=p.name?p.name+" · "+save.status():"Введи ник, чтобы попасть в общий рейтинг.";
  }
  tap.onclick=async()=>{
    const amount=rules.power(save.current());
    if(!await save.action("tap"))return;
    burst(amount);
    animateGlass(glass,[{transform:"scale(.95) rotate(-3deg)"},{transform:"scale(1.015) rotate(1deg)"},{transform:"none"}],200);
    if(save.current().full)animateGlass(find(".bar-fill"),[{transform:"rotate(-4deg)"},{transform:"rotate(2deg)"},{transform:"none"}],310);
  };
  sip.onclick=async()=>{
    const s=save.current(),item=rules.drinks.find(d=>d.id===s.selected);
    if(!item)return;
    if(!s.full)return buy(item,"pour");
    if(await save.action("sip")){
      drinkEffect(item);animateGlass(glass,[{transform:"none"},{transform:"translateY(-8%) rotate(-32deg)",offset:.52},{transform:"none"}],470);
    }
  };
  async function ranking(force=false){
    if(game.hidden||panel!=="rich"||loadingRank||(!force&&Date.now()<nextRanking))return;
    loadingRank=true;
    try{
      const res=await fetch(save.endpoint,{cache:"no-store",signal:AbortSignal.timeout(6500)});
      if(!res.ok)throw Error();
      const {leaders}=await res.json();
      const list=find("#bar-leaders");list.replaceChildren();
      leaders.forEach((p,i)=>{
        const li=document.createElement("li");
        for(const text of [String(i+1),p.name,number.format(p.coins)+" FC"]){
          const el=document.createElement("span");el.textContent=text;li.append(el);
        }
        list.append(li);
      });
      find("#bar-rank-status").textContent=leaders.length?"":"Стол пока свободен. Можно занять первое место.";
    }catch{find("#bar-rank-status").textContent="Рейтинг временно недоступен. Прогресс остаётся в браузере.";}
    finally{loadingRank=false;nextRanking=Date.now()+4000;}
  }
  find("#bar-enroll").onsubmit=async e=>{
    e.preventDefault();
    const input=find("#bar-nick"),name=input.value.trim();
    if(!name||/[\p{Cc}\p{Cf}]/u.test(name)){input.setCustomValidity("Введи ник от 1 до 20 символов.");input.reportValidity();return;}
    await save.register(name);
  };
  find("#bar-nick").oninput=e=>e.target.setCustomValidity("");
  game.querySelectorAll("[data-bar-panel]").forEach(button=>button.onclick=()=>{
    panel=button.dataset.barPanel;
    for(const b of game.querySelectorAll("[data-bar-panel]")){
      const selected=b===button;b.setAttribute("aria-pressed",String(selected));find("#bar-"+b.dataset.barPanel).hidden=!selected;
    }
    message.textContent={shelf:"Открой бутылку один раз и наливай бесплатно.",upgrades:"Доход за секунду начисляется и после выхода.",snacks:"Нажми на фото, чтобы рассмотреть закуску.",rich:"Места считаются по текущему балансу Fregat Coin."}[panel];
    render();ranking(true);
  });
  window.addEventListener("bar:change",render);
  window.addEventListener("bar:synced",()=>ranking(true));
  window.addEventListener("fregat:view",()=>{if(game.hidden){if(photo.open)photo.close();return;}render();save.sync();ranking(true);});
  setInterval(()=>{if(!game.hidden&&!document.hidden){render();ranking();}},1000);
  render();if(!game.hidden)save.sync();
})();
