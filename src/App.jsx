import { useState, useRef, useCallback, useEffect } from "react";

const RETAILERS = {
  "BJ's Wholesale Club": { nsCustomer: "BJs Wholesale Corporate : BJs Wholesale", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
  "Hy-Vee": { nsCustomer: "Hy-Vee", shipMethod: "Freight", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
  "TJ Maxx Canada": { nsCustomer: "TJ Maxx Canada", shipMethod: "Freight", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
  "Global New Beginnings": { nsCustomer: "Global New Beginnings", shipMethod: "Freight", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
};
const SHIP_METHODS = ["Route","Freight","UPS Ground","UPS 2nd Day Air","FedEx Ground","FedEx Express","Will Call","Other"];
const STATUSES = ["Pending Fulfillment","Pending Approval","Pending Billing","Billed","Closed"];
const CSV_HEADERS = ["Order #","SKU","NS SKU","Date","Quantity","Rate","Amount","Is EDI Sent","PO Number","NS CUSTOMER","Is Sample","Price Level","Status","Ship Date","Cancel Date","Must Arrive By Date","Name","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo"];
const IM_KEY = "item-master-data";
const IM_SHARED = true;
const TABS_PREVIEW = [
  { label: "Order", cols: ["Order #","Date","PO Number","Status","Price Level","Is EDI Sent"] },
  { label: "Items", cols: ["SKU","NS SKU","Quantity","Rate","Amount"] },
  { label: "Dates", cols: ["Ship Date","Cancel Date","Must Arrive By Date"] },
  { label: "Ship to", cols: ["Name","Address 1","Address 2","City","State","Zip","Country"] },
  { label: "Settings", cols: ["NS CUSTOMER","Ship Method","Memo"] },
];

function esc(v){if(v===null||v===undefined)return "";const s=String(v);return(s.includes(",")||s.includes('"')||s.includes("\n"))?'"'+s.replace(/"/g,'""')+'"':s;}
function buildCSV(rows){return[CSV_HEADERS.join(","),...rows.map(r=>CSV_HEADERS.map(h=>esc(r[h])).join(","))].join("\n");}
function dlCSV(content,name){const b=new Blob([content],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
function addDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+n);return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}

const PROMPT=`Extract data from this purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","deliveryDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY or empty","cancelDate":"MM/DD/YYYY or empty","mustArriveByDate":"MM/DD/YYYY or empty","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":"","lineItems":[{"upc":"","vendorItemNum":"","quantity":0,"unitPrice":0,"description":""}]}\n\nRules: mustArriveByDate=deliveryDate if only one date. shipDate/cancelDate=empty if not stated. Extract ALL lines. ONLY JSON.`;

const S = {
  card:{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"1.1rem 1.25rem",marginBottom:"0.9rem"},
  sectionLabel:{fontSize:11,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--color-text-tertiary)",display:"block",marginBottom:10},
  fieldLabel:{fontSize:13,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:5},
  select:{width:"100%",boxSizing:"border-box",padding:"8px 10px",fontSize:14,fontFamily:"var(--font-sans)",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",cursor:"pointer"},
  input:{width:"100%",boxSizing:"border-box",padding:"8px 10px",fontSize:14,fontFamily:"var(--font-sans)",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)"},
  dzBase:{border:"1.5px dashed var(--color-border-secondary)",borderRadius:8,padding:"1.75rem 1rem",textAlign:"center",cursor:"pointer"},
  dzHover:{border:"1.5px dashed var(--color-border-info)",background:"var(--color-background-info)"},
  fileRow:{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"var(--color-background-secondary)",borderRadius:8,border:"0.5px solid var(--color-border-tertiary)"},
  imStored:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--color-background-success)",border:"0.5px solid var(--color-border-success)",borderRadius:8,padding:"10px 14px"},
  btnPrimary:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"11px 20px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"var(--color-text-primary)",color:"var(--color-background-primary)",cursor:"pointer"},
  btnPrimaryDis:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"11px 20px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"var(--color-text-primary)",color:"var(--color-background-primary)",cursor:"not-allowed",opacity:0.4},
  btnOutline:{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",fontSize:13,fontWeight:500,fontFamily:"var(--font-sans)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)",cursor:"pointer"},
  btnSuccess:{display:"flex",alignItems:"center",gap:6,padding:"9px 20px",fontSize:13,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"#166534",color:"#fff",cursor:"pointer"},
  btnReplace:{fontSize:12,color:"var(--color-text-secondary)",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"var(--font-sans)"},
  mainTabBtn:(active)=>({padding:"8px 16px",fontSize:13,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderBottom:active?"2px solid var(--color-text-primary)":"2px solid transparent",background:"transparent",color:active?"var(--color-text-primary)":"var(--color-text-secondary)",cursor:"pointer"}),
  previewTabBtn:(active)=>({padding:"5px 13px",fontSize:12,fontFamily:"var(--font-sans)",borderRadius:8,border:"0.5px solid var(--color-border-secondary)",background:active?"var(--color-text-primary)":"var(--color-background-secondary)",color:active?"var(--color-background-primary)":"var(--color-text-secondary)",cursor:"pointer"}),
  stat:{background:"var(--color-background-secondary)",borderRadius:8,padding:"0.75rem 1rem"},
  statLabel:{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",color:"var(--color-text-tertiary)",marginBottom:3},
  statVal:{fontSize:18,fontWeight:500,color:"var(--color-text-primary)"},
  msgErr:{fontSize:13,color:"var(--color-text-danger)",background:"var(--color-background-danger)",borderRadius:8,padding:"9px 13px",marginBottom:10,display:"flex",alignItems:"center",gap:8},
  msgWarn:{fontSize:13,color:"var(--color-text-warning)",background:"var(--color-background-warning)",borderRadius:8,padding:"9px 13px",marginBottom:8,display:"flex",alignItems:"center",gap:8},
  msgOk:{fontSize:13,color:"var(--color-text-success)",background:"var(--color-background-success)",borderRadius:8,padding:"9px 13px",marginBottom:8,display:"flex",alignItems:"center",gap:8},
  th:{textAlign:"left",padding:"7px 10px",borderBottom:"0.5px solid var(--color-border-tertiary)",fontWeight:500,fontSize:12,color:"var(--color-text-secondary)",whiteSpace:"nowrap"},
  td:{padding:"7px 10px",fontSize:12,color:"var(--color-text-primary)",whiteSpace:"nowrap"},
  removeLink:{fontSize:12,color:"var(--color-text-tertiary)",textDecoration:"underline",cursor:"pointer",marginTop:4,display:"inline-block"},
};

export default function App() {
  const [mainTab, setMainTab] = useState("convert");
  const [retailer, setRetailer] = useState("BJ's Wholesale Club");
  const [shipMethod, setShipMethod] = useState("Route");
  const [orderStatus, setOrderStatus] = useState("Pending Fulfillment");
  const [memo, setMemo] = useState("");
  const [im, setIm] = useState(null);
  const [imMeta, setImMeta] = useState(null);
  const [imLoading, setImLoading] = useState(true);
  const [imDrag, setImDrag] = useState(false);
  const [imDebug, setImDebug] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [pdfDrag, setPdfDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [previewTab, setPreviewTab] = useState("Order");
  const [err, setErr] = useState("");
  const imRef = useRef(); const pdfRef = useRef();

  useEffect(()=>{
    (async()=>{
      try{const s=await window.storage.get(IM_KEY,IM_SHARED);if(s?.value){const p=JSON.parse(s.value);setIm(p.items);setImMeta({name:p.name,count:p.items.length,savedAt:p.savedAt,updatedBy:p.updatedBy||""});}}catch(_){}
      setImLoading(false);
    })();
  },[]);

  const parseIM = useCallback((text)=>{
    const firstLine = text.split("\n")[0];
    const delim = firstLine.includes("\t") ? "\t" : ",";
    const lines = text.split("\n").filter(l=>l.trim());
    if(lines.length<2) return {items:[],headers:[]};
    const rawHeaders = lines[0].replace(/^﻿/,"");
    const headers = rawHeaders.split(delim).map(h=>h.trim().replace(/^["']|["']$/g,""));
    const items = lines.slice(1).map(line=>{
      const cols = line.split(delim);
      const obj={};
      headers.forEach((h,i)=>{obj[h]=(cols[i]||"").trim().replace(/^["']|["']$/g,"");});
      return obj;
    }).filter(o=>Object.values(o).some(v=>v));
    return {items, headers};
  },[]);

  const loadIM = (file)=>{
    if(!file) return;
    const r=new FileReader();
    r.onload=async(ev)=>{
      const {items, headers}=parseIM(ev.target.result);
      const firstItem = items[0]||{};
      setImDebug({
        headers: headers.slice(0,10),
        firstSKU: firstItem["SKU"]||"(not found)",
        firstParent: firstItem["Parent SKU"]||"(not found)",
        firstUPC: firstItem["UPC Code"]||"(not found)",
        allKeys: Object.keys(firstItem).slice(0,15),
      });
      setIm(items);
      const savedAt=new Date().toLocaleDateString();
      const meta={name:file.name,count:items.length,savedAt,updatedBy:"you"};
      setImMeta(meta);
      try{await window.storage.set(IM_KEY,JSON.stringify({items,name:file.name,savedAt,updatedBy:"you"}),IM_SHARED);}catch(_){}
    };
    r.readAsText(file);
  };

  const clearIM = async()=>{setIm(null);setImMeta(null);setImDebug(null);try{await window.storage.delete(IM_KEY,IM_SHARED);}catch(_){} if(imRef.current)imRef.current.value="";};

  const lookup = useCallback((items,upc,vin)=>{
    if(!items?.length) return null;
    const normUPC = String(upc||"").replace(/\D/g,"");
    const normVIN = String(vin||"").trim().toUpperCase();
    if(normUPC){
      const m=items.find(it=>String(it["UPC Code"]||"").replace(/\D/g,"")===normUPC);
      if(m) return m;
    }
    if(normVIN){
      const m=items.find(it=>String(it["SKU"]||"").trim().toUpperCase()===normVIN);
      if(m) return m;
    }
    if(normVIN){
      const m=items.find(it=>{const s=String(it["SKU"]||"").trim().toUpperCase();return s&&normVIN.includes(s);});
      if(m) return m;
    }
    if(normVIN){
      const m=items.find(it=>{const s=String(it["SKU"]||"").trim().toUpperCase();return s&&s.includes(normVIN);});
      if(m) return m;
    }
    return null;
  },[]);

  const handleRetailer=(r)=>{setRetailer(r);setShipMethod(RETAILERS[r].shipMethod);setOrderStatus(RETAILERS[r].status);};

  const loadPDF=(file)=>{
    if(!file) return;
    setPdfName(file.name);
    const r=new FileReader();
    r.onload=ev=>setPdf(ev.target.result.split(",")[1]);
    r.readAsDataURL(file);
  };

  const resetPDF=()=>{setPdf(null);setPdfName("");setResult(null);setRows([]);setErr("");setBusy(false);if(pdfRef.current)pdfRef.current.value="";};

  const process=async()=>{
    if(!pdf){setErr("Please upload a PO PDF first.");return;}
    setErr("");setResult(null);setRows([]);setBusy(true);setBusyMsg("Reading PO...");
    try{
      const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:PROMPT,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:pdf}},{type:"text",text:"Extract the purchase order data."}]}]})});
      const data=await resp.json();
      const raw=data.content?.find(b=>b.type==="text")?.text||"";
      const po=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setBusyMsg("Matching items...");
      const rc=RETAILERS[retailer];
      const mabd=po.mustArriveByDate||po.deliveryDate||"";
      const shipDate=po.shipDate||addDays(mabd,-14);
      const cancelDate=po.cancelDate||mabd;
      const newRows=[],unmatched=[];
      for(const line of po.lineItems){
        let sku="",nsSku="";
        if(im?.length){
          const m=lookup(im,line.upc,line.vendorItemNum);
          if(m){
            sku=String(m["SKU"]||"").trim();
            const parent=String(m["Parent SKU"]||"").trim();
            nsSku=parent&&parent!==sku?`${parent} : ${sku}`:sku;
          }else{
            unmatched.push(line.vendorItemNum||line.upc||line.description);
            sku=line.vendorItemNum||"";nsSku=sku;
          }
        }else{sku=line.vendorItemNum||"";nsSku=sku;}
        const qty=Number(line.quantity)||0,rate=Number(line.unitPrice)||0;
        newRows.push({"Order #":po.poNumber,"SKU":sku,"NS SKU":nsSku,"Date":po.orderDate,"Quantity":qty,"Rate":rate,"Amount":parseFloat((qty*rate).toFixed(2)),"Is EDI Sent":rc.isEdiSent,"PO Number":po.poNumber,"NS CUSTOMER":rc.nsCustomer,"Is Sample":rc.isSample,"Price Level":rc.priceLevel,"Status":orderStatus,"Ship Date":shipDate,"Cancel Date":cancelDate,"Must Arrive By Date":mabd,"Name":po.shipToName,"Attention":po.shipToAttention||"","Address 1":po.shipToAddress1,"Address 2":po.shipToAddress2||"","City":po.shipToCity,"State":po.shipToState,"Zip":po.shipToZip,"Country":po.shipToCountry,"Ship Method":shipMethod,"Memo":memo||po.memo||""});
      }
      setRows(newRows);setResult({po,unmatched,shipDate,cancelDate,mabd});setBusy(false);
    }catch(e){setErr("Error: "+e.message);setBusy(false);}
  };

  const total=rows.reduce((s,r)=>s+Number(r["Amount"]),0);
  const firstRow=rows[0]||{};

  return (
    <div style={{fontFamily:"var(--font-sans)",padding:"1.5rem 0",maxWidth:660}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{marginBottom:"1.25rem"}}>
        <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 4px",color:"var(--color-text-primary)"}}>NetSuite PO Converter</h2>
        <p style={{fontSize:14,color:"var(--color-text-secondary)",margin:0}}>Upload a retailer purchase order and download a NetSuite-ready CSV</p>
      </div>

      {/* Main tabs */}
      <div style={{display:"flex",borderBottom:"0.5px solid var(--color-border-tertiary)",marginBottom:"1.25rem",gap:0}}>
        {[{id:"convert",label:"Convert PO",icon:"ti-wand"},{id:"itemmaster",label:"Item master",icon:"ti-table"}].map(t=>(
          <button key={t.id} style={S.mainTabBtn(mainTab===t.id)} onClick={()=>setMainTab(t.id)}>
            <i className={`ti ${t.icon}`} aria-hidden="true" style={{fontSize:14,marginRight:6,verticalAlign:"-1px"}}/>{t.label}
            {t.id==="itemmaster"&&imMeta&&<span style={{marginLeft:6,fontSize:11,padding:"2px 7px",borderRadius:10,background:"var(--color-background-success)",color:"var(--color-text-success)",fontWeight:500}}>{imMeta.count.toLocaleString()}</span>}
          </button>
        ))}
      </div>

      {/* CONVERT TAB */}
      {mainTab==="convert"&&(<>
        {!imMeta&&!imLoading&&(
          <div style={{...S.msgWarn,marginBottom:"0.9rem"}}>
            <i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:15,flexShrink:0}}/>
            <span>No item master loaded. <button onClick={()=>setMainTab("itemmaster")} style={{background:"none",border:"none",color:"var(--color-text-warning)",textDecoration:"underline",cursor:"pointer",fontFamily:"var(--font-sans)",fontSize:13,padding:0,fontWeight:500}}>Upload one</button> for SKU matching.</span>
          </div>
        )}

        <div style={S.card}>
          <span style={S.sectionLabel}><i className="ti ti-settings" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Order settings</span>
          <div style={{marginBottom:10}}>
            <label style={S.fieldLabel}>Retailer</label>
            <select style={S.select} value={retailer} onChange={e=>handleRetailer(e.target.value)} disabled={busy}>
              {Object.keys(RETAILERS).map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><label style={S.fieldLabel}>Ship method</label>
              <select style={S.select} value={shipMethod} onChange={e=>setShipMethod(e.target.value)} disabled={busy}>
                {SHIP_METHODS.map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={S.fieldLabel}>Status</label>
              <select style={S.select} value={orderStatus} onChange={e=>setOrderStatus(e.target.value)} disabled={busy}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={S.fieldLabel}>Memo <span style={{fontWeight:400,color:"var(--color-text-tertiary)"}}>— optional</span></label>
            <input style={S.input} type="text" placeholder="e.g. Spring 2026 Drop" value={memo} onChange={e=>setMemo(e.target.value)} disabled={busy}/>
          </div>
        </div>

        <div style={S.card}>
          <span style={S.sectionLabel}><i className="ti ti-file-type-pdf" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Purchase order PDF</span>
          {pdf?(
            <div style={S.fileRow}>
              <i className="ti ti-file-type-pdf" aria-hidden="true" style={{fontSize:26,color:"var(--color-text-secondary)"}}/>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:14,fontWeight:500,color:"var(--color-text-primary)"}}>{pdfName}</p>
                <span style={S.removeLink} onClick={resetPDF}>Remove</span>
              </div>
              <i className="ti ti-circle-check" aria-hidden="true" style={{fontSize:20,color:"var(--color-text-success)"}}/>
            </div>
          ):(
            <div
              style={{...S.dzBase,...(pdfDrag?S.dzHover:{})}}
              onClick={()=>pdfRef.current?.click()}
              onDragOver={e=>{e.preventDefault();setPdfDrag(true);}}
              onDragLeave={()=>setPdfDrag(false)}
              onDrop={e=>{e.preventDefault();setPdfDrag(false);loadPDF(e.dataTransfer.files[0]);}}>
              <i className="ti ti-file-type-pdf" aria-hidden="true" style={{fontSize:28,color:"var(--color-text-tertiary)",display:"block",marginBottom:6}}/>
              <p style={{fontSize:14,color:"var(--color-text-secondary)",margin:0}}>Click or drag to upload PO PDF</p>
              <p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:"4px 0 0"}}>Supports any retailer PDF format</p>
            </div>
          )}
          <input ref={pdfRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>loadPDF(e.target.files[0])}/>
        </div>

        {err&&<div style={S.msgErr}><i className="ti ti-alert-circle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>{err}</div>}

        {!result&&(
          <button style={busy||!pdf?S.btnPrimaryDis:S.btnPrimary} onClick={process} disabled={busy||!pdf}>
            {busy
              ?<><span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>{busyMsg}</>
              :<><i className="ti ti-wand" aria-hidden="true" style={{fontSize:16}}/>Extract &amp; generate CSV</>}
          </button>
        )}

        {result&&(<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:"1rem"}}>
            <div style={S.stat}><div style={S.statLabel}>PO number</div><div style={{...S.statVal,fontSize:15}}>{result.po.poNumber}</div></div>
            <div style={S.stat}><div style={S.statLabel}>Lines</div><div style={S.statVal}>{rows.length}</div></div>
            <div style={S.stat}><div style={S.statLabel}>MABD</div><div style={{...S.statVal,fontSize:14}}>{result.mabd||"—"}</div></div>
            <div style={S.stat}><div style={S.statLabel}>Total</div><div style={{...S.statVal,fontSize:14}}>${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
          </div>

          {result.unmatched?.length>0&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>Unmatched:</strong> {result.unmatched.join(", ")} — vendor item # used as fallback</span></div>}
          {!result.unmatched?.length&&im&&<div style={S.msgOk}><i className="ti ti-circle-check" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>All items matched to item master</div>}

          <div style={{...S.card,marginTop:0}}>
            <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
              {TABS_PREVIEW.map(t=>(
                <button key={t.label} style={S.previewTabBtn(previewTab===t.label)} onClick={()=>setPreviewTab(t.label)}>{t.label}</button>
              ))}
            </div>
            <div style={{overflowX:"auto",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"var(--color-background-secondary)"}}>
                    {TABS_PREVIEW.find(t=>t.label===previewTab)?.cols.map(h=><th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row,i)=>(
                    <tr key={i}>
                      {TABS_PREVIEW.find(t=>t.label===previewTab)?.cols.map(h=>(
                        <td key={h} style={{...S.td,borderBottom:i<rows.length-1?"0.5px solid var(--color-border-tertiary)":"none"}}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{padding:"10px 14px",background:"var(--color-background-secondary)",borderRadius:8,fontSize:12,color:"var(--color-text-secondary)",marginBottom:"1rem"}}>
            <span style={{color:"var(--color-text-primary)",fontWeight:500}}>Ship to: </span>{firstRow["Name"]}, {firstRow["Address 1"]}{firstRow["Address 2"]?", "+firstRow["Address 2"]:""}, {firstRow["City"]}, {firstRow["State"]} {firstRow["Zip"]}
            <span style={{margin:"0 8px"}}>·</span>
            <span style={{color:"var(--color-text-primary)",fontWeight:500}}>Ship date: </span>{result.shipDate}
            <span style={{margin:"0 8px"}}>·</span>
            <span style={{color:"var(--color-text-primary)",fontWeight:500}}>Cancel: </span>{result.cancelDate}
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
            <button style={S.btnOutline} onClick={resetPDF}><i className="ti ti-refresh" aria-hidden="true" style={{fontSize:15}}/>New PO</button>
            <button style={S.btnSuccess} onClick={()=>dlCSV(buildCSV(rows),`NS_${retailer.replace(/\s+/g,"_")}_PO${rows[0]?.["PO Number"]||""}.csv`)}><i className="ti ti-download" aria-hidden="true" style={{fontSize:15}}/>Download CSV</button>
          </div>
        </>)}
      </>)}

      {/* ITEM MASTER TAB */}
      {mainTab==="itemmaster"&&(<>
        <div style={S.card}>
          <span style={S.sectionLabel}><i className="ti ti-database" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Stored item master</span>
          {imLoading?(
            <p style={{fontSize:13,color:"var(--color-text-tertiary)",margin:0,textAlign:"center",padding:"1rem 0"}}>Loading…</p>
          ):imMeta?(
            <>
              <div style={S.imStored}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <i className="ti ti-circle-check" aria-hidden="true" style={{fontSize:18,color:"var(--color-text-success)"}}/>
                  <div>
                    <p style={{margin:0,fontSize:13,fontWeight:500,color:"var(--color-text-success)"}}>{imMeta.name}</p>
                    <p style={{margin:0,fontSize:12,color:"var(--color-text-success)",opacity:0.85}}>{imMeta.count.toLocaleString()} items · last updated {imMeta.savedAt}{imMeta.updatedBy?" by "+imMeta.updatedBy:""}</p>
                  </div>
                </div>
                <button style={S.btnReplace} onClick={clearIM}>Clear</button>
              </div>

              {imDebug&&(
                <div style={{marginTop:12,padding:"10px 12px",background:"var(--color-background-secondary)",borderRadius:8,fontSize:12}}>
                  <p style={{margin:"0 0 4px",fontWeight:500,color:"var(--color-text-secondary)"}}>Detected column mapping (first row sample):</p>
                  <p style={{margin:"2px 0",color:"var(--color-text-primary)"}}><strong>SKU:</strong> {imDebug.firstSKU}</p>
                  <p style={{margin:"2px 0",color:"var(--color-text-primary)"}}><strong>Parent SKU:</strong> {imDebug.firstParent}</p>
                  <p style={{margin:"2px 0",color:"var(--color-text-primary)"}}><strong>UPC Code:</strong> {imDebug.firstUPC}</p>
                  <p style={{margin:"6px 0 2px",color:"var(--color-text-tertiary)"}}>First 15 detected columns: {imDebug.allKeys.join(", ")}</p>
                </div>
              )}
            </>
          ):(
            <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>No item master loaded yet. Upload one below.</p>
          )}
        </div>

        <div style={S.card}>
          <span style={S.sectionLabel}><i className="ti ti-upload" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Upload {imMeta?"replacement ":""}item master</span>
          <div
            style={{...S.dzBase,...(imDrag?S.dzHover:{})}}
            onClick={()=>imRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setImDrag(true);}}
            onDragLeave={()=>setImDrag(false)}
            onDrop={e=>{e.preventDefault();setImDrag(false);loadIM(e.dataTransfer.files[0]);}}>
            <i className="ti ti-table" aria-hidden="true" style={{fontSize:28,color:"var(--color-text-tertiary)",display:"block",marginBottom:6}}/>
            <p style={{fontSize:14,color:"var(--color-text-secondary)",margin:0}}>Click or drag to upload item master</p>
            <p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:"4px 0 0"}}>Tab-delimited .txt or .tsv exported from Excel</p>
          </div>
          <input ref={imRef} type="file" accept=".txt,.tsv,.csv" style={{display:"none"}} onChange={e=>loadIM(e.target.files[0])}/>
        </div>

        <div style={{padding:"10px 14px",background:"var(--color-background-secondary)",borderRadius:8,fontSize:12,color:"var(--color-text-secondary)"}}>
          <i className="ti ti-info-circle" aria-hidden="true" style={{fontSize:14,marginRight:6,verticalAlign:"-1px"}}/>
          The item master is saved to <strong>shared storage</strong> — anyone on your team who opens this artifact will automatically have access to it. Upload it once and the whole team is set.
        </div>
      </>)}
    </div>
  );
}
