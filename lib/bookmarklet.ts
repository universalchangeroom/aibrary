/** localStorage key used to hand a parsed thread into the import modal. */
export const CHATSHARE_PENDING_IMPORT_KEY = "chatshare_pending_import";

/** Hash key used by the bookmarklet to pass data cross-origin into ChatShare. */
export const CHATSHARE_PENDING_HASH_KEY = "chatshare_pending";

/**
 * Resolve the ChatShare origin baked into the bookmarklet.
 * Client: window.location.origin. Server: NEXT_PUBLIC_APP_URL, else localhost:3000.
 */
export function resolveChatShareOrigin(appOrigin?: string): string {
  const explicit = (appOrigin || "").trim().replace(/\/$/, "");
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;

  if (typeof window !== "undefined") {
    try {
      const live = String(window.location?.origin || "")
        .trim()
        .replace(/\/$/, "");
      if (live && /^https?:\/\//i.test(live)) return live;
    } catch {
      // ignore
    }
  }

  const fromEnv = String(
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
  )
    .trim()
    .replace(/\/$/, "");
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;

  return "http://localhost:3000";
}

export function buildImportBookmarklet(appOrigin?: string): string {
  const origin = resolveChatShareOrigin(appOrigin);
  // Compact, ES5-friendly payload (bookmarklet URL length limits).
  // HTML → Markdown so paste/parse keeps structure for ChatShare editors.
  // `O` is the live ChatShare origin; dest = O + "/share?paste=1&source=…&model=…"
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
function resolveImgSrc(img){
if(!img)return"";
var src=img.getAttribute? (img.getAttribute("src")||img.getAttribute("data-src")||img.getAttribute("data-lazy-src")||img.getAttribute("data-original")||img.getAttribute("data-image-url")||"") : "";
try{if(img.currentSrc&&String(img.currentSrc).indexOf("http")===0)src=img.currentSrc;}catch(e0){}
try{if((!src||src.indexOf("blob:")===0||src.indexOf("data:")===0)&&img.src&&String(img.src).indexOf("http")===0)src=img.src;}catch(e1){}
if((!src||src.indexOf("data:")===0)&&img.getAttribute){
var ss=img.getAttribute("srcset")||img.getAttribute("data-srcset")||"";
if(ss){
var first=String(ss).split(",")[0]||"";
var u=first.replace(/\\s+\\d+[wx]$/i,"").replace(/^\\s+|\\s+$/g,"");
if(u)src=u;
}
}
/* ChatGPT often wraps the full-res file on a parent <a download> — take any http(s) file href. */
if((!src||src.indexOf("blob:")===0)&&img.closest){
try{
var a=img.closest("a[href]");
if(a){
var href=a.getAttribute("href")||a.href||"";
if(href&&(href.indexOf("http")===0||href.indexOf("//")===0||href.charAt(0)==="/"||/\\.(png|jpe?g|webp|gif|avif)(\\?|$)/i.test(href)))src=href;
}
}catch(eA){}
}
if(src&&src.indexOf("//")===0)src="https:"+src;
try{
if(src&&src.charAt(0)==="/"&&src.charAt(1)!=="/"&&typeof location!=="undefined"&&location.origin){
src=String(location.origin)+src;
}
}catch(eAbs){}
return String(src||"").replace(/^\\s+|\\s+$/g,"");
}
function isGeneratedImageSrc(src){
if(!src)return false;
return /estuary|oaidalleapiprodscus|oaiusercontent\\.com|images\\.openai|\\/backend-api\\/(estuary|files|content)|dall[\\-_]?e|filesystem\\.site\\/cdn|file-.*\\.openai/i.test(String(src));
}
function imgAltText(img){
if(!img||!img.getAttribute)return"";
return String(img.getAttribute("alt")||img.getAttribute("aria-label")||img.getAttribute("title")||"").replace(/[\\[\\]\\r\\n]/g," ").replace(/^\\s+|\\s+$/g,"");
}
function isGeneratedImage(img){
if(!img)return false;
var src=resolveImgSrc(img);
var alt=imgAltText(img).toLowerCase();
if(isGeneratedImageSrc(src))return true;
if(/generated\\s*image/.test(alt))return true;
if(img.getAttribute){
var s=String(img.getAttribute("src")||"")+String(img.getAttribute("data-src")||"");
if(/estuary|oaidalleapiprodscus|oaiusercontent|dalle/i.test(s))return true;
}
return false;
}
function isContentImage(img){
if(!img||!img.getAttribute)return false;
if(isGeneratedImage(img))return true;
var src=resolveImgSrc(img);
if(!src)return false;
if(src.indexOf("data:image/svg")===0)return false;
if(src.indexOf("data:image/gif;base64,R0lGODlh")===0)return false;
if(src.indexOf("data:")===0&&src.length<400)return false;
var w=parseInt(img.getAttribute("width")||0,10)||0;
var h=parseInt(img.getAttribute("height")||0,10)||0;
try{if(!w&&img.naturalWidth)w=img.naturalWidth;if(!h&&img.naturalHeight)h=img.naturalHeight;}catch(e3){}
try{if(!w&&img.width)w=img.width;if(!h&&img.height)h=img.height;}catch(e4){}
if((w&&w>0&&w<40)||(h&&h>0&&h<40))return false;
if(w&&h&&w*h>0&&w*h<2000)return false;
var cls=String(img.className||"").toLowerCase();
var al=imgAltText(img).toLowerCase();
var aria=String(img.getAttribute("aria-label")||"").toLowerCase();
var role=String(img.getAttribute("role")||"").toLowerCase();
if(role==="presentation"||img.getAttribute("aria-hidden")==="true")return false;
var junk=/(avatar|logo|icon|emoji|reaction|thumb|thumbs|badge|spinner|loading|profile|user-pic|favicon|star|rating|check|chevron|arrow|close|dismiss)/i;
if(junk.test(cls)||junk.test(al)||junk.test(aria))return false;
var p=img.parentElement||img.parentNode;
var depth=0;
while(p&&depth<6){
var pt=(p.tagName||"").toLowerCase();
var pc=String(p.className||"").toLowerCase();
var pid=String(p.id||"").toLowerCase();
if(pt==="button"||pt==="nav"||pt==="header"||pt==="footer"||pt==="aside")return false;
if(junk.test(pc)||junk.test(pid))return false;
if(p.getAttribute&&p.getAttribute("role")==="toolbar")return false;
p=p.parentElement||p.parentNode;
depth++;
}
return true;
}
function imgToMd(img){
if(!isContentImage(img)&&!isGeneratedImage(img))return"";
var src=resolveImgSrc(img);
if(!src)return"";
if(src.indexOf("//")===0)src="https:"+src;
var alt=imgAltText(img);
if(isGeneratedImage(img)){
if(!alt)alt="Generated image";
return "\\n\\n!["+alt+"]("+src+")\\n\\n";
}
if(!alt||/^(image|img|photo|picture|media)$/i.test(alt))alt="Image Description";
return "\\n\\n!["+alt+"]("+src+")\\n\\n";
}
function harvestImages(root,preferGenerated){
if(!root||!root.querySelectorAll)return[];
var out=[],seen={},imgs,list=[],i,img,src,md,sel,j;
try{
sel='img[src*="estuary"],img[src*="oaidalleapiprodscus"],img[src*="oaiusercontent"],img[src*="dalle"],img[data-src*="estuary"],img[data-src*="oaidalleapiprodscus"],img[data-src*="oaiusercontent"],img[alt*="Generated image"],img[alt*="Generated Image"],img[alt*="generated image"]';
imgs=root.querySelectorAll(sel);
if(imgs&&imgs.length){for(i=0;i<imgs.length;i++)list.push(imgs[i]);}
imgs=root.querySelectorAll("img");
if(imgs&&imgs.length){for(i=0;i<imgs.length;i++)list.push(imgs[i]);}
}catch(eH){
try{imgs=root.querySelectorAll("img");if(imgs){for(i=0;i<imgs.length;i++)list.push(imgs[i]);}}catch(e2){}
}
for(j=0;j<list.length;j++){
img=list[j];
src=resolveImgSrc(img);
if(!src||seen[src])continue;
if(preferGenerated){
if(!isGeneratedImage(img)&&!isContentImage(img))continue;
}else if(!isContentImage(img)&&!isGeneratedImage(img)){
continue;
}
seen[src]=1;
md=String(imgToMd(img)||"").replace(/^\\s+|\\s+$/g,"");
if(md)out.push(md);
}
return out;
}
function appendMissingImages(text,imgs){
var t=String(text||"");
var i,md,srcMatch,src;
for(i=0;i<(imgs||[]).length;i++){
md=imgs[i];
srcMatch=String(md).match(/!\\[[^\\]]*\\]\\(([^)]+)\\)/);
src=srcMatch?srcMatch[1]:"";
if(src&&t.indexOf(src)>=0)continue;
if(md&&t.indexOf(md)>=0)continue;
t=(t?t.replace(/\\s+$/,"")+"\\n\\n":"")+md;
}
return t;
}
function mergeImageLists(a,b){
var out=[],seen={},i,md,m,src;
function add(list){
for(i=0;i<(list||[]).length;i++){
md=list[i];
m=String(md).match(/!\\[[^\\]]*\\]\\(([^)]+)\\)/);
src=m?m[1]:md;
if(!src||seen[src])continue;
seen[src]=1;
out.push(md);
}
}
add(a);add(b);
return out;
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
if(tag==="img")return imgToMd(node);
if(tag==="picture"){
var picImg=node.querySelector?node.querySelector("img"):null;
return picImg?imgToMd(picImg):"";
}
if(tag==="figure"){
var figImg=node.querySelector?node.querySelector("img"):null;
var kidsF="",fi,fc;
for(fi=0;fi<node.childNodes.length;fi++){
fc=node.childNodes[fi];
if(fc===figImg||(fc.nodeType===1&&(fc.tagName||"").toLowerCase()==="img"))continue;
if(fc.nodeType===1&&(fc.tagName||"").toLowerCase()==="picture")continue;
kidsF+=walk(fc);
}
var imgMd=figImg?imgToMd(figImg):"";
var cap=kidsF.replace(/^\\s+|\\s+$/g,"");
if(imgMd&&cap)return imgMd+cap+"\\n\\n";
return imgMd||(cap?cap+"\\n\\n":"");
}
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
if(thinkTxt)block+="<think>\\n"+thinkTxt+"\\n</think>\\n\\n";
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
function stripChatGptSaidLabels(raw){
if(!raw)return"";
var s=String(raw).replace(/\\u00a0/g," ");
s=s.replace(/^\\s*(?:\\*\\*|__|#\\s*)?(?:You said|ChatGPT said|Assistant said)(?:\\*\\*|__)?\\s*:?\\s*/gim,"");
s=s.replace(/\\n\\s*(?:\\*\\*|__|#\\s*)?(?:You said|ChatGPT said|Assistant said)(?:\\*\\*|__)?\\s*:?\\s*/gim,"\\n");
return s.replace(/^\\s+|\\s+$/g,"");
}
function chatGptImgSrc(img){
if(!img)return"";
var src="";
try{src=String(img.src||"");}catch(e0){src="";}
try{
if(!src||src.indexOf("blob:")===0||src.indexOf("data:")===0){
src=String((img.getAttribute&&(img.getAttribute("src")||img.getAttribute("data-src")||img.getAttribute("data-lazy-src")))||src||"");
}
}catch(e1){}
try{if(img.currentSrc&&String(img.currentSrc).indexOf("http")===0)src=img.currentSrc;}catch(e2){}
if((!src||src.indexOf("blob:")===0||src.indexOf("data:")===0)&&img.closest){
try{
var a=img.closest("a[href]");
if(a){
var href=a.getAttribute("href")||a.href||"";
if(href&&href.indexOf("javascript:")!==0)src=href;
}
}catch(e3){}
}
if(src&&src.indexOf("//")===0)src="https:"+src;
try{
if(src&&src.charAt(0)==="/"&&src.charAt(1)!=="/"&&typeof location!=="undefined"&&location.origin){
src=String(location.origin)+src;
}
}catch(e4){}
return String(src||"").replace(/^\\s+|\\s+$/g,"");
}
function chatGptImagesInTurn(turn){
if(!turn||!turn.querySelectorAll)return[];
var wrap=turn,list=[],imgs,i,img,src,alt,owner,pushImgs,out,seenSrc,j,block;
try{
var outer=turn.closest&&(turn.closest("article")||turn.closest('[data-testid*="conversation-turn"]'));
if(outer)wrap=outer;
}catch(eW){}
pushImgs=function(root){
if(!root||!root.querySelectorAll)return;
try{imgs=root.querySelectorAll("img");}catch(eI){return;}
for(i=0;i<imgs.length;i++){
img=imgs[i];
if(!img||list.indexOf(img)>=0)continue;
try{
owner=img.closest&&img.closest("[data-message-author-role]");
if(owner&&owner!==turn)continue;
}catch(eO){}
list.push(img);
}
};
pushImgs(turn);
if(wrap!==turn)pushImgs(wrap);
out=[];seenSrc={};
for(j=0;j<list.length;j++){
img=list[j];
src=chatGptImgSrc(img);
if(!src||seenSrc[src])continue;
if(src.indexOf("data:image/svg")===0)continue;
seenSrc[src]=1;
alt="";
try{alt=String(img.alt||"").replace(/[\\[\\]\\r\\n]/g," ").replace(/^\\s+|\\s+$/g,"");}catch(eA){alt="";}
if(!alt)alt="Generated image";
/* Text prefix is required so parseRawText keeps image-only turns. */
block="[AI Generated Image]\\n\\n!["+alt+"]("+src+")";
out.push(block);
}
return out;
}
function imgToThumbJpeg(img){
return new Promise(function(resolve){
function draw(el){
try{
var w=el.naturalWidth||el.width||0;
var h=el.naturalHeight||el.height||0;
if(!w||!h){resolve("");return;}
var maxW=100;
var dw=w>maxW?maxW:w;
var dh=Math.max(1,Math.round(h*(dw/w)));
var c=document.createElement("canvas");
c.width=dw;c.height=dh;
var ctx=c.getContext("2d");
if(!ctx){resolve("");return;}
ctx.drawImage(el,0,0,dw,dh);
resolve(c.toDataURL("image/jpeg",0.1));
}catch(eC){resolve("");}
}
if(!img){resolve("");return;}
if((img.naturalWidth||img.width)>0){draw(img);return;}
try{
if(img.decode){
img.decode().then(function(){draw(img);}).catch(function(){draw(img);});
return;
}
}catch(eD){}
draw(img);
});
}
function appendGlobalGeneratedImages(payload){
var gImgs,jobs=[],g,seenImages=new Set();
try{gImgs=document.querySelectorAll('img[alt*="Generated image"],img[alt*="Generated Image"]');}catch(eG){gImgs=null;}
if(!gImgs||!gImgs.length){
return Promise.resolve(String(payload||"").replace(/^\\s+|\\s+$/g,"")||null);
}
for(g=0;g<gImgs.length;g++){
(function(gImg){
var srcKey="",orig;
try{srcKey=String((gImg&&gImg.src)||"");}catch(eK){srcKey="";}
if(srcKey&&seenImages.has(srcKey))return;
orig=chatGptImgSrc(gImg);
try{if(!orig)orig=String((gImg&&(gImg.currentSrc||gImg.src))||"");}catch(eS){}
if(orig&&seenImages.has(orig))return;
if(!orig||orig.indexOf("data:image/svg")===0)return;
if(srcKey)seenImages.add(srcKey);
if(orig)seenImages.add(orig);
jobs.push(imgToThumbJpeg(gImg).then(function(thumb){
if(!thumb||String(thumb).indexOf("data:image/jpeg")!==0)thumb="";
if(!thumb&&(orig.indexOf("blob:")===0||orig.indexOf("data:")===0))return null;
return{thumb:String(thumb||""),orig:String(orig)};
}));
})(gImgs[g]);
}
return Promise.all(jobs).then(function(rows){
var out=String(payload||"");
var added=0,i,row,block,imgSrc;
for(i=0;i<rows.length;i++){
row=rows[i];
if(!row||!row.orig)continue;
imgSrc=row.thumb||row.orig;
block="[AI Generated Image]\\n[![Thumbnail]("+imgSrc+")]("+row.orig+")\\n[View Original Image]("+row.orig+")\\n\\n";
if(!added){
if(!out)out="ChatGPT:\\n";
out=out+"\\n\\n--- Extracted Images ---\\n\\n";
added=1;
}
out=out+block;
}
out=String(out||"").replace(/^\\s+|\\s+$/g,"");
return out||null;
});
}
function chatGptText(){
var h=host();
if(h.indexOf("chatgpt.com")<0&&h.indexOf("chat.openai.com")<0)return null;
var nodes=document.querySelectorAll("[data-message-author-role]");
if(!nodes||!nodes.length)nodes=document.querySelectorAll("article");
if(!nodes||!nodes.length)return appendGlobalGeneratedImages("");
var parts=[],i,turn,role,txt,textRoot,imgs,j,block;
for(i=0;i<nodes.length;i++){
turn=nodes[i];
role=String((turn.getAttribute&&turn.getAttribute("data-message-author-role"))||"").toLowerCase();
if(!role){
if(turn.querySelector){
if(turn.querySelector('[data-message-author-role="user"]')){
turn=turn.querySelector('[data-message-author-role="user"]')||turn;
role="user";
}else if(turn.querySelector('[data-message-author-role="assistant"]')){
turn=turn.querySelector('[data-message-author-role="assistant"]')||turn;
role="assistant";
}
}
}
if(role!=="user"&&role!=="assistant"&&role!=="system")continue;
textRoot=turn.querySelector?(turn.querySelector(".markdown")||turn.querySelector(".prose")||turn.querySelector('[class*="markdown"]')||turn):turn;
txt=stripChatGptSaidLabels(cleanChrome(htmlToMd(textRoot||turn)));
txt=String(txt||"").replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g,"").replace(/\\n{3,}/g,"\\n\\n").replace(/^\\s+|\\s+$/g,"");
imgs=(role==="assistant"||role==="system")?chatGptImagesInTurn(turn):[];
if(imgs.length){
block="";
for(j=0;j<imgs.length;j++){
if(!imgs[j]||txt.indexOf(imgs[j])>=0||block.indexOf(imgs[j])>=0)continue;
block=block?block+"\\n\\n"+imgs[j]:imgs[j];
}
/* Image-only turns must keep the [AI Generated Image] text fail-safe. */
txt=txt&&block?txt+"\\n\\n"+block:(block||txt);
}
txt=String(txt||"").replace(/^\\s+|\\s+$/g,"");
if(!txt)continue;
if(role==="user")parts.push("User:\\n"+txt);
else parts.push("ChatGPT:\\n"+txt);
}
var payload=parts.length?parts.join("\\n\\n"):"";
return appendGlobalGeneratedImages(payload);
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
function elText(el){
if(!el)return"";
return String(el.innerText||el.textContent||"").replace(/\\s+/g," ").replace(/^\\s+|\\s+$/g,"");
}
/** Domain → platform label for import "Model / Source". */
function sourceName(){
var h=host();
if(h==="chatgpt.com"||h==="www.chatgpt.com"||h==="chat.openai.com"||h==="www.chat.openai.com"||h.indexOf(".chatgpt.com")>=0||h.indexOf("chat.openai.com")>=0)return"ChatGPT";
if(h==="gemini.google.com"||h==="www.gemini.google.com"||h.indexOf("gemini.google.com")>=0)return"Gemini";
if(h==="chat.deepseek.com"||h==="www.chat.deepseek.com"||h.indexOf("chat.deepseek.com")>=0||h.indexOf("deepseek.com")>=0)return"DeepSeek";
if(h==="claude.ai"||h==="www.claude.ai"||h.slice(-10)===".claude.ai")return"Claude";
if(h==="perplexity.ai"||h==="www.perplexity.ai"||h.indexOf("perplexity.ai")>=0)return"Perplexity";
if(h==="copilot.microsoft.com"||h==="www.copilot.microsoft.com"||h.indexOf("copilot.microsoft.com")>=0||h==="copilot.cloud.microsoft"||h.indexOf("copilot.cloud.microsoft")>=0)return"Copilot";
if(h==="grok.com"||h==="www.grok.com"||h.indexOf("grok.com")>=0||h==="grok.x.ai"||h==="x.com"||h==="www.x.com"||h==="twitter.com"||h==="www.twitter.com")return"Grok";
var d=h.replace(/^www\\./,"");
return d||"AI";
}
/**
 * Best-effort active model from the page chrome (model switcher, DeepThink, etc.).
 */
function detectModel(platform){
var i,el,t,cands,nodes;
try{
if(platform==="ChatGPT"){
cands=document.querySelectorAll('[data-testid="model-switcher-dropdown-button"],[data-testid="model-switcher"],button[aria-haspopup="menu"]');
for(i=0;i<cands.length;i++){
t=elText(cands[i]);
if(t&&t.length<90&&/GPT|o1|o3|o4|ChatGPT|mini/i.test(t))return t;
}
nodes=document.querySelectorAll("button");
for(i=0;i<nodes.length;i++){
t=elText(nodes[i]);
if(t&&t.length<48&&/^(GPT-4o|GPT-4\\.1|o1|o3|o4-mini|ChatGPT)/i.test(t))return t;
}
}
if(platform==="DeepSeek"){
cands=document.querySelectorAll("button,[role='button'],.ds-button,[class*='ds-button']");
for(i=0;i<cands.length;i++){
t=elText(cands[i]);
if(!t||t.length>80)continue;
if(/DeepThink|R1/i.test(t))return"DeepSeek-R1";
if(/^DeepSeek/i.test(t))return t;
}
}
if(platform==="Claude"){
cands=document.querySelectorAll('button,[data-testid*="model"],[aria-label*="model" i]');
for(i=0;i<cands.length;i++){
t=elText(cands[i]);
if(t&&t.length<90&&/Claude|Sonnet|Opus|Haiku/i.test(t))return t;
}
}
if(platform==="Gemini"){
cands=document.querySelectorAll('button,[data-test-id*="model"],[data-testid*="model"],[aria-label*="Gemini" i]');
for(i=0;i<cands.length;i++){
t=elText(cands[i]);
if(t&&t.length<90&&/Gemini|Flash|Pro|Ultra/i.test(t))return t;
}
}
if(platform==="Perplexity"){
cands=document.querySelectorAll("button,[role='button']");
for(i=0;i<cands.length;i++){
t=elText(cands[i]);
if(t&&t.length<70&&/Sonar|GPT|Claude|Gemini|Perplexity|Model/i.test(t))return t;
}
}
if(platform==="Copilot"){
return"Copilot";
}
if(platform==="Grok"){
cands=document.querySelectorAll("button,[role='button']");
for(i=0;i<cands.length;i++){
t=elText(cands[i]);
if(t&&t.length<70&&/Grok/i.test(t))return t;
}
return"Grok 2";
}
}catch(err){}
return"";
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
Promise.resolve(t).then(function(text){
if(!text||!String(text).replace(/^\\s+|\\s+$/g,"")){alert("No readable text on this page.");return;}
var src=sourceName();
var model=detectModel(src);
var dest=O+"/share?paste=1&source="+encodeURIComponent(src);
if(model)dest+="&model="+encodeURIComponent(model);
return copyText(text).then(function(){
window.open(dest,"_blank");
}).catch(function(){
window.open(dest,"_blank");
alert("Opened ChatShare, but auto-copy failed. Select and copy the chat, then paste in the Paste transcript tab.");
});
}).catch(function(){
alert("Could not extract this page.");
});
})();`;

  return `javascript:${encodeURIComponent(code)}`;
}
