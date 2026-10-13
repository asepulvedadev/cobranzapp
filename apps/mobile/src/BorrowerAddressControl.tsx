import type { Borrower } from "@cobranzapp/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { MobileApi } from "./api";
import { MobileApiError } from "./api";

type BorrowerAddressControlProps = {
  api: MobileApi;
  borrower: Borrower;
  onNeedsReauthentication: () => void;
  onUpdated: () => void;
  tenantId: string;
};

function statusLabel(status: Borrower["addressLocations"]["home"]["status"]) {
  return status === "ready" ? "Ubicada" : status === "failed" ? "No encontrada" : "Pendiente";
}

export function BorrowerAddressControl({
  api,
  borrower,
  onNeedsReauthentication,
  onUpdated,
  tenantId,
}: BorrowerAddressControlProps) {
  const [busy, setBusy] = useState<"home" | "work" | null>(null);
  const [message, setMessage] = useState("");

  async function geocode(addressKind: "home" | "work") {
    setBusy(addressKind);
    setMessage("");
    try {
      await api.geocodeBorrowerAddress(tenantId, borrower.id, addressKind);
      setMessage(`Dirección de ${addressKind === "home" ? "casa" : "trabajo"} ubicada.`);
      onUpdated();
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña actual para ubicar la dirección.");
      } else {
        setMessage(
          error instanceof MobileApiError ? error.message : "No fue posible ubicar la dirección.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>
          Casa · {statusLabel(borrower.addressLocations.home.status)}
        </Text>
        <Pressable
          disabled={busy !== null}
          onPress={() => void geocode("home")}
          style={styles.action}
        >
          <Text style={styles.actionText}>{busy === "home" ? "Ubicando…" : "Ubicar"}</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>
          Trabajo · {statusLabel(borrower.addressLocations.work.status)}
        </Text>
        <Pressable
          disabled={busy !== null}
          onPress={() => void geocode("work")}
          style={styles.action}
        >
          <Text style={styles.actionText}>{busy === "work" ? "Ubicando…" : "Ubicar"}</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = {
  container: { gap: 4, marginTop: 2 },
  row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  label: { flex: 1, color: "#99a39c", fontSize: 12 },
  action: { paddingHorizontal: 7, paddingVertical: 3 },
  actionText: { color: "#fbbf24", fontSize: 12, fontWeight: "800" as const },
  message: { color: "#ffbf75", fontSize: 12, lineHeight: 17 },
};
