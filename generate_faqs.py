import json

# Primary core operational scenarios
base_templates = [
    {
        "q": "What is the status of shipment {shp_id} from {vendor}?",
        "a": "Shipment {shp_id} from {vendor} is currently experiencing SLA delays due to maritime route bottlenecks. Cape detour authorized."
    },
    {
        "q": "How to resolve delay for vendor {vendor} ({shp_id})?",
        "a": "Issue an emergency buffer PO and authorize Cape detour for {vendor} to cover the inventory deficit for {shp_id}."
    },
    {
        "q": "What is the financial risk exposure for {vendor}?",
        "a": "Financial risk for {vendor} is flagged high due to potential assembly line shutdown if replacement stock is delayed past 14 days."
    },
    {
        "q": "Draft SLA delay escalation email for {shp_id} ({vendor}).",
        "a": "Subject: URGENT: SLA Escalation - Shipment {shp_id} ({vendor})\nDear Operations Team,\nShipment {shp_id} is delayed. Please confirm Cape detour and buffer PO status immediately."
    },
    {
        "q": "What component is delayed under shipment {shp_id}?",
        "a": "Shipment {shp_id} contains critical supply chain components for {vendor}. Buffer inventory covers less than 14 days."
    }
]

vendors = [
    "Taiwan Semi Foundry", "Apex Microelectronics", "Global Lithium Corp",
    "Bavaria Spec Alloys", "Shenzhen Micro Sensors", "Seoul Optoelectronics",
    "Nordic Silicon Works", "Tokyo Precision Bearings", "Pacific Rare Earths",
    "Dresden Polymer Solutions"
]

faqs = []
counter = 1

# Generate 500 structured FAQs
for v_idx, vendor in enumerate(vendors):
    for t_idx in range(50):
        template = base_templates[t_idx % len(base_templates)]
        shp_number = 1000 + (counter % 100)
        shp_id = f"SHP-{shp_number}"
        
        q_text = f"[{counter}] " + template["q"].format(vendor=vendor, shp_id=shp_id)
        a_text = template["a"].format(vendor=vendor, shp_id=shp_id)
        
        faqs.append({"question": q_text, "answer": a_text})
        counter += 1

with open("faqs.json", "w", encoding="utf-8") as f:
    json.dump(faqs, f, indent=2)

print(f"Success! Created faqs.json with {len(faqs)} items.")