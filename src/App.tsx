import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE  = "service_zp881x8";
const EMAILJS_TEMPLATE = "template_g2c9alk";
const EMAILJS_KEY      = "wDsY0mLjksWDdb0YT";

const APP_BASE_URL = "https://appvacancesv.vercel.app";

const PLATFORMS = {
  airbnb:  { name:"Airbnb",   color:"#FF5A5F", icon:"🏠" },
  abritel: { name:"Abritel",  color:"#4A90D9", icon:"🏡" },
  booking: { name:"Booking",  color:"#0057B8", icon:"🏨" },
  vrbo:    { name:"Vrbo",     color:"#1ECAD3", icon:"🏖️" },
  other:   { name:"Autre",    color:"#8B5CF6", icon:"🏘️" },
};
const AVATAR_COLORS = ["#FF6B9D","#4ECDC4","#FFD93D","#A78BFA","#6BCB77","#FF9A3C","#4D96FF","#F94892","#39AFEA","#C77DFF","#06D6A0","#F4845F"];
const TRIP_EMOJIS   = ["🏖️","🏔️","🌿","🏙️","🌊","⛷️","🌺","🏛️","🌄","🎪","🍇","🦋"];
const MONTHS_FR     = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR       = ["Lu","Ma","Me","Je","Ve","Sa","Di"];

const INITIAL_PEOPLE = [
  { id:"u1", name:"Sophie", email:"sophie@example.com", color:"#FF6B9D" },
  { id:"u2", name:"Marc",   email:"marc@example.com",   color:"#4ECDC4" },
  { id:"u3", name:"Léa",    email:"lea@example.com",    color:"#FFD93D" },
  { id:"u4", name:"Thomas", email:"thomas@example.com", color:"#A78BFA" },
];
const INITIAL_TRIPS = [
  { id:"t1", name:"Weekend Provence", emoji:"🌿", dates:"14–16 mars 2025",
    members:[{personId:"u1",status:"accepted"},{personId:"u2",status:"accepted"},{personId:"u3",status:"accepted"},{personId:"u4",status:"pending"}],
    properties:[
      { id:"p1", title:"Villa Les Cigales", platform:"airbnb", location:"Provence, France", lat:43.9, lng:5.1, price:420, nights:3, rating:4.8,
        image:"https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&q=80",
        pros:["Piscine privée","Vue panoramique","Proche marchés"], cons:["Pas de clim","Route étroite"],
        addedBy:"u1", votes:["u1","u2"], notes:[{authorId:"u1",text:"Parfait pour se détendre ☀️"}], url:"#" },
      { id:"p2", title:"Bastide en Luberon", platform:"booking", location:"Gordes, France", lat:43.84, lng:5.2, price:310, nights:3, rating:4.4,
        image:"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=80",
        pros:["Authentique","Grand jardin","BBQ"], cons:["WiFi lent","Vieille cuisine"],
        addedBy:"u3", votes:["u3","u1","u4"], notes:[], url:"#" },
    ]},
  { id:"t2", name:"Ski Chamonix", emoji:"⛷️", dates:"21–25 janv. 2025",
    members:[{personId:"u2",status:"accepted"},{personId:"u4",status:"accepted"}],
    properties:[
      { id:"p3", title:"Chalet Montagne Étoilée", platform:"abritel", location:"Chamonix, France", lat:45.9, lng:6.87, price:580, nights:4, rating:4.6,
        image:"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80",
        pros:["Vue Mont Blanc","Jacuzzi","Ski-in ski-out"], cons:["Cher","Loin du centre"],
        addedBy:"u2", votes:["u2"], notes:[{authorId:"u2",text:"Le jacuzzi après le ski 🎿🔥"}], url:"#" },
    ]},
];

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatDateRange(start, end) {
  if (!start) return "";
  const fmt = d => `${d.getDate()} ${MONTHS_FR[d.getMonth()].slice(0,3).toLowerCase()}. ${d.getFullYear()}`;
  if (!end || start.toDateString()===end.toDateString()) return fmt(start);
  if (start.getMonth()===end.getMonth()&&start.getFullYear()===end.getFullYear())
    return `${start.getDate()}–${end.getDate()} ${MONTHS_FR[start.getMonth()].slice(0,3).toLowerCase()}. ${start.getFullYear()}`;
  return `${fmt(start)} → ${fmt(end)}`;
}

