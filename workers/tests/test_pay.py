"""Pay ranges: from posting text (pay.py) and from the ATS fields."""
import json
from pathlib import Path

import pytest

from jobsite import connectors, pay
from jobsite.models import Company, NormalizedJob

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize("text, expected", [
    # Real phrasings from stored postings.
    ("Salary Range$72,000—$75,000 USD Diversity", (72_000, 75_000, "USD", "year")),
    ("The salary range is $115,000 - $149,000 USD per year.", (115_000, 149_000, "USD", "year")),
    ("between $140,400 and $232,200/year", (140_400, 232_200, "USD", "year")),
    ("is $200,000.00 USD to $230,000.00 USD", (200_000, 230_000, "USD", "year")),
    ("Compensation: £50,000-£60,000/annually plus bonus", (50_000, 60_000, "GBP", "year")),
    ("€45.000 - €55.000", (45_000, 55_000, "EUR", "year")),
    ("£50k - £60k", (50_000, 60_000, "GBP", "year")),
    ("Total compensation range:$100,000—$120,000 CAD", (100_000, 120_000, "CAD", "year")),
    ("Pay Range: $31.52 - $40.98/hr.", (31.52, 40.98, "USD", "hour")),
    ("Pay: $16-16.50/hr, plus bonus", (16, 16.5, "USD", "hour")),
    ("Hourly Rate$20—$26 USD", (20, 26, "USD", "hour")),
    ("Starting Pay: $19.50/hour", (19.5, 19.5, "USD", "hour")),
    ("Base Salary: $68,000 Bonus Potential", (68_000, 68_000, "USD", "year")),
])
def test_reads_stated_pay(text, expected):
    found = pay.from_text(text)
    assert (found["comp_min"], found["comp_max"], found["comp_currency"], found["comp_period"]) == expected


@pytest.mark.parametrize("text", [
    "We raised a $40M Series B and serve $2B in payments.",
    "$65.00 - $75.00 per point",                       # a rate for something else
    "($70,000 Base + $22,500 Variable)",               # the + figure is a bonus
    "Compensation: OTE: $126,500",                     # commission included
    "Join 5,000 - 10,000 customers",                    # no currency
    "",
])
def test_ignores_numbers_that_are_not_pay(text):
    assert pay.from_text(text) is None


def test_a_bare_dollar_follows_the_job_country():
    assert pay.from_text("$120,000 - $150,000", country="CA")["comp_currency"] == "CAD"
    assert pay.from_text("$120,000 - $150,000", country="US")["comp_currency"] == "USD"


def load(ats: str) -> list[dict]:
    return json.loads((FIXTURES / f"{ats}.json").read_text())


@pytest.mark.parametrize("ats, expected", [
    ("greenhouse", (165_000, 190_000, "USD", "year")),  # Figma, in the text
    ("lever", (60_000, 97_000, "USD", "year")),         # Palantir, in the text
])
def test_connectors_fill_pay_from_the_posting(ats, expected):
    conn = connectors.get(ats)
    company = Company(id=1, name=ats, ats=ats, board_token=ats)
    jobs = [conn.normalize_job(company, raw) for raw in load(ats)]
    found = {(j.comp_min, j.comp_max, j.comp_currency, j.comp_period) for j in jobs if j.comp_min}
    assert expected in found


def ashby_raw(components: list[dict]) -> dict:
    return {"id": "x", "title": "Engineer", "jobUrl": "https://jobs.ashbyhq.com/x",
            "compensation": {"summaryComponents": components}}


def test_ashby_takes_the_salary_not_equity_listed_first():
    raw = ashby_raw([
        {"compensationType": "EquityPercentage", "interval": "NONE", "minValue": 0.1, "maxValue": 0.5},
        {"compensationType": "Salary", "interval": "1 YEAR", "minValue": 150000,
         "maxValue": 180000, "currencyCode": "USD"},
    ])
    job = connectors.get("ashby").normalize(Company(1, "a", "ashby", "a"), raw)
    assert (job.comp_min, job.comp_max, job.comp_currency, job.comp_period) == (150000, 180000, "USD", "year")


def test_ashby_without_a_salary_has_no_pay():
    raw = ashby_raw([{"compensationType": "Bonus", "interval": "1 YEAR", "minValue": 5000,
                      "currencyCode": "USD"}])
    job = connectors.get("ashby").normalize(Company(1, "a", "ashby", "a"), raw)
    assert job.comp_min is None and job.comp_period is None


def test_lever_salary_range_field():
    raw = {"id": "l1", "text": "Engineer", "hostedUrl": "https://jobs.lever.co/x/l1",
           "salaryRange": {"min": 90000, "max": 120000, "currency": "EUR", "interval": "per-year-salary"}}
    job = connectors.get("lever").normalize(Company(1, "l", "lever", "l"), raw)
    assert (job.comp_min, job.comp_max, job.comp_currency, job.comp_period) == (90000, 120000, "EUR", "year")


def test_pay_from_text_does_not_change_the_fingerprint():
    # Otherwise shipping (or improving) the parser rewrites every job with pay.
    plain = NormalizedJob(external_id="1", title="t", apply_url="u", description_text="Pay $20-$25/hr")
    parsed = NormalizedJob(external_id="1", title="t", apply_url="u", description_text="Pay $20-$25/hr",
                           comp_min=20, comp_max=25, comp_currency="USD", comp_period="hour",
                           pay_from_text=True)
    assert parsed.content_hash() == plain.content_hash()
    parsed.pay_from_text = False  # an ATS field is real data: it counts
    assert parsed.content_hash() != plain.content_hash()
