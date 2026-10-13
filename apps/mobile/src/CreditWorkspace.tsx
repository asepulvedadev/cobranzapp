import type {
  Borrower,
  FinancialSchedulePreview,
  LoanApplication,
  LoanProduct,
} from "@cobranzapp/contracts";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { type MobileApi, MobileApiError } from "./api";

const frequencyLabels: Record<LoanProduct["paymentFrequency"], string> = {
  daily: "Diaria",
  weekly: "Semanal",
  fortnightly: "Quincenal",
  monthly: "Mensual",
};

const termOptions: Record<LoanProduct["paymentFrequency"], number[]> = {
  daily: [30, 35],
  weekly: [4, 5],
  fortnightly: [2],
  monthly: [1],
};

const statusLabels: Record<LoanApplication["status"], string> = {
  draft: "Borrador",
  submitted: "Enviada",
  under_review: "En revisión",
  approved: "Aprobada",
  active: "Activa",
  paid: "Pagada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

export function CreditWorkspace({
  api,
  borrowers,
  onNeedsReauthentication,
  tenantId,
}: {
  api: MobileApi;
  borrowers: Borrower[];
  onNeedsReauthentication: () => void;
  tenantId: string;
}) {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [borrowerId, setBorrowerId] = useState("");
  const [productId, setProductId] = useState("");
  const [frequency, setFrequency] = useState<LoanProduct["paymentFrequency"]>("daily");
  const [termCount, setTermCount] = useState(30);
  const [principal, setPrincipal] = useState("");
  const [renewalAmount, setRenewalAmount] = useState("");
  const [schedulePreview, setSchedulePreview] = useState<FinancialSchedulePreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [productsResult, applicationsResult] = await Promise.all([
        api.loanProducts(tenantId),
        api.loanApplications(tenantId),
      ]);
      setProducts(productsResult);
      setApplications(applicationsResult);
      setProductId(
        (current) => current || productsResult.find((item) => item.status !== "retired")?.id || "",
      );
      setBorrowerId((current) => current || borrowers[0]?.id || "");
    } catch (cause) {
      if (cause instanceof MobileApiError && cause.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña actual para consultar los créditos.");
      } else {
        setMessage(
          cause instanceof MobileApiError ? cause.message : "No fue posible cargar los créditos.",
        );
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api, borrowers, onNeedsReauthentication, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!borrowerId && borrowers[0]) setBorrowerId(borrowers[0].id);
  }, [borrowerId, borrowers]);

  function showError(cause: unknown, fallback: string) {
    if (cause instanceof MobileApiError && cause.status === 428) {
      onNeedsReauthentication();
      setMessage("Confirma tu contraseña actual para continuar.");
    } else {
      setMessage(cause instanceof MobileApiError ? cause.message : fallback);
    }
    setError(true);
  }

  async function createLoan() {
    if (!borrowerId || !productId || !principal.trim()) {
      setMessage("Selecciona cliente, producto y monto.");
      setError(true);
      return;
    }
    setBusyAction("create");
    setMessage("");
    setError(false);
    setSchedulePreview(null);
    try {
      await api.createLoanApplication(tenantId, {
        borrowerId,
        loanProductId: productId,
        requestedPrincipal: principal.trim(),
        paymentFrequency: frequency,
        requestedTermCount: termCount,
        purpose: null,
      });
      const preview = await api
        .previewLoanSchedule(tenantId, productId, {
          principal: principal.trim(),
          termCount,
          paymentFrequency: frequency,
          startDate: new Date().toISOString().slice(0, 10),
        })
        .catch(() => null);
      setSchedulePreview(preview);
      setPrincipal("");
      setMessage("Crédito creado y calendario calculado automáticamente.");
      await load();
    } catch (cause) {
      showError(cause, "No fue posible crear el crédito.");
    } finally {
      setBusyAction(null);
    }
  }

  async function recordPayment(application: LoanApplication) {
    setBusyAction(`payment:${application.id}`);
    setMessage("");
    setError(false);
    try {
      const updated = await api.recordLoanPayment(tenantId, application);
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(`Cuota ${updated.paidInstallments} registrada.`);
    } catch (cause) {
      showError(cause, "No fue posible registrar la cuota.");
    } finally {
      setBusyAction(null);
    }
  }

  async function renewLoan(application: LoanApplication) {
    if (!renewalAmount.trim()) {
      setMessage("Indica el excedente para renovar el crédito.");
      setError(true);
      return;
    }
    setBusyAction(`renew:${application.id}`);
    setMessage("");
    setError(false);
    try {
      const renewed = await api.renewLoan(tenantId, application.id, renewalAmount.trim());
      setApplications((current) => [
        renewed,
        ...current.filter((item) => item.id !== application.id),
      ]);
      setRenewalAmount("");
      setMessage("Crédito renovado y calendario reiniciado.");
    } catch (cause) {
      showError(cause, "No fue posible renovar el crédito.");
    } finally {
      setBusyAction(null);
    }
  }

  const activeBorrowers = borrowers.filter((borrower) => borrower.status === "active");
  const availableProducts = products.filter((product) => product.status !== "retired");

  return (
    <View style={styles.stack}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>NÚCLEO FINANCIERO</Text>
          <Text style={styles.title}>Créditos</Text>
        </View>
        <Text style={styles.muted}>{applications.length} registrados</Text>
      </View>
      <Text style={styles.help}>
        El propietario define monto e interés. El equipo elige frecuencia y plazo de un mes o cinco
        semanas.
      </Text>
      {loading ? <Text style={styles.muted}>Cargando créditos…</Text> : null}
      {!loading && (!activeBorrowers.length || !availableProducts.length) ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Necesitas al menos un cliente activo y un producto de crédito configurado por el
            propietario.
          </Text>
        </View>
      ) : null}
      {!loading && activeBorrowers.length && availableProducts.length ? (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Crear crédito</Text>
          <Text style={styles.label}>Cliente</Text>
          <View style={styles.choiceWrap}>
            {activeBorrowers.map((borrower) => (
              <Pressable
                key={borrower.id}
                onPress={() => setBorrowerId(borrower.id)}
                style={[styles.choice, borrowerId === borrower.id && styles.choiceActive]}
              >
                <Text style={styles.choiceText}>{borrower.fullName}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Producto</Text>
          <View style={styles.choiceWrap}>
            {availableProducts.map((product) => (
              <Pressable
                key={product.id}
                onPress={() => setProductId(product.id)}
                style={[styles.choice, productId === product.id && styles.choiceActive]}
              >
                <Text style={styles.choiceText}>
                  {product.name} · COP {product.principalMax}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Monto solicitado (COP)</Text>
          <TextInput
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setPrincipal}
            placeholder="100000"
            placeholderTextColor="#77817a"
            style={styles.input}
            value={principal}
          />
          <Text style={styles.label}>Frecuencia</Text>
          <View style={styles.choiceWrap}>
            {(Object.keys(frequencyLabels) as LoanProduct["paymentFrequency"][]).map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  setFrequency(value);
                  setTermCount(termOptions[value][0] ?? 1);
                }}
                style={[styles.choice, frequency === value && styles.choiceActive]}
              >
                <Text style={styles.choiceText}>{frequencyLabels[value]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Plazo</Text>
          <View style={styles.choiceWrap}>
            {termOptions[frequency].map((value) => (
              <Pressable
                key={value}
                onPress={() => setTermCount(value)}
                style={[styles.choice, termCount === value && styles.choiceActive]}
              >
                <Text style={styles.choiceText}>{value} cuotas</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={busyAction !== null}
            onPress={() => void createLoan()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>
              {busyAction === "create" ? "Creando…" : "Crear crédito"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {message ? <Text style={error ? styles.error : styles.success}>{message}</Text> : null}
      {schedulePreview ? (
        <View style={styles.scheduleCard}>
          <Text style={styles.scheduleTitle}>Calendario calculado</Text>
          <Text style={styles.muted}>
            Total a pagar: COP {schedulePreview.scheduledTotal} · Primera cuota: COP{" "}
            {schedulePreview.periods[0]?.installment ?? "—"}
          </Text>
        </View>
      ) : null}
      {applications.map((application) => (
        <View key={application.id} style={styles.loanCard}>
          <View style={styles.heading}>
            <View style={styles.copy}>
              <Text style={styles.loanTitle}>{application.borrowerName}</Text>
              <Text style={styles.muted}>
                {application.loanProductName} · COP {application.requestedPrincipal}
              </Text>
              <Text style={styles.muted}>
                {frequencyLabels[application.paymentFrequency]} · {application.paidInstallments}/
                {application.requestedTermCount} cuotas
              </Text>
            </View>
            <Text style={styles.status}>{statusLabels[application.status]}</Text>
          </View>
          {application.status === "active" ? (
            <>
              <Pressable
                disabled={busyAction !== null}
                onPress={() => void recordPayment(application)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>
                  {busyAction === `payment:${application.id}`
                    ? "Registrando…"
                    : `Registrar cuota ${application.paidInstallments + 1}`}
                </Text>
              </Pressable>
              {application.paidInstallments >= 2 ? (
                <View style={styles.renewRow}>
                  <TextInput
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={setRenewalAmount}
                    placeholder="Excedente COP"
                    placeholderTextColor="#77817a"
                    style={[styles.input, styles.renewInput]}
                    value={renewalAmount}
                  />
                  <Pressable
                    disabled={busyAction !== null}
                    onPress={() => void renewLoan(application)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryText}>
                      {busyAction === `renew:${application.id}` ? "Renovando…" : "Renovar"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = {
  stack: { gap: 12 },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  eyebrow: { color: "#fbbf24", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#f6f7f5", fontSize: 30, fontWeight: "800" },
  sectionTitle: { color: "#f6f7f5", fontSize: 18, fontWeight: "800" },
  loanTitle: { color: "#eef2ee", fontSize: 16, fontWeight: "800" },
  copy: { flex: 1, gap: 3 },
  help: { color: "#b9c2bc", fontSize: 14, lineHeight: 20 },
  muted: { color: "#99a39c", fontSize: 13, lineHeight: 19 },
  label: { color: "#dce2dd", fontSize: 13, fontWeight: "700", marginTop: 3 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#414a44",
    backgroundColor: "#151817",
    color: "#f6f7f5",
    paddingHorizontal: 12,
    fontSize: 16,
  },
  formCard: {
    backgroundColor: "#202523",
    borderColor: "#343b36",
    borderRadius: 18,
    borderWidth: 1,
    gap: 9,
    padding: 16,
  },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderColor: "#414a44",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  choiceActive: { backgroundColor: "#2c2b20", borderColor: "#fbbf24" },
  choiceText: { color: "#eef2ee", fontSize: 13, fontWeight: "700" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#fbbf24",
    borderRadius: 12,
    padding: 13,
  },
  primaryText: { color: "#151817", fontSize: 15, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#48514b",
    borderRadius: 10,
    borderWidth: 1,
    padding: 11,
  },
  secondaryText: { color: "#f6f7f5", fontSize: 13, fontWeight: "800" },
  loanCard: {
    backgroundColor: "#202523",
    borderColor: "#343b36",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  status: { color: "#fbbf24", fontSize: 12, fontWeight: "800" },
  renewRow: { flexDirection: "row", gap: 8 },
  renewInput: { flex: 1 },
  notice: {
    backgroundColor: "#3a2f13",
    borderColor: "#775f20",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  noticeText: { color: "#f6d782", fontSize: 13, lineHeight: 19 },
  scheduleCard: {
    backgroundColor: "#153323",
    borderColor: "#2e7049",
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  scheduleTitle: { color: "#9fe3b0", fontSize: 14, fontWeight: "800" },
  error: { color: "#ff9d93", fontSize: 14, lineHeight: 20 },
  success: { color: "#9fe3b0", fontSize: 14, lineHeight: 20 },
} as const;
