from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import os,re
ROOT=Path(__file__).resolve().parent/"dist"
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def send_head(self):
  path=self.translate_path(self.path)
  if not self.headers.get('Range') or not os.path.isfile(path):return super().send_head()
  m=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers['Range'])
  if not m:return super().send_head()
  size=os.path.getsize(path);start=int(m[1]);end=min(int(m[2]) if m[2] else size-1,size-1)
  if start>=size:self.send_error(416);return None
  f=open(path,'rb');f.seek(start);self.send_response(206);self.send_header('Content-Type',self.guess_type(path));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes');self.end_headers();self.range_left=end-start+1;return f
 def copyfile(self,source,outputfile):
  if not hasattr(self,'range_left'):return super().copyfile(source,outputfile)
  remaining=self.range_left;del self.range_left
  while remaining:
   b=source.read(min(1024*1024,remaining))
   if not b:break
   outputfile.write(b);remaining-=len(b)
 def log_message(self,*a):pass
if __name__=='__main__':
 server=ThreadingHTTPServer(('127.0.0.1',8769),Handler)
 print(f'http://127.0.0.1:{server.server_port}/index.html',flush=True)
 server.serve_forever()