function parseDateRange(str) {
  try {
    if (!str) return [null,null];
    const parts = str.split("→").map(s=>s.trim());
    const p0=new Date(parts[0]); const p1=parts[1]?new Date(parts[1]):null;
    if (isNaN(p0)) return [null,null];
    return [p0, p1&&!isNaN(p1)?p1:null];
  } catch { return [null,null]; }
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Avatar({ name, color, size=28, style:ext }) {
  return <div style={{ width:size,height:size,borderRadius:"50%",background:color,color:"#0a0a14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.42,fontWeight:800,fontFamily:"'Cormorant Garamond',serif",flexShrink:0,userSelect:"none",...ext }}>{name[0].toUpperCase()}</div>;
}

function Stars({ rating }) {
  return <span style={{ display:"inline-flex",alignItems:"center",gap:2 }}>{[1,2,3,4,5].map(s=><span key={s} style={{ fontSize:10,color:s<=Math.round(rating)?"#F4C542":"#2a2a3e" }}>★</span>)}<span style={{ fontSize:10,color:"#666",marginLeft:2 }}>{rating}</span></span>;
}

function PBadge({ platform }) {
  const p=PLATFORMS[platform];
  return <span style={{ background:p.color+"22",color:p.color,border:`1px solid ${p.color}55`,borderRadius:20,padding:"2px 7px",fontSize:10,fontWeight:700 }}>{p.icon} {p.name}</span>;
}

function Input({ value, onChange, placeholder, type="text", style:ext, autoFocus, onKeyDown }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} onKeyDown={onKeyDown} style={{ background:"#F5F2EE",border:"1px solid #E8E2D8",borderRadius:8,padding:"8px 12px",color:"#2C2517",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box",...ext }} />;
}

function Btn({ children, variant="ghost", onClick, style:ext, disabled }) {
  const vars={ gold:{background:"#c9a96e",color:"#0a0a14",border:"none"}, ghost:{background:"transparent",color:"#777",border:"1px solid #D5CFCA"}, danger:{background:"#2a0808",color:"#f87171",border:"1px solid #3d1010"}, teal:{background:"#0d2a2a",color:"#4ECDC4",border:"1px solid #1a4040"} };
  return <button disabled={disabled} onClick={onClick} style={{ border:"none",borderRadius:10,cursor:disabled?"default":"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12,transition:"all .15s",padding:"7px 14px",display:"inline-flex",alignItems:"center",gap:5,opacity:disabled?.4:1,...vars[variant],...ext }}>{children}</button>;
}

function Modal({ onClose, title, children, width=500 }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"#000c",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16 }} onClick={onClose}>
      <div style={{ background:"#FFFFFF",border:"1px solid #E8E2D8",borderRadius:20,padding:28,width:"100%",maxWidth:width,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px #000" }} onClick={e=>e.stopPropagation()}>
        {title&&<h2 style={{ margin:"0 0 22px",fontFamily:"'Cormorant Garamond',serif",color:"#c9a96e",fontSize:22,fontWeight:700 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:1.2,fontWeight:700,marginBottom:5 }}>{children}</div>;
}

function StatusPill({ status }) {
  const cfg={ accepted:{bg:"#0d2818",color:"#16A34A",label:"Accepté ✓"}, pending:{bg:"#1a160a",color:"#fbbf24",label:"En attente…"}, declined:{bg:"#2a0a0a",color:"#f87171",label:"Décliné ✗"} }[status]||{bg:"#1a1a2e",color:"#888",label:"Inconnu"};
  return <span style={{ background:cfg.bg,color:cfg.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700 }}>{cfg.label}</span>;
}

// ─── Calendar Picker ──────────────────────────────────────────────────────────

function CalendarPicker({ onSelect, initialStart, initialEnd }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [view, setView]   = useState(() => { const d=initialStart||today; return {year:d.getFullYear(),month:d.getMonth()}; });
  const [start, setStart] = useState(initialStart||null);
  const [end,   setEnd]   = useState(initialEnd||null);
  const [hover, setHover] = useState(null);

  const prevMonth = () => setView(v=>v.month===0?{year:v.year-1,month:11}:{...v,month:v.month-1});
  const nextMonth = () => setView(v=>v.month===11?{year:v.year+1,month:0}:{...v,month:v.month+1});

  const getDays = () => {
    const first=new Date(view.year,view.month,1), last=new Date(view.year,view.month+1,0);
    const offset=(first.getDay()+6)%7, days=[];
    for(let i=0;i<offset;i++) days.push(null);
    for(let d=1;d<=last.getDate();d++) days.push(new Date(view.year,view.month,d));
    return days;
  };

  const clickDay = d => {
    if(!start||(start&&end)){ setStart(d); setEnd(null); }
    else {
      if(d<start){ setEnd(start); setStart(d); }
      else if(d.toDateString()===start.toDateString()) setEnd(null);
      else setEnd(d);
    }
  };

  const inRange = d => {
    if(!d) return false;
    const e=end||hover; if(!start||!e) return false;
    const lo=start<e?start:e, hi=start<e?e:start;
    return d>lo&&d<hi;
  };

  useEffect(()=>{ onSelect(start,end); },[start,end]);

  return (
    <div style={{ background:"#FFFFFF",border:"1px solid #E8E2D8",borderRadius:14,padding:14,userSelect:"none",width:260 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <button onClick={prevMonth} style={{ background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:16,padding:"0 6px" }}>‹</button>
        <span style={{ fontSize:13,fontWeight:700,color:"#2C2517",fontFamily:"'Cormorant Garamond',serif" }}>{MONTHS_FR[view.month]} {view.year}</span>
        <button onClick={nextMonth} style={{ background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:16,padding:"0 6px" }}>›</button>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4 }}>
        {DAYS_FR.map(d=><div key={d} style={{ textAlign:"center",fontSize:9,color:"#444",fontWeight:700,padding:"2px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px 0" }}>
        {getDays().map((d,i)=>{
          const sel=(start&&d&&d.toDateString()===start.toDateString())||(end&&d&&d.toDateString()===end.toDateString());
          const rng=inRange(d), isToday=d&&d.toDateString()===today.toDateString();
          return <div key={i} onMouseEnter={()=>start&&!end&&d&&setHover(d)} onMouseLeave={()=>setHover(null)} onClick={()=>d&&clickDay(d)} style={{ height:30,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:sel?"50%":rng?"0":4,background:sel?"#c9a96e":rng?"#c9a96e18":"transparent",color:!d?"transparent":sel?"#0a0a14":isToday?"#c9a96e":"#ccc",cursor:d?"pointer":"default",fontSize:12,fontWeight:sel?700:400,transition:"background .1s" }}>{d?d.getDate():""}</div>;
        })}
      </div>
      <div style={{ marginTop:10,fontSize:11,color:"#c9a96e",textAlign:"center",minHeight:16 }}>
        {start&&!end&&"Sélectionnez la date de fin…"}
        {start&&end&&formatDateRange(start,end)}
        {!start&&<span style={{ color:"#333" }}>Sélectionnez la date de début</span>}
      </div>
      {start&&end&&<button onClick={()=>{setStart(null);setEnd(null);}} style={{ display:"block",margin:"6px auto 0",background:"none",border:"none",color:"#555",fontSize:10,cursor:"pointer",textDecoration:"underline" }}>Effacer</button>}
    </div>
  );
}

// ─── Trip Header Edit ─────────────────────────────────────────────────────────

function TripHeaderEdit({ trip, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(trip.name);
  const [emoji, setEmoji]     = useState(trip.emoji);
  const [dateStart, setDateStart] = useState(null);
  const [dateEnd,   setDateEnd]   = useState(null);

  const open = () => {
    setName(trip.name); setEmoji(trip.emoji);
    const [s,e]=parseDateRange(trip.dates||""); setDateStart(s); setDateEnd(e);
    setEditing(true);
  };
  const save = () => {
    if(!name.trim()) return;
    onUpdate({...trip,name:name.trim(),emoji,dates:formatDateRange(dateStart,dateEnd)||""});
    setEditing(false);
  };

  if(!editing) return (
    <div onClick={open} title="Cliquer pour modifier" style={{ cursor:"pointer" }}>
      <div style={{ fontSize:18,fontFamily:"'Cormorant Garamond',serif",fontWeight:700,color:"#2C2517",lineHeight:1.1,display:"flex",alignItems:"center",gap:6 }}>{trip.name}<span style={{ fontSize:11,color:"#333",fontWeight:400 }}>✎</span></div>
      {trip.dates?<div style={{ fontSize:11,color:"#555" }}>{trip.dates}</div>:<div style={{ fontSize:11,color:"#C5BFAA" }}>+ Ajouter des dates</div>}
    </div>
  );

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8,background:"#F5F2EE",border:"1px solid #c9a96e44",borderRadius:14,padding:"12px 14px",zIndex:10 }} onClick={e=>e.stopPropagation()}>
      <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
        {TRIP_EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ width:28,height:28,borderRadius:8,fontSize:14,cursor:"pointer",background:emoji===e?"#c9a96e33":"#0a0a18",border:`1px solid ${emoji===e?"#c9a96e":"#1e1e30"}`,padding:0 }}>{e}</button>)}
      </div>
      <Input value={name} onChange={setName} placeholder="Nom du séjour…" autoFocus onKeyDown={e=>e.key==="Enter"&&save()} style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700 }} />
      <div><Label>Dates</Label><CalendarPicker initialStart={dateStart} initialEnd={dateEnd} onSelect={(s,e)=>{setDateStart(s);setDateEnd(e);}} /></div>
      <div style={{ display:"flex",gap:6,justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={()=>setEditing(false)} style={{ fontSize:11 }}>Annuler</Btn>
        <Btn variant="gold" onClick={save} style={{ fontSize:11 }}>Enregistrer ✦</Btn>
      </div>
    </div>
  );
}

// ─── People Modal ─────────────────────────────────────────────────────────────

function buildTripInviteUrl(trip) {
  return `${APP_BASE_URL}/?trip=${trip.id}`;
}

function formatPropertiesForEmail(trip) {
  if (!trip.properties || trip.properties.length === 0) return "Aucun hébergement ajouté pour l'instant.";
  return trip.properties.map((p, i) => {
    const platform = PLATFORMS[p.platform]?.name || p.platform;
    const price = p.price ? `${p.price}€` : "";
    const nights = p.nights ? ` / ${p.nights} nuits` : "";
    const rating = p.rating ? ` ⭐ ${p.rating}` : "";
    return `${i + 1}. ${p.title} — ${platform} — ${p.location}${rating}\n   ${price}${nights}`;
  }).join("\n");
}

async function sendInviteEmail(person, trip, senderName) {
  const tripUrl = buildTripInviteUrl(trip);
  const membersCount = (trip.members || []).length;
  const propertiesText = formatPropertiesForEmail(trip);

  await emailjs.send(
    EMAILJS_SERVICE,
    EMAILJS_TEMPLATE,
    {
      to_name:          person.name,
      to_email:         person.email,
      from_name:        senderName,
      trip_name:        trip.name,
      trip_emoji:       trip.emoji || "🏖️",
      trip_dates:       trip.dates || "Dates à définir",
      trip_url:         tripUrl,
      members_count:    String(membersCount),
      properties_list:  propertiesText,
    },
    EMAILJS_KEY
  );
}

function PeopleModal({ people, trips, onClose, onSavePeople, onSaveTrips, currentUserPerson }) {
  const [pList, setPList] = useState(people.map(p=>({...p})));
  const [tList, setTList] = useState(trips.map(t=>({...t,members:[...t.members]})));
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [tab, setTab] = useState("people");
  const [inviteState, setInviteState] = useState({}); // "sending" | "sent" | "error"

  const handleInvite = async (person, trip, senderName) => {
    const key = `${trip.id}-${person.id}`;
    setInviteState(s => ({...s, [key]: "sending"}));
    try {
      await sendInviteEmail(person, trip, senderName);
      setInviteState(s => ({...s, [key]: "sent"}));
    } catch(err) {
      console.error("EmailJS error:", err);
      setInviteState(s => ({...s, [key]: "error"}));
    }
  };

  const addPerson = () => {
    const n=newName.trim(),e=newEmail.trim(); if(!n) return;
    setPList(prev=>[...prev,{id:"u"+Date.now(),name:n,email:e,color:AVATAR_COLORS[pList.length%AVATAR_COLORS.length]}]);
    setNewName(""); setNewEmail("");
  };
  const removePerson = id => { setPList(l=>l.filter(p=>p.id!==id)); setTList(l=>l.map(t=>({...t,members:t.members.filter(m=>m.personId!==id)}))); };
  const toggleMember = (tripId,personId) => setTList(l=>l.map(t=>{
    if(t.id!==tripId) return t;
    const exists=t.members.find(m=>m.personId===personId);
    return exists?{...t,members:t.members.filter(m=>m.personId!==personId)}:{...t,members:[...t.members,{personId,status:"pending"}]};
  }));
  const isMember = (tripId,personId) => tList.find(t=>t.id===tripId)?.members.some(m=>m.personId===personId);
  const getMemberStatus = (tripId,personId) => tList.find(x=>x.id===tripId)?.members.find(m=>m.personId===personId)?.status||null;
  const updateStatus = (tripId,personId,status) => setTList(l=>l.map(t=>t.id!==tripId?t:{...t,members:t.members.map(m=>m.personId===personId?{...m,status}:m)}));

  return (
    <Modal onClose={onClose} title="👥 Gestion des participants" width={600}>
      <div style={{ display:"flex",gap:4,marginBottom:22,background:"#FFFFFF",borderRadius:12,padding:4 }}>
        {[["people","👤 Carnet d'amis"],["assign","🗓️ Affectation aux séjours"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ flex:1,background:tab===k?"#c9a96e":"transparent",border:"none",borderRadius:9,padding:"8px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,color:tab===k?"#0a0a14":"#666" }}>{l}</button>
        ))}
      </div>

      {tab==="people"&&(
        <>
          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:20 }}>
            {pList.map((p,i)=>(
              <div key={p.id} style={{ background:"#F5F2EE",borderRadius:12,padding:"10px 14px",border:"1px solid #E0D9CE" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <Avatar name={p.name} color={p.color} size={34} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:"#2C2517",fontFamily:"'Cormorant Garamond',serif" }}>{p.name}</div>
                    {p.email?<div style={{ fontSize:11,color:"#555" }}>✉ {p.email}</div>:<div style={{ fontSize:11,color:"#f87171" }}>⚠ Pas d'e-mail</div>}
                  </div>
                  <div style={{ display:"flex",gap:3,flexWrap:"wrap",maxWidth:96 }}>
                    {AVATAR_COLORS.slice(0,8).map(c=><div key={c} onClick={()=>setPList(l=>l.map((x,j)=>j===i?{...x,color:c}:x))} style={{ width:13,height:13,borderRadius:"50%",background:c,cursor:"pointer",border:`2px solid ${p.color===c?"white":"transparent"}` }} />)}
                  </div>
                  <button onClick={()=>removePerson(p.id)} style={{ background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 2px" }} onMouseEnter={e=>e.currentTarget.style.color="#f87171"} onMouseLeave={e=>e.currentTarget.style.color="#333"}>×</button>
                </div>
              </div>
            ))}
          </div>
          <Label>Ajouter un ami</Label>
          <div style={{ display:"flex",flexDirection:"column",gap:8,background:"#FFFFFF",borderRadius:12,padding:14,border:"1px dashed #1e1e30" }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <div><Label>Prénom *</Label><Input value={newName} onChange={setNewName} placeholder="Camille…" onKeyDown={e=>e.key==="Enter"&&addPerson()} /></div>
              <div><Label>E-mail</Label><Input value={newEmail} onChange={setNewEmail} placeholder="camille@mail.com" type="email" onKeyDown={e=>e.key==="Enter"&&addPerson()} /></div>
            </div>
            <Btn variant="gold" onClick={addPerson} style={{ alignSelf:"flex-end" }}>+ Ajouter</Btn>
          </div>
        </>
      )}

      {tab==="assign"&&(
        <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
          {tList.map(t=>(
            <div key={t.id} style={{ background:"#FFFFFF",borderRadius:14,padding:14,border:"1px solid #E0D9CE" }}>
              <div style={{ fontSize:15,fontFamily:"'Cormorant Garamond',serif",color:"#2C2517",fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
                <span>{t.emoji}</span>{t.name}{t.dates&&<span style={{ fontSize:11,color:"#555",fontWeight:400 }}>· {t.dates}</span>}
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {pList.map(p=>{
                  const member=isMember(t.id,p.id), status=getMemberStatus(t.id,p.id), sentKey=`${t.id}-${p.id}`;
                  return (
                    <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,background:member?"#111128":"transparent",border:`1px solid ${member?"#1e1e40":"#111118"}`,borderRadius:10,padding:"8px 12px" }}>
                      <div onClick={()=>toggleMember(t.id,p.id)} style={{ width:18,height:18,borderRadius:5,border:`2px solid ${member?"#c9a96e":"#333"}`,background:member?"#c9a96e":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>{member&&<span style={{ fontSize:11,color:"#0a0a14",fontWeight:800 }}>✓</span>}</div>
                      <Avatar name={p.name} color={p.color} size={28} />
                      <div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:13,fontWeight:600,color:member?"#f0e6d3":"#666" }}>{p.name}</div>{p.email&&<div style={{ fontSize:10,color:"#444" }}>{p.email}</div>}</div>
                      {member&&<StatusPill status={status} />}
                      {member&&<select value={status} onChange={e=>updateStatus(t.id,p.id,e.target.value)} style={{ background:"#F5F2EE",border:"1px solid #D5CFCA",color:"#888",borderRadius:7,padding:"4px 6px",fontSize:11,fontFamily:"inherit",cursor:"pointer",outline:"none" }}><option value="pending">En attente</option><option value="accepted">Accepté</option><option value="declined">Décliné</option></select>}
                      {member&&p.email&&(()=>{
                        const st=inviteState[sentKey];
                        if(st==="sent")    return <span style={{ fontSize:11,color:"#16A34A",fontWeight:600 }}>✓ Envoyé</span>;
                        if(st==="sending") return <span style={{ fontSize:11,color:"#c9a96e" }}>⏳ Envoi…</span>;
                        if(st==="error")   return <span onClick={()=>handleInvite(p,t,currentUserPerson?.name||"L'organisateur")} style={{ fontSize:11,color:"#f87171",cursor:"pointer",fontWeight:600 }} title="Réessayer">✗ Erreur – réessayer</span>;
                        return <Btn variant="teal" style={{ fontSize:11,padding:"5px 10px" }} onClick={()=>handleInvite(p,t,currentUserPerson?.name||"L'organisateur")}>✉ Inviter</Btn>;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex",gap:10,marginTop:24 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex:1 }}>Annuler</Btn>
        <Btn variant="gold" onClick={()=>{onSavePeople(pList);onSaveTrips(tList);onClose();}} style={{ flex:2 }}>Enregistrer ✦</Btn>
      </div>
    </Modal>
  );
}

// ─── New Trip Modal ───────────────────────────────────────────────────────────

function NewTripModal({ people, onClose, onCreate }) {
  const [name,setName]=useState(""); const [emoji,setEmoji]=useState("🏖️"); const [sel,setSel]=useState([]);
  const [dateStart,setDateStart]=useState(null); const [dateEnd,setDateEnd]=useState(null);
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  return (
    <Modal onClose={onClose} title="✦ Nouveau séjour" width={460}>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <div><Label>Emoji</Label><div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>{TRIP_EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ width:36,height:36,borderRadius:10,fontSize:18,cursor:"pointer",background:emoji===e?"#c9a96e33":"#0e0e1e",border:`1px solid ${emoji===e?"#c9a96e":"#1e1e30"}` }}>{e}</button>)}</div></div>
        <div><Label>Nom *</Label><Input value={name} onChange={setName} placeholder="Weekend Côte d'Azur…" autoFocus /></div>
        <div><Label>Dates</Label><CalendarPicker onSelect={(s,e)=>{setDateStart(s);setDateEnd(e);}} /></div>
        <div><Label>Participants</Label><div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>{people.map(p=><button key={p.id} onClick={()=>toggle(p.id)} style={{ display:"flex",alignItems:"center",gap:6,background:sel.includes(p.id)?p.color+"33":"#0e0e1e",border:`1px solid ${sel.includes(p.id)?p.color:"#1e1e30"}`,borderRadius:20,padding:"5px 12px",cursor:"pointer" }}><Avatar name={p.name} color={p.color} size={20} /><span style={{ fontSize:12,color:sel.includes(p.id)?p.color:"#666",fontWeight:600 }}>{p.name}</span></button>)}</div></div>
      </div>
      <div style={{ display:"flex",gap:10,marginTop:22 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex:1 }}>Annuler</Btn>
        <Btn variant="gold" onClick={()=>{ if(!name.trim()) return; onCreate({id:"t"+Date.now(),name:name.trim(),emoji,dates:formatDateRange(dateStart,dateEnd)||"",members:sel.map(id=>({personId:id,status:"pending"})),properties:[]}); onClose(); }} style={{ flex:2 }}>Créer ✦</Btn>
      </div>
    </Modal>
  );
}

// ─── Add Property Modal ───────────────────────────────────────────────────────

function AddPropertyModal({ onClose, onAdd, onEdit, initialProperty, currentUserId }) {
  const isEdit = !!initialProperty;
  const [f,setF]=useState(isEdit ? {
    ...initialProperty,
    price:  String(initialProperty.price||""),
    nights: String(initialProperty.nights||""),
    rating: String(initialProperty.rating||""),
    pros:   (initialProperty.pros||[]).join(", "),
    cons:   (initialProperty.cons||[]).join(", "),
  } : {title:"",url:"",platform:"airbnb",location:"",price:"",nights:"",rating:"",pros:"",cons:"",image:""});
  const [priceMode,setPriceMode]=useState("nuit"); // "nuit" | "total"
  const [fetching,setFetching]=useState(false);
  const [fetchMsg,setFetchMsg]=useState({text:"",error:false});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));

  // Displayed price value depending on mode
  const displayPrice = ()=>{
    if(!f.price) return "";
    if(priceMode==="nuit") return f.price;
    const n=parseFloat(f.nights)||1;
    return String(Math.round(parseFloat(f.price)*n));
  };
  const handlePriceChange = v=>{
    if(priceMode==="nuit"){ s("price",v); return; }
    const n=parseFloat(f.nights)||1;
    s("price", v ? String(Math.round(parseFloat(v)/n)) : "");
  };
  const togglePriceMode = ()=>{
    setPriceMode(m=>m==="nuit"?"total":"nuit");
  };

  function detectPlatform(url) {
    if(url.includes("airbnb"))  return "airbnb";
    if(url.includes("abritel")) return "abritel";
    if(url.includes("booking")) return "booking";
    if(url.includes("vrbo"))    return "vrbo";
    return "other";
  }

  async function fetchInfo() {
    if(!f.url) return;
    setFetching(true);
    setFetchMsg({text:"Récupération des informations…",error:false});
    try {
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(f.url)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(f.url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(f.url)}`,
      ];
      let html = "";
      for (const proxied of proxies) {
        try {
          const resp = await fetch(proxied, { signal: AbortSignal.timeout(8000) });
          if (resp.ok) { html = await resp.text(); break; }
        } catch { /* essaie le proxy suivant */ }
      }
      if (!html) throw new Error("Tous les proxies ont échoué");
      const doc  = new DOMParser().parseFromString(html,"text/html");

      // Open Graph helpers
      const og  = name => doc.querySelector(`meta[property="og:${name}"]`)?.getAttribute("content")||"";
      const mta = name => doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content")||"";

      let title    = og("title")    || mta("title")    || doc.querySelector("h1")?.textContent?.trim()||"";
      let image    = og("image")    || mta("image")    || "";
      let location = og("locality") || "";
      let price    = "";
      let rating   = "";
      let desc     = og("description") || mta("description") || "";

      // JSON-LD structured data
      doc.querySelectorAll('script[type="application/ld+json"]').forEach(sc=>{
        try {
          const items=[].concat(JSON.parse(sc.textContent));
          items.forEach(item=>{
            if(!title    && item.name)                              title    = item.name;
            if(!image    && item.image)                             image    = Array.isArray(item.image)?item.image[0]:item.image;
            if(!rating   && item.aggregateRating?.ratingValue)      rating   = parseFloat(item.aggregateRating.ratingValue).toFixed(1);
            if(!price    && item.offers?.price)                     price    = String(item.offers.price);
            if(!price    && item.offers?.lowPrice)                  price    = String(item.offers.lowPrice);
            if(!location && item.address?.addressLocality)          location = [item.address.addressLocality,item.address.addressRegion,item.address.addressCountry].filter(Boolean).join(", ");
            if(!location && item.containedInPlace?.name)            location = item.containedInPlace.name;
          });
        } catch{}
      });

      // Airbnb-specific: JSON blobs embedded in page
      if(!price && f.url.includes("airbnb")) {
        const m = html.match(/"price":\{"amount":"?([\d.]+)"?/)||html.match(/"basePrice":\{"amount":"?([\d.]+)"?/);
        if(m) price = m[1];
      }
      // Booking-specific
      if(!price && f.url.includes("booking")) {
        const m = html.match(/data-price="([\d.]+)"/)||html.match(/"priceDisplayInfoIrene":\{"displayPrice":\{"amountPerStay":\{"amount":"?([\d.]+)"?/);
        if(m) price = m[1];
      }
      // Rating fallback from text
      if(!rating) {
        const m = html.match(/(\d\.\d)\s*\/\s*5/)||html.match(/note.*?(\d\.\d)/i)||html.match(/(\d\.\d)\s*★/);
        if(m) rating = m[1];
      }
      // Location fallback from title (e.g. "Villa Les Roses · Côte d'Azur")
      if(!location && title.includes("·")) {
        location = title.split("·").slice(1).join("·").trim();
        title    = title.split("·")[0].trim();
      }
      // Ensure image is a full URL
      if(image && image.startsWith("/")) {
        const base = new URL(f.url).origin;
        image = base + image;
      }
      // Take first image if multiple separated by comma
      if(image && image.includes(",")) image = image.split(",")[0].trim();

      const filled = {
        title:    title    || f.title,
        image:    image    || f.image,
        location: location || f.location,
        price:    price    || f.price,
        rating:   rating   || f.rating,
        platform: detectPlatform(f.url),
        url:      f.url,
        nights:   f.nights,
        pros:     f.pros,
        cons:     f.cons,
      };
      setF(filled);
      const found=[title&&"nom",image&&"photo",price&&"prix",rating&&"note",location&&"localisation"].filter(Boolean);
      setFetchMsg({text:`✓ Récupéré : ${found.length?found.join(", "):"infos de base"}. Vérifie et complète si besoin.`,error:false});
    } catch(e) {
      setFetchMsg({text:"Impossible de récupérer les infos automatiquement. Remplis le formulaire manuellement.",error:true});
    } finally {
      setFetching(false);
    }
  }

  return (
    <Modal onClose={onClose} title={isEdit ? "✦ Modifier le logement" : "✦ Ajouter un logement"} width={500}>
      {/* ── URL + bouton fetch ── */}
      <div style={{ background:"#FFFFFF",border:"1px solid #E8E2D8",borderRadius:10,padding:"12px 14px",marginBottom:14 }}>
        <Label>Lien du logement (Airbnb, Booking, Abritel, Vrbo…)</Label>
        <div style={{ display:"flex",gap:8,marginTop:4 }}>
          <Input value={f.url} onChange={v=>{ s("url",v); s("platform",detectPlatform(v)); }} placeholder="https://airbnb.com/rooms/…" style={{ flex:1 }} />
          <button onClick={fetchInfo} disabled={!f.url||fetching}
            style={{ background:f.url&&!fetching?"#c9a96e":"#1e1e30",color:f.url&&!fetching?"#080812":"#444",border:"none",borderRadius:8,padding:"0 14px",cursor:f.url&&!fetching?"pointer":"default",fontWeight:700,fontSize:13,whiteSpace:"nowrap",transition:"background .2s" }}>
            {fetching?"⏳ …":"⚡ Récupérer"}
          </button>
        </div>
        {fetchMsg.text&&<div style={{ fontSize:11,color:fetchMsg.error?"#f87171":"#6BCB77",marginTop:6,lineHeight:1.4 }}>{fetchMsg.text}</div>}
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:11 }}>
        <div><Label>Plateforme</Label><div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>{Object.entries(PLATFORMS).map(([k,p])=><button key={k} onClick={()=>s("platform",k)} style={{ background:f.platform===k?p.color+"33":"transparent",border:`1px solid ${f.platform===k?p.color:"#1e1e30"}`,color:f.platform===k?p.color:"#666",borderRadius:20,padding:"4px 12px",fontSize:12,cursor:"pointer",fontWeight:600 }}>{p.icon} {p.name}</button>)}</div></div>
        {[{k:"title",l:"Nom *",ph:"Villa Les Roses…"},{k:"location",l:"Localisation *",ph:"Côte d'Azur, France"}].map(x=><div key={x.k}><Label>{x.l}</Label><Input value={f[x.k]} onChange={v=>s(x.k,v)} placeholder={x.ph} /></div>)}
        <div><Label>URL image</Label><div style={{ display:"flex",gap:8,alignItems:"flex-start" }}>
          <Input value={f.image} onChange={v=>s("image",v)} placeholder="https://…" style={{ flex:1 }} />
          {f.image&&<img src={f.image} alt="" style={{ width:52,height:40,objectFit:"cover",borderRadius:6,border:"1px solid #E8E2D8",flexShrink:0 }} onError={e=>e.currentTarget.style.display="none"} />}
        </div></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
              <Label style={{ marginBottom:0 }}>Prix</Label>
              <button onClick={togglePriceMode} style={{ background:"#EAE4D8",border:"1px solid #2a2a40",borderRadius:20,padding:"2px 8px",fontSize:10,cursor:"pointer",color:"#c9a96e",fontWeight:700,lineHeight:1.5 }}>
                {priceMode==="nuit"?"€/nuit":"€ total"}
              </button>
            </div>
            <Input value={displayPrice()} onChange={handlePriceChange} placeholder={priceMode==="nuit"?"250":"750"} type="number" />
          </div>
          <div><Label>Nuits</Label><Input value={f.nights} onChange={v=>s("nights",v)} placeholder="3" type="number" /></div>
          <div><Label>Note /5</Label><Input value={f.rating} onChange={v=>s("rating",v)} placeholder="4.5" type="number" /></div>
        </div>
        {f.price&&f.nights&&<div style={{ fontSize:11,color:"#555",marginTop:-6 }}>
          {priceMode==="nuit"
            ? <>Total : <span style={{color:"#c9a96e",fontWeight:700}}>€{Math.round(parseFloat(f.price)*(parseFloat(f.nights)||1))}</span> pour {f.nights} nuit{parseFloat(f.nights)>1?"s":""}</>
            : <>Soit <span style={{color:"#c9a96e",fontWeight:700}}>€{Math.round(parseFloat(f.price))} / nuit</span> pour {f.nights} nuit{parseFloat(f.nights)>1?"s":""}</>
          }
        </div>}
        {[{k:"pros",l:"✓ Pour (séparés par ,)",ph:"Piscine, Vue mer…"},{k:"cons",l:"✗ Contre",ph:"Loin du centre…"}].map(x=><div key={x.k}><Label>{x.l}</Label><Input value={f[x.k]} onChange={v=>s(x.k,v)} placeholder={x.ph} /></div>)}
      </div>
      <div style={{ display:"flex",gap:10,marginTop:20 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex:1 }}>Annuler</Btn>
        <Btn variant="gold" onClick={()=>{
          if(!f.title||!f.location) return;
          const base = { title:f.title, url:f.url||"#", platform:f.platform, location:f.location, price:parseFloat(f.price)||0, nights:parseInt(f.nights)||1, rating:Math.min(5,parseFloat(f.rating)||4), image:f.image||"https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&q=80", pros:f.pros.split(",").map(s=>s.trim()).filter(Boolean), cons:f.cons.split(",").map(s=>s.trim()).filter(Boolean) };
          if(isEdit) { onEdit({...initialProperty, ...base}); }
          else { onAdd({...base, id:"p"+Date.now(), lat:43+Math.random()*5, lng:2+Math.random()*8, addedBy:currentUserId, votes:[currentUserId], notes:[], ratings:{}}); }
          onClose();
        }} style={{ flex:2 }}>{isEdit ? "Enregistrer ✦" : "Ajouter ✦"}</Btn>
      </div>
    </Modal>
  );
}

function avgRating(p) {
  const vals = Object.values(p.ratings||{}).filter(Boolean);
  if (!vals.length) return null;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}

function StarRatingBar({ property:p, currentUserId, people, onRate }) {
  const [hover, setHover] = useState(0);
  const myRating = (p.ratings||{})[currentUserId]||0;
  const avg = avgRating(p);
  const raters = Object.entries(p.ratings||{}).filter(([,v])=>v>0);
  const person = id => people.find(u=>u.id===id);

  return (
    <div style={{ background:"#FFFFFF",borderRadius:10,padding:"8px 10px",border:"1px solid #E0D9CE" }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
        {/* My stars */}
        <div style={{ display:"flex",alignItems:"center",gap:3 }}>
          <span style={{ fontSize:10,color:"#555",marginRight:2 }}>Ma note :</span>
          {[1,2,3,4,5].map(s=>(
            <span key={s} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)}
              onClick={()=>onRate(p.id, myRating===s?0:s)}
              style={{ fontSize:20,cursor:"pointer",color:(hover||myRating)>=s?"#F4C542":"#D5CFC5",transition:"color .1s",lineHeight:1 }}>★</span>
          ))}
          {myRating>0&&<span style={{ fontSize:11,color:"#F4C542",fontWeight:700,marginLeft:2 }}>{myRating}/5</span>}
          {myRating===0&&<span style={{ fontSize:10,color:"#333",fontStyle:"italic" }}>non noté</span>}
        </div>

        {/* Average */}
        {avg!==null&&(
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:5 }}>
            <span style={{ fontSize:10,color:"#555" }}>Moyenne :</span>
            <span style={{ fontSize:14,color:"#F4C542",fontWeight:800 }}>{avg.toFixed(1)}</span>
            <span style={{ fontSize:12,color:"#F4C542" }}>★</span>
            <span style={{ fontSize:10,color:"#444" }}>({raters.length} avis)</span>
          </div>
        )}
      </div>

      {/* Individual ratings */}
      {raters.length>0&&(
        <div style={{ display:"flex",gap:8,marginTop:8,flexWrap:"wrap" }}>
          {raters.map(([uid,val])=>{ const u=person(uid); if(!u) return null; return (
            <div key={uid} style={{ display:"flex",alignItems:"center",gap:4,background:"#F5F2EE",borderRadius:20,padding:"3px 8px 3px 5px",border:"1px solid #E0D9CE" }}>
              <Avatar name={u.name} color={u.color} size={16} />
              <span style={{ fontSize:10,color:u.color,fontWeight:600 }}>{u.name}</span>
              <span style={{ fontSize:10,color:"#F4C542",letterSpacing:-1 }}>{"★".repeat(val)}{"☆".repeat(5-val)}</span>
              <span style={{ fontSize:10,color:"#666" }}>{val}/5</span>
            </div>
          ); })}
        </div>
      )}
      {p.url&&p.url!=="#"&&<a href={p.url} target="_blank" rel="noreferrer" style={{ display:"block",marginTop:6,fontSize:11,color:"#4A90D9",textDecoration:"none" }}>→ Voir l'annonce</a>}
    </div>
  );
}

// ─── Property Card ────────────────────────────────────────────────────────────

function PropertyCard({ property:p, currentUserId, people, onRate, onAddNote, onDelete, onEdit, isWinner }) {
  const [noteText,setNoteText]=useState(""); const [showNote,setShowNote]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const person=id=>people.find(u=>u.id===id);
  const avg=avgRating(p);
  return (
    <div style={{ background:"#FFFFFF",border:`1px solid ${isWinner?"#c9a96e":"#181828"}`,borderRadius:16,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:isWinner?"0 0 0 1px #c9a96e44,0 8px 32px #c9a96e18":"none" }}>
      {isWinner&&<div style={{ background:"linear-gradient(90deg,#c9a96e,#e8c98a)",padding:"4px 14px",fontSize:9,fontWeight:800,color:"#0a0a14",letterSpacing:2,textTransform:"uppercase" }}>✦ Favori du groupe</div>}
      <div style={{ position:"relative",height:145,overflow:"hidden",flexShrink:0 }}>
        <img src={p.image} alt={p.title} style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }} />
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 40%,rgba(255,255,255,0.85) 100%)" }} />
        <div style={{ position:"absolute",top:10,left:10 }}><PBadge platform={p.platform} /></div>
        {/* Edit + Delete buttons */}
        <div style={{ position:"absolute",top:8,right:8,display:"flex",gap:4,alignItems:"center" }}>
          {confirmDelete?(
            <>
              <span style={{ fontSize:11,color:"#fff",background:"#ffffffcc",borderRadius:8,padding:"2px 6px" }}>Retirer ?</span>
              <button onClick={()=>onDelete(p.id)} style={{ background:"#ef4444",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,padding:"3px 8px",cursor:"pointer" }}>Oui</button>
              <button onClick={()=>setConfirmDelete(false)} style={{ background:"#EAE4D8",border:"none",borderRadius:6,color:"#aaa",fontSize:11,padding:"3px 8px",cursor:"pointer" }}>Non</button>
            </>
          ):(
            <>
              <button onClick={()=>onEdit(p)} title="Modifier ce logement"
                style={{ background:"#ffffffaa",border:"1px solid #DDD7CC",borderRadius:6,color:"#555",fontSize:13,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",lineHeight:1 }}>✏️</button>
              <button onClick={()=>setConfirmDelete(true)} title="Retirer ce logement"
                style={{ background:"#ffffffaa",border:"1px solid #DDD7CC",borderRadius:6,color:"#555",fontSize:13,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",lineHeight:1 }}>🗑</button>
            </>
          )}
        </div>
        {isWinner&&<div style={{ position:"absolute",bottom:10,right:10,background:"#c9a96e",color:"#0a0a14",borderRadius:20,padding:"3px 10px",fontSize:13,fontWeight:800,fontFamily:"'Cormorant Garamond',serif" }}>€{p.price*p.nights}</div>}
        {!isWinner&&<div style={{ position:"absolute",bottom:10,right:10,background:"#c9a96e",color:"#0a0a14",borderRadius:20,padding:"3px 10px",fontSize:13,fontWeight:800,fontFamily:"'Cormorant Garamond',serif" }}>€{p.price*p.nights}</div>}
      </div>
      <div style={{ padding:"12px 14px",flex:1,display:"flex",flexDirection:"column",gap:7 }}>
        <div>
          <div style={{ fontSize:15,fontFamily:"'Cormorant Garamond',serif",color:"#2C2517",fontWeight:700,marginBottom:1 }}>{p.title}</div>
          <div style={{ fontSize:11,color:"#666" }}>📍 {p.location}</div>
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}><Stars rating={p.rating} /><span style={{ fontSize:10,color:"#555" }}>€{p.price}/nuit · {p.nights}n</span></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:5 }}>
          <div style={{ background:"#F0FFF4",borderRadius:8,padding:"6px 8px" }}><div style={{ fontSize:9,color:"#16A34A",fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:1 }}>Pour</div>{p.pros.map((x,i)=><div key={i} style={{ fontSize:10,color:"#15803D",lineHeight:1.4 }}>✓ {x}</div>)}</div>
          <div style={{ background:"#FFF5F5",borderRadius:8,padding:"6px 8px" }}><div style={{ fontSize:9,color:"#f87171",fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:1 }}>Contre</div>{p.cons.map((x,i)=><div key={i} style={{ fontSize:10,color:"#DC2626",lineHeight:1.4 }}>✗ {x}</div>)}</div>
        </div>
        {/* Star rating */}
        <StarRatingBar property={p} currentUserId={currentUserId} people={people} onRate={onRate} />

        {/* Notes section */}
        <div style={{ background:"#F4F1EC",borderRadius:10,padding:"8px 10px",border:"1px solid #141428" }}>
          <div style={{ fontSize:9,color:"#333",textTransform:"uppercase",letterSpacing:1.2,fontWeight:700,marginBottom:p.notes.length?8:0 }}>💬 Commentaires</div>
          {p.notes.length===0&&!showNote&&<div style={{ fontSize:11,color:"#C5BFAA",fontStyle:"italic",marginBottom:4 }}>Aucun commentaire pour l'instant</div>}
          {p.notes.map((note,i)=>{ const u=person(note.authorId); return (
            <div key={i} style={{ display:"flex",gap:8,marginBottom:6,alignItems:"flex-start" }}>
              {u&&<Avatar name={u.name} color={u.color} size={20} style={{ flexShrink:0,marginTop:1 }} />}
              <div style={{ background:"#F5F2EE",borderRadius:8,padding:"5px 9px",flex:1,border:"1px solid #E0D9CE" }}>
                <span style={{ color:u?.color||"#c9a96e",fontWeight:700,fontSize:11 }}>{u?.name||"?"} </span>
                <span style={{ fontSize:11,color:"#bbb" }}>{note.text}</span>
              </div>
            </div>
          ); })}
          {showNote?(
            <div style={{ display:"flex",gap:6,marginTop:4 }}>
              <Input value={noteText} onChange={setNoteText} placeholder="Votre commentaire…" autoFocus style={{ fontSize:12 }} onKeyDown={e=>{ if(e.key==="Enter"&&noteText.trim()){onAddNote(p.id,noteText);setNoteText("");setShowNote(false);}}} />
              <Btn variant="gold" onClick={()=>{if(noteText.trim()){onAddNote(p.id,noteText);setNoteText("");setShowNote(false);}}} style={{ padding:"7px 10px" }}>→</Btn>
            </div>
          ):(
            <button onClick={()=>setShowNote(true)} style={{ background:"transparent",border:"1px dashed #D5CFCA",borderRadius:8,color:"#555",padding:"5px 10px",fontSize:11,cursor:"pointer",width:"100%",fontFamily:"inherit",marginTop:p.notes.length?4:0 }}>+ Ajouter un commentaire</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Map View ─────────────────────────────────────────────────────────────────

function MapView({ properties, people, currentUserId, onVote, onAddNote, selectedId, onSelect }) {
  const ref=useRef(); const mapRef=useRef();
  useEffect(()=>{
    if(!ref.current||mapRef.current) return;
    const lnk=document.createElement("link"); lnk.rel="stylesheet"; lnk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(lnk);
    const sc=document.createElement("script"); sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; document.head.appendChild(sc);
    sc.onload=()=>{
      const L=window.L;
      const map=L.map(ref.current,{zoomControl:false}).setView([45,5],6);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{attribution:"© CartoDB"}).addTo(map);
      L.control.zoom({position:"bottomright"}).addTo(map);
      mapRef.current=map;
      properties.forEach(p=>{
        const pl=PLATFORMS[p.platform];
        const icon=L.divIcon({html:`<div style="background:${pl.color};border:3px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px #0008;cursor:pointer">${pl.icon}</div>`,className:"",iconSize:[36,36],iconAnchor:[18,18]});
        L.marker([p.lat,p.lng],{icon}).addTo(map).bindPopup(`<b>${p.title}</b><br>${p.location}<br>⭐ ${p.rating} · €${p.price*p.nights}`).on("click",()=>onSelect(p.id));
      });
    };
  },[]);
  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 290px",height:"100%" }}>
      <div ref={ref} style={{ height:"100%" }} />
      <div style={{ overflowY:"auto",background:"#FAF8F5",borderLeft:"1px solid #10101e",padding:8 }}>
        {properties.map(p=>(
          <div key={p.id} onClick={()=>onSelect(p.id)} style={{ display:"flex",gap:8,padding:"8px 10px",borderRadius:10,cursor:"pointer",marginBottom:4,background:selectedId===p.id?"#141428":"transparent",border:`1px solid ${selectedId===p.id?"#c9a96e44":"transparent"}` }}>
            <img src={p.image} style={{ width:44,height:44,borderRadius:8,objectFit:"cover",flexShrink:0 }} />
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:12,fontWeight:700,color:"#2C2517",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"'Cormorant Garamond',serif" }}>{p.title}</div>
              <div style={{ fontSize:10,color:"#555",marginBottom:2 }}>{p.location}</div>
              <div style={{ display:"flex",justifyContent:"space-between" }}><Stars rating={p.rating} /><span style={{ fontSize:11,color:"#c9a96e",fontWeight:700 }}>€{p.price*p.nights}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trip Page ────────────────────────────────────────────────────────────────

function TripPage({ trip, people, currentUserId, onUpdateTrip }) {
  const [view,setView]=useState("list"); const [filter,setFilter]=useState("all"); const [sort,setSort]=useState("votes");
  const [selectedId,setSelectedId]=useState(null); const [showAdd,setShowAdd]=useState(false);
  const [editProperty,setEditProperty]=useState(null);

  const handleVote=pid=>onUpdateTrip({...trip,properties:trip.properties.map(p=>p.id!==pid?p:{...p,votes:p.votes.includes(currentUserId)?p.votes.filter(v=>v!==currentUserId):[...p.votes,currentUserId]})});
  const handleNote=(pid,text)=>onUpdateTrip({...trip,properties:trip.properties.map(p=>p.id!==pid?p:{...p,notes:[...p.notes,{authorId:currentUserId,text}]})});
  const handleDelete=pid=>onUpdateTrip({...trip,properties:trip.properties.filter(p=>p.id!==pid)});
  const handleEdit=updated=>onUpdateTrip({...trip,properties:trip.properties.map(p=>p.id===updated.id?updated:p)});
  const handleRate=(pid,val)=>onUpdateTrip({...trip,properties:trip.properties.map(p=>p.id!==pid?p:{...p,ratings:{...(p.ratings||{}), [currentUserId]:val}})});

  const filtered=trip.properties.filter(p=>filter==="all"||p.platform===filter).sort((a,b)=>sort==="votes"?b.votes.length-a.votes.length:sort==="rating"?b.rating-a.rating:(a.price*a.nights)-(b.price*b.nights));
  const top=[...trip.properties].sort((a,b)=>b.votes.length-a.votes.length)[0];
  const totalVoters=[...new Set(trip.properties.flatMap(p=>p.votes))].length;

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0 }}>
      <div style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 18px",background:"#FFFFFF",borderBottom:"1px solid #10101e",flexWrap:"wrap" }}>
        <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
          <button onClick={()=>setFilter("all")} style={{ background:filter==="all"?"#1e1e30":"transparent",border:`1px solid ${filter==="all"?"#333":"#161626"}`,color:filter==="all"?"#f0e6d3":"#555",borderRadius:20,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600 }}>Tous ({trip.properties.length})</button>
          {Object.entries(PLATFORMS).filter(([k])=>trip.properties.some(p=>p.platform===k)).map(([k,pl])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{ background:filter===k?pl.color+"22":"transparent",border:`1px solid ${filter===k?pl.color:"#161626"}`,color:filter===k?pl.color:"#555",borderRadius:20,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600 }}>{pl.icon} {pl.name}</button>
          ))}
        </div>
        <div style={{ marginLeft:"auto",display:"flex",gap:4,alignItems:"center" }}>
          <span style={{ fontSize:10,color:"#444" }}>Trier</span>
          {[["votes","Votes"],["rating","Note"],["price","Prix"]].map(([k,l])=><button key={k} onClick={()=>setSort(k)} style={{ background:sort===k?"#c9a96e22":"transparent",border:`1px solid ${sort===k?"#c9a96e44":"#161626"}`,color:sort===k?"#c9a96e":"#555",borderRadius:20,padding:"3px 10px",fontSize:11,cursor:"pointer" }}>{l}</button>)}
          <div style={{ display:"flex",background:"#F5F2EE",borderRadius:8,padding:2,gap:1,marginLeft:6 }}>
            {[["list","☰"],["map","◎"]].map(([v,ic])=><button key={v} onClick={()=>setView(v)} style={{ background:view===v?"#c9a96e":"transparent",border:"none",borderRadius:6,padding:"4px 10px",color:view===v?"#0a0a14":"#666",cursor:"pointer",fontSize:13 }}>{ic}</button>)}
          </div>
          <Btn variant="gold" onClick={()=>setShowAdd(true)} style={{ marginLeft:4,fontSize:12,padding:"7px 16px",boxShadow:"0 0 12px #c9a96e44" }}>+ Ajouter un logement</Btn>
        </div>
      </div>
      {trip.properties.length>0&&(
        <div style={{ display:"flex",gap:14,padding:"6px 18px",background:"#FAF8F5",borderBottom:"1px solid #10101e",alignItems:"center",fontSize:11,color:"#555",flexWrap:"wrap" }}>
          <span>{trip.properties.length} logement{trip.properties.length>1?"s":""}</span>
          <span style={{ color:"#1a1a28" }}>·</span>
          <span>{totalVoters} vote{totalVoters!==1?"s":""} au total</span>
          {top&&top.votes.length>0&&<><span style={{ color:"#1a1a28" }}>·</span><span style={{ color:"#c9a96e" }}>✦ Favori : <b>{top.title}</b> ({top.votes.length} vote{top.votes.length>1?"s":""})</span></>}
        </div>
      )}
      {view==="list"?(
        <div style={{ overflowY:"auto",flex:1,padding:18 }}>
          {filtered.length===0?(
            <div style={{ textAlign:"center",padding:"60px 20px" }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🏠</div>
              <div style={{ fontSize:16,fontFamily:"'Cormorant Garamond',serif",color:"#444",marginBottom:6 }}>Aucun logement</div>
              <div style={{ fontSize:12,color:"#333",marginBottom:18 }}>Ajoutez les options à comparer</div>
              <Btn variant="gold" onClick={()=>setShowAdd(true)}>+ Ajouter</Btn>
            </div>
          ):(
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 }}>
              {filtered.map(p=><PropertyCard key={p.id} property={p} people={people} currentUserId={currentUserId} onVote={handleVote} onRate={handleRate} onAddNote={handleNote} onDelete={handleDelete} onEdit={setEditProperty} isWinner={top&&top.id===p.id&&top.votes.length>0} />)}
              <div onClick={()=>setShowAdd(true)} style={{ border:"1px dashed #D5CFCA",borderRadius:16,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,cursor:"pointer",minHeight:160,background:"#F4F1EC",color:"#C5BFAA" }} onMouseEnter={e=>{e.currentTarget.style.borderColor="#c9a96e44";e.currentTarget.style.color="#c9a96e55";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#1a1a28";e.currentTarget.style.color="#2a2a3e";}}>
                <span style={{ fontSize:26,marginBottom:6 }}>✦</span>
                <span style={{ fontSize:12,fontFamily:"'Cormorant Garamond',serif" }}>Ajouter un logement</span>
              </div>
            </div>
          )}
        </div>
      ):(
        <div style={{ flex:1 }}><MapView properties={filtered} people={people} currentUserId={currentUserId} onVote={handleVote} onAddNote={handleNote} selectedId={selectedId} onSelect={setSelectedId} /></div>
      )}
      {showAdd&&<AddPropertyModal onClose={()=>setShowAdd(false)} onAdd={p=>{onUpdateTrip({...trip,properties:[...trip.properties,p]});setShowAdd(false);}} currentUserId={currentUserId} />}
      {editProperty&&<AddPropertyModal onClose={()=>setEditProperty(null)} onEdit={p=>{handleEdit(p);setEditProperty(null);}} initialProperty={editProperty} currentUserId={currentUserId} />}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [trips, setTrips]               = useState(null);
  const [people, setPeople]             = useState(null);
  const [activeTrip, setActiveTrip]     = useState("t1");
  const [currentUserId, setCurrentUserId] = useState("u1");
  const [loaded, setLoaded]             = useState(false);
  const [showNewTrip, setShowNewTrip]   = useState(false);
  const [showPeople, setShowPeople]     = useState(false);

  // Préférences locales (par utilisateur)
  useEffect(()=>{
    const a = localStorage.getItem("sejours:activeTrip");
    const u = localStorage.getItem("sejours:currentUser");
    const urlTrip = new URLSearchParams(window.location.search).get("trip");
    if(urlTrip) setActiveTrip(urlTrip);
    else if(a) setActiveTrip(a);
    if(u) setCurrentUserId(u);
  },[]);
  useEffect(()=>{ if(loaded) localStorage.setItem("sejours:activeTrip",  activeTrip);    },[activeTrip,loaded]);
  useEffect(()=>{ if(loaded) localStorage.setItem("sejours:currentUser", currentUserId); },[currentUserId,loaded]);

  // Sync temps réel avec Firestore (lecture seule — les sauvegardes se font via save())
  useEffect(()=>{
    const ref = doc(db, "appdata", "main");
    const unsub = onSnapshot(ref, (snap) => {
      if(snap.exists()) {
        const data = snap.data();
        setTrips(data.trips   ?? INITIAL_TRIPS);
        setPeople(data.people ?? INITIAL_PEOPLE);
      } else {
        setDoc(ref, { trips: INITIAL_TRIPS, people: INITIAL_PEOPLE });
        setTrips(INITIAL_TRIPS);
        setPeople(INITIAL_PEOPLE);
      }
      setLoaded(true);
    }, () => {
      const t = localStorage.getItem("sejours:trips");
      const p = localStorage.getItem("sejours:people");
      setTrips(t ? JSON.parse(t) : INITIAL_TRIPS);
      setPeople(p ? JSON.parse(p) : INITIAL_PEOPLE);
      setLoaded(true);
    });
    return () => unsub();
  },[]);

  const safeTrips  = trips  || [];
  const safePeople = people || [];
  const trip       = safeTrips.find(t=>t.id===activeTrip);
  const person     = id => safePeople.find(p=>p.id===id);
  const currentPerson = person(currentUserId);

  const save = (newTrips, newPeople) => {
    setDoc(doc(db, "appdata", "main"), { trips: newTrips, people: newPeople });
  };
  const updateTrip = u => {
    const newTrips = safeTrips.map(t=>t.id===u.id?u:t);
    setTrips(newTrips);
    save(newTrips, safePeople);
  };
  const updatePeople = newPeople => {
    setPeople(newPeople);
    save(safeTrips, newPeople);
  };
  const deleteTrip = id => {
    const newTrips = safeTrips.filter(t=>t.id!==id);
    setTrips(newTrips);
    save(newTrips, safePeople);
    if(activeTrip===id){ const r=newTrips[0]; setActiveTrip(r?.id||null); }
  };
  const acceptedCount = t => t.members.filter(m=>m.status==="accepted").length;
  const pendingCount  = t => t.members.filter(m=>m.status==="pending").length;

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",background:"#FAF8F5",fontFamily:"'Inter','Helvetica Neue',sans-serif",color:"#2C2517",overflow:"hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {!loaded&&(
        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#FAF8F5",color:"#c9a96e",fontFamily:"'Cormorant Garamond',serif",fontSize:18,gap:10,zIndex:9999 }}>
          <span style={{ animation:"spin 1s linear infinite",display:"inline-block" }}>✦</span> Chargement…
        </div>
      )}

      {/* Header */}
      <div style={{ background:"#FFFFFF",borderBottom:"1px solid #E8E2D8",display:"flex",alignItems:"center",gap:12,padding:"0 18px",height:52,flexShrink:0 }}>
        <span style={{ fontSize:18 }}>✦</span>
        <span style={{ fontSize:17,fontFamily:"'Cormorant Garamond',serif",fontWeight:700,color:"#c9a96e",letterSpacing:.5 }}>Séjours</span>
        <span style={{ fontSize:11,color:"#1e1e30" }}>·</span>
        <span style={{ fontSize:11,color:"#9A9080" }}>sélecteur collaboratif</span>
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={()=>setShowPeople(true)} style={{ display:"flex",alignItems:"center",gap:7,background:"transparent",border:"1px solid #E8E2D8",borderRadius:20,padding:"5px 14px 5px 8px",cursor:"pointer" }}>
            <div style={{ display:"flex" }}>{safePeople.slice(0,4).map((p,i)=><Avatar key={p.id} name={p.name} color={p.color} size={22} style={{ marginLeft:i?-7:0,border:"2px solid #0a0a18" }} />)}{safePeople.length>4&&<div style={{ width:22,height:22,borderRadius:"50%",background:"#EAE4D8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#888",marginLeft:-7,border:"2px solid #0a0a18" }}>+{safePeople.length-4}</div>}</div>
            <span style={{ fontSize:11,color:"#888",fontWeight:600 }}>{safePeople.length} amis</span>
            <span style={{ fontSize:10,color:"#444",marginLeft:1 }}>✎</span>
          </button>
          <div style={{ display:"flex",alignItems:"center",gap:4,background:"#F5F2EE",borderRadius:20,padding:"4px 12px 4px 6px" }}>
            <span style={{ fontSize:10,color:"#555" }}>Je suis :</span>
            {safePeople.filter(p=>!trip||trip.members.some(m=>m.personId===p.id)).map(p=><button key={p.id} onClick={()=>setCurrentUserId(p.id)} title={p.name} style={{ background:"none",border:`2px solid ${currentUserId===p.id?p.color:"transparent"}`,borderRadius:"50%",padding:0,cursor:"pointer",lineHeight:0 }}><Avatar name={p.name} color={p.color} size={24} /></button>)}
            {currentPerson&&<span style={{ fontSize:12,color:currentPerson.color,fontWeight:600,marginLeft:4 }}>{currentPerson.name}</span>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1,display:"flex",minHeight:0 }}>
        {/* Sidebar */}
        <div style={{ width:216,background:"#F4F1EC",borderRight:"1px solid #E8E2D8",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto" }}>
          <div style={{ padding:"12px 14px 6px",fontSize:9,color:"#C5BFAA",textTransform:"uppercase",letterSpacing:2,fontWeight:700 }}>Mes séjours</div>
          {safeTrips.filter(t=>t.members.some(m=>m.personId===currentUserId)).map(t=>{
            const isA=t.id===activeTrip, pe=pendingCount(t);
            return (
              <div key={t.id} onClick={()=>setActiveTrip(t.id)} style={{ margin:"0 6px 3px",padding:"9px 10px",borderRadius:11,cursor:"pointer",background:isA?"#141428":"transparent",border:`1px solid ${isA?"#c9a96e33":"transparent"}`,position:"relative" }} onMouseEnter={e=>{ if(!isA)e.currentTarget.style.background="#F0ECE4"; }} onMouseLeave={e=>{ if(!isA)e.currentTarget.style.background="transparent"; }}>
                <div style={{ display:"flex",gap:8,alignItems:"flex-start" }}>
                  <span style={{ fontSize:20,lineHeight:1,flexShrink:0 }}>{t.emoji}</span>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:isA?"#f0e6d3":"#777",fontFamily:"'Cormorant Garamond',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{t.name}</div>
                    {t.dates&&<div style={{ fontSize:10,color:"#9A9080",marginTop:1 }}>{t.dates}</div>}
                    <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:5,flexWrap:"wrap" }}>
                      <span style={{ fontSize:9,color:"#9A9080" }}>{t.properties.length} logement{t.properties.length!==1?"s":""}</span>
                      <span style={{ color:"#1a1a28",fontSize:9 }}>·</span>
                      <div style={{ display:"flex",alignItems:"center",gap:2 }}>
                        <div style={{ display:"flex" }}>{t.members.slice(0,3).map((m,i)=>{ const u=person(m.personId); return u?<Avatar key={m.personId} name={u.name} color={u.color} size={14} style={{ marginLeft:i?-4:0,border:`1.5px solid ${m.status==="declined"?"#f87171":"#08080f"}`,opacity:m.status==="declined"?.4:1 }} />:null; })}{t.members.length>3&&<div style={{ width:14,height:14,borderRadius:"50%",background:"#EAE4D8",fontSize:8,color:"#888",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:-4 }}>+{t.members.length-3}</div>}</div>
                        {pe>0&&<span style={{ fontSize:9,color:"#fbbf24" }}>{pe}⏳</span>}
                      </div>
                    </div>
                  </div>
                </div>
                {safeTrips.length>1&&<button onClick={e=>{e.stopPropagation();deleteTrip(t.id);}} style={{ position:"absolute",top:6,right:6,background:"none",border:"none",color:"#C5BFAA",cursor:"pointer",fontSize:14,lineHeight:1,padding:"0 2px" }} onMouseEnter={e=>e.currentTarget.style.color="#f87171"} onMouseLeave={e=>e.currentTarget.style.color="#2a2a3e"}>×</button>}
              </div>
            );
          })}
          <button onClick={()=>setShowNewTrip(true)} style={{ margin:"6px 6px 14px",padding:"8px 10px",borderRadius:11,cursor:"pointer",background:"transparent",border:"1px dashed #D5CFCA",color:"#9A9080",fontSize:11,fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:5 }} onMouseEnter={e=>{e.currentTarget.style.borderColor="#c9a96e44";e.currentTarget.style.color="#c9a96e88";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#1a1a28";e.currentTarget.style.color="#3a3a5a";}}>
            <span style={{ fontSize:14 }}>+</span> Nouveau séjour
          </button>
        </div>

        {/* Main */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",minWidth:0 }}>
          {trip?(
            <>
              <div style={{ padding:"10px 18px",background:"#FFFFFF",borderBottom:"1px solid #E8E2D8",display:"flex",alignItems:"center",gap:12,flexShrink:0,flexWrap:"wrap" }}>
                <span style={{ fontSize:26 }}>{trip.emoji}</span>
                <TripHeaderEdit trip={trip} onUpdate={updateTrip} />
                <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                  {trip.members.map(m=>{ const u=person(m.personId); if(!u) return null; return <div key={m.personId} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}><Avatar name={u.name} color={u.color} size={28} style={{ border:`2px solid ${m.status==="accepted"?"#4ade80":m.status==="declined"?"#f87171":"#fbbf24"}`,opacity:m.status==="declined"?.5:1 }} /><div style={{ fontSize:8,color:m.status==="accepted"?"#4ade80":m.status==="declined"?"#f87171":"#fbbf24",textAlign:"center",fontWeight:700 }}>{m.status==="accepted"?"✓":m.status==="declined"?"✗":"?"}</div></div>; })}
                  <button onClick={()=>setShowPeople(true)} style={{ background:"transparent",border:"1px dashed #1e1e30",borderRadius:20,padding:"4px 10px",cursor:"pointer",color:"#555",fontSize:11,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4 }}>✉ Gérer</button>
                </div>
              </div>
              <TripPage trip={trip} people={safePeople} currentUserId={currentUserId} onUpdateTrip={updateTrip} />
            </>
          ):(
            <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16 }}>
              <div style={{ fontSize:44 }}>✦</div>
              <div style={{ fontSize:18,fontFamily:"'Cormorant Garamond',serif",color:"#333" }}>Créez votre premier séjour</div>
              <Btn variant="gold" onClick={()=>setShowNewTrip(true)}>+ Nouveau séjour</Btn>
            </div>
          )}
        </div>
      </div>

      {showNewTrip&&<NewTripModal people={safePeople} onClose={()=>setShowNewTrip(false)} onCreate={t=>{ const newTrips=[...safeTrips,t]; setTrips(newTrips); save(newTrips,safePeople); setActiveTrip(t.id); setShowNewTrip(false); }} />}
      {showPeople&&<PeopleModal people={safePeople} trips={safeTrips} onClose={()=>setShowPeople(false)} onSavePeople={newP=>{ setPeople(newP); save(safeTrips,newP); }} onSaveTrips={newT=>{ setTrips(newT); save(newT,safePeople); }} currentUserPerson={currentPerson} />}
    </div>
  );
}
