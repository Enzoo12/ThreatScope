import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    const [particles, setParticles] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [connections, setConnections] = useState([]);
    const animationRef = useRef(null);
    
    useEffect(() => {
        const particleCount = 70;
        const newParticles = Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            startX: Math.random() * window.innerWidth,
            startY: Math.random() * window.innerHeight,
            endX: Math.random() * window.innerWidth,
            endY: Math.random() * window.innerHeight,
            size: 1 + Math.random() * 2,
            duration: 3 + Math.random() * 10,
            delay: Math.random() * 5,
            opacity: 0.3 + Math.random() * 0.7
        }));
        setParticles(newParticles);
        
        const handleResize = () => {
            const refreshedParticles = newParticles.map(particle => ({
                ...particle,
                startX: Math.random() * window.innerWidth,
                startY: Math.random() * window.innerHeight,
                endX: Math.random() * window.innerWidth,
                endY: Math.random() * window.innerHeight,
            }));
            setParticles(refreshedParticles);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    useEffect(() => {
        const nodeCount = 6;
        const containerWidth = animationRef.current?.clientWidth || 400;
        const containerHeight = animationRef.current?.clientHeight || 400;
        
        const newNodes = Array.from({ length: nodeCount }, (_, i) => {
            const angle = (2 * Math.PI * i) / nodeCount;
            const radius = Math.min(containerWidth, containerHeight) * 0.35;
            return {
                id: i,
                x: containerWidth / 2 + Math.cos(angle) * radius,
                y: containerHeight / 2 + Math.sin(angle) * radius,
                size: 8 + Math.random() * 8,
                delay: i * 0.5,
                pulseDelay: i * 0.2,
                color: `rgba(88, ${166 + Math.floor(i * 10)}, ${255 - Math.floor(i * 15)}, ${0.7 + Math.random() * 0.3})`
            };
        });
        
        const newConnections = [];
        for (let i = 0; i < nodeCount; i++) {
            for (let j = 1; j <= 2; j++) {
                const targetIndex = (i + j) % nodeCount;
                newConnections.push({
                    id: `${i}-${targetIndex}`,
                    from: newNodes[i],
                    to: newNodes[targetIndex],
                    opacity: 0.3 + Math.random() * 0.5,
                    pulseDelay: (i * 0.3 + j * 0.2) % 2
                });
            }
        }
        
        setNodes(newNodes);
        setConnections(newConnections);
        
        const handleResize = () => {
            if (!animationRef.current) return;
            const width = animationRef.current.clientWidth;
            const height = animationRef.current.clientHeight;
            
            const updatedNodes = newNodes.map((node, i) => {
                const angle = (2 * Math.PI * i) / nodeCount;
                const radius = Math.min(width, height) * 0.35;
                return {
                    ...node,
                    x: width / 2 + Math.cos(angle) * radius,
                    y: height / 2 + Math.sin(angle) * radius,
                };
            });
            
            setNodes(updatedNodes);
            
            const updatedConnections = newConnections.map(conn => {
                const fromNode = updatedNodes.find(n => n.id === conn.from.id);
                const toNode = updatedNodes.find(n => n.id === conn.to.id);
                return { ...conn, from: fromNode, to: toNode };
            });
            
            setConnections(updatedConnections);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    return (
        <div className="landing">
            {/* Particles Background */}
            <div className="particles">
                {particles.map(particle => (
                    <div
                        key={particle.id}
                        className="particle"
                        style={{
                            '--start-x': `${particle.startX}px`,
                            '--start-y': `${particle.startY}px`,
                            '--end-x': `${particle.endX}px`,
                            '--end-y': `${particle.endY}px`,
                            '--particle-duration': `${particle.duration}s`,
                            '--particle-delay': `${particle.delay}s`,
                            '--particle-size': `${particle.size}px`,
                            '--particle-opacity': particle.opacity,
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                            animationDelay: `${particle.delay}s`,
                            opacity: particle.opacity
                        }}
                    />
                ))}
            </div>
            
            {/* Hero Section */}
            <div className="hero">
                <div className="hero-content">
                    <h1 className="hero-title">ThreatScope</h1>
                    <p className="subtitle">Monitor insider activity and detect anomalies</p>
                    <div className="cta-buttons">
                        <Link to="/realtime" className="cta-button primary-button">
                            Realtime detection
                        </Link>
                        <Link to="/dashboard" className="cta-button secondary-button">
                            Daily Analysis
                        </Link>
                    </div>
                </div>
            </div>
            
            {/* Animation Section */}
            <div className="animation-section">
                <div className="section-title">
                    <h2>Advanced Detection Visualization</h2>
                </div>
                
                <div className="histogram-container">
                    {Array.from({ length: 10 }, (_, i) => (
                        <div
                            key={i}
                            className="histogram-bar"
                            style={{
                                '--min-height': `${20 + Math.random() * 30}px`,
                                '--max-height': `${120 + Math.random() * 80}px`,
                                '--bar-color-start': '#388bfd',
                                '--bar-color-end': '#79c0ff',
                                animationDelay: `${i * 0.2}s`
                            }}
                        />
                    ))}
                </div>
                
                <div className="visualization-grid">
                    <div className="alert-container">
                        <div className="alert-ring" />
                        <div className="alert-ring" style={{ animationDelay: '0.5s' }} />
                        <div className="alert-ring" style={{ animationDelay: '1s' }} />
                        <div className="alert-icon">
                            <i className="fas fa-exclamation-triangle" />
                        </div>
                    </div>
                    
                    <div className="network-container" ref={animationRef}>
                        {connections.map(connection => {
                            const angle = Math.atan2(
                                connection.to.y - connection.from.y,
                                connection.to.x - connection.from.x
                            );
                            const length = Math.sqrt(
                                Math.pow(connection.to.x - connection.from.x, 2) +
                                Math.pow(connection.to.y - connection.from.y, 2)
                            );
                            return (
                                <div
                                    key={connection.id}
                                    className="connection"
                                    style={{
                                        left: `${connection.from.x}px`,
                                        top: `${connection.from.y}px`,
                                        width: `${length}px`,
                                        transform: `rotate(${angle}rad)`,
                                        opacity: connection.opacity,
                                        animationDelay: `${connection.pulseDelay}s`
                                    }}
                                />
                            );
                        })}
                        
                        {nodes.map(node => (
                            <div
                                key={node.id}
                                className="node"
                                style={{
                                    left: `${node.x}px`,
                                    top: `${node.y}px`,
                                    width: `${node.size}px`,
                                    height: `${node.size}px`,
                                    backgroundColor: node.color,
                                    animationDelay: `${node.delay}s`
                                }}
                            >
                                <div
                                    className="node-pulse"
                                    style={{ animationDelay: `${node.pulseDelay}s` }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Features Section */}
            <div className="features-section">
                <div className="section-title">
                    <h2>Key Features</h2>
                </div>
                
                <div className="features">
                    <div className="feature-card animated-border">
                        <div className="feature-icon">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <h3>Real-time Detection</h3>
                        <p>Monitor and detect potential insider threats in real-time using LSTM Autoencoders and GCN</p>
                    </div>
                    
                    <div className="feature-card animated-border">
                        <div className="feature-icon">
                            <i className="fas fa-chart-line"></i>
                        </div>
                        <h3>Anomaly Analysis</h3>
                        <p>Sophisticated anomaly detection and insider network detection to identify unusual patterns and behaviors</p>
                    </div>
                    
                    <div className="feature-card animated-border">
                        <div className="feature-icon">
                            <i className="fas fa-user-shield"></i>
                        </div>
                        <h3>User Profiling</h3>
                        <p>Build comprehensive user profiles to establish normal behavior patterns</p>
                    </div>
                </div>
            </div>
            
            {/* How It Works Section */}
            <div className="how-it-works">
                <div className="section-title">
                    <h2>How It Works</h2>
                </div>
                
                <div className="steps">
                    <div className="step animated-border">
                        <div className="step-number">1</div>
                        <h4>Data Collection</h4>
                        <p>Upload user activity data through our secure interface</p>
                    </div>
                    
                    <div className="step animated-border">
                        <div className="step-number">2</div>
                        <h4>AI Analysis</h4>
                        <p>Our AI model processes and analyzes behavior patterns</p>
                    </div>
                    
                    <div className="step animated-border">
                        <div className="step-number">3</div>
                        <h4>Threat Detection</h4>
                        <p>Receive instant alerts on potential security threats</p>
                    </div>
                </div>
            </div>
            
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        </div>
    );
};

export default Landing;