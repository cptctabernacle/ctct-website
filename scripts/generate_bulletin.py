"""
Generates assets/bulletin.pdf from the site's existing content files
(data/announcements.json, data/events.json, data/schedule.json) so the
weekly bulletin never has to be built from scratch by hand.

Usage:
    pip install reportlab --break-system-packages   (one-time)
    python3 scripts/generate_bulletin.py

Run this any time you've updated announcements/events for the week, then
push the updated assets/bulletin.pdf like any other file. If you'd rather
build bulletins in Word/Canva/Google Docs instead, that's completely fine
too - just export as PDF and overwrite assets/bulletin.pdf directly; this
script is a convenience, not a requirement.
"""

import json
import datetime
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "assets" / "bulletin.pdf"

ROYAL = HexColor("#1E3A8A")
NAVY = HexColor("#0B1330")
RED = HexColor("#C8102E")
GRAY = HexColor("#5B6178")
MIST = HexColor("#EEF1FB")

announcements = json.loads((DATA / "announcements.json").read_text())
events = json.loads((DATA / "events.json").read_text()).get("events", [])
schedule = json.loads((DATA / "schedule.json").read_text()).get("schedule", [])

styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title2", parent=styles["Title"], textColor=NAVY,
                              fontName="Helvetica-Bold", fontSize=20, alignment=TA_CENTER)
sub_style = ParagraphStyle("Sub", parent=styles["Normal"], textColor=GRAY,
                            fontSize=10, alignment=TA_CENTER, spaceAfter=4)
section_style = ParagraphStyle("Section", parent=styles["Heading2"], textColor=ROYAL,
                                fontName="Helvetica-Bold", fontSize=13, spaceBefore=16, spaceAfter=6)
body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9.5, leading=13.5, textColor=NAVY)
meta_style = ParagraphStyle("Meta", parent=styles["Normal"], fontSize=8.5, textColor=GRAY, spaceAfter=2)
verse_style = ParagraphStyle("Verse", parent=styles["Normal"], fontSize=11, leading=15,
                              alignment=TA_CENTER, textColor=NAVY, fontName="Helvetica-Oblique")

story = []

story.append(Paragraph("CAPE TOWN CHRISTIAN TABERNACLE", title_style))
story.append(Paragraph("39 De Villiers Street, Parowvallei, Cape Town", sub_style))
week_of = datetime.date.today().strftime("Week of %-d %B %Y")
story.append(Paragraph(week_of, sub_style))
story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", color=RED, thickness=2))
story.append(Spacer(1, 10))
story.append(Paragraph(
    '"Jesus Christ the same yesterday, and to day, and for ever." - Hebrews 13:8',
    verse_style
))
story.append(Spacer(1, 14))

# This week's preacher
potw = announcements.get("preacherOfTheWeek", {})
if potw:
    story.append(Paragraph("This Week's Message", section_style))
    story.append(Paragraph(
        f"<b>{potw.get('name','')}</b> - {potw.get('topic','')} &nbsp;&middot;&nbsp; {potw.get('date','')}",
        body_style
    ))

# Service schedule
story.append(Paragraph("Service Schedule", section_style))
sched_rows = [["Day", "Time", "Program", "Host"]]
for row in schedule:
    sched_rows.append([row.get("day",""), row.get("time",""), row.get("program",""), row.get("host","")])
t = Table(sched_rows, colWidths=[65*mm, 30*mm, 55*mm, 40*mm])
t.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), NAVY),
    ("TEXTCOLOR", (0,0), (-1,0), HexColor("#FFFFFF")),
    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 8.5),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [HexColor("#FFFFFF"), MIST]),
    ("TEXTCOLOR", (0,1), (-1,-1), NAVY),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#D8DCEE")),
    ("TOPPADDING", (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LEFTPADDING", (0,0), (-1,-1), 6),
]))
story.append(t)

# Announcements
story.append(Paragraph("Announcements", section_style))
items = sorted(announcements.get("items", []), key=lambda a: (not a.get("pinned"), a.get("date","")), reverse=False)
items = sorted(announcements.get("items", []), key=lambda a: a.get("date",""), reverse=True)
items = sorted(items, key=lambda a: not a.get("pinned", False))
for a in items:
    flag = " (PINNED)" if a.get("pinned") else ""
    story.append(Paragraph(f"<b>{a.get('title','')}</b>{flag}", body_style))
    story.append(Paragraph(a.get("body",""), meta_style))
    story.append(Spacer(1, 4))

# Upcoming events
upcoming = sorted(events, key=lambda e: e.get("date",""))[:4]
if upcoming:
    story.append(Paragraph("Upcoming Events", section_style))
    for e in upcoming:
        story.append(Paragraph(
            f"<b>{e.get('title','')}</b> - {e.get('date','')} at {e.get('time','')}, {e.get('location','')}",
            body_style
        ))
        story.append(Paragraph(e.get("body",""), meta_style))
        story.append(Spacer(1, 4))

story.append(Spacer(1, 12))
story.append(HRFlowable(width="100%", color=HexColor("#D8DCEE"), thickness=1))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "Giving: see the Give page on our website for current options &nbsp;&middot;&nbsp; "
    "info@christiantabernacle.co.za &nbsp;&middot;&nbsp; +27 82 964 4373",
    meta_style
))

doc = SimpleDocTemplate(str(OUT), pagesize=A4,
                         topMargin=18*mm, bottomMargin=18*mm,
                         leftMargin=20*mm, rightMargin=20*mm)
doc.build(story)
print(f"Wrote {OUT}")
