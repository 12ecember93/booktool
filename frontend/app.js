const $ = id => document.getElementById(id);
const statusBox = $('status');
const processButton = $('process');
let preparedUrls = [];
function setStatus(message, kind) { statusBox.textContent = message; statusBox.style.color = kind === 'error' ? '#b42318' : kind === 'ok' ? '#167447' : '#26344f'; }
function normalizeCandidate(raw) { let value = raw.trim().replace(/&amp;/gi, '&').replace(/\\\//g, '/'); value = value.replace(/^["'(<\[]+/, '').replace(/["')>\],;]+$/, ''); return value; }
function extractUrls(text) {
  const normalized = text.replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/gi, '&');
  const matches = normalized.match(/https?:\/\/[^\s"'<>`]+/gi) || [];
  const candidates = matches.map(normalizeCandidate).filter(u => { try { const p = new URL(u); return ['http:', 'https:'].includes(p.protocol) && p.hostname.includes('.'); } catch { return false; } });
  const unique = [...new Set(candidates)];
  const looksImage = u => /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)(?:$|[?#])/i.test(u) || /-page-\d+-/i.test(u) || /\/(image|images|img|media|page)\//i.test(new URL(u).pathname);
  const likely = unique.filter(looksImage); const result = likely.length ? likely : unique;
  return $('removeDuplicates').checked ? [...new Set(result)] : result;
}
function sortUrls(urls) { if (!$('sortPages').checked) return urls; const page = u => { const m = u.match(/-page-(\d+)-/i) || u.match(/[?&#](?:page|p)=(\d+)/i) || u.match(/(?:page|pageNo)[/_=-](\d+)/i); return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER; }; return [...urls].sort((a,b) => page(a)-page(b) || a.localeCompare(b)); }
function updatePreview() { preparedUrls = sortUrls(extractUrls($('urls').value)); $('urlCount').textContent = preparedUrls.length + ' URL ảnh'; return preparedUrls; }
$('urls').addEventListener('input', updatePreview); $('sortPages').addEventListener('change', updatePreview); $('removeDuplicates').addEventListener('change', updatePreview);
$('checkUrls').addEventListener('click', () => { const urls = updatePreview(); setStatus(urls.length ? 'Đã nhận ' + urls.length + ' URL. Bấm Tải ZIP ảnh để tiếp tục.' : 'Không tìm thấy URL. Hãy dán danh sách URL hoặc nội dung Console/HTML.', urls.length ? 'ok' : 'error'); });
$('clear').addEventListener('click', () => { $('urls').value = ''; updatePreview(); setStatus(''); });
const extractCodeText = String.raw`(() => {
  const html = document.documentElement.outerHTML.replace(/\\\//g, "/");
  const found = html.match(/https?:\/\/[^"'<>\s]+/g) || [];
  const urls = [...new Set(found.map(u => u.replace(/[),;\]}]+$/, "")))].filter(u => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u) || /-page-\d+-/i.test(u));
  copy(urls.join("\n"));
  console.log("Đã copy " + urls.length + " URL ảnh vào clipboard.");
})();`;
$('extractCode').textContent = extractCodeText;
async function copyExtractCode() {
  try {
    await navigator.clipboard.writeText(extractCodeText);
    setStatus('Đã sao chép đúng mã JavaScript. Mở tab trang sách → mở Developer Tools → chọn Console → dán mã → Enter.', 'ok');
  } catch {
    $('extractCode').closest('details').open = true;
    $('extractCode').textContent = extractCodeText;
    try {
      const range = document.createRange();
      range.selectNodeContents($('extractCode'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {}
    setStatus('Không thể tự sao chép. Mã JavaScript đã được mở và chọn sẵn; hãy sao chép thủ công bằng Ctrl+C (Mac: Cmd+C).', 'error');
  }
}
$('copyCode').addEventListener('click', copyExtractCode);
$('copyCodeGuide').addEventListener('click', copyExtractCode);
function makeSourceDownloadCode(urls, filename) {
  return `(async () => {
    const urls = ${JSON.stringify(urls)};
    const filename = ${JSON.stringify(filename)};
    const id = '__zipDownloadProgress';
    document.getElementById(id)?.remove();
    const panel = document.createElement('div');
    panel.id = id;
    panel.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;width:min(420px,calc(100vw - 32px));background:#fff;color:#142344;border:2px solid #1677f9;border-radius:12px;padding:16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 35px #0003';
    panel.innerHTML = '<b style="font-size:16px">Đang tải ảnh và tạo ZIP</b><div id="zipMsg" style="margin:8px 0">Đang chuẩn bị…</div><div style="height:8px;background:#e7edf7;border-radius:8px;overflow:hidden"><div id="zipBar" style="height:100%;width:0;background:#1677f9"></div></div><div id="zipLog" style="margin-top:8px;color:#52627e;font-size:12px"></div>';
    document.body.appendChild(panel);
    const msg = panel.querySelector('#zipMsg'), bar = panel.querySelector('#zipBar'), log = panel.querySelector('#zipLog');
    const say = (s, n, total) => { msg.textContent=s; if (total) bar.style.width=Math.round(n/total*100)+'%'; log.textContent=n+' / '+total+' URL'; };
    try {
      if (!window.JSZip) await new Promise((resolve,reject) => {
        const script=document.createElement('script'); script.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'; script.onload=resolve; script.onerror=()=>reject(new Error('Không tải được thư viện ZIP từ CDN')); document.head.appendChild(script);
      });
      const zip = new JSZip(); let done=0, failed=[];
      for (let i=0;i<urls.length;i++) {
        say('Đang tải ảnh '+(i+1)+'/'+urls.length, i, urls.length);
        try {
          const response=await fetch(urls[i], {credentials:'same-origin'});
          if(!response.ok) throw new Error('HTTP '+response.status);
          const blob=await response.blob();
          if(!blob.size) throw new Error('File rỗng');
          const path=new URL(urls[i], location.href).pathname;
          let name=decodeURIComponent(path.split('/').pop()||('image-'+(i+1)+'.img')).replace(/[^\\p{L}\\p{N}._-]+/gu,'_');
          zip.file('Anh/'+String(i+1).padStart(3,'0')+'-'+name,blob); done++;
        } catch(e) { failed.push((i+1)+'. '+urls[i]+' — '+e.message); }
        bar.style.width=Math.round((i+1)/urls.length*75)+'%';
        log.textContent='Thành công: '+done+' · Lỗi: '+failed.length+' · '+(i+1)+'/'+urls.length;
      }
      if(!done) throw new Error('Không tải được ảnh nào. Kiểm tra quyền truy cập trang sách.');
      zip.file('bao-cao.txt','Tổng URL: '+urls.length+'\\nTải được: '+done+'\\nLỗi: '+failed.length+'\\n\\n'+failed.join('\\n'));
      msg.textContent='Đang đóng ZIP…'; log.textContent='Đã tải '+done+' ảnh. Đang nén…';
      const blob=await zip.generateAsync({type:'blob'},m=>bar.style.width=(75+Math.round(m.percent*.25))+'%');
      const a=document.createElement('a'), objectUrl=URL.createObjectURL(blob); a.href=objectUrl; a.download=filename+'.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
      msg.textContent='Hoàn tất — đã tải '+filename+'.zip'; bar.style.width='100%'; log.textContent='Ảnh thành công: '+done+' · Lỗi: '+failed.length+'. Xem bao-cao.txt trong ZIP.';
    } catch(e) { msg.textContent='Lỗi: '+e.message; log.textContent='Thao tác chưa hoàn tất. Giữ nguyên trang và kiểm tra thông báo này.'; }
  })();`;
}
$('sourceZip').addEventListener('click', async () => {
  const urls=updatePreview();
  const name=($('bookname').value.trim()||'SGK_Sach').replace(/[^\\p{L}\\p{N}._ -]+/gu,'_').replace(/\\s+/g,'_');
  if(!urls.length) return setStatus('Chưa tìm thấy URL. Hãy dán danh sách trước.','error');
  if(urls.length>250) return setStatus('Tối đa 250 URL mỗi lần.','error');
  const code=makeSourceDownloadCode(urls,name);
  $('sourceCode').textContent=code;
  $('sourceCodeWrap').hidden=false;
  $('sourceCode').focus();
  setStatus('Đã tạo mã tải ZIP. Đang thử sao chép tự động; nếu không được, hãy sao chép mã đang hiện bên dưới.','ok');
  try {
    await navigator.clipboard.writeText(code);
    setStatus('Đã tạo và sao chép mã tải ZIP. Mở tab trang sách → F12 → Console → dán mã (Ctrl+V) → Enter. Thanh tiến trình sẽ xuất hiện ngay trên trang sách.','ok');
  } catch {
    setStatus('Mã đã hiện bên dưới nhưng trình duyệt không cho tự sao chép. Bấm vào ô mã, Ctrl+A rồi Ctrl+C; sau đó chạy trong Console của tab trang sách.','error');
  }
});
processButton.addEventListener('click', async () => {
  const urls = updatePreview();
  const name = ($('bookname').value.trim() || 'SGK_Sach').replace(/[^\\p{L}\\p{N}._ -]+/gu, '_').replace(/\\s+/g, '_');
  if (!urls.length) return setStatus('Chưa tìm thấy URL. Hãy dán danh sách URL trước.', 'error');
  if (urls.length > 250) return setStatus('Tối đa 250 URL mỗi lần.', 'error');
  if (typeof JSZip === 'undefined') return setStatus('Không tải được thư viện ZIP. Kiểm tra kết nối Internet rồi tải lại trang.', 'error');
  processButton.disabled = true;
  setStatus('Đã bắt đầu. Đang khởi tạo tải ảnh…');
  $('progress').hidden = false; $('progressPanel').hidden = false; $('bar').style.width = '2%';
  $('log').textContent = ''; ['p1','p2','p3','p4','p5'].forEach(id => $(id).classList.remove('active')); $('p1').classList.add('active');
  const zip = new JSZip(); let done = 0; let failed = [];
  setStatus('Đang tải ảnh trực tiếp trong trình duyệt. Không cần backend…');
  try {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const response = await fetch(url, {mode:'cors', credentials:'omit'});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        if (!blob.size) throw new Error('File rỗng');
        const type = (blob.type || '').toLowerCase();
        if (type && !type.startsWith('image/')) throw new Error('Không phải ảnh (' + type + ')');
        const parsed = new URL(url);
        let file = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        file = file.replace(/[^\\p{L}\\p{N}._-]+/gu, '_');
        if (!/\\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/i.test(file)) {
          const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : type.includes('gif') ? '.gif' : type.includes('avif') ? '.avif' : type.includes('svg') ? '.svg' : '.jpg';
          file = 'image-' + String(i + 1).padStart(3,'0') + ext;
        }
        zip.file('Anh/' + String(i + 1).padStart(3,'0') + '-' + file, blob);
        done++;
      } catch (err) { failed.push((i + 1) + '. ' + url + ' — ' + err.message); }
      $('bar').style.width = Math.round((i + 1) / urls.length * 75) + '%';
      $('log').textContent = 'Đã tải ' + (i + 1) + '/' + urls.length + ' URL. Thành công: ' + done + '. Lỗi: ' + failed.length + '.';
      $('p2').classList.add('active');
    }
    if (!done) throw new Error('Không tải được ảnh nào vì website nguồn chặn CORS. Cần chạy thao tác tải ZIP ngay trong tab website nguồn; tải trực tiếp từ trang công cụ này sẽ bị trình duyệt chặn.');
    $('p3').classList.add('active');
    zip.file('bao-cao.txt', 'URL ban đầu: ' + urls.length + '\\nẢnh tải được: ' + done + '\\nURL lỗi: ' + failed.length + '\\n\\n' + failed.join('\\n'));
    setStatus('Đã tải ' + done + '/' + urls.length + ' ảnh. Đang đóng ZIP…');
    const blob = await zip.generateAsync({type:'blob'}, meta => { $('bar').style.width = (75 + Math.round(meta.percent * 0.24)) + '%'; });
    $('p4').classList.add('active');
    const link = document.createElement('a'); const objectUrl = URL.createObjectURL(blob); link.href = objectUrl; link.download = name + '.zip'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    $('bar').style.width = '100%'; $('p5').classList.add('active');
    $('log').textContent += '\\nZIP đã sẵn sàng. Thành công: ' + done + ', lỗi: ' + failed.length + '.';
    setStatus('Hoàn tất: đã tải ' + name + '.zip (' + done + ' ảnh). ' + (failed.length ? failed.length + ' URL lỗi được liệt kê trong bao-cao.txt.' : ''), failed.length ? 'error' : 'ok');
  } catch (err) {
    $('log').textContent += '\\nLỗi: ' + err.message;
    setStatus('Không tạo được ZIP: ' + err.message, 'error');
  } finally {
    processButton.disabled = false;
    setTimeout(() => { $('progress').hidden = true; $('bar').style.width = '0%'; }, 1800);
  }
});
updatePreview();