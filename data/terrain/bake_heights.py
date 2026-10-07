import math,io,json,urllib.request,sys
from PIL import Image
lat0,lon0=42.180935,47.426924
z=15;n=2**z
def tx(lon): return (lon+180)/360*n
def ty(lat): return (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
cx,cy=tx(lon0),ty(lat0)
tiles={}
def tile(i,j):
    if (i,j) not in tiles:
        d=urllib.request.urlopen(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{i}/{j}.png").read()
        tiles[(i,j)]=Image.open(io.BytesIO(d)).convert('RGB')
    return tiles[(i,j)]
def h(px,py):
    i,j=int(px),int(py);im=tile(i,j)
    r,g,b=im.getpixel((min(255,int((px-i)*256)),min(255,int((py-j)*256))))
    return r*256+g+b/256-32768
SIZE=2000;N=161  # meters, grid points
mlat=111320; mlon=111320*math.cos(math.radians(lat0))
H=[]
for r in range(N):
    for c in range(N):
        east=-SIZE/2+c*SIZE/(N-1); north=SIZE/2-r*SIZE/(N-1)
        H.append(round(h(tx(lon0+east/mlon),ty(lat0+north/mlat)),1))
json.dump({"lat":lat0,"lon":lon0,"size":SIZE,"n":N,"min":min(H),"max":max(H),"h":H},open(sys.argv[1],'w'),separators=(',',':'))
print(min(H),max(H))
