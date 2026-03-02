"use client";

import "../../page.css";
import { useEffect, useState } from "react";
import Link from "next/link";

type UserItem = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  createdAt: string;
  updatedAt: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.error || `Request failed (${response.status})`);
  }
  return json as T;
}

export default function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<"ADMIN" | "USER">("USER");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "USER">("USER");
  const [editPassword, setEditPassword] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await parseJson<{ users: UserItem[] }>(res);
      setUsers(data.users);
    } catch (e: unknown) {
      setError(String((e as Error).message || e));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const createUser = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail,
          name: createName,
          role: createRole,
          password: createPassword,
        }),
      });
      const created = await parseJson<UserItem>(res);
      setUsers((prev) => [created, ...prev]);
      setCreateEmail("");
      setCreateName("");
      setCreateRole("USER");
      setCreatePassword("");
    } catch (e: unknown) {
      setError(String((e as Error).message || e));
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (user: UserItem) => {
    setEditingId(user.id);
    setEditEmail(user.email);
    setEditName(user.name || "");
    setEditRole(user.role);
    setEditPassword("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditEmail("");
    setEditName("");
    setEditRole("USER");
    setEditPassword("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingId(editingId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editEmail,
          name: editName,
          role: editRole,
          password: editPassword,
        }),
      });
      const updated = await parseJson<UserItem>(res);
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      cancelEdit();
    } catch (e: unknown) {
      setError(String((e as Error).message || e));
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      await parseJson<{ ok: boolean }>(res);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: unknown) {
      setError(String((e as Error).message || e));
    }
  };

  return (
    <div className="page">
      <div className="page__layout page__layout--full">
        <section className="page__content">
          <div className="page__content-actions page__content-actions--gap">
            <Link href="/" className="page__action-link">
              Back to home
            </Link>
            <Link href="/admin" className="page__action-link">
              Back to admin
            </Link>
          </div>

          <div className="admin-dashboard">
            <div className="admin-card">
              <h1 className="admin-title">User Management</h1>
              <p className="admin-subtitle">
                Create and manage application users and roles.
              </p>

              <div className="admin-users-form">
                <input
                  className="admin-input"
                  type="email"
                  placeholder="Email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
                <input
                  className="admin-input"
                  type="text"
                  placeholder="Name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
                <select
                  className="admin-input"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as "ADMIN" | "USER")}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <input
                  className="admin-input"
                  type="password"
                  placeholder="Password (min 6)"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                />
                <button
                  type="button"
                  className="admin-reset-button"
                  onClick={() => {
                    void createUser();
                  }}
                  disabled={
                    creating ||
                    !createEmail.trim() ||
                    createPassword.trim().length < 6
                  }
                >
                  {creating ? "Creating..." : "Create user"}
                </button>
              </div>

              {error && <div className="page__error">{error}</div>}
            </div>

            <div className="admin-panel">
              <div className="admin-chart-title">Users</div>
              {loading && <div className="admin-chart-empty">Loading users...</div>}
              {!loading && users.length === 0 && (
                <div className="admin-chart-empty">No users yet.</div>
              )}

              {!loading &&
                users.map((user) => (
                  <div key={user.id} className="admin-users-row">
                    {editingId === user.id ? (
                      <>
                        <input
                          className="admin-input"
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                        <input
                          className="admin-input"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <select
                          className="admin-input"
                          value={editRole}
                          onChange={(e) =>
                            setEditRole(e.target.value as "ADMIN" | "USER")
                          }
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <input
                          className="admin-input"
                          type="password"
                          placeholder="New password (optional)"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                        />
                        <div className="admin-manual-actions">
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() => {
                              void saveEdit();
                            }}
                            disabled={savingId === user.id || !editEmail.trim()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>{user.email}</div>
                        <div>{user.name || "-"}</div>
                        <div>{user.role}</div>
                        <div>{new Date(user.createdAt).toLocaleDateString()}</div>
                        <div className="admin-manual-actions">
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() => startEdit(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-reset-button"
                            onClick={() => {
                              void deleteUser(user.id);
                            }}
                            disabled={user.id === currentUserId}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
