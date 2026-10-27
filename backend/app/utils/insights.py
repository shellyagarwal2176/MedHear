"""Rule-based, explainable report assistant.

Turns the body parts, pain levels and signs a patient reported into:
  - a plain-language message for the care team
  - "possible meaning" insights with questions the care team may want to ask
  - a triage priority (emergency / urgent / routine) with the reasons

These are suggestions based on a fixed vocabulary, NOT a diagnosis. Wording is deliberately
"possible ..." and a healthcare professional always makes the call.
"""

REQUESTS = ("doctor", "help", "assistance")
MODIFIERS = {"bad": "bad", "again": "recurring"}  # severity first, then recurrence
NOUN_SYMPTOMS = ("pain", "pressure")
STATES = ("hot", "sick", "thirsty", "hungry")
AGREE_TO = {"doctor": "see the doctor", "help": "help", "assistance": "assistance"}
# A body part with none of these chosen just means "it hurts here"
SYMPTOM_SIGNS = {"pain", "pressure", "hot", "sick", "thirsty", "hungry", "skin", "problem"}
DISCLAIMER = (
    "AI-assisted suggestions based only on the signs and body parts reported. "
    "They are possibilities, not a diagnosis. A healthcare professional must assess the patient."
)
LEVEL_LABELS = {1: "mild", 2: "noticeable", 3: "painful", 4: "severe", 5: "unbearable"}

CENTER_LABELS = {
    "head": "Head", "neck": "Neck", "chest": "Chest", "abdomen": "Stomach", "pelvis": "Hips & groin",
    "back-head": "Back of head", "back-neck": "Back of neck", "upper-back": "Upper back",
    "lower-back": "Lower back", "buttocks": "Buttocks", "scalp": "Top of head", "forehead": "Forehead",
    "jaw": "Jaw & chin", "right-ear": "Right ear", "left-ear": "Left ear", "right-eye": "Right eye",
    "left-eye": "Left eye", "nose": "Nose", "mouth": "Mouth & teeth",
}
SIDED_LABELS = {
    "shoulder": "shoulder", "upper-arm": "upper arm", "forearm": "forearm", "hand": "hand",
    "thigh": "thigh", "knee": "knee", "shin": "lower leg", "foot": "foot",
}
ARM = {"shoulder", "upper-arm", "forearm", "hand"}

REGION = {
    "chest": "chest", "abdomen": "abdomen", "pelvis": "pelvis", "buttocks": "pelvis",
    "head": "head", "scalp": "head", "forehead": "head", "back-head": "head", "jaw": "head",
    "neck": "neck", "back-neck": "neck", "upper-back": "back", "lower-back": "back",
    "right-ear": "ear", "left-ear": "ear", "right-eye": "eye", "left-eye": "eye",
    "nose": "face", "mouth": "mouth",
}


def part_label(part_id: str) -> str:
    if part_id in CENTER_LABELS:
        return CENTER_LABELS[part_id]
    side, _, base = part_id.partition("-")
    if side in ("left", "right") and base in SIDED_LABELS:
        return f"{side.capitalize()} {SIDED_LABELS[base]}"
    return part_id


def region_of(part_id: str) -> str:
    if part_id in REGION:
        return REGION[part_id]
    base = part_id.partition("-")[2]
    return "arm" if base in ARM else "leg"


def _clause(part: str | None, signs: list[str]) -> str:
    """One phrase for everything reported about a single body part (or about no part)."""
    label = part_label(part).lower() if part else ""
    adj = ", ".join(MODIFIERS[m] for m in MODIFIERS if m in signs)  # bad before recurring
    core = [s for s in signs if s in NOUN_SYMPTOMS or s in STATES]
    pieces: list[str] = []

    if core:
        joined = " and ".join(core) if all(s in NOUN_SYMPTOMS for s in core) else ", ".join(core)
        pieces.append(f"{adj + ' ' if adj else ''}{joined}" + (f" in the {label}" if part else ""))
    if "skin" in signs:
        own_adj = "" if core else adj
        pieces.append(f"a {own_adj + ' ' if own_adj else ''}skin problem" + (f" on the {label}" if part else ""))
    elif not core and ("problem" in signs or part or adj):
        pieces.append(f"a {adj + ' ' if adj else ''}problem" + (f" with the {label}" if part else ""))

    if "stand" in signs and pieces:
        pieces[-1] += " when standing"
    return "; ".join(pieces)


