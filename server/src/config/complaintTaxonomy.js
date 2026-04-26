export const COMPLAINT_TAXONOMY = [
  {
    category: "Road",
    label: "Potholes in Roads",
    aliases: ["Road", "Potholes in Roads", "Pavement Defects"],
    defaultSeverity: "High",
  },
  {
    category: "Water",
    label: "Water Logging",
    aliases: ["Water", "Water Logging"],
    defaultSeverity: "High",
  },
  {
    category: "Streetlight",
    label: "Streetlight Malfunction",
    aliases: ["Streetlight", "Streetlight Malfunction"],
    defaultSeverity: "Medium",
  },
  {
    category: "Waste",
    label: "Waste Management Issues",
    aliases: ["Waste", "Waste Management", "Waste Management Issues"],
    defaultSeverity: "Medium",
  },
  {
    category: "Traffic",
    label: "Speeding/Racing",
    aliases: [
      "Traffic",
      "Speeding/Racing",
      "Overloading of Passengers",
      "Illegal Overtaking",
    ],
    defaultSeverity: "High",
  },
  {
    category: "Safety",
    label: "Driving without seat belt/Helmet",
    aliases: ["Safety", "Driving without seat belt/Helmet"],
    defaultSeverity: "Medium",
  },
  {
    category: "Other",
    label: "Others",
    aliases: ["Other", "Others"],
    defaultSeverity: "Low",
  },
];

const normalizedCategoryByInput = COMPLAINT_TAXONOMY.reduce((acc, entry) => {
  acc[entry.category] = entry.category;
  for (const alias of entry.aliases) {
    acc[alias] = entry.category;
  }
  return acc;
}, {});

export function normalizeCategoryInput(inputCategory) {
  if (!inputCategory) return "Other";
  return normalizedCategoryByInput[inputCategory] || "Other";
}

export function getReasonLabelByCategory(category) {
  return COMPLAINT_TAXONOMY.find((entry) => entry.category === category)?.label || "Others";
}
