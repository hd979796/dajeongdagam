/* 사옥 화면 (디자인 10 의 index.html 인라인 스크립트를 떼어 냄, 개발 26). 업무 글 없음. 업무 자료는 office.load(state)로만. */
(function(){
"use strict";
/* 공개 자료: 부서 이름, 팀장 얼굴(게임 인물). 업무 글은 office.load(state)로만 받는다. */
var ROOMS = [
  {id:"ceo",  grp:"A", name:"대표실",     face:null, hero:"face_hero.png", c:"#c8553d", floor:"mat"},
  {id:"pd",   grp:"A", name:"총괄이사실", face:"face_hwarang.png",  c:"#5d7fa8"},
  {id:"plan", grp:"A", name:"기획실",     face:"face_teller.png",   c:"#7d9a4f"},
  {id:"item", grp:"A", name:"아이템실",   face:"face_merchant.png", c:"#d39a3a"},
  {id:"art",  grp:"A", name:"디자인실",   face:"face_herb.png",     c:"#c66f8a"},
  {id:"dev",  grp:"B", name:"개발실",     face:"face_smith.png",    c:"#5f8f8a", floor:"tile"},
  {id:"qa",   grp:"B", name:"QA실",       face:"face_villager.png", c:"#8a79b8", floor:"tile"},
  {id:"sec",  grp:"B", name:"보안실",     face:"face_patrol.png",   c:"#6b7f63"},
  {id:"acct", grp:"B", name:"회계실",     face:"face_keeper.png",   c:"#a8814f"},
  {id:"pr",   grp:"B", name:"홍보실",     face:"face_nangdo.png",   c:"#e07a52"}
];
var FURN = {
  ceo: [["rug",30,18,44,46],["desk",38,46,26,14],["shelf",8,30,4,56],["plant",80,22,8,0],["plant",80,70,8,0],["jar",10,82,6,0],["chair-big",46,26,10,0]],
  dev: [["desk",10,48,30,14],["mon",14,50,8,6],["mon",28,50,8,6],["desk",58,48,30,14],["mon",62,50,8,6],["mon",76,50,8,6],["rack",8,74,10,18],["rack",20,74,10,18],["plant",86,74,9,0]],
  def: [["desk",22,46,56,15],["mon",42,48,16,7],["plant",78,72,14,0]]
};
var PROPS = {
  pd:[["shelf",8,72,30,7]], plan:[["shelf",8,72,34,7],["round",72,22,14,0]], item:[["chest",10,70,22,14],["jar",40,74,10,0]],
  art:[["jar",10,72,10,0],["jar",24,74,8,0],["poster",62,20,22,10]], qa:[["phone",12,72,9,12],["phone",26,72,9,12]],
  sec:[["chest",10,70,24,14]], acct:[["shelf",8,72,34,7],["chest",50,72,18,12]], pr:[["poster",60,20,26,12],["poster",12,72,18,10]]
};
/* 휴게실: 소파·차·창가. 가로(L)는 세로로 긴 방, 세로(P)는 가로로 넓은 방 */
var REST_FURN = [
  ["window onL",94,10,4,80],["sun onL",56,10,40,80],["sofa onL",62,10,24,82],["round onL",37,42,22,0],["cup onL",41,46,5,0],["cup onL",50,52,5,0],["kettle onL",44,56,7,0],["plant onL",8,4,14,0],["plant onL",8,88,12,0],
  ["window onP",10,93,80,4],["sun onP",10,56,80,40],["sofa onP",8,64,84,26],["round onP",44,30,12,0],["cup onP",47,36,3,0],["cup onP",52,40,3,0],["kettle onP",48,44,4,0],["plant onP",3,6,8,0],["plant onP",90,6,8,0]
];
var REST_L = [[.2,.2],[.2,.4],[.2,.6],[.2,.8],[.74,.17],[.74,.39],[.74,.61],[.74,.83],[.47,.86]];
var REST_P = [[.14,.4],[.3,.4],[.7,.4],[.86,.4],[.2,.77],[.35,.77],[.5,.77],[.65,.77],[.8,.77]];

var $ = function(id){return document.getElementById(id)};
var plan = $("plan");
var roomEl = {}, H = {}, order = [];
var HAND_SVG = '<svg class="hand" viewBox="0 0 40 48" aria-hidden="true"><g fill="#e9a073"><rect x="6" y="10" width="7" height="22" rx="3.5"/><rect x="13.5" y="4" width="7" height="26" rx="3.5"/><rect x="21" y="6" width="7" height="24" rx="3.5"/><rect x="28.5" y="12" width="6.5" height="20" rx="3.2"/><rect x="6" y="22" width="29" height="20" rx="9"/><rect x="0" y="24" width="12" height="7" rx="3.5" transform="rotate(-35 6 27)"/></g><rect x="9" y="40" width="22" height="8" rx="3" fill="#e9805f"/></svg>';

function piece(cls,x,y,w,h){
  var d=document.createElement("span"); d.className="f "+cls;
  d.style.left=x+"%"; d.style.top=y+"%"; d.style.width=w+"%";
  if(h) d.style.height=h+"%"; else d.style.aspectRatio="1";
  return d;
}

/* 방 그리기 */
ROOMS.forEach(function(r){
  var b=document.createElement("div");
  b.className="room "+r.grp+(r.floor?" "+r.floor:""); b.style.gridArea=r.id; b.style.setProperty("--c",r.c);
  b.innerHTML='<span class="door"></span><span class="tag"><i></i></span><span class="beacon"></span><span class="task"></span>';
  b.querySelector(".tag").appendChild(document.createTextNode(r.name));
  var tb=document.createElement("i"); tb.className="tbadge"; tb.setAttribute("aria-label","할 일"); b.querySelector(".tag").appendChild(tb);
  (FURN[r.id]||FURN.def).concat(PROPS[r.id]||[]).forEach(function(p){b.appendChild(piece.apply(null,p))});
  if(r.hero){ /* 대표실: 주인공 얼굴이 의자 자리에 앉아 있다 (대표님 11:26) */
    var hs=document.createElement("span"); hs.className="hero"; hs.setAttribute("aria-hidden","true");
    var hi=new Image(); hi.src=r.hero; hi.alt=""; hs.appendChild(hi); b.appendChild(hs);
  }
  plan.appendChild(b); roomEl[r.id]=b;
});
var rest=document.createElement("div");
rest.className="room R lounge"; rest.style.gridArea="rest"; rest.style.setProperty("--c","#d9a04e");
rest.innerHTML='<span class="door"></span><span class="tag"><i></i>휴게실</span>';
REST_FURN.forEach(function(p){rest.appendChild(piece.apply(null,p))});
plan.appendChild(rest);
var hall=document.createElement("div"); hall.className="hall"; hall.setAttribute("aria-hidden","true");
hall.innerHTML='<span class="runner"></span><span class="f plant p1"></span><span class="sign">다정다감컴퍼니<small>삼한제일</small></span>';
plan.appendChild(hall);
var layer=document.createElement("div"); layer.className="heads"; plan.appendChild(layer);

/* 팀장 얼굴 */
ROOMS.forEach(function(r){
  if(!r.face) return;
  var el=document.createElement("button"); el.type="button"; el.className="head"; el.style.setProperty("--c",r.c);
  el.innerHTML='<span class="ring"></span>'+HAND_SVG+'<span class="typing" aria-hidden="true"><i></i><i></i><i></i></span>';
  var im=new Image(); im.src=r.face; im.alt=""; im.decoding="async"; el.querySelector(".ring").appendChild(im);
  var h={id:r.id, r:r, el:el, place:"rest", pos:{x:0,y:0}, walkId:0, rest:order.length,
         st:{status:"rest",task:"",hand:false,urgent:false,msgs:[]}, local:[], chosen:{}, handAck:null, urgAck:null, wasRaised:false};
  /* 손들기·급한 일이면 대화창, 아니면 "지금 하는 일" 말풍선 (대표님 11:26) */
  el.addEventListener("click",function(e){ e.stopPropagation(); if(raised(h)||urgentOpen(h)) openChat(h.id); else if(todoCount(h.id)) goTodo(h.id); else showTip(h); });
  layer.appendChild(el); H[r.id]=h; order.push(r.id); label(h);
});

/* ── 자리와 걷기 ── */
function portrait(){return window.matchMedia("(orientation:portrait)").matches}
function rel(el){var a=el.getBoundingClientRect(),p=plan.getBoundingClientRect();return {x:a.left-p.left,y:a.top-p.top,w:a.width,h:a.height}}
function mid(el){var r=rel(el);return {x:r.x+r.w/2,y:r.y+r.h/2}}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function seatOf(h,place){
  var r,s;
  if(place==="room"){r=rel(roomEl[h.id]); s=h.id==="dev"?[.4,.52]:[.5,.5];}
  else{r=rel(rest); s=(portrait()?REST_P:REST_L)[h.rest];}
  return {x:r.x+r.w*s[0],y:r.y+r.h*s[1]};
}
function doorOf(h,place){return mid((place==="room"?roomEl[h.id]:rest).querySelector(".door"))}
function hallPt(p){var r=rel(hall); return r.w>=r.h?{x:clamp(p.x,r.x+8,r.x+r.w-4),y:r.y+r.h/2}:{x:r.x+r.w/2,y:clamp(p.y,r.y+8,r.y+r.h-4)}}
function setPos(h,p,ms){
  h.pos=p; var s=h.el.offsetWidth;
  h.el.style.transitionDuration=(ms||0)+"ms";
  h.el.style.transform="translate("+(p.x-s/2).toFixed(1)+"px,"+(p.y-s/2).toFixed(1)+"px)";
}
function walk(h,to){
  var tok=++h.walkId, from=h.place; h.place=to; if(tipId===h.id) hideTip();
  var d1=doorOf(h,from), d2=doorOf(h,to);
  var pts=[d1,hallPt(d1),hallPt(d2),d2,seatOf(h,to)];
  var speed=Math.max(150,plan.clientWidth/4.5,plan.clientHeight/4), i=0; /* 화면 크기와 상관없이 3~4초 안에 도착 */
  h.el.classList.add("walking");
  (function step(){
    if(tok!==h.walkId) return;
    if(i>=pts.length){h.el.classList.remove("walking");return;}
    var p=pts[i++], ms=Math.max(40,Math.hypot(p.x-h.pos.x,p.y-h.pos.y)/speed*1000);
    setPos(h,p,ms); setTimeout(step,ms);
  })();
}
function snapAll(){order.forEach(function(id){var h=H[id];h.walkId++;h.el.classList.remove("walking");setPos(h,seatOf(h,h.place),0)})}
snapAll();
var rt; window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(snapAll,120)});

