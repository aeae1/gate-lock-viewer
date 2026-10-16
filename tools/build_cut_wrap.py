"""Build the 1:1 letter-size gate-upright marking wrap (requires reportlab).

Flat plate outline: vevor_mounting_plate_x1.DXF, millimetres.
DXF SHA256: f3e1974f800dd2f8bc6a28a4b4e8a133715d3eeecd8c88105bcdef5fe847c3c6
Plate seating arrangement: vivor.SLDPRT, matching saved native display faces.
SLDPRT SHA256: 5cbfb6534a54cca91cdb88ab295897b5fb0791da4af1e1b1109caffec6178125
Nominal pipe OD uses the user's 2-7/8 in, not the CAD's rounded 73.000 mm.
No kerf, weld gap, paper-thickness, paint or fabrication tolerance is added.
"""
from pathlib import Path
from math import pi, asin, sqrt, cos, sin
import json
from reportlab.pdfgen import canvas
import reportlab
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont

# Embed fonts so printer/PDF-viewer substitutions cannot alter the labels.
FONT_DIR = Path(reportlab.__file__).resolve().parent / 'fonts'
pdfmetrics.registerFont(TTFont('Body', str(FONT_DIR / 'Vera.ttf')))
pdfmetrics.registerFont(TTFont('BodyBold', str(FONT_DIR / 'VeraBd.ttf')))

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'print'
OUT.mkdir(exist_ok=True)
PDF = OUT / 'gate-upright-cut-wrap-letter.pdf'
D = 2.875 * 25.4
R, WALL, T, W, H = D / 2, .21 * 25.4, 6.35, 52.93, 152.9
C = pi * D
ARC = D * asin(W / D)
DEPTH = sqrt(R * R - (W / 2) ** 2)
RECESS = R - DEPTH - T
PAGE_W, PAGE_H = 279.4, 215.9
X, Y, BAND, TAB = 20., 20., 11., 10.
BOTTOM, TOP = Y + BAND, Y + BAND + H
MID = (TOP + BOTTOM) / 2
FRONT, HINGE, BACK, SEAM = [X + C * k / 4 for k in [1, 2, 3, 4]]
SPINDLE = MID - 47.

INK = '#172B43'
MUTED = '#50637A'
RED = '#C81E55'
PINK = '#FDE9F0'
BLUE = '#007DAD'
BLUE_LIGHT = '#DDF5FF'
PURPLE = '#783FC7'
PURPLE_LIGHT = '#EFE6FF'
GREEN = '#087E63'
GREEN_LIGHT = '#DFF5E9'
ORANGE = '#B35F00'
ORANGE_LIGHT = '#FFF0D2'
GRAY = '#788596'
LIGHT = '#EDF1F5'

c = canvas.Canvas(str(PDF), pagesize=(PAGE_W * mm, PAGE_H * mm), pageCompression=1)
c.setTitle('Gate upright - full-size mounting-plate cut wrap')
c.setAuthor('Gate lock viewer project')
c.setSubject('Letter landscape, actual size: 73.025 mm OD, two 52.93 x 152.90 mm plates')
c.setViewerPreference('PrintScaling', 'None')

def color(s): return colors.HexColor(s)
def rect(x, y, w, h, fill=None, stroke=None, lw=.6):
    c.setLineWidth(lw)
    if fill: c.setFillColor(color(fill))
    if stroke: c.setStrokeColor(color(stroke))
    c.rect(x * mm, y * mm, w * mm, h * mm, fill=bool(fill), stroke=bool(stroke))

def line(x1, y1, x2, y2, ink=INK, lw=.65, dash=None):
    c.setStrokeColor(color(ink)); c.setLineWidth(lw)
    c.setDash(dash or [])
    c.line(x1 * mm, y1 * mm, x2 * mm, y2 * mm)
    c.setDash([])

def text(x, y, s, size=8, ink=INK, bold=False, align='left'):
    c.setFillColor(color(ink)); c.setFont('BodyBold' if bold else 'Body', size)
    {'left': c.drawString, 'center': c.drawCentredString, 'right': c.drawRightString}[align](x * mm, y * mm, s)

