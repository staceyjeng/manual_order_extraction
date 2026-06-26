import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from "react";
import JSZip from "jszip";
import netlifyIdentity from 'netlify-identity-widget';

const RETAILERS = {
  "BJ's Wholesale Club": { nsCustomer: "BJs Wholesale Corporate : BJs Wholesale", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No" },
  "Canadian Tire Corporation": { nsCustomer: "Canadian Tire Corporation", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import", dev: true },
  "Cost Plus World Market": { nsCustomer: "Cost Plus World Market", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No" },
  "Costco CAN": { nsCustomer: "Costco CAN", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import", dev: true },
  "Costco MX": { nsCustomer: "Costco MX", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import", dev: true },
  "Dollar General Direct Import": { nsCustomer: "Dollar General Direct Import", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import", dev: true },
  "Gilt": { nsCustomer: "Gilt", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultMemo: "Email inboundtrans@ruelala.com or call (502) 281-4419 for routing instructions before shipping the order" },
  "Global New Beginnings": { nsCustomer: "Global New Beginnings Inc.", shipMethod: "Collect", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", type: "gnb" },
  "Home Hardware": { nsCustomer: "Home Hardware", shipMethod: "Collect", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import" },
  "Hy-Vee": { nsCustomer: "Hy-Vee", shipMethod: "ROUTEPPD", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", orderUnit: "cases" },
  "Imperial Distributors Inc.": { nsCustomer: "Imperial Distributors Inc.", shipMethod: "ROUTEPPD", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultMemo: "Frgt Terms :$1000 Prepaid", hideCols: ["Freight Account #","SCAC"] },
  "Jungle Jims Market Inc": { nsCustomer: "Jungle Jims Market Inc", shipMethod: "UPS Ground", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultMemo: "Packing slip or invoice must be on the outside of the package, with the department specified. Jungle Jim's does not accept shipments from UPS freight. UPS Ground is Fine.", hideCols: ["Customer Part Number","Freight Account #","SCAC"], showCols: {"Items": ["Department Number"]} },
  "Mark-It Smart Inc.": { nsCustomer: "Mark-It Smart Inc.", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No" },
  "PriceSmart Inc.": { nsCustomer: "PriceSmart Inc.", shipMethod: "", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import", dev: true },
  "Samples": { nsCustomer: "Samples", shipMethod: "DPP", status: "Pending Fulfillment", isEdiSent: "No", isSample: "Yes", dev: true, showCols: {"Items": ["Is Sample"]} },
  "Sur La Table": { nsCustomer: "Sur La Table", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultMemo: "Remove MABD from BOL to avoid chargeback" },
  "TJ Maxx Canada": { nsCustomer: "T.J. Maxx Corporate : T.J. Maxx - Canada", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No" },
  "Verdi Commerce LLC": { nsCustomer: "Verdi Commerce LLC", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultMemo: "Please use the the will call form" },
  "Walmart Canada": { nsCustomer: "Walmart Canada", shipMethod: "Collect", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import" },
  "Walmart DI - US": { nsCustomer: "Walmart Corporate : Walmart US DI", shipMethod: "Collect", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", defaultLocation: "Direct Import" },
  "Walmart Marketplace": { nsCustomer: "Walmart Corporate : Walmart Marketplace", shipMethod: "Route", status: "Pending Fulfillment", isEdiSent: "No", isSample: "No", dev: true },
};
const SHIP_METHODS = ["Collect","DPP","FedEx 2Day","FedEx Ground","FedEx Home Delivery","FedEx International Econ","FedEx SmartPost","Fedex Standard Overnight","Route","ROUTEPPD","UPS 2-Day","UPS 3-Day","UPS Express Saver","UPS Ground","UPS Overnight","UPS Surepost","USPS","USPS Ground Advantage"];
const STATUSES = ["Pending Fulfillment","Pending Approval"];
const CSV_HEADERS = ["Date","PO Number","Customer","Status","Location","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo","Item","Customer Part Number","Quantity","Item Rate","Amount"];
const SAMPLES_CSV_HEADERS = ["Date","PO Number","Customer","Status","Location","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo","Item","Customer Part Number","Quantity","Item Rate","Amount","Is Sample"];
const DEFAULT_ADDRESS_BOOK = [
  {name:"Caitlin Wise",     attention:"",               addr1:"2277 W. Cedar Hills Dr.",    addr2:"",            city:"Cedar City",    state:"UT", zip:"84720", country:"US"},
  {name:"Clay Elder",       attention:"",               addr1:"894 Riverside Dr",          addr2:"Apt 2E",      city:"New York City", state:"NY", zip:"10032", country:"US"},
  {name:"Cory Ellis",       attention:"",               addr1:"14819 NW Jewell Ln",        addr2:"",            city:"Portland",      state:"OR", zip:"97229", country:"US"},
  {name:"Imperial Distributors", attention:"Erica Buonanno", addr1:"150 Blackstone River Road", addr2:"",      city:"Worcester",     state:"MA", zip:"01607", country:"US"},
  {name:"Storebound",       attention:"",               addr1:"50 Broad St",               addr2:"12th Floor",  city:"New York City", state:"NY", zip:"10004", country:"US"},
];
const AB_KEY = "sb-address-book";
const toTitleCase = s => s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s;

const TABS_PREVIEW = [
  { label: "Header", cols: ["Date","PO Number","Customer","Status","Location","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Freight Account #","SCAC","Memo"] },
  { label: "Items", cols: ["Item","Customer Part Number","Quantity","Item Rate","Amount","Department Number"] },
];
const REQUIRED_FIELDS = [
  {label:"Date",key:"Date"},{label:"PO Number",key:"PO Number"},{label:"Name",key:"Customer"},
  {label:"Status",key:"Status"},{label:"Item",key:"Item"},{label:"Quantity",key:"Quantity"},
  {label:"Item Rate",key:"Item Rate"},{label:"Amount",key:"Amount"},{label:"Ship Date",key:"Ship Date"},
  {label:"Must Arrive By Date",key:"Must Arrive By Date"},{label:"Addressee",key:"Addressee"},
  {label:"Address 1",key:"Address 1"},{label:"City",key:"City"},{label:"State",key:"State"},
  {label:"Zip",key:"Zip"},{label:"Country",key:"Country"},
];

function parseCsvRow(line){const vals=[];let cur="",inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(inQ){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"'){inQ=false;}else{cur+=ch;}}else{if(ch==='"'){inQ=true;}else if(ch===','){vals.push(cur);cur="";}else{cur+=ch;}}}vals.push(cur);return vals;}
function parseImCsv(text){const lines=text.replace(/\r/g,"").trim().split("\n");if(!lines.length)return[];const hdrs=parseCsvRow(lines[0]).map(h=>h.trim());return lines.slice(1).filter(l=>l.trim()).map(line=>{const vals=parseCsvRow(line);const obj={};hdrs.forEach((h,i)=>{obj[h]=(vals[i]||"").trim();});return obj;});}
function esc(v){if(v===null||v===undefined)return "";const s=String(v);return(s.includes(",")||s.includes('"')||s.includes("\n"))?'"'+s.replace(/"/g,'""')+'"':s;}
function hasVal(v){return v!=null&&String(v).trim()!=="";}
function buildFilteredCSV(headers,rows){const active=headers.filter(h=>rows.some(r=>hasVal(r[h])));return[active.join(","),...rows.map(r=>active.map(h=>esc(r[h])).join(","))].join("\n");}
function buildCSV(rows){return buildFilteredCSV(CSV_HEADERS,rows);}
const SAMPLES_ADDR_COLS=new Set(["Addressee","Attention","Address 1","Address 2","City","State","Zip","Country"]);
function buildSamplesCSV(rows){const active=SAMPLES_CSV_HEADERS.filter(h=>SAMPLES_ADDR_COLS.has(h)||rows.some(r=>hasVal(r[h])));return[active.join(","),...rows.map(r=>active.map(h=>esc(r[h])).join(","))].join("\n");}
const GNB_CSV_HEADERS=["Date","PO Number","Customer","Status","Location","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Freight Account #","SCAC","Memo","Item","Customer Part Number","Quantity","Item Rate","Amount"];
function buildGnbCSV(rows){return buildFilteredCSV(GNB_CSV_HEADERS,rows);}
const IMPERIAL_CSV_HEADERS=["Date","PO Number","Customer","Status","Location","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo","Item","Customer Part Number","Quantity","Item Rate","Amount"];
function buildImperialCSV(rows){return buildFilteredCSV(IMPERIAL_CSV_HEADERS,rows);}
const JJ_CSV_HEADERS=["Date","PO Number","Customer","Status","Location","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo","Item","Quantity","Item Rate","Amount","Department Number"];
function buildJjCSV(rows){return buildFilteredCSV(JJ_CSV_HEADERS,rows);}
const WAL_CAN_CSV_HEADERS=["Date","PO Number","Customer","Status","Item","Customer Part Number","Quantity","Item Rate","Amount","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo"];
function buildWalmartCanCSV(rows){return buildFilteredCSV(WAL_CAN_CSV_HEADERS,rows);}
const WAL_DI_PROMPT=`Extract ALL destinations from this Walmart Direct Import purchase order document. Return ONLY valid JSON, no markdown, no explanation.\n\n{"orders":[{"poNumber":"","orderDate":"YYYY-MM-DD","shipDate":"YYYY-MM-DD","cancelDate":"YYYY-MM-DD","addressee":"","quoteId":"","eventCode":"","inStoreDate":"YYYY-MM-DD","loadingPort":"","lineItems":[{"vendorStyle":"","quantity":0,"unitCost":0.00,"packQty":0}]}]}\n\nRules:\n- Return one entry per destination row.\n- poNumber=Purchase Order number (e.g. 1006764461).\n- orderDate=Create Date in YYYY-MM-DD.\n- shipDate=Vendor Ship Date (first date on the destination row) in YYYY-MM-DD.\n- cancelDate=Cancel Date (second date on the destination row, one line below ship date) in YYYY-MM-DD.\n- addressee=Destination name exactly as printed (e.g. RIDGEVILLE SC FLOW).\n- quoteId=Number from the "QUOTE COPIED FROM TEMPLATE:" line in the Notes/Misc comments section (digits only, e.g. 21321671); empty string if not found.\n- eventCode=Event code from Event(Date): field (e.g. OLHOLIWK35), without parentheses/date; empty string if not found.\n- inStoreDate=In Store Date in YYYY-MM-DD; empty string if not found.\n- loadingPort=Loading Port / Place of Possession; empty string if not found.\n- lineItems: vendorStyle=Vendor Stock number (e.g. DAFT230002). quantity=Total Cartons per Line as integer. unitCost=NET FIRST COST decimal value. packQty=Pack #: value as integer; 1 if not found.\n- Extract ALL line items per destination.\n- ONLY JSON.`;
const WAL_DI_CSV_HEADERS=["Date","PO Number","Customer","Status","Item","Customer Part Number","Quantity","Item Rate","Amount","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo","Location"];
function buildWalmartDiCSV(rows){return buildFilteredCSV(WAL_DI_CSV_HEADERS,rows);}
const HH_CSV_HEADERS=["Date","PO Number","Customer","Status","Item","Customer Part Number","Quantity","Item Rate","Amount","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo","Location"];
function buildHhCSV(rows){return buildFilteredCSV(HH_CSV_HEADERS,rows);}
const TJM_CAN_CSV_HEADERS=["Date","PO Number","Customer","Status","Location","Ship Date","Cancel Date","Must Arrive By Date","Addressee","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo","Item","Customer Part Number","Quantity","Item Rate","Amount","Department Number"];
function buildTjmCanCSV(rows){return buildFilteredCSV(TJM_CAN_CSV_HEADERS,rows);}
function buildCpnCSV(rows){const seen=new Set();const lines=[["Customer","Item","Name"]];for(const r of rows){const cpn=String(r["Customer Part Number"]||"").trim();const childSku=String(r["NS SKU"]||"").trim();const parentSku=String(r["Parent SKU"]||"").trim();if(!cpn||!childSku)continue;const item=parentSku?`${parentSku} : ${childSku}`:childSku;const customer=String(r["Customer"]||"").trim();const key=`${customer}|${item}|${cpn}`;if(seen.has(key))continue;seen.add(key);lines.push([customer,item,cpn]);}return lines.map(row=>row.map(v=>esc(v)).join(",")).join("\n");}
function fmtDate(d){if(!d)return d;const p=String(d).split("/");if(p.length===3&&p[2].length===2){const y=parseInt(p[2],10);p[2]=y<=49?`20${p[2].padStart(2,"0")}`:`19${p[2].padStart(2,"0")}`;}return p.join("/");}
function friendlyError(e) {
  const msg = String(e?.message || e || "");
  if (msg.includes("401") || msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("api key"))
    return "API key error — check your Anthropic API key in the .env file.";
  if (msg.includes("429") || msg.toLowerCase().includes("rate limit"))
    return "Rate limit reached — wait a moment and try again.";
  if (msg.includes("529") || msg.toLowerCase().includes("overloaded"))
    return "Claude is overloaded right now — try again in a few seconds.";
  if (msg.includes("413") || msg.toLowerCase().includes("too large"))
    return "PDF is too large to process — try splitting it into smaller files.";
  if (msg.toLowerCase().includes("syntaxerror") || msg.toLowerCase().includes("json") || msg.toLowerCase().includes("unexpected token"))
    return "Claude returned unexpected output — the PDF may be image-based, password-protected, or in an unsupported format.";
  if (msg.toLowerCase().includes("no text") || msg.toLowerCase().includes("empty response"))
    return "No response from Claude — check your API key and network connection.";
  if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror") || msg.toLowerCase().includes("timeout"))
    return "Network error — check your internet connection and try again.";
  if (msg.includes("500") || msg.includes("502") || msg.includes("503"))
    return "Server error from the API — try again in a moment.";
  return msg || "Unknown error — try re-uploading the PDF.";
}
function dlCSV(content,name){const b=new Blob(["﻿"+content],{type:"text/csv;charset=utf-8;"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
function isoToMDY(iso){if(!iso)return "";const[y,m,d]=iso.split("-");return `${parseInt(m)}/${parseInt(d)}/${y}`;}
function mddFormat(mdy){if(!mdy)return "";const p=mdy.split("/");if(p.length<2)return "";const mn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return `${parseInt(p[1])}-${mn[parseInt(p[0])-1]||""}`; }
function localISODate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function addDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+n);return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}
function subBizDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);let rem=n;while(rem>0){dt.setDate(dt.getDate()-1);const dow=dt.getDay();if(dow!==0&&dow!==6)rem--;}return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}
function addBizDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);let rem=n;while(rem>0){dt.setDate(dt.getDate()+1);const dow=dt.getDay();if(dow!==0&&dow!==6)rem--;}return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}
function isoAddBizDays(iso,n){if(!iso)return "";const mdy=isoToMDY(iso);const r=addBizDays(mdy,n);const[rm,rd,ry]=r.split("/");return `${ry}-${rm}-${rd}`;}
const UPS_GROUND_TRANSIT={"NV":2,"AZ":2,"OR":2,"WA":2,"ID":3,"UT":3,"MT":3,"WY":3,"CO":3,"NM":3,"ND":4,"SD":4,"NE":4,"KS":4,"MN":4,"IA":4,"MO":4,"WI":4,"IL":4,"MI":4,"IN":4,"OH":4,"KY":4,"TN":4,"AR":4,"OK":4,"LA":5,"MS":5,"AL":5,"GA":5,"FL":5,"SC":5,"NC":5,"VA":5,"WV":5,"MD":5,"DE":5,"NJ":5,"NY":5,"PA":5,"CT":5,"RI":5,"MA":5,"NH":5,"VT":5,"ME":5,"DC":5,"PR":6,"VI":6,"GU":6};
function upsGroundDays(zip,state){const z=parseInt((zip||"").replace(/\D/g,"").slice(0,3)||"0");if(state==="CA"||(!state&&z>=900&&z<=961)){return z>=933?2:1;}if(state==="TX"||(!state&&z>=750&&z<=799)){return z>=780?5:4;}return UPS_GROUND_TRANSIT[state]||5;}
function genSamplePOBase(attn,company,yymmdd){const src=(attn||"").trim();if(src){const words=src.split(/\s+/).filter(Boolean);if(words.length>1){const initial=words[0][0].toUpperCase();const last=words[words.length-1].replace(/[^a-zA-Z]/g,"");return `${initial}${last.charAt(0).toUpperCase()+last.slice(1)}Sample${yymmdd}`;}const name=words[0].replace(/[^a-zA-Z]/g,"");return `${name.charAt(0).toUpperCase()+name.slice(1)}Sample${yymmdd}`;}const co=(company||"").replace(/[^a-zA-Z0-9]/g,"").slice(0,12);return `${co}Sample${yymmdd}`;}
function getSamplesDefaultShipDate(){const now=new Date();const est=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));const day=est.getDay(),h=est.getHours(),m=est.getMinutes();const isWeekday=day!==0&&day!==6;const pastCutoff=h>14||(h===14&&m>=30);const base=`${String(est.getMonth()+1).padStart(2,"0")}/${String(est.getDate()).padStart(2,"0")}/${est.getFullYear()}`;return(isWeekday&&!pastCutoff)?base:addBizDays(base,1);}
const SAMPLES_PO_KEY="sbops_sample_po";
function allocSamplePO(base){const today=localISODate().replace(/-/g,"").slice(2);let t={date:"",used:{}};try{t=JSON.parse(localStorage.getItem(SAMPLES_PO_KEY)||"{}");}catch{}if(t.date!==today)t={date:today,used:{}};t.used[base]=(t.used[base]||0)+1;const n=t.used[base];localStorage.setItem(SAMPLES_PO_KEY,JSON.stringify(t));return n===1?base:`${base}-${n}`;}

const PROMPT=`Extract data from this purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","deliveryDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY or empty","cancelDate":"MM/DD/YYYY or empty","mustArriveByDate":"MM/DD/YYYY or empty","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":"","lineItems":[{"upc":"","vendorItemNum":"","itemNum":"","quantity":0,"unitPrice":0,"description":""}]}\n\nRules: mustArriveByDate=deliveryDate if only one date. shipDate/cancelDate=empty if not stated. memo=any delivery appointment or scheduling note on the PO (e.g. "Vendor to call Shipping Location for appointment"); leave empty if none. itemNum=the retailer's own item/SKU number for the product (e.g. "ITEM NUM", "Item #", "Item Number" column); empty string if not present. Extract ALL lines. ONLY JSON.`;

const HY_VEE_PROMPT=`Extract data from this Hy-Vee purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","mustArriveByDate":"MM/DD/YYYY","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":"","lineItems":[{"mfgNum":"","prodNum":"","orderCode":"","cases":0,"masterPack":0,"netCostPerCase":0,"description":""}]}\n\nRules: Each line item spans two rows. Row 1: 6-digit MFG# (in VENDOR column), Master Pack/Size, Order Code. Row 2: ORDER QTY (cases ordered), ORDER UNIT (CASES), 5-digit PROD#, description, then cost columns. mfgNum=6-digit MFG# from row 1. prodNum=5-digit PROD# from row 2. orderCode=Order Code value from row 1. cases=ORDER QTY integer. masterPack=the integer before the backslash in the MASTER PACK/SIZE field (e.g. "6\\1EA-12X5" → 6). netCostPerCase=NET COST column value (third cost column). mustArriveByDate=SCHEDULE SHIPMENT TO ARRIVE ON date. memo=always empty string (ignore SPECIAL ALLOWANCES/MESSAGES). Extract ALL line items. ONLY JSON.`;

const IMPERIAL_PROMPT=`Extract data from this Imperial Distributors purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","mustArriveByDate":"MM/DD/YYYY","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"US","lineItems":[{"itemNum":"","vendorSku":"","gtin":"","csePck":0,"quantity":0,"unitPrice":0,"caseUpc":"","sizeMfrNo":0,"numberOfCases":0,"costOfDisplay":0}]}\n\nRules: poNumber=PO No. value. orderDate=Order Date in MM/DD/YYYY (e.g. 6/02/26 → 6/02/2026). mustArriveByDate=Expected Arrival Date in MM/DD/YYYY. shipToName=ship-to company name. shipToAttention=warehouse name (e.g. "Millis Warehouse", "Worcester Warehouse"). shipToAddress1=street address. shipToAddress2=suite or unit if present (e.g. "Suite 8"); "" if none. lineItems: extract ALL lines; ignore the *** Note *** page. itemNum=Item_# column. For Worcester orders: vendorSku=SKU after "/" in Mfr.No (e.g. DST200GBAQ04); gtin=dashed barcode in Mfr.No (e.g. 008-10051-85598-2); csePck=Pck column; quantity=Piece Qty (total pieces); unitPrice=Base Cost W/ OI; leave caseUpc/sizeMfrNo/numberOfCases/costOfDisplay as 0/"". For Millis orders: caseUpc=barcode with dashes (e.g. "108-56290-00510-5"); sizeMfrNo=Size Mfr. No column (case pack size); numberOfCases=Qty column (# of cases ordered); costOfDisplay=Cost of Display column; leave gtin/csePck/quantity/unitPrice as 0/"". ONLY JSON.`;

const JJ_PROMPT=`Extract data from this Jungle Jim's purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","shipToName":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","deliveryInstructions":"","lineItems":[{"upc":"11 digits","department":"","quantity":0,"unitPrice":0,"description":""}]}\n\nRules: poNumber=Purchase Order number. orderDate=Order Date in MM/DD/YYYY. shipToName=ship-to company name (e.g. JUNGLE JIMS EASTGATE). deliveryInstructions=text after "Delivery Instructions:" label on the PO; empty string if none. lineItems: extract ALL lines. upc=first 11 digits of the UPC column only. department=Dpt column value (e.g. 63). quantity=Unit/Lbs column (total units, NOT cases). unitPrice=Cost/Un column. ONLY JSON.`;

const SAMPLES_PROMPT=`Parse this sample request message from an employee. It may contain one or more separate orders (each going to a distinct shipping address). Return ONLY valid JSON, no markdown, no explanation.\n\n{"orders":[{"shipDate":"MM/DD/YYYY","mabd":"MM/DD/YYYY","lineItems":[{"sku":"exact SKU string as written","quantity":0}],"shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":""}]}\n\nRules:\n- Each distinct shipping address = one order object.\n- shipDate = date mentioned as "ship date", "ship by", "ship window", "ship" etc. Format MM/DD/YYYY; if year omitted assume current year. Empty string if not mentioned.\n- mabd = date mentioned as "MABD", "must arrive by", "arrive by", "need by" etc. Format MM/DD/YYYY; if year omitted assume current year. Empty string if not mentioned.\n- sku = the product code exactly as written (e.g. DMW10008, DCAF26CMGBCM02). Strip product descriptions; keep only the code.\n- quantity = integer. "1x of each" or "1x" before a list = 1 for every item. Parse the number before "x" as the quantity.\n- shipToName = company, facility, or recipient name appearing before the street address line (the line containing the street number and street name); anything before that line is the name or attention, never memo.\n- shipToAttention = name from "Attn:", "ATTN:", or similar label; empty string if none.\n- shipToAddress2 = suite, floor, door, unit, building — any secondary address line; empty string if none.\n- shipToCountry = 2-letter ISO: "US" for USA, "CA" for Canada.\n- memo = explicit delivery instructions or notes only (e.g. door codes, line review info, deal numbers); these typically appear in a separate section with at least one blank line separating them from the address and SKU lines; do NOT pull text from within the address block into memo.\n- ONLY JSON.`;

const GNB_PROMPT=`This is a Global New Beginnings (GNBI) document. Identify its type and extract accordingly. Return ONLY valid JSON, no markdown, no explanation.\n\nIf this is a PURCHASE ORDER (has "PURCHASE ORDER" heading, a PO # field, and SKU line items with unit cost):\n{"docType":"po","poNumber":"number only e.g. 3320","orderDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","sku":"exact SKU string e.g. RSMS150GBRR24","unitCost":0.0000}\n\nIf this is a DISTRIBUTION SHEET (table of fulfillment center rows with a Quill P.O. # column and ship-to addresses):\n{"docType":"distro","gnbiPoNumber":"","itemNum":"Item # value e.g. RSMS150GBRR24","quillSkuNum":"Quill SKU # value e.g. 3171196","primaryShipDate":"MM/DD/YYYY","locations":[{"quillPoNum":"e.g. XSYI66-1","name":"full center name e.g. Quill Fulfillment Center #472","address1":"street address line 1","address2":"street address line 2 if present else empty","city":"","state":"2-letter","zip":"","country":"US","quantity":0,"shipMethod":"exact carrier name as shown on the sheet e.g. Fed Ex Ground, UPS Ground, T-Force, Roadrunner","scac":"SCAC code(s) exactly as shown e.g. RDFS or UPGF/TFIN; empty string if not shown","shipDate":"MM/DD/YYYY"}]}\n\nDistro rules: exclude rows where quantity=0. shipMethod=the exact carrier name from the sheet — do NOT normalize or replace unknown carriers with Fed Ex Ground or UPS Ground. scac=the raw SCAC string as printed (may contain slashes for multiple codes); empty string if absent. shipDate=the "Latest Acceptable Ship Date" for that row; if blank use primaryShipDate. ONLY JSON.`;

const SLT_PROMPT=`Extract data from this Sur La Table purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"YYYY-MM-DD","shipDate":"YYYY-MM-DD","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"","lineItems":[{"style":"","sku":"","quantity":0,"unitCost":0.00,"shipPackQty":0}]}\n\nRules:\n- poNumber=PURCHASE ORDER number exactly as printed (with leading zeros, e.g. 0001688975).\n- orderDate=ORDER DATE in YYYY-MM-DD.\n- shipDate=BEGIN SHIP DATE in YYYY-MM-DD.\n- Ship-to block: first line=shipToName, second line=shipToAttention (e.g. EAGLEPOINT BUSINESS PARK), remaining lines=street address.\n- shipToAddress1=street address line (e.g. 901 E NORTHFIELD DR). If the street line contains a unit/suite/# (e.g. #200), split it: street goes in shipToAddress1, unit goes in shipToAddress2.\n- shipToAddress2=unit, suite, or # portion of the street address; empty string if none.\n- shipToState=2-letter abbreviation. shipToCountry=full country name as printed.\n- lineItems: style=STYLE column value (e.g. DEC012WH). sku=SKU column value exactly as printed with leading zeros (e.g. 0008975526). quantity=QTY integer. unitCost=COST decimal. shipPackQty=MIN PACK column value as integer; 0 if not present.\n- Extract ALL line items.\n- ONLY JSON.`;

const WAL_CAN_PROMPT=`Extract ALL purchase orders from this PDF. There may be one or more POs. Return ONLY valid JSON, no markdown, no explanation.\n\n{"orders":[{"poNumber":"","orderDate":"YYYY-MM-DD","shipDate":"YYYY-MM-DD","cancelDate":"YYYY-MM-DD","mabd":"YYYY-MM-DD","addressee":"","quoteNumber":"","lineItems":[{"vendorStyle":"","quantity":0,"unitCost":0.00,"shipPackQty":0}]}]}\n\nRules:\n- Return one entry in "orders" per distinct Purchase Order found in the PDF.\n- poNumber=Purchase Order number exactly as printed (with leading zeros, e.g. 0004314907).\n- orderDate=Order date / PO date in YYYY-MM-DD.\n- shipDate=Start Ship Date / Ship Window Start / Not Before Date in YYYY-MM-DD.\n- cancelDate=Cancel Date / Ship Window End / Not After Date / Ship Not After in YYYY-MM-DD; empty string if not found.\n- mabd=Must Arrive By / Arrival Date / Requested Delivery Date / Arrive No Later Than in YYYY-MM-DD.\n- addressee=Ship-to company name exactly as printed (e.g. WAL-MART IMD CANADA).\n- quoteNumber=Quote number or template number referenced in the PO (digits only, e.g. 20135648); empty string if not present.\n- lineItems: vendorStyle=vendor item number/style as printed. quantity=ordered quantity as integer. unitCost=unit cost/price as decimal. shipPackQty=Quantity Per Pack value as integer; 0 if not present.\n- Extract ALL line items for each PO.\n- ONLY JSON.`;
const HH_PROMPT=`Extract data from this Home Hardware purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","lineItems":[{"vendorStyle":"","hhNbr":"","quantity":0,"unitCost":0.00}]}\n\nRules:\n- poNumber=Purchase Order Number (e.g. X604S07962).\n- orderDate=Date Issued in MM/DD/YYYY (e.g. 2026/04/17 → 4/17/2026).\n- shipDate=Ship Date in MM/DD/YYYY (e.g. 2026/06/25 → 6/25/2026).\n- lineItems: vendorStyle=vendor style/SKU (e.g. DAPP150V2CA04). hhNbr=HH Nbr column value (e.g. 3813-078). quantity=Quantity integer. unitCost=Unit Cost decimal.\n- Extract ALL line items.\n- ONLY JSON.`;
const WAL_CAN_RTF_PROMPT=`Extract ALL purchase orders from this Walmart Canada Retail Link RTF document. Return ONLY valid JSON, no markdown, no explanation.\n\n{"orders":[{"poNumber":"","orderDate":"YYYY-MM-DD","shipDate":"YYYY-MM-DD","cancelDate":"YYYY-MM-DD","addressee":"","quoteId":"","lineItems":[{"vendorStyle":"","quantity":0,"unitCost":0.00,"packQty":0}]}]}\n\nRules:\n- Return one entry per Purchase Order found.\n- poNumber=Purchase Order number exactly as printed (with leading zeros, e.g. 0004314907).\n- orderDate=Create Date in YYYY-MM-DD.\n- shipDate=Vendor Ship Date (first date on the DESTINATION row) in YYYY-MM-DD.\n- cancelDate=Cancel Date (second date on the DESTINATION row, one line below ship date) in YYYY-MM-DD.\n- addressee=Destination name exactly as printed (e.g. VIDC WEST).\n- quoteId=Number from "QUOTE COPIED FROM TEMPLATE:" in Misc comments (digits only, e.g. 20135648); empty string if not found.\n- lineItems: vendorStyle=Vendor Stock number exactly as printed (e.g. DMIC100GBCA02). quantity=QUANTITY (EA.) value as integer (NOT cartons). unitCost=FIRST COST USD decimal (NOT Net First Cost). packQty=Pack #: value as integer; 1 if not found.\n- Extract ALL line items per PO.\n- ONLY JSON.`;
const VERDI_PROMPT=`Extract data from this Verdi Commerce purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"full country name e.g. United States","lineItems":[{"childSku":"","quantity":0,"unitCost":0.00}]}\n\nRules:\n- poNumber=PO # field.\n- orderDate=Date field in MM/DD/YYYY.\n- shipDate=Ship Date field in MM/DD/YYYY.\n- Ship To block: first line=shipToName (e.g. "PO 4911817-99"), second line=shipToAttention (company name, e.g. "Theisen Supply Inc"), third line=shipToAddress1 (street address). shipToAddress2="" if not present.\n- shipToCountry=full country name (United States, not US).\n- lineItems: childSku=Item column value with all spaces and line breaks removed (e.g. "DEG200GBB K01" or "DEG200GBB\\nK01" → "DEG200GBBK01"). quantity=Quantity integer. unitCost=Rate decimal.\n- Extract ALL line items.\n- ONLY JSON.`;

const PRICESMART_PROMPT=`Extract data from this PriceSmart Inc. purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YY","shipDate":"MM/DD/YY","revisedDate":"MM/DD/YY","deliveryDate":"MM/DD/YY","shipToName":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"","shipToZip":"","shipToCountry":"full country name e.g. China","memo":"","lineItems":[{"itemNo":"","vendorStyle":"","quantity":0,"unitCost":0.00}]}\n\nRules:\n- poNumber=P.O NUMBER field.\n- orderDate=ORDER DATE in MM/DD/YY.\n- shipDate=SHIP DATE or SHIP NOT BEFORE in MM/DD/YY if explicitly on PO, else "".\n- revisedDate=REVISED DATE in MM/DD/YY (used as cancel date). If absent, use SHIP NOT AFTER.\n- deliveryDate=DELIVERY DATE in MM/DD/YY if present, else "".\n- Ship To block: shipToName=first line (e.g. "APL Logistics o/b PriceSmart, Inc. 2094"). shipToAddress1=first street/building line. shipToAddress2=second address line if present (e.g. park or district). shipToState="" if not present. shipToCountry=full name (CN → China, US → United States).\n- memo=full text of the notes/remarks block (the "!! SHIP TO DC..." section), preserving newlines as \\n.\n- lineItems: itemNo=ITEM NO. column integer as string. vendorStyle=the Dash product style code in the DESCRIPTION (e.g. "DSSP50008-D" — a code like letters+numbers+optional hyphen+letter, may be on a continuation line). quantity=ORDERED integer. unitCost=UNIT COST decimal.\n- Extract ALL line items.\n- ONLY JSON.`;

const WORLD_MARKET_PROMPT=`Extract data from this Cost Plus World Market purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","cancelDate":"MM/DD/YYYY","mabd":"MM/DD/YYYY","shipToName":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"full country name e.g. United States","lineItems":[{"skuNumber":"","vendorStyle":"","quantity":0,"shipPackQty":0,"unitCost":0.00}]}\n\nRules:\n- poNumber=PURCHASE ORDER NUMBER field.\n- orderDate=CREATE DATE in MM/DD/YYYY.\n- shipDate=SHIP WINDOW START DATE in MM/DD/YYYY.\n- cancelDate=SHIP / CANCEL DATE in MM/DD/YYYY.\n- mabd=CURRENT EST. RECEIPT DATE in MM/DD/YYYY.\n- shipToName=Name on the first line of the SHIP TO block (e.g. "World Market #901 Stockton DC").\n- Address parsing: after the name line, count the lines before the CITY STATE ZIP line. If 2 lines: shipToAddress1=line1, shipToAddress2="". If 3 lines: the middle line is a park/building name followed by a street number (e.g. "SHIRLEY HOLLAND INDUSTRIAL PAR 12300") — shipToAddress1=[street number from that line] + [third line street name] (e.g. "12300 DOMINION WAY"), shipToAddress2=[park/building name only] (e.g. "SHIRLEY HOLLAND INDUSTRIAL PAR").\n- shipToCountry=full country name (US → United States).\n- lineItems: skuNumber=SKU # column. vendorStyle=VENDOR STYLE column. quantity=ORDERED QTY integer. shipPackQty=SHIP PACK QTY integer. unitCost=UNIT COST decimal (strip "$").\n- Extract ALL line items.\n- ONLY JSON.`;

const GILT_PROMPT=`Extract data from this Gilt / Rue Gilt Groupe purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","cancelDate":"MM/DD/YYYY","shipToName":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"full country name e.g. United States","lineItems":[{"vendorSku":"","rcSku":"","quantity":0,"unitCost":0.00}]}\n\nRules:\n- poNumber=PO Number from the header.\n- orderDate=Order Date in MM/DD/YYYY.\n- shipDate=Ship Date in MM/DD/YYYY.\n- cancelDate=Cancel Date in MM/DD/YYYY.\n- shipToName=Name from the Ship To block (e.g. Rue Gilt Groupe).\n- lineItems: vendorSku=Vendor SKU column value exactly as printed. rcSku=RC SKU column value with all spaces and line breaks removed (e.g. "3050013084000 0" → "30500130840000"). quantity=Qty column integer. unitCost=Cost column decimal (strip "$").\n- Extract ALL line items.\n- ONLY JSON.`;

const TJM_DC_MAP = {
  "10": { address1: "55 West Drive", city: "Brampton", state: "ON", zip: "L6T 4A1" },
  "20": { address1: "3185 American Drive", city: "Mississauga", state: "ON", zip: "L4V 1B8" },
  "25": { address1: "3185 American Drive", city: "Mississauga", state: "ON", zip: "L4V 1B8" },
  "30": { address1: "8181 Churchill Street", city: "Delta", state: "BC", zip: "V4K 0C2" },
  "35": { address1: "8181 Churchill Street", city: "Delta", state: "BC", zip: "V4K 0C2" },
  "40": { address1: "292190 Nose Creek Blvd", city: "Rocky View County", state: "AB", zip: "T4A 3N7" },
  "45": { address1: "292190 Nose Creek Blvd", city: "Rocky View County", state: "AB", zip: "T4A 3N7" },
};

const MIS_PROMPT=`Extract data from this Mark-It Smart purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","poDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","notes":"","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","lineItems":[{"sku":"","quantity":0,"unitCost":0.00}]}\n\nRules:\n- poNumber=PO # field value.\n- poDate=PO Date in MM/DD/YYYY.\n- shipDate=Ship Date Required in MM/DD/YYYY.\n- notes=complete verbatim text of the Notes section, preserving line breaks as \\n.\n- Shipping address block has: name line, optional attention/location line (before the street), street address, city/state, zip, country.\n- shipToName=first line of shipping address.\n- shipToAttention=second line if it is a name or location (not a street address); empty string if none.\n- shipToAddress1=street address line (e.g. 777 Fonner Park Rd).\n- shipToState=2-letter abbreviation. shipToCountry=2-letter ISO (US, CA, etc.).\n- lineItems: sku=the SKU code exactly as shown (e.g. DPIC100GBAQ04). quantity=integer. unitCost=unit cost as decimal.\n- Extract ALL line items.\n- ONLY JSON.`;

const TJM_CAN_PROMPT=`Extract data from this TJ Maxx Canada purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"chainName":"","poNumber":"","prefix":"","deptNo":"","dealNumber":"","orderDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY","cancelDate":"MM/DD/YYYY","lineItems":[{"vendorStyle":"","style":"","unitCost":0.00,"units":0}]}\n\nRules:\n- chainName = the large text in the top-left of page 1 (HOMESENSE, WINNERS, or MARSHALLS — exact spelling, uppercase)\n- poNumber = Import PO Number with the space replaced by a hyphen (e.g. "45 488676" → "45-488676")\n- prefix = the number before the space in Import PO Number (e.g. "45")\n- deptNo = DEPT. NO field value\n- dealNumber = DEAL # field value\n- orderDate = DEAL CREATE DATE in MM/DD/YYYY\n- shipDate = START SHIP DATE in MM/DD/YYYY\n- cancelDate = CANCEL IF NOT RECEIVED AT FREIGHT FORWARDER BY date in MM/DD/YYYY\n- lineItems: each row in the items table. vendorStyle=VENDOR STYLE column. style=STYLE column (6-digit). unitCost=UNIT COST (decimal). units=UNITS (integer).\n- Extract ALL line items.\n- ONLY JSON.`;

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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [rowOverrides, setRowOverrides] = useState([]);
  const [retailerOverrides, setRetailerOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("retailer-defaults") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const [retailer, setRetailer] = useState("");
  const [shipMethod, setShipMethod] = useState("Route");
  const [orderStatus, setOrderStatus] = useState("Pending Fulfillment");
  const [memo, setMemo] = useState("");
  const [addressBook, setAddressBook] = useState(()=>{try{const s=localStorage.getItem(AB_KEY);if(s)return JSON.parse(s).sort((a,b)=>a.name.localeCompare(b.name));}catch(_){}return DEFAULT_ADDRESS_BOOK;});
  const [addrBookSel, setAddrBookSel] = useState('');
  const [addrBookOpen, setAddrBookOpen] = useState(false);
  const addrBookRef = useRef();
  const [samplesSubcustomer, setSamplesSubcustomer] = useState("");
  const [samplesText, setSamplesText] = useState("");
  const [samplesShipDate, setSamplesShipDate] = useState("");
  const [samplesCancelDate, setSamplesCancelDate] = useState("");
  const [samplesMabd, setSamplesMabd] = useState("");
  const [groundWarnDismissedFor, setGroundWarnDismissedFor] = useState(null);
  const [gnbDate, setGnbDate] = useState(localISODate);
  const [gnbUpsAccount, setGnbUpsAccount] = useState("8V4012");
  const [gnbFedexAccount, setGnbFedexAccount] = useState("704499884");
  const [imUpdateRaw, setImUpdateRaw] = useState(null);
  const [imUpdateStatus, setImUpdateStatus] = useState('idle');
  const [imUpdateMsg, setImUpdateMsg] = useState('');
  const [imUpdateSearch, setImUpdateSearch] = useState('');
  const [imUpdateSearchQ, setImUpdateSearchQ] = useState('');
  const [imUpdateDataSource, setImUpdateDataSource] = useState('api');
  // pdfs: { id, name, base64, status: 'loading'|'queued'|'processing'|'done'|'error', rows, unmatched, error }
  const [pdfs, setPdfs] = useState([]);
  const [pdfDrag, setPdfDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [showHdrCols, setShowHdrCols] = useState(true);
  const [err, setErr] = useState("");
  const [settingsTab, setSettingsTab] = useState("main");
  const [settingsTouched, setSettingsTouched] = useState(false);
  const pdfRef = useRef();
  const imUpdateRef = useRef();


  const loadImUpdateCSV = useCallback((file)=>{
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      const parsed=parseImCsv(e.target.result);
      setImUpdateDataSource('csv');
      if(!parsed.length){setImUpdateStatus('error');setImUpdateMsg('No valid rows found in CSV');return;}
      setImUpdateRaw({count:parsed.length,items:parsed});
      setImUpdateStatus('done');
      setImUpdateMsg('');
    };
    reader.readAsText(file);
  },[]);

  const [authUser, setAuthUser] = useState(()=>import.meta.env.DEV ? true : netlifyIdentity.currentUser());
  useEffect(()=>{
    if(import.meta.env.DEV) return;
    netlifyIdentity.on('login', u=>{setAuthUser(u); netlifyIdentity.close();});
    netlifyIdentity.on('logout', ()=>setAuthUser(null));
    return()=>{netlifyIdentity.off('login');netlifyIdentity.off('logout');};
  },[]);

  const fetchImUpdate = useCallback(async()=>{
    setImUpdateStatus('loading');
    setImUpdateMsg('');
    try{
      const headers={};
      if(!import.meta.env.DEV){const token=netlifyIdentity.currentUser()?.token?.access_token;if(token)headers['Authorization']=`Bearer ${token}`;}
      const res=await fetch('/api/netsuite/itemmaster-restlet?searchId=customsearchitem_master',{headers});
      const data=await res.json();
      if(data.error){setImUpdateStatus('error');setImUpdateMsg(data.error);}
      else{setImUpdateRaw(data);setImUpdateStatus('done');setImUpdateDataSource('api');}
    }catch(e){setImUpdateStatus('error');setImUpdateMsg(e.message||'Network error');}
  },[]);

  useEffect(()=>{fetchImUpdate();},[]);

  useEffect(()=>{const t=setTimeout(()=>setImUpdateSearchQ(imUpdateSearch.trim()),200);return()=>clearTimeout(t);},[imUpdateSearch]);
  useEffect(()=>{const h=e=>{if(addrBookRef.current&&!addrBookRef.current.contains(e.target))setAddrBookOpen(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);

  const IM_COLS=['Internal ID','Type','Parent SKU','Parent SKU Description','Child SKU','SKU Sales Description','SKU Detailed Description','Unit Color Family','UPC Code','Case UPC','Pantone','Interior Color','Coating','Finish','Casepack Outer','Casepack Inner','Brand','Sub Brand','Licensed Property','Exclusive Customer','Factory Name','Capacity','Master Category','Product Type','Function','Sub Function','Range','Sub Range','Size Range','Size','Intro Year',"20' Container Loading","40' Container Loading","40'HQ Container Loading","45' Container Loading",'HTS Code','Unit Depth (in)','Unit Width (in)','Unit Height (in)','Unit Weight (lbs)','Gift Box','Gift Box Depth (in)','Gift Box Width (in)','Gift Box Height (in)','Gift Box Weight (lbs)','Remailer','Remailer Depth (in)','Remailer Width (in)','Remailer Height (in)','Remailer Weight (lbs)','Master Carton Depth (in)','Master Carton Width (in)','Master Carton Height (in)','Master Carton Weight (lbs)','Pallet Ti','Pallet Hi','Pallet Length (in)','Pallet Width (in)','Pallet Height (in)','Pallet Weight (lbs)','AB1200 Statement Required?','Certifications','SB Electric','Corded?','Cord Length (in)','Cord Color','Power Source','Indoor/Outdoor Use','Hertz','Volts','Watts','Materials','Item Includes','Number of Pieces In Box','Components','Prop 65 Warning Required?','Care Instructions','Max Temperature (F)','MOQ per Color','MOQ per Order','PTFE Like SKU','Duty Rate','Tariff Percentage','Manufacturing Country','Port of Export','WERCSmart ID','Warranty','IM Languages','GB Languages','KO Form Link','Artwork Dropbox Link','Copy Link','SEO Copy Link','A+ Copy Link','Video Dropbox Link','Approved Assets for Digital Marketing Link','Amazon ASIN','Target DPCI','Target TCIN','CDU','NGF','Inv Health','2023 Price','2024 Price','2025 Price','Notes'];

  const imSearchHits=useMemo(()=>{
    const q=imUpdateSearchQ.toLowerCase();
    if(!q||!imUpdateRaw?.items?.length)return null;
    const getVal=(row,h)=>{if(row[h]!==undefined)return String(row[h]||'');const k=Object.keys(row).find(k=>k.toLowerCase()===h.toLowerCase());return k?String(row[k]||''):'';}
    return imUpdateRaw.items.filter(r=>IM_COLS.some(h=>{const v=getVal(r,h);return v&&v.toLowerCase().includes(q);}));
  },[imUpdateSearchQ,imUpdateRaw]);

  const lookup = useCallback((items,upc,vin)=>{
    if(!items?.length) return null;
    const normVIN = String(vin||"").trim().toUpperCase();
    const normUPC = String(upc||"").replace(/\D/g,"");
    if(normVIN){
      const m=items.find(it=>String(it["Child SKU"]||"").trim().toUpperCase()===normVIN)||items.find(it=>String(it["Parent SKU"]||"").trim().toUpperCase()===normVIN);
      if(m) return m;
    }
    if(normUPC){
      const m=items.find(it=>String(it["UPC Code"]||"").replace(/\D/g,"")===normUPC);
      if(m) return m;
    }
    return null;
  },[]);

  const handleRetailer=(r)=>{if(r!==retailer){resetAll();setSamplesSubcustomer("");}setRetailer(r);setSettingsTouched(false);if(RETAILERS[r]){const saved=retailerOverrides[r];const isSamples=r==="Samples";setShipMethod(saved?.shipMethod??RETAILERS[r].shipMethod);setOrderStatus(isSamples?RETAILERS[r].status:(saved?.status??RETAILERS[r].status));setMemo(isSamples?(RETAILERS[r].defaultMemo||""):(saved?.memo!==undefined?saved.memo:(RETAILERS[r].defaultMemo||"")));}};;


  const addPDFs = (files) => {
    if (!files?.length) return;
    const fileArr = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") || f.name.toLowerCase().endsWith(".rtf"));
    if (!fileArr.length) return;
    const ts = Date.now();
    const newEntries = fileArr.map((file, idx) => ({
      id: `${ts}-${idx}`,
      name: file.name,
      base64: null,
      rtfText: null,
      status: "loading",
      rows: [],
      unmatched: [],
      error: null,
    }));
    setPdfs(prev => [...prev, ...newEntries]);
    fileArr.forEach((file, idx) => {
      const r = new FileReader();
      const id = newEntries[idx].id;
      if (file.name.toLowerCase().endsWith(".rtf")) {
        r.onload = ev => {
          setPdfs(prev => prev.map(p => p.id === id ? { ...p, rtfText: ev.target.result, status: "queued" } : p));
        };
        r.readAsText(file);
      } else {
        r.onload = ev => {
          const base64 = ev.target.result.split(",")[1];
          setPdfs(prev => prev.map(p => p.id === id ? { ...p, base64, status: "queued" } : p));
        };
        r.readAsDataURL(file);
      }
    });
  };

  const handleFiles = async (files) => {
    const fileArr = Array.from(files);
    const pdfs = fileArr.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") || f.name.toLowerCase().endsWith(".rtf"));
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

  const activeDefaults = retailer && RETAILERS[retailer] ? (() => {
    const saved=retailerOverrides[retailer]; const rc=RETAILERS[retailer];
    const isSamples=retailer==="Samples";return {shipMethod:saved?.shipMethod??rc.shipMethod, status:isSamples?rc.status:(saved?.status??rc.status), memo:isSamples?(rc.defaultMemo||""):(saved?.memo!==undefined?saved.memo:(rc.defaultMemo||""))};
  })() : null;
  const settingsChanged = !!(activeDefaults && (
    retailer === "Samples"
      ? shipMethod !== activeDefaults.shipMethod
      : (shipMethod!==activeDefaults.shipMethod||orderStatus!==activeDefaults.status||memo!==activeDefaults.memo)
  ));

  const saveRetailerDefaults = () => {
    const toSave=retailer==="Samples"?{shipMethod}:{shipMethod,status:orderStatus,memo};const updated={...retailerOverrides,[retailer]:toSave};
    setRetailerOverrides(updated);
    localStorage.setItem("retailer-defaults",JSON.stringify(updated));
  };

  const resetAll = () => {
    const saved=retailerOverrides[retailer];const rc=RETAILERS[retailer]||{};
    const defaultMemo=retailer==="Samples"?(rc.defaultMemo||""):(saved?.memo!==undefined?saved.memo:(rc.defaultMemo||""));
    setPdfs([]); setResult(null); setRows([]); setRowOverrides([]); setErr(""); setBusy(false); setBusyMsg(""); setMemo(defaultMemo); setGnbDate(localISODate()); setGnbUpsAccount("8V4012"); setGnbFedexAccount("704499884"); setSamplesSubcustomer(""); setSamplesText(""); setSamplesShipDate(""); setSamplesCancelDate(""); setSamplesMabd(""); setSettingsTouched(false); setAddrBookSel('');
    if (pdfRef.current) pdfRef.current.value = "";
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
        const yymmdd = localISODate().replace(/-/g,"").slice(2);
        const orderPONums = orders.map(order => allocSamplePO(genSamplePOBase(order.shipToAttention, order.shipToName, yymmdd)));
        orders.forEach((order, oi) => {
          const effectiveShipDate = order.shipDate || getSamplesDefaultShipDate();
          (order.lineItems || []).forEach(line => {
            const m = imUpdateRaw?.items?.length ? lookup(imUpdateRaw.items, null, line.sku) : null;
            const nsSku = m ? String(m["Child SKU"] || "").trim() : line.sku || "";
            const parentSku = m ? String(m["Parent SKU"] || "").trim() : line.sku || "";
            if (!m && line.sku) allUnmatched.push(line.sku);
            samplesRows.push({
              "Order #": "", "NS SKU": nsSku,
              "Date": isoToMDY(localISODate()),
              "Quantity": Number(line.quantity) || 1, "Item Rate": 0, "Amount": 0,
              "Is EDI Sent": rc.isEdiSent, "Is Sample": rc.isSample,
              "PO Number": orderPONums[oi],
              "NS CUSTOMER": `Samples : Samples - ${samplesSubcustomer}`,
              "Status": orderStatus,
              "Ship Date": effectiveShipDate, "Cancel Date": addBizDays(effectiveShipDate, 1), "Must Arrive By Date": order.mabd || addBizDays(effectiveShipDate, upsGroundDays(order.shipToZip, order.shipToState)),
              "Name": order.shipToName || "", "Attention": order.shipToAttention || "",
              "Address 1": order.shipToAddress1 || "", "Address 2": order.shipToAddress2 || "",
              "City": order.shipToCity || "", "State": order.shipToState || "",
              "Zip": order.shipToZip || "", "Country": order.shipToCountry || "US",
              "Ship Method": shipMethod, "Memo": order.memo || memo || "",
              "Parent SKU": parentSku,
              "_unmatched": !m && !!line.sku,
              "Item": parentSku ? `${parentSku} : ${nsSku}` : nsSku || "",
            });
          });
        });
        setRows(samplesRows);
        setResult({ totalPOs: orders.length, failedPOs: 0, allUnmatched, allCaseMismatches: [] });
        if (addrBookSel === '' && orders.length > 0) {
          const parsedName = (orders[0].shipToName || '').toLowerCase().trim();
          if (parsedName) {
            const matchIdx = addressBook.findIndex(e => {
              const en = e.name.toLowerCase();
              return parsedName.includes(en) || en.includes(parsedName);
            });
            if (matchIdx !== -1) setAddrBookSel(String(matchIdx));
          }
        }
      } catch(e) {
        setErr(friendlyError(e));
      }
      setBusy(false);
      return;
    }

    const queued = pdfs.filter(p => p.status === "queued" && (p.base64 || p.rtfText));
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
          currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "error", error: friendlyError(e) } : p);
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
        const itemMatch = imUpdateRaw?.items?.length ? lookup(imUpdateRaw.items, null, poData.sku) : null;
        const nsSku = itemMatch ? String(itemMatch["Child SKU"] || "").trim() : poData.sku || "";
        const parentSku = itemMatch ? String(itemMatch["Parent SKU"] || "").trim() : poData.sku || "";
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
            "Date": todayDate, "Quantity": qty, "Item Rate": rate, "Amount": parseFloat((qty * rate).toFixed(2)),
            "Is EDI Sent": rc.isEdiSent, "PO Number": loc.quillPoNum || "", "NS CUSTOMER": rc.nsCustomer,
            "Status": orderStatus,
            "Ship Date": shipDate, "Cancel Date": shipDate, "Must Arrive By Date": mabd,
            "Name": loc.name || "", "Attention": "", "Address 1": loc.address1 || "", "Address 2": loc.address2 || "",
            "City": loc.city || "", "State": loc.state || "", "Zip": loc.zip || "", "Country": loc.country || "US",
            "Ship Method": resolvedMethod, "Freight Account #": resolvedAccount, "SCAC": resolvedScac,
            "Memo": `Shipping instructions for Quill order: SHIP FREIGHT COLLECT (PO ${poData.poNumber})${ltlNote}`,
            "Parent SKU": parentSku, "_gnbPoNumber": String(poData.poNumber || ""), "_gnbCarrier": String(loc.shipMethod || ""),
            "_unmatched": !itemMatch,
            "Item": parentSku ? `${parentSku} : ${nsSku}` : nsSku || "",
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
        const isTjmCan = retailer === "TJ Maxx Canada";
        const isMis = retailer === "Mark-It Smart Inc.";
        const isSlt = retailer === "Sur La Table";
        const isGilt = retailer === "Gilt";
        const isWorldMarket = retailer === "Cost Plus World Market";
        const isVerdi = retailer === "Verdi Commerce LLC";
        const isPriceSmart = retailer === "PriceSmart Inc.";
        const isWalmartCan = retailer === "Walmart Canada";
        const isWalmartDi = retailer === "Walmart DI - US";
        const isWalmartCanRtf = isWalmartCan && !!pdfItem.rtfText;
        const isHomeHardware = retailer === "Home Hardware";
        const systemPrompt = isHyVee ? HY_VEE_PROMPT : isJungleJims ? JJ_PROMPT : isImperial ? IMPERIAL_PROMPT : isTjmCan ? TJM_CAN_PROMPT : isMis ? MIS_PROMPT : isSlt ? SLT_PROMPT : isGilt ? GILT_PROMPT : isWorldMarket ? WORLD_MARKET_PROMPT : isVerdi ? VERDI_PROMPT : isPriceSmart ? PRICESMART_PROMPT : isWalmartCan ? (pdfItem.rtfText ? WAL_CAN_RTF_PROMPT : WAL_CAN_PROMPT) : isWalmartDi ? WAL_DI_PROMPT : isHomeHardware ? HH_PROMPT : PROMPT;
        let resp, data;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            setBusyMsg(`Processing ${i + 1} of ${queued.length}: ${pdfItem.name} — Claude overloaded, retrying (${attempt}/2)...`);
            await new Promise(r => setTimeout(r, 3000 * attempt));
          }
          resp = await fetch("/api/anthropic/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              system: systemPrompt,
              messages: [{
                role: "user",
                content: pdfItem.rtfText
                  ? [{ type: "text", text: pdfItem.rtfText }]
                  : [
                      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfItem.base64 } },
                      { type: "text", text: "Extract the purchase order data." }
                    ]
              }]
            })
          });
          data = await resp.json();
          if (resp.status !== 529 && !String(data.error?.message || "").toLowerCase().includes("overloaded")) break;
        }
        if (!resp.ok || data.error) throw new Error(data.error?.message || `API error ${resp.status}`);
        const raw = data.content?.find(b => b.type === "text")?.text || "";
        if (!raw) throw new Error("No text in API response. Check your API key.");
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        if (parsed.memo && !memo && !isHyVee) setMemo(parsed.memo);
        const poList = (isWalmartCan || isWalmartDi) ? (parsed.orders || []) : [parsed];
        let newRows = [], unmatched = [], caseMismatches = [], casePackViolations = [];
        for (const po of poList) {

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

        let tjmShipDate = "", tjmCancelDate = "", tjmMabd = "", tjmMemo = "", tjmChainName = "", tjmDcAddress = {}, tjmDeptNo = "";
        if (isTjmCan) {
          const chainNameMap = { "HOMESENSE": "HomeSense", "WINNERS": "Winners", "MARSHALLS": "Marshalls" };
          tjmChainName = chainNameMap[(po.chainName || "").toUpperCase()] || po.chainName || "";
          tjmDeptNo = po.deptNo || "";
          tjmDcAddress = TJM_DC_MAP[String(po.prefix || "")] || {};
          tjmShipDate = fmtDate(po.shipDate);
          tjmCancelDate = fmtDate(po.cancelDate);
          tjmMabd = tjmCancelDate;
          tjmMemo = `P.O. ${po.poNumber} Dpt. ${tjmDeptNo} - Deal # ${po.dealNumber} - Carton markings must include: Purchase Order Number including Purchase Order Prefix, Ship To Address and Ship From Address, Vendor Style Number, Department Number, Origin Country`;
        }

        let sltDate = "", sltShipDate = "", sltCancelDate = "", sltMabd = "";
        if (isSlt) {
          sltDate = isoToMDY(po.orderDate);
          sltShipDate = isoToMDY(po.shipDate);
          sltCancelDate = sltShipDate ? addBizDays(sltShipDate, 5) : "";
          sltMabd = sltCancelDate;
        }

        let misDate = "", misShipDate = "", misCancelDate = "", misMabd = "", misMemo = "";
        if (isMis) {
          misDate = fmtDate(po.poDate);
          misShipDate = fmtDate(po.shipDate);
          misCancelDate = misShipDate;
          misMabd = misShipDate ? addBizDays(misShipDate, 5) : "";
          misMemo = po.notes || "";
        }

        let giltShipDate = "", giltCancelDate = "", giltMabd = "";
        if (isGilt) {
          giltShipDate = fmtDate(po.shipDate);
          giltCancelDate = fmtDate(po.cancelDate);
          giltMabd = giltShipDate ? addBizDays(giltShipDate, 10) : "";
        }

        let wmShipDate = "", wmCancelDate = "", wmMabd = "";
        if (isWorldMarket) {
          wmShipDate = fmtDate(po.shipDate);
          wmCancelDate = fmtDate(po.cancelDate);
          wmMabd = fmtDate(po.mabd);
        }

        let verdiShipDate = "", verdiCancelDate = "", verdiMabd = "";
        if (isVerdi) {
          verdiShipDate = fmtDate(po.shipDate);
          verdiCancelDate = verdiShipDate;
          verdiMabd = verdiShipDate ? addBizDays(verdiShipDate, 5) : "";
        }

        let psShipDate = "", psCancelDate = "", psMabd = "";
        if (isPriceSmart) {
          psCancelDate = fmtDate(po.revisedDate);
          psShipDate = po.shipDate ? fmtDate(po.shipDate) : (psCancelDate ? subBizDays(psCancelDate, 5) : "");
          psMabd = fmtDate(po.deliveryDate) || "";
        }

        let walCanShipDate = "", walCanCancelDate = "", walCanMabd = "";
        if (isWalmartCan) {
          walCanShipDate = isoToMDY(po.shipDate);
          walCanCancelDate = isoToMDY(po.cancelDate) || (walCanShipDate ? addDays(walCanShipDate, 7) : "");
          walCanMabd = isWalmartCanRtf ? "" : isoToMDY(po.mabd);
        }

        let hhShipDate = "", hhCancelDate = "", hhMabd = "";
        if (isHomeHardware) {
          hhShipDate = fmtDate(po.shipDate);
          hhCancelDate = hhShipDate;
          hhMabd = hhShipDate;
        }

        let walDiShipDate = "", walDiCancelDate = "", walDiMemo = "";
        if (isWalmartDi) {
          walDiShipDate = isoToMDY(po.shipDate);
          walDiCancelDate = isoToMDY(po.cancelDate);
          const inStoreFmt = po.inStoreDate ? (([y,m,d]) => `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`)(po.inStoreDate.split("-")) : "";
          walDiMemo = [
            po.eventCode ? `Event code ${po.eventCode}` : "",
            po.quoteId ? `Quote ID ${po.quoteId}` : "",
            inStoreFmt ? `In store date ${inStoreFmt}` : "",
            po.loadingPort ? `Loading port ${po.loadingPort}` : "",
          ].filter(Boolean).join(" - ");
        }

        for (const line of po.lineItems) {
          let nsSku = "", parentSku = "", qty = 0, rate = 0, rowCaseMismatch = false, rowDepartment = "", rowCustomerPartNum = "";
          const prevUnmatchedLen = unmatched.length;

          if (isHyVee) {
            const upc11 = String(line.mfgNum || "").substring(0, 6) + String(line.prodNum || "").padStart(5, "0").substring(0, 5);
            const m = imUpdateRaw?.items?.length ? imUpdateRaw.items.find(it => String(it["UPC Code"] || "").substring(0, 11) === upc11) : null;
            rowCustomerPartNum = String(line.orderCode || "");
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
              const cp = parseInt(m["Casepack Outer"]) || 1;
              const pdfMasterPack = parseInt(line.masterPack) || 0;
              rowCaseMismatch = pdfMasterPack > 0 && pdfMasterPack !== cp;
              if (rowCaseMismatch) {
                caseMismatches.push(`PO ${po.poNumber} - ${parentSku}: PDF master pack=${pdfMasterPack}, item master casepack=${cp}`);
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
            const m = imUpdateRaw?.items?.length ? imUpdateRaw.items.find(it => String(it["UPC Code"] || "").replace(/\D/g, "").substring(0, 11) === upc11) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              const label = upc11 || line.description || "";
              unmatched.push(label);
              nsSku = label;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitPrice) || 0;
            rowDepartment = String(line.department || "");
          } else if (isImperial) {
            const isMillis = String(po.shipToCity || "").toLowerCase().trim() === "millis";
            if (isMillis) {
              const rawCaseUpc = String(line.caseUpc || "").replace(/\D/g, "");
              const m = rawCaseUpc && imUpdateRaw?.items?.length ? imUpdateRaw.items.find(it => String(it["Case UPC"] || "").replace(/\D/g, "") === rawCaseUpc) : null;
              const sizeMfrNo = parseInt(line.sizeMfrNo) || 1;
              const costOfDisplay = Number(line.costOfDisplay) || 0;
              if (m) {
                nsSku = String(m["Child SKU"] || "").trim();
                parentSku = String(m["Parent SKU"] || "").trim();
                const imCasePack = parseInt(m["Casepack Outer"]) || 0;
                if (imCasePack > 0 && sizeMfrNo !== imCasePack) {
                  rowCaseMismatch = true;
                  caseMismatches.push(`PO ${po.poNumber} - ${parentSku || rawCaseUpc}: PDF case pack=${sizeMfrNo}, item master case pack=${imCasePack}`);
                }
              } else {
                unmatched.push(rawCaseUpc || line.itemNum || "");
                nsSku = rawCaseUpc;
                parentSku = rawCaseUpc;
              }
              qty = Number(line.numberOfCases) || 0;
              rate = sizeMfrNo > 0 ? parseFloat((costOfDisplay / sizeMfrNo).toFixed(4)) : 0;
              rowCustomerPartNum = String(line.itemNum || "");
            } else {
              const upc12 = String(line.gtin || "").replace(/\D/g, "").slice(-12);
              const m = imUpdateRaw?.items?.length ? lookup(imUpdateRaw.items, upc12, line.vendorSku) : null;
              if (m) {
                nsSku = String(m["Child SKU"] || "").trim();
                parentSku = String(m["Parent SKU"] || "").trim();
                const cp = parseInt(m["Casepack Outer"]) || 1;
                const pdfCsePck = parseInt(line.csePck) || 0;
                rowCaseMismatch = pdfCsePck > 0 && pdfCsePck !== cp;
                if (rowCaseMismatch) {
                  caseMismatches.push(`PO ${po.poNumber} - ${parentSku}: PDF casepack=${pdfCsePck}, item master casepack=${cp}`);
                }
              } else {
                const label = line.vendorSku || upc12 || line.description || "";
                unmatched.push(label);
                nsSku = line.vendorSku || "";
                parentSku = line.vendorSku || "";
              }
              qty = Number(line.quantity) || 0;
              rate = Number(line.unitPrice) || 0;
              rowCustomerPartNum = String(line.itemNum || "");
            }
          } else if (isTjmCan) {
            const vendorStyle = String(line.vendorStyle || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(vendorStyle || line.description || "");
              nsSku = vendorStyle;
              parentSku = "";
            }
            qty = Number(line.units) || 0;
            rate = Number(line.unitCost) || 0;
            rowCustomerPartNum = String(line.style || "");
          } else if (isSlt) {
            const style = String(line.style || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === style.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === style.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(style || "");
              nsSku = style;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
            rowCustomerPartNum = line.sku ? String(parseInt(line.sku, 10)) : "";
            const sltShipPack = Number(line.shipPackQty) || 0;
            if (sltShipPack > 0 && qty % sltShipPack !== 0) {
              casePackViolations.push(`${line.style || line.sku || "?"} — ordered ${qty}, ship pack ${sltShipPack}`);
            }
          } else if (isMis) {
            const sku = String(line.sku || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === sku.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === sku.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(sku || "");
              nsSku = sku;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
          } else if (isGilt) {
            const vendorSku = String(line.vendorSku || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === vendorSku.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === vendorSku.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(vendorSku || "");
              nsSku = vendorSku;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
            rowCustomerPartNum = String(line.rcSku || "");
          } else if (isWorldMarket) {
            const vendorStyle = String(line.vendorStyle || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(vendorStyle || "");
              nsSku = vendorStyle;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
            rowCustomerPartNum = String(line.skuNumber || "");
            const shipPackQty = Number(line.shipPackQty) || 0;
            if (shipPackQty > 0 && qty % shipPackQty !== 0) {
              casePackViolations.push(`${line.vendorStyle || line.skuNumber || "?"} — ordered ${qty}, ship pack ${shipPackQty}`);
            }
          } else if (isVerdi) {
            const childSku = String(line.childSku || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === childSku.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === childSku.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(childSku || "");
              nsSku = childSku;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
          } else if (isPriceSmart) {
            const vendorStyle = String(line.vendorStyle || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(vendorStyle || "");
              nsSku = vendorStyle;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
            rowCustomerPartNum = String(line.itemNo || "");
          } else if (isWalmartCan) {
            const vendorStyle = String(line.vendorStyle || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(vendorStyle || "");
              nsSku = vendorStyle;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
            const walCanShipPack = Number(line.shipPackQty || line.packQty) || 0;
            if (walCanShipPack > 0 && qty % walCanShipPack !== 0) {
              casePackViolations.push(`${line.vendorStyle || "?"} — ordered ${qty}, ship pack ${walCanShipPack}`);
            }
          } else if (isWalmartDi) {
            const vendorStyle = String(line.vendorStyle || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(vendorStyle || "");
              nsSku = vendorStyle;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
            const walDiPackQty = Number(line.packQty) || 0;
            if (walDiPackQty > 1 && qty % walDiPackQty !== 0) {
              casePackViolations.push(`${line.vendorStyle || "?"} — ordered ${qty}, pack size ${walDiPackQty}`);
            }
          } else if (isHomeHardware) {
            const vendorStyle = String(line.vendorStyle || "").trim();
            const m = imUpdateRaw?.items?.length ? (
              imUpdateRaw.items.find(it => String(it["Child SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase()) ||
              imUpdateRaw.items.find(it => String(it["Parent SKU"] || "").trim().toUpperCase() === vendorStyle.toUpperCase())
            ) : null;
            if (m) {
              nsSku = String(m["Child SKU"] || "").trim();
              parentSku = String(m["Parent SKU"] || "").trim();
            } else {
              unmatched.push(vendorStyle || "");
              nsSku = vendorStyle;
              parentSku = "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitCost) || 0;
          } else {
            if (imUpdateRaw?.items?.length) {
              const m = lookup(imUpdateRaw.items, line.upc, line.vendorItemNum);
              if (m) {
                nsSku = String(m["Child SKU"] || "").trim();
                parentSku = String(m["Parent SKU"] || "").trim() || line.vendorItemNum || "";
              } else {
                unmatched.push(line.vendorItemNum || line.upc || line.description);
                nsSku = line.vendorItemNum || "";
                parentSku = line.vendorItemNum || "";
              }
            } else {
              nsSku = line.vendorItemNum || "";
              parentSku = line.vendorItemNum || "";
            }
            qty = Number(line.quantity) || 0;
            rate = Number(line.unitPrice) || 0;
            rowCustomerPartNum = String(line.itemNum || "");
          }

          const rowMemo = isHomeHardware
            ? `Ship - HHOCEAN@HOMEHARDWARE.CA 5196644751\n*Note: Ship date is the date this P.O. should be shipped from your warehouse\nINVOICE MUST SHOW HOME'S ITEM# ${line.hhNbr || ""}`
            : isHyVee
            ? `PODate ${po.orderDate} RequestedShipDate ${shipDate} CancelDate ${cancelDate} MustArriveBy ${mabd}`
            : isJungleJims ? jjMemo
            : isTjmCan ? tjmMemo
            : isMis ? misMemo
            : isSlt ? rc.defaultMemo
            : isWalmartDi ? walDiMemo
            : isWalmartCan ? (isWalmartCanRtf ? (po.quoteId ? `QUOTE ID: ${po.quoteId}` : "") : (po.quoteNumber ? `QUOTE COPIED FROM TEMPLATE: ${po.quoteNumber}` : ""))
            : isPriceSmart ? (memo || po.memo || "")
            : (memo || po.memo || "");
          const sltPoNumber = isSlt && po.poNumber ? String(parseInt(po.poNumber, 10)) : null;
          const shipToName = po.shipToName || (isHyVee ? "HY-VEE, INC." : "");
          newRows.push({
            "Order #": po.poNumber, "NS SKU": nsSku, "Date": isSlt ? sltDate : isMis ? misDate : (isWalmartCan || isWalmartDi) ? isoToMDY(po.orderDate) : fmtDate(po.orderDate),
            "Quantity": qty, "Item Rate": rate, "Amount": parseFloat((qty * rate).toFixed(2)),
            "Is EDI Sent": rc.isEdiSent, "PO Number": isSlt ? sltPoNumber : po.poNumber, "NS CUSTOMER": rc.nsCustomer,
            "Status": orderStatus,
            "Ship Date": isHomeHardware ? hhShipDate : isWalmartDi ? walDiShipDate : isWalmartCan ? walCanShipDate : isPriceSmart ? psShipDate : isVerdi ? verdiShipDate : isWorldMarket ? wmShipDate : isGilt ? giltShipDate : isTjmCan ? tjmShipDate : isJungleJims ? jjShipDate : isMis ? misShipDate : isSlt ? sltShipDate : shipDate,
            "Cancel Date": isHomeHardware ? hhCancelDate : isWalmartDi ? walDiCancelDate : isWalmartCan ? walCanCancelDate : isPriceSmart ? psCancelDate : isVerdi ? verdiCancelDate : isWorldMarket ? wmCancelDate : isGilt ? giltCancelDate : isTjmCan ? tjmCancelDate : isJungleJims ? jjCancelDate : isMis ? misCancelDate : isSlt ? sltCancelDate : cancelDate,
            "Must Arrive By Date": isHomeHardware ? hhMabd : isWalmartDi ? "" : isWalmartCan ? walCanMabd : isPriceSmart ? psMabd : isVerdi ? verdiMabd : isWorldMarket ? wmMabd : isGilt ? giltMabd : isTjmCan ? tjmMabd : isJungleJims ? jjMabd : isMis ? misMabd : isSlt ? sltMabd : mabd,
            "Name": isHomeHardware ? "HOME HARDWARE STORES LTD" : (isWalmartCan || isWalmartDi) ? (po.addressee || "") : isTjmCan ? tjmChainName : shipToName,
            "Attention": isTjmCan ? "" : (po.shipToAttention || ""),
            "Address 1": isHomeHardware ? "34 Henry Street West" : isTjmCan ? (tjmDcAddress.address1 || "") : po.shipToAddress1,
            "Address 2": isTjmCan ? "" : (po.shipToAddress2 || ""),
            "City": isHomeHardware ? "St. Jacobs" : isTjmCan ? (tjmDcAddress.city || "") : po.shipToCity,
            "State": isHomeHardware ? "ON" : isTjmCan ? (tjmDcAddress.state || "") : po.shipToState,
            "Zip": isHomeHardware ? "N0B2N0" : isTjmCan ? (tjmDcAddress.zip || "") : po.shipToZip,
            "Country": isHomeHardware ? "CA" : isWalmartDi ? "US" : isWalmartCan ? "CA" : isTjmCan ? "Canada" : po.shipToCountry,
            "Location": rc.defaultLocation || "",
            "Ship Method": shipMethod, "Memo": rowMemo,
            "Customer Part Number": rowCustomerPartNum,
            "Department Number": isTjmCan ? tjmDeptNo : rowDepartment,
            "Description": line.description || "",
            "Parent SKU": parentSku,
            "Item": parentSku ? `${parentSku} : ${nsSku}` : nsSku || "",
            "_caseMismatch": rowCaseMismatch,
            "_unmatched": unmatched.length > prevUnmatchedLen,
          });
        }
        } // end for (const po of poList)

        if (caseMismatches.length > 0) newRows = newRows.map(r => ({ ...r, _poHasMismatch: true }));
        currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "done", rows: newRows, unmatched, caseMismatches, casePackViolations } : p);
        setPdfs([...currentPdfs]);
      } catch (e) {
        currentPdfs = currentPdfs.map(p => p.id === pdfItem.id ? { ...p, status: "error", error: friendlyError(e) } : p);
        setPdfs([...currentPdfs]);
      }
    }

    const allRows = currentPdfs.filter(p => p.status === "done").flatMap(p => p.rows);
    const allUnmatched = currentPdfs.filter(p => p.status === "done").flatMap(p => p.unmatched || []);
    const allCaseMismatches = currentPdfs.filter(p => p.status === "done").flatMap(p => p.caseMismatches || []);
    const allCasePackViolations = currentPdfs.filter(p => p.status === "done").flatMap(p => p.casePackViolations || []);
    const failedPOs = currentPdfs.filter(p => p.status === "error").length;
    setRows(allRows);
    setResult({ totalPOs: currentPdfs.filter(p => p.status === "done").length, failedPOs, allUnmatched, allCaseMismatches, allCasePackViolations });
    setBusy(false);
  };

  // Overlay current settings onto stored rows so changing dropdowns updates results instantly
  const rc = RETAILERS[retailer] || {};
  const isGnbRetailer = rc.type === "gnb";
  const isJungleJimsRetailer = retailer === "Jungle Jims Market Inc";
  const isImperialRetailer = retailer === "Imperial Distributors Inc.";
  const isTjmCanRetailer = retailer === "TJ Maxx Canada";
  const isMisRetailer = retailer === "Mark-It Smart Inc.";
  const isSltRetailer = retailer === "Sur La Table";
  const isGiltRetailer = retailer === "Gilt";
  const isWorldMarketRetailer = retailer === "Cost Plus World Market";
  const isSamplesRetailer = retailer === "Samples";
  const isWalmartCanRetailer = retailer === "Walmart Canada";
  const isWalmartDiRetailer = retailer === "Walmart DI - US";
  const isHomeHardwareRetailer = retailer === "Home Hardware";
  const memoIsHardcoded = !isGnbRetailer && (isJungleJimsRetailer || isTjmCanRetailer || isMisRetailer || isSltRetailer || isHomeHardwareRetailer);
  const effectiveRows = useMemo(()=>rows.map((r, idx) => ({
    ...r,
    ...(rowOverrides[idx] || {}),
    // GNB rows carry per-row ship method from distro; don't override with global selector
    "Ship Method": isGnbRetailer ? (r["Ship Method"] || "") : shipMethod,
    // GNB date and account numbers come from the inputs and update live
    ...(isGnbRetailer && gnbDate ? { "Date": isoToMDY(gnbDate) } : {}),
    ...(isGnbRetailer ? {
      "Freight Account #":
        r["_gnbCarrier"] === "Fed Ex Ground" || r["_gnbCarrier"] === "FedEx Ground" ? gnbFedexAccount :
        r["_gnbCarrier"] === "UPS Ground" ? gnbUpsAccount : r["Freight Account #"] || "",
    } : {}),
    "Status": r._poHasMismatch ? "Pending Approval" : orderStatus,
    "NS CUSTOMER": retailer === "Samples" && samplesSubcustomer ? `Samples : Samples - ${samplesSubcustomer}` : rc.nsCustomer,
    "Is EDI Sent": rc.isEdiSent,
    "Is Sample": rc.isSample,
    ...(isSamplesRetailer ? { "Item Rate": 0, "Amount": 0 } : {}),
    ...(isSamplesRetailer && samplesShipDate ? { "Ship Date": isoToMDY(samplesShipDate) } : {}),
    ...(isSamplesRetailer && samplesCancelDate ? { "Cancel Date": isoToMDY(samplesCancelDate) } : {}),
    ...(isSamplesRetailer && samplesMabd ? { "Must Arrive By Date": isoToMDY(samplesMabd) } : {}),
    // GNB and JJ memos are auto-generated per row; don't override
    ...(!isGnbRetailer && !isJungleJimsRetailer && !isTjmCanRetailer && !isMisRetailer && !isSltRetailer && !isHomeHardwareRetailer && memo ? { "Memo": memo } : {}),
    "Item": r["Parent SKU"] ? `${r["Parent SKU"]} : ${r["NS SKU"]}` : r["NS SKU"] || "",
    "Customer": retailer === "Samples" && samplesSubcustomer ? `Samples : Samples - ${samplesSubcustomer}` : rc.nsCustomer,
    "Addressee": r["Name"] || "",
    ...(isSamplesRetailer?(()=>{
      const t={"Addressee":toTitleCase(r["Name"]||""),"Attention":toTitleCase(r["Attention"]||""),"Address 1":toTitleCase(r["Address 1"]||""),"Address 2":toTitleCase(r["Address 2"]||""),"City":toTitleCase(r["City"]||""),"State":(r["State"]||"").toUpperCase(),"Zip":r["Zip"]||"","Country":r["Country"]||"US"};
      if(addrBookSel!==''){const e=addressBook[parseInt(addrBookSel)];if(e)return{"Addressee":e.name||t["Addressee"],"Attention":e.attention||t["Attention"],"Address 1":e.addr1||t["Address 1"],"Address 2":e.addr2||t["Address 2"],"City":e.city||t["City"],"State":e.state||t["State"],"Zip":e.zip||t["Zip"],"Country":e.country||t["Country"]};}
      return t;
    })():{})
  })),[rows,rowOverrides,shipMethod,gnbDate,gnbUpsAccount,gnbFedexAccount,orderStatus,retailer,samplesSubcustomer,samplesShipDate,samplesCancelDate,samplesMabd,memo,addrBookSel,addressBook]);
  const total = effectiveRows.reduce((s, r) => s + Number(r["Amount"]), 0);
  const _walCanAddrKeys = new Set(["Addressee","Address 1","City","State","Zip"]);
  const isWalmartCanRtfMode = isWalmartCanRetailer && pdfs.some(p => p.rtfText);
  const _requiredFields = (rc.defaultLocation ? [...REQUIRED_FIELDS, {label:"Location",key:"Location"}] : REQUIRED_FIELDS).filter(f => isSamplesRetailer ? f.key !== "Addressee" : true).filter(f => (isWalmartCanRetailer || isWalmartDiRetailer) ? !_walCanAddrKeys.has(f.key) : true).filter(f => (isWalmartDiRetailer || isWalmartCanRtfMode) ? f.key !== "Must Arrive By Date" : true);
  const missingFields = (result && effectiveRows.length > 0) ? _requiredFields.filter(f => effectiveRows.some(r => !hasVal(r[f.key]))) : [];
  const _groundWarning = (() => {
    if (!result || !isSamplesRetailer || !rows.length) return {active:false,key:''};
    const r0 = rows[0];
    const destState = addrBookSel!=='' ? (addressBook[parseInt(addrBookSel)]?.state||'') : (r0["State"]||'');
    if (!destState) return {active:false,key:''};
    const mabdMdy = r0["Must Arrive By Date"]||'';
    const [bm,bd,by] = mabdMdy.split('/');
    const mabdIso = by ? `${by}-${(bm||'').padStart(2,'0')}-${(bd||'').padStart(2,'0')}` : '';
    if (!mabdIso) return {active:false,key:''};
    const shipMdy = samplesShipDate ? isoToMDY(samplesShipDate) : (r0["Ship Date"]||'');
    const [sm,sd,sy] = (shipMdy||'').split('/');
    const shipIso = sy ? `${sy}-${(sm||'').padStart(2,'0')}-${(sd||'').padStart(2,'0')}` : '';
    if (!shipIso) return {active:false,key:''};
    const est = isoAddBizDays(shipIso, upsGroundDays('', destState));
    return {active:!!(est&&est>mabdIso), key:`${shipIso}|${mabdIso}|${destState}`};
  })();
  const samplesGroundWarningActive = _groundWarning.active;
  const samplesGroundWarnKey = _groundWarning.key;
  const showGroundWarnPopup = samplesGroundWarningActive && samplesGroundWarnKey !== groundWarnDismissedFor;
  const queuedCount = pdfs.filter(p => p.status === "queued").length;
  const hasPdfs = pdfs.length > 0;

  if(!authUser) return(
    <div style={{fontFamily:"var(--font-sans)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",padding:"2rem"}}>
        <h2 style={{fontSize:22,fontWeight:600,margin:"0 0 8px",color:"var(--color-text-primary)"}}>NetSuite PO Converter</h2>
        <p style={{fontSize:14,color:"var(--color-text-secondary)",margin:"0 0 24px"}}>Sign in to continue</p>
        <button
          onClick={()=>netlifyIdentity.open('login')}
          style={{padding:"9px 28px",fontSize:14,fontWeight:600,fontFamily:"var(--font-sans)",background:"var(--color-text-primary)",color:"var(--color-background-primary)",border:"none",borderRadius:6,cursor:"pointer"}}
        >Sign in</button>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"var(--font-sans)",padding:"1.75rem 0",maxWidth:680}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes im-blink{0%,100%{background:#fee2e2;color:#dc2626}50%{background:transparent;color:var(--color-text-secondary)}} .im-blink{animation:im-blink 1.4s ease-in-out infinite}`}</style>

      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"1.25rem"}}>
        <div>
          <h2 style={{fontSize:24,fontWeight:600,margin:"0 0 6px",color:"var(--color-text-primary)"}}>NetSuite PO Converter</h2>
          <p style={{fontSize:15,color:"var(--color-text-secondary)",margin:0}}>Upload retailer purchase orders and download a NetSuite-ready CSV</p>
        </div>
        {!import.meta.env.DEV&&<button onClick={()=>netlifyIdentity.logout()} style={{fontSize:12,color:"var(--color-text-tertiary)",background:"none",border:"none",cursor:"pointer",fontFamily:"var(--font-sans)",padding:"4px 0",marginTop:4,textDecoration:"underline"}}>Sign out</button>}
      </div>

      {(()=>{
        const stepIdx = result ? 3 : busy ? 2 : (pdfs.length>0||samplesText.trim()) ? 1 : 0;
        const steps = ["Configure","Upload","Processing","Review & Export"];
        return (
          <div style={{display:"flex",alignItems:"center",marginBottom:"1.25rem"}}>
            {steps.map((label,i)=>{
              const done=i<stepIdx, active=i===stepIdx;
              return (
                <Fragment key={i}>
                  {i>0&&<div style={{flex:1,height:1.5,background:done?"var(--color-text-primary)":"var(--color-border-secondary)",borderRadius:1}}/>}
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,background:done||active?"var(--color-text-primary)":"var(--color-background-secondary)",color:done||active?"#fff":"var(--color-text-tertiary)",border:`1.5px solid ${done||active?"var(--color-text-primary)":"var(--color-border-secondary)"}`}}>
                      {done?"✓":i+1}
                    </div>
                    <span style={{fontSize:11,fontWeight:active?700:400,color:active?"var(--color-text-primary)":done?"var(--color-text-secondary)":"var(--color-text-tertiary)",whiteSpace:"nowrap"}}>{label}</span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        );
      })()}

      {/* Settings tab bar */}
      <div style={{display:"flex",alignItems:"flex-end",borderBottom:"1px solid var(--color-border-secondary)",marginBottom:"0.75rem"}}>
        <button style={S.mainTabBtn(settingsTab==="main")} onClick={()=>setSettingsTab("main")}>Order Import → Export</button>
        <div style={{flex:1}}/>
        <button
          className={!imUpdateRaw?.items?.length?"im-blink":""}
          style={{...S.mainTabBtn(settingsTab==="im-update"),...(!imUpdateRaw?.items?.length?{background:undefined,color:undefined}:{})}}
          onClick={()=>setSettingsTab("im-update")}
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
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Subcustomer<span style={{color:"var(--color-text-danger)",marginLeft:2}}>*</span></label>
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
            <select style={{...S.select,padding:"7px 10px",fontSize:13,...(samplesGroundWarningActive?{animation:"blink-warn 1s ease-in-out infinite"}:{})}} value={shipMethod} onChange={e=>{setShipMethod(e.target.value);setSettingsTouched(true);}} disabled={busy}>
              <option value="">-Leave Blank-</option>
              {SHIP_METHODS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Status</label>
            <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={orderStatus} onChange={e=>{setOrderStatus(e.target.value);setSettingsTouched(true);}} disabled={busy}>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {isSamplesRetailer&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Ship Date</label>
            <input style={{...S.input,padding:"7px 10px",fontSize:13,...(samplesGroundWarningActive?{animation:"blink-warn 1s ease-in-out infinite"}:{})}} type="date" value={samplesShipDate} onChange={e=>{const v=e.target.value;setSamplesShipDate(v);if(v){setSamplesCancelDate(isoAddBizDays(v,1));setSamplesMabd(isoAddBizDays(v,5));}else{setSamplesCancelDate("");setSamplesMabd("");}}} disabled={busy}/>
          </div>
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Cancel Date</label>
            <input style={{...S.input,padding:"7px 10px",fontSize:13,...(samplesGroundWarningActive?{animation:"blink-warn 1s ease-in-out infinite"}:{})}} type="date" value={samplesCancelDate} onChange={e=>setSamplesCancelDate(e.target.value)} disabled={busy}/>
          </div>
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Must Arrive By Date</label>
            <input style={{...S.input,padding:"7px 10px",fontSize:13,...(samplesGroundWarningActive?{animation:"blink-warn 1s ease-in-out infinite"}:{})}} type="date" value={samplesMabd} onChange={e=>setSamplesMabd(e.target.value)} disabled={busy}/>
          </div>
        </div>}
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
          <>
            {isSamplesRetailer&&<div style={{marginBottom:8}} ref={addrBookRef}>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Address Book</label>
              <div style={{position:"relative"}}>
                <button type="button" disabled={busy} onClick={()=>setAddrBookOpen(o=>!o)}
                  style={{...S.select,padding:"7px 10px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:busy?"not-allowed":"pointer",textAlign:"left"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                    {addrBookSel!==''?addressBook[parseInt(addrBookSel)]?.name||'— Select address —':'— Select address —'}
                  </span>
                  <span style={{marginLeft:6,flexShrink:0,fontSize:10,opacity:0.5}}>{addrBookOpen?'▴':'▾'}</span>
                </button>
                {addrBookOpen&&<div style={{position:"absolute",top:"calc(100% + 2px)",left:0,right:0,zIndex:200,background:"var(--color-background-primary)",border:"1px solid var(--color-border-secondary)",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",overflow:"hidden"}}>
                  <div style={{padding:"7px 10px",fontSize:13,cursor:"pointer",color:"var(--color-text-tertiary)"}} onClick={()=>{setAddrBookSel('');setAddrBookOpen(false);}}>— Select address —</div>
                  {addressBook.map((e,i)=>(
                    <div key={i} onClick={()=>{setAddrBookSel(String(i));setAddrBookOpen(false);}}
                      style={{padding:"7px 10px",cursor:"pointer",borderTop:"1px solid var(--color-border-tertiary)",background:addrBookSel===String(i)?"var(--color-background-secondary)":"transparent"}}
                      onMouseEnter={ev=>ev.currentTarget.style.background="var(--color-background-secondary)"}
                      onMouseLeave={ev=>ev.currentTarget.style.background=addrBookSel===String(i)?"var(--color-background-secondary)":"transparent"}>
                      <div style={{fontSize:13,color:"var(--color-text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
                      <div style={{fontSize:11,color:"var(--color-text-tertiary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:1}}>
                        {[e.addr1,e.addr2,e.city,[e.state,e.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
            </div>}
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Memo</label>
              <input style={{...S.input,padding:"7px 10px",fontSize:13}} type="text" placeholder="e.g. Spring 2026 Drop" value={memo} onChange={e=>{setMemo(e.target.value);setSettingsTouched(true);}} disabled={busy}/>
            </div>
          </>
        )}
        {settingsTouched&&settingsChanged&&!(memoIsHardcoded&&shipMethod===activeDefaults?.shipMethod&&orderStatus===activeDefaults?.status)&&(
          <p style={{marginTop:8,fontSize:12,color:"var(--color-text-tertiary)"}}>
            Changes will apply to this extraction.{" "}
            <span onClick={saveRetailerDefaults} style={{color:"var(--color-text-secondary)",textDecoration:"underline",cursor:"pointer"}}>Click here</span>
            {" "}to override defaults for future extractions.
          </p>
        )}
        {memoIsHardcoded&&memo!==activeDefaults?.memo&&(
          <p style={{marginTop:settingsChanged?4:8,fontSize:12,color:"var(--color-text-tertiary)"}}>
            Memo cannot be changed due to hard-coded logic in place. Request this change with the admin or manually update within the order preview below or on the CSV file.
          </p>
        )}
      </div>}

      {/* Item Master — status */}
      {settingsTab==="im-update"&&<div style={{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem"}}>
        <span style={{...S.sectionLabel,display:"block",marginBottom:8}}>Item Master Results</span>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          {imUpdateStatus==='done'&&imUpdateRaw?(()=>{
            const find=(row,...labels)=>{for(const l of labels){const k=Object.keys(row).find(k=>k.toLowerCase()===l.toLowerCase());if(k&&row[k])return row[k];}return '';};
            const matched=imUpdateRaw.items.filter(r=>find(r,'child sku')).length;
            return(
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                <span style={{fontSize:13,color:"var(--color-text-success)",fontWeight:500}}>{imUpdateDataSource==='csv'?'CSV':' NetSuite'} · {matched} items</span>
                <span style={{fontSize:12,color:"var(--color-text-secondary)",textAlign:"left"}}>
                  {imUpdateDataSource==='csv'?(
                    <>
                      Fetched from manually uploaded CSV.<br/>
                      <span style={{cursor:"pointer",color:"var(--color-text-secondary)",fontWeight:500,textDecoration:"underline"}} onClick={fetchImUpdate}>Fetch from API</span>
                      {" "}or{" "}
                      <a href="https://4848284.app.netsuite.com/app/common/search/searchresults.nl?searchid=75078&whence=" target="_blank" rel="noreferrer" style={{color:"var(--color-text-secondary)",fontWeight:500}}>download</a>
                      {" "}/{" "}
                      <span style={{cursor:"pointer",color:"var(--color-text-secondary)",fontWeight:500,textDecoration:"underline"}} onClick={()=>imUpdateRef.current?.click()}>upload</span>{" updated CSV"}
                    </>
                  ):(
                    <>
                      Fetched from customsearchitem_master via API.{" "}
                      <span style={{cursor:"pointer",color:"var(--color-text-secondary)",fontWeight:500,textDecoration:"underline"}} onClick={fetchImUpdate}>Refresh</span><br/>
                      <br/>
                      <span style={{color:"var(--color-text-tertiary)"}}>
                        Only{" "}
                        <a href="https://4848284.app.netsuite.com/app/common/search/searchresults.nl?searchid=75078&whence=" target="_blank" rel="noreferrer" style={{color:"var(--color-text-secondary)",fontWeight:500}}>download</a> the saved search
                        {" "}as a CSV and{" "}
                        <span style={{cursor:"pointer",color:"var(--color-text-secondary)",fontWeight:500,textDecoration:"underline"}} onClick={()=>imUpdateRef.current?.click()}>upload here</span>
                        {" "}as a failsafe if the API is unavailable
                      </span>
                    </>
                  )}
                </span>
              </div>
            );
          })():imUpdateStatus==='error'?(
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,color:"var(--color-text-danger)",fontWeight:500}}>{imUpdateMsg}</span>
              <button style={S.btnReplace} onClick={fetchImUpdate}>Try again</button>
            </div>
          ):(
            <button
              style={{...S.btnReplace,...(imUpdateStatus==='loading'?{opacity:0.6,cursor:'not-allowed'}:{})}}
              onClick={fetchImUpdate}
              disabled={imUpdateStatus==='loading'}
            >{imUpdateStatus==='loading'?'Fetching…':'Fetch from API'}</button>
          )}
        </div>
        <input ref={imUpdateRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>{loadImUpdateCSV(e.target.files[0]);e.target.value='';}} />
      </div>}

      {/* Item Master — search */}
      {settingsTab==="im-update"&&imUpdateStatus==='done'&&imUpdateRaw&&<div style={{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem"}}>
        <span style={{...S.sectionLabel,display:"block",marginBottom:8}}>Search item master</span>
        <input
          style={{...S.input,padding:"7px 10px",fontSize:13,width:"100%",boxSizing:"border-box"}}
          type="text"
          placeholder="Search by SKU, UPC, Name…"
          value={imUpdateSearch}
          onChange={e=>setImUpdateSearch(e.target.value)}
        />
        {imSearchHits!==null&&(imSearchHits.length===0
          ?<p style={{fontSize:13,color:"var(--color-text-secondary)",marginTop:8,marginBottom:0}}>No matches found.</p>
          :(()=>{
            const getVal=(row,h)=>{if(row[h]!==undefined)return String(row[h]||'');const k=Object.keys(row).find(k=>k.toLowerCase()===h.toLowerCase());return k?String(row[k]||''):'';}
            return(
              <div style={{overflow:"auto",maxHeight:400,marginTop:8,border:"1px solid var(--color-border-tertiary)",borderRadius:6}}>
                <table style={{borderCollapse:"collapse",fontSize:12,width:"max-content",minWidth:"100%"}}>
                  <thead style={{position:"sticky",top:0,zIndex:1}}>
                    <tr>{IM_COLS.map(h=><th key={h} style={{padding:"4px 8px",background:"var(--color-background-secondary)",borderBottom:"1px solid var(--color-border-tertiary)",borderRight:"1px solid var(--color-border-tertiary)",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {imSearchHits.map((row,i)=>(
                      <tr key={i} style={{background:i%2===0?"":"var(--color-background-secondary)"}}>
                        {IM_COLS.map(h=>{const v=getVal(row,h);const isUrl=v.startsWith('http://')||v.startsWith('https://');return<td key={h} style={{padding:"3px 8px",borderBottom:"1px solid var(--color-border-tertiary)",borderRight:"1px solid var(--color-border-tertiary)",whiteSpace:"nowrap"}}>{isUrl?<a href={v} target="_blank" rel="noreferrer" style={{color:"var(--color-text-secondary)",fontWeight:500}}>Link</a>:v}</td>;})}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </div>}

      {/* Samples text card */}
      {settingsTab==="main"&&retailer==="Samples"&&<div style={S.card}>
        <span style={S.sectionLabel}><i className="ti ti-message-2" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Sample request</span>
        <textarea
          style={{...S.input,padding:"9px 12px",fontSize:13,minHeight:200,resize:"vertical",lineHeight:1.55,display:"block"}}
          placeholder={"Paste Slack request here....\n\n3x DRG41401\n2x DSSP50005\n\nStoreBound HQ\n\nATTN: John Doe"}
          value={samplesText}
          onChange={e=>setSamplesText(e.target.value)}
          disabled={busy}
        />
        {result&&rows.length>0&&rows[0]["Name"]&&<button
          style={{...S.btnReplace,marginTop:8}}
          onClick={()=>{
            const r0=rows[0];
            const entry={name:r0["Name"]||"",attention:r0["Attention"]||"",addr1:r0["Address 1"]||"",addr2:r0["Address 2"]||"",city:r0["City"]||"",state:r0["State"]||"",zip:r0["Zip"]||"",country:r0["Country"]||"US"};
            const updated=[...addressBook,entry].sort((a,b)=>a.name.localeCompare(b.name));
            setAddressBook(updated);
            localStorage.setItem(AB_KEY,JSON.stringify(updated));
          }}
        >Add to Address Book</button>}
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
          <span style={S.sectionLabel}><i className="ti ti-file-type-pdf" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>{isWalmartDiRetailer?"Purchase Order RTFs":"Purchase order PDFs"}</span>
          <div
            style={{...S.dzBase,...(pdfDrag?S.dzHover:{})}}
            onClick={()=>pdfRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setPdfDrag(true);}}
            onDragLeave={()=>setPdfDrag(false)}
            onDrop={e=>{e.preventDefault();setPdfDrag(false);handleFiles(e.dataTransfer.files);}}>
            <i className="ti ti-file-type-pdf" aria-hidden="true" style={{fontSize:36,color:"var(--color-text-secondary)",display:"block",marginBottom:10}}/>
            {isWalmartDiRetailer
              ? <>
                  <p style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",margin:0}}>Click or drag to upload .rtf file(s)</p>
                  <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"6px 0 0",lineHeight:1.5}}>Navigate to Retail Link &gt; Apps &gt; Import PO Delivery &gt; type in PO #(s) &gt; Add to List &gt; Retrieve Prints &gt; save .rtf file and upload here. You may upload one .rtf with multiple POs.</p>
                </>
              : isWalmartCanRetailer
              ? <>
                  <p style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",margin:0}}>Upload PDF from SPS Commerce or .rtf from Retail Link</p>
                  <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"6px 0 0",lineHeight:1.6}}>
                    <br/>
                    <strong>SPS Commerce:</strong> Log in &gt; Fulfillment &gt; Transactions &gt; check off one or multiple orders &gt; click the three dots on the bottom &gt; Print and save as PDF.<br/><br/>
                    <strong>Retail Link:</strong> Navigate to Retail Link &gt; Apps &gt; Import PO Delivery &gt; select WAL-MART CANADA CORP. for the 2nd criteria &gt; type in PO #(s) &gt; Add to List &gt; Retrieve Prints &gt; save .rtf file and upload here.
                  </p>
                </>
              : <>
                  <p style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",margin:0}}>{isGnbRetailer?"Click or drag to upload GNB blanket PO + distro sheet":"Click or drag to upload PO PDFs"}</p>
                  <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"6px 0 0"}}>{isGnbRetailer?"Drop both PDFs together — the app will detect which is which":"Select multiple files at once · ZIP supported · any retailer format"}</p>
                </>
            }
          </div>
          {import.meta.env.DEV&&<button onClick={loadTestPDFs} style={{marginTop:8,fontSize:12,padding:"5px 12px",fontFamily:"var(--font-sans)",border:"1px dashed var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-tertiary)",cursor:"pointer"}}>⚙ Load test PDFs</button>}
          </>
        ) : (
          <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)"}}>{isWalmartDiRetailer?"Purchase Order RTFs":"Purchase order PDFs"}</span>
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
        <input ref={pdfRef} type="file" accept="application/pdf,.zip,.rtf" multiple style={{display:"none"}} onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:"1rem"}}>
          <div style={S.stat}><div style={S.statLabel}>Unmatched SKUs</div><div style={{...S.statVal,color:result.allUnmatched.length?"var(--color-text-warning)":undefined}}>{result.allUnmatched.length||"None"}</div></div>
          <div style={S.stat}><div style={S.statLabel}>POs</div><div style={S.statVal}>{result.totalPOs}</div></div>
          <div style={S.stat}><div style={S.statLabel}>Lines</div><div style={S.statVal}>{effectiveRows.length}</div></div>
          <div style={S.stat}><div style={S.statLabel}>Total Units</div><div style={S.statVal}>{effectiveRows.reduce((s,r)=>s+(Number(r["Quantity"])||0),0).toLocaleString("en-US")}</div></div>
          <div style={S.stat}><div style={S.statLabel}>Total</div><div style={S.statVal}>${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        </div>

        {result.skuMismatch&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>SKU Mismatch:</strong> PO SKU ({result.skuMismatch.poSku}) does not match distro sheet Item # ({result.skuMismatch.distroItemNum}). Verify before importing.</span></div>}
        {result.allUnmatched?.length>0&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>Unmatched:</strong> {result.allUnmatched.join(", ")} — vendor item # used as fallback</span></div>}
        {result.allCasePackViolations?.length>0&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>Case Pack Violation:</strong> {result.allCasePackViolations.join("; ")} — ordered qty is not a multiple of ship pack qty</span></div>}
        {result.allCaseMismatches?.length>0&&<div style={S.msgWarn}><span><strong>⚠️ {result.allCaseMismatches.length>1?"Case Pack Mismatch Warnings":"Case Pack Mismatch Warning"}</strong><br/>{result.allCaseMismatches.map((m,i)=><span key={i}>{m}.<br/></span>)}<br/>{result.allCaseMismatches.length>1?"Contact buyer to get the POs revised to full case packs. The POs have been updated to Pending Approval pending the buyer's change.":"Contact buyer to get the PO revised to full case packs. The PO has been updated to Pending Approval pending the buyer's change."}</span></div>}
        {missingFields.length>0&&<div style={S.msgWarn}><span><strong>⚠️ {missingFields.length>1?"Missing Required Fields":"Missing Required Field"}</strong><br/>{missingFields.map((f,i)=><span key={i}>{f.label} is missing. Field is required to successfully import.<br/></span>)}</span></div>}
        {isSamplesRetailer&&result&&effectiveRows.some(r=>!hasVal(r["Addressee"])&&!hasVal(r["Attention"]))&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>Missing Addressee / Attention</strong><br/>One or more orders has neither Addressee nor Attention set.</span></div>}
        {result.failedPOs>0&&<div style={S.msgErr}><i className="ti ti-alert-circle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>{result.failedPOs} PDF{result.failedPOs>1?"s":""} failed — see file list above for details</div>}
        {effectiveRows.some(r=>{const c=(r["Country"]||"").trim().toUpperCase();return c&&!["US","USA","UNITED STATES","UNITED STATES OF AMERICA","U.S.","U.S.A."].includes(c);})&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>Reminder:</strong> Commercial Invoice is needed to ship this package to clear customs.</span></div>}


        <div style={{...S.card,marginTop:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)"}}>Purchase Order CSV Export Preview</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>Header</span>
              <div onClick={()=>setShowHdrCols(v=>!v)} style={{width:32,height:18,borderRadius:9,background:showHdrCols?"#16a34a":"var(--color-border-secondary)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                <div style={{width:14,height:14,borderRadius:"50%",background:"white",position:"absolute",top:2,left:showHdrCols?16:2,transition:"left 0.15s",boxShadow:"0 1px 2px rgba(0,0,0,0.25)"}}/>
              </div>
            </div>
          </div>
          {(()=>{
            const _hideCols=new Set(rc.hideCols||[]);
            const _extraItemCols=(rc.showCols||{})["Items"]||[];
            const _alwaysShowCols=isSamplesRetailer?SAMPLES_ADDR_COLS:new Set();
            const _allHeaderCols=(TABS_PREVIEW.find(t=>t.label==="Header")?.cols||[]).filter(h=>!_hideCols.has(h)).filter(h=>_alwaysShowCols.has(h)||effectiveRows.some(r=>hasVal(r[h])));
            const headerCols=showHdrCols?_allHeaderCols:_allHeaderCols.filter(h=>h==="PO Number");
            const itemCols=[...new Set([...(TABS_PREVIEW.find(t=>t.label==="Items")?.cols||[]),..._extraItemCols])].filter(h=>!_hideCols.has(h)).filter(h=>effectiveRows.some(r=>hasVal(r[h])));
            const allCols=[...headerCols,...itemCols];
            const divider=showHdrCols&&itemCols[0];
            const _warnCols=samplesGroundWarningActive?new Set(["Ship Method","Ship Date","Cancel Date","Must Arrive By Date"]):new Set();
            return (
          <div style={{overflowX:"auto",overflowY:"auto",maxHeight:460,border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}}>
            <table style={{width:"max-content",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#BEBEBE"}}>
                  <th style={{...S.th,width:40,minWidth:40,position:"sticky",top:0,left:0,background:"#BEBEBE",zIndex:3}}>#</th>
                  {allCols.map(h=>(
                    <th key={h} style={{...S.th,position:"sticky",top:0,background:_warnCols.has(h)?"#fecaca":"#BEBEBE",zIndex:2,...(h===divider?{borderLeft:"1.5px solid var(--color-border-secondary)"}:{})}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {effectiveRows.map((row,i)=>(
                  <tr key={i} style={row._unmatched?{background:"rgba(251,146,60,0.1)"}:{}}>
                    <td style={{...S.td,borderBottom:i<effectiveRows.length-1?"0.5px solid var(--color-border-tertiary)":"none",position:"sticky",left:0,background:row._unmatched?"rgba(251,146,60,0.1)":"var(--color-background-primary)",zIndex:1,textAlign:"center",color:"var(--color-text-tertiary)",fontSize:11,width:40,minWidth:40}}>{i+1}</td>
                    {allCols.map(h=>(
                      <td key={h} style={{...S.td,borderBottom:i<effectiveRows.length-1?"0.5px solid var(--color-border-tertiary)":"none",padding:0,position:"relative",...(h===divider?{borderLeft:"1.5px solid var(--color-border-secondary)"}:{}),...(_warnCols.has(h)?{background:"rgba(239,68,68,0.08)"}:{})}}>
                        <div aria-hidden="true" style={{visibility:"hidden",padding:"5px 9px",fontSize:13,fontFamily:"var(--font-sans)",whiteSpace:"nowrap",lineHeight:"normal",userSelect:"none",...(h==="Memo"?{maxWidth:"230px",overflow:"hidden"}:{})}}>{String(row[h]??'')||' '}</div>
                        <input
                          value={row[h]??''}
                          onChange={e=>{const v=e.target.value;setRowOverrides(prev=>{const next=[...prev];const updated={...(next[i]||{}),[h]:v};if(h==="Quantity"||h==="Item Rate"){const qty=parseFloat(h==="Quantity"?v:row["Quantity"])||0;const rate=parseFloat(h==="Item Rate"?v:row["Item Rate"])||0;updated["Amount"]=parseFloat((qty*rate).toFixed(2));}next[i]=updated;return next;});}}
                          style={{position:"absolute",top:0,left:0,right:0,bottom:0,width:"100%",boxSizing:"border-box",padding:"5px 8px",fontSize:13,fontFamily:"var(--font-sans)",border:"1px solid transparent",borderRadius:4,background:"transparent",color:row._caseMismatch?"#ef4444":"var(--color-text-primary)",outline:"none",cursor:"text"}}
                          onFocus={e=>e.target.style.borderColor="var(--color-border-info)"}
                          onBlur={e=>e.target.style.borderColor="transparent"}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            );
          })()}
        </div>

        {(() => {
          const sageBtn = {display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"#154406",color:"#fff",cursor:"pointer",textDecoration:"none"};
          const cardStyle = {padding:"16px",background:"var(--color-background-secondary)",border:"1px solid var(--color-border-secondary)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",gap:10};
          const titleStyle = {fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--color-text-secondary)"};
          return (
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              {effectiveRows.some(r=>r["Customer Part Number"])&&(
                <div style={cardStyle}>
                  <span style={titleStyle}>Customer Part Numbers</span>
                  <div style={{display:"flex",gap:6}}>
                    <button style={sageBtn} onClick={()=>dlCSV(buildCpnCSV(effectiveRows),"Export Customer Part Numbers.csv")}><i className="ti ti-download" aria-hidden="true" style={{fontSize:15}}/>Download CSV</button>
                    <a href={import.meta.env.DEV?"https://4848284-sb1.app.netsuite.com/app/setup/assistants/nsimport/importassistant.nl?recid=211&new=T":"https://4848284.app.netsuite.com/app/setup/assistants/nsimport/importassistant.nl?recid=215&new=T"} target="_blank" rel="noreferrer" style={sageBtn}><i className="ti ti-upload" aria-hidden="true" style={{fontSize:15}}/>Import CSV</a>
                  </div>
                </div>
              )}
              <div style={cardStyle}>
                <span style={titleStyle}>Purchase Orders</span>
                <div style={{display:"flex",gap:6}}>
                  <button style={sageBtn} onClick={()=>dlCSV(isSamplesRetailer?buildSamplesCSV(effectiveRows):isGnbRetailer?buildGnbCSV(effectiveRows):isJungleJimsRetailer?buildJjCSV(effectiveRows):isImperialRetailer?buildImperialCSV(effectiveRows):isTjmCanRetailer?buildTjmCanCSV(effectiveRows):isWalmartCanRetailer?buildWalmartCanCSV(effectiveRows):isWalmartDiRetailer?buildWalmartDiCSV(effectiveRows):isHomeHardwareRetailer?buildHhCSV(effectiveRows):buildCSV(effectiveRows),`${retailer.replace(/[^a-zA-Z0-9\s]/g,"").replace(/\s+/g,"_")}_PO_${localISODate()}.csv`)}><i className="ti ti-download" aria-hidden="true" style={{fontSize:15}}/>Download CSV</button>
                  <a href={import.meta.env.DEV?"https://4848284-sb1.app.netsuite.com/app/setup/assistants/nsimport/importassistant.nl?recid=210&new=T":"https://4848284.app.netsuite.com/app/setup/assistants/nsimport/importassistant.nl?recid=206&new=T"} target="_blank" rel="noreferrer" style={sageBtn}><i className="ti ti-upload" aria-hidden="true" style={{fontSize:15}}/>Import CSV</a>
                </div>
              </div>
            </div>
          );
        })()}
        <div style={{display:"flex",justifyContent:"center",marginTop:10}}>
          <button style={S.btnOutline} onClick={resetAll}><i className="ti ti-refresh" aria-hidden="true" style={{fontSize:15}}/>Clear All Fields</button>
        </div>
      </>)}
      </>}
      {showGroundWarnPopup&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setGroundWarnDismissedFor(samplesGroundWarnKey)}>
        <div style={{background:"var(--color-background-primary)",borderRadius:12,padding:"1.75rem 1.5rem",maxWidth:380,margin:"0 1rem",boxShadow:"0 8px 32px rgba(0,0,0,0.22)",border:"1px solid var(--color-border-secondary)"}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:28,marginBottom:10,textAlign:"center"}}>⚠️</div>
          <p style={{fontWeight:700,fontSize:15,marginBottom:8,color:"var(--color-text-primary)",textAlign:"center"}}>UPS Ground won't arrive in time</p>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16,textAlign:"center",lineHeight:1.5}}>Package won't arrive in time if shipping Ground. Please consult with your team to get this expedited for on-time arrival.</p>
          <button onClick={()=>setGroundWarnDismissedFor(samplesGroundWarnKey)} style={S.btnPrimary}>OK, I'll check with my team</button>
        </div>
      </div>}
      <button
        onClick={() => setDarkMode(d => !d)}
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        style={{position:"fixed",bottom:20,right:20,width:40,height:40,borderRadius:"50%",border:"1px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",zIndex:9999}}
      >
        {darkMode ? "☀" : "☽"}
      </button>
    </div>
  );
}