def build_message(items: list[dict]) -> str:
    groups: dict[str | None, list[str]] = {}
    requests: list[str] = []
    greets = agrees = False
    for it in items:
        sign, part = it.get("sign"), it.get("part")
        if sign == "how are you":
            greets = True
        elif sign == "agree":
            agrees = True
        elif sign in REQUESTS:
            if sign not in requests:
                requests.append(sign)
        else:
            signs = groups.setdefault(part, [])
            if sign and sign not in signs:
                signs.append(sign)

    clauses = []
    general = groups.pop(None, None)
    for part, signs in groups.items():
        clauses.append(_clause(part, signs))
    if general is not None:
        text = _clause(None, general)
        if "stand" in general and not text:
            if clauses:
                clauses[-1] += " when standing"
            else:
                text = "difficulty standing"
        if text:
            clauses.append(text)

    sentences = []
    if clauses:
        sentences.append(f"Patient {'greets and ' if greets else ''}indicates {'; '.join(clauses)}.")
    elif greets:
        sentences.append("Patient greets.")
    if agrees:
        what = " and ".join(AGREE_TO.get(r, r) for r in requests)
        sentences.append(f"Patient agrees to {what}." if what else "Patient agrees.")
    elif requests:
        sentences.append(f"Requesting {', '.join(requests)}.")
    return " ".join(sentences) or "No signs recorded."


def _insight(text: str, tone: str = "info", ask: list[str] | None = None) -> dict:
    return {"text": text, "tone": tone, "ask": ask or []}


def _part_insights(part_id: str, signs: set[str], level: int | None, all_signs: set[str]) -> list[dict]:
    region = region_of(part_id)
    label = part_label(part_id).lower()
    sev = f" (level {level} of 5, {LEVEL_LABELS[level]})" if level else ""
    # Choosing a body part and a pain level without any sign still means "it hurts here"
    pain = "pain" in signs or not (signs & SYMPTOM_SIGNS)
    pressure = "pressure" in signs
    hot = "hot" in signs
    sick = "sick" in all_signs
    bad = "bad" in all_signs
    out: list[dict] = []

    if region == "chest":
        chest_ask = [
            "Does the pain spread to the arm, jaw or back?",
            "Any breathlessness, sweating, nausea or dizziness?",
            "When did it start, and is it constant or does it come and go?",
        ]
        if pressure:
            out.append(_insight(
                f"Chest pressure{' with pain' if 'pain' in signs else ''}{', described as bad' if bad else ''}{sev}. "
                "Pressure or tightness in the chest can be a heart-related warning sign and needs prompt assessment.",
                "alert", chest_ask + ["Is it brought on by effort or relieved by rest?"]))
        elif pain and hot:
            out.append(_insight(
                f"Possible burning chest pain: a burning sensation in the chest with pain{sev}. "
                "This can be acid reflux, but chest pain must always be assessed promptly.",
                "alert", chest_ask + ["Is it worse after meals or when lying down (reflux)?"]))
        elif pain:
            out.append(_insight(f"Chest pain reported{sev}.", "alert", chest_ask))
        elif hot:
            out.append(_insight("A burning or hot feeling in the chest.", "watch",
                                ["Is there any pain, cough or breathlessness with it?"]))
    elif region == "head":
        if pain and hot:
            out.append(_insight(f"Possible headache with a feeling of heat (possible fever){sev}.", "watch",
                                ["Any fever, neck stiffness, vomiting or light sensitivity?"]))
        elif pain:
            tone = "alert" if level and level >= 4 else "watch"
            out.append(_insight(f"Head pain / headache{sev}.", tone,
                                ["Sudden or gradual onset? Any vision change, weakness or confusion?"]))
        elif hot:
            out.append(_insight("A feeling of heat in the head.", "info", ["Check temperature."]))
    elif region == "abdomen":
        if pain and hot:
            out.append(_insight(f"Possible abdominal pain with a burning sensation or fever{sev}.", "watch",
                                ["Where exactly is the pain? Any vomiting, diarrhoea or fever?"]))
        elif pain and sick:
            out.append(_insight(f"Abdominal pain with feeling sick: possible stomach upset or nausea{sev}.", "watch",
                                ["Any vomiting, diarrhoea, or recent food that may have caused it?"]))
        elif pain:
            out.append(_insight(f"Abdominal (stomach) pain{sev}.", "watch",
                                ["Where is the pain, and is it constant or cramping?"]))
        elif hot:
            out.append(_insight("A burning feeling in the stomach area.", "info",
                                ["Is it related to meals (possible acidity)?"]))
    elif region == "back":
        if pain and hot:
            out.append(_insight(f"Back pain with heat in the {label}: possible muscle strain or inflammation{sev}.", "info"))
        elif pain:
            out.append(_insight(f"Pain in the {label}{sev}.", "info",
                                ["Any injury, numbness or weakness in the legs?"]))
    elif region in ("arm", "leg"):
        if pain and hot:
            out.append(_insight(f"Pain with heat in the {label}: possible inflammation or injury{sev}.", "watch",
                                ["Any swelling, redness or recent injury?"]))
        elif pain:
            out.append(_insight(f"Pain in the {label}{sev}.", "info",
                                ["Any injury, swelling or difficulty moving it?"]))
        elif hot:
            out.append(_insight(f"A hot feeling in the {label}.", "info"))
    else:  # neck, eyes, ears, mouth, nose, pelvis
        if pain:
            asks = {"eye": ["Any change in vision, redness or injury?"],
                    "ear": ["Any hearing change, discharge or fever?"],
                    "mouth": ["Is it a tooth, gum or jaw problem?"]}.get(region, [])
            out.append(_insight(f"Pain in the {label}{sev}.", "watch" if region == "eye" else "info", asks))
        elif hot:
            out.append(_insight(f"A hot feeling in the {label}.", "info"))

    if pressure and region != "chest":
        asks = ["Is it constant, or does it come and go?"]
        if region == "head":
            out.append(_insight(f"Pressure in the head: possible tension headache or sinus pressure{sev}.", "watch",
                                asks + ["Any vision change, vomiting or blocked nose?"]))
        else:
            out.append(_insight(f"Pressure in the {label}{sev}.", "info", asks))
    if "stand" in signs and region in ("leg", "back"):
        if pain or "problem" in signs:
            out.append(_insight(f"{'Pain' if pain else 'A problem'} in the {label} when standing: possible joint, muscle or bone problem.", "watch",
                                ["Any injury, swelling, or trouble putting weight on it?"]))
    elif "problem" in signs and not (pain or pressure or "skin" in signs):
        out.append(_insight(f"A problem with the {label} (type not specified).", "info", ["What kind of problem is it?"]))

    if "skin" in signs:
        if hot:
            out.append(_insight(f"Skin problem with heat on the {label}: possible rash, burn or inflammation.", "watch",
                                ["Any redness, swelling, blisters or spreading?"]))
        elif pain:
            out.append(_insight(f"Painful skin problem on the {label}.", "info"))
        else:
            out.append(_insight(f"Skin problem on the {label}.", "info", ["Any rash, itching or recent contact with irritants?"]))
    return out