def rotated(x, y, s, size=8, ink=INK, angle=90, bold=False):
    c.saveState(); c.translate(x * mm, y * mm); c.rotate(angle)
    text(0, 0, s, size, ink, bold, 'center'); c.restoreState()

def para(x, y, s, width, size=9, leading=4.25, ink=INK):
    words=s.split(); rows=[]; row=''
    for word in words:
        new=(row+' '+word).strip()
        if stringWidth(new, 'Body', size)>width*mm and row:
            rows.append(row); row=word
        else: row=new
    if row: rows.append(row)
    for row in rows:
        text(x,y,row,size,ink); y-=leading
    return y

def arrow(x1,y1,x2,y2,ink=INK,lw=.65,head=1.4,both=False):
    line(x1,y1,x2,y2,ink,lw)
    dx,dy=x2-x1,y2-y1; length=sqrt(dx*dx+dy*dy); ux,uy=dx/length,dy/length
    for x,y,s in [(x2,y2,1)]+([(x1,y1,-1)] if both else []):
        for turn in [-1,1]:
            line(x,y,x-s*ux*head+uy*head*.45*turn,y-s*uy*head-ux*head*.45*turn,ink,lw)

def hatch(x,y,w,h):
    c.saveState(); p=c.beginPath(); p.rect(x*mm,y*mm,w*mm,h*mm); c.clipPath(p,stroke=0)
    for k in range(-int(h)-10,int(w)+10,7): line(x+k,y,x+k+h,y+h,'#F5C9D8',.35)
    c.restoreState()

def tag(x,y,w,title,subtitle,ink,bg):
    rect(x-w/2,y,w,10,bg)
    text(x,y+5.8,title,8.3,ink,True,'center')
    text(x,y+1.8,subtitle,6.5,ink,False,'center')

def cross(x,y,ink,size=1.9,lw=.8):
    line(x-size,y,x+size,y,ink,lw);line(x,y-size,x,y+size,ink,lw)

# PAGE 1: exact developed cylinder, not a scaled picture of a rectangle.
text(20,207.2,'GATE UPRIGHT / CUT WRAP',14,INK,True)
text(20,201.4,'2-7/8 in OD | 1/4 in plates | Moving gate latch tube | Page 1 of 2',8.3,MUTED)
rect(208,199.6,51.4,12.5,BLUE_LIGHT)
text(233.7,207.3,'LETTER - LANDSCAPE',8.5,BLUE,True,'center')
text(233.7,202.5,'100% / ACTUAL SIZE',10,BLUE,True,'center')

# Body and tape tab; trim border is independent of steel cut boundaries.
rect(X,Y,C,H+2*BAND,'#FAFCFE')
rect(SEAM,Y,TAB,H+2*BAND,ORANGE_LIGHT)
for px,bg in [(FRONT,BLUE_LIGHT),(BACK,PURPLE_LIGHT)]: rect(px-4,Y,8,H+2*BAND,bg)
rect(HINGE-1.4,Y,2.8,H+2*BAND,GREEN_LIGHT)
for px,ink,bg,title,subtitle in [
    (FRONT,BLUE,BLUE_LIGHT,'FRONT / KEYPAD','0 degrees - outside face'),
    (BACK,PURPLE,PURPLE_LIGHT,'BACK / INSIDE LOCK','180 degrees - inside face'),
    (HINGE,GREEN,GREEN_LIGHT,'HINGE SIDE','90 degrees - along gate')]:
    tag(px,TOP+.5,48 if px!=HINGE else 43,title,subtitle,ink,bg)
    tag(px,Y+.5,48 if px!=HINGE else 43,title,subtitle,ink,bg)
text(X+1.5,TOP+6.3,'GAP SIDE',7,ORANGE,True)
text(X+1.5,TOP+2.3,'SEAM A',7,ORANGE,True)
text(SEAM-1.5,TOP+6.3,'GAP SIDE',7,ORANGE,True,'right')
text(SEAM-1.5,TOP+2.3,'SEAM B',7,ORANGE,True,'right')
text(X+1.5,Y+6.3,'GAP SIDE',7,ORANGE,True)
text(X+1.5,Y+2.3,'SEAM A',7,ORANGE,True)
text(SEAM-1.5,Y+6.3,'GAP SIDE',7,ORANGE,True,'right')
text(SEAM-1.5,Y+2.3,'SEAM B',7,ORANGE,True,'right')

