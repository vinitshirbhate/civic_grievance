import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { fetchComplaintsByUser, submitRating } from "../utils/complaintApi";
import { auth } from "../utils/Firebase";
import { Statuses } from "../utils/enums";
import StarRating from "./StarRating"; // Import the StarRating component

const ReportedComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("active");

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // Fetch complaints for the logged-in user
        const unsubscribeComplaints = fetchComplaintsByUser(user.uid, (fetchedComplaints) => {
          setComplaints(fetchedComplaints);
          setLoading(false);
        });
      } else {
        // If no user is logged in, stop loading
        setLoading(false);
      }
    });

    // Return the cleanup function for the auth listener
    return () => {
      unsubscribeAuth();
    };
  }, []);

  const handleRatingSubmit = async (complaintId, rating) => {
    try {
      await submitRating(complaintId, rating);
      toast.success("Thank you for your feedback!");
    } catch (error) {
      toast.error("Failed to submit rating. Please try again.");
      console.error("Error submitting rating:", error);
    }
  };

  const tabData = useMemo(() => {
    const active = complaints.filter((complaint) =>
      ["Open", "Assigned", "InProgress"].includes(complaint.workflowStatus)
    );
    const resolved = complaints.filter((complaint) =>
      ["Resolved", "Closed"].includes(complaint.workflowStatus)
    );
    const rejected = complaints.filter((complaint) => complaint.workflowStatus === "Rejected");

    return {
      active,
      resolved,
      rejected,
    };
  }, [complaints]);

  const visibleComplaints =
    selectedTab === "resolved"
      ? tabData.resolved
      : selectedTab === "rejected"
      ? tabData.rejected
      : tabData.active;

  const tabTitle =
    selectedTab === "resolved"
      ? "Resolved Complaints"
      : selectedTab === "rejected"
      ? "Rejected Complaints"
      : "Active Complaints";

  const formatDateTime = (value) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleString();
  };

  const getTimelineItems = (complaint) => {
    const status = complaint.workflowStatus || "Open";
    const reportedAt = complaint.timestamp ? new Date(complaint.timestamp).toISOString() : null;
    const isAssigned = ["Assigned", "InProgress", "Resolved", "Closed", "Rejected"].includes(status);
    const isInProgress = ["InProgress", "Resolved", "Closed", "Rejected"].includes(status);
    const isResolved = ["Resolved", "Closed"].includes(status);
    const isRejected = status === "Rejected";

    return [
      {
        key: "reported",
        label: "Reported",
        completed: true,
        detail: formatDateTime(reportedAt),
      },
      {
        key: "assigned",
        label: "Assigned",
        completed: isAssigned,
        detail: complaint.assignedOfficerName
          ? `Assigned to ${complaint.assignedOfficerName}`
          : isAssigned
          ? "Assigned to an official"
          : "Awaiting assignment",
      },
      {
        key: "progress",
        label: "In Progress",
        completed: isInProgress,
        detail: isInProgress ? "Work started by official team" : "Not started yet",
      },
      {
        key: "outcome",
        label: isRejected ? "Rejected" : "Resolved",
        completed: isResolved || isRejected,
        detail: isRejected
          ? formatDateTime(complaint.rejectedAt)
          : isResolved
          ? formatDateTime(complaint.resolvedAt)
          : "Pending",
      },
    ];
  };

  if (loading) {
    return <p className="text-center p-4 text-slate-600">Loading your complaints...</p>;
  }

  return (
    <div className="surface-card w-full flex flex-col items-center lg:h-[30rem] py-3">
      <h3 className="font-bold my-2 text-lg">Complaints Reported By You</h3>
      <div className="w-full px-4 mb-3">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 py-2">
            <p className="font-semibold text-slate-700">Active</p>
            <p className="text-lg font-bold text-slate-900">{tabData.active.length}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 py-2">
            <p className="font-semibold text-emerald-700">Resolved</p>
            <p className="text-lg font-bold text-emerald-900">{tabData.resolved.length}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 py-2">
            <p className="font-semibold text-rose-700">Rejected</p>
            <p className="text-lg font-bold text-rose-900">{tabData.rejected.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => setSelectedTab("active")}
            className={`brand-button border ${
              selectedTab === "active"
                ? "bg-cyan-700 text-white border-cyan-700"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Active ({tabData.active.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("resolved")}
            className={`brand-button border ${
              selectedTab === "resolved"
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Resolved ({tabData.resolved.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("rejected")}
            className={`brand-button border ${
              selectedTab === "rejected"
                ? "bg-rose-700 text-white border-rose-700"
                : "bg-white text-slate-800 border-slate-300"
            }`}
          >
            Rejected ({tabData.rejected.length})
          </button>
        </div>
      </div>
      <div className="container px-4 overflow-y-auto w-full">
        {visibleComplaints.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">No complaints in {tabTitle.toLowerCase()}.</p>
        ) : (
          <div className="space-y-4">
            {visibleComplaints.map((complaint) => (
              <div key={complaint.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                <p className="font-bold mb-1">{complaint.reason}</p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className="px-2 py-1 rounded-full text-xs bg-slate-100 border border-slate-200">
                    {complaint.workflowStatus || complaint.status}
                  </span>
                </p>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-sm mb-2">Progress Timeline</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getTimelineItems(complaint).map((item) => (
                      <div
                        key={item.key}
                        className={`rounded-md border px-2 py-2 text-sm ${
                          item.completed
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <p className="font-semibold">{item.label}</p>
                        <p className="text-xs opacity-90">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {(complaint.workflowStatus === "Rejected" ||
                  complaint.workflowStatus === "Resolved" ||
                  complaint.workflowStatus === "Closed") && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="font-semibold text-sm mb-2">Official Outcome</p>

                    {complaint.workflowStatus === "Rejected" ? (
                      <div className="text-sm space-y-1">
                        <p>
                          <strong>Decision:</strong> Rejected
                        </p>
                        <p>
                          <strong>Handled By:</strong> {complaint.rejectedByName || "N/A"}
                        </p>
                        <p>
                          <strong>Handled At:</strong> {formatDateTime(complaint.rejectedAt)}
                        </p>
                        <p>
                          <strong>Reason:</strong> {complaint.rejectionNote || "No reason added."}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm space-y-1">
                        <p>
                          <strong>Decision:</strong> Resolved
                        </p>
                        <p>
                          <strong>Handled By:</strong> {complaint.resolvedByName || "N/A"}
                        </p>
                        <p>
                          <strong>Handled At:</strong> {formatDateTime(complaint.resolvedAt)}
                        </p>
                        <p>
                          <strong>Resolution Note:</strong> {complaint.resolutionNote || "No resolution note added."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* --- RESOLUTION & RATING SECTION --- */}
                {(complaint.status === Statuses.solved || complaint.status === Statuses.pending_rating) && complaint.resolutionImageUrl && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-bold text-md mb-2">Resolution Proof</h4>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <p className="font-semibold text-center text-sm">Before</p>
                            <img src={complaint.mediaPath} alt="Original complaint" className="w-full h-auto rounded-md object-contain max-h-48" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-center text-sm">After</p>
                            <img src={complaint.resolutionImageUrl} alt="Resolution proof" className="w-full h-auto rounded-md object-contain max-h-48" />
                        </div>
                    </div>

                    {/* RATING SECTION */}
                    <div className="mt-4 text-center">
                      {!complaint.userRating && complaint.status === Statuses.pending_rating ? (
                        <>
                          <p className="font-semibold mb-2">How would you rate this resolution?</p>
                          <StarRating rating={0} onRatingChange={(rating) => handleRatingSubmit(complaint.id, rating)} />
                        </>
                      ) : (
                         complaint.userRating && (
                          <>
                            <p className="font-semibold mb-2">Your Rating:</p>
                            <StarRating rating={complaint.userRating} readOnly={true} />
                          </>
                         )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportedComplaints;

