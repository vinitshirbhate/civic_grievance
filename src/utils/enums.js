const userTypes = Object.freeze({
  citizen: "citizen",
  official: "official",
});

const Statuses = Object.freeze({
  inProgress: "In-Progress",
  solved: "SOLVED",
  rejected: "REJECTED",
  pending_rating: "Pending Rating",
});
const statusColors = Object.freeze({
  inProgress: "#DFC900",
  solved: "#04B900",
  rejected: "#C70000",
  pending_rating: "#3B82F6",
});
export { userTypes, Statuses, statusColors };
