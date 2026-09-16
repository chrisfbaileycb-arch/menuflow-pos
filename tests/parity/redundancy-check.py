"""
redundancy-check.py
Signal F Holdings LLC — Heartland POS Audit Tool

PURPOSE:
Finds redundant data entry in the menu — modifiers, items, or
categories that have been typed manually multiple times instead
of being configured as proper shared groups.

Classic example: "pepperoni" entered as a separate modifier 22 times
instead of once as a proper modifier group.

USAGE:
  python redundancy-check.py --input menu-export.json --output redundancy-report.json
"""

import json
import argparse
from collections import defaultdict


def load_menu(filepath: str) -> list:
    with open(filepath, "r") as f:
        return json.load(f)


def check_modifier_redundancy(menu_items: list) -> list:
    """Find modifier names that appear far too many times."""
    modifier_counts = defaultdict(list)

    for item in menu_items:
        item_name = item.get("name", "Unknown")
        for mod in item.get("modifiers", []):
            mod_name = mod.get("name", "").strip().lower()
            if mod_name:
                modifier_counts[mod_name].append(item_name)

    redundancies = []
    for mod_name, items in modifier_counts.items():
        count = len(items)
        if count > 5:  # appearing more than 5 times warrants a flag
            severity = "HIGH" if count > 15 else "MEDIUM"
            redundancies.append({
                "type": "Redundant Modifier",
                "name": mod_name,
                "occurrence_count": count,
                "severity": severity,
                "appears_on": items[:10],  # show first 10 for readability
                "maintenance_risk": (
                    f"If '{mod_name}' needs a price change, it must be updated {count} times manually. "
                    f"One missed update creates pricing inconsistency."
                ),
                "recommendation": f"Create one '{mod_name}' modifier group and assign it to relevant items. Reduce to 1 entry."
            })

    redundancies.sort(key=lambda x: (0 if x["severity"] == "HIGH" else 1, -x["occurrence_count"]))
    return redundancies


def check_item_name_duplicates(menu_items: list) -> list:
    """Find menu items with identical or near-identical names."""
    item_names = defaultdict(list)

    for item in menu_items:
        name = item.get("name", "").strip().lower()
        category = item.get("category", "Uncategorized")
        if name:
            item_names[name].append({"name": item.get("name"), "category": category})

    duplicates = []
    for name, entries in item_names.items():
        if len(entries) > 1:
            duplicates.append({
                "type": "Duplicate Item Name",
                "name": name,
                "occurrences": entries,
                "count": len(entries),
                "recommendation": "Verify these are intentional (e.g., same item in different categories) or consolidate."
            })

    return duplicates


def check_midnight_violations(menu_items: list) -> list:
    """Find time ranges that cross midnight (end_time < start_time)."""
    violations = []

    def time_to_minutes(t: str) -> int:
        """Convert time string to minutes since midnight for comparison."""
        try:
            t = t.strip().upper()
            is_pm = "PM" in t
            is_am = "AM" in t
            t = t.replace("AM", "").replace("PM", "").strip()
            parts = t.split(":")
            hours = int(parts[0])
            minutes = int(parts[1]) if len(parts) > 1 else 0
            if is_pm and hours != 12:
                hours += 12
            if is_am and hours == 12:
                hours = 0
            return hours * 60 + minutes
        except Exception:
            return -1

    for item in menu_items:
        item_name = item.get("name", "Unknown")
        time_ranges = item.get("time_ranges", [])

        for tr in time_ranges:
            start = tr.get("start", "")
            end = tr.get("end", "")
            if start and end:
                start_min = time_to_minutes(start)
                end_min = time_to_minutes(end)
                if start_min > 0 and end_min > 0 and end_min < start_min:
                    violations.append({
                        "type": "Midnight Rule Violation",
                        "item": item_name,
                        "range": f"{start} – {end}",
                        "severity": "HIGH",
                        "explanation": "End time is earlier than start time. This range crosses midnight and must be split into two entries.",
                        "fix": f"Split into: [{start} – 11:59 PM] and [12:00 AM – {end}] on the next calendar day."
                    })

    return violations


def main():
    parser = argparse.ArgumentParser(description="Heartland POS Redundancy & Configuration Check")
    parser.add_argument("--input", required=True, help="Path to menu export JSON")
    parser.add_argument("--output", default="redundancy-report.json", help="Output report path")
    args = parser.parse_args()

    menu_items = load_menu(args.input)

    modifier_redundancies = check_modifier_redundancy(menu_items)
    item_duplicates = check_item_name_duplicates(menu_items)
    midnight_violations = check_midnight_violations(menu_items)

    report = {
        "report_type": "Redundancy & Configuration Check",
        "system": "Heartland POS",
        "generated_by": "Signal F Holdings LLC — redundancy-check.py",
        "summary": {
            "total_items_scanned": len(menu_items),
            "redundant_modifiers": len(modifier_redundancies),
            "duplicate_items": len(item_duplicates),
            "midnight_violations": len(midnight_violations),
        },
        "redundant_modifiers": modifier_redundancies,
        "duplicate_items": item_duplicates,
        "midnight_rule_violations": midnight_violations
    }

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*60}")
    print(f"REDUNDANCY CHECK COMPLETE")
    print(f"{'='*60}")
    print(f"Redundant modifiers:  {len(modifier_redundancies)}")
    print(f"Duplicate items:      {len(item_duplicates)}")
    print(f"Midnight violations:  {len(midnight_violations)}")
    print(f"\nFull report saved to: {args.output}")


if __name__ == "__main__":
    main()
