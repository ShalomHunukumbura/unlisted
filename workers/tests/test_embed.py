"""The text each job is embedded from (the model itself isn't loaded here)."""
from jobsite.embed import TEXT_CHARS, _vector, job_text


def test_title_first_and_twice():
    text = job_text("Data Engineer", "Analytics", "<p>About us: we sell shoes.</p><p>Build pipelines.</p>")
    assert text.startswith("Data Engineer. Data Engineer. Analytics. About us: we sell shoes.")
    assert "<p>" not in text


def test_no_department_or_description():
    assert job_text("Nurse", None, None).strip() == "Nurse. Nurse."


def test_capped_at_what_the_model_reads():
    assert len(job_text("Engineer", None, "<p>" + "word " * 2000 + "</p>")) == TEXT_CHARS


def test_vector_text_form():
    assert _vector([0.5, -0.25, 1e-7]) == "[0.50000,-0.25000,0.00000]"
