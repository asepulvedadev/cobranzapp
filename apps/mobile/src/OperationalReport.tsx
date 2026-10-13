import type { LoanApplication } from "@cobranzapp/contracts";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { MobileApi } from "./api";
import { MobileApiError } from "./api";

const frequencyLabels: Record<LoanApplication["paymentFrequency"], string> = {
  daily: "Diaria",
  weekly: "Semanal",
  fortnightly: "Quincenal",
  monthly: "Mensual",
};

export function OperationalReport({
  api,
  onNeedsReauthentication,
  tenantId,
}: {
  api: MobileApi;
  onNeedsReauthentication: () => void;
  tenantId: string;
}) {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setApplications(await api.loanApplications(tenantId));
      setMessage("");
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña para consultar los reportes.");
      } else {
        setMessage(
          error instanceof MobileApiError ? error.message : "No fue posible cargar los reportes.",
        );
      }
    }
  }, [api, onNeedsReauthentication, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = applications.filter((application) => application.status === "active");
  const overdue = active.filter((application) => (application.overdueInstallments ?? 0) > 0);
  const overdueInstallments = overdue.reduce(
    (total, application) => total + (application.overdueInstallments ?? 0),
    0,
  );
  const inReview = applications.filter((application) =>
    ["submitted", "under_review"].includes(application.status),
  );

  return (
    <View style={styles.stack}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>SEGUIMIENTO OPERATIVO</Text>
          <Text style={styles.title}>Reportes</Text>
        </View>
        <Text style={styles.muted}>{applications.length} registros</Text>
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <View style={styles.metricGrid}>
        <Metric label="Créditos activos" value={active.length} />
        <Metric label="Cuotas vencidas" value={overdueInstallments} />
        <Metric label="Clientes con atraso" value={overdue.length} />
        <Metric label="En revisión" value={inReview.length} accent />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Prioridad de cobro</Text>
        {overdue.length ? (
          overdue
            .sort(
              (left, right) => (right.overdueInstallments ?? 0) - (left.overdueInstallments ?? 0),
            )
            .slice(0, 20)
            .map((application) => (
              <View key={application.id} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{application.borrowerName}</Text>
                  <Text style={styles.muted}>
                    {frequencyLabels[application.paymentFrequency]} · próxima{" "}
                    {application.nextDueDate ?? "sin fecha"}
                  </Text>
                </View>
                <Text style={styles.overdue}>
                  {application.overdueInstallments ?? 0} vencida(s)
                </Text>
              </View>
            ))
        ) : (
          <Text style={styles.muted}>No hay cuotas vencidas.</Text>
        )}
        <Text style={styles.disclaimer}>Proyección operativa; no es un saldo contable.</Text>
      </View>
    </View>
  );
}

function Metric({ accent, label, value }: { accent?: boolean; label: string; value: number }) {
  return (
    <View style={[styles.metric, accent && styles.metricAccent]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = {
  stack: { gap: 12 },
  heading: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  eyebrow: { color: "#fbbf24", fontSize: 11, fontWeight: "800" as const, letterSpacing: 1.4 },
  title: { color: "#f4f2e9", fontSize: 26, fontWeight: "800" as const },
  muted: { color: "#9aa49c", fontSize: 12, lineHeight: 18 },
  error: { color: "#ff9f9f", fontSize: 13, lineHeight: 18 },
  metricGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  metric: {
    backgroundColor: "#20221f",
    borderColor: "#363a35",
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: "47%" as const,
    flexGrow: 1,
    gap: 2,
    minWidth: 130,
    padding: 12,
  },
  metricAccent: { backgroundColor: "#2a281c", borderColor: "#7b6220" },
  metricLabel: { color: "#a9b0aa", fontSize: 12 },
  metricValue: { color: "#f4f2e9", fontSize: 25, fontWeight: "800" as const },
  card: {
    backgroundColor: "#20221f",
    borderColor: "#363a35",
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  cardTitle: { color: "#f4f2e9", fontSize: 17, fontWeight: "800" as const },
  row: {
    alignItems: "center" as const,
    borderBottomColor: "#363a35",
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    gap: 8,
    paddingBottom: 10,
    paddingTop: 4,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: "#f4f2e9", fontSize: 14, fontWeight: "700" as const },
  overdue: { color: "#ffbf75", fontSize: 12, fontWeight: "800" as const },
  disclaimer: { color: "#77817a", fontSize: 11, lineHeight: 16 },
};
