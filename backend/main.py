import io, ipaddress, os, re, socket, zipfile
from urllib.parse import urlparse
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError

APP_TITLE = 'Get images to ZIP tool API'
MAX_URLS = int(os.getenv('MAX_URLS', '250'))
MAX_IMAGE_BYTES = int(os.getenv('MAX_IMAGE_BYTES', str(20 * 1024 * 1024)))
MAX_TOTAL_BYTES = int(os.getenv('MAX_TOTAL_BYTES', str(400 * 1024 * 1024)))
FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN', 'https://12ecember93.github.io')
app = FastAPI(title=APP_TITLE, version='1.2.0')
origins = ['*'] if FRONTEND_ORIGIN == '*' else [x.strip() for x in FRONTEND_ORIGIN.split(',') if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=['GET','POST','OPTIONS'], allow_headers=['Content-Type','X-Tool-Password'])
class BuildRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=MAX_URLS)
    filename: str = Field(default='SGK_Sach', max_length=100)
    retry_errors: bool = False

def safe_filename(name):
    name = re.sub(r'[^A-Za-z0-9._ -]+', '_', name).strip(' ._-')
    return (name[:80] or 'SGK_Sach').replace(' ', '_')
def page_number(url, fallback):
    m = re.search(r'-page-(\d+)-', url, re.I) or re.search(r'[?&#](?:page|p)=(\d+)', url, re.I)
    return int(m.group(1)) if m else fallback
def validate_public_url(url):
    p = urlparse(url)
    if p.scheme not in ('https','http') or not p.hostname: raise ValueError('Chỉ chấp nhận URL HTTP/HTTPS.')
    host = p.hostname.lower().rstrip('.')
    if host in {'localhost','localhost.localdomain','metadata.google.internal'} or host.endswith('.local'): raise ValueError('Tên miền nội bộ không được phép.')
    try:
        ip = ipaddress.ip_address(host)
        if not ip.is_global: raise ValueError('IP nội bộ/không công khai không được phép.')
    except ValueError as exc:
        if 'không được phép' in str(exc): raise
        try: answers = socket.getaddrinfo(host, p.port or (443 if p.scheme == 'https' else 80), type=socket.SOCK_STREAM)
        except OSError as e: raise ValueError('Không phân giải được tên miền: ' + host) from e
        for ans in answers:
            try:
                ip = ipaddress.ip_address(ans[4][0])
                if not ip.is_global: raise ValueError('Tên miền trỏ tới IP nội bộ/không công khai.')
            except ValueError as e:
                if 'không công khai' in str(e): raise
def clean_urls(urls):
    out=[]
    for item in urls:
        for m in re.findall(r'https?://[^\s"\'<>`]+', item.replace(r'\/', '/')):
            u=m.rstrip('),;]}').strip()
            if u and u not in out: out.append(u)
    return out
@app.get('/')
def root(): return {'service':APP_TITLE,'status':'ok','health':'/health'}
@app.get('/health')
def health(): return {'status':'ok'}
@app.post('/api/build-zip')
async def build_zip(request: BuildRequest):
    raw=clean_urls(request.urls)
    if not raw: raise HTTPException(400, 'Không tìm thấy URL HTTP/HTTPS trong nội dung đã dán.')
    if len(raw)>MAX_URLS: raise HTTPException(400, 'Tối đa '+str(MAX_URLS)+' URL mỗi lần.')
    candidates=[]; invalid=[]
    for u in raw:
        try: validate_public_url(u); candidates.append(u)
        except Exception as e: invalid.append(u[:100]+' — '+str(e)[:100])
    if not candidates: raise HTTPException(400, 'Không có URL công khai hợp lệ. '+'\n'.join(invalid[:5]))
    candidates.sort(key=lambda u:(page_number(u,10**9),u))
    total=0; images=[]; problems=[]; skipped=[]
    headers={'User-Agent':'Mozilla/5.0 (compatible; GetImagesToPDF/1.2)','Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'}
    async with httpx.AsyncClient(timeout=httpx.Timeout(40,connect=12),follow_redirects=True,headers=headers) as client:
        for idx,u in enumerate(candidates,1):
            attempts=2 if request.retry_errors else 1; result=None; last_error=''
            for _ in range(attempts):
                try:
                    async with client.stream('GET',u) as r:
                        validate_public_url(str(r.url))
                        if r.status_code != 200: raise RuntimeError('HTTP '+str(r.status_code))
                        ct=r.headers.get('content-type','').lower(); data=bytearray()
                        async for chunk in r.aiter_bytes():
                            data.extend(chunk)
                            if len(data)>MAX_IMAGE_BYTES: raise RuntimeError('Ảnh vượt giới hạn 20 MB.')
                        if not ct.startswith('image/'): skipped.append(u[:120]+' — bỏ qua Content-Type '+(ct or 'không xác định')); result='skip'; break
                        if not data: raise RuntimeError('File rỗng.')
                        try:
                            im=Image.open(io.BytesIO(data)); im.verify()
                        except (UnidentifiedImageError,OSError) as e: raise RuntimeError('Nội dung trả về không phải ảnh hợp lệ.') from e
                        total+=len(data)
                        if total>MAX_TOTAL_BYTES: raise RuntimeError('Tổng dung lượng ảnh vượt giới hạn xử lý.')
                        result=(u,bytes(data)); break
                except Exception as e: last_error=str(e)
            if result=='skip': continue
            if result is None:
                if re.search(r'\.(png|jpe?g|webp|gif|avif|bmp|tiff?)(?:$|[?#])|-page-\d+-',u,re.I): problems.append(u[:150]+' — '+(last_error or 'tải thất bại'))
                else: skipped.append(u[:120]+' — không tải được, đã bỏ qua')
                continue
            images.append((page_number(result[0],idx),result[0],result[1]))
    if not images: raise HTTPException(502, 'Không tải được ảnh nào. Kiểm tra URL, quyền truy cập hoặc chống bot của website nguồn.\n'+'\n'.join(problems[:8]))
    if problems: raise HTTPException(502, 'Có URL trông giống ảnh nhưng tải thất bại; không tạo ZIP để tránh thiếu trang:\n'+'\n'.join(problems[:10]))
    images.sort(key=lambda x:(x[0],x[1])); stem=safe_filename(request.filename)
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for i,item in enumerate(images,1):
            try: fmt=Image.open(io.BytesIO(item[2])).format
            except Exception: fmt=None
            ext={'JPEG':'.jpg','PNG':'.png','WEBP':'.webp','GIF':'.gif','BMP':'.bmp','TIFF':'.tif','AVIF':'.avif'}.get(fmt,'.img')
            z.writestr('Anh/page-'+str(i).zfill(3)+ext,item[2])
        lines=['Get images to ZIP tool - manifest','URLs found: '+str(len(raw)),'Images included: '+str(len(images)),'Other URLs skipped: '+str(len(skipped)),'']
        lines += [str(i).zfill(3)+'\tpage='+str(x[0])+'\t'+x[1] for i,x in enumerate(images,1)]
        if skipped: lines += ['', 'Skipped URLs:']+skipped
        z.writestr('manifest.txt','\n'.join(lines))
    out.seek(0)
    return StreamingResponse(out,media_type='application/zip',headers={'Content-Disposition':'attachment; filename="'+stem+'.zip"'})