/* ── 소리 (Web Audio 합성, 소리 파일 없음) ── */
var ctx=null, soundOn=true, siren=null, entered=false;
function ding(){
  if(!ctx||!soundOn) return;
  var t=ctx.currentTime;
  [[1318.5,.22],[2637,.06]].forEach(function(n){
    var o=ctx.createOscillator(), g=ctx.createGain();
    o.type="sine"; o.frequency.value=n[0];
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(n[1],t+.01); g.gain.exponentialRampToValueAtTime(.0005,t+.9);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+.95);
  });
}
function sirenOn(){
  if(!ctx||siren) return;
  var o=ctx.createOscillator(), lfo=ctx.createOscillator(), depth=ctx.createGain(), lp=ctx.createBiquadFilter(), g=ctx.createGain();
  o.type="triangle"; o.frequency.value=820; lfo.type="sine"; lfo.frequency.value=.9; depth.gain.value=300;
  lp.type="lowpass"; lp.frequency.value=2600; g.gain.value=0;
  lfo.connect(depth).connect(o.frequency); o.connect(lp).connect(g).connect(ctx.destination);
  g.gain.linearRampToValueAtTime(.07,ctx.currentTime+.15);
  o.start(); lfo.start(); siren={o:o,lfo:lfo,g:g};
}
function sirenOff(){
  if(!siren) return; var s=siren; siren=null; var t=ctx.currentTime;
  s.g.gain.cancelScheduledValues(t); s.g.gain.setValueAtTime(s.g.gain.value,t); s.g.gain.linearRampToValueAtTime(0,t+.12);
  s.o.stop(t+.15); s.lfo.stop(t+.15);
}
$("sound").addEventListener("click",function(){
  soundOn=!soundOn; this.setAttribute("aria-pressed",String(soundOn)); this.textContent=soundOn?"소리 켜짐":"소리 꺼짐"; alarms();
});

