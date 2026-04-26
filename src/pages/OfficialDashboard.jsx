import { Chip, Dialog } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import ComplaintDetailModal from "../components/ComplaintDetailModal";
import Navbar from "../components/Navbar";
import ResolveComplaintModal from "../components/ResolveComplaintModal.jsx";
import SpinnerModal from "../components/SpinnerModal";
import { fetchAIReviewQueue, reviewAIAssessment } from "../utils/aiReviewApi";
import { fetchComplaintAnalyticsSummary, fetchComplaints } from "../utils/complaintApi";
import { auth } from "../utils/Firebase";
import { isOfficial } from "../utils/roleApi";
import { Statuses, statusColors } from "../utils/enums";

// --- WINNING FEATURE: Import our new Heatmap component ---
import ComplaintsHeatmap from "../components/ComplaintsHeatmap";


const OfficialDashboard = () => {
  const ACTIVE_WORKFLOW_STATUSES = ["Open", "Assigned", "InProgress"];
  const RESOLVED_WORKFLOW_STATUSES = ["Resolved", "Closed"];

  const [complaints, setComplaints] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [departmentPerformance, setDepartmentPerformance] = useState([]);
  const [aiQueue, setAiQueue] = useState([]);
  const [aiPendingCount, setAiPendingCount] = useState(0);
  const [reviewingId, setReviewingId] = useState(null);
  const [selectedLane, setSelectedLane] = useState("active");
  const [activeStateFilter, setActiveStateFilter] = useState("all");
  const [filters, setFilters] = useState({
    status: "",
    department: "",
    zone: "",
    escalated: "",
  });
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [spinnerVisible, setSpinnerVisible] = useState(false);
  const navigate = useNavigate();

  // This useEffect hook is perfect. It fetches live data. We will not change it.
  useEffect(() => {
    setSpinnerVisible(true);
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate("/official-login");
      } else {
        isOfficial().then((res) => {
          if (!res) {
            navigate("/citizen-dashboard");
          } else {
            setSpinnerVisible(false);
          }
        });
      }
    });

    const unsubscribeComplaints = fetchComplaints(handleComplaintsUpdate, filters);

    return () => {
      unsubscribeAuth();
      unsubscribeComplaints();
    };
  }, [navigate, filters]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await fetchComplaintAnalyticsSummary();
        setAnalytics(data.summary);
        setDepartmentPerformance(data.departmentPerformance || []);
      } catch (_error) {
        setAnalytics(null);
        setDepartmentPerformance([]);
      }
    };

    loadAnalytics();
    const intervalId = setInterval(loadAnalytics, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const loadAiQueue = async () => {
      try {
        const data = await fetchAIReviewQueue({ status: "pending", limit: 8 });
        setAiQueue(data.entries || []);
        setAiPendingCount(data.pendingCount || 0);
      } catch (_error) {
        setAiQueue([]);
        setAiPendingCount(0);
      }
    };

    loadAiQueue();
    const intervalId = setInterval(loadAiQueue, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleAIReview = async (entry, decision) => {
    setReviewingId(entry._id);
    try {
      await reviewAIAssessment({
        id: entry._id,
        decision,
      });
      setAiQueue((prev) => prev.filter((item) => item._id !== entry._id));
      const data = await fetchAIReviewQueue({ status: "pending", limit: 8 });
      setAiQueue(data.entries || []);
      setAiPendingCount(data.pendingCount || 0);
      toast.success("AI evidence review submitted.");
    } catch (_error) {
      toast.error("Unable to submit AI review.");
    } finally {
      setReviewingId(null);
    }
  };

  const handleComplaintsUpdate = (updatedComplaints) => {
    setComplaints(updatedComplaints);
  };

  const laneData = useMemo(() => {
    const active = complaints.filter((item) =>
      ACTIVE_WORKFLOW_STATUSES.includes(item.workflowStatus)
    );
    const sla = active.filter((item) => item.escalated);
    const resolved = complaints.filter((item) =>
      RESOLVED_WORKFLOW_STATUSES.includes(item.workflowStatus)
    );
    const rejected = complaints.filter((item) => item.workflowStatus === "Rejected");

    return {
      active,
      sla,
      resolved,
      rejected,
    };
  }, [complaints]);

  const laneRows =
    selectedLane === "sla"
      ? laneData.sla
      : selectedLane === "resolved"
      ? laneData.resolved
      : selectedLane === "rejected"
      ? laneData.rejected
      : activeStateFilter === "all"
      ? laneData.active
      : laneData.active.filter((item) => item.workflowStatus === activeStateFilter);

  const activeStateCounts = useMemo(() => {
    const open = laneData.active.filter((item) => item.workflowStatus === "Open").length;
    const assigned = laneData.active.filter((item) => item.workflowStatus === "Assigned").length;
    const inProgress = laneData.active.filter((item) => item.workflowStatus === "InProgress").length;

    return {
      all: laneData.active.length,
      open,
      assigned,
      inProgress,
    };
  }, [laneData.active]);

  const laneTitle =
    selectedLane === "sla"
      ? "SLA Breached Queue"
      : selectedLane === "resolved"
      ? "Resolved Requests"
      : selectedLane === "rejected"
      ? "Rejected Requests"
      : "Active Work Queue";

  const laneDescription =
    selectedLane === "sla"
      ? "Escalated active complaints that need urgent action."
      : selectedLane === "resolved"
      ? "Resolved and closed complaints with completion outcomes."
      : selectedLane === "rejected"
      ? "Complaints rejected after review or evidence mismatch checks."
      : "Only open, assigned, and in-progress complaints appear here.";

  const handleOpenResolveModal = () => {
    setDetailModalOpen(false);
    setResolveModalOpen(true);
  };

  const handleCloseResolveModal = () => {
    setResolveModalOpen(false);
    setDetailModalOpen(false);
    setSelectedComplaint(null);
  };

  const handleRowClick = (params) => {
    setSelectedComplaint(params.row);
    setDetailModalOpen(true);
  };

  const baseColumns = [
    {
      field: "reason",
      headerName: "Complaint Reason",
      width: 300,
    },
    {
      field: "author",
      headerName: "Reported By",
      width: 150,
    },
    {
      field: "location",
      headerName: "Reported Location",
      width: 200,
      valueGetter: (params) => `${params.row.location.name}`,
    },
    {
      field: "department",
      headerName: "Department",
      width: 140,
    },
    {
      field: "zone",
      headerName: "Zone",
      width: 130,
    },
    {
      field: "dueAt",
      headerName: "SLA Due",
      width: 190,
      cellClassName: (params) => {
        if (!params.row?.dueAt) return "";
        const dueAt = new Date(params.row.dueAt).getTime();
        const now = Date.now();
        const hoursLeft = (dueAt - now) / (1000 * 60 * 60);

        if (hoursLeft < 0 || params.row.escalated) return "slaOverdue";
        if (hoursLeft <= 6) return "slaUrgent";
        if (hoursLeft <= 24) return "slaSoon";
        return "";
      },
      renderCell: (params) => {
        if (!params.row.dueAt) return "N/A";

        const dueAt = new Date(params.row.dueAt).getTime();
        const now = Date.now();
        const diffMs = dueAt - now;
        const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        let label = "";
        let color = "default";
        if (diffMs < 0) {
          label = `Overdue ${hours}h ${minutes}m`;
          color = "error";
        } else if (diffMs <= 6 * 60 * 60 * 1000) {
          label = `${hours}h ${minutes}m left`;
          color = "warning";
        } else {
          label = `${hours}h ${minutes}m left`;
          color = "info";
        }

        return <Chip size="small" label={label} color={color} />;
      },
    },
    {
      field: "escalated",
      headerName: "Escalated",
      width: 120,
      valueGetter: (params) => (params.row.escalated ? "Yes" : "No"),
    },
    {
        field: "timestamp",
        headerName: "Reported Date & Time",
        width: 200,
        valueGetter: (params) => {
            let d = new Date(params.row.timestamp);
            return `${d.toLocaleDateString()} , ${d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
            })}`;
        },
    },
    {
      field: "status",
      headerName: "Status",
      width: 150,
      headerAlign: "center",
      align: "center",
      cellClassName: (params) => {
        if (!params.value) return "";
        return clsx("StatusCol", {
          inProgress: params.value === Statuses.inProgress,
          Rejected: params.value === Statuses.rejected,
          Solved: params.value === Statuses.solved || params.value === Statuses.pending_rating,
        });
      },
    },
  ];

  const laneSpecificColumns = useMemo(() => {
    if (selectedLane === "resolved") {
      return [
        {
          field: "resolvedAt",
          headerName: "Resolved At",
          width: 190,
          valueGetter: (params) => {
            if (!params.row.resolvedAt) return "N/A";
            return new Date(params.row.resolvedAt).toLocaleString();
          },
        },
        {
          field: "resolvedByName",
          headerName: "Resolved By",
          width: 160,
          valueGetter: (params) => params.row.resolvedByName || "N/A",
        },
        {
          field: "resolutionNote",
          headerName: "Resolution Note",
          width: 260,
          valueGetter: (params) => params.row.resolutionNote || "N/A",
        },
      ];
    }

    if (selectedLane === "rejected") {
      return [
        {
          field: "rejectedAt",
          headerName: "Rejected At",
          width: 190,
          valueGetter: (params) => {
            if (!params.row.rejectedAt) return "N/A";
            return new Date(params.row.rejectedAt).toLocaleString();
          },
        },
        {
          field: "rejectedByName",
          headerName: "Rejected By",
          width: 160,
          valueGetter: (params) => params.row.rejectedByName || "N/A",
        },
        {
          field: "rejectionNote",
          headerName: "Rejection Note",
          width: 280,
          valueGetter: (params) => params.row.rejectionNote || "N/A",
        },
      ];
    }

    if (selectedLane === "sla") {
      return [
        {
          field: "escalated",
          headerName: "Escalated",
          width: 120,
          valueGetter: (params) => (params.row.escalated ? "Yes" : "No"),
        },
      ];
    }

    return [];
  }, [selectedLane]);

  const columns = useMemo(() => {
    if (selectedLane === "resolved" || selectedLane === "rejected") {
      return baseColumns.filter(
        (column) => column.field !== "dueAt" && column.field !== "escalated"
      ).concat(laneSpecificColumns);
    }

    return baseColumns.concat(laneSpecificColumns);
  }, [selectedLane, laneSpecificColumns]);

  return (
    <>
      <SpinnerModal visible={spinnerVisible} />
      <Navbar />
      <ToastContainer
        position="bottom-center"
        autoClose={4000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <div className="px-3 sm:px-6 md:px-12 lg:px-20">
        <h2 className="section-title text-center lg:text-left my-8 animate-in">
          Official Dashboard
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-6 animate-in-delay-1">
          <div className="metric-tile">
            <p className="metric-label">Total</p>
            <p className="metric-value">{analytics?.totalComplaints ?? 0}</p>
          </div>
          <button
            type="button"
            className={`metric-tile text-left transition ${selectedLane === "active" ? "ring-2 ring-cyan-500" : "hover:ring-1 hover:ring-cyan-300"}`}
            onClick={() => setSelectedLane("active")}
          >
            <p className="metric-label">Open</p>
            <p className="metric-value">{analytics?.openComplaints ?? 0}</p>
          </button>
          <button
            type="button"
            className={`metric-tile text-left transition ${selectedLane === "resolved" ? "ring-2 ring-emerald-500" : "hover:ring-1 hover:ring-emerald-300"}`}
            onClick={() => setSelectedLane("resolved")}
          >
            <p className="metric-label">Resolved</p>
            <p className="metric-value">{analytics?.resolvedComplaints ?? 0}</p>
          </button>
          <button
            type="button"
            className={`metric-tile text-left transition ${selectedLane === "rejected" ? "ring-2 ring-rose-500" : "hover:ring-1 hover:ring-rose-300"}`}
            onClick={() => setSelectedLane("rejected")}
          >
            <p className="metric-label">Rejected</p>
            <p className="metric-value">{analytics?.rejectedComplaints ?? 0}</p>
          </button>
          <div className="metric-tile">
            <p className="metric-label">Avg Resolution</p>
            <p className="metric-value">{analytics?.avgResolutionHours ?? 0}h</p>
          </div>
          <button
            type="button"
            className={`metric-tile text-left transition ${selectedLane === "sla" ? "ring-2 ring-red-500" : "hover:ring-1 hover:ring-red-300"}`}
            onClick={() => setSelectedLane("sla")}
          >
            <p className="metric-label">SLA Breach</p>
            <p className="metric-value">{analytics?.slaBreachRate ?? 0}%</p>
          </button>
          <div className="metric-tile">
            <p className="metric-label">AI Reviews Pending</p>
            <p className="metric-value">{aiPendingCount}</p>
          </div>
        </div>

        <div className="surface-card mb-6 animate-in-delay-2">
          <h3 className="font-bold mb-3">Workflow Lanes</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedLane("active")}
              className={`brand-button border ${
                selectedLane === "active"
                  ? "bg-cyan-700 text-white border-cyan-700"
                  : "bg-white text-slate-800 border-slate-300"
              }`}
            >
              Active ({laneData.active.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedLane("sla")}
              className={`brand-button border ${
                selectedLane === "sla"
                  ? "bg-red-700 text-white border-red-700"
                  : "bg-white text-slate-800 border-slate-300"
              }`}
            >
              SLA Breached ({laneData.sla.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedLane("resolved")}
              className={`brand-button border ${
                selectedLane === "resolved"
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-slate-800 border-slate-300"
              }`}
            >
              Resolved ({laneData.resolved.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedLane("rejected")}
              className={`brand-button border ${
                selectedLane === "rejected"
                  ? "bg-rose-700 text-white border-rose-700"
                  : "bg-white text-slate-800 border-slate-300"
              }`}
            >
              Rejected ({laneData.rejected.length})
            </button>
          </div>
        </div>

        <div className="surface-card mb-6 overflow-x-auto animate-in-delay-2">
          <h3 className="font-bold mb-3">AI Evidence Review Queue</h3>
          {aiQueue.length === 0 ? (
            <p className="text-sm text-slate-600">No pending AI evidence reviews.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Evidence</th>
                  <th className="py-2">Issue</th>
                  <th className="py-2">Reporter</th>
                  <th className="py-2">Reliability</th>
                  <th className="py-2">AI Signals</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {aiQueue.map((entry) => (
                  <tr key={entry._id} className="border-b align-top">
                    <td className="py-2 pr-2">
                      {entry?.complaintId?.mediaUrls?.[0] ? (
                        <a href={entry.complaintId.mediaUrls[0]} target="_blank" rel="noreferrer">
                          <img
                            src={entry.complaintId.mediaUrls[0]}
                            alt="Complaint evidence"
                            className="w-24 h-16 rounded object-cover border"
                          />
                        </a>
                      ) : (
                        <p className="text-xs text-slate-500">No image evidence</p>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <p className="font-semibold">{entry?.complaintId?.title || "Untitled complaint"}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-1">{entry?.complaintId?.description || "No description"}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{entry?.rationale || "No AI rationale"}</p>
                    </td>
                    <td className="py-2">{entry?.reporterId?.name || "Unknown"}</td>
                    <td className="py-2">
                      <Chip
                        size="small"
                        color={entry.reliabilityClass === "likely_mismatch" ? "error" : "warning"}
                        label={(entry.reliabilityClass || "needs_review").replace("_", " ")}
                      />
                    </td>
                    <td className="py-2 text-xs text-slate-700">
                      <p>Severity score: <b>{entry?.finalSeverityScore ?? 0}</b></p>
                      <p>Consistency: <b>{entry?.textImageConsistency ?? "n/a"}</b></p>
                      <p>Evidence quality: <b>{entry?.evidenceQuality ?? "n/a"}</b></p>
                      <p>Manipulation risk: <b>{entry?.manipulationRisk ?? "n/a"}</b></p>
                      <p>AI confidence: <b>{Math.round(Number(entry?.confidence || 0) * 100)}%</b></p>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="brand-button border border-emerald-300 bg-emerald-50 text-emerald-900"
                          disabled={reviewingId === entry._id}
                          onClick={() => handleAIReview(entry, "supports_claim")}
                        >
                          Verified
                        </button>
                        <button
                          className="brand-button border border-red-300 bg-red-50 text-red-900"
                          disabled={reviewingId === entry._id}
                          onClick={() => handleAIReview(entry, "mismatch")}
                        >
                          Not Verified
                        </button>
                        <button
                          className="brand-button border border-slate-300 bg-slate-50 text-slate-900"
                          disabled={reviewingId === entry._id}
                          onClick={() => handleAIReview(entry, "inconclusive")}
                        >
                          Unsure
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="surface-card mb-6 overflow-x-auto animate-in-delay-2">
          <h3 className="font-bold mb-3">Department Performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Department</th>
                <th className="py-2">Total</th>
                <th className="py-2">Resolved</th>
                <th className="py-2">Pending</th>
                <th className="py-2">Escalated</th>
              </tr>
            </thead>
            <tbody>
              {departmentPerformance.length === 0 ? (
                <tr>
                  <td className="py-2" colSpan={5}>No analytics data available yet.</td>
                </tr>
              ) : (
                departmentPerformance.map((row) => (
                  <tr key={row.department} className="border-b">
                    <td className="py-2">{row.department}</td>
                    <td className="py-2">{row.total}</td>
                    <td className="py-2">{row.resolved}</td>
                    <td className="py-2">{row.pending}</td>
                    <td className="py-2">{row.escalated}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4 animate-in-delay-2">
          <select
            className="frost-panel border rounded px-3 py-2"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Status</option>
            <option value="Open">Open</option>
            <option value="Assigned">Assigned</option>
            <option value="InProgress">InProgress</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            className="frost-panel border rounded px-3 py-2"
            value={filters.department}
            onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
          >
            <option value="">All Departments</option>
            <option value="Roads">Roads</option>
            <option value="Water">Water</option>
            <option value="Electrical">Electrical</option>
            <option value="Sanitation">Sanitation</option>
            <option value="Traffic">Traffic</option>
            <option value="Safety">Safety</option>
            <option value="General">General</option>
          </select>

          <select
            className="frost-panel border rounded px-3 py-2"
            value={filters.zone}
            onChange={(e) => setFilters((prev) => ({ ...prev, zone: e.target.value }))}
          >
            <option value="">All Zones</option>
            <option value="North-East">North-East</option>
            <option value="North-West">North-West</option>
            <option value="South-East">South-East</option>
            <option value="South-West">South-West</option>
            <option value="Central">Central</option>
          </select>

          <select
            className="frost-panel border rounded px-3 py-2"
            value={filters.escalated}
            onChange={(e) => setFilters((prev) => ({ ...prev, escalated: e.target.value }))}
          >
            <option value="">All Escalation</option>
            <option value="true">Escalated</option>
            <option value="false">Not Escalated</option>
          </select>

          <button
            className="frost-panel border rounded px-3 py-2 bg-white"
            onClick={() =>
              setFilters({
                status: "",
                department: "",
                zone: "",
                escalated: "",
              })
            }
          >
            Clear Filters
          </button>
        </div>

        {/* --- WINNING FEATURE: We add the heatmap here, right above the table --- */}
        {/* It uses the same live 'complaints' data, so it's always in sync! */}
        <div style={{marginBottom: '40px'}}>
            <ComplaintsHeatmap complaints={complaints} />
        </div>

        <div className="mb-3">
          <h3 className="text-lg font-bold">{laneTitle}</h3>
          <p className="text-sm text-slate-600">{laneDescription}</p>
        </div>

        {selectedLane === "active" ? (
          <div className="surface-card mb-4">
            <h4 className="font-semibold mb-2">Current State In Active Queue</h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveStateFilter("all")}
                className={`brand-button border ${
                  activeStateFilter === "all"
                    ? "bg-cyan-700 text-white border-cyan-700"
                    : "bg-white text-slate-800 border-slate-300"
                }`}
              >
                All ({activeStateCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveStateFilter("Open")}
                className={`brand-button border ${
                  activeStateFilter === "Open"
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-white text-slate-800 border-slate-300"
                }`}
              >
                Open ({activeStateCounts.open})
              </button>
              <button
                type="button"
                onClick={() => setActiveStateFilter("Assigned")}
                className={`brand-button border ${
                  activeStateFilter === "Assigned"
                    ? "bg-amber-700 text-white border-amber-700"
                    : "bg-white text-slate-800 border-slate-300"
                }`}
              >
                Assigned ({activeStateCounts.assigned})
              </button>
              <button
                type="button"
                onClick={() => setActiveStateFilter("InProgress")}
                className={`brand-button border ${
                  activeStateFilter === "InProgress"
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-slate-800 border-slate-300"
                }`}
              >
                InProgress ({activeStateCounts.inProgress})
              </button>
            </div>
          </div>
        ) : null}

        {/* Detail Modal */}
        {selectedComplaint && (
            <Dialog open={detailModalOpen} onClose={() => setDetailModalOpen(false)}>
                <ComplaintDetailModal
                    setDialogOpen={setDetailModalOpen}
                    complaint={selectedComplaint}
                    onResolveClick={handleOpenResolveModal}
                />
            </Dialog>
        )}

        {/* Resolve Modal */}
        {selectedComplaint && (
          <ResolveComplaintModal
            complaint={selectedComplaint}
            open={resolveModalOpen}
            onClose={handleCloseResolveModal}
          />
        )}

        {laneRows.length === 0 ? (
          <div className="surface-card text-center text-slate-600 py-8 mb-10">
            No complaints in this lane.
          </div>
        ) : (
          <DataGrid
            rows={laneRows}
            columns={columns}
            onRowClick={handleRowClick}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 20, 30]}
            sx={{
              ".MuiDataGrid-columnHeaderTitle": {
                fontWeight: "bold !important",
                overflow: "visible !important",
              },
              "& .StatusCol": {
                color: "#fff",
                fontWeight: 900,
                marginY: 1.5,
                minHeight: "30px !important",
                borderRadius: 500,
              },
              "& .StatusCol.inProgress": { backgroundColor: statusColors.inProgress },
              "& .StatusCol.Rejected": { backgroundColor: statusColors.rejected },
              "& .StatusCol.Solved": { backgroundColor: statusColors.solved },
              "& .StatusCol.Created": { backgroundColor: "#0284C7" },
              "& .StatusCol.pendingRating": { backgroundColor: statusColors.pending_rating },
              "& .slaOverdue": {
                backgroundColor: "#FEE2E2",
                color: "#B91C1C",
                fontWeight: 700,
              },
              "& .slaUrgent": {
                backgroundColor: "#FEF3C7",
                color: "#B45309",
                fontWeight: 700,
              },
              "& .slaSoon": {
                backgroundColor: "#DBEAFE",
                color: "#1D4ED8",
                fontWeight: 700,
              },
            }}
          />
        )}
      </div>
    </>
  );
};

export default OfficialDashboard;

