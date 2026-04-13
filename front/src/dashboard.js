import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./dashboard.css";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function AnomalyDashboard() {
  const [file, setFile] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anomalyData, setAnomalyData] = useState([]);

  // Initialize empty data for better UI experience
  useEffect(() => {
    // This would normally be empty but we're keeping placeholders for better UI
    setUsers({});
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      await axios.post("http://localhost:5001/upload", formData);
      alert("File uploaded successfully!");
      const response = await axios.get("http://localhost:5001/get_user_dates");
      setUsers(response.data.users);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Error uploading file!");
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async () => {
    try {
      setLoading(true);
      const response = await axios.post("http://localhost:5001/predict");
      const rawAnomalyData = response.data.anomaly_data || [];
      if (!Array.isArray(rawAnomalyData) || rawAnomalyData.length === 0) {
        throw new Error("No anomaly data returned from /predict");
      }

      const scaledAnomalyData = rawAnomalyData.map((entry) => {
        const score = Number(entry.anomaly_score);
        const safeScore = Number.isFinite(score) ? Math.max(1, Math.min(100, score)) : 1;
        return { ...entry, anomaly_score: safeScore };
      });

      setAnomalyData(scaledAnomalyData);
      alert("Prediction complete!");
    } catch (error) {
      console.error("Prediction failed:", error);
      alert("Error during prediction!");
    } finally {
      setLoading(false);
    }
  };
  
  // Group data by user
  const groupedData = anomalyData.reduce((acc, { user, day, anomaly_score }) => {
    if (!acc[user]) acc[user] = [];
    acc[user].push({ day, anomaly_score: Math.round(anomaly_score) });
    return acc;
  }, {});

  // Find max anomaly by day
  const maxAnomalyByDay = anomalyData.reduce((acc, { user, day, anomaly_score }) => {
    if (!acc[day] || anomaly_score > acc[day].anomaly_score) {
      acc[day] = { day, anomaly_score, user }; // Store user with max anomaly score
    }
    return acc;
  }, {});

  const lineChartData = Object.values(maxAnomalyByDay); // Convert object to array

  // Find max score for each user
  const userMaxScores = anomalyData.reduce((acc, { user, anomaly_score }) => {
    if (!acc[user] || anomaly_score > acc[user]) {
      acc[user] = anomaly_score;
    }
    return acc;
  }, {});

  // Convert object to array for circular scores
  const circleScoreData = Object.entries(userMaxScores).map(([user, maxScore]) => ({
    user,
    score: Math.round(maxScore),
    category: maxScore > 50 ? "Anomalous" : "Normal",
    color: maxScore > 70 ? "#fa4549" : (maxScore > 50 ? "#f97e23" : "#238636")
  }));

  // Get color based on score
  const getScoreColor = (score) => {
    if (score > 70) return "#fa4549"; // High risk - red
    if (score > 50) return "#f97e23"; // Medium risk - orange
    return "#238636"; // Low risk - green
  };

  // For each bar in bar charts
  const getBarColor = (score) => {
    if (score > 70) return "#fa4549"; // High risk - red
    if (score > 50) return "#f97e23"; // Medium risk - orange
    return "#238636"; // Low risk - green
  };

  return (
    <div className="dashboard-container">
      {/* GitHub-inspired particle background */}
      <div className="dashboard-particles"></div>

      <div className="dashboard-content">
        <div className="dashboard-header-row">
          <h2 className="dashboard-title">
            <i className="fas fa-chart-line"></i>
            Threat Detection Analysis
          </h2>
          <div className="dashboard-actions">
            <div className="file-upload-wrapper">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".csv"
                id="file-upload"
                className="file-upload-input"
              />
              <label htmlFor="file-upload" className="file-upload-label">
                <i className="fas fa-upload"></i>
                Choose File
              </label>
            </div>
            <button
              onClick={handleUpload}
              disabled={loading}
              className="action-button"
            >
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-cloud-upload-alt"></i>
              )}
              {loading ? "Uploading..." : "Upload & Load Data"}
            </button>
          </div>
        </div>

        {/* Always show the Data Section with either data or empty state */}
        <div className="data-section animated-border">
          <div className="section-header">
            <h3>
              <i className="fas fa-users"></i>
              Users & Available Dates
            </h3>
            <button
              onClick={handlePredict}
              disabled={loading || Object.keys(users).length === 0}
              className="action-button"
            >
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-brain"></i>
              )}
              {loading ? "Analyzing..." : "Get Anomaly Scores"}
            </button>
          </div>

          {Object.keys(users).length > 0 ? (
            <div className="users-table-wrapper">
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Available Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(users).map(([user, dates]) => (
                    <tr key={user}>
                      <td>{user}</td>
                      <td>
                        <div className="date-container">
                          {dates.map((date) => (
                            <span key={date} className="date-circle">
                              {date}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <i className="fas fa-cloud-upload-alt"></i>
              <p>No data available. Please upload a CSV file to begin analysis.</p>
            </div>
          )}

          {/* Circular Score Visualization - Always show */}
          <div className="chart-container">
            <h3>Anomaly Score Distribution</h3>
            
            {circleScoreData.length > 0 ? (
              <div className="circle-scores-container">
                {circleScoreData.map((item) => (
                  <div className="user-circle-score" key={item.user}>
                    <div className="circle-score-wrapper">
                      <div className="circle-score-bg"></div>
                      <div 
                        className="circle-score-fill" 
                        style={{ 
                          '--score-percent': `${item.score}%`,
                          '--score-color': item.color
                        }}
                      ></div>
                      <div 
                        className="circle-score-inner"
                        style={{ '--score-color': item.color }}
                      >
                        {item.score}
                      </div>
                    </div>
                    <div className="circle-score-user">{item.user}</div>
                    <div className="circle-score-label">
                      {item.score > 70 ? "High Risk" : item.score > 50 ? "Medium Risk" : "Low Risk"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show placeholders when no data
              <div className="circle-scores-container">
                {[1, 2, 3].map((i) => (
                  <div className="user-circle-score" key={`placeholder-${i}`}>
                    <div className="circle-score-wrapper">
                      <div className="circle-score-placeholder">?</div>
                    </div>
                    <div className="circle-score-user">User {i}</div>
                    <div className="circle-score-label">No Data</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Max Anomaly Line Chart - Always show */}
          <div className="max-anomaly-chart">
            <h3>Max Anomaly Score Per Day</h3>
            
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <XAxis dataKey="day" stroke="#8b949e" />
                  <YAxis domain={[0, 100]} stroke="#8b949e" />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#1c2128', 
                      border: '1px solid #30363d',
                      color: '#e6edf3'
                    }}
                    formatter={(value, name, props) => [
                      `Anomaly Score: ${value.toFixed(2)}`,
                      `User: ${props.payload.user}`,
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="anomaly_score" 
                    stroke="#2188ff" 
                    strokeWidth={2}
                    dot={{ 
                      r: 5, 
                      fill: "#1c2128", 
                      stroke: "#2188ff", 
                      strokeWidth: 2 
                    }}
                    activeDot={{ 
                      r: 8, 
                      fill: "#1c2128", 
                      stroke: "#2188ff", 
                      strokeWidth: 2 
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="placeholder-chart">
                <span>Data will appear here after analysis</span>
              </div>
            )}
          </div>

          {/* Daily Score Charts - Always show section */}
          <div className="daily-scores-section">
            <h3>Daily Anomaly Scores</h3>
            
            {Object.keys(groupedData).length > 0 ? (
              Object.entries(groupedData).map(([user, data]) => (
                <div key={user} className="user-daily-scores">
                  <h4>{user}</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <XAxis dataKey="day" stroke="#8b949e" />
                      <YAxis domain={[0, 100]} stroke="#8b949e" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#87ceeb', 
                          border: '1px solid rgb(55, 35, 86)',
                          color: '#21262d'
                        }}
                      />
                      <Bar dataKey="anomaly_score">
                        {data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getBarColor(entry.anomaly_score)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))
            ) : (
              // Show placeholder when no data
              <div className="user-daily-scores">
                <h4>User Activity</h4>
                <div className="placeholder-chart">
                  <span>Upload and analyze data to see daily patterns</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Add Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    </div>
  );
}

export default AnomalyDashboard;