/* ── 상태 ── */
function sig(h){var m=h.st.msgs[h.st.msgs.length-1]; return m?m.t+"|"+m.from+"|"+m.text:"";}
function raised(h){return h.st.hand && h.handAck!==sig(h)}
function urgentOpen(h){return h.st.urgent && h.urgAck!==sig(h)}
function label(h){
  var s=h.r.name+" 팀장"+(h.st.status==="answering"?", 대표님 말에 답하는 중":h.place==="room"?", 일하는 중":", 쉬는 중");
  if(urgentOpen(h)) s+=", 급한 일"; else if(raised(h)) s+=", 손 들었음";
  h.el.setAttribute("aria-label",s+" — 대화창 열기");
}
function render(h){
  var up=raised(h), ug=urgentOpen(h);
  h.el.classList.toggle("raised",up||ug);
  h.el.classList.toggle("urgent",ug);
  h.el.classList.toggle("acked",h.st.urgent&&!ug);
  h.el.classList.toggle("answering",h.st.status==="answering");
  roomEl[h.id].classList.toggle("alarm",ug);
  roomEl[h.id].querySelector(".task").textContent=h.place==="room"?h.st.task:"";
  label(h);
}
function alarms(){
  var any=order.some(function(id){return urgentOpen(H[id])});
  $("edge").classList.toggle("on",any);
  if(any&&entered&&soundOn) sirenOn(); else sirenOff();
}
function str(v,n){return (typeof v==="string"?v:"").slice(0,n)}

