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
$('copyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('extractCode').innerText); setStatus('Đã sao chép mã Console. Mở trang sách → F12 → Console → dán mã và nhấn Enter.', 'ok'); } catch { setStatus('Không thể tự sao chép mã. Mở “Xem mã Console” rồi sao chép thủ công.', 'error'); } });
processButton.addEventListener('click', async () => {
  const api = $('api').value.trim().replace(/\/+$/, ''); const urls = updatePreview(); const name = $('bookname').value.trim() || 'SGK_Sach';
  if (!api) return setStatus('Nhập Backend API URL sau khi deploy.', 'error');
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(api)) return setStatus('Backend URL phải là HTTPS URL hợp lệ.', 'error');
  if (!urls.length) return setStatus('Không tìm thấy URL hợp lệ trong nội dung đã dán.', 'error');
  if (urls.length > 250) return setStatus('Tối đa 250 URL mỗi lần.', 'error');
  processButton.disabled = true; $('progress').hidden = false; $('progressPanel').hidden = false; $('bar').style.width = '12%'; $('log').textContent = new Date().toLocaleTimeString() + ' Đã trích xuất ' + urls.length + ' URL candidate…\n'; ['p1','p2','p3','p4','p5'].forEach(id => $(id).classList.remove('active')); $('p1').classList.add('active'); setStatus('Đang kiểm tra URL và gửi danh sách tới backend…');
  try {
    const response = await fetch(api + '/api/build-zip', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({urls:urls, filename:name, retry_errors:$('retryErrors').checked})});
    $('bar').style.width = '78%'; $('p2').classList.add('active'); $('log').textContent += new Date().toLocaleTimeString() + ' Backend đang tải và xác minh ảnh…\n';
    if (!response.ok) { let detail = 'HTTP ' + response.status; try { const body = await response.json(); detail = body.detail || detail; } catch {} throw new Error(detail); }
    const blob = await response.blob(); ['p3','p4'].forEach(id => $(id).classList.add('active')); const disposition = response.headers.get('Content-Disposition') || ''; const match = disposition.match(/filename="?([^";]+)"?/i); const outName = match ? match[1] : name + '.zip'; const objectUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = objectUrl; a.download = outName; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000); $('bar').style.width = '100%'; $('p5').classList.add('active'); $('log').textContent += 'ZIP sẵn sàng: ' + outName + '\n'; setStatus('Hoàn tất. Đã yêu cầu tải ' + outName + '.', 'ok');
  } catch (err) { $('log').textContent += 'Lỗi: ' + err.message + '\n'; setStatus('Không tạo được ZIP: ' + err.message, 'error'); }
  finally { processButton.disabled = false; setTimeout(() => { $('progress').hidden = true; $('bar').style.width = '0%'; }, 1400); }
});
updatePreview();