(() => {
  const drinks = [
    ["baltika","Балтика 9","Крепкое пиво",60,"#d7a548","baltika.jpg","Янтарная пена","○"],
    ["bear","Белый медведь","Светлое пиво",110,"#edcf76","bear.jpg","Полярный снег","❅"],
    ["hunt","Охота крепкая","Крепкое пиво",150,"#c08237","hunt.jpg","Листопад","❧"],
    ["stoparik","Стопарик","Водка · мини",180,"#d1e8ed","stoparik.png","Иней","❄"],
    ["flask","Чекушка","Четвертинка",850,"#bbdceb","flask.png","Круги по воде","◎"],
    ["ice","Finskiy Ice","Финский лёд",3200,"#bce6f8","ice.jpg","Ледяная крошка","◇"],
    ["tsar","Царская водка","Золотая",8200,"#edf0db","tsar.jpg","Золотая корона","♛"],
    ["beam","Jim Beam","Бурбон",19000,"#c88432","beam.jpg","Искры дуба","✦"],
    ["jager","Jägermeister","Травяной ликёр",32000,"#704c35","jager.jpg","Ночной лес","✴"],
    ["steersman","Steersman","Яблочный",48000,"#efbc55","../steersman.png","Яблочный закат","✧"]
  ].map(([id,name,type,cost,color,img,effect,glyph]) => ({id,name,type,cost,color,img,effect,glyph}));
  const snacks = [
    ["croutons","Кирики","Ржаные сухарики",75,1],
    ["pickles","Солёные огурцы","Хрустящие дольки",260,4],
    ["sprats","Бутики со шпротами","Чёрный хлеб, шпроты и укроп",650,10]
  ].map(([id,name,type,cost,boost]) => ({id,name,type,cost,boost,img:id+".jpg"}));
  const upgrades = [
    ["power","Ловкость рук",20,1,0],["staff","Бармен",55,0,1],
    ["bell","Звонок заказов",320,4,0],["apron","Фартук смены",900,0,6],
    ["till","Барная касса",3000,16,0],["fridge","Холодная витрина",6000,0,24]
  ].map(([id,name,base,tap,rate]) => ({id,name,base,tap,rate,img:id+".jpg",info: tap ? "+"+tap+" FC за тап" : "+"+rate+" FC / сек"}));
  const levelCap = 25;
  const valid = n => Number.isSafeInteger(n) && n >= 0;
  // Replacement bottles inherit purchases at the same prices, including queued pours.
  const replacements = new Map([["pepper","ice"],["citrus","tsar"],["cedar","beam"]]);
  const currentDrink = id => replacements.get(id) ?? id;
  const price = (item,level) => Math.ceil(item.base * 1.55 ** level);
  const fresh = (at=Date.now()) => ({coins:0, time:at, owned:[], selected:"", full:false, bites:0, snack:"", ...Object.fromEntries(upgrades.map(u=>[u.id,0]))});
  function restore(raw,now=Date.now()) {
    const s=fresh(now);
    if (!raw || !valid(raw.coins) || !valid(raw.time)) return s;
    s.time=Math.min(now,raw.time); s.coins=raw.coins;
    for(const u of upgrades) if(valid(raw[u.id])) s[u.id]=Math.min(levelCap,raw[u.id]);
    const owned = new Set(Array.isArray(raw.owned) ? raw.owned.map(currentDrink) : []);
    s.owned=drinks.filter(d=>owned.has(d.id)).map(d=>d.id);
    s.selected=s.owned.includes(currentDrink(raw.selected))?currentDrink(raw.selected):""; s.full=!!(s.selected && raw.full);
    if(snacks.some(i=>i.id===raw.snack) && valid(raw.bites)){s.snack=raw.snack;s.bites=Math.min(120,raw.bites);}
    return s;
  }
  const rate = s => upgrades.reduce((sum,u)=>sum+s[u.id]*u.rate,0);
  const power = s => 1+upgrades.reduce((sum,u)=>sum+s[u.id]*u.tap,0)+(s.bites ? snacks.find(i=>i.id===s.snack)?.boost || 0 : 0);
  function accrue(s,now) {
    const ticks=Math.max(0,Math.floor((now-s.time)/1000));
    s.coins=Math.min(Number.MAX_SAFE_INTEGER,s.coins+ticks*rate(s));s.time+=ticks*1000;
  }
  function act(s,kind,id,now) {
    accrue(s,now);
    if(kind==="tap"){s.coins=Math.min(Number.MAX_SAFE_INTEGER,s.coins+power(s));if(s.bites) s.bites--;return true;}
    if(kind==="sip" && s.full){s.full=false;return true;}
    if(kind==="pour"){
      id=currentDrink(id);
      const d=drinks.find(i=>i.id===id);if(!d)return false;
      if(!s.owned.includes(id)){if(s.coins<d.cost)return false;s.coins-=d.cost;s.owned.push(id);}
      s.selected=id;s.full=true;return true;
    }
    if(kind==="eat"){
      const item=snacks.find(i=>i.id===id);if(!item||s.coins<item.cost||s.bites)return false;
      s.coins-=item.cost;s.snack=id;s.bites=120;return true;
    }
    if(kind==="upgrade"){
      const u=upgrades.find(i=>i.id===id);if(!u||s[id]>=levelCap||s.coins<price(u,s[id]))return false;
      s.coins-=price(u,s[id]);s[id]++;return true;
    }
    return false;
  }
  const rules={drinks,snacks,upgrades,levelCap,price,fresh,restore,rate,power,accrue,act};
  if(typeof module!=="undefined" && module.exports) module.exports=rules;
  else window.fregatBarRules=rules;
})();
