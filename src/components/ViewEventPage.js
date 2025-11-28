import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ViewEventPage.css";
import "./DashboardPage.css";

function ViewEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    setUserEmail(localStorage.getItem("userEmail") || "");
  }, []);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRes, invRes, accRes] = await Promise.all([
        fetch("http://localhost:8080/events/organized", { credentials: "include" }),
        fetch("http://localhost:8080/events/invited", { credentials: "include" }),
        fetch("http://localhost:8080/events/accepted", { credentials: "include" }),
      ]);

      if (orgRes.status === 401 || invRes.status === 401 || accRes.status === 401) {
        navigate("/login");
        return;
      }

      const [orgData, invData, accData] = await Promise.all([orgRes.json(), invRes.json(), accRes.json()]);

      const all = [
        ...(Array.isArray(orgData) ? orgData : []),
        ...(Array.isArray(invData) ? invData : []),
        ...(Array.isArray(accData) ? accData : []),
      ];

      let found = all.find((e) => String(e.id) === String(eventId));

      if (!found) {
        const singleRes = await fetch(`http://localhost:8080/events/${eventId}`, { credentials: "include" });
        if (singleRes.ok) {
          const singleData = await singleRes.json();
          found = singleData;
        }
      }

      setEvent(found || null);

      const attRes = await fetch(`http://localhost:8080/events/attendees/${eventId}`, { credentials: "include" });
      if (attRes.ok) {
        const attJson = await attRes.json().catch(() => null);
        let processed = [];
        if (Array.isArray(attJson)) {
          processed = attJson.map((a) => {
            if (typeof a === "string") return { email: a };
            if (a && typeof a === "object") return { email: a.email || a.Email || "" };
            return { email: "" };
          }).filter(x => x.email);
        }
        setAttendees(processed);
      } else {
        setAttendees([]);
      }
    } catch (err) {
      console.error(err);
      setEvent(null);
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-card" style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: 18 }}>
          <button className="view-back-button" onClick={() => navigate(-1)}>← Back</button>
        </div>

        {!event ? (
          <div className="dashboard-section">
            <h2>Event not found</h2>
            <p className="empty-text">This event could not be located.</p>
          </div>
        ) : (
          <>
            <div className="dashboard-section">
              <h2 style={{ marginBottom: 8 }}>{event.title}</h2>
              <p><strong>Date:</strong> {event.date}</p>
              <p><strong>Time:</strong> {event.time}</p>
              <p><strong>Location:</strong> {event.location}</p>
              <p style={{ marginTop: 12 }}>{event.description}</p>
              <p style={{ marginTop: 12, color: "#6b7280" }}><strong>Organizer:</strong> {event.organizer}</p>
            </div>

            <div className="dashboard-section">
              <h2>Attendees</h2>
              {attendees.length === 0 ? (
                <p className="empty-text">No accepted attendees yet.</p>
              ) : (
                <div className="event-grid" style={{ padding: 0 }}>
                  <table className="attendee-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "12px 8px" }}>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((a) => (
                        <tr key={a.email} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 8px", verticalAlign: "middle", color: "#6b7280" }}>
                            {a.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ViewEventPage;