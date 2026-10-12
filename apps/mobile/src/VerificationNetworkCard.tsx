import type {
  VerificationNetworkPurpose,
  VerificationNetworkQueryResponse,
} from "@cobranzapp/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { type MobileApi, MobileApiError } from "./api";

const purposeLabels: Record<VerificationNetworkPurpose, string> = {
  credit_evaluation: "Evaluación de crédito",
  portfolio_management: "Gestión de cartera",
  customer_request: "Solicitud de la persona",
};

const resultLabels: Record<VerificationNetworkQueryResponse["result"], string> = {
  not_found: "Sin registro compartido",
  no_observation: "Sin observaciones activas",
  reported: "Observaciones activas",
  disputed: "Observación en disputa",
  no_consent: "Consentimiento no válido",
};

const categoryLabels = {
  late_payment: "Pago tardío",
  payment_default: "Incumplimiento",
} as const;

type VerificationNetworkCardProps = {
  api: MobileApi;
  tenantId: string;
  canPublish: boolean;
  onNeedsReauthentication: () => void;
};

function futureIsoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function VerificationNetworkCard({
  api,
  tenantId,
  canPublish,
  onNeedsReauthentication,
}: VerificationNetworkCardProps) {
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [purpose, setPurpose] = useState<VerificationNetworkPurpose>("credit_evaluation");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<VerificationNetworkQueryResponse | null>(null);
  const [correctionMessage, setCorrectionMessage] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function handleError(error: unknown, fallback: string) {
    if (error instanceof MobileApiError && error.status === 428) {
      onNeedsReauthentication();
      setMessage("Confirma tu contraseña actual para continuar.");
      return;
    }
    setMessage(error instanceof MobileApiError ? error.message : fallback);
  }

  async function registerConsent() {
    if (!documentNumber.trim() || !evidenceRef.trim()) {
      setMessage("Indica el documento y la evidencia del consentimiento.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const consent = await api.createVerificationConsent(tenantId, {
        country: "CO",
        documentType: documentType.trim().toUpperCase(),
        documentNumber: documentNumber.trim(),
        purpose,
        policyVersion: "verification-network-v1",
        evidenceRef: evidenceRef.trim(),
        expiresAt: futureIsoDate(30),
      });
      setToken(consent.consentToken);
      setMessage("Consentimiento registrado. Comparte el token solo con la persona titular.");
    } catch (error) {
      handleError(error, "No fue posible registrar el consentimiento.");
    } finally {
      setBusy(false);
    }
  }

  async function queryNetwork() {
    if (!documentNumber.trim() || !token.trim()) {
      setMessage("Indica el documento y el token de consentimiento vigente.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      setResult(
        await api.queryVerificationNetwork(tenantId, {
          country: "CO",
          documentType: documentType.trim().toUpperCase(),
          documentNumber: documentNumber.trim(),
          consentToken: token.trim(),
          purpose,
        }),
      );
      setMessage("Consulta registrada. Solo se muestran datos mínimos y explicables.");
    } catch (error) {
      handleError(error, "No fue posible consultar la red compartida.");
    } finally {
      setBusy(false);
    }
  }

  async function requestCorrection() {
    if (!documentNumber.trim() || !token.trim() || correctionMessage.trim().length < 10) {
      setMessage("Describe la corrección con al menos 10 caracteres.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.createVerificationCorrection(tenantId, {
        country: "CO",
        documentType: documentType.trim().toUpperCase(),
        documentNumber: documentNumber.trim(),
        consentToken: token.trim(),
        assertionId: null,
        message: correctionMessage.trim(),
      });
      setCorrectionMessage("");
      setMessage("Solicitud de corrección abierta para revisión.");
    } catch (error) {
      handleError(error, "No fue posible abrir la corrección.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>RED DE CONFIANZA</Text>
      <Text style={styles.title}>Verificación compartida</Text>
      <Text style={styles.help}>
        No es una lista negra. La persona autoriza cada uso y solo se comparte un estado mínimo,
        explicable, con vencimiento y opción de corrección.
      </Text>
      <Text style={styles.label}>Nombre que estás verificando</Text>
      <TextInput
        onChangeText={setFullName}
        placeholder="Solo para identificar esta consulta"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={fullName}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Tipo</Text>
          <TextInput
            autoCapitalize="characters"
            maxLength={4}
            onChangeText={setDocumentType}
            style={styles.input}
            value={documentType}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Número de cédula</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setDocumentNumber}
            style={styles.input}
            value={documentNumber}
          />
        </View>
      </View>
      <Text style={styles.label}>Propósito</Text>
      <View style={styles.choiceRow}>
        {(Object.keys(purposeLabels) as VerificationNetworkPurpose[]).map((value) => (
          <Pressable
            key={value}
            onPress={() => setPurpose(value)}
            style={[styles.choice, purpose === value && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, purpose === value && styles.choiceTextActive]}>
              {purposeLabels[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      {canPublish ? (
        <>
          <Text style={styles.label}>Evidencia del consentimiento</Text>
          <TextInput
            onChangeText={setEvidenceRef}
            placeholder="Ej. formulario firmado 2026-10-12"
            placeholderTextColor="#77817a"
            style={styles.input}
            value={evidenceRef}
          />
          <Pressable
            disabled={busy}
            onPress={() => void registerConsent()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>
              {busy ? "Guardando…" : "Registrar consentimiento"}
            </Text>
          </Pressable>
        </>
      ) : null}
      <Text style={styles.label}>Token entregado por la persona</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={setToken}
        placeholder="Token de consentimiento"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={token}
      />
      <Pressable disabled={busy} onPress={() => void queryNetwork()} style={styles.primaryButton}>
        <Text style={styles.primaryText}>{busy ? "Consultando…" : "Consultar red"}</Text>
      </Pressable>
      {token ? (
        <Text style={styles.tokenNote}>Token activo en esta sesión. No lo publiques.</Text>
      ) : null}
      {result ? (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>{resultLabels[result.result]}</Text>
          {fullName.trim() ? (
            <Text style={styles.help}>Persona consultada: {fullName.trim()}</Text>
          ) : null}
          <Text style={styles.help}>Observaciones activas: {result.activeObservations}</Text>
          {result.categories.length ? (
            <Text style={styles.help}>
              Categorías: {result.categories.map((category) => categoryLabels[category]).join(", ")}
            </Text>
          ) : null}
          {result.lastUpdatedAt ? (
            <Text style={styles.help}>
              Actualizado: {new Date(result.lastUpdatedAt).toLocaleDateString("es-CO")}
            </Text>
          ) : null}
          {result.correctionAvailable ? (
            <>
              <TextInput
                multiline
                onChangeText={setCorrectionMessage}
                placeholder="Describe una corrección"
                placeholderTextColor="#77817a"
                style={[styles.input, styles.textarea]}
                value={correctionMessage}
              />
              <Pressable
                disabled={busy}
                onPress={() => void requestCorrection()}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Solicitar corrección</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
      {message ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = {
  card: {
    gap: 9,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#202523",
    borderWidth: 1,
    borderColor: "#343b36",
  },
  eyebrow: { color: "#fbbf24", fontWeight: "800" as const, fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#eef2ee", fontWeight: "800" as const, fontSize: 18 },
  help: { color: "#99a39c", fontSize: 13, lineHeight: 19 },
  label: { color: "#dce2dd", fontSize: 13, fontWeight: "700" as const, marginTop: 4 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#414a44",
    backgroundColor: "#151817",
    color: "#f6f7f5",
    paddingHorizontal: 12,
    fontSize: 15,
  },
  row: { flexDirection: "row" as const, gap: 8 },
  half: { flex: 1 },
  choiceRow: { gap: 7 },
  choice: { borderRadius: 10, borderWidth: 1, borderColor: "#48514b", padding: 10 },
  choiceActive: { backgroundColor: "#3a3014", borderColor: "#fbbf24" },
  choiceText: { color: "#b9c1bb", fontSize: 13 },
  choiceTextActive: { color: "#fbbf24", fontWeight: "700" as const },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#fbbf24",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  primaryText: { color: "#151817", fontWeight: "800" as const, fontSize: 15 },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#48514b",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 12,
  },
  secondaryText: { color: "#f6f7f5", fontWeight: "700" as const, fontSize: 14 },
  tokenNote: { color: "#cde8d4", fontSize: 12, lineHeight: 18 },
  result: {
    gap: 4,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#1c2a22",
    borderWidth: 1,
    borderColor: "#31533c",
  },
  resultTitle: { color: "#eef2ee", fontWeight: "800" as const, fontSize: 16 },
  textarea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" as const },
  message: { color: "#ffbf75", fontSize: 14, lineHeight: 20 },
};
