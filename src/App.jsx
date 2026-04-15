import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { dbGet, dbSet, supabase } from './supabase.js'

const LT=['kids','volwassenen','coordinator','redder','onthaalmedewerker','toezichter','hulp_coordinator_np','hulp_coordinator_p']
const LL={kids:'Kids',volwassenen:'Volwassenen',coordinator:'Coördinator',redder:'Redder',onthaalmedewerker:'Onthaalmedewerker',toezichter:'Toezichter',hulp_coordinator_np:'Hulp Coörd. (niet bet.)',hulp_coordinator_p:'Hulp Coörd. (betalend)'}
const MNL=['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const ROLES=['lesgever','coordinator','redder','onthaalmedewerker','toezichter','hulp_coordinator_np','hulp_coordinator_p']
const RC={lesgever:['#dbeafe','#1e3a8a'],coordinator:['#d1fae5','#064e3b'],redder:['#fee2e2','#991b1b'],onthaalmedewerker:['#fef3c7','#92400e'],toezichter:['#f3e8ff','#6b21a8'],hulp_coordinator_np:['#f1f5f9','#475569'],hulp_coordinator_p:['#fef3c7','#713f12']}
const DAY_IDX={Maandag:0,Dinsdag:1,Woensdag:2,Donderdag:3,Vrijdag:4,Zaterdag:5}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function euro(n){return'€ '+parseFloat(n||0).toFixed(2).replace('.',',')}
function getMon(d){const dt=new Date(d),day=dt.getDay(),diff=dt.getDate()-day+(day===0?-6:1);dt.setDate(diff);return dt.toISOString().split('T')[0]}
function addDays(ds,n){const d=new Date(ds);d.setDate(d.getDate()+n);return d.toISOString().split('T')[0]}
function getDayDate(mon,dag){return addDays(mon,DAY_IDX[dag]||0)}
function fmtShort(ds){return new Date(ds).toLocaleDateString('nl-BE',{day:'numeric',month:'short'})}
function fmtDate(ds){return new Date(ds).toLocaleDateString('nl-BE',{day:'numeric',month:'long',year:'numeric'})}
function parseDuur(s){if(!s)return 2;const m=s.match(/(\d+)u(\d+)?/);if(!m)return 2;return parseInt(m[1])+(m[2]?parseInt(m[2])/60:0)}
function parseKey(key){const i1=key.indexOf('_'),i2=key.indexOf('_',i1+1),i3=key.indexOf('_',i2+1);return{wk:key.slice(0,i1),locId:key.slice(i1+1,i2),sessId:key.slice(i2+1,i3),name:key.slice(i3+1)}}

const Z=(id,n,k,v,c,r,ib='',em='')=>({id,name:n,status:'zelfstandige',email:em,rates:{kids:k,volwassenen:v,coordinator:c||v,redder:r||0,onthaalmedewerker:12.5,toezichter:14,hulp_coordinator_np:0,hulp_coordinator_p:10},iban:ib})
const V=(id,n,k,v,c,r,o,ib='',em='')=>({id,name:n,status:'vrijwilliger',email:em,rates:{kids:k,volwassenen:v,coordinator:c||0,redder:r||0,onthaalmedewerker:o||0,toezichter:14,hulp_coordinator_np:0,hulp_coordinator_p:12.5},iban:ib})

const INST=[
  Z('z1','Jasmin Husic',29,30,37,0,'BE57750664951835','jasmin.hsc@hotmail.com'),
  Z('z2','Jill Collier',20,20,0,20,'',''),
  Z('z3','Levi van Semang',34,34,35,0,'BE40001687961563','levi.vansemang@hotmail.com'),
  Z('z4','Liesse Eyckmans',34,35,0,0,'BE91973425950676','liesse26@hotmail.com'),
  Z('z5','Lieze Dhondt',29,30,0,0,'BE86 7340 7344 2850','lieze.dhondt@outlook.com'),
  Z('z6','Michiel Willems',29,35,0,0,'BE68651216778434','michiel.willems77@gmail.com'),
  Z('z7','Michael Paridaens',34,35,0,0,'BE05001450176975','michael_paridaens@hotmail.be'),
  Z('z8','Raf Plinke',34,35,35,0,'BE91 1430 6461 8976','raf.plinke@telenet.be'),
  Z('z9','Sami Baghouri',29,30,0,0,'BE96001757475605','sami.bswimming@gmail.com'),
  Z('z10','Ylana Longueville',32,35,0,25,'BE79063599760533','ylana.longueville@gmail.com'),
  Z('z11','Yosse Claessen',29,30,0,0,'BE21 0636 4896 5603','yosse.claesen@gmail.com'),
  V('v1','Abdellah Atrari Marzouk',20,30,0,0,0,'BE45 0635 3167 2189','abdellah.a7m@gmail.com'),
  V('v2','Abraham Zeresenay',20,30,0,0,0,'BE25 3631 9843 7182','abrahamkidane250@gmail.com'),
  V('v3','Amber Van Minnebruggen',20,30,0,0,0,'BE21 7506 9110 9503','amber.vanminnebruggen@telenet.be'),
  V('v4','Amber Willems',30,30,0,0,0,'BE94001706221714','willems_amber@hotmail.com'),
  V('v5','Ann Pauwels',30,30,0,0,0,'BE57293037168435','pauwelsann@gmail.com'),
  V('v6','Antonio Neto',30,30,30,10,0,'BE46001592442936','sobo.antonio@outlook.com'),
  V('v7','Arthur Demey',23,30,0,0,0,'',''),
  V('v8','Blerim B.',30,30,30,10,0,'','blerim.bacaj96@gmail.com'),
  V('v9','Bram Kruytzer',30,30,0,0,0,'BE60 7350 3645 1170','bram.kruijtzer@gmail.com'),
  V('v10','Bram Wegge',30,30,0,0,0,'BE02739014718840','bram.wegge@hotmail.com'),
  V('v11','Broes Geens',26,30,0,0,0,'BE30 7360 0994 6911','broes.geens@outlook.be'),
  V('v12','Bruno Engelen',30,30,30,0,0,'BE10 0635 3630 0204','engelen.bruno@gmail.com'),
  V('v13','Celine Vranckx',30,30,0,0,0,'BE34 7340 4046 6890','celinevrancx2002@gmail.com'),
  V('v14','Charlotte Van den Camp',20,30,0,0,0,'BE38736074972172','charlottevandencamp@outlook.com'),
  V('v15','Christophe Van Dyck',26,30,0,0,0,'BE19220034801212','vandyckchristophe@hotmail.com'),
  V('v16','Daan De Prins',23,30,0,0,0,'BE75001748468951','deprinsdaan@gmail.com'),
  V('v17','Damon van der Goten',30,30,30,0,0,'','damonvdgoten@gmail.com'),
  V('v18','Daphne Peeters',30,30,0,0,0,'BE54001645110397','daphne.peeters@hotmail.com'),
  V('v19','Deborah Bocken',23,30,0,0,0,'BE69973533194078','bockendeborah@gmail.com'),
  V('v20','Dries Cornette',20,30,0,0,0,'','dries.cornette@hotmail.com'),
  V('v21','Elia Schoonvliet',30,30,30,0,0,'BE55973133938644','elia.schoonvliet@hotmail.com'),
  V('v22','Emilia Nelissen',26,30,0,0,0,'BE95 0635 1680 8658','emilianelissen@hotmail.com'),
  V('v23','Flavio Claassen',26,30,0,0,0,'BE63063510993308','flavio.claassen@gmail.com'),
  V('v24',"Fleur D'heer",26,30,0,0,0,'BE54063621853897','dheer.fleur@gmail.com'),
  V('v25','Gerhele Hek',23,30,0,0,12.5,'BE85731055535606','damaiky2011@hotmail.com'),
  V('v26','Haroun Elkarmoudi',26,30,30,0,0,'BE37973499403928','haroun_elkarmoudi@hotmail.com'),
  V('v27','Ilijana Jeremic',20,30,0,0,0,'BE97 7370 4930 5749','ilijanajeremic8@gmail.com'),
  V('v28','Indy Visscher',30,30,0,0,0,'NL81RBRB0706338510','indy2305@kpnmail.nl'),
  V('v29','Isabel Buron',23,30,0,0,0,'NL88ABNA0540835862','isabel.smb22@gmail.com'),
  V('v30','Jelka Devriendt',30,30,0,0,0,'','jelka.steil@gmail.com'),
  V('v31','Jens Schoofs',23,30,0,10,0,'BE72 7360 2710 6716','jens.schoofs@gmail.com'),
  V('v32','Jill Maene',30,30,0,0,0,'BE48 9733 8134 5127','jillm@outlook.be'),
  V('v33','Julia Leenders',30,30,0,0,0,'BE66 7895 7321 4343','julia.maria.leenders@telenet.be'),
  V('v34','Kaya de Backer',30,30,30,0,0,'BE92737056849723','kaya.debacker@gmail.com'),
  V('v35','Keela Demeyer',30,30,0,0,0,'BE63973125476608','keela.demeyer@hotmail.com'),
  V('v36','Lana De Brueck',26,30,0,0,12.5,'BE13063556673739','lana.debrueck@gmail.com'),
  V('v37','Lili Boumans',20,20,0,20,0,'BE80734050854277','lili.boumans@skynet.be'),
  V('v38','Lotte De Rechter',23,30,0,0,0,'BE53063573737453','lottederechter@hotmail.com'),
  V('v39','Lukas Borghgraef',20,30,0,0,0,'BE58 9734 0044 9679','lukas.borghgraef@telenet.be'),
  V('v40','Maaike Verbeke',30,30,0,0,0,'BE69 7360 6222 6978','maaikeverbeke18@gmail.com'),
  V('v41','Marte Peeters',26,30,0,0,0,'BE70 0635 8590 8125','marte.peeters@icloud.com'),
  V('v42','Maya Arias',30,30,0,0,0,'BE34 7350 3700 6090','ariasmaya59@gmail.com'),
  V('v43','Mustafa Al Tuwaijari',20,20,0,20,0,'BE72 0636 0360 0016','mustafakamal.950s@gmail.com'),
  V('v44','Naomi Stabel',30,30,0,10,0,'BE51 9730 9572 2462','naomistabel@yahoo.com'),
  V('v45','Natascha VDS',30,30,0,0,0,'BE22063443999347','taschke@gmail.com'),
  V('v46','Nicolas Rottiers',20,30,0,0,12.5,'BE70 0635 8596 6325','nicolas.rottiers1@icloud.com'),
  V('v47','Niels Huybrechts',23,30,0,0,12.5,'BE65 0016 8439 5296','niels.huybrechts@hotmail.com'),
  V('v48','Robbe Van Rie',20,30,0,0,0,'BE87363170725494','robbevanrie.malderen@gmail.com'),
  V('v49','Soukaina Bounida',20,30,0,0,12.5,'BE75063695850551','soukainabounida2005@gmail.com'),
  V('v50','Sterre Rymenants',20,30,0,0,0,'BE28973351817620','rymenantsst@gmail.com'),
  V('v51','Swing Buytaert',20,30,0,0,0,'BE76 1431 0922 1495','swing2007@outlook.com'),
  V('v52','Tom Van den Bleeken',30,30,30,10,0,'BE04731026855231','tom_van_den_bleeken@hotmail.com'),
  V('v53','Ubi De Roey',30,30,0,0,0,'BE38 9731 1415 3472','ubideroey@gmail.com'),
  V('v54','Veerle Willems',20,30,0,0,0,'BE52001441139609','veerle.willems@gmail.com'),
  V('v55','Wally Schoofs',30,30,0,10,0,'BE94 7330 3245 4614','wally.schoofs@telenet.be'),
  V('v56','Wendy Dillen',26,30,30,0,0,'BE20320055860956','dillenwendy@hotmail.com'),
  V('v57','Younes Mazoud',23,30,0,0,0,'BE02063628589640','younes.mazoud@gmail.com'),
  V('v58','Kathleen Verbeke',23,30,0,0,0,'BE11731032793348','kathleen.verbeke@telenet.be'),
]

const NM=(n,r='lesgever')=>({name:n,role:r})
const mkS=(dag,type,duur,members,substitutes=[])=>({id:uid(),dag,type,duur,members,substitutes})
const SCHED=[
  {locId:'nachtegaal',name:'De Nachtegaal',stad:'Kontich',sessions:[mkS('Woensdag','kids','2u',[NM('Jens Schoofs'),NM('Wally Schoofs','redder')])]},
  {locId:'bessem',name:'Den Bessem',stad:'Mortsel',sessions:[
    mkS('Dinsdag','kids','2u',[NM('Amber Willems'),NM('Lili Boumans'),NM('Damon van der Goten'),NM('Gerhele Hek'),NM('Isabel Buron'),NM('Swing Buytaert'),NM('Veerle Willems'),NM('Younes Mazoud'),NM('Nicolas Rottiers'),NM('Lukas Borghgraef'),NM('Naomi Stabel'),NM('Marte Peeters'),NM('Ubi De Roey'),NM('Antonio Neto','redder'),NM('Bruno Engelen','coordinator'),NM('Blerim B.','coordinator'),NM('Soukaina Bounida','onthaalmedewerker')]),
    mkS('Dinsdag','volwassenen','2u',[NM('Antonio Neto','redder'),NM('Naomi Stabel')]),
  ]},
  {locId:'sorghvliedt',name:'Sorghvliedt',stad:'Hoboken',sessions:[
    mkS('Maandag','volwassenen','1u30',[NM('Michael Paridaens'),NM('Christophe Van Dyck')]),
    mkS('Dinsdag','kids','2u',[NM('Arthur Demey'),NM('Charlotte Van den Camp'),NM('Daan De Prins'),NM('Lana De Brueck'),NM('Maya Arias'),NM('Sterre Rymenants'),NM('Ilijana Jeremic'),NM('Raf Plinke','coordinator')]),
    mkS('Woensdag','kids','3u',[NM('Ann Pauwels'),NM('Jill Maene'),NM('Flavio Claassen'),NM('Lili Boumans'),NM('Yosse Claessen'),NM('Younes Mazoud'),NM('Tom Van den Bleeken','coordinator')]),
    mkS('Woensdag','volwassenen','1u',[NM('Flavio Claassen')]),
  ]},
  {locId:'plantin',name:'Plantin Moretus',stad:'Borgerhout',sessions:[
    mkS('Donderdag','kids','2u',[NM('Antonio Neto'),NM('Bruno Engelen'),NM('Kathleen Verbeke'),NM('Broes Geens'),NM('Jelka Devriendt'),NM('Abraham Zeresenay'),NM('Maaike Verbeke'),NM('Sami Baghouri'),NM('Ubi De Roey'),NM('Elia Schoonvliet','coordinator')]),
  ]},
  {locId:'grootschijn',name:'Groot Schijn',stad:'Deurne',sessions:[
    mkS('Maandag','kids','2u',[NM('Younes Mazoud'),NM('Dries Cornette'),NM('Jasmin Husic'),NM('Marte Peeters'),NM('Jens Schoofs'),NM('Maaike Verbeke'),NM('Ylana Longueville'),NM('Kaya de Backer','coordinator')]),
    mkS('Maandag','volwassenen','2u',[NM('Haroun Elkarmoudi')]),
    mkS('Dinsdag','kids','2u',[NM('Amber Van Minnebruggen'),NM('Kaya de Backer'),NM('Yosse Claessen'),NM('Wendy Dillen'),NM('Ylana Longueville'),NM('Jasmin Husic','coordinator')]),
    mkS('Dinsdag','volwassenen','2u',[NM('Jens Schoofs'),NM('Kaya de Backer')]),
    mkS('Woensdag','kids','2u',[NM('Robbe Van Rie'),NM("Fleur D'heer"),NM('Nicolas Rottiers'),NM('Sami Baghouri'),NM('Raf Plinke','coordinator')]),
    mkS('Donderdag','kids','2u30',[NM('Celine Vranckx'),NM('Emilia Nelissen'),NM('Bram Kruytzer'),NM('Kaya de Backer'),NM('Keela Demeyer'),NM('Julia Leenders'),NM('Levi van Semang','coordinator')]),
    mkS('Vrijdag','kids','2u',[NM('Damon van der Goten'),NM('Amber Van Minnebruggen'),NM('Sami Baghouri'),NM('Bram Wegge'),NM('Jens Schoofs')]),
  ]},
  {locId:'schinde',name:'De Schinde',stad:'Ekeren',sessions:[
    mkS('Donderdag','kids','1u30',[NM('Daphne Peeters'),NM('Robbe Van Rie'),NM('Jasmin Husic'),NM('Lotte De Rechter'),NM('Liesse Eyckmans'),NM('Ylana Longueville'),NM('Deborah Bocken'),NM('Blerim B.','coordinator'),NM('Mustafa Al Tuwaijari','redder')]),
  ]},
  {locId:'swimcube',name:'Swimcube LO',stad:'Linkeroever',sessions:[
    mkS('Maandag','kids','2u',[NM('Indy Visscher'),NM('Oihane','toezichter'),NM('Xenia','toezichter')]),
    mkS('Woensdag','kids','2u',[NM('Veerle Willems'),NM('Bram Kruytzer'),NM('Zoë','toezichter')]),
  ]},
]

const S={
  inp:{padding:'7px 10px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:13,fontFamily:'inherit',outline:'none',background:'#fff',color:'#0f172a'},
  td:{padding:'9px 14px',color:'#334155',verticalAlign:'middle'},
  th:{padding:'9px 14px',textAlign:'left',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:'0.5px',color:'#94a3b8'},
  card:{background:'#fff',borderRadius:12,padding:20,border:'1px solid #e2e8f0',marginBottom:16},
  btnP:{background:'#0f2133',color:'#fff',border:'none',borderRadius:7,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},
  btnS:{background:'#f1f5f9',color:'#334155',border:'none',borderRadius:7,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},
  btnSm:{background:'#f1f5f9',color:'#334155',border:'none',borderRadius:6,padding:'4px 9px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},
  lbl:{display:'block',fontSize:11,fontWeight:600,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.6px'},
}
const ii={...S.inp,width:'100%',padding:'8px 10px',boxSizing:'border-box'}
function SBadge({s}){const z=s==='zelfstandige';return <span style={{padding:'2px 7px',borderRadius:20,fontSize:11,fontWeight:600,background:z?'#fef9c3':'#dbeafe',color:z?'#854d0e':'#1e40af'}}>{z?'Zelfstandige':'Vrijwilliger'}</span>}
function Title({t,s}){return <div style={{marginBottom:16}}><h2 style={{fontSize:20,fontWeight:700,color:'#0f172a',margin:'0 0 2px'}}>{t}</h2>{s&&<p style={{color:'#64748b',fontSize:13,margin:0}}>{s}</p>}</div>}
function TypeBadge({type}){return <span style={{padding:'2px 7px',borderRadius:20,fontSize:11,fontWeight:600,background:'#dbeafe',color:'#1e3a8a'}}>{LL[type]||type}</span>}
function SPill({on,labelOn,labelOff,onClick}){return <button onClick={onClick} style={{padding:'4px 11px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',background:on?'#dcfce7':'#fee2e2',color:on?'#166534':'#dc2626',whiteSpace:'nowrap'}}>{on?'✓ '+labelOn:'✗ '+labelOff}</button>}
function MetCard({label,val,color,sub}){return <div style={{background:'#fff',borderRadius:10,padding:'14px 16px',border:'1px solid #e2e8f0'}}><div style={{fontSize:11,color:'#64748b',marginBottom:5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div><div style={{fontSize:30,fontWeight:800,color,lineHeight:1}}>{val}</div><div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{sub}</div></div>}

export default function App(){
  const [tab,setTab]=useState('dashboard')
  const [inst,setInst]=useState(INST)
  const [entries,setEntries]=useState([])
  const [sched,setSched]=useState(SCHED)
  const [att,setAtt]=useState({})
  const [comm,setComm]=useState({})
  const [notes,setNotes]=useState([])
  const [paid,setPaid]=useState({})
  const [unlocked,setUnlocked]=useState([])
  const [syncing,setSyncing]=useState(false)
  const [lastSync,setLastSync]=useState(null)

  useEffect(()=>{
    (async()=>{
      setSyncing(true)
      const[i,e,sc,a,c,n,p,u]=await Promise.all([dbGet('sw_inst'),dbGet('sw_ent'),dbGet('sw_sched'),dbGet('sw_att'),dbGet('sw_comm'),dbGet('sw_notes'),dbGet('sw_paid'),dbGet('sw_unlocked')])
      if(i)setInst(i);if(e)setEntries(e);if(sc)setSched(sc);if(a)setAtt(a);if(c)setComm(c);if(n)setNotes(n);if(p)setPaid(p);if(u)setUnlocked(u)
      setSyncing(false);setLastSync(new Date())
    })()
    const channel=supabase.channel('swimpay-rt').on('postgres_changes',{event:'UPDATE',schema:'public',table:'app_data'},({new:row})=>{
      const v=JSON.parse(row.value)
      if(row.id==='sw_inst')setInst(v)
      else if(row.id==='sw_ent')setEntries(v)
      else if(row.id==='sw_sched')setSched(v)
      else if(row.id==='sw_att')setAtt(v)
      else if(row.id==='sw_comm')setComm(v)
      else if(row.id==='sw_notes')setNotes(v)
      else if(row.id==='sw_paid')setPaid(v)
      else if(row.id==='sw_unlocked')setUnlocked(v)
      setLastSync(new Date())
    }).subscribe()
    return()=>supabase.removeChannel(channel)
  },[])

  const sv=async(k,d,fn)=>{fn(d);await dbSet(k,d)}
  const TABS=[{k:'dashboard',l:'Dashboard'},{k:'overzicht',l:'Overzicht lessen'},{k:'uren',l:'Uren invoeren'},{k:'maand',l:'Maandoverzicht'},{k:'notities',l:'Notities'},{k:'lsg',l:'Lesgevers'}]

  return(
    <div style={{fontFamily:"system-ui,sans-serif",minHeight:'100vh',background:'#f8fafc'}}>
      <header style={{background:'#0f2133',display:'flex',alignItems:'center',height:52,paddingLeft:22,gap:2,position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:14}}>
          <div style={{width:5,height:24,background:'#2dd4bf',borderRadius:3}}/>
          <span style={{color:'#fff',fontWeight:700,fontSize:16}}>SwimPay</span>
        </div>
        {TABS.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:'0 12px',height:52,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,fontFamily:'inherit',borderBottom:`2px solid ${tab===t.k?'#2dd4bf':'transparent'}`,background:'transparent',color:tab===t.k?'#2dd4bf':'rgba(255,255,255,0.55)'}}>{t.l}</button>)}
        <div style={{marginLeft:'auto',marginRight:14,display:'flex',alignItems:'center',gap:8}}>
          {syncing&&<span style={{fontSize:11,color:'#5eead4'}}>⟳ Sync...</span>}
          {lastSync&&!syncing&&<span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>✓ {lastSync.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</span>}
        </div>
      </header>
      <main style={{padding:'22px 26px',maxWidth:1200,margin:'0 auto'}}>
        {tab==='dashboard'&&<Dashboard sched={sched} att={att} inst={inst} comm={comm} onSaveComm={d=>sv('sw_comm',d,setComm)} onSaveAtt={d=>sv('sw_att',d,setAtt)}/>}
        {tab==='overzicht'&&<Overzicht sched={sched} inst={inst} entries={entries} att={att} unlocked={unlocked} onSaveEntries={d=>sv('sw_ent',d,setEntries)} onSaveAtt={d=>sv('sw_att',d,setAtt)} onSaveSched={d=>sv('sw_sched',d,setSched)} onSaveUnlocked={d=>sv('sw_unlocked',d,setUnlocked)}/>}
        {tab==='uren'&&<Uren inst={inst} entries={entries} onSave={d=>sv('sw_ent',d,setEntries)}/>}
        {tab==='maand'&&<Maand inst={inst} entries={entries} paid={paid} onSavePaid={d=>sv('sw_paid',d,setPaid)}/>}
        {tab==='notities'&&<Notities sched={sched} att={att} inst={inst} notes={notes} onSaveNotes={d=>sv('sw_notes',d,setNotes)}/>}
        {tab==='lsg'&&<Lesgevers inst={inst} onSave={d=>sv('sw_inst',d,setInst)}/>}
      </main>
    </div>
  )
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({sched,att,inst,comm,onSaveComm,onSaveAtt}){
  const now=new Date()
  const[viewMonth,setViewMonth]=useState(now.getMonth())
  const[viewYear,setViewYear]=useState(now.getFullYear())
  const inames=inst.map(i=>i.name).sort()

  const allAbsences=useMemo(()=>{
    const r=[]
    Object.keys(att).forEach(wk=>{Object.keys(att[wk]).forEach(locId=>{
      const loc=sched.find(l=>l.locId===locId);if(!loc)return
      Object.keys(att[wk][locId]).forEach(sessId=>{
        const sess=loc.sessions.find(s=>s.id===sessId);if(!sess)return
        const date=getDayDate(wk,sess.dag)
        Object.keys(att[wk][locId][sessId]).forEach(name=>{
          const a=att[wk][locId][sessId][name]
          if(a.aanwezig===false){
            const key=`${wk}_${locId}_${sessId}_${name}`
            r.push({key,name,locId,locName:loc.name,sessId,dag:sess.dag,type:sess.type,date,week:wk,sub:a.sub||''})
          }
        })
      })
    })})
    return r.sort((a,b)=>a.date.localeCompare(b.date))
  },[att,sched])

  const ms=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}`
  const monthAbs=allAbsences.filter(a=>a.date.startsWith(ms))
  const commRows=allAbsences.filter(a=>!comm[a.key]?.done)
  const getC=key=>comm[key]||{overeenkomst:false,contactOuders:false,niveaus:false,done:false}
  const setC=(key,patch)=>onSaveComm({...comm,[key]:{...getC(key),...patch}})
  const confirmC=key=>onSaveComm({...comm,[key]:{...getC(key),done:true}})
  const updateSub=(key,sub)=>{
    const{wk,locId,sessId,name}=parseKey(key)
    const next=JSON.parse(JSON.stringify(att))
    if(!next[wk])next[wk]={};if(!next[wk][locId])next[wk][locId]={};if(!next[wk][locId][sessId])next[wk][locId][sessId]={}
    next[wk][locId][sessId][name]={...(next[wk][locId][sessId][name]||{}),aanwezig:false,sub}
    onSaveAtt(next)
  }
  const consec=useMemo(()=>{
    const g={};monthAbs.forEach(a=>{const k=`${a.name}||${a.locId}||${a.sessId}`;if(!g[k])g[k]={name:a.name,locName:a.locName,dag:a.dag,type:a.type,weeks:[],subs:[]};g[k].weeks.push(a.week);g[k].subs.push(a.sub)})
    return Object.values(g).filter(g=>{if(g.weeks.length<2)return false;const s=[...g.weeks].sort();for(let i=1;i<s.length;i++)if(addDays(s[i-1],7)===s[i])return true;return false}).sort((a,b)=>b.weeks.length-a.weeks.length)
  },[monthAbs])
  const single=useMemo(()=>{
    const g={};monthAbs.forEach(a=>{const k=`${a.name}||${a.locId}||${a.sessId}`;if(!g[k])g[k]={name:a.name,locName:a.locName,dag:a.dag,type:a.type,weeks:[],subs:[]};g[k].weeks.push(a.week);g[k].subs.push(a.sub)})
    return Object.values(g).filter(g=>g.weeks.length===1).sort((a,b)=>a.name.localeCompare(b.name))
  },[monthAbs])
  const commOpen=commRows.filter(a=>{const c=getC(a.key);return!c.overeenkomst||!c.contactOuders||!c.niveaus}).length

  return(<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
      <Title t="Dashboard" s="Vervangingsbeheer, communicatie en contracten."/>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <select value={viewMonth} onChange={e=>setViewMonth(+e.target.value)} style={{...S.inp,padding:'6px 10px'}}>{MNL.map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
        <select value={viewYear} onChange={e=>setViewYear(+e.target.value)} style={{...S.inp,width:82,padding:'6px 10px'}}>{[2025,2026,2027].map(y=><option key={y}>{y}</option>)}</select>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:18}}>
      <MetCard label="Communicatie open" val={commOpen} color={commOpen>0?'#7c3aed':'#16a34a'} sub="overeenkomst/ouders/niveaus"/>
      <MetCard label="Opeenvolgende uitval" val={consec.length} color={consec.length>0?'#d97706':'#16a34a'} sub={MNL[viewMonth]}/>
      <MetCard label="Enkelvoudige afwezigheid" val={single.length} color="#475569" sub={MNL[viewMonth]}/>
    </div>

    {/* COMM TABLE */}
    <div style={S.card}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        <div style={{width:4,height:20,background:'#7c3aed',borderRadius:2}}/>
        <h3 style={{fontSize:15,fontWeight:700,margin:0}}>Communicatie en contracten vervangingen</h3>
        <span style={{fontSize:12,color:'#64748b'}}>{commRows.length} open</span>
      </div>
      <p style={{fontSize:12,color:'#64748b',marginBottom:14}}>Alle 3 kolommen groen → rij bevestigen en verwijderen. Vervanger invullen synchroniseert naar Overzicht lessen.</p>
      {commRows.length===0?<p style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:'14px 0'}}>✓ Alles afgehandeld</p>:
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead><tr style={{background:'#0f2133'}}>{['Datum','Dag','Locatie','Sessie','Afwezige','Vervanger','Overeenkomst','Contact ouders','Niveaus',''].map(h=><th key={h} style={{...S.th,color:'rgba(255,255,255,0.65)',padding:'9px 12px'}}>{h}</th>)}</tr></thead>
            <tbody>{commRows.map((a,i)=>{
              const c=getC(a.key);const ok=c.overeenkomst&&c.contactOuders&&c.niveaus
              return(<tr key={a.key} style={{borderBottom:'1px solid #f1f5f9',background:i%2?'#fafcff':'#fff'}}>
                <td style={{...S.td,fontWeight:600,color:'#475569',whiteSpace:'nowrap'}}>{fmtShort(a.date)}</td>
                <td style={S.td}>{a.dag}</td>
                <td style={{...S.td,fontWeight:500}}>{a.locName}</td>
                <td style={S.td}><TypeBadge type={a.type}/></td>
                <td style={{...S.td,fontWeight:600}}>{a.name}</td>
                <td style={{...S.td,minWidth:175}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <input list={`sl-${i}`} value={a.sub} onChange={e=>updateSub(a.key,e.target.value)} placeholder="Naam vervanger..." style={{...S.inp,width:160,padding:'4px 8px',background:a.sub?'#f0fdf4':'#fff8ed',borderColor:a.sub?'#86efac':'#fb923c',color:a.sub?'#166534':'#92400e'}}/>
                    <datalist id={`sl-${i}`}>{inames.map(n=><option key={n} value={n}/>)}</datalist>
                  </div>
                </td>
                <td style={{...S.td,whiteSpace:'nowrap'}}><SPill on={c.overeenkomst} labelOn="Verzonden" labelOff="Niet aangemaakt" onClick={()=>setC(a.key,{overeenkomst:!c.overeenkomst})}/></td>
                <td style={{...S.td,whiteSpace:'nowrap'}}><SPill on={c.contactOuders} labelOn="Verzonden" labelOff="Niet verzonden" onClick={()=>setC(a.key,{contactOuders:!c.contactOuders})}/></td>
                <td style={{...S.td,whiteSpace:'nowrap'}}><SPill on={c.niveaus} labelOn="Verzonden" labelOff="Niet doorgegeven" onClick={()=>setC(a.key,{niveaus:!c.niveaus})}/></td>
                <td style={{...S.td,whiteSpace:'nowrap'}}>
                  <button onClick={()=>ok&&confirmC(a.key)} title={ok?'Bevestig':'Eerst alle 3 afvinken'} style={{padding:'5px 10px',borderRadius:7,border:'none',cursor:ok?'pointer':'not-allowed',fontWeight:600,fontSize:11,fontFamily:'inherit',background:ok?'#0f2133':'#f1f5f9',color:ok?'#2dd4bf':'#cbd5e1',whiteSpace:'nowrap'}}>
                    {ok?'✓ Bevestigen':'Wacht op alles'}
                  </button>
                </td>
              </tr>)
            })}</tbody>
          </table>
        </div>
      }
    </div>

    {/* CONSECUTIVE */}
    <div style={S.card}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}><div style={{width:4,height:20,background:'#d97706',borderRadius:2}}/><h3 style={{fontSize:15,fontWeight:700,margin:0}}>{`Opeenvolgende uitval — ${MNL[viewMonth]} ${viewYear}`}</h3></div>
      <p style={{fontSize:12,color:'#64748b',marginBottom:10}}>Meerdere weken op rij afwezig op dezelfde sessie.</p>
      {consec.length===0?<p style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:'10px 0'}}>✓ Geen opeenvolgende uitval</p>:
        <div style={{display:'flex',flexDirection:'column',gap:8}}>{consec.map((g,i)=>(
          <div key={i} style={{borderRadius:10,border:'2px solid #fcd34d',background:'#fffbeb',padding:'10px 14px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div style={{minWidth:140}}><div style={{fontWeight:700,fontSize:14}}>{g.name}</div><div style={{fontSize:12,color:'#64748b'}}>{g.locName} · {g.dag}</div></div>
            <div style={{display:'flex',gap:5,flex:1,flexWrap:'wrap'}}>{[...g.weeks].sort().map((wk,j)=>(
              <span key={j} style={{padding:'3px 9px',borderRadius:20,fontSize:12,fontWeight:600,background:g.subs[j]?'#dcfce7':'#fee2e2',color:g.subs[j]?'#166534':'#991b1b',border:`1px solid ${g.subs[j]?'#86efac':'#fca5a5'}`}}>
                {fmtShort(getDayDate(wk,g.dag))} {g.subs[j]?'→ '+g.subs[j]:'⚠ open'}
              </span>
            ))}</div>
            <span style={{padding:'3px 9px',borderRadius:20,fontSize:12,fontWeight:700,background:'#fef3c7',color:'#d97706',whiteSpace:'nowrap'}}>{g.weeks.length}× afwezig</span>
          </div>
        ))}</div>
      }
    </div>

    {/* SINGLE */}
    {single.length>0&&<div style={S.card}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><div style={{width:4,height:20,background:'#94a3b8',borderRadius:2}}/><h3 style={{fontSize:15,fontWeight:700,margin:0}}>{`Enkelvoudige afwezigheid — ${MNL[viewMonth]} ${viewYear}`}</h3></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{borderBottom:'2px solid #f1f5f9'}}>{['Naam','Locatie','Dag','Sessie','Datum','Vervanger'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{single.map((g,i)=>(<tr key={i} style={{borderBottom:'1px solid #f8fafc',background:i%2?'#fafcff':'#fff'}}>
          <td style={{...S.td,fontWeight:600}}>{g.name}</td><td style={S.td}>{g.locName}</td><td style={S.td}>{g.dag}</td><td style={S.td}><TypeBadge type={g.type}/></td>
          <td style={S.td}>{fmtShort(getDayDate(g.weeks[0],g.dag))}</td>
          <td style={S.td}>{g.subs[0]?<span style={{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:600,background:'#dcfce7',color:'#166534'}}>{g.subs[0]}</span>:<span style={{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:600,background:'#fee2e2',color:'#dc2626'}}>Geen</span>}</td>
        </tr>))}</tbody>
      </table></div>
    </div>}
  </div>)
}

// ─── OVERZICHT LESSEN ────────────────────────────────────────────────────────
function Overzicht({sched,inst,entries,att,unlocked,onSaveEntries,onSaveAtt,onSaveSched,onSaveUnlocked}){
  const thisMonday=getMon(new Date().toISOString().split('T')[0])
  const[week,setWeek]=useState(thisMonday)
  const[loc,setLoc]=useState(sched[0]?.locId||'')
  const[editMode,setEditMode]=useState(false)
  const[editId,setEditId]=useState(null)
  const[sf,setSf]=useState(null)
  const[nm,setNm]=useState('');const[ns,setNs]=useState('')
  const curLoc=sched.find(l=>l.locId===loc)
  const weekEnd=addDays(week,6)

  const getAtt=(sessId,name,duur)=>{
    const b=att[week]?.[loc]?.[sessId]?.[name]
    const defH=parseDuur(duur).toString()
    if(!b)return{aanwezig:true,sub:'',hours:defH,note:''}
    return{aanwezig:b.aanwezig!==false,sub:b.sub||'',hours:b.hours!==undefined&&b.hours!==''?b.hours:defH,note:b.note||''}
  }
  const setMA=(sessId,name,duur,patch)=>{
    const next=JSON.parse(JSON.stringify(att))
    if(!next[week])next[week]={};if(!next[week][loc])next[week][loc]={};if(!next[week][loc][sessId])next[week][loc][sessId]={}
    next[week][loc][sessId][name]={...getAtt(sessId,name,duur),...patch}
    onSaveAtt(next)
  }
  const sessRef=sessId=>`${week}_${loc}_${sessId}`
  const isConf=sessId=>entries.some(e=>e._sessRef===sessRef(sessId))
  const isUnlocked=sessId=>unlocked.includes(sessRef(sessId))

  const confirmSess=(sess)=>{
    const ref=sessRef(sess.id)
    const isRedo=isUnlocked(sess.id)
    const base=isRedo?entries.filter(e=>e._sessRef!==ref):entries
    const date=getDayDate(week,sess.dag),locName=curLoc.name,newE=[]
    sess.members.forEach(m=>{
      const a=getAtt(sess.id,m.name,sess.duur)
      const lt=m.role==='lesgever'?sess.type:m.role
      if(a.aanwezig!==false&&parseFloat(a.hours||0)>0){const f=inst.find(i=>i.name===m.name);if(f)newE.push({id:uid(),instId:f.id,date,loc:locName,lt,hours:parseFloat(a.hours),note:'',_sessRef:ref})}
      else if(!a.aanwezig&&a.sub&&parseFloat(a.hours||0)>0){const f=inst.find(i=>i.name===a.sub);if(f)newE.push({id:uid(),instId:f.id,date,loc:locName,lt,hours:parseFloat(a.hours),note:`Vervanger voor ${m.name}`,_sessRef:ref})}
    })
    if(newE.length){
      onSaveEntries([...base,...newE])
      if(isRedo)onSaveUnlocked(unlocked.filter(r=>r!==ref))
      alert(`✓ ${newE.length} uren bevestigd`)
    } else alert('Geen uren om te bevestigen.')
  }
  const handleWijzigen=sessId=>{
    if(!unlocked.includes(sessRef(sessId)))onSaveUnlocked([...unlocked,sessRef(sessId)])
  }

  const updLoc=u=>onSaveSched(sched.map(l=>l.locId===loc?{...l,...u}:l))
  const delS=id=>updLoc({sessions:curLoc.sessions.filter(s=>s.id!==id)})
  const openEdit=sess=>{setSf({...sess,members:sess.members.map(m=>({...m})),substitutes:[...sess.substitutes]});setEditId(sess.id)}
  const openNew=()=>{setSf({id:uid(),dag:'Maandag',type:'kids',duur:'2u',members:[],substitutes:[]});setEditId('new')}
  const saveSess=()=>{if(editId==='new')updLoc({sessions:[...curLoc.sessions,sf]});else updLoc({sessions:curLoc.sessions.map(s=>s.id===editId?sf:s)});setEditId(null);setSf(null);setNm('');setNs('')}
  const addM=()=>{if(!nm.trim())return;setSf(f=>({...f,members:[...f.members,{name:nm.trim(),role:'lesgever'}]}));setNm('')}
  const delM=i=>setSf(f=>({...f,members:f.members.filter((_,j)=>j!==i)}))
  const setR=(i,r)=>setSf(f=>({...f,members:f.members.map((m,j)=>j===i?{...m,role:r}:m)}))
  const addSb=()=>{if(!ns.trim())return;setSf(f=>({...f,substitutes:[...f.substitutes,ns.trim()]}));setNs('')}
  const delSb=i=>setSf(f=>({...f,substitutes:f.substitutes.filter((_,j)=>j!==i)}))
  const inames=inst.map(i=>i.name).sort()
  const TC={kids:['#dbeafe','#1e3a8a'],volwassenen:['#d1fae5','#065f46']}
  const sorted=curLoc?[...curLoc.sessions].sort((a,b)=>(DAY_IDX[a.dag]||0)-(DAY_IDX[b.dag]||0)):[]

  return(<div>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'7px 12px'}}>
        <button onClick={()=>setWeek(addDays(week,-7))} style={{...S.btnSm,fontSize:16,padding:'2px 9px'}}>‹</button>
        <div style={{textAlign:'center',minWidth:165}}><div style={{fontSize:13,fontWeight:700,color:'#0f172a'}}>Week {fmtShort(week)} – {fmtShort(weekEnd)}</div><div style={{fontSize:11,color:'#94a3b8'}}>{new Date(week).getFullYear()}</div></div>
        <button onClick={()=>setWeek(addDays(week,7))} style={{...S.btnSm,fontSize:16,padding:'2px 9px'}}>›</button>
        <button onClick={()=>setWeek(thisMonday)} style={{...S.btnSm,marginLeft:2,background:week===thisMonday?'#0f2133':'#f1f5f9',color:week===thisMonday?'#2dd4bf':'#475569',fontSize:11}}>Nu</button>
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:8}}>
        <button onClick={()=>setEditMode(!editMode)} style={{...S.btnSm,background:editMode?'#fef9c3':undefined,color:editMode?'#92400e':undefined}}>{editMode?'✓ Klaar':'⚙ Planning bewerken'}</button>
        {editMode&&<button onClick={openNew} style={S.btnP}>+ Sessie</button>}
      </div>
    </div>
    <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>{sched.map(l=><button key={l.locId} onClick={()=>setLoc(l.locId)} style={{padding:'6px 12px',borderRadius:8,border:loc===l.locId?'none':'1px solid #e2e8f0',cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:'inherit',background:loc===l.locId?'#0f2133':'#fff',color:loc===l.locId?'#2dd4bf':'#475569'}}>{l.name} <span style={{fontSize:11,opacity:0.5}}>{l.stad}</span></button>)}</div>
    {curLoc&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:13}}>
      {sorted.map(sess=>{
        const date=getDayDate(week,sess.dag);const tc=TC[sess.type]||['#f3e8ff','#4c1d95']
        const conf=isConf(sess.id)&&!isUnlocked(sess.id)
        const editing=isUnlocked(sess.id)
        const absCnt=sess.members.filter(m=>getAtt(sess.id,m.name,sess.duur).aanwezig===false).length
        return(<div key={sess.id} style={{background:'#fff',borderRadius:12,border:`1.5px solid ${conf?'#86efac':editing?'#fbbf24':absCnt>0?'#fcd34d':'#e2e8f0'}`,overflow:'hidden'}}>
          <div style={{padding:'9px 13px',display:'flex',justifyContent:'space-between',alignItems:'center',background:conf?'#f0fdf4':editing?'#fffbeb':absCnt>0?'#fffbeb':'#f8fafc',borderBottom:'1px solid #f1f5f9'}}>
            <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
              <span style={{fontWeight:700,fontSize:14}}>{sess.dag}</span>
              <span style={{fontSize:12,color:'#64748b'}}>{fmtShort(date)}</span>
              <span style={{padding:'2px 7px',borderRadius:20,fontSize:11,fontWeight:600,background:tc[0],color:tc[1]}}>{LL[sess.type]||sess.type}</span>
              <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>{sess.duur}</span>
              {absCnt>0&&!conf&&<span style={{fontSize:11,fontWeight:600,color:'#d97706',background:'#fef3c7',padding:'2px 6px',borderRadius:20}}>{absCnt} afwezig</span>}
              {conf&&<span style={{fontSize:11,color:'#16a34a',fontWeight:700}}>✓ bevestigd</span>}
              {editing&&<span style={{fontSize:11,color:'#d97706',fontWeight:700}}>✏ wijzigen</span>}
            </div>
            {editMode&&<div style={{display:'flex',gap:4}}><button onClick={()=>openEdit(sess)} style={S.btnSm}>✏</button><button onClick={()=>delS(sess.id)} style={{...S.btnSm,background:'#fee2e2',color:'#dc2626'}}>×</button></div>}
          </div>
          {!editMode&&sess.substitutes.length>0&&<div style={{padding:'4px 13px',background:'#fffbeb',borderBottom:'1px solid #fef3c7',fontSize:11,color:'#92400e'}}><b>Vervangers: </b>{sess.substitutes.join(', ')}</div>}
          <div style={{padding:'9px 13px'}}>
            {sess.members.map((m,i)=>{
              const a=getAtt(sess.id,m.name,sess.duur);const present=a.aanwezig!==false
              return(<div key={i} style={{marginBottom:7}}>
                <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginBottom:present?0:4}}>
                  {m.role!=='lesgever'&&<span style={{fontSize:10,padding:'1px 5px',borderRadius:20,background:RC[m.role]?.[0]||'#f1f5f9',color:RC[m.role]?.[1]||'#334155',fontWeight:600}}>{m.role}</span>}
                  <button onClick={()=>setMA(sess.id,m.name,sess.duur,{aanwezig:!present})} style={{padding:'4px 10px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:'inherit',background:present?'#dbeafe':'#fee2e2',color:present?'#1e3a8a':'#991b1b'}}>{m.name}</button>
                  <div style={{display:'flex',alignItems:'center',gap:3}}>
                    <input type="number" step="0.25" min="0" max="12" value={a.hours} onChange={e=>setMA(sess.id,m.name,sess.duur,{hours:e.target.value})} style={{...S.inp,width:50,textAlign:'center',padding:'3px 5px',background:present?'#fff':'#fff8ed',borderColor:present?'#e2e8f0':'#fb923c'}}/>
                    <span style={{fontSize:11,color:'#94a3b8'}}>u</span>
                  </div>
                  {!present&&<input list={`sl-${sess.id}-${i}`} placeholder="Vervanger..." value={a.sub} onChange={e=>setMA(sess.id,m.name,sess.duur,{sub:e.target.value})} style={{...S.inp,width:145,background:'#fff8ed',borderColor:a.sub?'#22c55e':'#fb923c',color:'#92400e',padding:'3px 8px'}}/>}
                  <datalist id={`sl-${sess.id}-${i}`}>{sess.substitutes.map(s=><option key={s} value={s}/>)}{inames.map(n=><option key={n} value={n}/>)}</datalist>
                </div>
                {!present&&<div style={{marginLeft:4,marginTop:4}}>
                  <input placeholder="Notitie voor vervanger (optioneel)..." value={a.note} onChange={e=>setMA(sess.id,m.name,sess.duur,{note:e.target.value})} style={{...S.inp,width:'100%',padding:'4px 9px',fontSize:12,background:'#f8fafc',borderColor:'#e2e8f0'}}/>
                </div>}
              </div>)
            })}
            {!editMode&&!conf&&!editing&&sess.members.length>0&&<button onClick={()=>confirmSess(sess)} style={{...S.btnP,marginTop:7,width:'100%',background:'#0d9488',fontSize:12,padding:'6px'}}>✓ Bevestigen → Maandoverzicht</button>}
            {!editMode&&editing&&<button onClick={()=>confirmSess(sess)} style={{...S.btnP,marginTop:7,width:'100%',background:'#d97706',fontSize:12,padding:'6px'}}>✓ Opnieuw bevestigen</button>}
            {conf&&!editMode&&<div style={{display:'flex',gap:8,marginTop:7}}>
              <p style={{flex:1,fontSize:12,color:'#16a34a',margin:0,fontWeight:600,paddingTop:6}}>✓ Uren opgenomen</p>
              <button onClick={()=>handleWijzigen(sess.id)} style={{...S.btnSm,background:'#fef9c3',color:'#92400e',fontSize:12}}>✏ Wijzigen</button>
            </div>}
          </div>
        </div>)
      })}
    </div>}
    {editId&&sf&&<div style={{position:'fixed',inset:0,background:'rgba(10,20,35,0.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:20}}>
      <div style={{background:'#fff',borderRadius:14,padding:24,width:'100%',maxWidth:510,maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
        <h3 style={{fontSize:16,fontWeight:700,margin:'0 0 14px'}}>{editId==='new'?'Nieuwe sessie':'Sessie bewerken'}</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:13}}>
          <div><label style={S.lbl}>Dag</label><select value={sf.dag} onChange={e=>setSf(f=>({...f,dag:e.target.value}))} style={{...S.inp,width:'100%'}}>{Object.keys(DAY_IDX).map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label style={S.lbl}>Type</label><select value={sf.type} onChange={e=>setSf(f=>({...f,type:e.target.value}))} style={{...S.inp,width:'100%'}}>{['kids','volwassenen'].map(t=><option key={t} value={t}>{LL[t]}</option>)}</select></div>
          <div><label style={S.lbl}>Duur</label><input value={sf.duur} onChange={e=>setSf(f=>({...f,duur:e.target.value}))} style={{...S.inp,width:'100%'}} placeholder="2u"/></div>
        </div>
        <label style={{...S.lbl,marginBottom:7}}>Lesgevers</label>
        {sf.members.map((m,i)=><div key={i} style={{display:'flex',gap:7,marginBottom:5,alignItems:'center'}}><span style={{flex:1,fontSize:13}}>{m.name}</span><select value={m.role} onChange={e=>setR(i,e.target.value)} style={{...S.inp,width:'auto'}}>{ROLES.map(r=><option key={r}>{r}</option>)}</select><button onClick={()=>delM(i)} style={{...S.btnSm,background:'#fee2e2',color:'#dc2626'}}>×</button></div>)}
        <div style={{display:'flex',gap:7,marginBottom:13,marginTop:7}}><input list="il" value={nm} onChange={e=>setNm(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addM()}} placeholder="Lesgever toevoegen..." style={{...S.inp,flex:1}}/><datalist id="il">{inames.map(n=><option key={n} value={n}/>)}</datalist><button onClick={addM} style={S.btnP}>+</button></div>
        <label style={{...S.lbl,marginBottom:7}}>Vervangers</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:7}}>{sf.substitutes.map((s,i)=><span key={i} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:20,fontSize:12,background:'#fef9c3',color:'#713f12',border:'1px dashed #fbbf24'}}>{s}<button onClick={()=>delSb(i)} style={{background:'none',border:'none',cursor:'pointer',color:'#92400e',fontSize:12,padding:0,marginLeft:2}}>×</button></span>)}</div>
        <div style={{display:'flex',gap:7,marginBottom:16}}><input list="il" value={ns} onChange={e=>setNs(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addSb()}} placeholder="Vervanger toevoegen..." style={{...S.inp,flex:1}}/><button onClick={addSb} style={S.btnP}>+</button></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button onClick={()=>{setEditId(null);setSf(null)}} style={S.btnS}>Annuleren</button><button onClick={saveSess} style={S.btnP}>Opslaan</button></div>
      </div>
    </div>}
  </div>)
}

// ─── UREN INVOEREN ────────────────────────────────────────────────────────────
function Uren({inst,entries,onSave}){
  const today=new Date().toISOString().split('T')[0]
  const[f,setF]=useState({instId:'',date:today,loc:'',lt:'kids',hours:'',note:''})
  const[ok,setOk]=useState(false);const[fm,setFm]=useState(today.slice(0,7));const[del,setDel]=useState(null)
  const locs=['De Nachtegaal','Den Bessem','Sorghvliedt','Plantin Moretus','Groot Schijn','De Schinde','Swimcube LO','Andere']
  const sorted=[...inst].sort((a,b)=>a.name.localeCompare(b.name))
  const gi=id=>inst.find(i=>i.id===id)
  const amt=e=>{const i=gi(e.instId);return i?(i.rates[e.lt]||0)*e.hours:0}
  const add=()=>{if(!f.instId||!f.date||!f.loc||!f.hours)return;onSave([{...f,id:uid(),hours:parseFloat(f.hours)},...entries]);setF(p=>({...p,instId:'',hours:'',note:''}));setOk(true);setTimeout(()=>setOk(false),2000)}
  const rows=entries.filter(e=>e.date&&e.date.startsWith(fm)).sort((a,b)=>b.date.localeCompare(a.date))
  const tot=rows.reduce((s,e)=>s+amt(e),0)
  const pre=f.instId&&f.hours?(gi(f.instId)?.rates[f.lt]||0)*parseFloat(f.hours||0):null
  return(<div>
    <Title t="Uren invoeren" s="Manuele invoer — bevestigde uren via Overzicht lessen worden ook hier opgenomen."/>
    <div style={S.card}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
        <div><label style={S.lbl}>Lesgever</label><select value={f.instId} onChange={e=>setF(p=>({...p,instId:e.target.value}))} style={ii}><option value="">— Kies —</option><optgroup label="Zelfstandigen">{sorted.filter(i=>i.status==='zelfstandige').map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</optgroup><optgroup label="Vrijwilligers">{sorted.filter(i=>i.status==='vrijwilliger').map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</optgroup></select></div>
        <div><label style={S.lbl}>Datum</label><input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={ii}/></div>
        <div><label style={S.lbl}>Locatie</label><select value={f.loc} onChange={e=>setF(p=>({...p,loc:e.target.value}))} style={ii}><option value="">— Kies —</option>{locs.map(l=><option key={l}>{l}</option>)}</select></div>
        <div><label style={S.lbl}>Lestype</label><select value={f.lt} onChange={e=>setF(p=>({...p,lt:e.target.value}))} style={ii}>{LT.map(t=><option key={t} value={t}>{LL[t]}</option>)}</select></div>
        <div><label style={S.lbl}>Uren</label><input type="number" step="0.25" min="0.25" max="12" placeholder="bv. 2" value={f.hours} onChange={e=>setF(p=>({...p,hours:e.target.value}))} style={ii}/></div>
        <div><label style={S.lbl}>Notitie</label><input type="text" placeholder="optioneel" value={f.note} onChange={e=>setF(p=>({...p,note:e.target.value}))} style={ii}/></div>
      </div>
      {pre!==null&&<div style={{background:'#f0fdf9',border:'1px solid #99f6e4',borderRadius:8,padding:'7px 12px',marginBottom:10,fontSize:13,color:'#0f766e'}}><b>{euro(pre)}</b> · €{gi(f.instId)?.rates[f.lt]}/u × {f.hours}u</div>}
      <button onClick={add} style={{...S.btnP,background:ok?'#16a34a':'#0f2133',minWidth:120}}>{ok?'✓ Toegevoegd!':'+ Toevoegen'}</button>
    </div>
    <div style={S.card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <span style={{fontWeight:600,fontSize:14}}>{rows.length} invoer · <span style={{color:'#0d9488'}}>{euro(tot)}</span></span>
        <input type="month" value={fm} onChange={e=>setFm(e.target.value)} style={{...S.inp,padding:'6px 10px'}}/>
      </div>
      {rows.length===0?<p style={{textAlign:'center',color:'#94a3b8',padding:'20px 0',fontSize:13}}>Geen uren.</p>:
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{borderBottom:'2px solid #f1f5f9'}}>{['Datum','Lesgever','Locatie','Type','Uren','Bedrag','Notitie',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((e,i)=>{const ins=gi(e.instId);return(<tr key={e.id} style={{borderBottom:'1px solid #f8fafc',background:i%2?'#fafcff':'#fff'}}>
            <td style={S.td}>{e.date}</td><td style={{...S.td,fontWeight:500}}>{ins?ins.name:'?'}</td><td style={S.td}>{e.loc}</td><td style={S.td}>{LL[e.lt]||e.lt}</td>
            <td style={{...S.td,fontWeight:600}}>{e.hours}u</td><td style={{...S.td,fontWeight:600,color:'#0d9488'}}>{euro(amt(e))}</td>
            <td style={{...S.td,color:'#94a3b8',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.note||'—'}</td>
            <td style={S.td}>{del===e.id?<span style={{display:'flex',gap:4}}><button onClick={()=>{onSave(entries.filter(x=>x.id!==e.id));setDel(null)}} style={{...S.btnSm,background:'#fee2e2',color:'#dc2626'}}>Ja</button><button onClick={()=>setDel(null)} style={S.btnSm}>Nee</button></span>:<button onClick={()=>setDel(e.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#cbd5e1',fontSize:17,padding:'0 4px'}}>×</button>}</td>
          </tr>)})}
          </tbody>
        </table></div>
      }
    </div>
  </div>)
}

// ─── MAANDOVERZICHT ───────────────────────────────────────────────────────────
function Maand({inst,entries,paid,onSavePaid}){
  const now=new Date();const[mo,setMo]=useState(now.getMonth());const[yr,setYr]=useState(now.getFullYear())
  const ms=`${yr}-${String(mo+1).padStart(2,'0')}`
  const me=entries.filter(e=>e.date&&e.date.startsWith(ms))
  const sum=useMemo(()=>{const m={};me.forEach(e=>{if(!m[e.instId]){m[e.instId]={};LT.forEach(t=>{m[e.instId][t]={h:0,a:0}})}const r=(inst.find(i=>i.id===e.instId)?.rates[e.lt])||0;m[e.instId][e.lt].h+=e.hours;m[e.instId][e.lt].a+=r*e.hours});return m},[me,inst])
  const rows=st=>inst.filter(i=>i.status===st&&sum[i.id]).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>({i,s:sum[i.id],tot:LT.reduce((a,t)=>a+(sum[i.id][t]?.a||0),0)}))
  const pKey=(instId)=>`${yr}_${mo}_${instId}`
  const isPaid=instId=>paid[pKey(instId)]||false
  const togPaid=instId=>{const k=pKey(instId);onSavePaid({...paid,[k]:!paid[k]})}
  const exportXL=()=>{const mn=MNL[mo],d=[];d.push([`Uitbetalingen ${mn} ${yr}`],[]);const hdr=['Naam','Statuut','IBAN',...LT.flatMap(t=>[LL[t]+' u',LL[t]+' €']),'TOTAAL €','Betaald'];['zelfstandige','vrijwilliger'].forEach(st=>{d.push([st==='zelfstandige'?'ZELFSTANDIGEN':'VRIJWILLIGERS']);d.push(hdr);const rs=rows(st);if(!rs.length){d.push(['(geen)']);d.push([]);return}const th={},ta={};LT.forEach(t=>{th[t]=0;ta[t]=0});rs.forEach(({i,s,tot})=>{const row=[i.name,i.status,i.iban||''];LT.forEach(t=>{row.push(s[t].h||0);row.push(+(s[t].a||0).toFixed(2));th[t]+=s[t].h||0;ta[t]+=s[t].a||0});row.push(+tot.toFixed(2));row.push(isPaid(i.id)?'Betaald':'Niet betaald');d.push(row)});const tr=['TOTAAL','',''];LT.forEach(t=>{tr.push(th[t]);tr.push(+ta[t].toFixed(2))});tr.push(+LT.reduce((s,t)=>s+ta[t],0).toFixed(2));d.push(tr);d.push([])});const ws=XLSX.utils.aoa_to_sheet(d);ws['!cols']=[{wch:26},{wch:14},{wch:22},...LT.flatMap(()=>[{wch:8},{wch:11}]),{wch:12},{wch:12}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,`${mn} ${yr}`);XLSX.writeFile(wb,`Uitbetalingen_${mn}_${yr}.xlsx`)}
  const Sec=({st})=>{const rs=rows(st);const gt=rs.reduce((s,r)=>s+r.tot,0);if(!rs.length)return null;return(<div style={{marginBottom:24}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><SBadge s={st}/><span style={{fontSize:13,color:'#64748b'}}>{rs.length} personen</span><span style={{fontWeight:700,color:'#0d9488'}}>{euro(gt)}</span></div>
    <div style={{overflowX:'auto',borderRadius:10,border:'1px solid #e2e8f0'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
      <thead>
        <tr style={{background:'#0f2133'}}>
          <th style={{...S.th,color:'rgba(255,255,255,0.65)',minWidth:130,padding:'9px 12px'}}>Naam</th>
          {LT.map(t=><th key={t} colSpan={2} style={{...S.th,color:'rgba(255,255,255,0.65)',textAlign:'center',borderLeft:'1px solid rgba(255,255,255,0.1)',padding:'9px 6px',fontSize:10}}>{LL[t]}</th>)}
          <th style={{...S.th,color:'#2dd4bf',textAlign:'right',padding:'9px 12px'}}>Totaal</th>
          <th style={{...S.th,color:'rgba(255,255,255,0.65)',padding:'9px 12px',minWidth:80}}>IBAN</th>
          <th style={{...S.th,color:'rgba(255,255,255,0.65)',textAlign:'center',padding:'9px 10px'}}>Betaald</th>
        </tr>
        <tr style={{background:'#162840'}}><td style={{padding:'2px 12px'}}/>{LT.map(t=>[<td key={t+'u'} style={{padding:'2px 6px',fontSize:9,color:'rgba(255,255,255,0.3)',borderLeft:'1px solid rgba(255,255,255,0.07)'}}>u</td>,<td key={t+'e'} style={{padding:'2px 6px',fontSize:9,color:'rgba(255,255,255,0.3)'}}>€</td>])}<td/><td/><td/></tr>
      </thead>
      <tbody>{rs.map(({i,s,tot},idx)=>(<tr key={i.id} style={{background:idx%2?'#fafcff':'#fff',borderBottom:'1px solid #f1f5f9'}}>
        <td style={{...S.td,fontWeight:600}}>{i.name}</td>
        {LT.map(t=>[<td key={t+'h'} style={{...S.td,color:s[t].h?'#334155':'#e2e8f0',borderLeft:'1px solid #f1f5f9',padding:'8px 6px'}}>{s[t].h?s[t].h+'u':'—'}</td>,<td key={t+'a'} style={{...S.td,textAlign:'right',color:s[t].a?'#0d9488':'#e2e8f0',fontWeight:s[t].a?600:400,padding:'8px 6px'}}>{s[t].a?euro(s[t].a):'—'}</td>])}
        <td style={{...S.td,textAlign:'right',fontWeight:700,background:'#f0fdf9'}}>{euro(tot)}</td>
        <td style={{...S.td,fontFamily:'monospace',fontSize:10,color:'#64748b',whiteSpace:'nowrap'}}>{i.iban||'—'}</td>
        <td style={{...S.td,textAlign:'center'}}>
          <button onClick={()=>togPaid(i.id)} title={isPaid(i.id)?'Betaald — klik om ongedaan te maken':'Nog niet betaald'} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:isPaid(i.id)?'#16a34a':'#ef4444',padding:'0 4px'}}>
            {isPaid(i.id)?'✓':'✗'}
          </button>
        </td>
      </tr>))}</tbody>
    </table></div>
  </div>)}
  return(<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
      <Title t="Maandoverzicht" s="Overzicht per maand — IBAN, betaaldstatus en Excel-export."/>
      <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
        <select value={mo} onChange={e=>setMo(+e.target.value)} style={{...S.inp,padding:'6px 10px'}}>{MNL.map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
        <select value={yr} onChange={e=>setYr(+e.target.value)} style={{...S.inp,width:82,padding:'6px 10px'}}>{[2025,2026,2027].map(y=><option key={y}>{y}</option>)}</select>
        <button onClick={exportXL} style={{...S.btnP,background:'#0d9488'}}>↓ Excel</button>
      </div>
    </div>
    {me.length===0?<div style={{...S.card,textAlign:'center',padding:'44px 0',color:'#94a3b8'}}><div style={{fontSize:30,marginBottom:8}}>📋</div><p style={{color:'#64748b',fontWeight:600,margin:'0 0 4px'}}>Geen uren voor {MNL[mo]} {yr}</p></div>
    :<div style={S.card}><Sec st="zelfstandige"/><Sec st="vrijwilliger"/></div>}
  </div>)
}

// ─── NOTITIES ─────────────────────────────────────────────────────────────────
function Notities({sched,att,inst,notes,onSaveNotes}){
  const[filterLoc,setFilterLoc]=useState('')
  const[filterInst,setFilterInst]=useState('')
  const[form,setForm]=useState({locId:'',instName:'',text:''})
  const[del,setDel]=useState(null)

  const subNotes=useMemo(()=>{
    const r=[]
    Object.keys(att).forEach(wk=>{Object.keys(att[wk]).forEach(locId=>{
      const loc=sched.find(l=>l.locId===locId);if(!loc)return
      Object.keys(att[wk][locId]).forEach(sessId=>{
        const sess=loc.sessions.find(s=>s.id===sessId);if(!sess)return
        const date=getDayDate(wk,sess.dag)
        Object.keys(att[wk][locId][sessId]).forEach(name=>{
          const a=att[wk][locId][sessId][name]
          if(a.note){r.push({id:`att_${wk}_${locId}_${sessId}_${name}`,locId,locName:loc.name,instName:name,sub:a.sub,text:a.note,date,fromSub:true})}
        })
      })
    })})
    return r
  },[att,sched])

  const all=[...subNotes,...notes].sort((a,b)=>b.date.localeCompare(a.date))
  const filtered=all.filter(n=>{
    if(filterLoc&&n.locId!==filterLoc)return false
    if(filterInst&&!n.instName.toLowerCase().includes(filterInst.toLowerCase()))return false
    return true
  })

  const addNote=()=>{
    if(!form.text.trim())return
    const locName=sched.find(l=>l.locId===form.locId)?.name||'Algemeen'
    onSaveNotes([...notes,{id:uid(),locId:form.locId,locName,instName:form.instName,text:form.text.trim(),date:new Date().toISOString().split('T')[0],fromSub:false}])
    setForm({locId:'',instName:'',text:''})
  }

  return(<div>
    <Title t="Notities" s="Notities per lesgever en locatie. Vervangingsnotities uit Overzicht lessen verschijnen hier automatisch."/>
    <div style={S.card}>
      <h3 style={{fontSize:14,fontWeight:600,margin:'0 0 12px',color:'#0f172a'}}>Nieuwe notitie toevoegen</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div><label style={S.lbl}>Locatie</label>
          <select value={form.locId} onChange={e=>setForm(p=>({...p,locId:e.target.value}))} style={ii}>
            <option value="">Geen / Algemeen</option>{sched.map(l=><option key={l.locId} value={l.locId}>{l.name}</option>)}
          </select>
        </div>
        <div><label style={S.lbl}>Lesgever (optioneel)</label>
          <input list="ilist-n" value={form.instName} onChange={e=>setForm(p=>({...p,instName:e.target.value}))} placeholder="Naam lesgever..." style={ii}/>
          <datalist id="ilist-n">{inst.map(i=><option key={i.id} value={i.name}/>)}</datalist>
        </div>
      </div>
      <div style={{display:'flex',gap:10}}>
        <textarea value={form.text} onChange={e=>setForm(p=>({...p,text:e.target.value}))} placeholder="Notitie..." rows={2} style={{...ii,flex:1,resize:'vertical',padding:'8px 10px'}}/>
        <button onClick={addNote} style={{...S.btnP,alignSelf:'flex-end',whiteSpace:'nowrap'}}>+ Toevoegen</button>
      </div>
    </div>

    <div style={S.card}>
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontWeight:600,fontSize:14,color:'#0f172a'}}>{filtered.length} notities</span>
        <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)} style={{...S.inp,width:'auto',padding:'6px 10px'}}>
          <option value="">Alle locaties</option>{sched.map(l=><option key={l.locId} value={l.locId}>{l.name}</option>)}
        </select>
        <input value={filterInst} onChange={e=>setFilterInst(e.target.value)} placeholder="Filter op lesgever..." style={{...S.inp,width:200}}/>
        {(filterLoc||filterInst)&&<button onClick={()=>{setFilterLoc('');setFilterInst('')}} style={S.btnSm}>✕ Reset</button>}
      </div>
      {filtered.length===0?<p style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:'20px 0'}}>Geen notities gevonden.</p>:
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map((n,i)=>(
            <div key={n.id} style={{borderRadius:10,border:'1px solid #e2e8f0',padding:'12px 16px',background:n.fromSub?'#fffbeb':'#fff',borderLeft:`3px solid ${n.fromSub?'#f59e0b':'#2dd4bf'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  {n.fromSub&&<span style={{padding:'1px 7px',borderRadius:20,fontSize:11,fontWeight:600,background:'#fef3c7',color:'#92400e'}}>Vervanging</span>}
                  <span style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{n.instName||'—'}</span>
                  {n.locName&&<span style={{fontSize:12,color:'#64748b'}}>· {n.locName}</span>}
                  {n.sub&&<span style={{fontSize:12,color:'#64748b'}}>· vervanger: <b>{n.sub}</b></span>}
                  <span style={{fontSize:11,color:'#94a3b8'}}>{fmtDate(n.date)}</span>
                </div>
                {!n.fromSub&&<div>
                  {del===n.id?<span style={{display:'flex',gap:4}}>
                    <button onClick={()=>{onSaveNotes(notes.filter(x=>x.id!==n.id));setDel(null)}} style={{...S.btnSm,background:'#fee2e2',color:'#dc2626'}}>Ja</button>
                    <button onClick={()=>setDel(null)} style={S.btnSm}>Nee</button>
                  </span>:<button onClick={()=>setDel(n.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#cbd5e1',fontSize:16,padding:'0 4px'}}>×</button>}
                </div>}
              </div>
              <p style={{margin:0,fontSize:13,color:'#334155',lineHeight:1.5}}>{n.text}</p>
            </div>
          ))}
        </div>
      }
    </div>
  </div>)
}

// ─── LESGEVERS ────────────────────────────────────────────────────────────────
function Lesgevers({inst,onSave}){
  const[modal,setModal]=useState(false);const[eid,setEid]=useState(null);const[search,setSearch]=useState('');const[fst,setFst]=useState('all');const[f,setF]=useState(null);const[del,setDel]=useState(null)
  const empty={name:'',status:'vrijwilliger',email:'',iban:'',rates:{kids:30,volwassenen:30,coordinator:0,redder:20,onthaalmedewerker:0,toezichter:14,hulp_coordinator_np:0,hulp_coordinator_p:12.5}}
  const openAdd=()=>{setF({...empty,rates:{...empty.rates}});setEid(null);setModal(true)}
  const openEdit=i=>{setF({...i,rates:{...i.rates}});setEid(i.id);setModal(true)}
  const save=()=>{if(!f.name.trim())return;onSave(eid?inst.map(i=>i.id===eid?{...f,id:eid}:i):[...inst,{...f,id:uid()}]);setModal(false)}
  const list=inst.filter(i=>fst==='all'||i.status===fst).filter(i=>i.name.toLowerCase().includes(search.toLowerCase())||i.email?.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.status!==b.status?(a.status==='zelfstandige'?-1:1):a.name.localeCompare(b.name))

  return(<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
      <Title t="Lesgevers" s={`${inst.length} lesgevers — tarieven, IBAN en e-mailadres`}/>
      <button onClick={openAdd} style={S.btnP}>+ Nieuwe lesgever</button>
    </div>
    <div style={{display:'flex',gap:10,marginBottom:12}}>
      <input placeholder="Zoeken op naam of e-mail..." value={search} onChange={e=>setSearch(e.target.value)} style={{...ii,width:240}}/>
      <select value={fst} onChange={e=>setFst(e.target.value)} style={{...ii,width:'auto',padding:'8px 12px'}}><option value="all">Alle</option><option value="zelfstandige">Zelfstandigen</option><option value="vrijwilliger">Vrijwilligers</option></select>
    </div>
    <div style={{...S.card,padding:0,overflow:'hidden'}}><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>{['Naam','Statuut','Kids','Volwas','Coord','Redder','Onthaal','Toez.','H.C.NB','H.C.B','IBAN','E-mail',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{list.map((i,idx)=>(<tr key={i.id} style={{borderBottom:'1px solid #f8fafc',background:idx%2?'#fafcff':'#fff'}}>
        <td style={{...S.td,fontWeight:600}}>{i.name}</td><td style={S.td}><SBadge s={i.status}/></td>
        {['kids','volwassenen','coordinator','redder','onthaalmedewerker','toezichter','hulp_coordinator_np','hulp_coordinator_p'].map(t=><td key={t} style={{...S.td,color:i.rates[t]?'#475569':'#e2e8f0',padding:'8px 10px'}}>{i.rates[t]?'€'+i.rates[t]:'—'}</td>)}
        <td style={{...S.td,fontFamily:'monospace',fontSize:10,color:'#64748b',whiteSpace:'nowrap'}}>{i.iban||'—'}</td>
        <td style={{...S.td,fontSize:12,color:'#64748b'}}>{i.email||'—'}</td>
        <td style={{...S.td,whiteSpace:'nowrap'}}><button onClick={()=>openEdit(i)} style={{...S.btnSm,marginRight:5}}>✏</button>
          {del===i.id?<span style={{display:'inline-flex',gap:4}}><button onClick={()=>{onSave(inst.filter(x=>x.id!==i.id));setDel(null)}} style={{...S.btnSm,background:'#fee2e2',color:'#dc2626'}}>Ja</button><button onClick={()=>setDel(null)} style={S.btnSm}>Nee</button></span>:<button onClick={()=>setDel(i.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#cbd5e1',fontSize:17,padding:'0 4px'}}>×</button>}
        </td>
      </tr>))}</tbody>
    </table></div>{list.length===0&&<p style={{textAlign:'center',padding:24,color:'#94a3b8',fontSize:13}}>Geen resultaten.</p>}</div>
    {modal&&f&&<div style={{position:'fixed',inset:0,background:'rgba(10,20,35,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:20}}>
      <div style={{background:'#fff',borderRadius:14,padding:24,width:'100%',maxWidth:520,maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
        <h3 style={{fontSize:16,fontWeight:700,margin:'0 0 14px'}}>{eid?'Bewerken':'Nieuwe lesgever'}</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
          <div style={{gridColumn:'span 2'}}><label style={S.lbl}>Naam</label><input value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} style={ii} placeholder="Volledige naam"/></div>
          <div><label style={S.lbl}>Statuut</label><select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} style={ii}><option value="vrijwilliger">Vrijwilliger</option><option value="zelfstandige">Zelfstandige</option></select></div>
          <div><label style={S.lbl}>IBAN</label><input value={f.iban||''} onChange={e=>setF(p=>({...p,iban:e.target.value}))} style={ii} placeholder="BE00 0000 0000 0000"/></div>
          <div style={{gridColumn:'span 2'}}><label style={S.lbl}>E-mailadres</label><input type="email" value={f.email||''} onChange={e=>setF(p=>({...p,email:e.target.value}))} style={ii} placeholder="naam@email.com"/></div>
        </div>
        <p style={{...S.lbl,marginBottom:8}}>Tarieven (€/uur)</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
          {LT.map(t=><div key={t}><label style={{...S.lbl,fontSize:9}}>{LL[t]}</label><input type="number" step="0.5" min="0" value={f.rates[t]||0} onChange={e=>setF(p=>({...p,rates:{...p.rates,[t]:parseFloat(e.target.value)||0}}))} style={ii}/></div>)}
        </div>
        <div style={{background:'#f8fafc',borderRadius:8,padding:'7px 12px',marginBottom:12,fontSize:12,color:'#64748b'}}>Standaard: Toezichter €14/u · Redder €20/u · Hulp coörd. betalend: €10 (ZST) / €12,50 (VW)</div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button onClick={()=>setModal(false)} style={S.btnS}>Annuleren</button><button onClick={save} style={S.btnP}>Opslaan</button></div>
      </div>
    </div>}
  </div>)
}