def analyze(items: list[dict], sos: bool = False) -> dict:
    parts: dict[str, dict] = {}
    general: set[str] = set()
    requests: list[str] = []
    agrees = False
    for it in items:
        sign, part, level =it.get("sign"), it.get("part"), it.get("level")
        if sign in REQUESTS:
            if sign not in requests:
                requests.append(sign)
            continue
        if sign == "agree":
            agrees = True
            continue
        if sign == "how are you":
            continue
        if part:
            p = parts.setdefault(part, {"signs": set(), "level": None})
            if sign:
                p["signs"].add(sign)
            if level:
                p["level"] = max(p["level"] or 0, level)
        elif sign:
            general.add(sign)

    all_signs = set(general)
    for p in parts.values():
        all_signs |= p["signs"]
    if agrees:  # "doctor + agree" answers an offer; it is not a new request
        requests = []
    real_level = max([p["level"] or 0 for p in parts.values()] + [0])
    bad, again = "bad" in all_signs, "again" in all_signs
    max_level = max(real_level, 4) if bad else real_level  # "bad" counts as severe

    insights: list[dict] = []
    for pid, p in parts.items():
        insights += _part_insights(pid, p["signs"], p["level"], all_signs)

    hot, sick, thirsty, hungry = "hot" in all_signs, "sick" in all_signs, "thirsty" in all_signs, "hungry" in all_signs
    if again:
        insights.append(_insight("The patient says this has happened before (recurring).", "watch",
                                 ["When did it first start and how often does it return?", "Has it been treated before, and did that help?"]))
    if "problem" in general and not parts:
        insights.append(_insight("A problem was reported without saying where or what.", "info",
                                 ["What is the problem, and which part of the body is it in?"]))
    if hungry and not thirsty:
        insights.append(_insight("Hunger reported" + (" together with feeling unwell." if sick else "."), "info",
                                 ["When did the patient last eat? Any diabetes (low blood sugar)?"]))
    if thirsty:
        if sick and hot:
            insights.append(_insight("Thirst with feeling unwell and heat: possible dehydration, possibly with fever or infection.", "watch",
                                     ["Recent fluid intake? Any vomiting or diarrhoea? Check temperature and hydration."]))
        elif sick:
            insights.append(_insight("Thirst with feeling unwell: possible dehydration.", "watch",
                                     ["Recent fluid intake? Any vomiting or diarrhoea? Check hydration and vital signs."]))
        elif hot:
            insights.append(_insight("Heat with thirst: possible fever or dehydration (for example after heat exposure or illness).", "watch",
                                     ["Check temperature. Any fever, sweating, vomiting or diarrhoea?",
                                      "Recent fluid intake? Any time spent in the heat?"]))
        elif hungry:
            insights.append(_insight("Hunger and thirst together: possible dehydration or a blood sugar problem.", "watch",
                                     ["Any diabetes? When did the patient last eat and drink?", "Check blood sugar."]))
        else:
            insights.append(_insight("Extreme thirst: possible dehydration.", "info",
                                     ["Recent fluid intake? Any frequent urination (possible high blood sugar)?"]))
    if sick and hot and not thirsty:
        insights.append(_insight("Feeling unwell with heat: possible fever or infection.", "watch", ["Check temperature."]))
    elif sick and not hot and not thirsty and not parts:
        insights.append(_insight("Feeling unwell: possible nausea, weakness or illness.", "info",
                                 ["Any vomiting, fever, dizziness or pain anywhere?"]))
    elif hot and not parts and not sick and not thirsty:
        insights.append(_insight("Feeling hot: possible fever.", "info", ["Check temperature."]))
    if "skin" in general:
        insights.append(_insight("Skin problem reported (no body part chosen).", "info", ["Which part of the body is affected?"]))

    # ---- triage priority ----
    reasons: list[str] = []
    chest = next((p for pid, p in parts.items() if region_of(pid) == "chest"), None)
    chest_pain = chest is not None and ("pain" in chest["signs"] or not (chest["signs"] & SYMPTOM_SIGNS))
    chest_pressure = chest is not None and "pressure" in chest["signs"]
    emergency = urgent = False

    if sos:
        emergency = True
        reasons.append("Patient pressed the emergency (SOS) button")
    if chest_pain and ((chest["level"] or 0) >= 4 or sick):
        emergency = True
        reasons.append("Chest pain that is severe or comes with feeling sick")
    if chest_pressure and (bad or sick or "pain" in chest["signs"] or (chest["level"] or 0) >= 4):
        emergency = True
        reasons.append("Chest pressure that comes with pain, feeling sick or is described as bad")
    if ("help" in requests or "assistance" in requests) and real_level >= 5:
        emergency = True
        reasons.append("Unbearable pain with a request for help")

    if chest is not None and not emergency:
        urgent = True
        reasons.append("Chest symptoms reported" + (" (pain with a burning feeling)" if chest_pain and hot else ""))
    if real_level >= 4:
        urgent = True
        reasons.append(f"Severe pain reported (level {real_level} of 5)")
    elif bad:
        urgent = True
        reasons.append("Patient describes the problem as bad")
    if "assistance" in requests:
        urgent = True
        reasons.append("Patient asked for assistance")
    if "help" in requests and max_level >= 3:
        urgent = True
        reasons.append("Patient asked for help with significant pain")
    if thirsty and sick and hot:
        urgent = True
        reasons.append("Thirst, feeling unwell and heat together (possible dehydration or infection)")
    for pid, p in parts.items():
        if region_of(pid) in ("head", "abdomen") and "pain" in p["signs"] and "hot" in p["signs"]:
            urgent = True
            reasons.append(f"Pain with heat in the {part_label(pid).lower()}")

    priority = "emergency" if emergency else "urgent" if urgent else "routine"
    seen, unique_reasons = set(), []
    for r in reasons:
        if r not in seen:
            seen.add(r)
            unique_reasons.append(r)

    return {
        "message": "EMERGENCY ALERT: Patient needs immediate help." if sos else build_message(items),
        "insights": insights,
        "priority": priority,
        "priority_reasons": unique_reasons,
        "disclaimer": DISCLAIMER,
    }
