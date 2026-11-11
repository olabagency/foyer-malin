"""Répétitions des tâches et des événements."""

from datetime import date

from custom_components.foyer_malin.recurrence import next_after, normalize_recurrence, occurrences_between, upcoming


def rec(freq, interval=1, until=None, **extra):
    return normalize_recurrence({"freq": freq, "interval": interval, "until": until, **extra})


def test_normalize_rejects_garbage():
    assert normalize_recurrence(None) == {
        "freq": "none", "interval": 1, "until": None, "weekdays": [], "weeks": [0], "month_mode": "day",
    }
    assert normalize_recurrence({"freq": "hourly", "interval": "x"})["freq"] == "none"
    assert normalize_recurrence({"freq": "weekly", "interval": 500, "until": "pas une date"})["interval"] == 99
    # Jours et semaines : valeurs hors limites ou inutiles écartées.
    weekly = rec("weekly", 3, weekdays=[3, 0, 9, "x", 3], weeks=[2, 0, 5])
    assert (weekly["weekdays"], weekly["weeks"]) == ([0, 3], [0, 2])
    assert rec("weekly", 3, weeks=[7])["weeks"] == [0]
    assert rec("daily", weekdays=[1], weeks=[0], month_mode="last_day") == rec("daily")
    assert rec("monthly", month_mode="last_day")["month_mode"] == "last_day"
    assert rec("monthly", month_mode="nimporte")["month_mode"] == "day"


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


def test_weekdays_in_every_other_week():
    # « Une semaine sur deux, le lundi et le jeudi, à partir du lundi 23 novembre. »
    every_other = rec("weekly", 2, weekdays=[0, 3])
    assert upcoming(date(2026, 11, 23), every_other, 5) == [
        date(2026, 11, 23), date(2026, 11, 26), date(2026, 12, 7), date(2026, 12, 10), date(2026, 12, 21),
    ]
    # Même résultat en partant de loin : la phase du cycle est celle de la date de départ.
    assert occurrences_between(date(2026, 11, 23), every_other, date(2027, 1, 1), date(2027, 1, 14)) == [
        date(2027, 1, 4), date(2027, 1, 7)
    ]


def test_cycle_of_weeks_on_and_off():
    # Deux semaines sur trois, à partir du lundi 2 novembre (jour de la date de départ).
    two_of_three = rec("weekly", 3, weeks=[0, 1])
    assert upcoming(date(2026, 11, 2), two_of_three, 5) == [
        date(2026, 11, 2), date(2026, 11, 9), date(2026, 11, 23), date(2026, 11, 30), date(2026, 12, 14),
    ]
    # Semaine « 2 » seulement d'un cycle de deux : la semaine suivant la date de départ.
    second_week = rec("weekly", 2, weeks=[1])
    assert occurrences_between(date(2026, 11, 2), second_week, date(2026, 11, 3), date(2026, 11, 30)) == [
        date(2026, 11, 9), date(2026, 11, 23)
    ]


def test_start_date_is_always_the_first_occurrence():
    # Départ un mardi, motif « lundi et jeudi » : le mardi compte, puis le motif prend le relais.
    assert upcoming(date(2026, 11, 10), rec("weekly", weekdays=[0, 3]), 4) == [
        date(2026, 11, 10), date(2026, 11, 12), date(2026, 11, 16), date(2026, 11, 19)
    ]
    assert occurrences_between(date(2026, 11, 10), rec("weekly", weekdays=[0, 3]), date(2026, 11, 11), date(2026, 11, 13)) == [
        date(2026, 11, 12)
    ]
    # La tâche faite le mardi passe au prochain jour du motif.
    assert next_after(date(2026, 11, 10), rec("weekly", weekdays=[0, 3]), date(2026, 11, 10)) == date(2026, 11, 12)


def test_monthly_modes():
    # Départ le 2e mardi de novembre 2026 (le 10).
    second_tuesday = date(2026, 11, 10)
    assert upcoming(second_tuesday, rec("monthly", month_mode="nth_weekday"), 4) == [
        date(2026, 11, 10), date(2026, 12, 8), date(2027, 1, 12), date(2027, 2, 9)
    ]
    assert upcoming(second_tuesday, rec("monthly", month_mode="last_weekday"), 3) == [
        date(2026, 11, 10), date(2026, 11, 24), date(2026, 12, 29)
    ]
    assert upcoming(date(2026, 1, 15), rec("monthly", month_mode="last_day"), 4) == [
        date(2026, 1, 15), date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)
    ]
    # Un 5e mardi n'existe pas tous les mois : ce sera le dernier.
    fifth_tuesday = date(2026, 12, 29)
    assert upcoming(fifth_tuesday, rec("monthly", month_mode="nth_weekday"), 3) == [
        date(2026, 12, 29), date(2027, 1, 26), date(2027, 2, 23)
    ]
    assert next_after(second_tuesday, rec("monthly", 2, month_mode="nth_weekday"), date(2026, 11, 10)) == date(2027, 1, 12)


def test_every_two_months_and_years_far_from_the_start():
    assert occurrences_between(date(2020, 1, 15), rec("monthly", 2), date(2026, 11, 1), date(2027, 1, 31)) == [
        date(2026, 11, 15), date(2027, 1, 15)
    ]
    assert occurrences_between(date(2000, 3, 1), rec("yearly", 5), date(2026, 1, 1), date(2031, 12, 31)) == [
        date(2030, 3, 1)
    ]
    # La fin de la répétition est respectée.
    assert upcoming(date(2026, 11, 2), rec("weekly", until="2026-11-20", weekdays=[0, 4]), 10) == [
        date(2026, 11, 2), date(2026, 11, 6), date(2026, 11, 9), date(2026, 11, 13), date(2026, 11, 16), date(2026, 11, 20)
    ]