for px,ink,label in [(FRONT,BLUE,'FRONT CUT'),(BACK,PURPLE,'BACK CUT')]:
    a=px-ARC/2
    rect(a,BOTTOM,ARC,H,PINK)
    hatch(a,BOTTOM,ARC,H)
    rect(a,BOTTOM,ARC,H,None,RED,1.05)
    line(px,Y+BAND-.5,px,TOP+.5,ink,.8,[7,3])
    for xx in [a,a+ARC]:
        for yy in [BOTTOM,TOP]: cross(xx,yy,RED,1.8,.65)
    rect(px-26,MID+28,52,24,'#FFFFFF')
    text(px,MID+45,label,13,ink,True,'center')
    text(px,MID+38,'REMOVE PIPE CAP',10,RED,True,'center')
    text(px,MID+32,'52.93 mm FLAT plate width',8,MUTED,False,'center')
    arrow(a,TOP-9,a+ARC,TOP-9,RED,both=True)
    rect(px-20,TOP-8.3,40,5,PINK)
    text(px,TOP-6.8,f'{ARC:.2f} mm around surface',7.5,RED,True,'center')
    rect(px-26,BOTTOM+6,52,20,'#FFFFFF')
    text(px,BOTTOM+20,'RED = FINISHED OPENING',8,RED,True,'center')
    text(px,BOTTOM+14,'Rough-cut inside; file to fit.',8,INK,False,'center')
    text(px,BOTTOM+8,'No added clearance or kerf allowance.',6.8,MUTED,False,'center')
    # Real front/back crown references remain visible through the waste area.
    line(px,BOTTOM+27,px,MID+27,ink,.8,[7,3])
    line(px,MID+53,px,TOP-10,ink,.8,[7,3])

for xx in [X,SEAM]: line(xx,Y,xx,TOP+BAND,ORANGE,1.1,[8,3,2,3])
line(HINGE,Y+BAND-.5,HINGE,TOP+.5,GREEN,.8,[8,3,2,3])
line(X,MID,SEAM,MID,INK,.65,[8,3,2,3])
line(X,SPINDLE,SEAM,SPINDLE,BLUE,.65,[2,3])
for px,ink in [(FRONT,BLUE),(BACK,PURPLE)]:
    cross(px,MID,ink,3,1)
    cross(px,SPINDLE,BLUE,3,1)
rect(HINGE-24,MID+2,48,12,'#FFFFFF')
text(HINGE,MID+9,'PLATE MID-HEIGHT',8.5,INK,True,'center')
text(HINGE,MID+4,'Set your installation height here',6.8,MUTED,False,'center')
rect(HINGE-24,SPINDLE+2,48,12,'#FFFFFF')
text(HINGE,SPINDLE+9,'SPINDLE AXIS',8.5,BLUE,True,'center')
text(HINGE,SPINDLE+4,'47.00 mm below plate mid-height',6.8,BLUE,False,'center')

for xx,side in [(FRONT-ARC/2-5,-1),(BACK+ARC/2+5,1)]:
    arrow(xx,BOTTOM,xx,TOP,RED,both=True)
    rect(xx-2,MID-22,4,44,'#FAFCFE')
    rotated(xx+1,MID,'152.90 mm / 6.020 in',8,RED,bold=True)
rotated(SEAM+6,MID,'TAPE TAB - UNDERLAP - ALIGN SEAM A TO SEAM B',8,ORANGE,bold=True)
rotated(X+7,MID+45,'TOP OF GATE',7.5,MUTED,bold=True)
arrow(X+7,MID+60,X+7,MID+72,MUTED,head=2)

# Trim outside border. Keep the tab, then place it under the start edge.
c.setDash([4,3]);rect(X,Y,C+TAB,H+2*BAND,None,GRAY,.5);c.setDash([])
text(20,15.3,'GRAY DASH = trim paper perimeter',7,MUTED)
text(134.7,15.3,'RED = steel opening boundary',7,RED,True,'center')
text(259.4,15.3,'Other colored lines = references, not cuts',7,MUTED,False,'right')
text(20,9.5,f'One wrap: {C:.3f} mm / {C/25.4:.5f} in',7.5,INK,True)
line(119,9.5,169.8,9.5,BLUE,.8)
for xx in [119,169.8]:line(xx,8,xx,11,BLUE,.8)
text(144.4,11.7,'2.000 in scale check',6.5,BLUE,True,'center')
text(259.4,9.5,'Scale + fit checks: page 2.',7.5,INK,False,'right')
c.showPage()

