import type { BorrowerOcrExtraction } from "@cobranzapp/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { MobileApi } from "./api";
import { MobileApiError } from "./api";

type BorrowerOcrControlProps = {
  api: MobileApi;
  borrowerId: string;
  onNeedsReauthentication: () => void;
  tenantId: string;
};

function statusLabel(status: BorrowerOcrExtraction["status"]) {
  return {
    pending: "En cola",
    processing: "Procesando",
    ready: "Listo para confirmar",
    confirmed: "Confirmado",
    rejected: "Rechazado",
    failed: "No se pudo leer",
  }[status];
}

function sideLabel(side: BorrowerOcrExtraction["side"]) {
  return side === "front" ? "Frente" : side === "back" ? "Reverso" : "Documento";
}

export function BorrowerOcrControl({
  api,
  borrowerId,
  onNeedsReauthentication,
  tenantId,
}: BorrowerOcrControlProps) {
  const [open, setOpen] = useState(false);
  const [extractions, setExtractions] = useState<BorrowerOcrExtraction[] | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { documentNumber: string; fullName: string }>
  >({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function handleError(error: unknown, fallback: string) {
    if (error instanceof MobileApiError && error.status === 428) {
      onNeedsReauthentication();
      setMessage("Confirma tu contraseña actual para continuar.");
      return;
    }
    setMessage(error instanceof MobileApiError ? error.message : fallback);
  }

  async function load() {
    setOpen(true);
    setBusy(true);
    setMessage("");
    try {
      const result = await api.borrowerOcr(tenantId, borrowerId);
      setExtractions(result.extractions);
      setDrafts((current) => {
        const next = { ...current };
        for (const extraction of result.extractions) {
          if (!extraction.fields) continue;
          next[extraction.id] = {
            fullName: extraction.fields.fullName ?? "",
            documentNumber: extraction.fields.documentNumber ?? "",
          };
        }
        return next;
      });
    } catch (error) {
      handleError(error, "No fue posible consultar el resultado del OCR.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(extraction: BorrowerOcrExtraction) {
    const draft = drafts[extraction.id] ?? { fullName: "", documentNumber: "" };
    if (!draft.fullName.trim() && !draft.documentNumber.trim()) {
      setMessage("Confirma al menos el nombre o el número extraído.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.confirmBorrowerOcr(tenantId, borrowerId, extraction.id, {
        fullName: draft.fullName.trim() || null,
        documentNumber: draft.documentNumber.trim() || null,
      });
      setMessage("Datos OCR confirmados en el expediente.");
      const refreshed = await api.borrowerOcr(tenantId, borrowerId);
      setExtractions(refreshed.extractions);
    } catch (error) {
      handleError(error, "No fue posible confirmar los datos del OCR.");
    } finally {
      setBusy(false);
    }
  }

  async function retry(extraction: BorrowerOcrExtraction) {
    setBusy(true);
    setMessage("");
    try {
      const queued = await api.retryBorrowerOcr(tenantId, borrowerId, extraction.id);
      setExtractions(
        (current) => current?.map((item) => (item.id === queued.id ? queued : item)) ?? current,
      );
      setMessage("El documento volvió a la cola de OCR.");
    } catch (error) {
      handleError(error, "No fue posible volver a procesar el documento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable disabled={busy} onPress={() => void load()} style={styles.trigger}>
        <Text style={styles.triggerText}>
          {busy ? "Consultando OCR…" : open ? "Actualizar OCR" : "Consultar OCR"}
        </Text>
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {open && extractions?.length ? (
        <View style={styles.list}>
          {extractions.map((extraction) => {
            const draft = drafts[extraction.id] ?? { fullName: "", documentNumber: "" };
            return (
              <View key={extraction.id} style={styles.item}>
                <Text style={styles.itemTitle}>
                  {sideLabel(extraction.side)} · {statusLabel(extraction.status)}
                </Text>
                {extraction.fields ? (
                  <>
                    <TextInput
                      editable={!busy}
                      onChangeText={(fullName) =>
                        setDrafts((current) => ({
                          ...current,
                          [extraction.id]: { ...draft, fullName },
                        }))
                      }
                      placeholder="Nombre sugerido"
                      placeholderTextColor="#77817a"
                      style={styles.input}
                      value={draft.fullName}
                    />
                    <TextInput
                      editable={!busy}
                      keyboardType="number-pad"
                      onChangeText={(documentNumber) =>
                        setDrafts((current) => ({
                          ...current,
                          [extraction.id]: { ...draft, documentNumber },
                        }))
                      }
                      placeholder="Número sugerido"
                      placeholderTextColor="#77817a"
                      style={styles.input}
                      value={draft.documentNumber}
                    />
                    <Text style={styles.confidence}>
                      Confianza:{" "}
                      {extraction.confidence === null
                        ? "sin dato"
                        : `${Math.round(extraction.confidence * 100)}%`}
                    </Text>
                    {extraction.status === "ready" ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => void confirm(extraction)}
                        style={styles.confirm}
                      >
                        <Text style={styles.confirmText}>Confirmar datos</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.confidence}>
                    {extraction.errorCode ?? "Aún no hay datos extraídos."}
                  </Text>
                )}
                {extraction.status === "failed" || extraction.status === "rejected" ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => void retry(extraction)}
                    style={styles.retry}
                  >
                    <Text style={styles.retryText}>Reintentar lectura</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : open ? (
        <Text style={styles.confidence}>Aún no hay resultados del OCR.</Text>
      ) : null}
    </View>
  );
}

const styles = {
  container: { gap: 6, marginTop: 4 },
  trigger: { alignSelf: "flex-start" as const, paddingVertical: 4 },
  triggerText: { color: "#fbbf24", fontSize: 12, fontWeight: "800" as const },
  message: { color: "#ffbf75", fontSize: 12, lineHeight: 17 },
  list: { gap: 6 },
  item: {
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#151817",
    borderWidth: 1,
    borderColor: "#414a44",
  },
  itemTitle: { color: "#dce2dd", fontSize: 12, fontWeight: "800" as const },
  input: {
    minHeight: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#414a44",
    backgroundColor: "#202523",
    color: "#f6f7f5",
    paddingHorizontal: 9,
    fontSize: 13,
  },
  confidence: { color: "#99a39c", fontSize: 12, lineHeight: 17 },
  confirm: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "#fbbf24",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  confirmText: { color: "#151817", fontSize: 13, fontWeight: "800" as const },
  retry: { alignSelf: "flex-start" as const, paddingVertical: 4 },
  retryText: { color: "#fbbf24", fontSize: 12, fontWeight: "800" as const },
};
