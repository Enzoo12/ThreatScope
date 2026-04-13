import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Segmented, Space, Typography } from "antd";
import { useAuth } from "./auth";
 
const { Title, Text } = Typography;
 
export default function Login() {
  const authState = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
 
  const from = useMemo(() => {
    const stateFrom = location.state?.from?.pathname;
    return typeof stateFrom === "string" ? stateFrom : null;
  }, [location.state]);
 
  const onFinish = async (values) => {
    setError("");
    setSubmitting(true);
    try {
      const email = String(values.email || "").trim();
      const password = String(values.password || "");
      if (mode === "login") {
        await authState.login(email, password);
      } else {
        await authState.register(email, password);
      }
      navigate(from || "/dashboard", { replace: true });
    } catch (e) {
      setError(e?.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };
 
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            Sign in
          </Title>
          <Text type="secondary">
            Use your email/password. New users can register as clients and an admin can upgrade roles later.
          </Text>
 
          {!authState?.firebaseEnabled && (
            <Alert
              type="warning"
              message="Firebase isn’t configured"
              description="Set REACT_APP_FIREBASE_* env vars and restart the frontend."
              showIcon
            />
          )}
 
          <Segmented
            block
            value={mode}
            options={[
              { label: "Login", value: "login" },
              { label: "Register", value: "register" },
            ]}
            onChange={setMode}
          />
 
          {error && <Alert type="error" message={error} showIcon />}
 
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "Enter your email" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
 
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: "Enter your password" }]}
            >
              <Input.Password placeholder="Password" autoComplete="current-password" />
            </Form.Item>
 
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              disabled={!authState?.firebaseEnabled}
            >
              {mode === "login" ? "Login" : "Register"}
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
