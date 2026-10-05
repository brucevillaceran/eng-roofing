export const serviceTypes = [
  "Roof Installation",
  "Roof Replacement",
  "Roof Repair",
];

export const roofTypes = [
  "Rib-Type/Ribbed",
  "Corrugated",
  "Tile Profile",
  "Standing Seam",
  "R-Span",
  "Curved Roof",
  "Other",
];

const standardMaterials = [
  ["Roofing Sheet", null, "Roofing Sheet"],
  ["Ridge Cap", ["Ridge Cap"], "LM"],
  ["Flashing", ["Flashing"], "LM"],
  ["Valley Flashing", ["Valley Flashing"], "LM"],
  ["Eaves Flashing", ["Eaves Flashing"], "LM"],
  ["Barge/Side Flashing", ["Barge/Side Flashing"], "LM"],
  ["Roofing Screws", ["Roofing Screws"], "PCS"],
  ["Sealant", ["Sealant"], "TUBE"],
  ["Closure Strips", ["Closure Strips"], "PCS"],
  ["Gutter", ["Gutter"], "LM"],
  ["Downsprout", ["Downsprout", "Downspout"], "LM"],
];

export function standardInspectionItems(materials) {
  const activeMaterials = materials.filter((material) => material.active);
  return standardMaterials.flatMap(([label, names, requiredUnit]) => {
    const material =
      requiredUnit === "Roofing Sheet"
        ? activeMaterials.find(
            (item) => item.category === "Roofing Sheet" && item.unit === "SQM",
          )
        : activeMaterials.find((item) => names.includes(item.name));
    if (!material) return [];
    return [
      {
        materialId: material.id,
        name: label === "Roofing Sheet" ? material.name : label,
        unit: requiredUnit === "Roofing Sheet" ? "SQM" : requiredUnit,
        quantity: "",
        price: material.price,
        category: material.category,
        thickness: material.thickness,
      },
    ];
  });
}

export function inspectionMaterialAmount(item) {
  return Number(item.quantity || 0) * Number(item.price || 0);
}
