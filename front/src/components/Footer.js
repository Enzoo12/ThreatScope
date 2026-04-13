import React from 'react';
import { Layout } from 'antd';
import { GithubOutlined, SafetyOutlined } from '@ant-design/icons';
import './Footer.css';

const { Footer: AntFooter } = Layout;

const Footer = () => {
  return (
    <AntFooter className="main-footer">
      <div className="footer-content">
        <div className="footer-left">
          <SafetyOutlined className="footer-logo-icon" />
          <span className="footer-logo-text">Insider Threat Detection</span>
        </div>
        <div className="footer-center">
          <p>© 2026 Insider Threat Detection System. All rights reserved.</p>
        </div>
        <div className="footer-right">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="footer-link">
            <GithubOutlined /> GitHub
          </a>
        </div>
      </div>
    </AntFooter>
  );
};

export default Footer;
