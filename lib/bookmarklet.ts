/** localStorage key used to hand a parsed thread into the import modal. */
export const CHATSHARE_PENDING_IMPORT_KEY = "chatshare_pending_import";

/** Hash key used by the bookmarklet to pass data cross-origin into ChatShare. */
export const CHATSHARE_PENDING_HASH_KEY = "chatshare_pending";

/**
 * Build a drag-to-bookmarks JavaScript bookmarklet for the given app origin.
 * Uses the live site origin so the same button works in production and localhost.
 *
 * Site-specific extraction:
 * - chat.deepseek.com → User:/DeepSeek: from .ds-message / .ds-markdown
 * - claude.ai → User:/Claude: from full turn wrappers
 * - gemini.google.com → User:/Gemini: from user-query / model-response
 * Falls back to document.body.innerText when structured nodes aren't found.
 */
export function buildImportBookmarklet(appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  const storageKey = CHATSHARE_PENDING_IMPORT_KEY;
  const hashKey = CHATSHARE_PENDING_HASH_KEY;

  // Compact, ES5-friendly payload (bookmarklet URL length limits).
  const code = `(function(){
var O=${JSON.stringify(origin)};
function host(){return(location.hostname||"").toLowerCase();}
function outermost(list){
var arr=[],i,j;
for(i=0;i<list.length;i++)arr.push(list[i]);
return arr.filter(function(el){
for(j=0;j<arr.length;j++){
if(arr[j]!==el&&arr[j].contains&&arr[j].contains(el))return false;
}
return true;
});
}
function deepSeekText(){
var h=host();
if(h!=="chat.deepseek.com"&&h!=="www.chat.deepseek.com")return null;
var nodes=document.querySelectorAll(".ds-message");
if(!nodes.length)nodes=document.querySelectorAll("[class*='ds-message'],.ds-chat-message");
if(!nodes.length)return null;
var parts=[],i,n,think,thinkTxt,mds,main,j,md,txt,block,inThink;
for(i=0;i<nodes.length;i++){
n=nodes[i];
mds=n.querySelectorAll(".ds-markdown");
main=null;
for(j=0;j<mds.length;j++){
md=mds[j];
inThink=md.closest&&md.closest(".ds-think-content");
if(!inThink){main=md;break;}
}
think=n.querySelector(".ds-think-content");
thinkTxt=think&&(think.innerText||"").trim()||"";
if(main||thinkTxt){
block="";
if(thinkTxt)block+="Thought process:\\n"+thinkTxt+"\\n\\n";
if(main){txt=(main.innerText||"").trim();if(txt)block+=txt;}
if(block)parts.push("DeepSeek:\\n"+block);
}else{
txt=(n.innerText||"").trim();
if(txt)parts.push("User:\\n"+txt);
}
}
return parts.length?parts.join("\\n\\n"):null;
}
function claudeText(){
var h=host();
if(h!=="claude.ai"&&h!=="www.claude.ai"&&h.slice(-10)!==".claude.ai")return null;
function cleanText(el){
if(!el)return"";
var raw=(el.innerText||"").replace(/\\u00a0/g," ").trim();
if(!raw)return"";
raw=raw.replace(/^(Copy|Edit|Retry|Share|Good response|Bad response|Regenerate)\\s*/gim,"");
raw=raw.replace(/\\n(?:Copy|Edit|Retry|Share|Good response|Bad response|Regenerate)\\s*$/gim,"");
raw=raw.replace(/^(Thought|Thinking|View)[^\\n]*\\n+/i,"");
return raw.trim();
}
var userSel=['[data-testid="user-message"]','[data-testid="human-message"]','[data-testid="message-human"]','[class*="font-user-message"]'].join(",");
var asstSel=['[data-testid="ai-message"]','[data-testid="assistant-message"]','[data-testid="message-assistant"]',".font-claude-response","[class*='font-claude-response']"].join(",");
var users=outermost(document.querySelectorAll(userSel));
var assts=outermost(document.querySelectorAll(asstSel));
if(!users.length&&!assts.length){
users=outermost(document.querySelectorAll(".font-user-message,[class*='font-user-message']"));
assts=outermost(document.querySelectorAll(".font-claude-message,[class*='font-claude-message']"));
}
if(!users.length&&!assts.length)return null;
var turns=[],i,n,txt;
for(i=0;i<users.length;i++){
n=users[i];
txt=cleanText(n);
if(txt)turns.push({el:n,role:"user",txt:txt});
}
for(i=0;i<assts.length;i++){
n=assts[i];
if(users.some(function(u){return u.contains&&u.contains(n);}))continue;
txt=cleanText(n);
if(txt)turns.push({el:n,role:"assistant",txt:txt});
}
turns.sort(function(a,b){
if(a.el===b.el)return 0;
var p=a.el.compareDocumentPosition(b.el);
if(p&Node.DOCUMENT_POSITION_FOLLOWING)return -1;
if(p&Node.DOCUMENT_POSITION_PRECEDING)return 1;
return 0;
});
var parts=[],prev="";
for(i=0;i<turns.length;i++){
var key=turns[i].role+"|"+turns[i].txt;
if(key===prev)continue;
prev=key;
parts.push((turns[i].role==="user"?"User:\\n":"Claude:\\n")+turns[i].txt);
}
return parts.length?parts.join("\\n\\n"):null;
}
function geminiText(){
var h=host();
if(h!=="gemini.google.com"&&h!=="www.gemini.google.com")return null;
function cleanGemini(el,role){
if(!el)return"";
// Prefer full model-response / user-query container so multi-paragraph markdown stays one turn.
var target=el;
if(role==="assistant"){
var panel=el.querySelector&&(
el.querySelector(".markdown-main-panel")||
el.querySelector(".model-response-text")||
el.querySelector("[class*='markdown']")
);
// Still read from the outer model-response so sibling blocks stay merged.
target=el;
}
var raw=(target.innerText||"").replace(/\\u00a0/g," ").trim();
if(!raw)return"";
// Strip Gemini UI chrome / regenerate affordances.
raw=raw.replace(/^(Show thinking|Thoughts|Double-check response|Listen|Edit|Share|Export|More|Thumb up|Thumb down|Regenerate|Copy)\\s*/gim,"");
raw=raw.replace(/\\n(?:Show thinking|Double-check response|Listen|Edit|Share|Export|More|Thumb up|Thumb down|Regenerate|Copy|Google it)\\s*$/gim,"");
return raw.trim();
}
// Full turn containers (custom elements + test ids). Not nested p/span fragments.
var userSel=[
"user-query",
'[data-test-id="user-query"]',
'[data-testid="user-query"]',
".user-query",
".query-content",
"[class*='user-query']"
].join(",");
var asstSel=[
"model-response",
'[data-test-id="model-response"]',
'[data-testid="model-response"]',
".model-response",
".response-container",
"[class*='model-response']"
].join(",");
var users=outermost(document.querySelectorAll(userSel));
var assts=outermost(document.querySelectorAll(asstSel));
// Fallback: markdown panels only if no model-response wrappers found.
if(!assts.length){
assts=outermost(document.querySelectorAll(".markdown-main-panel,message-content,.response-content"));
}
if(!users.length&&!assts.length)return null;
var turns=[],i,n,txt;
for(i=0;i<users.length;i++){
n=users[i];
// Prefer .query-content inside user-query when present, still one label.
var q=n.querySelector&&n.querySelector(".query-content");
txt=cleanGemini(q||n,"user");
if(txt)turns.push({el:n,role:"user",txt:txt});
}
for(i=0;i<assts.length;i++){
n=assts[i];
if(users.some(function(u){return u.contains&&u.contains(n);}))continue;
// Skip nested response panels contained by another model-response already listed.
txt=cleanGemini(n,"assistant");
if(txt)turns.push({el:n,role:"assistant",txt:txt});
}
turns.sort(function(a,b){
if(a.el===b.el)return 0;
var p=a.el.compareDocumentPosition(b.el);
if(p&Node.DOCUMENT_POSITION_FOLLOWING)return -1;
if(p&Node.DOCUMENT_POSITION_PRECEDING)return 1;
return 0;
});
var parts=[],prev="";
for(i=0;i<turns.length;i++){
var key=turns[i].role+"|"+turns[i].txt;
if(key===prev)continue;
prev=key;
parts.push((turns[i].role==="user"?"User:\\n":"Gemini:\\n")+turns[i].txt);
}
return parts.length?parts.join("\\n\\n"):null;
}
function pageText(){
var t=null;
try{t=deepSeekText();}catch(e){t=null;}
if(t)return t;
try{t=claudeText();}catch(e){t=null;}
if(t)return t;
try{t=geminiText();}catch(e){t=null;}
if(t)return t;
return(document.body&&document.body.innerText)||"";
}
var t=pageText();
if(!t.trim()){alert("No readable text on this page.");return;}
fetch(O+"/api/parse-text",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({text:t,pageUrl:location.href})
}).then(function(r){return r.json();}).then(function(d){
if(!d||!d.success||!d.data){
alert((d&&d.error)||"Could not parse conversation on this page.");
return;
}
try{localStorage.setItem(${JSON.stringify(storageKey)},JSON.stringify(d.data));}catch(e){}
var enc=encodeURIComponent(JSON.stringify(d.data));
window.open(O+"/?import=true#${hashKey}="+enc,"_blank");
}).catch(function(){
alert("Error reaching ChatShare. Make sure the app is running!");
});
})();`;

  return `javascript:${encodeURIComponent(code)}`;
}
