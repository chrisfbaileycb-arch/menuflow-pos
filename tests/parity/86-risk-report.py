"""
86-risk-report.py
Signal F Holdings LLC — Heartland POS Audit Tool

PURPOSE:
Calculates the revenue cascade risk of disabling any individual
modifier or menu item. Answers the question: "If I 86 this ingredient,
what else breaks and how much revenue could I lose?"

USAGE:
  python 86-risk-report.py --input menu-export.json --output 86-risk-report.json

OUTPUT:
  Ranked list of modifiers/items by cascade impact.
  HIGH risk items are those that would disable 5+ other items or
  touch more than 2 revenue categories if disabled.
"""

import json
import argparse
from collections import defaultdict


def load_menu(filepath: str) -> list:
    with open(filepath, "r") as f:
        return json.load(f)


def calculate_cascade_risk(menu_items: list) -> list:
    """
    For each modifier, calculate how many items and categories
    would be affected if that modifier were disabled.
    """
    modifier_impact = defaultdict(lambda: {
        "items": [],
        "categories": set(),
        "estimated_order_exposure": 0
    })

    for item in menu_items:
        item_name = item.get("name", "Unknown")
        category = item.get("category", "Uncategorized")
        modifiers = item.get("modifiers", [])
        # Use price as a proxy for revenue exposure if available
        price = item.get("price", 0)

        for mod in modifiers:
            mod_name = mod.get("name", "")
            if mod_name:
                modifier_impact[mod_name]["items"].append({
                    "item": item_name,
                    "category": category,
                    "price": price
                })
                modifier_impact[mod_name]["categories"].add(category)
                modifier_impact[mod_name]["estimated_order_exposure"] += price

    risk_report = []
    for mod_name, impact in modifier_impact.items():
        item_count = len(impact["items"])
        category_count = len(impact["categories"])

        if item_count > 1:  # Only report modifiers on more than one item
            if item_count >= 5 or category_count >= 2:
                severity = "HIGH"
            else:
                severity = "MEDIUM"

            risk_report.append({
                "modifier": mod_name,
                "severity": severity,
                "items_that_would_be_affected": item_count,
                "categories_affected": sorted(list(impact["categories"])),
                "category_count": category_count,
                "estimated_revenue_exposure": round(impact["estimated_order_exposure"], 2),
                "affected_items": impact["items"],
                "recommendation": (
                    f"Do NOT 86 '{mod_name}' in the system. "
                    f"Contact affected customers directly. "
                    f"If supply is limited, update item descriptions to note availability."
                )
            })

    # Sort by severity then item count
    risk_report.sort(key=lambda x: (0 if x["severity"] == "HIGH" else 1, -x["items_that_would_be_affected"]))
    return risk_report


def main():
    parser = argparse.ArgumentParser(description="Heartland POS 86 Cascade Risk Report")
    parser.add_argument("--input", required=True, help="Path to menu export JSON")
    parser.add_argument("--output", default="86-risk-report.json", help="Output report path")
    args = parser.parse_args()

    print(f"Loading menu data from {args.input}...")
    menu_items = load_menu(args.input)

    print("Calculating 86 cascade risk...")
    risk_items = calculate_cascade_risk(menu_items)

    high_risk = [r for r in risk_items if r["severity"] == "HIGH"]
    medium_risk = [r for r in risk_items if r["severity"] == "MEDIUM"]

    report = {
        "report_type": "86 Cascade Risk Assessment",
        "system": "Heartland POS",
        "generated_by": "Signal F Holdings LLC — 86-risk-report.py",
        "core_philosophy": (
            "Never 86 an item or modifier in the POS system. "
            "Contact the customer directly. One missing ingredient should "
            "never silently kill an entire revenue category."
        ),
        "summary": {
            "total_modifiers_analyzed": len(risk_items),
            "high_risk_modifiers": len(high_risk),
            "medium_risk_modifiers": len(medium_risk),
        },
        "high_risk_items": high_risk,
        "medium_risk_items": medium_risk,
        "recommended_protocol": [
            "1. Never disable a modifier or item in the system during service.",
            "2. If stock runs out, contact customers who ordered the item directly.",
            "3. Update item description to note limited availability if needed.",
            "4. Only disable in the system after service ends and after notifying all affected customers.",
            "5. Re-enable as soon as supply is restored.",
            "6. For chronic out-of-stock situations, consider removing the item in the next shadow build cycle."
        ]
    }

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*60}")
    print(f"86 RISK REPORT COMPLETE")
    print(f"{'='*60}")
    print(f"HIGH risk modifiers:   {len(high_risk)}")
    print(f"MEDIUM risk modifiers: {len(medium_risk)}")
    print(f"\nFull report saved to: {args.output}")
    print(f"\nRemember: Never 86 in the system. Contact customers directly.")


if __name__ == "__main__":
    main()
