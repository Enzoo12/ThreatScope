import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { 
  HomeOutlined, 
  DashboardOutlined, 
  ThunderboltOutlined,
  SafetyOutlined,
  LogoutOutlined,
  LoginOutlined,
  ToolOutlined
} from '@ant-design/icons';
import './Navbar.css';
import { useAuth } from '../auth';

const { Header } = Layout;

const Navbar = ({ hideLogo }) => {
  const location = useLocation();
  const authState = useAuth();
  
  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">Home</Link>,
    },
    ...(authState?.firebaseUser
      ? [
          {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: <Link to="/dashboard">Daily Detection</Link>,
          },
          {
            key: '/realtime',
            icon: <ThunderboltOutlined />,
            label: <Link to="/realtime">Real-time Detection</Link>,
          },
        ]
      : []),
    ...(authState?.isAdmin
      ? [
          {
            key: '/admin',
            icon: <ToolOutlined />,
            label: <Link to="/admin">Admin</Link>,
          },
        ]
      : []),
    {
      key: authState?.firebaseUser ? '/logout' : '/login',
      icon: authState?.firebaseUser ? <LogoutOutlined /> : <LoginOutlined />,
      label: authState?.firebaseUser ? (
        <span
          onClick={async () => {
            await authState.logout();
          }}
        >
          Logout
        </span>
      ) : (
        <Link to="/login">Login</Link>
      ),
    },
  ];

  return (
    <Header className="top-navbar">
      {!hideLogo && (
        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <SafetyOutlined className="logo-icon" />
          <span className="logo-text">ThreatScope</span>
        </Link>
      )}
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={menuItems}
        className="nav-menu"
      />
    </Header>
  );
};

export default Navbar;