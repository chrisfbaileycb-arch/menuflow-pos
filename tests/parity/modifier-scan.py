"""
modifier-scan.py
Signal F Holdings LLC — Heartland POS Audit Tool

PURPOSE:
Scans extracted menu data for modifier cross-contamination.
Identifies modifiers that appear on multiple item categories
(the "pepperoni problem") and flags them as isolation violations.

USAGE:
  python modifier-scan.py --input menu-export.json --output audit-report.json

INPUT:
  JSON file produced by the Heartland menu extraction script.
  Expected structure: list of menu items, each with a 'modifiers' array.

OUTPUT:
  JSON audit report listing all cross-contamination violations.
"""

import json
import argparse
from collections import defaultdict


def load_menu(filepath: str) -> list:
    with open(filepath, "r") as f:
        return json.load(f)


def scan_modifier_crosscontamination(menu_items: list) -> dict:
    """
    For each modifier name, track which item categories it appears on.
    Flag any modifier appearing on more than one category.
    """
    # modifier_name -> set of categories it appears on
    modifier_map = defaultdict(set)
    modifier_items = defaultdict(list)  # for reporting which specific items

    for item in menu_items:
        category = item.get("category", "Uncategorized")
        modifiers = item.get("modifiers", [])
        item_name = item.get("name", "Unknown Item")

        for mod in modifiers:
            mod_name = mod.get("name", "")
            if mod_name:
                modifier_map[mod_name].add(category)
                modifier_items[mod_name].append({
                    "item": item_name,
                    "category": category
                })

    violations = []
    for mod_name, categories in modifier_map.items():
        if len(categories) > 1:
            # Calculate 86 risk: how many items would be affected
            affected_items = modifier_items[mod_name]
            violations.append({
                "modifier": mod_name,
                "severity": "HIGH" if len(affected_items) > 5 else "MEDIUM",
                "categories_affected": sorted(list(categories)),
                "category_count": len(categories),
                "items_affected": affected_items,
                "item_count": len(affected_items),
                "86_risk": f"Disabling '{mod_name}' would affect {len(affected_items)} items across {len(categories)} categories",
                "recommendation": f"Create separate '{mod_name}' modifier for each category. Set Is Shared = false on each."
            })

    # Sort by severity then item count
    violations.sort(key=lambda x: (0 if x["severity"] == "HIGH" else 1, -x["item_count"]))
    return violations


def scan_redundant_modifiers(menu_items: list) -> dict:
    """
    Finds modifier names that appear suspiciously many times
    (likely entered manually multiple times instead of using a shared group).
    """
    modifier_name_count = defaultdict(int)

    for item in menu_items:
        modifiers = item.get("modifiers", [])
        for mod in modifiers:
            mod_name = mod.get("name", "")
            if mod_name:
                modifier_name_count[mod_name] += 1

    redundancies = []
    for mod_name, count in modifier_name_count.items():
        if count > 10:  # threshold: appearing more than 10 times is suspicious
            redundancies.append({
                "modifier": mod_name,
                "occurrence_count": count,
                "recommendation": f"'{mod_name}' appears {count} times. Consider whether a proper modifier group would reduce maintenance burden."
            })

    redundancies.sort(key=lambda x: -x["occurrence_count"])
    return redundancies


def generate_report(violations: list, redundancies: list, menu_items: list) -> dict:
    high_count = sum(1 for v in violations if v["severity"] == "HIGH")
    medium_count = sum(1 for v in violations if v["severity"] == "MEDIUM")

    return {
        "report_type": "Modifier Cross-Contamination Audit",
        "system": "Heartland POS",
        "generated_by": "Signal F Holdings LLC — modifier-scan.py",
        "summary": {
            "total_items_scanned": len(menu_items),
            "total_violations": len(violations),
            "high_severity": high_count,
            "medium_severity": medium_count,
            "redundant_modifiers": len(redundancies),
            "action_required": len(violations) > 0
        },
        "cross_contamination_violations": violations,
        "redundancy_warnings": redundancies,
        "next_steps": (
            "Present this report to the client. Explain the 86 risk for each HIGH severity item. "
            "Get written approval before making any changes. "
            "If approved, proceed with shadow build (v2 channels) before modifying the live system."
        )
    }


def main():
    parser = argparse.ArgumentParser(description="Heartland POS Modifier Cross-Contamination Scanner")
    parser.add_argument("--input", required=True, help="Path to menu export JSON")
    parser.add_argument("--output", default="modifier-audit-report.json", help="Output report path")
    args = parser.parse_args()

    print(f"Loading menu data from {args.input}...")
    menu_items = load_menu(args.input)
    print(f"Scanning {len(menu_items)} menu items...")

    violations = scan_modifier_crosscontamination(menu_items)
    redundancies = scan_redundant_modifiers(menu_items)
    report = generate_report(violations, redundancies, menu_items)

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*60}")
    print(f"MODIFIER AUDIT COMPLETE")
    print(f"{'='*60}")
    print(f"Items scanned:       {report['summary']['total_items_scanned']}")
    print(f"Violations found:    {report['summary']['total_violations']}")
    print(f"  HIGH severity:     {report['summary']['high_severity']}")
    print(f"  MEDIUM severity:   {report['summary']['medium_severity']}")
    print(f"Redundancy warnings: {report['summary']['redundant_modifiers']}")
    print(f"\nFull report saved to: {args.output}")
    print(f"\nNext step: Review report, present to client, wait for approval.")


if __name__ == "__main__":
    main()
