"use client";

import "../../page.css";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

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

export default function UsersManager({
  currentUserId,
  canManageUsers,
}: {
  currentUserId: string;
  canManageUsers: boolean;
}) {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
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
    setSuccess("");
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
    setSuccess("");
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
    if (!window.confirm(t("admin.deleteUserConfirm"))) {
      return;
    }

    setDeletingId(id);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      await parseJson<{ ok: boolean }>(res);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: unknown) {
      setError(String((e as Error).message || e));
    } finally {
      setDeletingId(null);
    }
  };

  const changeOwnPassword = async () => {
    const selfUser = users.find((user) => user.id === currentUserId);
    if (!selfUser) return;

    if (nextPassword !== confirmPassword) {
      setError(t("admin.passwordMismatch"));
      setSuccess("");
      return;
    }

    setChangingPassword(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/users/${currentUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: selfUser.email,
          name: selfUser.name || "",
          role: selfUser.role,
          currentPassword,
          password: nextPassword,
        }),
      });
      await parseJson<UserItem>(res);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setSuccess(t("admin.passwordUpdated"));
    } catch (e: unknown) {
      setError(String((e as Error).message || e));
    } finally {
      setChangingPassword(false);
    }
  };

  if (!canManageUsers) {
    const selfUser = users.find((user) => user.id === currentUserId) || null;

    return (
      <div className="admin-dashboard">
        <div className="admin-card">
          <h1 className="admin-title">{t("admin.myAccount")}</h1>
          <p className="admin-subtitle">{t("admin.changeOwnPasswordSubtitle")}</p>

          {loading && <div className="admin-chart-empty">{t("admin.loadingUsers")}</div>}
          {!loading && selfUser && (
            <div className="admin-account-form">
              <div className="admin-account-form__identity">
                <input
                  className="admin-input admin-account-form__readonly"
                  type="email"
                  value={selfUser.email}
                  disabled
                />
                <input
                  className="admin-input admin-account-form__readonly"
                  type="text"
                  value={selfUser.name || ""}
                  disabled
                />
              </div>
              <div className="admin-account-form__passwords">
                <input
                  className="admin-input"
                  type="password"
                  placeholder={t("admin.currentPassword")}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  className="admin-input"
                  type="password"
                  placeholder={t("admin.newPassword")}
                  value={nextPassword}
                  onChange={(e) => setNextPassword(e.target.value)}
                />
                <input
                  className="admin-input"
                  type="password"
                  placeholder={t("admin.confirmNewPassword")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="admin-reset-button admin-account-form__submit"
                  onClick={() => {
                    void changeOwnPassword();
                  }}
                  disabled={
                    changingPassword ||
                    !currentPassword.trim() ||
                    nextPassword.trim().length < 6 ||
                    confirmPassword.trim().length < 6
                  }
                >
                  {changingPassword ? t("admin.savingPassword") : t("admin.changePassword")}
                </button>
              </div>
            </div>
          )}

          {error && <div className="page__error">{error}</div>}
          {success && <div className="page__success">{success}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-card">
        <h1 className="admin-title">{t("admin.userManagement")}</h1>
        <p className="admin-subtitle">
          {t("admin.userManagementSubtitle")}
        </p>

        <div className="admin-users-form">
          <input
            className="admin-input"
            type="email"
            placeholder={t("admin.email")}
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
          />
          <input
            className="admin-input"
            type="text"
            placeholder={t("admin.name")}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <select
            className="admin-input"
            value={createRole}
            onChange={(e) => setCreateRole(e.target.value as "ADMIN" | "USER")}
          >
            <option value="USER">{t("admin.roleUser")}</option>
            <option value="ADMIN">{t("admin.roleAdmin")}</option>
          </select>
          <input
            className="admin-input"
            type="password"
            placeholder={t("admin.passwordMin")}
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
          />
          <button
            type="button"
            className="admin-reset-button"
            onClick={() => {
              void createUser();
            }}
            disabled={creating || !createEmail.trim() || createPassword.trim().length < 6}
          >
            {creating ? t("admin.creatingUser") : t("admin.createUser")}
          </button>
        </div>

        {error && <div className="page__error">{error}</div>}
        {success && <div className="page__success">{success}</div>}
      </div>

      <div className="admin-panel">
        <div className="admin-chart-title">{t("admin.users")}</div>
        {loading && <div className="admin-chart-empty">{t("admin.loadingUsers")}</div>}
        {!loading && users.length === 0 && (
          <div className="admin-chart-empty">{t("admin.noUsersYet")}</div>
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
                    onChange={(e) => setEditRole(e.target.value as "ADMIN" | "USER")}
                  >
                    <option value="USER">{t("admin.roleUser")}</option>
                    <option value="ADMIN">{t("admin.roleAdmin")}</option>
                  </select>
                  <input
                    className="admin-input"
                    type="password"
                    placeholder={t("admin.newPasswordOptional")}
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
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="admin-reset-button"
                      onClick={cancelEdit}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>{user.email}</div>
                  <div>{user.name || "-"}</div>
                  <div>{user.role === "ADMIN" ? t("admin.roleAdmin") : t("admin.roleUser")}</div>
                  <div>{new Date(user.createdAt).toLocaleDateString()}</div>
                  <div className="admin-manual-actions">
                    <button
                      type="button"
                      className="admin-reset-button"
                      onClick={() => startEdit(user)}
                      disabled={!canManageUsers}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="admin-reset-button"
                      onClick={() => {
                        void deleteUser(user.id);
                      }}
                      disabled={
                        !canManageUsers ||
                        user.id === currentUserId ||
                        deletingId === user.id
                      }
                    >
                      {deletingId === user.id
                        ? t("admin.deletingUser")
                        : t("common.delete")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
