import type { SharedClientVerification } from "@cobranzapp/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { type MobileApi, MobileApiError } from "./api";

const ratingLabels: Record<SharedClientVerification["payerRating"], string> = {
  good: "Buen pagador",
  regular: "Pago regular",
  low: "Bajo",
  no_data: "Sin datos suficientes",
};

type VerificationNetworkCardProps = {
  api: MobileApi;
  tenantId: string;
  onNeedsReauthentication: () => void;
};

export function VerificationNetworkCard({
  api,
  tenantId,
  onNeedsReauthentication,
}: VerificationNetworkCardProps) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [result, setResult] = useState<SharedClientVerification | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  async function submit() {
    const normalized = documentNumber.trim();
    if (normalized.length < 4) {
      setMessage("Ingresa un número de cédula válido.");
      return;
    }
    if (!consentConfirmed) {
      setMessage("Confirma que el cliente autorizó esta consulta antes de continuar.");
      return;
    }
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      setResult(await api.verifyClient(tenantId, normalized, consentConfirmed));
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña actual para continuar.");
      } else {
        setMessage(
          error instanceof MobileApiError ? error.message : "No fue posible verificar el cliente.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>VERIFICACIÓN</Text>
      <Text style={styles.title}>Consultar cliente</Text>
      <Text style={styles.help}>
        Busca por cédula y muestra solo nombre, créditos vigentes, calificación y reporte negativo.
      </Text>
      <Text style={styles.label}>Número de cédula</Text>
      <TextInput
        autoComplete="off"
        keyboardType="number-pad"
        onChangeText={setDocumentNumber}
        placeholder="Ej. 1020304050"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={documentNumber}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consentConfirmed }}
        onPress={() => setConsentConfirmed((current) => !current)}
        style={styles.consentRow}
      >
        <Text style={styles.consentMark}>{consentConfirmed ? "☑" : "☐"}</Text>
        <Text style={styles.help}>El cliente autorizó esta consulta compartida.</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => void submit()} style={styles.primaryButton}>
        <Text style={styles.primaryText}>{busy ? "Consultando…" : "Verificar"}</Text>
      </Pressable>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {result ? (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>
            {result.registered ? "Cliente registrado" : "No está registrado"}
          </Text>
          {result.registered ? (
            <>
              <Text style={styles.help}>Nombre: {result.fullName ?? "No disponible"}</Text>
              <Text style={styles.help}>Créditos vigentes: {result.activeCreditCount}</Text>
              <Text style={styles.help}>Calificación: {ratingLabels[result.payerRating]}</Text>
              <Text style={styles.help}>
                Reporte negativo: {result.negativeReport ? "Sí" : "No"}
              </Text>
            </>
          ) : (
            <Text style={styles.help}>No encontramos esa cédula en la base compartida.</Text>
          )}
          <Text style={styles.disclaimer}>
            No mostramos teléfonos, direcciones, documentos ni la empresa que registró la
            información.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  card: {
    backgroundColor: "#1d2220",
    borderColor: "#343d38",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  eyebrow: { color: "#fbbf24", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#f6f7f5", fontSize: 22, fontWeight: "800" },
  help: { color: "#b9c2bc", fontSize: 14, lineHeight: 20 },
  label: { color: "#f6f7f5", fontSize: 13, fontWeight: "700", marginTop: 4 },
  input: {
    backgroundColor: "#151817",
    borderColor: "#4a554e",
    borderRadius: 10,
    borderWidth: 1,
    color: "#f6f7f5",
    fontSize: 16,
    padding: 12,
  },
  consentRow: { alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 4 },
  consentMark: { color: "#fbbf24", fontSize: 20 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#fbbf24",
    borderRadius: 10,
    padding: 13,
  },
  primaryText: { color: "#151817", fontSize: 15, fontWeight: "800" },
  error: { color: "#ff9b9b", fontSize: 13 },
  result: { borderColor: "#4a554e", borderRadius: 12, borderWidth: 1, gap: 6, padding: 12 },
  resultTitle: { color: "#f6f7f5", fontSize: 17, fontWeight: "800" },
  disclaimer: { color: "#8e9a92", fontSize: 12, lineHeight: 17 },
} as const;
