import argparse
import calendar
import hashlib
import json
import re
import unicodedata
from datetime import date, timedelta
from pathlib import Path

from pypdf import PdfReader


DAY_PATTERN = re.compile(r"†\s*(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*†")
MONTHS = {name: number for number, name in enumerate(calendar.month_name) if name}
DATE_PATTERN = re.compile(r"(" + "|".join(MONTHS) + r")\s+(\d{1,2})\s*\.*\s*([^\n]+)\n\s*(202[67])\s+(174[234])\s*")


def clean_text(value):
    value = re.sub(r"/f_f_i\s*", "ffi", value)
    value = re.sub(r"/f_f_l\s*", "ffl", value)
    value = re.sub(r"/f_i\s*", "fi", value)
    value = re.sub(r"/f_l\s*", "fl", value)
    value = unicodedata.normalize("NFKC", value)
    return "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines() if line.strip()).strip()


def extract_book(path):
    reader = PdfReader(path)
    entries = {}
    issues = []
    heading_count = 0
    duplicates = []
    for page_number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        headings = list(DAY_PATTERN.finditer(text))
        heading_count += len(headings)
        for position, heading in enumerate(headings):
            end = headings[position + 1].start() if position + 1 < len(headings) else len(text)
            block = text[heading.end():end].strip()
            matched_date = DATE_PATTERN.match(block)
            if not matched_date:
                raise ValueError(f"Unrecognized date in {path.name}, PDF page {page_number}: {block[:100]}")
            month, day, coptic, year, coptic_year = matched_date.groups()
            assigned_date = date(int(year), MONTHS[month], int(day))
            key = assigned_date.isoformat()
            body = clean_text(block[matched_date.end():])
            body = re.sub(r"\n[^\n]*Grade Daily Blessings 2026\s*-\s*2027 page[^\n]*$", "", body).strip()
            if key in entries:
                if entries[key]["originalText"] != body:
                    raise ValueError(f"Conflicting duplicate date {key} in {path.name}, page {page_number}")
                entries[key]["sourcePages"].append(page_number)
                duplicates.append({"date": key, "page": page_number, "message": "Identical repeated assignment; retained once."})
                continue
            reading_match = re.search(r"Reading:\s*", body)
            feast = body[:reading_match.start()].strip() if reading_match else body
            reading = ""
            prompt = ""
            if reading_match:
                reading_body = body[reading_match.end():]
                reading_lines = reading_body.splitlines()
                reading = reading_lines[0]
                prompt = "\n".join(reading_lines[1:]).strip()
                if reading.startswith("Verse of the week:"):
                    reading = reading_body
                    prompt = ""
                elif prompt.startswith("(") or reading.count("(") > reading.count(")"):
                    continuation, separator, rest = prompt.partition("\n")
                    reading += " " + continuation
                    prompt = rest if separator else ""
            warning = None
            if assigned_date.strftime("%A").upper() != heading.group(1):
                warning = f"The PDF labels this date {heading.group(1).title()}; the calendar date is {assigned_date.strftime('%A')}."
                issues.append({"date": key, "page": page_number, "message": warning})
            entries[key] = {
                "date": key,
                "weekdayInSource": heading.group(1).title(),
                "copticDate": clean_text(coptic) + ", " + coptic_year,
                "reading": reading,
                "prompt": prompt,
                "feast": feast,
                "originalText": body,
                "page": page_number,
                "sourcePages": [page_number],
                "source": path.name,
                "kind": "verse" if reading.startswith("Verse of the week:") else "reading" if reading else "observance",
                "warning": warning,
            }
    keys = sorted(entries)
    if not keys:
        raise ValueError(f"No assignments found in {path.name}")
    expected = (date.fromisoformat(keys[-1]) - date.fromisoformat(keys[0])).days + 1
    gaps = []
    current = date.fromisoformat(keys[0])
    while current <= date.fromisoformat(keys[-1]):
        if current.isoformat() not in entries:
            gaps.append(current.isoformat())
        current += timedelta(days=1)
    grades = [3, 4] if path.name.startswith("3-4-") else [int(path.name.split("-")[0])]
    return {
        "id": "-".join(map(str, grades)), "grades": grades, "file": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "pageCount": len(reader.pages), "startDate": keys[0], "endDate": keys[-1],
        "assignmentCount": len(entries), "headingCount": heading_count,
        "expectedDays": expected, "missingDates": gaps, "issues": issues, "duplicates": duplicates,
        "assignments": dict(sorted(entries.items())),
    }


def main():
    parser = argparse.ArgumentParser(description="Extract dated Daily Blessings assignments without paraphrasing.")
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "assignments.json")
    args = parser.parse_args()
    books = [extract_book(path) for path in sorted(args.source.glob("*.pdf"))]
    if not books:
        raise ValueError(f"No PDFs found in {args.source}")
    result = {"schemaVersion": 1, "title": "Daily Blessings", "edition": "2026–2027", "church": "St. Mary Coptic Orthodox Church", "books": books}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    report = [{key: book[key] for key in ["file", "grades", "assignmentCount", "headingCount", "startDate", "endDate", "missingDates", "issues", "duplicates"]} for book in books]
    args.output.with_name("extraction-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