function load(state){
  if(!state||typeof state!=="object") return;
  var list=Array.isArray(state.heads)?state.heads:[], seen={}, newHand=false;
  list.forEach(function(x){
    if(!x||!H[x.id]) return; seen[x.id]=1; var h=H[x.id];
    var msgs=(Array.isArray(x.msgs)?x.msgs:[]).slice(-60).map(function(m){
      var o={from:m&&m.from==="대표"?"대표":"팀장", t:str(m&&m.t,8), text:str(m&&m.text,2000)};
      /* 고르기 단추: choices:[{key:"1",label:"…"}] 최대 4개 (대표님 11:26) */
      if(m&&Array.isArray(m.choices)) o.choices=m.choices.slice(0,4).map(function(c){return {key:str(c&&c.key,4),label:str(c&&c.label,80)}})
        .filter(function(c){return c.key&&c.label});
      return o;
    });
    var stt=x.status==="work"||x.status==="answering"?x.status:"rest";
    h.st={status:stt, task:str(x.task,60), hand:x.hand===true, urgent:x.urgent===true, msgs:msgs};
    /* 전달된 답이 state에 들어오면 화면의 "전달 대기" 줄을 지운다 */
    h.local=h.local.filter(function(l){return !msgs.some(function(m){return m.from==="대표"&&m.text===l.text})});
  });
  order.forEach(function(id){
    var h=H[id];
    if(!seen[id]) h.st={status:"rest",task:"",hand:false,urgent:false,msgs:[]};
    var target=h.st.status==="rest"?"rest":"room";   /* 답하는 중은 자기 자리에서 */
    if(target!==h.place) walk(h,target);
    var r=raised(h)||urgentOpen(h); if(r&&!h.wasRaised) newHand=true; h.wasRaised=r;
    render(h);
  });
  var u=$("updated");
  readTodos(state.todos);
  lastUpd=str(state.updated,8);
  if(lastUpd){u.hidden=false;u.textContent="고친 때 "+lastUpd;} else u.hidden=true;
  if(newHand&&entered) ding();
  alarms();
  if(openId) drawChat();
  drawBar();
  drawTodos();
  if(tipId) showTip(H[tipId]);
}

