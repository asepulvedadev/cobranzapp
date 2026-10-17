import type { BorrowerCollectionReportReason } from "@cobranzapp/contracts";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { MobileApi } from "./api";

const reasons: Array<{ value: BorrowerCollectionReportReason; label: string }> = [
  { value: "payment_postponed", label: "Aplazó el pago" },
  { value: "refuses_payment", label: "No quiere pagar" },
  { value: "unreachable", label: "No se logra localizar" },
];

export function BorrowerCollectionReportControl({
  api,
  borrowerId,
  tenantId,
}: {
  api: MobileApi;
  borrowerId: string;
  tenantId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<BorrowerCollectionReportReason>("payment_postponed");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      await api.reportBorrowerCollection(tenantId, borrowerId, {
        reason,
        followUpDate: reason === "payment_postponed" ? followUpDate || null : null,
        notes: notes.trim() || null,
      });
      setMessage("Gestión registrada.");
      setOpen(false);
      setFollowUpDate("");
      setNotes("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible guardar el reporte.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>Reportar gestión</Text>
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Modal animationType="slide" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Reportar gestión</Text>
            <Text style={styles.label}>Resultado</Text>
            <View style={styles.reasonList}>
              {reasons.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => setReason(option.value)}
                  style={[styles.reason, reason === option.value && styles.reasonActive]}
                >
                  <Text style={styles.reasonText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {reason === "payment_postponed" ? (
              <>
                <Text style={styles.label}>Nueva fecha (AAAA-MM-DD)</Text>
                <TextInput
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  onChangeText={setFollowUpDate}
                  placeholder="2026-10-20"
                  style={styles.input}
                  value={followUpDate}
                />
              </>
            ) : null}
            <Text style={styles.label}>Nota (opcional)</Text>
            <TextInput
              maxLength={500}
              multiline
              onChangeText={setNotes}
              placeholder="Describe brevemente lo ocurrido."
              style={[styles.input, styles.notes]}
              value={notes}
            />
            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={() => setOpen(false)} style={styles.cancel}>
                <Text>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={busy || (reason === "payment_postponed" && !followUpDate)}
                onPress={() => void submit()}
                style={styles.save}
              >
                <Text style={styles.saveText}>{busy ? "Guardando…" : "Guardar"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5ce",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  triggerText: { color: "#1c2921", fontWeight: "800" },
  message: { color: "#176b43", fontWeight: "700" },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  card: { gap: 12, padding: 20, paddingBottom: 32, borderRadius: 22, backgroundColor: "#fff" },
  title: { color: "#17251c", fontSize: 20, fontWeight: "900" },
  label: { color: "#425048", fontSize: 12, fontWeight: "800" },
  reasonList: { gap: 8 },
  reason: {
    minHeight: 44,
    justifyContent: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f3f6f4",
  },
  reasonActive: { borderWidth: 2, borderColor: "#184d32", backgroundColor: "#eaf3ed" },
  reasonText: { color: "#17251c", fontWeight: "700" },
  input: {
    minHeight: 46,
    padding: 12,
    borderWidth: 1,
    borderColor: "#cbd5ce",
    borderRadius: 10,
    color: "#17251c",
  },
  notes: { minHeight: 84, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10 },
  cancel: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#edf1ee",
  },
  save: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#184d32",
  },
  saveText: { color: "#fff", fontWeight: "800" },
});
