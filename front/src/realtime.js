import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, 
  Legend, Brush, ReferenceLine
} from "recharts";
import "./realtime.css";

function Realtime() {
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [kafkaLogs, setKafkaLogs] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [userData, setUserData] = useState({ user: "", date: "" });
  const [usersSeen, setUsersSeen] = useState([]);
  const [highRiskActivities, setHighRiskActivities] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [predictionComplete, setPredictionComplete] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const logsEndRef = useRef(null);
  const kafkaLogsEndRef = useRef(null);
  const scrollableProducerRef = useRef(null);
  const scrollableKafkaRef = useRef(null);
  const acceptEventsRef = useRef(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [emailProcessingStatus, setEmailProcessingStatus] = useState("");
  const [emailsData, setEmailsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamDelayMs, setStreamDelayMs] = useState(500);
  const [chartZoomLevel, setChartZoomLevel] = useState('all');
  const [chartDomain, setChartDomain] = useState([0, 'auto']);
  const [newLogIndexes, setNewLogIndexes] = useState({});
  const [newKafkaLogIndexes, setNewKafkaLogIndexes] = useState({});
  
  // Reconstruction error threshold - 95th percentile at 0.3
  const RECONSTRUCTION_THRESHOLD = 0.3;

  // Function to auto-scroll to bottom
  const scrollToBottom = (ref) => {
    if (ref && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };

  // Helper to detect if the log contains risk score
  const getRiskLevel = (log) => {
    const riskMatch = log.match(/Sent risk: (\d+(\.\d+)?)/);
    if (riskMatch) {
      const risk = parseFloat(riskMatch[1]);
      if (risk > 90) return "risk-high";
      if (risk > 70) return "risk-medium";
      return "risk-low";
    }
    return "";
  };

  useEffect(() => {
    const nextSocket = io("http://localhost:5000");
    setSocket(nextSocket);

    const handleConnect = () => {
      setSocketConnected(true);
      setUploadStatus("");
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setUploadStatus("Backend disconnected.");
      setLoading(false);
      setIsPredicting(false);
      acceptEventsRef.current = false;
    };

    const handleConnectError = (err) => {
      setSocketConnected(false);
      setUploadStatus(`Backend connection error: ${err?.message || "unknown error"}`);
      setLoading(false);
      setIsPredicting(false);
      acceptEventsRef.current = false;
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    nextSocket.on("connect_error", handleConnectError);

    return () => {
      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.off("connect_error", handleConnectError);
      nextSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    // Listen for producer logs (Risk Score and Timestamp)
    socket.on("producer_log", ({ message }) => {
      if (!acceptEventsRef.current) return;
      console.log("Producer Log:", message);

      const match = message.match(/Sent risk: (\d+(\.\d+)?) at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      if (match) {
        const risk_score = parseFloat(match[1]);
        const timestamp = match[3];

        setRiskScores((prevScores) => [...prevScores, { timestamp, risk_score }]);
      }

      setLogs((prevLogs) => {
        const newLogs = [...prevLogs, message];
        // Mark the new log index for animation
        setNewLogIndexes(prev => ({
          ...prev,
          [newLogs.length - 1]: true
        }));
        
        // Auto-scroll to bottom after state update
        setTimeout(() => scrollToBottom(scrollableProducerRef), 50);
        
        // Clear the "new" status after animation time
        setTimeout(() => {
          setNewLogIndexes(prev => {
            const updated = {...prev};
            delete updated[newLogs.length - 1];
            return updated;
          });
        }, 2000);
        
        return newLogs;
      });
      
      setIsPredicting(true);
    });

    // Listen for Kafka messages (Full Data + Extracted User & Date)
    socket.on("new_kafka_message", (data) => {
      if (!acceptEventsRef.current) return;
      console.log("Kafka Message:", data);

      if (data.user && data.date) {
        setUserData({ user: data.user, date: data.date });
        setUsersSeen((prev) => (prev.includes(data.user) ? prev : [...prev, data.user]));
      }

      // Store full Kafka message (as JSON)
      setKafkaLogs((prevLogs) => {
        const newLogs = [...prevLogs, JSON.stringify(data, null, 2)];
        
        // Mark the new kafka log for animation
        setNewKafkaLogIndexes(prev => ({
          ...prev,
          [newLogs.length - 1]: true
        }));
        
        // Auto-scroll to bottom after state update
        setTimeout(() => scrollToBottom(scrollableKafkaRef), 50);
        
        // Clear the "new" status after animation time
        setTimeout(() => {
          setNewKafkaLogIndexes(prev => {
            const updated = {...prev};
            delete updated[newLogs.length - 1];
            return updated;
          });
        }, 2000);
        
        return newLogs;
      });

      // Extract high-risk activities
      if (data.activity && data.risk_score > 95) {
        setHighRiskActivities((prev) => {
          const category = data.activity.startsWith("http") ? "http" : data.activity.startsWith("email") ? "email" : null;
          if (category) {
            return {
              ...prev,
              [category]: [...(prev[category] || []), { activity: data.activity, risk: data.risk_score }],
            };
          }
          return prev;
        });
      }
    });

    return () => {
      socket.off("producer_log");
      socket.off("new_kafka_message");
    };
  }, [socket]);

  // Auto-scroll when logs update
  useEffect(() => {
    if (isPredicting) {
      scrollToBottom(scrollableProducerRef);
    }
  }, [logs, isPredicting]);

  // Auto-scroll when kafka logs update
  useEffect(() => {
    if (isPredicting) {
      scrollToBottom(scrollableKafkaRef);
    }
  }, [kafkaLogs, isPredicting]);

  // Listen for prediction completion event
  useEffect(() => {
    if (!socket) return;
    socket.on("prediction_done", () => {
      console.log("Prediction completed. Showing results...");
      setPredictionComplete(true);
      setIsPredicting(false);
      setUploadStatus("Prediction complete. Processing email anomalies...");
      acceptEventsRef.current = false;

      // Emit event to process email data after prediction is done
      socket.emit("process_email_data");
    });

    return () => {
      socket.off("prediction_done");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    // Listen for real-time email processing updates
    socket.on("email_processing_update", ({ status }) => {
      console.log("Processing Update:", status);
      setEmailProcessingStatus(status);
    });

    // Listen for final email analysis data
    socket.on("email_analysis", (data) => {
      console.log("Email Analysis Data:", data);
      setEmailsData(JSON.parse(data));
    });

    socket.on("csv_success", ({ message }) => {
      setUploadStatus(message || "CSV uploaded.");
    });

    socket.on("csv_error", ({ error }) => {
      setUploadStatus(error || "CSV error.");
      setLoading(false);
      setIsPredicting(false);
      acceptEventsRef.current = false;
    });

    socket.on("stream_started", ({ message }) => {
      setStreaming(true);
      setUploadStatus(message || "Streaming started.");
      setIsPredicting(true);
      acceptEventsRef.current = true;
    });

    socket.on("stream_stopped", ({ message }) => {
      setStreaming(false);
      setUploadStatus(message || "Streaming stopped.");
      setIsPredicting(false);
      acceptEventsRef.current = false;
    });

    socket.on("stream_finished", ({ message }) => {
      setStreaming(false);
      setUploadStatus("Streaming finished. Processing email anomalies...");
      setIsPredicting(false);
      acceptEventsRef.current = false;
      socket.emit("process_email_data");
    });

    socket.on("stream_error", ({ error }) => {
      setStreaming(false);
      setUploadStatus(error || "Stream error.");
      setLoading(false);
      setIsPredicting(false);
      acceptEventsRef.current = false;
    });

    return () => {
      socket.off("email_processing_update");
      socket.off("email_analysis");
      socket.off("csv_success");
      socket.off("csv_error");
      socket.off("stream_started");
      socket.off("stream_stopped");
      socket.off("stream_finished");
      socket.off("stream_error");
    };
  }, [socket]);

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!socketConnected || !socket) {
      setUploadStatus("Backend not connected. Start the RealtimeBackend server on port 5000.");
      return;
    }

    if (csvFile) {
      // Clear previous data and set loading state
      setLoading(true);
      setUploadStatus("Uploading CSV...");
      setLogs([]);
      setKafkaLogs([]);
      setRiskScores([]);
      setUserData({ user: "", date: "" });
      setUsersSeen([]);
      setHighRiskActivities({});
      setPredictionComplete(false);
      setEmailsData([]);
      setEmailProcessingStatus("");
      setIsPredicting(true);
      setNewLogIndexes({});
      setNewKafkaLogIndexes({});

      const reader = new FileReader();
      reader.readAsText(csvFile);
      reader.onload = () => {
        const fileContent = reader.result;
        socket.emit("upload_csv", { fileContent }, (ack) => {
          if (ack && ack.ok === false) {
            setUploadStatus(ack.error || "Upload failed.");
            setLoading(false);
            setIsPredicting(false);
            return;
          }
          setLoading(false);
        });
      };
    }
  };

  const handleStartStream = () => {
    if (!socketConnected || !socket) {
      setUploadStatus("Backend not connected. Start the RealtimeBackend server on port 5000.");
      return;
    }
    if (!csvFile) return;

    setLoading(true);
    setUploadStatus("Starting stream...");
    setLogs([]);
    setKafkaLogs([]);
    setRiskScores([]);
    setUserData({ user: "", date: "" });
    setUsersSeen([]);
    setHighRiskActivities({});
    setPredictionComplete(false);
    setEmailsData([]);
    setEmailProcessingStatus("");
    setIsPredicting(true);
    acceptEventsRef.current = true;
    setNewLogIndexes({});
    setNewKafkaLogIndexes({});

    const reader = new FileReader();
    reader.readAsText(csvFile);
    reader.onload = () => {
      const fileContent = reader.result;
      socket.emit("start_stream", { fileContent, stepDelayMs: streamDelayMs, loop: true }, (ack) => {
        if (ack && ack.ok === false) {
          setUploadStatus(ack.error || "Stream start failed.");
          setLoading(false);
          setIsPredicting(false);
          return;
        }
        setLoading(false);
      });
    };
  };

  const handleStopStream = () => {
    if (!socket) return;
    acceptEventsRef.current = false;
    socket.emit("stop_stream", {}, () => {});
  };

  // Helper to get anomaly score color based on value
  const getScoreColor = (score) => {
    if (score > 0.7) return "#fa4549"; // High anomaly - red
    if (score > 0.5) return "#f97e23"; // Medium anomaly - orange
    return "#238636"; // Low anomaly - green
  };

  // Helper to get reconstruction error color based on threshold
  const getErrorColor = (error) => {
    if (error > RECONSTRUCTION_THRESHOLD * 1.5) return "#fa4549"; // High error - red
    if (error > RECONSTRUCTION_THRESHOLD) return "#f97e23"; // Medium error - orange
    return "#238636"; // Low error - green
  };

  // Format timestamps for chart
  const formatTimestamp = (timestamp) => {
    return timestamp.split(' ')[1]; // Extract only time part
  };

  // Handle chart zoom level changes
  const handleZoomChange = (level) => {
    setChartZoomLevel(level);
    
    switch(level) {
      case 'high':
        setChartDomain([50, 100]);
        break;
      case 'medium':
        setChartDomain([25, 100]);
        break;
      case 'low':
        setChartDomain([0, 50]);
        break;
      default:
        setChartDomain([0, 'auto']);
    }
  };

  // Function to handle brush change (custom zoom)
  const handleBrushChange = (brushData) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      // User is selecting a range with the brush
      if (brushData.startIndex === brushData.endIndex) {
        // Reset to full view if brush is too small
        setChartDomain([0, 'auto']);
        setChartZoomLevel('all');
      }
    }
  };

  return (
    <div className="App1">
      <div className="realtime-header">
        <h1 className="realtime-title">
          <i className="fas fa-bolt"></i>
          Real-time Anomaly Detection Dashboard
        </h1>
      </div>
      
      {userData.user || userData.date ? (
        <div className="user-badge">
          <i className="fas fa-user-shield"></i>
          <span>Users: {usersSeen.length > 0 ? usersSeen.join(", ") : userData.user}</span>
          {userData.date && (
            <>
              <i className="fas fa-calendar-alt"></i>
              <span>Latest Date: {userData.date}</span>
            </>
          )}
        </div>
      ) : (
        <div className="user-badge">
          <i className="fas fa-info-circle"></i>
          <span>Upload a CSV file to start analysis</span>
        </div>
      )}

      <div className="file-upload-container">
        <div className="file-input-wrapper">
          <label htmlFor="file-upload" className="file-label">
            <i className="fas fa-file-csv"></i>
            Choose CSV File
          </label>
          <input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            accept=".csv"
            className="file-input"
          />
        </div>
        
        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={!csvFile || loading || !socketConnected}
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Uploading...
            </>
          ) : (
            <>
              <i className="fas fa-cloud-upload-alt"></i>
              Upload & Analyze
            </>
          )}
        </button>

        <button
          className="upload-btn"
          style={{ marginLeft: 12, background: streaming ? "#30363d" : undefined }}
          onClick={handleStartStream}
          disabled={!csvFile || loading || !socketConnected || streaming}
        >
          <i className="fas fa-play"></i>
          Start Stream
        </button>

        <button
          className="upload-btn"
          style={{ marginLeft: 12, background: "#8b949e", color: "#0d1117" }}
          onClick={handleStopStream}
          disabled={!socketConnected || !streaming}
        >
          <i className="fas fa-stop"></i>
          Stop
        </button>

        <select
          value={streamDelayMs}
          onChange={(e) => setStreamDelayMs(Number(e.target.value))}
          disabled={streaming}
          style={{ marginLeft: 12, height: 42, borderRadius: 8, padding: "0 10px" }}
        >
          <option value={100}>0.1s / step</option>
          <option value={250}>0.25s / step</option>
          <option value={500}>0.5s / step</option>
          <option value={1000}>1s / step</option>
        </select>
        
        {csvFile && (
          <div className="selected-file">
            Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
          </div>
        )}

        {uploadStatus && (
          <div className="status">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-info-circle"></i>}
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Side-by-side Producer and Kafka Logs */}
      <div className="logs-grid">
        {/* Producer Logs */}
        <div className="log-container">
          <h2>
            <i className="fas fa-terminal"></i>
            Producer Logs
          </h2>
          <div 
            className="scrollable-box" 
            ref={scrollableProducerRef}
          >
            {logs.length > 0 ? (
              logs.map((log, index) => {
                const isNew = newLogIndexes[index];
                const riskClass = getRiskLevel(log);
                
                return (
                  <div 
                    key={index}
                    className={`log-entry ${riskClass} ${isNew ? 'new-log shimmer-bg' : ''}`}
                  >
                    <span className={isNew ? 'pulse-text' : ''}>
                      {log}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ color: '#8b949e', textAlign: 'center', padding: '2rem' }}>
                No logs available yet
              </div>
            )}
          </div>
        </div>

        {/* Kafka Messages */}
        <div className="log-container animated-border">
          <h2>
            <i className="fas fa-exchange-alt"></i>
            Kafka Messages
          </h2>
          <div 
            className="scrollable-box" 
            ref={scrollableKafkaRef}
          >
            {kafkaLogs.length > 0 ? (
              kafkaLogs.map((log, index) => {
                const parsedData = JSON.parse(log);
                const isNew = newKafkaLogIndexes[index];
                
                return (
                  <pre 
                    key={index} 
                    className={`json-box ${isNew ? 'shimmer-bg' : ''}`}
                  >
                    {Object.entries(parsedData).map(([key, value]) => (
                      <div key={key}>
                        <span className="json-key">"{key}"</span>: 
                        <span className={`json-value ${isNew && key === 'risk_score' ? 'pulse-text' : ''}`}>
                          "{value}"
                        </span>
                      </div>
                    ))}
                  </pre>
                );
              })
            ) : (
              <div style={{ color: '#8b949e', textAlign: 'center', padding: '2rem' }}>
                No Kafka messages available yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risk Score Chart with Zoom Controls */}
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">
            <i className="fas fa-chart-line"></i>
            Risk Score Timeline
          </h3>
        </div>
        
        {riskScores.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart 
                data={riskScores.map(item => ({
                  ...item,
                  formattedTime: formatTimestamp(item.timestamp)
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis 
                  dataKey="formattedTime" 
                  tick={{ fontSize: 12, fill: "#8b949e" }}
                  stroke="#30363d"
                />
                <YAxis 
                  domain={chartDomain} 
                  tick={{ fontSize: 12, fill: "#8b949e" }}
                  stroke="#30363d"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    color: '#e6edf3'
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ paddingBottom: '10px', color: '#8b949e' }}
                />
                <ReferenceLine y={95} stroke="#fa4549" strokeDasharray="3 3" label={{ 
                  value: 'High Risk (95)', 
                  position: 'right', 
                  fill: '#fa4549',
                  fontSize: 12
                }} />
                <ReferenceLine y={75} stroke="#f97e23" strokeDasharray="3 3" label={{ 
                  value: 'Medium Risk (75)', 
                  position: 'right', 
                  fill: '#f97e23',
                  fontSize: 12
                }} />
                <Line 
                  type="monotone" 
                  dataKey="risk_score" 
                  name="Risk Score" 
                  stroke="#2188ff" 
                  strokeWidth={2}
                  dot={{ stroke: '#2188ff', strokeWidth: 2, r: 4, fill: '#161b22' }}
                  activeDot={{ stroke: '#2188ff', strokeWidth: 2, r: 6, fill: '#161b22' }}
                />
                <Brush 
                  dataKey="formattedTime" 
                  height={30} 
                  stroke="#2188ff" 
                  fill="#161b22"
                  onChange={handleBrushChange}
                  tickFormatter={() => ''}
                />
              </LineChart>
            </ResponsiveContainer>
            
            {/* Zoom controls */}
            <div className="chart-controls">
              <button 
                className={`chart-control-btn ${chartZoomLevel === 'all' ? 'active' : ''}`}
                onClick={() => handleZoomChange('all')}
              >
                All Scores
              </button>
              <button 
                className={`chart-control-btn ${chartZoomLevel === 'high' ? 'active' : ''}`}
                onClick={() => handleZoomChange('high')}
              >
                High Risk (50-100)
              </button>
              <button 
                className={`chart-control-btn ${chartZoomLevel === 'medium' ? 'active' : ''}`}
                onClick={() => handleZoomChange('medium')}
              >
                Medium+ (25-100)
              </button>
              <button 
                className={`chart-control-btn ${chartZoomLevel === 'low' ? 'active' : ''}`}
                onClick={() => handleZoomChange('low')}
              >
                Low Risk (0-50)
              </button>
            </div>
          </>
        ) : (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
            <span>No risk score data available yet</span>
          </div>
        )}
      </div>

      {/* High-Risk Categories - Only show after prediction */}
      {predictionComplete && Object.keys(highRiskActivities).length > 0 && (
        <div className="log-container animated-border">
          <h2>
            <i className="fas fa-exclamation-triangle"></i>
            High-Risk Activity Categories
          </h2>
          <div className="category-buttons">
            {Object.keys(highRiskActivities).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
                className={`category-button ${category === selectedCategory ? 'active' : ''}`}
              >
                <i className={`fas fa-${category === "http" ? "globe" : "envelope"}`}></i>
                {category === "http" ? "HTTP Related Issues" : "Email Related Issues"}
                <span className="category-count">{highRiskActivities[category]?.length}</span>
              </button>
            ))}
          </div>

          {/* Show activities when category is clicked */}
          {selectedCategory && (
            <div className="scrollable-box" style={{ marginTop: '1rem' }}>
              {highRiskActivities[selectedCategory]?.map((item, index) => (
                <div key={index} className="activity-item shimmer-bg">
                  <span className="activity-label">{item.activity}</span>
                  <span className="risk-score">{item.risk}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Email Analysis Section */}
      {(emailProcessingStatus || emailsData.length > 0) && (
        <>
          <hr className="section-divider" />
          <h1>Email Anomaly Analysis</h1>
          
          {/* Real-time processing status */}
          {emailProcessingStatus && (
            <div className="status">
              <i className="fas fa-spinner fa-spin"></i>
              {emailProcessingStatus}
            </div>
          )}

          {/* Display analyzed emails with circular scores */}
          {emailsData.length > 0 && (
            <div className="email-results">
              <div className="email-cards">
                {emailsData.map((email, index) => {
                  // Normalize scores for visualization
                  const normalizedAnomalyScore = Math.min(Math.max(email.anomaly_score, 0), 1);
                  const percentAnomalyScore = (normalizedAnomalyScore * 100).toFixed(0);
                  
                  return (
                    <div key={index} className="email-card">
                      <h3>
                        <i className="fas fa-envelope"></i>
                        Email {index + 1}
                      </h3>
                      
                      {/* Email content with highlighting */}
                      <div className="email-text" dangerouslySetInnerHTML={{ __html: email.email_text }} />
                      
                      {/* Circular Score Indicators */}
                      <div className="scores-container">
                        {/* Anomaly Score Circle */}
                        <div className="circle-score">
                          <div className="circle-wrapper">
                            <div className="circle-bg"></div>
                            <div 
                              className="circle-fill" 
                              style={{ 
                                '--score-percent': `${percentAnomalyScore}%`,
                                '--score-color': getScoreColor(normalizedAnomalyScore)
                              }}
                            ></div>
                            <div 
                              className="circle-inner"
                              style={{ '--score-color': getScoreColor(normalizedAnomalyScore) }}
                            >
                              {percentAnomalyScore}
                            </div>
                          </div>
                          <div className="circle-label">Anomaly Score</div>
                        </div>
                        
                        {/* Similarity Score (use highest similarity) */}
                        {email.similar_emails && email.similar_emails.length > 0 && (
                          <div className="circle-score">
                            <div className="circle-wrapper">
                              <div className="circle-bg"></div>
                              <div 
                                className="circle-fill" 
                                style={{ 
                                  '--score-percent': `${(email.similar_emails[0].similarity_score * 100).toFixed(0)}%`,
                                  '--score-color': '#2188ff'
                                }}
                              ></div>
                              <div 
                                className="circle-inner"
                                style={{ '--score-color': '#2188ff' }}
                              >
                                {(email.similar_emails[0].similarity_score * 100).toFixed(0)}
                              </div>
                            </div>
                            <div className="circle-label">Similarity</div>
                          </div>
                        )}
                      </div>
                      
                      {/* Reconstruction Error with Threshold Visualization */}
                      <div style={{ margin: '2rem 0 1rem', textAlign: 'center' }}>
                        <div style={{ color: '#e6edf3', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                          Reconstruction Error: {email.reconstruction_error.toFixed(4)}
                        </div>
                        
                        <div className="threshold-indicator">
                          <div className="threshold-fill" style={{ width: '100%' }}></div>
                          
                          {/* 95th Percentile Threshold Marker */}
                          <div 
                            className="threshold-marker" 
                            style={{ left: `${RECONSTRUCTION_THRESHOLD * 100 / (RECONSTRUCTION_THRESHOLD * 3)}%` }}
                          ></div>
                          <div 
                            className="threshold-value" 
                            style={{ left: `${RECONSTRUCTION_THRESHOLD * 100 / (RECONSTRUCTION_THRESHOLD * 3)}%` }}
                          >
                            Threshold: {RECONSTRUCTION_THRESHOLD}
                          </div>
                          
                          {/* Current Email Error Marker */}
                          <div 
                            className="error-marker" 
                            style={{ 
                              left: `${Math.min(email.reconstruction_error * 100 / (RECONSTRUCTION_THRESHOLD * 3), 100)}%`,
                              '--marker-color': getErrorColor(email.reconstruction_error)
                            }}
                          ></div>
                          <div 
                            className="error-value" 
                            style={{ 
                              left: `${Math.min(email.reconstruction_error * 100 / (RECONSTRUCTION_THRESHOLD * 3), 100)}%`,
                              '--marker-color': getErrorColor(email.reconstruction_error)
                            }}
                          >
                            {email.reconstruction_error.toFixed(4)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Similar Emails Section */}
                      {email.similar_emails && email.similar_emails.length > 0 && (
                        <div className="similar-emails">
                          <h4>
                            <i className="fas fa-link"></i> Similar Emails
                          </h4>
                          {email.similar_emails.map((simEmail, i) => (
                            <div key={i} className="similar-email-item">
                              <div className="similar-email-header">
                                <span className="similarity-rank">Rank {simEmail.rank}</span>
                                <span className="similarity-score">{(simEmail.similarity_score * 100).toFixed(2)}%</span>
                              </div>
                              <div className="similar-email-body">{simEmail.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Add Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    </div>
  );
}

export default Realtime;