/* ── 대화창 ── */
var openId=null, lastFocus=null;
function nowHM(){var d=new Date();return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}
function openChat(id){
  openId=id; lastFocus=H[id].el;
  $("modal").classList.add("open"); $("modal").setAttribute("aria-hidden","false");
  drawChat(); $("reply").value=""; $("sendBtn").disabled=true;
  setTimeout(function(){(urgentOpen(H[id])?$("ackBtn"):$("reply")).focus()},30);
}
function closeChat(){
  openId=null; $("modal").classList.remove("open"); $("modal").setAttribute("aria-hidden","true");
  if(lastFocus) lastFocus.focus();
}
function drawChat(){
  var h=H[openId]; if(!h) return;
  var f=$("chatFace"); f.style.setProperty("--c",h.r.c); f.innerHTML=""; var im=new Image(); im.src=h.r.face; im.alt=""; f.appendChild(im);
  $("chatName").textContent=h.r.name+" 팀장";
  $("urgentbar").classList.toggle("on",urgentOpen(h));
  drawMsgs($("msgs"),h);
}
function msgKey(m){return m.t+"|"+m.text}
/* 고른 단추: 이 화면에서 고른 것, 또는 state 에 "키. 라벨" 답이 이미 들어온 것 */
function pickedOf(h,m){
  if(h.chosen[msgKey(m)]) return h.chosen[msgKey(m)];
  var i=h.st.msgs.indexOf(m), later=(i<0?[]:h.st.msgs.slice(i+1)).concat(h.local), k="";
  (m.choices||[]).forEach(function(c){ var t=c.key+". "+c.label; if(!k&&later.some(function(x){return x.from==="대표"&&x.text===t})) k=c.key; });
  return k;
}
function drawMsgs(box,h){
  box.textContent="";
  var all=h.st.msgs.concat(h.local);
  if(!all.length){var e=document.createElement("p");e.className="empty-msg";e.textContent="아직 올린 말이 없습니다.";box.appendChild(e);}
  all.forEach(function(m){
    var d=document.createElement("div"); d.className="m "+(m.from==="대표"?"me":"lead"); d.textContent=m.text;
    var meta=document.createElement("span"); meta.className="meta"; meta.textContent=(m.from==="대표"?"대표":"팀장")+(m.t?" · "+m.t:"");
    if(m.pending){var w=document.createElement("span");w.className="wait"+(m.st==="failed"?" fail":"");w.textContent=" · "+sentLabel(m);meta.appendChild(w);}
    d.appendChild(meta);
    if(m.from!=="대표"&&m.choices&&m.choices.length){
      var row=document.createElement("div"); row.className="choices"; var pk=pickedOf(h,m);
      m.choices.forEach(function(c){
        if(pk&&pk!==c.key) return;               /* 고른 뒤에는 고른 것만 */
        var b=document.createElement("button"); b.type="button"; b.className="choice"+(pk?" picked":"");
        var k=document.createElement("span"); k.className="k"; k.textContent=c.key;
        b.appendChild(k); b.appendChild(document.createTextNode(c.label));
        if(pk){ b.disabled=true; var p=document.createElement("span"); p.className="pk"; p.textContent="고름"; b.appendChild(p); }
        else b.addEventListener("click",function(){ if(sendReply(h,c.key+". "+c.label)){ h.chosen[msgKey(m)]=c.key; redraw(); } });
        row.appendChild(b);
      });
      d.appendChild(row);
    }
    box.appendChild(d);
  });
  box.scrollTop=box.scrollHeight;
}
function sentLabel(m){
  if(m.st==="sent") return "보냄"+(m.num?" #"+m.num:"");
  if(m.st==="linked") return "깃헙 화면에서 마저 보내 주세요";
  if(m.st==="failed") return "못 보냄";
  return "보내는 중…";
}
/* lock.js 가 알려 주는 보냄 결과: sent(#번호) / linked(새 탭) / failed / undone(되돌림) */
document.addEventListener("office:reply",function(e){
  var d=e.detail||{}, h=H[d.headId]; if(!h) return;
  var it=null;
  for(var i=h.local.length-1;i>=0;i--){ var l=h.local[i]; if(l.text===d.text&&(d.state==="undone"?l.num===d.num:l.st!=="sent"||d.state==="linked")){it=l;break;} }
  if(!it) return;
  if(d.state==="undone"){
    h.local.splice(h.local.indexOf(it),1);
    Object.keys(tdLocal).forEach(function(id){ var t=todos.filter(function(x){return x.id===id})[0]; if(t&&t.dept===d.headId&&tdLocal[id].text===d.text) delete tdLocal[id]; });
    Object.keys(h.chosen).forEach(function(k){ h.st.msgs.forEach(function(m){ if(msgKey(m)===k&&(m.choices||[]).some(function(c){return c.key===h.chosen[k]&&c.key+". "+c.label===d.text})) delete h.chosen[k]; }); });
  } else { it.st=d.state; if(d.num) it.num=d.num; }
  redraw();
});
/* 보내기 한 곳: 대화창·아래 줄·고르기 단추 (lock.js 의 onReply 가 막으면 false) */
function sendReply(h,text){
  var item={from:"대표",t:nowHM(),text:text,pending:true,st:"sending"};
  h.local.push(item);    /* 먼저 넣어 둔다: lock.js 의 결과 소식이 바로 올 수 있다 */
  var sent=false;
  try{ sent = typeof office.onReply==="function" && office.onReply(h.id,text)!==false; }catch(err){ sent=false; }
  if(!sent){ h.local.splice(h.local.indexOf(item),1); redraw(); return false; }
  h.handAck=sig(h); h.urgAck=sig(h); h.wasRaised=false;
  render(h); alarms(); redraw();
  return true;
}
function redraw(){ if(openId) drawChat(); drawBar(); drawTodos(); }