# PAGE 2: setup sheet, a 1:1 section and checks for BOTH print axes.
text(16,202,'PRINT, ALIGN, THEN FIT',18,INK,True)
text(16,195.3,'Setup for the two mounting plates on the moving gate upright',10,MUTED)
text(263.4,202,'LETTER / PAGE 2 OF 2',8.5,MUTED,True,'right')
line(16,190,263.4,190,BLUE,1.5)

cx,cy=69,134
text(cx,181,'CUT SECTION / 1:1',10,INK,True,'center')
text(cx,176,'Looking down the upright',8,MUTED,False,'center')
# Original round pipe, with removed steel highlighted.
c.setFillColor(color(PINK));c.setStrokeColor(color('#E9B5C6'));c.setLineWidth(.7)
c.circle(cx*mm,cy*mm,R*mm,stroke=1,fill=1)
c.setFillColor(colors.white);c.circle(cx*mm,cy*mm,(R-WALL)*mm,stroke=0,fill=1)
c.saveState();p=c.beginPath();p.rect((cx-R)*mm,(cy-DEPTH)*mm,D*mm,2*DEPTH*mm);c.clipPath(p,stroke=0)
c.setFillColor(color('#A6B7C8'));c.setStrokeColor(color('#53697E'))
c.circle(cx*mm,cy*mm,R*mm,stroke=1,fill=1)
c.setFillColor(colors.white);c.circle(cx*mm,cy*mm,(R-WALL)*mm,stroke=1,fill=1)
c.restoreState()
rect(cx-W/2,cy+DEPTH,W,T,BLUE_LIGHT,BLUE,.8)
rect(cx-W/2,cy-DEPTH-T,W,T,PURPLE_LIGHT,PURPLE,.8)
line(cx-W/2,cy+DEPTH,cx+W/2,cy+DEPTH,RED,1)
line(cx-W/2,cy-DEPTH,cx+W/2,cy-DEPTH,RED,1)
line(cx,cy-R-5,cx,cy+R+.7,BLUE,.5,[5,3])
line(cx-R-5,cy,cx+R+5,cy,GREEN,.5,[5,3])
text(cx,cy+R+1.7,'FRONT / KEYPAD',8.5,BLUE,True,'center')
text(cx,cy-R-8,'BACK / INSIDE LOCK',8.5,PURPLE,True,'center')
text(cx-R-6,cy+4,'GAP',8,ORANGE,True,'right')
text(cx-R-6,cy,'SIDE',8,ORANGE,True,'right')
text(cx+R+6,cy+4,'HINGE',8,GREEN,True)
text(cx+R+6,cy,'SIDE',8,GREEN,True)
text(cx,cy+7,'52.93 mm plate',9,INK,True,'center')
arrow(cx-W/2,cy+3,cx+W/2,cy+3,INK,both=True)
text(cx,cy-5,'6.35 mm thick',8,INK,False,'center')
text(cx,cy-10,f'Face recess: {RECESS:.2f} mm',8,INK,False,'center')
text(16,85,'Blue / purple = plates. Red = seating cut planes.',7.7,MUTED)
text(16,80,'Pink = removed pipe. Gray-blue = remaining pipe wall.',7.7,MUTED)

# Right column: compact setup in chronological order.
rx,rw=139,124.4
def step(n,title,body,y,ink=BLUE):
    rect(rx,y-1.1,7,7,ink)
    text(rx+3.5,y+.8,str(n),10,'#FFFFFF',True,'center')
    text(rx+10,y+1,title,10.5,INK,True)
    return para(rx+10,y-5,body,rw-10,8.8,4.15)-5

y=181
y=step(1,'Print at actual size',
    'Use letter paper, landscape, 100% / Actual size. Disable Fit, Shrink and borderless expansion. Check both 2-inch gauges below and the 100 mm gauge. Page 1 is the wrap.',y)
