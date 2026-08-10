/** localStorage key used to hand a parsed thread into the import modal. */
export const CHATSHARE_PENDING_IMPORT_KEY = "chatshare_pending_import";

/** Hash key used by the bookmarklet to pass data cross-origin into ChatShare. */
export const CHATSHARE_PENDING_HASH_KEY = "chatshare_pending";

/**
 * Build a drag-to-bookmarks JavaScript bookmarklet for the given app origin.
 * Uses the live site origin so the same button works in production and localhost.
 * Defaults to http://localhost:3001 when origin is missing.
 *
 * Avoids cross-origin fetch (CSP-safe on gemini.google.com): extracts DOM as
 * Markdown (preserving bold/italic/code/lists), copies to clipboard, then opens
 * ChatShare /share for paste.
 */
export function resolveChatShareOrigin(appOrigin?: string): string {
  const raw = (appOrigin || "").trim().replace(/\/$/, "");
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  return "http://localhost:3001";
}

export function buildImportBookmarklet(appOrigin: string): string {
  const origin = resolveChatShareOrigin(appOrigin);
  // Compact, ES5-friendly payload (bookmarklet URL length limits).
  // HTML → Markdown so paste/parse keeps structure for ChatShare editors.
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
function htmlToMd(root){
if(!root)return"";
function walk(node){
if(!node)return"";
if(node.nodeType===3){
return String(node.nodeValue||"").replace(/\\u00a0/g," ");
}
if(node.nodeType!==1)return"";
var tag=(node.tagName||"").toLowerCase();
if(tag==="script"||tag==="style"||tag==="svg"||tag==="button"||tag==="noscript"||tag==="textarea"||tag==="input"||tag==="select")return"";
if(tag==="pre"){
var codeEl=node.querySelector?node.querySelector("code"):null;
var lang="";
if(codeEl&&codeEl.className){
var m=String(codeEl.className).match(/language-([\\w#+-]+)/i)||String(codeEl.className).match(/lang(?:uage)?-([\\w#+-]+)/i);
if(m)lang=m[1];
}
var code=codeEl?(codeEl.innerText||codeEl.textContent||""):(node.innerText||node.textContent||"");
code=String(code).replace(/\\r\\n/g,"\\n").replace(/\\n$/,"");
return "\\n\\n\`\`\`"+(lang||"")+"\\n"+code+"\\n\`\`\`\\n\\n";
}
if(tag==="br")return"\\n";
if(tag==="hr")return"\\n\\n---\\n\\n";
var kids="",i,c;
for(i=0;i<node.childNodes.length;i++){
c=node.childNodes[i];
kids+=walk(c);
}
if(tag==="strong"||tag==="b"){
var st=kids.replace(/^\\s+|\\s+$/g,"");
return st?"**"+st+"**":"";
}
if(tag==="em"||tag==="i"){
var it=kids.replace(/^\\s+|\\s+$/g,"");
return it?"*"+it+"*":"";
}
if(tag==="code"){
if(node.parentNode&&node.parentNode.tagName&&String(node.parentNode.tagName).toLowerCase()==="pre")return kids;
var ct=kids.replace(/\\n+/g," ").replace(/^\\s+|\\s+$/g,"");
if(!ct)return"";
return"\`"+ct.replace(/\`/g,"'")+"\`";
}
if(tag==="a"){
var href=node.getAttribute?node.getAttribute("href"):"";
var at=kids.replace(/^\\s+|\\s+$/g,"");
if(href&&at&&href.indexOf("javascript:")!==0)return"["+at+"]("+href+")";
return at||kids;
}
if(tag==="p"){
var pt=kids.replace(/^\\s+|\\s+$/g,"");
return pt?pt+"\\n\\n":"";
}
if(tag==="li"){
var lt=kids.replace(/^\\s+|\\s+$/g,"").replace(/\\n+/g," ");
return lt?"- "+lt+"\\n":"";
}
if(tag==="ul"||tag==="ol"){
var list=kids.replace(/^\\s+|\\s+$/g,"");
return list?"\\n"+list+"\\n":"";
}
if(tag==="h1"||tag==="h2"||tag==="h3"||tag==="h4"||tag==="h5"||tag==="h6"){
var lvl=parseInt(tag.charAt(1),10)||2;
var hashes="";
while(hashes.length<lvl)hashes+="#";
var ht=kids.replace(/^\\s+|\\s+$/g,"");
return ht?"\\n\\n"+hashes+" "+ht+"\\n\\n":"";
}
if(tag==="blockquote"){
var bq=kids.replace(/^\\s+|\\s+$/g,"").split("\\n");
var lines=[],j;
for(j=0;j<bq.length;j++){if(bq[j].replace(/^\\s+|\\s+$/g,""))lines.push("> "+bq[j]);}
return lines.length?"\\n"+lines.join("\\n")+"\\n\\n":"";
}
if(tag==="div"||tag==="section"||tag==="article"||tag==="main"||tag==="span"){
return kids;
}
return kids;
}
var out=walk(root);
return String(out).replace(/\\n{3,}/g,"\\n\\n").replace(/[ \\t]+\\n/g,"\\n").replace(/^\\s+|\\s+$/g,"");
}
function cleanChrome(raw){
if(!raw)return"";
var s=String(raw).replace(/\\u00a0/g," ");
s=s.replace(/^(Copy|Edit|Retry|Share|Good response|Bad response|Regenerate|Show thinking|Thoughts|Double-check response|Listen|Export|More|Thumb up|Thumb down|Google it)\\s*/gim,"");
s=s.replace(/\\n(?:Copy|Edit|Retry|Share|Good response|Bad response|Regenerate|Show thinking|Double-check response|Listen|Export|More|Thumb up|Thumb down|Regenerate|Copy|Google it)\\s*$/gim,"");
s=s.replace(/^(Thought|Thinking|View)[^\\n]*\\n+/i,"");
return s.replace(/^\\s+|\\s+$/g,"");
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
thinkTxt=think?cleanChrome(htmlToMd(think)||(think.innerText||"")):"";
if(main||thinkTxt){
block="";
if(thinkTxt)block+="Thought process:\\n"+thinkTxt+"\\n\\n";
if(main){txt=cleanChrome(htmlToMd(main));if(txt)block+=txt;}
if(block)parts.push("DeepSeek:\\n"+block);
}else{
txt=cleanChrome(htmlToMd(n)||(n.innerText||""));
if(txt)parts.push("User:\\n"+txt);
}
}
return parts.length?parts.join("\\n\\n"):null;
}
function claudeText(){
var h=host();
if(h!=="claude.ai"&&h!=="www.claude.ai"&&h.slice(-10)!==".claude.ai")return null;
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
txt=cleanChrome(htmlToMd(n));
if(txt)turns.push({el:n,role:"user",txt:txt});
}
for(i=0;i<assts.length;i++){
n=assts[i];
if(users.some(function(u){return u.contains&&u.contains(n);}))continue;
txt=cleanChrome(htmlToMd(n));
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
var userSel=["user-query",'[data-test-id="user-query"]','[data-testid="user-query"]',".user-query",".query-content","[class*='user-query']"].join(",");
var asstSel=["model-response",'[data-test-id="model-response"]','[data-testid="model-response"]',".model-response",".response-container","[class*='model-response']"].join(",");
var users=outermost(document.querySelectorAll(userSel));
var assts=outermost(document.querySelectorAll(asstSel));
if(!assts.length){
assts=outermost(document.querySelectorAll(".markdown-main-panel,message-content,.response-content"));
}
if(!users.length&&!assts.length)return null;
var turns=[],i,n,txt;
for(i=0;i<users.length;i++){
n=users[i];
var q=n.querySelector&&n.querySelector(".query-content");
txt=cleanChrome(htmlToMd(q||n));
if(txt)turns.push({el:n,role:"user",txt:txt});
}
for(i=0;i<assts.length;i++){
n=assts[i];
if(users.some(function(u){return u.contains&&u.contains(n);}))continue;
var mdRoot=n.querySelector&&(n.querySelector(".markdown")||n.querySelector(".markdown-main-panel")||n.querySelector("message-content")||n);
txt=cleanChrome(htmlToMd(mdRoot||n));
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
function chatGptText(){
var h=host();
if(h.indexOf("chatgpt.com")<0&&h.indexOf("chat.openai.com")<0)return null;
var nodes=document.querySelectorAll('[data-message-author-role]');
if(!nodes.length)nodes=document.querySelectorAll('[data-testid*="conversation-turn"]');
if(!nodes.length)return null;
var parts=[],i,n,role,txt,md;
for(i=0;i<nodes.length;i++){
n=nodes[i];
role=(n.getAttribute("data-message-author-role")||"").toLowerCase();
if(!role){
if(n.querySelector&&n.querySelector('[data-message-author-role="user"]'))role="user";
else if(n.querySelector&&n.querySelector('[data-message-author-role="assistant"]'))role="assistant";
}
md=n.querySelector? (n.querySelector(".markdown")||n.querySelector('[class*="markdown"]')||n.querySelector(".prose")||n):n;
txt=cleanChrome(htmlToMd(md||n));
if(!txt)continue;
if(role==="user")parts.push("User:\\n"+txt);
else if(role==="assistant"||role==="system")parts.push("ChatGPT:\\n"+txt);
else parts.push("User:\\n"+txt);
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
try{t=chatGptText();}catch(e){t=null;}
if(t)return t;
var main=document.querySelector("main")||document.body;
return cleanChrome(htmlToMd(main)||((document.body&&document.body.innerText)||""));
}
function sourceName(){
var h=host();
if(h.indexOf("gemini")>=0)return"Gemini";
if(h.indexOf("deepseek")>=0)return"DeepSeek";
if(h.indexOf("claude")>=0)return"Claude";
if(h.indexOf("chatgpt")>=0||h.indexOf("openai")>=0)return"ChatGPT";
return"chat";
}
function copyText(text){
if(navigator.clipboard&&navigator.clipboard.writeText){
return navigator.clipboard.writeText(text);
}
return new Promise(function(resolve,reject){
try{
var ta=document.createElement("textarea");
ta.value=text;
ta.setAttribute("readonly","");
ta.style.position="fixed";
ta.style.left="-9999px";
document.body.appendChild(ta);
ta.select();
var ok=document.execCommand("copy");
document.body.removeChild(ta);
if(ok)resolve();else reject(new Error("copy failed"));
}catch(err){reject(err);}
});
}
var t=pageText();
if(!t||!String(t).replace(/^\\s+|\\s+$/g,"")){alert("No readable text on this page.");return;}
var dest=O+"/share?paste=1&source="+encodeURIComponent(sourceName());
copyText(t).then(function(){
window.open(dest,"_blank");
}).catch(function(){
window.open(dest,"_blank");
alert("Opened ChatShare, but auto-copy failed. Select and copy the chat, then paste in the Paste transcript tab.");
});
})();`;

  return `javascript:${encodeURIComponent(code)}`;
}