/* ── 대표님 할 일 판 (대표님 11:51) ── */
var TODO_DEPTS=["pd","plan","item","art","dev","qa","sec","acct","pr"];
var todos=[], tdLocal={};      /* tdLocal[id] = {done:bool, pick:"1", text:"보낸 글"} — 이 화면에서 누른 것 (메모리만) */
function readTodos(list){
  todos=(Array.isArray(list)?list:[]).slice(0,60).map(function(t,i){
    t=t||{}; var dept=TODO_DEPTS.indexOf(t.dept)>=0?t.dept:"pd";
    var link=typeof t.link==="string"&&(/^https:\/\/[^\s]+$/.test(t.link)||/^[\w\uAC00-\uD7A3.-]+\.html$/.test(t.link))?t.link:"";
    return {id:str(t.id,40)||("t"+i), dept:dept, title:str(t.title,80), why:str(t.why,140),
      steps:(Array.isArray(t.steps)?t.steps:[]).slice(0,10).map(function(s){return str(s,140)}).filter(Boolean),
      link:link, urgent:t.urgent===true, wait:str(t.wait,60), done:t.done===true,
      choices:(Array.isArray(t.choices)?t.choices:[]).slice(0,4).map(function(c){return {key:str(c&&c.key,4),label:str(c&&c.label,80)}}).filter(function(c){return c.key&&c.label})};
  }).filter(function(t){return t.title});
}
function tdDone(t){ var l=tdLocal[t.id]; return t.done||!!(l&&l.done); }
function tdActive(t){ return !tdDone(t)&&!t.wait; }
function todoCount(dept){ return todos.filter(function(t){return t.dept===dept&&!tdDone(t)}).length; }
function goTodo(dept){
  var s=$("todo-"+dept); if(!s) return;
  s.scrollIntoView({behavior:"smooth",block:"start"});
  s.classList.add("flash"); setTimeout(function(){s.classList.remove("flash")},1600);
}
function tdSend(t,text,pick){
  var h=H[t.dept]; if(!h) return;
  if(sendReply(h,text)){ tdLocal[t.id]={done:true,pick:pick||"",text:text}; drawTodos(); }
}
function el(tag,cls,txt){var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e;}
function card(t){
  var r=ROOMS.filter(function(x){return x.id===t.dept})[0]||{c:"#c8553d"};
  var c=el("article","card"+(t.urgent?" urgent":"")+(t.wait?" waiting":"")+(tdDone(t)?" done":"")); c.style.setProperty("--c",r.c);
  var h3=el("h3"); if(t.urgent&&!tdDone(t)) h3.appendChild(el("span","chip","급함")); h3.appendChild(document.createTextNode(t.title)); c.appendChild(h3);
  if(tdDone(t)){
    var l=tdLocal[t.id]; c.appendChild(el("span","donetag","다 했어요 ✓"+(l&&l.pick?" · "+l.text:"")));
    return c;
  }
  if(t.why) c.appendChild(el("p","why",t.why));
  if(t.steps.length){ var ol=el("ol"); t.steps.forEach(function(s){ol.appendChild(el("li",null,s))}); c.appendChild(ol); }
  if(!t.wait){
    if(t.choices.length){
      var row=el("div","choices");
      t.choices.forEach(function(ch){
        var b=el("button","choice"); b.type="button";
        b.appendChild(el("span","k",ch.key)); b.appendChild(document.createTextNode(ch.label));
        b.addEventListener("click",function(){ tdSend(t,ch.key+". "+ch.label,ch.key); });
        row.appendChild(b);
      });
      c.appendChild(row);
    }
    var acts=el("div","acts");
    if(t.link){ var a=el("a",null,"열기"); a.href=t.link; a.target="_blank"; a.rel="noopener noreferrer"; acts.appendChild(a); }
    if(!t.choices.length){ var d=el("button","donebtn","다 했어요"); d.type="button"; d.addEventListener("click",function(){ tdSend(t,"다 했어요: "+t.title); }); acts.appendChild(d); }
    if(acts.childNodes.length) c.appendChild(acts);
  } else {
    if(t.link){ var a2=el("div","acts"), a3=el("a",null,"열기"); a3.href=t.link; a3.target="_blank"; a3.rel="noopener noreferrer"; a2.appendChild(a3); c.appendChild(a2); }
    c.appendChild(el("div","waitband","기다리는 중 · "+t.wait));
  }
  return c;
}
function drawTodos(){
  var box=$("todoList"); box.textContent="";
  var act=todos.filter(tdActive), urg=act.filter(function(t){return t.urgent}).length, waiting=todos.filter(function(t){return !tdDone(t)&&t.wait}).length;
  $("todoN").textContent=String(act.length); $("todoN").classList.toggle("zero",!act.length);
  var sub=$("todoSub"); sub.textContent="";
  if(urg){ sub.appendChild(el("b",null,"급한 일 "+urg+"개")); sub.appendChild(document.createTextNode(" · ")); }
  sub.appendChild(document.createTextNode(act.length?"위에서부터 하시면 됩니다":"지금 하실 일은 없습니다"));
  if(waiting) sub.appendChild(document.createTextNode(" · 기다리는 일 "+waiting+"개"));
  /* 부서 차례: 지금 할 급한 일 → 끝나지 않은 급한 일(기다림 포함) → 지금 할 일 많은 부서 */
  var depts=TODO_DEPTS.filter(function(d){return todos.some(function(t){return t.dept===d})});
  function score(d){ var a=todos.filter(function(t){return t.dept===d&&tdActive(t)}); return (a.some(function(t){return t.urgent})?2000:0)+(todos.some(function(t){return t.dept===d&&t.urgent&&!tdDone(t)})?1000:0)+a.length*10; }
  depts.sort(function(a,b){return score(b)-score(a)});
  depts.forEach(function(d){
    var h=H[d], r=h?h.r:ROOMS.filter(function(x){return x.id===d})[0];
    var sec=el("section","dept"); sec.id="todo-"+d; sec.style.setProperty("--c",r.c);
    var hd=el("h3","dept-h"), ring=el("span","ring"); ring.style.setProperty("--c",r.c);
    if(r.face){ var im=new Image(); im.src=r.face; im.alt=""; ring.appendChild(im); }
    hd.appendChild(ring); hd.appendChild(document.createTextNode(r.name));
    var n=todos.filter(function(t){return t.dept===d&&tdActive(t)}).length;
    hd.appendChild(el("span","cnt",n?"할 일 "+n+"개":"")); sec.appendChild(hd);
    var mine=todos.filter(function(t){return t.dept===d});
    var a=mine.filter(tdActive).sort(function(x,y){return (y.urgent?1:0)-(x.urgent?1:0)});
    var w=mine.filter(function(t){return !tdDone(t)&&t.wait}).sort(function(x,y){return (y.urgent?1:0)-(x.urgent?1:0)});
    var dn=mine.filter(tdDone);
    if(a.length){ var g1=el("div","cards"); a.forEach(function(t){g1.appendChild(card(t))}); sec.appendChild(g1); }
    if(w.length){ sec.appendChild(el("p","sub-h","기다리는 중")); var g2=el("div","cards"); w.forEach(function(t){g2.appendChild(card(t))}); sec.appendChild(g2); }
    if(dn.length){ sec.appendChild(el("p","sub-h","다 한 일")); var g3=el("div","cards"); dn.forEach(function(t){g3.appendChild(card(t))}); sec.appendChild(g3); }
    box.appendChild(sec);
  });
  /* 방 이름패 배지: 그 부서의 끝나지 않은 일 수 */
  ROOMS.forEach(function(r){ var tb=roomEl[r.id].querySelector(".tbadge"), k=todoCount(r.id); tb.textContent=k?String(k):""; tb.classList.toggle("on",k>0); });
  $("todo").hidden=!entered||!todos.length;
}
$("chatClose").addEventListener("click",closeChat);
$("modal").addEventListener("click",function(e){if(e.target===this)closeChat()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&openId)closeChat()});
$("ackBtn").addEventListener("click",function(){
  var h=H[openId]; if(!h) return; h.urgAck=sig(h); h.wasRaised=raised(h); render(h); alarms(); drawChat(); $("reply").focus();
});
$("reply").addEventListener("input",function(){$("sendBtn").disabled=!this.value.trim()});
$("reply").addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();$("compose").requestSubmit()}});
$("compose").addEventListener("submit",function(e){
  e.preventDefault(); var h=H[openId], text=$("reply").value.trim(); if(!h||!text) return;
  /* 먼저 전달(lock.js: 깃헙 새 이슈 화면). 막히면(1,000자·키·전화번호) 글을 칸에 그대로 두고 끝 (개발 26) */
  if(!sendReply(h,text)) return;
  $("reply").value=""; $("sendBtn").disabled=true;
});

