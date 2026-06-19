import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const RETAILERS = {
  "BJ's Wholesale Club": { nsCustomer: "BJs Wholesale Corporate : BJs Wholesale", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
  "Cost Plus World Market": { nsCustomer: "Cost Plus World Market", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", dev: true },
  "Gilt": { nsCustomer: "Gilt", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", dev: true },
  "Global New Beginnings": { nsCustomer: "Global New Beginnings Inc.", shipMethod: "Collect", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", type: "gnb" },
  "Hy-Vee": { nsCustomer: "Hy-Vee", shipMethod: "ROUTEPPD", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", orderUnit: "cases" },
  "Imperial Distributors Inc.": { nsCustomer: "Imperial Distributors Inc.", shipMethod: "ROUTEPPD", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", defaultMemo: "Frgt Terms :$1000 Prepaid", hideCols: ["Freight Account #","SCAC"] },
  "Jungle Jims Market Inc": { nsCustomer: "Jungle Jims Market Inc", shipMethod: "UPS Ground", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", defaultMemo: "Packing slip or invoice must be on the outside of the package, with the department specified. Jungle Jim's does not accept shipments from UPS freight. UPS Ground is Fine.", hideCols: ["Customer Part Number","Freight Account #","SCAC"], showCols: {"Items": ["Department"]} },
  "Mark-It Smart Inc.": { nsCustomer: "Mark-It Smart Inc.", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", dev: true },
  "Samples": { nsCustomer: "Samples", shipMethod: "DPP", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "Yes", dev: true },
  "Sur La Table": { nsCustomer: "Sur La Table", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", dev: true },
  "TJ Maxx Canada": { nsCustomer: "TJ Maxx Canada", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", dev: true },
  "Verdi Commerce LLC": { nsCustomer: "Verdi Commerce LLC", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", dev: true },
  "Walmart Marketplace": { nsCustomer: "Walmart Corporate : Walmart Marketplace", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No", dev: true },
};
const SHIP_METHODS = ["Collect","DPP","FedEx 2Day","FedEx Ground","FedEx Home Delivery","FedEx International Econ","FedEx SmartPost","Fedex Standard Overnight","Route","ROUTEPPD","UPS 2-Day","UPS 3-Day","UPS Express Saver","UPS Ground","UPS Overnight","UPS Surepost","USPS","USPS Ground Advantage"];
const STATUSES = ["Pending Fulfillment","Pending Approval"];
const CSV_HEADERS = ["Order #","NS SKU","Date","Quantity","Rate","Amount","Is EDI Sent","Is Sample","PO Number","NS CUSTOMER","Price Level","Status","Ship Date","Cancel Date","Must Arrive By Date","Name","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo"];
const IM_KEY = "item-master-data";
const TABS_PREVIEW = [
  { label: "Header", cols: ["Order #","Date","Is EDI Sent","PO Number","NS CUSTOMER","Price Level","Status","Ship Date","Cancel Date","Must Arrive By Date","Name","Address 1","Address 2","City","State","Zip","Country","Ship Method","Freight Account #","SCAC","Memo"] },
  { label: "Items", cols: ["NS SKU","Customer Part Number","Quantity","Rate","Amount"] },
];

function parseCsvRow(line){const vals=[];let cur="",inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(inQ){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"'){inQ=false;}else{cur+=ch;}}else{if(ch==='"'){inQ=true;}else if(ch===','){vals.push(cur);cur="";}else{cur+=ch;}}}vals.push(cur);return vals;}
function parseImCsv(text){const lines=text.replace(/\r/g,"").trim().split("\n");if(!lines.length)return[];const hdrs=parseCsvRow(lines[0]).map(h=>h.trim());return lines.slice(1).filter(l=>l.trim()).map(line=>{const vals=parseCsvRow(line);const obj={};hdrs.forEach((h,i)=>{obj[h]=(vals[i]||"").trim();});return obj;});}
function esc(v){if(v===null||v===undefined)return "";const s=String(v);return(s.includes(",")||s.includes('"')||s.includes("\n"))?'"'+s.replace(/"/g,'""')+'"':s;}
function buildCSV(rows){return[CSV_HEADERS.join(","),...rows.map(r=>CSV_HEADERS.map(h=>esc(r[h])).join(","))].join("\n");}
const GNB_CSV_HEADERS=["Order #","NS SKU","Customer Part Number","Date","Quantity","Rate","Amount","Is EDI Sent","PO Number","NS CUSTOMER","Price Level","Status","Ship Date","Cancel Date","Must Arrive By Date","Name","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Freight Account #","SCAC","Memo"];
function buildGnbCSV(rows){return[GNB_CSV_HEADERS.join(","),...rows.map(r=>GNB_CSV_HEADERS.map(h=>esc(r[h])).join(","))].join("\n");}
const IMPERIAL_CSV_HEADERS=["Order #","NS SKU","Customer Part Number","Date","Quantity","Rate","Amount","Is EDI Sent","PO Number","NS CUSTOMER","Price Level","Status","Ship Date","Cancel Date","Must Arrive By Date","Name","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo"];
function buildImperialCSV(rows){return[IMPERIAL_CSV_HEADERS.join(","),...rows.map(r=>IMPERIAL_CSV_HEADERS.map(h=>esc(r[h])).join(","))].join("\n");}
const JJ_CSV_HEADERS=["Order #","NS SKU","Date","Quantity","Rate","Amount","Is EDI Sent","PO Number","NS CUSTOMER","Department","Price Level","Status","Ship Date","Cancel Date","Must Arrive By Date","Name","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo"];
function buildJjCSV(rows){return[JJ_CSV_HEADERS.join(","),...rows.map(r=>JJ_CSV_HEADERS.map(h=>esc(r[h])).join(","))].join("\n");}
function fmtDate(d){if(!d)return d;const p=String(d).split("/");if(p.length===3&&p[2].length===2){const y=parseInt(p[2],10);p[2]=y<=49?`20${p[2].padStart(2,"0")}`:`19${p[2].padStart(2,"0")}`;}return p.join("/");}
function dlCSV(content,name){const b=new Blob(["﻿"+content],{type:"text/csv;charset=utf-8;"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
function isoToMDY(iso){if(!iso)return "";const[y,m,d]=iso.split("-");return `${parseInt(m)}/${parseInt(d)}/${y}`;}
function localISODate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function addDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+n);return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}
function subBizDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);let rem=n;while(rem>0){dt.setDate(dt.getDate()-1);const dow=dt.getDay();if(dow!==0&&dow!==6)rem--;}return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}
function addBizDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);let rem=n;while(rem>0){dt.setDate(dt.getDate()+1);const dow=dt.getDay();if(dow!==0&&dow!==6)rem--;}return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}

const PROMPT=`Extract data from this purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","deliveryDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY or empty","cancelDate":"MM/DD/YYYY or empty","mustArriveByDate":"MM/DD/YYYY or empty","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":"","lineItems":[{"upc":"","vendorItemNum":"","quantity":0,"unitPrice":0,"description":""}]}\n\nRules: mustArriveByDate=deliveryDate if only one date. shipDate/cancelDate=empty if not stated. memo=any delivery appointment or scheduling note on the PO (e.g. "Vendor to call Shipping Location for appointment"); leave empty if none. Extract ALL lines. ONLY JSON.`;

const HY_VEE_PROMPT=`Extract data from this Hy-Vee purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","mustArriveByDate":"MM/DD/YYYY","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":"","lineItems":[{"mfgNum":"","prodNum":"","cases":0,"masterPack":0,"netCostPerCase":0,"description":""}]}\n\nRules: Each line item spans two rows. Row 1: 6-digit MFG# (in VENDOR column), Master Pack/Size, Order Code. Row 2: ORDER QTY (cases ordered), ORDER UNIT (CASES), 5-digit PROD#, description, then cost columns. mfgNum=6-digit MFG# from row 1. prodNum=5-digit PROD# from row 2. cases=ORDER QTY integer. masterPack=the integer before the backslash in the MASTER PACK/SIZE field (e.g. "6\\1EA-12X5" → 6). netCostPerCase=NET COST column value (third cost column). mustArriveByDate=SCHEDULE SHIPMENT TO ARRIVE ON date. memo=always empty string (ignore SPECIAL ALLOWANCES/MESSAGES). Extract ALL line items. ONLY JSON.`;

const IMPERIAL_PROMPT=`Extract data from this Imperial Distributors purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","mustArriveByDate":"MM/DD/YYYY","shipToName":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"US","lineItems":[{"itemNum":"","vendorSku":"","gtin":"","csePck":0,"quantity":0,"unitPrice":0}]}\n\nRules: poNumber=PO No. value. orderDate=Order Date in MM/DD/YYYY (e.g. 6/02/26 → 6/02/2026). mustArriveByDate=Expected Arrival Date in MM/DD/YYYY. shipToName=ship-to company name. shipToAddress1=street address. shipToAddress2=warehouse/location name if present (e.g. Worcester Warehouse); empty string if none. lineItems: extract ALL lines from item table; ignore the *** Note *** page. itemNum=Item_# column (numeric customer part number, e.g. 118667). vendorSku=SKU after the "/" in the Mfr.No field (e.g. DST200GBAQ04); empty string if missing or cut off. gtin=dashed barcode in the Mfr.No field (e.g. 008-10051-85598-2). csePck=Pck column value (items per case, e.g. 4). quantity=Piece Qty column (total pieces not cases). unitPrice=Base Cost W/ OI column (per-piece price). ONLY JSON.`;

const JJ_PROMPT=`Extract data from this Jungle Jim's purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","shipToName":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","deliveryInstructions":"","lineItems":[{"upc":"11 digits","department":"","quantity":0,"unitPrice":0,"description":""}]}\n\nRules: poNumber=Purchase Order number. orderDate=Order Date in MM/DD/YYYY. shipToName=ship-to company name (e.g. JUNGLE JIMS EASTGATE). deliveryInstructions=text after "Delivery Instructions:" label on the PO; empty string if none. lineItems: extract ALL lines. upc=first 11 digits of the UPC column only. department=Dpt column value (e.g. 63). quantity=Unit/Lbs column (total units, NOT cases). unitPrice=Cost/Un column. ONLY JSON.`;

const SAMPLES_PROMPT=`Parse this sample request message from an employee. It may contain one or more separate orders (each going to a distinct shipping address). Return ONLY valid JSON, no markdown, no explanation.\n\n{"orders":[{"lineItems":[{"sku":"exact SKU string as written","quantity":0}],"shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":""}]}\n\nRules:\n- Each distinct shipping address = one order object.\n- sku = the product code exactly as written (e.g. DMW10008, DCAF26CMGBCM02). Strip product descriptions; keep only the code.\n- quantity = integer. "1x of each" or "1x" before a list = 1 for every item. Parse the number before "x" as the quantity.\n- shipToAttention = name from "Attn:", "ATTN:", or similar label; empty string if none.\n- shipToAddress2 = suite, floor, door, unit, building — any secondary address line; empty string if none.\n- shipToCountry = 2-letter ISO: "US" for USA, "CA" for Canada.\n- memo = any extra delivery notes (door numbers, division, line review, room numbers, deal numbers, etc.) not captured in other fields; empty string if none.\n- ONLY JSON.`;

const GNB_PROMPT=`This is a Global New Beginnings (GNBI) document. Identify its type and extract accordingly. Return ONLY valid JSON, no markdown, no explanation.\n\nIf this is a PURCHASE ORDER (has "PURCHASE ORDER" heading, a PO # field, and SKU line items with unit cost):\n{"docType":"po","poNumber":"number only e.g. 3320","orderDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","sku":"exact SKU string e.g. RSMS150GBRR24","unitCost":0.0000}\n\nIf this is a DISTRIBUTION SHEET (table of fulfillment center rows with a Quill P.O. # column and ship-to addresses):\n{"docType":"distro","gnbiPoNumber":"","itemNum":"Item # value e.g. RSMS150GBRR24","quillSkuNum":"Quill SKU # value e.g. 3171196","primaryShipDate":"MM/DD/YYYY","locations":[{"quillPoNum":"e.g. XSYI66-1","name":"full center name e.g. Quill Fulfillment Center #472","address1":"street address line 1","address2":"street address line 2 if present else empty","city":"","state":"2-letter","zip":"","country":"US","quantity":0,"shipMethod":"exact carrier name as shown on the sheet e.g. Fed Ex Ground, UPS Ground, T-Force, Roadrunner","scac":"SCAC code(s) exactly as shown e.g. RDFS or UPGF/TFIN; empty string if not shown","shipDate":"MM/DD/YYYY"}]}\n\nDistro rules: exclude rows where quantity=0. shipMethod=the exact carrier name from the sheet — do NOT normalize or replace unknown carriers with Fed Ex Ground or UPS Ground. scac=the raw SCAC string as printed (may contain slashes for multiple codes); empty string if absent. shipDate=the "Latest Acceptable Ship Date" for that row; if blank use primaryShipDate. ONLY JSON.`;

const S = {
  card:{background:"var(--color-background-primary)",border:"1px solid var(--color-border-secondary)",borderRadius:12,padding:"1.4rem 1.5rem",marginBottom:"1.1rem"},
  sectionLabel:{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)",display:"block",marginBottom:12},
  fieldLabel:{fontSize:14,fontWeight:500,color:"var(--color-text-primary)",display:"block",marginBottom:6},
  select:{width:"100%",boxSizing:"border-box",padding:"10px 12px",fontSize:14,fontFamily:"var(--font-sans)",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",cursor:"pointer"},
  input:{width:"100%",boxSizing:"border-box",padding:"10px 12px",fontSize:14,fontFamily:"var(--font-sans)",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)"},
  dzBase:{border:"2px dashed var(--color-border-secondary)",borderRadius:10,padding:"2.5rem 1.5rem",textAlign:"center",cursor:"pointer",background:"var(--color-background-secondary)",transition:"border-color 0.15s,background 0.15s"},
  dzHover:{border:"2px dashed var(--color-border-info)",background:"var(--color-background-info)"},
  btnPrimary:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"13px 20px",fontSize:15,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"#363737",color:"#fff",cursor:"pointer"},
  btnPrimaryDis:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"13px 20px",fontSize:15,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"#363737",color:"#fff",cursor:"not-allowed",opacity:0.4},
  btnOutline:{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"1px solid var(--color-border-secondary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)",cursor:"pointer"},
  btnSuccess:{display:"flex",alignItems:"center",gap:6,padding:"10px 22px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"#166534",color:"#fff",cursor:"pointer"},
  btnReplace:{fontSize:13,color:"var(--color-text-secondary)",background:"var(--color-background-primary)",border:"1px solid var(--color-border-secondary)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"var(--font-sans)"},
  mainTabBtn:(active)=>({padding:"10px 18px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderBottom:active?"2px solid var(--color-text-primary)":"2px solid transparent",background:"transparent",color:active?"var(--color-text-primary)":"var(--color-text-secondary)",cursor:"pointer"}),
  previewTabBtn:(active)=>({padding:"6px 14px",fontSize:13,fontFamily:"var(--font-sans)",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:active?"#363737":"var(--color-background-secondary)",color:active?"#fff":"var(--color-text-secondary)",cursor:"pointer"}),
  stat:{background:"var(--color-background-secondary)",borderRadius:8,padding:"0.55rem 0.85rem",border:"1px solid var(--color-border-secondary)"},
  statLabel:{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--color-text-tertiary)",marginBottom:2},
  statVal:{fontSize:16,fontWeight:600,color:"var(--color-text-primary)"},
  msgErr:{fontSize:14,color:"var(--color-text-danger)",background:"var(--color-background-danger)",borderRadius:8,padding:"11px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:9},
  msgWarn:{fontSize:14,color:"var(--color-text-warning)",background:"var(--color-background-warning)",borderRadius:8,padding:"11px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:9},
  msgOk:{fontSize:14,color:"var(--color-text-success)",background:"var(--color-background-success)",borderRadius:8,padding:"11px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:9},
  th:{textAlign:"left",padding:"9px 12px",borderBottom:"1px solid var(--color-border-tertiary)",fontWeight:600,fontSize:13,color:"#111827",whiteSpace:"nowrap"},
  td:{padding:"9px 12px",fontSize:13,color:"var(--color-text-primary)",whiteSpace:"nowrap"},
};

export default function App() {
  const [retailer, setRetailer] = useState("");
  const [shipMethod, setShipMethod] = useState("Route");
  const [orderStatus, setOrderStatus] = useState("Pending Fulfillment");
  const [memo, setMemo] = useState("");
  const [samplesSubcustomer, setSamplesSubcustomer] = useState("");
  const [samplesText, setSamplesText] = useState("");
  const [gnbDate, setGnbDate] = useState(localISODate);
  const [gnbUpsAccount, setGnbUpsAccount] = useState("8V4012");
  const [gnbFedexAccount, setGnbFedexAccount] = useState("704499884");
  const [im, setIm] = useState(null);
  const [imSource, setImSource] = useState(null);
  // pdfs: { id, name, base64, status: 'loading'|'queued'|'processing'|'done'|'error', rows, unmatched, error }
  const [pdfs, setPdfs] = useState([]);
  const [pdfDrag, setPdfDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [previewTab, setPreviewTab] = useState("Header");
  const [err, setErr] = useState("");
  const [settingsTab, setSettingsTab] = useState("main");
  const [approval, setApproval] = useState(null);
  const [approvalOrderIdx, setApprovalOrderIdx] = useState(0);
  const pdfRef = useRef();
  const imRef = useRef();

  useEffect(()=>{
    (async()=>{
      try{
        const nsRes=await fetch('/api/netsuite/itemmaster');
        if(nsRes.ok){
          const data=await nsRes.json();
          if(!data.error&&data.items?.length){
            setIm(data.items);
            setImSource(`NetSuite · ${data.items.length} items`);
            localStorage.setItem(IM_KEY,JSON.stringify({items:data.items,savedAt:new Date().toLocaleDateString()}));
            return;
          }
        }
      }catch(_){}
      try{
        const s=localStorage.getItem(IM_KEY);
        if(s){const p=JSON.parse(s);if(p.items?.length){setIm(p.items);setImSource(`CSV · ${p.items.length} items · cached ${p.savedAt||""}`);}}
      }catch(_){}
    })();
  },[]);

  const loadIMCSV=useCallback((file)=>{
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      const parsed=parseImCsv(e.target.result);
      const items=parsed.map(r=>({'Name':r['Name']||'','External ID':r['External ID']||'','UPC Code':r['UPC Code']||'','Casepack Outer':r['Casepack Outer']||''})).filter(r=>r['Name']);
      if(!items.length){setImSource("Error: no valid items found");return;}
      setIm(items);
      setImSource(`CSV · ${items.length} items · cached ${new Date().toLocaleDateString()}`);
      localStorage.setItem(IM_KEY,JSON.stringify({items,savedAt:new Date().toLocaleDateString()}));
    };
    reader.readAsText(file);
  },[]);

  const lookup = useCallback((items,upc,vin)=>{
    if(!items?.length) return null;
    const normVIN = String(vin||"").trim().toUpperCase();
    const normUPC = String(upc||"").replace(/\D/g,"");
    if(normVIN){
      const m=items.find(it=>String(it["External ID"]||"").trim().toUpperCase()===normVIN);
      if(m) return m;
    }
    if(normUPC){
      const m=items.find(it=>String(it["UPC Code"]||"").replace(/\D/g,"")===normUPC);
      if(m) return m;
    }
    return null;
  },[]);

  const handleRetailer=(r)=>{if(r!==retailer){resetAll();setSamplesSubcustomer("");}setRetailer(r);if(RETAILERS[r]){setShipMethod(RETAILERS[r].shipMethod);setOrderStatus(RETAILERS[r].status);setMemo(RETAILERS[r].defaultMemo||"");}};

  useEffect(() => {
    if (result && rows.length) initApproval(rows, retailer, shipMethod, memo, orderStatus);
  }, [orderStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPDFs = (files) => {
    if (!files?.length) return;
    const fileArr = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!fileArr.length) return;
    const ts = Date.now();
    const newEntries = fileArr.map((file, idx) => ({
      id: `${ts}-${idx}`,
      name: file.name,
      base64: null,
      status: "loading",
      rows: [],
      unmatched: [],
      error: null,
    }));
    setPdfs(prev => [...prev, ...newEntries]);
    fileArr.forEach((file, idx) => {
      const r = new FileReader();
      const id = newEntries[idx].id;
      r.onload = ev => {
        const base64 = ev.target.result.split(",")[1];
        setPdfs(prev => prev.map(p => p.id === id ? { ...p, base64, status: "queued" } : p));
      };
      r.readAsDataURL(file);
    });
  };

  const handleFiles = async (files) => {
    const fileArr = Array.from(files);
    const pdfs = fileArr.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    const zips = fileArr.filter(f => f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip"));
    for (const zip of zips) {
      try {
        const contents = await new JSZip().loadAsync(zip);
        for (const [path, entry] of Object.entries(contents.files)) {
          if (!entry.dir && path.toLowerCase().endsWith(".pdf")) {
            const blob = await entry.async("blob");
            pdfs.push(new File([blob], path.split("/").pop(), { type: "application/pdf" }));
          }
        }
      } catch(e) { console.error("ZIP extract error:", e); }
    }
    if (pdfs.length) addPDFs(pdfs);
  };

  const removePDF = (id) => setPdfs(prev => prev.filter(p => p.id !== id));

  const loadTestPDFs = async () => {
    try {
      const names = await fetch('/api/test-pdfs').then(r => r.json());
      if (!names.length) { alert('No PDFs found in public/test-pdfs/'); return; }
      const files = await Promise.all(names.map(async name => {
        const res = await fetch(`/test-pdfs/${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
        const blob = await res.blob();
        return new File([blob], name, { type: 'application/pdf' });
      }));
      addPDFs(files);
    } catch(e) { console.error('loadTestPDFs:', e); }
  };

  const resetAll = () => {
    const defaultMemo = RETAILERS[retailer]?.defaultMemo || "";
    setPdfs([]); setResult(null); setRows([]); setErr(""); setBusy(false); setBusyMsg(""); setApproval(null); setApprovalOrderIdx(0); setMemo(defaultMemo); setGnbDate(localISODate()); setGnbUpsAccount("8V4012"); setGnbFedexAccount("704499884"); setSamplesSubcustomer(""); setSamplesText("");
    if (pdfRef.current) pdfRef.current.value = "";
  };

  const APPROVAL_COLS = [
    {key:"lineId",label:"Line ID",w:60},
    {key:"date",label:"Date",w:100},
    {key:"orderNum",label:"Order #",w:100},
    {key:"poNumber",label:"PO/Check #",w:110},
    {key:"status",label:"Status",w:130},
    {key:"name",label:"Customer",w:220},
    {key:"externalId",label:"External ID",w:100},
    {key:"description",label:"Description",w:190},
    {key:"quantity",label:"Qty",w:70},
    {key:"rate",label:"Rate",w:80},
    {key:"amount",label:"Amount",w:90},
    {key:"shipDate",label:"Ship Date",w:100},
    {key:"cancelDate",label:"Cancel Date",w:100},
    {key:"mabd",label:"MABD",w:100},
    {key:"shipAddressee",label:"Ship To",w:190},
    {key:"shipAddr1",label:"Address 1",w:160},
    {key:"shipAddr2",label:"Address 2",w:120},
    {key:"shipCity",label:"City",w:110},
    {key:"shipState",label:"State",w:60},
    {key:"shipZip",label:"Zip",w:90},
  ];

  const GNB_APPROVAL_COLS = [
    {key:"lineId",label:"Line ID",w:55},
    {key:"date",label:"Date",w:95},
    {key:"orderNum",label:"Quill PO #",w:110},
    {key:"status",label:"Status",w:130},
    {key:"nsSku",label:"NS SKU",w:190},
    {key:"quantity",label:"Qty",w:65},
    {key:"rate",label:"Rate",w:75},
    {key:"amount",label:"Amount",w:85},
    {key:"shipDate",label:"Ship Date",w:95},
    {key:"cancelDate",label:"Cancel Date",w:95},
    {key:"mabd",label:"MABD",w:95},
    {key:"shipAddressee",label:"Ship To",w:200},
    {key:"shipAddr1",label:"Address 1",w:160},
    {key:"shipCity",label:"City",w:110},
    {key:"shipState",label:"State",w:55},
    {key:"shipZip",label:"Zip",w:80},
    {key:"shipMethod",label:"Ship Method",w:110},
    {key:"freightAccount",label:"Freight Acct #",w:110},
    {key:"scac",label:"SCAC",w:65},
  ];

  const initApproval = useCallback((allRows, curRetailer, curShipMethod, curMemo, curOrderStatus) => {
    const hasMismatchRows = allRows.some(r => r._poHasMismatch);
    const isGnb = RETAILERS[curRetailer]?.type === "gnb";
    if ((curOrderStatus !== "Pending Approval" && !hasMismatchRows) || !allRows.length) { setApproval(null); return; }
    const rc = RETAILERS[curRetailer];
    // GNB: group all rows under the blanket PO #; others: group by Quill/individual PO #
    const orderMap = new Map();
    allRows.forEach(r => {
      const po = isGnb ? (r["_gnbPoNumber"] || "GNB Order") : (r["PO Number"] || r["Order #"] || "Unknown");
      if (!orderMap.has(po)) orderMap.set(po, []);
      orderMap.get(po).push(r);
    });
    const orders = Array.from(orderMap.entries()).map(([poNumber, poRows]) => ({
      poNumber,
      lines: poRows.map((r, idx) => ({
        internalId: "TBD",
        lineId: idx + 1,
        date: r["Date"] || "",
        orderNum: r["Order #"] || "",
        poNumber: r["PO Number"] || "",
        status: r._poHasMismatch ? "Pending Approval" : curOrderStatus,
        name: r["NS CUSTOMER"] || rc?.nsCustomer || "",
        externalId: r["External ID"] || "",
        description: r["Description"] || "",
        nsSku: r["NS SKU"] || "",
        quantity: r["Quantity"] ?? 0,
        rate: r["Rate"] ?? 0,
        amount: r["Amount"] ?? 0,
        shipDate: r["Ship Date"] || "",
        cancelDate: r["Cancel Date"] || "",
        mabd: r["Must Arrive By Date"] || "",
        lineStatus: "Pending Fulfillment",
        shipAddressee: r["Name"] || "",
        shipAddr1: r["Address 1"] || "",
        shipAddr2: r["Address 2"] || "",
        shipCity: r["City"] || "",
        shipState: r["State"] || "",
        shipZip: r["Zip"] || "",
        shipMethod: r["Ship Method"] || "",
        freightAccount: r["Freight Account #"] || "",
        scac: r["SCAC"] || "",
        caseMismatch: !!r["_caseMismatch"],
      })),
    }));
    setApproval({ orders });
    setApprovalOrderIdx(0);
  }, []);

  const updateApprovalLine = (orderIdx, lineIdx, field, val) => {
    setApproval(prev => {
      const orders = prev.orders.map((o, oi) => {
        if (oi !== orderIdx) return o;
        const lines = o.lines.map((l, li) => {
          if (li !== lineIdx) return l;
          const updated = { ...l, [field]: val };
          if (field === "quantity" || field === "rate") {
            const q = parseFloat(field === "quantity" ? val : l.quantity) || 0;
            const r = parseFloat(field === "rate" ? val : l.rate) || 0;
            updated.amount = parseFloat((q * r).toFixed(2));
          }
          return updated;
        });
        return { ...o, lines };
      });
      return { ...prev, orders };
    });
  };

  const exportApprovalXLSX = () => {
    if (!approval) return;
    const poNums = approval.orders.map(o => o.poNumber).join("_");
    const allLines = approval.orders.flatMap(o => o.lines);
    if (RETAILERS[retailer]?.type === "gnb") {
      const headers = ["Date","Quill PO #","Status","NS SKU","Quantity","Rate","Amount","Ship Date","Cancel Date","Must Arrive By Date","Ship To","Address 1","City","State","Zip","Ship Method","Freight Account #","SCAC"];
      const data = [headers, ...allLines.map(l => [
        l.date, l.orderNum, l.status, l.nsSku,
        parseFloat(l.quantity)||0, parseFloat(l.rate)||0, parseFloat(l.amount)||0,
        l.shipDate, l.cancelDate, l.mabd,
        l.shipAddressee, l.shipAddr1, l.shipCity, l.shipState, l.shipZip,
        l.shipMethod, l.freightAccount, l.scac
      ])];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [12,14,16,22,10,10,12,12,12,16,28,26,14,8,10,14,14,8].map(wch=>({wch}));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "GNB Order Review");
      XLSX.writeFile(wb, `GNB_PO${poNums}_Review.xlsx`);
      return;
    }
    const headers = ["Date","Order #","PO/Check Number","Status","Name","External ID","Description","Quantity","Item Rate","Amount","Ship Date","Cancel Date","Must Arrive By Date","Status","Shipping Addressee","Shipping Address 1","Shipping Address 2","Shipping City","Shipping State/Province","Shipping Zip"];
    const data = [
      headers,
      ...allLines.map(l => [
        l.date, l.orderNum, l.poNumber,
        l.status, l.name, l.externalId, l.description,
        parseFloat(l.quantity)||0, parseFloat(l.rate)||0, parseFloat(l.amount)||0,
        l.shipDate, l.cancelDate, l.mabd, l.lineStatus,
        l.shipAddressee, l.shipAddr1, l.shipAddr2, l.shipCity, l.shipState, l.shipZip
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [12,12,16,16,35,16,28,10,10,12,12,12,16,16,28,28,15,15,10,12].map(wch=>({wch}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Approval");
    XLSX.writeFile(wb, `${poNums.replace(/[^a-zA-Z0-9_]/g,"_")}_Approval.xlsx`);
  };

  const process = async () => {
    setErr(""); setBusy(true);

    if (retailer === "Samples") {
      if (!samplesText.trim()) { setErr("Paste a sample request first."); setBusy(false); return; }
      if (!samplesSubcustomer) { setErr("Select a subcustomer first."); setBusy(false); return; }
      setBusyMsg("Parsing sample request…");
      try {
        const resp = await fetch("/api/anthropic/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6", max_tokens: 4096, system: SAMPLES_PROMPT,
            messages: [{ role: "user", content: samplesText.trim() }]
          })
        });
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error(data.error?.message || `API error ${resp.status}`);
        const raw = data.content?.find(b => b.type === "text")?.text || "";
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        const orders = parsed.orders || [];
        const rc = RETAILERS[retailer];
        const samplesRows = [];
        const allUnmatched = [];
        orders.forEach(order => {
          (order.lineItems || []).forEach(line => {
            const m = im?.length ? lookup(im, null, line.sku) : null;
            const nsSku = m ? String(m["Name"] || "").trim() : line.sku || "";
            const externalId = m ? String(m["External ID"] || "").trim() : line.sku || "";
            if (!m && line.sku) allUnmatched.push(line.sku);
            samplesRows.push({
              "Order #": "", "NS SKU": nsSku,
              "Date": isoToMDY(localISODate()),
              "Quantity": Number(line.quantity) || 1, "Rate": 0, "Amount": 0,
              "Is EDI Sent": rc.isEdiSent, "Is Sample": rc.isSample,
              "PO Number": "",
              "NS CUSTOMER": `Samples : Samples - ${samplesSubcustomer}`,
              "Price Level": rc.priceLevel, "Status": orderStatus,
              "Ship Date": "", "Cancel Date": "", "Must Arrive By Date": "",
              "Name": order.shipToName || "", "Attention": order.shipToAttention || "",
              "Address 1": order.shipToAddress1 || "", "Address 2": order.shipToAddress2 || "",
              "City": order.shipToCity || "", "State": order.shipToState || "",
              "Zip": order.shipToZip || "", "Country": order.shipToCountry || "US",
              "Ship Method": shipMethod, "Memo": order.memo || memo || "",
              "External ID": externalId,
            });
          });
        });
        setRows(samplesRows);
        setResult({ totalPOs: orders.length, failedPOs: 0, allUnmatched, allCaseMismatches: [] });
        initApproval(samplesRows, retailer, shipMethod, memo, orderStatus);
      } catch(e) {
        setErr(`Failed to parse request: ${e.message}`);
      }
      setBusy(false);
      return;
    }

    const queued = pdfs.filter(p => p.status === "queued" && p.base64);
    if (!queued.length) { setErr("No PDFs ready to process."); setBusy(false); return; }

    // Track changes locally to avoid stale-closure issues across async iterations
    let currentPdfs = [...pdfs];

    if (RETAILERS[retailer]?.type === "gnb") {
      const rc = RETAILERS[retailer];
      const gnbExtracted = [];

      // Extract all uploaded PDFs
      for (let i = 0; i < queued.length; i++) {
        const pdfItem = queued[i];
        setBusyMsg(`Processing ${i+1} of ${queued.length}: ${pdfItem.name}`);
        currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "processing" } : p);
        setPdfs([...currentPdfs]);
        try {
          const resp = await fetch("/api/anthropic/v1/messages", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4096, system: GNB_PROMPT,
              messages: [{ role: "user", content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfItem.base64 } },
                { type: "text", text: "Extract the document data." }
              ]}]
            })
          });
          const data = await resp.json();
          if (!resp.ok || data.error) throw new Error(data.error?.message || `API error ${resp.status}`);
          const raw = data.content?.find(b => b.type === "text")?.text || "";
          const extracted = JSON.parse(raw.replace(/```json|```/g,"").trim());
          gnbExtracted.push({ id: pdfItem.id, data: extracted });
          currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "done", rows: [], unmatched: [] } : p);
        } catch(e) {
          currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "error", error: e.message } : p);
        }
        setPdfs([...currentPdfs]);
      }

      const poItems = gnbExtracted.filter(r => r.data?.docType === "po");
      const distroItems = gnbExtracted.filter(r => r.data?.docType === "distro");

      if (!poItems.length || !distroItems.length) {
        setErr(!poItems.length ? "No blanket PO recognized — ensure PO PDFs are included." : "No distro sheet recognized — ensure distro sheet PDFs are included.");
        setBusy(false); return;
      }

      // Match each PO to a distro by GNB PO number; fall back to any unmatched distro
      const usedDistroIds = new Set();
      const pairs = poItems.map(po => {
        const poNum = String(po.data?.poNumber || "").trim();
        let match = distroItems.find(d => !usedDistroIds.has(d.id) && String(d.data?.gnbiPoNumber || "").trim() === poNum);
        if (!match) match = distroItems.find(d => !usedDistroIds.has(d.id));
        if (match) usedDistroIds.add(match.id);
        return { poData: po.data, distroData: match?.data || null, distroId: match?.id || null };
      });

      const unpaired = pairs.filter(p => !p.distroData).map(p => p.poData?.poNumber || "unknown");
      if (unpaired.length) {
        setErr(`Could not match a distro sheet for PO${unpaired.length > 1 ? "s" : ""}: ${unpaired.join(", ")}. Ensure each PO has a matching distro sheet.`);
        setBusy(false); return;
      }

      const GNB_SHIP_MAP = {
        "Fed Ex Ground": { method: "Collect", account: gnbFedexAccount, scac: "FDEG" },
        "FedEx Ground":  { method: "Collect", account: gnbFedexAccount, scac: "FDEG" },
        "UPS Ground":    { method: "Collect", account: gnbUpsAccount,   scac: "UPSN" },
      };
      const todayDate = isoToMDY(gnbDate) || new Date().toLocaleDateString("en-US");

      let allGnbRows = [];
      const gnbUnmatched = [];

      for (const { poData, distroData, distroId } of pairs) {
        const itemMatch = im?.length ? lookup(im, null, poData.sku) : null;
        const nsSku = itemMatch ? String(itemMatch["Name"] || "").trim() : poData.sku || "";
        const externalId = itemMatch ? String(itemMatch["External ID"] || "").trim() : poData.sku || "";
        if (!itemMatch && poData.sku) gnbUnmatched.push(poData.sku);

        const pairRows = (distroData.locations || []).filter(loc => (Number(loc.quantity)||0) > 0).map(loc => {
          const sm = GNB_SHIP_MAP[loc.shipMethod];
          const shipDate = fmtDate(loc.shipDate || distroData.primaryShipDate || "");
          const mabd = shipDate ? addDays(shipDate, 7) : "";
          const qty = Number(loc.quantity) || 0;
          const rate = Number(poData.unitCost) || 0;
          let resolvedMethod, resolvedAccount, resolvedScac, ltlNote = "";
          if (sm) {
            resolvedMethod = sm.method; resolvedAccount = sm.account; resolvedScac = sm.scac;
            const parcelLabel = (loc.shipMethod === "Fed Ex Ground" || loc.shipMethod === "FedEx Ground") ? "Fedex Ground" : "UPS Ground";
            ltlNote = ` | Ship small parcel with ${parcelLabel}`;
          } else {
            resolvedMethod = "Collect"; resolvedAccount = "";
            const rawScac = String(loc.scac || "").trim();
            resolvedScac = rawScac && !rawScac.includes("/") ? rawScac : "";
            if (loc.shipMethod) ltlNote = ` | Ship LTL with ${loc.shipMethod}${rawScac ? ` - ${rawScac}` : ""}`;
          }
          return {
            "Order #": loc.quillPoNum || "", "NS SKU": nsSku, "Customer Part Number": distroData.quillSkuNum || "",
            "Date": todayDate, "Quantity": qty, "Rate": rate, "Amount": parseFloat((qty * rate).toFixed(2)),
            "Is EDI Sent": rc.isEdiSent, "PO Number": loc.quillPoNum || "", "NS CUSTOMER": rc.nsCustomer,
            "Price Level": rc.priceLevel, "Status": orderStatus,
            "Ship Date": shipDate, "Cancel Date": shipDate, "Must Arrive By Date": mabd,
            "Name": loc.name || "", "Attention": "", "Address 1": loc.address1 || "", "Address 2": loc.address2 || "",
            "City": loc.city || "", "State": loc.state || "", "Zip": loc.zip || "", "Country": loc.country || "US",
            "Ship Method": resolvedMethod, "Freight Account #": resolvedAccount, "SCAC": resolvedScac,
            "Memo": `Shipping instructions for Quill order: SHIP FREIGHT COLLECT (PO ${poData.poNumber})${ltlNote}`,
            "External ID": externalId, "_gnbPoNumber": String(poData.poNumber || ""), "_gnbCarrier": String(loc.shipMethod || ""),
          };
        });

        allGnbRows = allGnbRows.concat(pairRows);
        if (distroId) currentPdfs = currentPdfs.map(p => p.id === distroId ? { ...p, rows: pairRows, unmatched: itemMatch ? [] : [poData.sku] } : p);
      }

      // SKU mismatch check only applies to single-pair uploads
      const skuMismatch = pairs.length === 1 ? (() => {
        const { poData, distroData } = pairs[0];
        const poSku = String(poData?.sku || "").trim().toUpperCase();
        const distroItem = String(distroData?.itemNum || "").trim().toUpperCase();
        return poSku && distroItem && poSku !== distroItem ? { poSku: poData.sku, distroItemNum: distroData.itemNum } : null;
      })() : null;

      setPdfs([...currentPdfs]);
      setRows(allGnbRows);
      setResult({ totalPOs: pairs.length, failedPOs: currentPdfs.filter(p => p.status === "error").length, allUnmatched: gnbUnmatched, allCaseMismatches: [], skuMismatch });
      initApproval(allGnbRows, retailer, shipMethod, memo, orderStatus);
      setBusy(false); return;
    }

    for (let i = 0; i < queued.length; i++) {
      const pdfItem = queued[i];
      setBusyMsg(`Processing ${i + 1} of ${queued.length}: ${pdfItem.name}`);
      currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "processing" } : p);
      setPdfs([...currentPdfs]);

      try {
        const rc = RETAILERS[retailer];
        const isHyVee = rc.orderUnit === "cases";
        const isJungleJims = retailer === "Jungle Jims Market Inc";
        const isImperial = retailer === "Imperial Distributors Inc.";
        const resp = await fetch("/api/anthropic/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: isHyVee ? HY_VEE_PROMPT : isJungleJims ? JJ_PROMPT : isImperial ? IMPERIAL_PROMPT : PROMPT,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfItem.base64 } },
                { type: "text", text: "Extract the purchase order data." }
              ]
            }]
          })
        });
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error(data.error?.message || `API error ${resp.status}`);
        const raw = data.content?.find(b => b.type === "text")?.text || "";
        if (!raw) throw new Error("No text in API response. Check your API key.");
        const po = JSON.parse(raw.replace(/```json|```/g, "").trim());
        if (po.memo && !memo && !isHyVee) setMemo(po.memo);

        const mabd = fmtDate(po.mustArriveByDate || po.deliveryDate || "");
        const shipDate = mabd ? subBizDays(mabd, 10) : "";
        const cancelDate = mabd ? subBizDays(mabd, 10) : "";

        let jjShipDate = "", jjCancelDate = "", jjMabd = "", jjMemo = "";
        if (isJungleJims) {
          jjShipDate = po.orderDate ? addDays(fmtDate(po.orderDate), 1) : "";
          jjCancelDate = jjShipDate;
          jjMabd = jjShipDate ? addBizDays(jjShipDate, 5) : "";
          jjMemo = [rc.defaultMemo, po.deliveryInstructions ? `Delivery Instructions: ${po.deliveryInstructions}` : ""].filter(Boolean).join(" ");
        }

        let newRows = [], unmatched = [], caseMismatches = [];

        for (const line of po.lineItems) {
          let nsSku = "", externalId = "", qty = 0, rate = 0, rowCaseMismatch = false, rowDepartment = "", rowCustomerPartNum = "";

          if (isHyVee) {
            const upc11 = String(line.mfgNum || "").substring(0, 6) + String(line.prodNum || "").padStart(5, "0").substring(0, 5);
            const m = im?.length ? im.find(it => String(it["UPC Code"] || "").substring(0, 11) === upc11) : null;
            if (m) {
              nsSku = String(m["Name"] || "").trim();
              externalId = String(m["External ID"] || "").trim();
              const cp = parseInt(m["Casepack Outer"]) || 1;
              const pdfMasterPack = parseInt(line.masterPack) || 0;
              rowCaseMismatch = pdfMasterPack > 0 && pdfMasterPack !== cp;
              if (rowCaseMismatch) {
                caseMismatches.push(`PO ${po.poNumber} - ${externalId}: PDF master pack=${pdfMasterPack}, item master casepack=${cp}`);
              }
              qty = (Number(line.cases) || 0) * cp;
              rate = parseFloat((Number(line.netCostPerCase) / cp).toFixed(4));
            } else {
              const label = upc11 || line.description || "";
              unmatched.push(label);
              nsSku = label;
              qty = Number(line.cases) || 0;
              rate = Number(line.netCostPerCase) || 0;
            }
          } else if (isJungleJims) {
            const upc11 = String(line.upc || "").replace(/\D/g, "").substring(0, 11);
            const m = im?.length ? im.find(it => String(it["UPC Code"] || "").replace(/\D/g, "").substring(0, 11) === upc11) : null;
            if (m) {
              nsSku = String(m["Name"] || "").trim();
              externalId = String(m["External ID"] || "").trim();
            } else {
              const label = upc11 || line.description || "";
              unmatched.push(label);
              nsSku = label;
              externalId = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitPrice) || 0;
            rowDepartment = String(line.department || "");
          } else if (isImperial) {
            const upc12 = String(line.gtin || "").replace(/\D/g, "").slice(-12);
            const m = im?.length ? lookup(im, upc12, line.vendorSku) : null;
            if (m) {
              nsSku = String(m["Name"] || "").trim();
              externalId = String(m["External ID"] || "").trim();
              const cp = parseInt(m["Casepack Outer"]) || 1;
              const pdfCsePck = parseInt(line.csePck) || 0;
              rowCaseMismatch = pdfCsePck > 0 && pdfCsePck !== cp;
              if (rowCaseMismatch) {
                caseMismatches.push(`PO ${po.poNumber} - ${externalId}: PDF casepack=${pdfCsePck}, item master casepack=${cp}`);
              }
            } else {
              const label = line.vendorSku || upc12 || line.description || "";
              unmatched.push(label);
              nsSku = line.vendorSku || "";
              externalId = line.vendorSku || "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitPrice) || 0;
            rowCustomerPartNum = String(line.itemNum || "");
          } else {
            if (im?.length) {
              const m = lookup(im, line.upc, line.vendorItemNum);
              if (m) {
                nsSku = String(m["Name"] || "").trim();
                externalId = String(m["External ID"] || "").trim() || line.vendorItemNum || "";
              } else {
                unmatched.push(line.vendorItemNum || line.upc || line.description);
                nsSku = line.vendorItemNum || "";
                externalId = line.vendorItemNum || "";
              }
            } else {
              nsSku = line.vendorItemNum || "";
              externalId = line.vendorItemNum || "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitPrice) || 0;
          }

          const rowMemo = isHyVee
            ? `PODate ${po.orderDate} RequestedShipDate ${shipDate} CancelDate ${cancelDate} MustArriveBy ${mabd}`
            : isJungleJims ? jjMemo
            : (memo || po.memo || "");
          const shipToName = po.shipToName || (isHyVee ? "HY-VEE, INC." : "");
          newRows.push({
            "Order #": po.poNumber, "NS SKU": nsSku, "Date": fmtDate(po.orderDate),
            "Quantity": qty, "Rate": rate, "Amount": parseFloat((qty * rate).toFixed(2)),
            "Is EDI Sent": rc.isEdiSent, "PO Number": po.poNumber, "NS CUSTOMER": rc.nsCustomer,
            "Price Level": rc.priceLevel, "Status": orderStatus,
            "Ship Date": isJungleJims ? jjShipDate : shipDate,
            "Cancel Date": isJungleJims ? jjCancelDate : cancelDate,
            "Must Arrive By Date": isJungleJims ? jjMabd : mabd,
            "Name": shipToName, "Attention": po.shipToAttention || "",
            "Address 1": po.shipToAddress1, "Address 2": po.shipToAddress2 || "",
            "City": po.shipToCity, "State": po.shipToState, "Zip": po.shipToZip,
            "Country": po.shipToCountry, "Ship Method": shipMethod, "Memo": rowMemo,
            "Customer Part Number": rowCustomerPartNum,
            "Department": rowDepartment,
            "Description": line.description || "",
            "External ID": externalId,
            "_caseMismatch": rowCaseMismatch,
          });
        }

        if (caseMismatches.length > 0) newRows = newRows.map(r => ({ ...r, _poHasMismatch: true }));
        currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "done", rows: newRows, unmatched, caseMismatches } : p);
        setPdfs([...currentPdfs]);
      } catch (e) {
        currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "error", error: e.message } : p);
        setPdfs([...currentPdfs]);
      }
    }

    const allRows = currentPdfs.filter(p => p.status === "done").flatMap(p => p.rows);
    const allUnmatched = currentPdfs.filter(p => p.status === "done").flatMap(p => p.unmatched || []);
    const allCaseMismatches = currentPdfs.filter(p => p.status === "done").flatMap(p => p.caseMismatches || []);
    const failedPOs = currentPdfs.filter(p => p.status === "error").length;
    setRows(allRows);
    setResult({ totalPOs: currentPdfs.filter(p => p.status === "done").length, failedPOs, allUnmatched, allCaseMismatches });
    initApproval(allRows, retailer, shipMethod, memo, orderStatus);
    setBusy(false);
  };

  // Overlay current settings onto stored rows so changing dropdowns updates results instantly
  const rc = RETAILERS[retailer] || {};
  const isGnbRetailer = rc.type === "gnb";
  const isJungleJimsRetailer = retailer === "Jungle Jims Market Inc";
  const isImperialRetailer = retailer === "Imperial Distributors Inc.";
  const activeCols = isGnbRetailer ? GNB_APPROVAL_COLS : APPROVAL_COLS;
  const amountColIdx = activeCols.findIndex(c => c.key === "amount");
  const effectiveRows = rows.map(r => ({
    ...r,
    // GNB rows carry per-row ship method from distro; don't override with global selector
    ...(!isGnbRetailer && { "Ship Method": shipMethod }),
    // GNB date and account numbers come from the inputs and update live
    ...(isGnbRetailer && gnbDate ? { "Date": isoToMDY(gnbDate) } : {}),
    ...(isGnbRetailer ? {
      "Freight Account #":
        r["_gnbCarrier"] === "Fed Ex Ground" || r["_gnbCarrier"] === "FedEx Ground" ? gnbFedexAccount :
        r["_gnbCarrier"] === "UPS Ground" ? gnbUpsAccount : r["Freight Account #"] || "",
    } : {}),
    "Status": r._poHasMismatch ? "Pending Approval" : orderStatus,
    "NS CUSTOMER": retailer === "Samples" && samplesSubcustomer ? `Samples : Samples - ${samplesSubcustomer}` : rc.nsCustomer,
    "Price Level": rc.priceLevel,
    "Is EDI Sent": rc.isEdiSent,
    "Is Sample": rc.isSample,
    ...(retailer === "Samples" ? { "Rate": 0, "Amount": 0 } : {}),
    // GNB and JJ memos are auto-generated per row; don't override
    ...(!isGnbRetailer && !isJungleJimsRetailer && memo ? { "Memo": memo } : {}),
  }));
  const total = effectiveRows.reduce((s, r) => s + Number(r["Amount"]), 0);
  const queuedCount = pdfs.filter(p => p.status === "queued").length;
  const hasPdfs = pdfs.length > 0;

  return (
    <div style={{fontFamily:"var(--font-sans)",padding:"1.75rem 0",maxWidth:680}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes im-blink{0%,100%{background:#fee2e2;color:#dc2626}50%{background:transparent;color:var(--color-text-secondary)}} .im-blink{animation:im-blink 1.4s ease-in-out infinite}`}</style>

      <div style={{marginBottom:"1.5rem"}}>
        <h2 style={{fontSize:24,fontWeight:600,margin:"0 0 6px",color:"var(--color-text-primary)"}}>NetSuite PO Converter</h2>
        <p style={{fontSize:15,color:"var(--color-text-secondary)",margin:0}}>Upload retailer purchase orders and download a NetSuite-ready CSV</p>
      </div>

      {/* Settings tab bar */}
      <div style={{display:"flex",alignItems:"flex-end",borderBottom:"1px solid var(--color-border-secondary)",marginBottom:"0.75rem"}}>
        <button style={S.mainTabBtn(settingsTab==="main")} onClick={()=>setSettingsTab("main")}>Order Import → Export</button>
        <div style={{flex:1}}/>
        <button
          className={!im?.length?"im-blink":""}
          style={{...S.mainTabBtn(settingsTab==="im"),...(!im?.length?{background:undefined,color:undefined}:{})}}
          onClick={()=>setSettingsTab("im")}
        >Item Master</button>
      </div>

      {/* Order Settings */}
      {settingsTab==="main"&&<div style={{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem"}}>
        <div style={{display:"grid",gridTemplateColumns:retailer==="Samples"?"1fr 1fr 1fr 1fr":"2fr 1fr 1fr",gap:8,marginBottom:8}}>
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Retailer</label>
            <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={retailer} onChange={e=>handleRetailer(e.target.value)} disabled={busy}>
              <option value="" disabled>Select Retailer</option>
              {Object.entries(RETAILERS).filter(([,rc])=>import.meta.env.DEV||!rc.dev).map(([r])=><option key={r}>{r}</option>)}
            </select>
          </div>
          {retailer==="Samples"&&(
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Subcustomer</label>
              <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={samplesSubcustomer} onChange={e=>setSamplesSubcustomer(e.target.value)} disabled={busy}>
                <option value="" disabled>Select One</option>
                <option>Charitable Contributions</option>
                <option>Customer Service</option>
                <option>General</option>
                <option>PR</option>
                <option>Retailers</option>
              </select>
            </div>
          )}
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Ship method</label>
            <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={shipMethod} onChange={e=>setShipMethod(e.target.value)} disabled={busy}>
              {SHIP_METHODS.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Status</label>
            <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={orderStatus} onChange={e=>setOrderStatus(e.target.value)} disabled={busy}>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {isGnbRetailer ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Order date</label>
              <input style={{...S.input,padding:"7px 10px",fontSize:13}} type="date" value={gnbDate} onChange={e=>setGnbDate(e.target.value)} disabled={busy}/>
            </div>
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>UPS Account #</label>
              <input style={{...S.input,padding:"7px 10px",fontSize:13}} type="text" value={gnbUpsAccount} onChange={e=>setGnbUpsAccount(e.target.value)} disabled={busy}/>
            </div>
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>FedEx Account #</label>
              <input style={{...S.input,padding:"7px 10px",fontSize:13}} type="text" value={gnbFedexAccount} onChange={e=>setGnbFedexAccount(e.target.value)} disabled={busy}/>
            </div>
          </div>
        ) : (
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Memo <span style={{fontWeight:400,color:"var(--color-text-tertiary)"}}>— optional</span></label>
            <input style={{...S.input,padding:"7px 10px",fontSize:13}} type="text" placeholder="e.g. Spring 2026 Drop" value={memo} onChange={e=>setMemo(e.target.value)} disabled={busy}/>
          </div>
        )}
      </div>}

      {/* Item Master */}
      {settingsTab==="im"&&<div style={{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <span style={{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)"}}>Item master</span>
          {im?.length?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
              <span style={{fontSize:13,color:"var(--color-text-success)",fontWeight:500}}>{imSource}</span>
              <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                {"To refresh Item Master, "}
                <a href="https://4848284.app.netsuite.com/app/common/search/searchredirect.nl?id=166419&siaT=1781731236942&siaWhc=%2Fapp%2Fcommon%2Fsearch%2Fsearchresults.nl&siaPs=0&siaPfx=search&siaQ=claude&siaNv=gs" target="_blank" rel="noreferrer" style={{color:"var(--color-text-primary)",fontWeight:500}}>export from NS</a>
                {" and "}
                <span style={{cursor:"pointer",color:"var(--color-text-primary)",fontWeight:500,textDecoration:"underline"}} onClick={()=>imRef.current?.click()}>replace</span>
              </span>
            </div>
          ):imSource?(
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,color:"var(--color-text-danger)",fontWeight:500}}>{imSource}</span>
              <button style={S.btnReplace} onClick={()=>imRef.current?.click()}>Try again</button>
            </div>
          ):(
            <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>
              <a href="https://4848284.app.netsuite.com/app/common/search/searchresults.nl?searchid=166419&whence=" target="_blank" rel="noreferrer" style={{color:"var(--color-text-primary)",fontWeight:500}}>Export from NS</a>
              {" then "}
              <span style={{cursor:"pointer",color:"var(--color-text-primary)",fontWeight:500,textDecoration:"underline"}} onClick={()=>imRef.current?.click()}>upload CSV</span>
            </span>
          )}
        </div>
        <input ref={imRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>loadIMCSV(e.target.files[0])}/>
      </div>}

      {/* Samples text card */}
      {settingsTab==="main"&&retailer==="Samples"&&<div style={S.card}>
        <span style={S.sectionLabel}><i className="ti ti-message-2" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Sample request</span>
        <textarea
          style={{...S.input,padding:"9px 12px",fontSize:13,minHeight:150,resize:"vertical",lineHeight:1.55,display:"block"}}
          placeholder={"Paste the Slack request here…\n\n1x DMW10008\nRaine Page\n316 Robinhood Road\nBrentwood, TN 37027"}
          value={samplesText}
          onChange={e=>setSamplesText(e.target.value)}
          disabled={busy}
        />
      </div>}

      {/* PDF card */}
      {settingsTab==="main"&&retailer!=="Samples"&&<div
        style={hasPdfs?{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem",transition:"border-color 0.15s,background 0.15s",...(pdfDrag?{borderColor:"var(--color-border-info)",background:"var(--color-background-info)"}:{})}:S.card}
        onDragOver={hasPdfs?e=>{e.preventDefault();setPdfDrag(true);}:undefined}
        onDragLeave={hasPdfs?()=>setPdfDrag(false):undefined}
        onDrop={hasPdfs?e=>{e.preventDefault();setPdfDrag(false);handleFiles(e.dataTransfer.files);}:undefined}
      >
        {!hasPdfs ? (
          <>
          <span style={S.sectionLabel}><i className="ti ti-file-type-pdf" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Purchase order PDFs</span>
          <div
            style={{...S.dzBase,...(pdfDrag?S.dzHover:{})}}
            onClick={()=>pdfRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setPdfDrag(true);}}
            onDragLeave={()=>setPdfDrag(false)}
            onDrop={e=>{e.preventDefault();setPdfDrag(false);handleFiles(e.dataTransfer.files);}}>
            <i className="ti ti-file-type-pdf" aria-hidden="true" style={{fontSize:36,color:"var(--color-text-secondary)",display:"block",marginBottom:10}}/>
            <p style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",margin:0}}>{isGnbRetailer?"Click or drag to upload GNB blanket PO + distro sheet":"Click or drag to upload PO PDFs"}</p>
            <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"6px 0 0"}}>{isGnbRetailer?"Drop both PDFs together — the app will detect which is which":"Select multiple files at once · ZIP supported · any retailer format"}</p>
          </div>
          {import.meta.env.DEV&&<button onClick={loadTestPDFs} style={{marginTop:8,fontSize:12,padding:"5px 12px",fontFamily:"var(--font-sans)",border:"1px dashed var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-tertiary)",cursor:"pointer"}}>⚙ Load test PDFs</button>}
          </>
        ) : (
          <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)"}}>Purchase order PDFs</span>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {!busy&&<span style={{fontSize:13,color:"var(--color-text-primary)",cursor:"pointer",textDecoration:"underline",fontWeight:500}} onClick={()=>pdfRef.current?.click()}>+ Add more</span>}
              {import.meta.env.DEV&&!busy&&<button onClick={loadTestPDFs} style={{fontSize:12,padding:"3px 10px",fontFamily:"var(--font-sans)",border:"1px dashed var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-tertiary)",cursor:"pointer"}}>⚙ Load test PDFs</button>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {pdfs.map(pdfItem=>(
              <div key={pdfItem.id} style={{display:"flex",flexDirection:"column",gap:4,padding:"7px 10px",background:pdfItem.status==="error"?"var(--color-background-danger)":"var(--color-background-secondary)",borderRadius:6,border:`1px solid ${pdfItem.status==="error"?"var(--color-border-danger, #fca5a5)":"var(--color-border-tertiary)"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <i className="ti ti-file-type-pdf" aria-hidden="true" style={{fontSize:14,color:"var(--color-text-secondary)",flexShrink:0}}/>
                  <span style={{fontSize:13,color:"var(--color-text-primary)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={pdfItem.name}>{pdfItem.name}</span>
                  {pdfItem.status==="loading"&&(
                    <span style={{fontSize:12,color:"var(--color-text-tertiary)",flexShrink:0}}>Loading…</span>
                  )}
                  {pdfItem.status==="queued"&&(
                    <span style={{fontSize:12,color:"var(--color-text-secondary)",flexShrink:0}}>Ready</span>
                  )}
                  {pdfItem.status==="processing"&&(
                    <span style={{fontSize:12,color:"#2563eb",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                      <span style={{width:10,height:10,border:"2px solid rgba(37,99,235,0.25)",borderTopColor:"#2563eb",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
                      Processing
                    </span>
                  )}
                  {pdfItem.status==="done"&&(
                    <span style={{fontSize:12,color:"var(--color-text-success)",display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                      Done · {pdfItem.rows.length} line{pdfItem.rows.length!==1?"s":""} {pdfItem.caseMismatches?.length>0?"⚠️":<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:15,height:15,borderRadius:"50%",background:"#16a34a",color:"#fff",fontSize:10,fontWeight:700,flexShrink:0,lineHeight:1}}>✓</span>}
                    </span>
                  )}
                  {pdfItem.status==="error"&&(
                    <span style={{fontSize:12,color:"var(--color-text-danger)",display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                      <i className="ti ti-alert-circle" aria-hidden="true" style={{fontSize:12}}/> Error
                    </span>
                  )}
                  {!busy&&pdfItem.status!=="processing"&&(
                    <button onClick={()=>removePDF(pdfItem.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-tertiary)",fontSize:16,lineHeight:1,padding:"0 2px",flexShrink:0,fontFamily:"var(--font-sans)"}}>×</button>
                  )}
                </div>
                {pdfItem.status==="error"&&pdfItem.error&&(
                  <span style={{fontSize:12,color:"var(--color-text-danger)",paddingLeft:22}}>{pdfItem.error}</span>
                )}
              </div>
            ))}
          </div>
          </>
        )}
        <input ref={pdfRef} type="file" accept="application/pdf,.zip" multiple style={{display:"none"}} onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
      </div>}

      {settingsTab==="main"&&<>
      {err&&<div style={S.msgErr}><i className="ti ti-alert-circle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>{err}</div>}

      {(busy||(retailer==="Samples"?!!samplesText.trim():queuedCount>0))&&(
        <button
          style={(retailer==="Samples"?(busy||!samplesText.trim()||!samplesSubcustomer):(busy||!queuedCount))?S.btnPrimaryDis:S.btnPrimary}
          onClick={process}
          disabled={retailer==="Samples"?(busy||!samplesText.trim()||!samplesSubcustomer):(busy||!queuedCount)}
        >
          {busy
            ?<><span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>{busyMsg}</>
            :<><i className="ti ti-wand" aria-hidden="true" style={{fontSize:16}}/>{retailer==="Samples"?"Parse & generate CSV":queuedCount===1?"Extract & generate CSV":`Extract ${queuedCount} PDFs & generate CSV`}</>}
        </button>
      )}

      {result&&(<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:"1rem"}}>
          <div style={S.stat}><div style={S.statLabel}>POs</div><div style={S.statVal}>{result.totalPOs}</div></div>
          <div style={S.stat}><div style={S.statLabel}>Lines</div><div style={S.statVal}>{effectiveRows.length}</div></div>
          <div style={S.stat}><div style={S.statLabel}>Unmatched SKUs</div><div style={{...S.statVal,color:result.allUnmatched.length?"var(--color-text-warning)":undefined}}>{result.allUnmatched.length||"None"}</div></div>
          <div style={S.stat}><div style={S.statLabel}>Total</div><div style={S.statVal}>${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        </div>

        {result.skuMismatch&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>SKU Mismatch:</strong> PO SKU ({result.skuMismatch.poSku}) does not match distro sheet Item # ({result.skuMismatch.distroItemNum}). Verify before importing.</span></div>}
        {result.allUnmatched?.length>0&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>Unmatched:</strong> {result.allUnmatched.join(", ")} — vendor item # used as fallback</span></div>}
        {result.allCaseMismatches?.length>0&&<div style={S.msgWarn}><span><strong>⚠️ {result.allCaseMismatches.length>1?"Case Pack Mismatch Warnings":"Case Pack Mismatch Warning"}</strong><br/>{result.allCaseMismatches.map((m,i)=><span key={i}>{m}.<br/></span>)}<br/>{result.allCaseMismatches.length>1?"Contact buyer to get the POs revised to full case packs. The POs have been updated to Pending Approval pending the buyer's change.":"Contact buyer to get the PO revised to full case packs. The PO has been updated to Pending Approval pending the buyer's change."}</span></div>}
        {!result.allUnmatched?.length&&im&&<div style={S.msgOk}><i className="ti ti-circle-check" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>All items matched to item master</div>}
        {result.failedPOs>0&&<div style={S.msgErr}><i className="ti ti-alert-circle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>{result.failedPOs} PDF{result.failedPOs>1?"s":""} failed — see file list above for details</div>}

        {approval&&(()=>{
          const curOrder = approval.orders[approvalOrderIdx] || approval.orders[0];
          const orderTotal = curOrder.lines.reduce((s,l)=>s+(parseFloat(l.amount)||0),0);
          return (
          <div style={{...S.card,marginTop:0,marginBottom:"1rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{...S.sectionLabel,margin:0}}>Order Approval Sheet</span>
              <button style={S.btnSuccess} onClick={exportApprovalXLSX}><i className="ti ti-file-spreadsheet" aria-hidden="true" style={{fontSize:15}}/>Export Excel</button>
            </div>
            {/* Order pagination */}
            {approval.orders.length>1&&(
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <button onClick={()=>setApprovalOrderIdx(i=>Math.max(0,i-1))} disabled={approvalOrderIdx===0} style={{background:"none",border:"1px solid var(--color-border-secondary)",borderRadius:6,padding:"4px 10px",cursor:approvalOrderIdx===0?"not-allowed":"pointer",color:"var(--color-text-primary)",opacity:approvalOrderIdx===0?0.35:1,fontFamily:"var(--font-sans)"}}>‹</button>
                {approval.orders.map((_,i)=>(
                  <button key={i} onClick={()=>setApprovalOrderIdx(i)} style={{minWidth:28,padding:"4px 8px",borderRadius:6,border:"1px solid var(--color-border-secondary)",background:i===approvalOrderIdx?"#363737":"var(--color-background-secondary)",color:i===approvalOrderIdx?"#fff":"var(--color-text-secondary)",fontFamily:"var(--font-sans)",fontSize:13,cursor:"pointer"}}>{i+1}</button>
                ))}
                <button onClick={()=>setApprovalOrderIdx(i=>Math.min(approval.orders.length-1,i+1))} disabled={approvalOrderIdx===approval.orders.length-1} style={{background:"none",border:"1px solid var(--color-border-secondary)",borderRadius:6,padding:"4px 10px",cursor:approvalOrderIdx===approval.orders.length-1?"not-allowed":"pointer",color:"var(--color-text-primary)",opacity:approvalOrderIdx===approval.orders.length-1?0.35:1,fontFamily:"var(--font-sans)"}}>›</button>
                <span style={{fontSize:13,color:"var(--color-text-secondary)",marginLeft:4}}>PO {curOrder.poNumber} · {curOrder.lines.length} line{curOrder.lines.length!==1?"s":""}</span>
              </div>
            )}
            <div style={{overflowX:"auto",overflowY:"auto",maxHeight:460,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,marginBottom:8}}>
              <table style={{borderCollapse:"collapse",tableLayout:"fixed",minWidth:activeCols.reduce((s,c)=>s+c.w,0)}}>
                <thead>
                  <tr style={{background:"#BEBEBE"}}>
                    {activeCols.map((col,ci)=>(
                      <th key={col.key} style={{...S.th,width:col.w,minWidth:col.w,position:"sticky",top:0,background:"#BEBEBE",zIndex:ci===0?3:2,...(ci===0?{left:0}:{})}}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {curOrder.lines.map((line,li)=>(
                    <tr key={li}>
                      {activeCols.map((col,ci)=>(
                        <td key={col.key} style={{...S.td,borderBottom:li<curOrder.lines.length-1?"0.5px solid var(--color-border-tertiary)":"none",padding:"3px 4px",...(ci===0?{position:"sticky",left:0,background:"var(--color-background-primary)",zIndex:1}:{})}}>
                          <input
                            style={{width:"100%",boxSizing:"border-box",padding:"4px 6px",fontSize:12,fontFamily:"var(--font-sans)",border:"1px solid transparent",borderRadius:4,background:"transparent",color:line.caseMismatch?"#ef4444":"var(--color-text-primary)",outline:"none"}}
                            value={String(isGnbRetailer&&col.key==="date"?(isoToMDY(gnbDate)||line[col.key]):(line[col.key]??""))}
                            readOnly={ci===0||(isGnbRetailer&&col.key==="date")}
                            onChange={e=>updateApprovalLine(approvalOrderIdx,li,col.key,e.target.value)}
                            onFocus={e=>{if(ci!==0&&!(isGnbRetailer&&col.key==="date"))e.target.style.borderColor="var(--color-border-info)";}}
                            onBlur={e=>e.target.style.borderColor="transparent"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{background:"#BEBEBE"}}>
                    <td colSpan={amountColIdx} style={{...S.td,fontWeight:600,textAlign:"right",padding:"7px 12px"}}>Total</td>
                    <td style={{...S.td,fontWeight:600,padding:"7px 8px"}}>${orderTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                    <td colSpan={activeCols.length-amountColIdx-1}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          );
        })()}

        <div style={{...S.card,marginTop:0}}>
          <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
            {TABS_PREVIEW.map(t=>(
              <button key={t.label} style={S.previewTabBtn(previewTab===t.label)} onClick={()=>setPreviewTab(t.label)}>{t.label}</button>
            ))}
          </div>
          {(()=>{
            const _hideCols=new Set(rc.hideCols||[]);
            const _extraCols=(rc.showCols||{})[previewTab]||[];
            const previewCols=[...(TABS_PREVIEW.find(t=>t.label===previewTab)?.cols||[]),..._extraCols].filter(h=>!_hideCols.has(h));
            return (
          <div style={{overflowX:"auto",overflowY:"auto",maxHeight:460,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#BEBEBE"}}>
                  <th style={{...S.th,width:40,minWidth:40,position:"sticky",top:0,left:0,background:"#BEBEBE",zIndex:3}}>#</th>
                  {previewCols.map(h=>(
                    <th key={h} style={{...S.th,position:"sticky",top:0,background:"#BEBEBE",zIndex:2}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  const lineCounters={};
                  return effectiveRows.map((row,i)=>{
                    const poKey=isGnbRetailer?(row._gnbPoNumber||"default"):"default";
                    lineCounters[poKey]=(lineCounters[poKey]||0)+1;
                    const lineId=lineCounters[poKey];
                    return (
                      <tr key={i}>
                        <td style={{...S.td,borderBottom:i<effectiveRows.length-1?"0.5px solid var(--color-border-tertiary)":"none",position:"sticky",left:0,background:"var(--color-background-primary)",zIndex:1,textAlign:"center",color:"var(--color-text-tertiary)",fontSize:11,width:40,minWidth:40}}>{lineId}</td>
                        {previewCols.map(h=>(
                          <td key={h} style={{...S.td,borderBottom:i<effectiveRows.length-1?"0.5px solid var(--color-border-tertiary)":"none",color:row._caseMismatch?"#ef4444":undefined}}>{row[h]}</td>
                        ))}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
            );
          })()}
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
          <button style={S.btnOutline} onClick={resetAll}><i className="ti ti-refresh" aria-hidden="true" style={{fontSize:15}}/>New batch</button>
          <button style={S.btnSuccess} onClick={()=>dlCSV(isGnbRetailer?buildGnbCSV(effectiveRows):isJungleJimsRetailer?buildJjCSV(effectiveRows):isImperialRetailer?buildImperialCSV(effectiveRows):buildCSV(effectiveRows),`NS_${retailer.replace(/\s+/g,"_")}_${result.totalPOs}PO${result.totalPOs!==1?"s":""}.csv`)}><i className="ti ti-download" aria-hidden="true" style={{fontSize:15}}/>Download CSV</button>
          <a href="https://4848284.app.netsuite.com/app/setup/assistants/nsimport/importassistant.nl?recid=206&new=T" target="_blank" rel="noreferrer" style={{...S.btnOutline,textDecoration:"none"}}><i className="ti ti-upload" aria-hidden="true" style={{fontSize:15}}/>Import CSV into NS</a>
        </div>
      </>)}
      </>}
    </div>
  );
}
