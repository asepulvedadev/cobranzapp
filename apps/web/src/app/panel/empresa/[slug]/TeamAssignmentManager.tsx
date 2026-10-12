"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { TenantOverview } from "../../../../lib/platform";
import { useSensitiveFetch } from "../../ReauthenticationProvider";
import { OrganizationStatusButton } from "./OrganizationStatusButton";

type Member = TenantOverview["members"][number];
type Team = TenantOverview["teams"][number];

async function responseMessage(response: Response | null) {
  const body = (await response?.json().catch(() => ({}))) as
    | { error?: { message?: string } }
    | undefined;
  return body?.error?.message ?? "No fue posible actualizar el equipo.";
}

export function TeamAssignmentManager({
  members,
  teams: initialTeams,
  tenantId,
}: {
  members: Member[];
  teams: Team[];
  tenantId: string;
}) {
  const sensitiveFetch = useSensitiveFetch();
  const [teams, setTeams] = useState(initialTeams);
  const activeTeams = teams.filter((team) => team.status === "active");
  const [teamId, setTeamId] = useState(
    initialTeams.find((team) => team.status === "active")?.id ?? "",
  );
  const [userId, setUserId] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const selectedTeam = teams.find((team) => team.id === teamId);
  const availableMembers = members.filter(
    (member) =>
      member.status === "active" &&
      (member.role === "supervisor" || member.role === "collector") &&
      !selectedTeam?.memberIds.includes(member.userId),
  );

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamId || !userId) return;
    setPending("assign");
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/teams/${teamId}/members/${userId}`,
      { method: "PUT" },
    );
    if (!response?.ok) {
      setMessage(await responseMessage(response));
      setIsError(true);
      setPending(null);
      return;
    }
    setTeams((current) =>
      current.map((team) =>
        team.id === teamId && !team.memberIds.includes(userId)
          ? { ...team, memberIds: [...team.memberIds, userId] }
          : team,
      ),
    );
    setUserId("");
    setMessage("Integrante asignado al equipo.");
    setPending(null);
  }

  async function remove(team: Team, member: Member) {
    if (!window.confirm(`¿Retirar a ${member.displayName} de ${team.displayName}?`)) return;
    const operationId = `${team.id}:${member.userId}`;
    setPending(operationId);
    setMessage("");
    setIsError(false);
    const response = await sensitiveFetch(
      `/api/v1/tenants/${tenantId}/teams/${team.id}/members/${member.userId}`,
      { method: "DELETE" },
    );
    if (!response?.ok) {
      setMessage(await responseMessage(response));
      setIsError(true);
      setPending(null);
      return;
    }
    setTeams((current) =>
      current.map((item) =>
        item.id === team.id
          ? { ...item, memberIds: item.memberIds.filter((id) => id !== member.userId) }
          : item,
      ),
    );
    setMessage("Integrante retirado del equipo.");
    setPending(null);
  }

  if (!teams.length) return <p className="structure-empty">Aún no hay equipos registrados.</p>;

  return (
    <div className="team-assignment-manager">
      <div className="structure-list">
        {teams.map((team) => {
          const assignedMembers = team.memberIds
            .map((id) => membersById.get(id))
            .filter((member): member is Member => Boolean(member));
          return (
            <article className="structure-item team-item" key={team.id}>
              <div className="team-item-heading">
                <span>
                  <strong>{team.displayName}</strong>
                  <small>{team.branchName ?? "Sin sede asignada"}</small>
                </span>
                <div className="organization-status-actions">
                  <span className={`status status-${team.status}`}>
                    {team.status === "active" ? "Activo" : "Inactivo"}
                  </span>
                  <OrganizationStatusButton
                    kind="team"
                    name={team.displayName}
                    resourceId={team.id}
                    status={team.status}
                    tenantId={tenantId}
                  />
                </div>
              </div>
              {assignedMembers.length ? (
                <ul className="team-member-list" aria-label={`Integrantes de ${team.displayName}`}>
                  {assignedMembers.map((member) => {
                    const operationId = `${team.id}:${member.userId}`;
                    return (
                      <li key={member.userId}>
                        <span>
                          <strong>{member.displayName}</strong>
                          <small>{member.role === "supervisor" ? "Supervisor" : "Cobrador"}</small>
                        </span>
                        <button
                          disabled={pending !== null}
                          onClick={() => remove(team, member)}
                          type="button"
                        >
                          {pending === operationId ? "Retirando…" : "Retirar"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <small className="team-empty">Sin integrantes asignados.</small>
              )}
            </article>
          );
        })}
      </div>

      {activeTeams.length ? (
        <form className="team-assignment-form" onSubmit={assign}>
          <strong>Asignar integrante</strong>
          <label htmlFor="assignment-team">Equipo</label>
          <select
            id="assignment-team"
            onChange={(event) => {
              setTeamId(event.target.value);
              setUserId("");
            }}
            required
            value={teamId}
          >
            {activeTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.displayName}
              </option>
            ))}
          </select>
          <label htmlFor="assignment-member">Integrante</label>
          <select
            id="assignment-member"
            onChange={(event) => setUserId(event.target.value)}
            required
            value={userId}
          >
            <option value="">Selecciona una persona</option>
            {availableMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName} · {member.role === "supervisor" ? "Supervisor" : "Cobrador"}
              </option>
            ))}
          </select>
          <button disabled={pending !== null || !availableMembers.length} type="submit">
            {pending === "assign" ? "Asignando…" : "Asignar al equipo"}
          </button>
          {!availableMembers.length ? (
            <small>Todos los supervisores y cobradores activos ya están en este equipo.</small>
          ) : null}
          {message ? (
            <p
              className={isError ? "tenant-form-message form-message-error" : "tenant-form-message"}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="structure-empty">Activa un equipo antes de asignar integrantes.</p>
      )}
    </div>
  );
}
