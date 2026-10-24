from pathlib import Path

import pytest

from datahere.pipeline import load_sheet, match_headers

SAMPLE = Path(__file__).parent.parent / "sample" / "attendees_sample.csv"


def test_load_sample_csv():
    rows = load_sheet(SAMPLE)
    assert len(rows) == 6
    assert rows[0].name == "Alex Rivera" and rows[0].role == "CFO" and rows[0].company == "Sample Bowl Co."
    assert all(r.name == r.name.strip() and r.company for r in rows)


def test_header_matching():
    assert match_headers(["COMPANY", " name ", "Job Title"]) == {"name": 1, "role": 2, "company": 0}
    assert match_headers(["Name", "Company"]) == {"name": 0, "company": 1}
    with pytest.raises(ValueError):
        match_headers(["Name", "Role"])


def test_csv_skips_blank_rows_and_strips(tmp_path):
    f = tmp_path / "a.csv"
    f.write_text("company,ROLE,name\n  Acme ,  CEO , Jo Doe \n,,\n")
    rows = load_sheet(f)
    assert [(r.name, r.role, r.company) for r in rows] == [("Jo Doe", "CEO", "Acme")]
