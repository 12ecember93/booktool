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

      msg.textContent='Đang đóng ZIP…'; log.textContent='Đã tải '+done+' ảnh. Đang nén…';
      const blob=await zip.generateAsync({type:'blob'},m=>bar.style.width=(75+Math.round(m.percent*.25))+'%');
      const a=document.createElement('a'), objectUrl=URL.createObjectURL(blob); a.href=objectUrl; a.download=filename+'.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
      msg.textContent='Hoàn tất — đã tải '+filename+'.zip'; bar.style.width='100%'; log.textContent='Ảnh thành công: '+done+' · Lỗi: '+failed.length+'.';
    } catch(e) { msg.textContent='Lỗi: '+e.message; log.textContent='Thao tác chưa hoàn tất. Giữ nguyên trang và kiểm tra thông báo này.'; }
  })();`;
}
function getOutputName() {
  const clean = value => value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '');
  return '[' + clean($('nameRoot').value || 'GS') + '] - ' + clean($('nameNo').value || '02') + ' - ' + clean($('nameType').value || 'SGK');
}
function makeWindowsBat(urls, outputName) {
  const safeName = outputName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '').trim() || 'SGK_Sach';
  const psLines = [
    'param([string]$BatPath)',
    '$ErrorActionPreference = "Stop"',
    '$all = Get-Content -LiteralPath $BatPath',
    '$marker = [Array]::IndexOf($all, "#--URLS--")',
    'if ($marker -lt 0) { throw "URL list missing from BAT." }',
    '$urls = @($all[($marker + 1)..($all.Length - 1)] | Where-Object { $_ -match "^https?://" })',
    "$name = '" + safeName.replace(/'/g, "''") + "'",
    '$root = Split-Path -Parent $BatPath',
    '$outDir = Join-Path $root $name',
    'if (Test-Path -LiteralPath $outDir) { Remove-Item -LiteralPath $outDir -Recurse -Force }',
    'New-Item -ItemType Directory -Path $outDir -Force | Out-Null',
    '$bad = New-Object System.Collections.Generic.List[string]',
    '$ok = 0',
    'for ($n = 0; $n -lt $urls.Count; $n++) {',
    '  $u = $urls[$n].Trim()',
    '  Write-Progress -Activity "Download images" -Status ("URL {0}/{1} | success {2} | failed {3}" -f ($n+1), $urls.Count, $ok, $bad.Count) -PercentComplete ([int](($n+1)*100/[Math]::Max(1,$urls.Count)))',
    '  try {',
    '    $uri = [Uri]$u',
    '    $ext = [IO.Path]::GetExtension($uri.AbsolutePath)',
    '    if ($ext -notmatch "^\\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$") { $ext = ".img" }',
    '    $dest = Join-Path $outDir ("{0:D3}-image{1}" -f ($n+1), $ext)',
    '    Invoke-WebRequest -Uri $u -OutFile $dest -TimeoutSec 60 -Headers @{"User-Agent"="Mozilla/5.0"}',
    '    if ((Get-Item -LiteralPath $dest).Length -eq 0) { throw "Empty file" }',
    '    $ok++',
    '  } catch { $bad.Add(("{0}. {1} -- {2}" -f ($n+1), $u, $_.Exception.Message)) }',
    '}',
    'if ($ok -gt 0) {',
    "  try {",
    '$pdfFiles = @(Get-ChildItem -LiteralPath $outDir -File | Where-Object { $_.Extension -match "^\.(png|jpe?g|bmp|gif|tiff?)$" } | Sort-Object Name)',
    '$cs = @(',
"    'using System;',",
"    'using System.IO;',",
"    'using System.Text;',",
"    'using System.Collections.Generic;',",
"    'using System.Drawing;',",
"    'using System.Drawing.Imaging;',",
"    'public static class ImgPdfMaker {',",
"    '  static void W(Stream s, byte[] b) { s.Write(b,0,b.Length); }',",
"    '  public static int Create(string[] files, string path) {',",
"    '    var o = new List<byte[]>(); o.Add(null); o.Add(null);',",
"    '    var kids = new StringBuilder(); int count=0;',",
"    '    foreach (string f in files) {',",
"    '      try {',",
"    '        using (var src=Image.FromFile(f)) {',",
"    '          int iw=src.Width, ih=src.Height; byte[] jpg;',",
"    '          using (var bmp=new Bitmap(iw,ih,PixelFormat.Format24bppRgb)) using (var g=Graphics.FromImage(bmp)) using (var ms=new MemoryStream()) {',",
"    '            g.Clear(Color.White); g.DrawImage(src,0,0,iw,ih);',",
"    '            var codec=Array.Find(ImageCodecInfo.GetImageEncoders(),e=>e.MimeType==\"image/jpeg\");',",
"    '            using (var ep=new EncoderParameters(1)) { ep.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,88L); bmp.Save(ms,codec,ep); }',",
"    '            jpg=ms.ToArray();',",
"    '          }',",
"    '          double z=Math.Min(595.0/iw,842.0/ih); int w=Math.Max(1,(int)(iw*z)), h=Math.Max(1,(int)(ih*z)), x=(595-w)/2, y=(842-h)/2;',",
"    '          int pg=o.Count+1, ct=pg+1, ix=pg+2; kids.Append(pg).Append(\" 0 R \");',",
"    '          string st=\"q \"+w+\" 0 0 \"+h+\" \"+x+\" \"+y+\" cm /Im0 Do Q\"; byte[] sb=Encoding.ASCII.GetBytes(st);',",
"    '          o.Add(Encoding.ASCII.GetBytes(\"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 \"+ix+\" 0 R >> >> /Contents \"+ct+\" 0 R >>\"));',",
"    '          o.Add(Encoding.ASCII.GetBytes(\"<< /Length \"+sb.Length+\" >>\\nstream\\n\"+st+\"\\nendstream\"));',",
"    '          using (var ms=new MemoryStream()) {',",
"    '            W(ms,Encoding.ASCII.GetBytes(\"<< /Type /XObject /Subtype /Image /Width \"+iw+\" /Height \"+ih+\" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length \"+jpg.Length+\" >>\\nstream\\n\"));',",
"    '            W(ms,jpg); W(ms,Encoding.ASCII.GetBytes(\"\\nendstream\")); o.Add(ms.ToArray());',",
"    '          }',",
"    '          count++;',",
"    '        }',",
"    '      } catch { }',",
"    '    }',",
"    '    if(count==0) return 0;',",
"    '    o[1]=Encoding.ASCII.GetBytes(\"<< /Type /Catalog /Pages 2 0 R >>\");',",
"    '    o[2]=Encoding.ASCII.GetBytes(\"<< /Type /Pages /Kids [\"+kids+\"] /Count \"+count+\" >>\");',",
"    '    using (var fs=new FileStream(path,FileMode.Create,FileAccess.Write)) {',",
"    '      W(fs,Encoding.ASCII.GetBytes(\"%PDF-1.4\\n\")); var offsets=new List<long>(); offsets.Add(0);',",
"    '      for(int i=1;i<o.Count;i++){ offsets.Add(fs.Position); W(fs,Encoding.ASCII.GetBytes(i+\" 0 obj\\n\")); W(fs,o[i]); W(fs,Encoding.ASCII.GetBytes(\"\\nendobj\\n\")); }',",
"    '      long xref=fs.Position; W(fs,Encoding.ASCII.GetBytes(\"xref\\n0 \"+o.Count+\"\\n0000000000 65535 f \\n\"));',",
"    '      for(int i=1;i<offsets.Count;i++) W(fs,Encoding.ASCII.GetBytes(offsets[i].ToString(\"D10\")+\" 00000 n \\n\"));',",
"    '      W(fs,Encoding.ASCII.GetBytes(\"trailer << /Size \"+o.Count+\" /Root 1 0 R >>\\nstartxref\\n\"+xref+\"\\n%%EOF\"));',",
"    '    }',",
"    '    return count;',",
"    '  }',",
"    '}'",
    ') -join [Environment]::NewLine',
    '    Add-Type -AssemblyName System.Drawing',
    '    Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Drawing',
    '    $pdfPath = Join-Path $root ($name + ".pdf")',
    '    $pages = [ImgPdfMaker]::Create([string[]]$pdfFiles.FullName, $pdfPath)',
    '    if ($pages -gt 0) { Write-Host ("PDF created: " + $pdfPath + " (" + $pages + " pages)") -ForegroundColor Green } else { Remove-Item -LiteralPath $pdfPath -Force -ErrorAction SilentlyContinue; Write-Host "PDF skipped: no readable PNG/JPG/GIF/BMP/TIFF images." -ForegroundColor Yellow }',
    "  } catch { Write-Host (\"PDF error: \" + $_.Exception.Message) -ForegroundColor Yellow }",
    "  Write-Host (\"Images folder: \" + $outDir)",
    '  Write-Host ("Success: $ok / $($urls.Count); failed: $($bad.Count)")',
    '} else { Write-Host "No images downloaded. Check URLs and access." -ForegroundColor Red; $bad | ForEach-Object { Write-Host $_ } }',
    'Write-Host "This window will close in 5 seconds..."',
    'Start-Sleep -Seconds 5'
  ];
  return [
    '@echo off',
    'setlocal',
    'title Download images and create ZIP',
    'echo Downloading images. Please wait...',
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p='%~f0'; $c=Get-Content -LiteralPath $p; $a=[Array]::IndexOf($c,'#--PS--'); $b=[Array]::IndexOf($c,'#--URLS--'); if($a -lt 0 -or $b -le $a){throw 'Invalid BAT format'}; $f=Join-Path $env:TEMP ([guid]::NewGuid().ToString()+'.ps1'); $c[($a+1)..($b-1)] | Set-Content -LiteralPath $f -Encoding UTF8; & $f -BatPath $p; Remove-Item -LiteralPath $f -Force"`,
    'if errorlevel 1 echo Error running PowerShell. Check the messages above.',
    'timeout /t 5 /nobreak >nul',
    'exit /b',
    '#--PS--',
    ...psLines,
    '#--URLS--',
    ...urls
  ].join('\r\n') + '\r\n';
}
$('downloadBat').addEventListener('click', () => {
  const urls = updatePreview();
  const name = getOutputName();
  if (!urls.length) return setStatus('Chưa tìm thấy URL. Hãy dán danh sách trước.', 'error');
  if (urls.length > 250) return setStatus('Tối đa 250 URL mỗi lần.', 'error');
  const bat = makeWindowsBat(urls, name);
  const blob = new Blob(['\ufeff', bat], {type:'text/plain;charset=utf-8'});
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl; link.download = name + '_download.bat';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  setStatus('Đã tải file .bat cho Windows. Lưu file, nhấp đúp để chạy; thư mục ảnh và PDF sẽ được tạo cạnh file .bat theo tên ' + name + '. Cần có Microsoft Edge hoặc Chrome để tạo PDF.', 'ok');
});
async function copySourceZipCode() {
  const code=$('sourceCode').value || $('sourceCode').textContent;
  try { await navigator.clipboard.writeText(code); setStatus('Đã copy ZIP code. Mở tab trang sách → F12 → Console → Ctrl+V → Enter.','ok'); }
  catch { $('sourceCode').focus(); $('sourceCode').select(); setStatus('Không thể tự copy. Mã đã được chọn; nhấn Ctrl+C để sao chép.','error'); }
}
$('copyZipCode').addEventListener('click', copySourceZipCode);
$('sourceZip').addEventListener('click', async () => {
  const urls=updatePreview();
  const name=getOutputName();
  if(!urls.length) return setStatus('Chưa tìm thấy URL. Hãy dán danh sách trước.','error');
  if(urls.length>250) return setStatus('Tối đa 250 URL mỗi lần.','error');
  const code=makeSourceDownloadCode(urls,name);
  $('sourceCode').value=code;
  $('sourceCodeWrap').hidden=false;
  setStatus('Đã tạo mã tải ZIP. Đang sao chép vào clipboard…','ok');
  await copySourceZipCode();
});
processButton.addEventListener('click', async () => {
  const urls = updatePreview();
  const name = getOutputName();
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

    setStatus('Đã tải ' + done + '/' + urls.length + ' ảnh. Đang đóng ZIP…');
    const blob = await zip.generateAsync({type:'blob'}, meta => { $('bar').style.width = (75 + Math.round(meta.percent * 0.24)) + '%'; });
    $('p4').classList.add('active');
    const link = document.createElement('a'); const objectUrl = URL.createObjectURL(blob); link.href = objectUrl; link.download = name + '.zip'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    $('bar').style.width = '100%'; $('p5').classList.add('active');
    $('log').textContent += '\\nZIP đã sẵn sàng. Thành công: ' + done + ', lỗi: ' + failed.length + '.';
    setStatus('Hoàn tất: đã tải ' + name + '.zip (' + done + ' ảnh).', failed.length ? 'error' : 'ok');
  } catch (err) {
    $('log').textContent += '\\nLỗi: ' + err.message;
    setStatus('Không tạo được ZIP: ' + err.message, 'error');
  } finally {
    processButton.disabled = false;
    setTimeout(() => { $('progress').hidden = true; $('bar').style.width = '0%'; }, 1800);
  }
});
function refreshOutputName() { $('outputNamePreview').textContent = getOutputName(); }
['nameRoot','nameNo','nameType'].forEach(id => $(id).addEventListener('input', refreshOutputName));
refreshOutputName();
updatePreview();