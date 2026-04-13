import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Select, Space, Table, Typography, message } from "antd";
import { useAuth } from "./auth";
import { db } from "./firebase";
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
 
const { Title, Text } = Typography;
 
export default function Admin() {
  const authState = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
 
  const load = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      message.error(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    load();
  }, []);
 
  const columns = useMemo(() => {
    return [
      { title: "User ID", dataIndex: "userId", key: "userId", width: 160 },
      { title: "Email", dataIndex: "email", key: "email" },
      {
        title: "Role",
        dataIndex: "role",
        key: "role",
        width: 180,
        render: (value, record) => (
          <Select
            value={value || "client"}
            style={{ width: 160 }}
            options={[
              { label: "client", value: "client" },
              { label: "admin", value: "admin" },
            ]}
            onChange={async (nextRole) => {
              try {
                await updateDoc(doc(db, "users", record.id), { role: nextRole });
                setRows((prev) =>
                  prev.map((r) => (r.id === record.id ? { ...r, role: nextRole } : r)),
                );
                message.success("Role updated");
              } catch (e) {
                message.error(e?.message || "Failed to update role");
              }
            }}
            disabled={record.uid === authState.firebaseUser?.uid}
          />
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 160,
        render: (_, record) => (
          <Space>
            <Button
              danger
              onClick={async () => {
                try {
                  await deleteDoc(doc(db, "users", record.id));
                  setRows((prev) => prev.filter((r) => r.id !== record.id));
                  message.success("User profile deleted");
                } catch (e) {
                  message.error(e?.message || "Failed to delete");
                }
              }}
              disabled={record.uid === authState.firebaseUser?.uid}
            >
              Delete
            </Button>
          </Space>
        ),
      },
    ];
  }, [authState.firebaseUser?.uid]);
 
  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          Admin Panel
        </Title>
        <Text type="secondary">
          This manages user profiles in Firestore (role + metadata). Passwords are handled by Firebase Auth.
        </Text>
 
        <Card>
          <Space style={{ marginBottom: 12 }}>
            <Button onClick={load} loading={loading}>
              Refresh
            </Button>
          </Space>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>
    </div>
  );
}
