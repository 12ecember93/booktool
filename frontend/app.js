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
function updatePreview() { preparedUrls = sortUrls(extractUrls($('urls').value)); $('urlCount').textContent = preparedUrls.length + ' URL candidate(s)'; $('urlPreview').hidden = !preparedUrls.length; $('urlPreview').textContent = preparedUrls.slice(0,8).join('\n') + (preparedUrls.length > 8 ? '\n… và ' + (preparedUrls.length-8) + ' URL khác' : ''); return preparedUrls; }
$('urls').addEventListener('input', updatePreview); $('sortPages').addEventListener('change', updatePreview); $('removeDuplicates').addEventListener('change', updatePreview);
$('checkUrls').addEventListener('click', () => { const urls = updatePreview(); setStatus(urls.length ? 'Đã trích xuất ' + urls.length + ' URL. Backend sẽ kiểm tra nội dung ảnh thực tế.' : 'Không tìm thấy URL. Hãy dán danh sách URL hoặc nội dung Console/HTML.', urls.length ? 'ok' : 'error'); });
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
processButton.addEventListener('click', async () => {
  const urls = updatePreview();
  const name = ($('bookname').value.trim() || 'SGK_Sach').replace(/[^\\p{L}\\p{N}._ -]+/gu, '_').replace(/\\s+/g, '_');
  if (!urls.length) return setStatus('Chưa tìm thấy URL. Hãy dán danh sách URL trước.', 'error');
  if (urls.length > 250) return setStatus('Tối đa 250 URL mỗi lần.', 'error');
  if (typeof JSZip === 'undefined') return setStatus('Không tải được thư viện ZIP. Kiểm tra kết nối Internet rồi tải lại trang.', 'error');
  processButton.disabled = true;
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
    if (!done) throw new Error('Không tải được ảnh nào. Website nguồn có thể chặn CORS; hãy thử lấy URL khác hoặc tải ảnh từ chính website nguồn.');
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