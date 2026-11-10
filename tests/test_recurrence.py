"""Répétitions des tâches et des événements."""

from datetime import date

from custom_components.foyer_malin.recurrence import next_after, normalize_recurrence, occurrences_between


def rec(freq, interval=1, until=None):
    return normalize_recurrence({"freq": freq, "interval": interval, "until": until})


def test_normalize_rejects_garbage():
    assert normalize_recurrence(None) == {"freq": "none", "interval": 1, "until": None}
    assert normalize_recurrence({"freq": "hourly", "interval": "x"})["freq"] == "none"
    assert normalize_recurrence({"freq": "weekly", "interval": 500, "until": "pas une date"}) == {
        "freq": "weekly",
        "interval": 99,
        "until": None,
    }


def test_next_after():
    assert next_after(date(2026, 11, 10), rec("none"), date(2026, 11, 10)) is None
    assert next_after(date(2026, 11, 10), rec("daily"), date(2026, 11, 10)) == date(2026, 11, 11)
    assert next_after(date(2026, 11, 10), rec("weekly", 2), date(2026, 11, 10)) == date(2026, 11, 24)
    # En retard de plusieurs semaines : on repart de la prochaine date à venir, sur le même jour de la semaine.
    assert next_after(date(2026, 11, 3), rec("weekly"), date(2026, 11, 26)) == date(2026, 12, 1)
    assert next_after(date(2026, 11, 10), rec("daily", until="2026-11-10"), date(2026, 11, 10)) is None


def test_monthly_keeps_the_original_day():
    # Le 31 : ramené à la fin des mois courts, sans glisser définitivement au 28.
    anchor = date(2026, 1, 31)
    assert next_after(anchor, rec("monthly"), date(2026, 1, 31)) == date(2026, 2, 28)
    assert next_after(anchor, rec("monthly"), date(2026, 2, 28)) == date(2026, 3, 31)
    assert next_after(date(2024, 2, 29), rec("yearly"), date(2024, 2, 29)) == date(2025, 2, 28)


def test_occurrences_between():
    assert occurrences_between(date(2026, 11, 10), rec("none"), date(2026, 11, 1), date(2026, 11, 30)) == [
        date(2026, 11, 10)
    ]
    assert occurrences_between(date(2026, 11, 10), rec("none"), date(2026, 12, 1), date(2026, 12, 31)) == []
    weekly = occurrences_between(date(2020, 1, 1), rec("weekly"), date(2026, 11, 9), date(2026, 11, 22))
    assert weekly == [date(2026, 11, 11), date(2026, 11, 18)]
    capped = occurrences_between(date(2026, 11, 1), rec("daily", 2, "2026-11-06"), date(2026, 11, 1), date(2026, 11, 30))
    assert capped == [date(2026, 11, 1), date(2026, 11, 3), date(2026, 11, 5)]