/* ── 2. 지금 하는 일 말풍선 ── */
var tipId=null, tipT=0, lastUpd="";
var tip=document.createElement("div"); tip.className="tip"; tip.hidden=true; tip.setAttribute("role","status"); layer.appendChild(tip);
function showTip(h){
  if(!h) return; tipId=h.id; tip.textContent="";
  var b=document.createElement("b"); b.textContent=h.r.name+" 팀장"; tip.appendChild(b);
  var t=document.createElement("span"); t.className="t-task";
  t.textContent=h.st.status==="answering"?"대표님 말에 답하는 중"+(h.st.task?" · "+h.st.task:""):h.st.status==="work"?(h.st.task||"일하는 중"):"쉬는 중";
  tip.appendChild(t);
  if(lastUpd){var u=document.createElement("span"); u.className="t-time"; u.textContent="고친 때 "+lastUpd; tip.appendChild(u);}
  var go=document.createElement("button"); go.type="button"; go.textContent="말 걸기";
  go.addEventListener("click",function(e){e.stopPropagation(); hideTip(); pick(h.id); $("barText").focus();});
  tip.appendChild(go);
  var s=h.el.offsetWidth, x=clamp(h.pos.x,70,plan.clientWidth-70);
  tip.style.left=x+"px"; tip.style.top=(h.pos.y-s/2)+"px"; tip.hidden=false;
  clearTimeout(tipT); tipT=setTimeout(hideTip,7000);
}
function hideTip(){ tipId=null; tip.hidden=true; clearTimeout(tipT); }
document.addEventListener("click",function(e){ if(tipId&&!tip.contains(e.target)) hideTip(); });