y=step(2,'Confirm the pipe and plate',
    'This wrap assumes 73.025 mm (2-7/8 in) outside diameter and a 52.93 x 152.90 mm plate. Check your actual parts. Do not scale the entire page to suit a different pipe diameter.',y,ORANGE)
y=step(3,'Establish the front, then wrap',
    'Mark the keypad-side crown with a straightedge held horizontally, parallel to the closed gate face. Open the gate, expose the tube and align blue FRONT with that mark. Purple BACK is opposite; seam A/B faces the fixed post and green faces the hinges.',y,BLUE)
y=step(4,'Set height and check closure',
    'Keep TOP upward. Trim the gray perimeter, keep the tape tab, and tuck it underneath. Align Seam A exactly over Seam B. Set the plate center at your chosen height; the spindle is 47 mm lower. Keep the wrap snug and square, without stretching.',y,GREEN)
y=step(5,'Transfer, rough-cut and fit',
    'Transfer red boundaries and reference marks. Remove the paper before cutting. Keep the kerf on the waste side and leave stock for fitting. Finish the long cuts in the flat seating plane shown here, not radially toward the tube center. Support the gate and fit one side before opening the other.',y,RED)

# Scale checks in the left lower column, separated from setup instructions.
line(16,72,125,72,'#CAD5DF',.7)
text(16,65,'VERIFY PRINT SCALE',10,INK,True)
text(16,60,'Measure center-to-center between end ticks.',7.7,MUTED)
arrow(16,48,66.8,48,BLUE,both=True,head=1.6)
for xx in [16,66.8]:line(xx,45,xx,51,BLUE,.8)
text(41.4,53,'2.000 in / 50.80 mm',8,BLUE,True,'center')
arrow(128,12,128,62.8,PURPLE,both=True,head=1.6)
for yy in [12,62.8]:line(125,yy,131,yy,PURPLE,.8)
rotated(123,37.4,'2.000 in / 50.80 mm',8,PURPLE,bold=True)
line(16,25,116,25,INK,1)
for j in range(11):
    xx=16+j*10;line(xx,25,xx,28 if j%5 else 30,INK,.7)
    if j in [0,5,10]: text(xx,20,str(j*10),7.5,INK,False,'center')
text(66,33,'100.00 mm',8,INK,True,'center')
text(16,12,'Nominal geometry, not a guaranteed as-built fit.',7.4,MUTED)

# Source/precision notes: no implied ground-height or unverified hole drilling.
note_y=min(y-1,39)
line(rx,note_y+3,263.4,note_y+3,'#CAD5DF',.7)
para(rx,note_y-2,
     'Basis: supplied DXF outline + SolidWorks plate seating. CAD pipe OD is rounded to 73.000 mm; this wrap uses 73.025 mm. Window height uses the DXF: 152.90 mm. No weld clearance or kerf offset added. No above-ground installation height assumed.',rw,7.2,3.5,MUTED)
c.showPage();c.save()

geometry=dict(pipe_od_mm=D,pipe_wall_mm=WALL,plate_thickness_mm=T,plate_width_mm=W,
              plate_height_mm=H,circumference_mm=C,quarter_circumference_mm=C/4,
              surface_window_width_mm=ARC,seating_plane_from_axis_mm=DEPTH,
              crown_to_plate_face_mm=RECESS,spindle_below_plate_midheight_mm=47,
              added_clearance_mm=0,kerf_allowance_mm=0,
              template_axes=['gap seam','front / keypad','hinge side','back / inside lock','gap seam'],
              source_dxf_sha256='f3e1974f800dd2f8bc6a28a4b4e8a133715d3eeecd8c88105bcdef5fe847c3c6')
(OUT/'gate-upright-cut-wrap-dimensions.json').write_text(json.dumps(geometry,indent=2)+'\n')
assert abs(2*R*sin(ARC/(2*R))-W)<1e-9
assert X+C+TAB < PAGE_W-10 and TOP+BAND < PAGE_H-10
assert BOTTOM > 10 and abs((TOP-BOTTOM)-H)<1e-9
print(PDF)
print(json.dumps(geometry,indent=2))