/* ── 3. 아래 대화 줄 ── */
var barId="pd";
order.forEach(function(id){
  var h=H[id], b=document.createElement("button"); b.type="button"; b.className="whob"; b.setAttribute("role","radio");
  b.style.setProperty("--c",h.r.c); b.title=h.r.name+" 팀장"; b.setAttribute("aria-label",h.r.name+" 팀장");
  var im=new Image(); im.src=h.r.face; im.alt=""; b.appendChild(im);
  b.addEventListener("click",function(){pick(id)});
  b.dataset.id=id; $("who").appendChild(b);
});
function pick(id){
  if(!H[id]) return; barId=id;
  Array.prototype.forEach.call($("who").children,function(b){b.setAttribute("aria-checked",String(b.dataset.id===id))});
  $("barText").placeholder=H[id].r.name.replace(/실$/,"")+" 팀장에게";
  drawBar();
}
function drawBar(){ var h=H[barId]; if(h) drawMsgs($("barlog"),h); }
$("barText").addEventListener("input",function(){$("barSend").disabled=!this.value.trim()});
$("barText").addEventListener("keydown",function(e){if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();$("barForm").requestSubmit()}});
$("barForm").addEventListener("submit",function(e){
  e.preventDefault(); var h=H[barId], text=$("barText").value.trim(); if(!h||!text) return;
  if(!sendReply(h,text)) return;
  $("barText").value=""; $("barSend").disabled=true;
});
$("logBtn").addEventListener("click",function(){
  logByUser=true; var on=!$("bar").classList.contains("open"); $("bar").classList.toggle("open",on); this.setAttribute("aria-expanded",String(on)); barSize();
});
function barSize(){ document.documentElement.style.setProperty("--barh",($("bar").hidden?0:$("bar").offsetHeight)+"px"); }
if(window.ResizeObserver) new ResizeObserver(function(){barSize(); clearTimeout(rt); rt=setTimeout(snapAll,120);}).observe($("bar"));
/* 기록 펼침: 대표님이 직접 누르기 전에는 화면 높이로 정한다(휴대폰 가로·낮은 화면은 접음). 돌리면 다시 정함 */
var logByUser=false;
function logAuto(){ if(logByUser) return; var on=window.innerHeight>=600; $("bar").classList.toggle("open",on); $("logBtn").setAttribute("aria-expanded",String(on)); barSize(); }
logAuto(); window.addEventListener("resize",logAuto);
pick("pd");

/* ── 들어가기: 비밀번호 → 상자 풀기(lock.js) → office.load → 들어감 (개발 26) ── */
function gateMsg(t){$("gateMsg").textContent=t}
function enter(){
  entered=true; $("gate").hidden=true; $("leave").hidden=false; $("bar").hidden=false; barSize(); drawBar(); drawTodos();
  if(order.some(function(id){return raised(H[id])||urgentOpen(H[id])})) ding();
  alarms();
  document.dispatchEvent(new Event("office:enter"));
}
var opening=false;
$("gateForm").addEventListener("submit",function(e){
  e.preventDefault(); if(opening) return;
  var pw=$("gatePw").value; $("gatePw").value="";
  if(!pw){gateMsg("비밀번호를 넣어 주세요."); $("gatePw").focus(); return;}
  if(!window.OfficeLock||!window.crypto||!crypto.subtle){gateMsg("이 화면은 https 주소에서만 열립니다."); return;}
  /* 소리는 누른 그 순간에만 허락되므로 풀기 전에 만든다 */
  if(!ctx){try{var AC=window.AudioContext||window.webkitAudioContext; if(AC){ctx=new AC(); if(ctx.resume) ctx.resume();}}catch(err){ctx=null}}
  opening=true; $("enter").disabled=true; gateMsg("여는 중…");
  OfficeLock.unlockWith(pw).then(function(){
    opening=false; $("enter").disabled=false; gateMsg(""); enter();
  },function(err){
    opening=false; $("enter").disabled=false; gateMsg(OfficeLock.errorText(err)); $("gatePw").focus();
  });
  pw="";
});
$("leave").addEventListener("click",function(){ if(window.OfficeLock) OfficeLock.lock(); else unload(); });
/* 나가기·잠그기: 화면의 업무 글을 모두 지우고 비밀번호 칸으로 */
function unload(reason){
  if(openId) closeChat();
  hideTip();
  todos=[]; tdLocal={}; $("todoList").textContent=""; $("todo").hidden=true;
  order.forEach(function(id){var h=H[id]; h.local=[]; h.chosen={}; h.handAck=null; h.urgAck=null; h.wasRaised=false;});
  load({heads:[]});
  entered=false; sirenOff(); alarms();
  $("updated").hidden=true; $("updated").textContent="";
  $("leave").hidden=true; $("bar").hidden=true; $("barText").value=""; $("barlog").textContent=""; barSize(); pick("pd");
  $("gate").hidden=false; gateMsg(reason||""); $("gatePw").focus();
}
setTimeout(function(){$("gatePw").focus()},0);

/* ── 바깥과 잇는 곳: 이 둘뿐 ── */
window.office = {
  load: load,                       /* office.load({updated, heads:[{id,status,task,hand,urgent,msgs}]}) */
  unload: unload,                   /* 나가기: 업무 글을 지우고 비밀번호 칸으로 (lock.js 의 OfficeLock.lock() 이 부름) */
  onReply: function(headId,text){ alert("전달 기능(lock.js)이 없어 보내지 못했습니다."); return false; }, /* lock.js 가 바꿔 낀다 */
  get entered(){return entered}
};

})();
