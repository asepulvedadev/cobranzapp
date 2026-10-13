import type { Borrower, BorrowerAddressUpdateRequest } from "@cobranzapp/contracts";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { MobileApi } from "./api";
import { MobileApiError } from "./api";

function splitAddress(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { street: value, locality: "" };
  return { street: parts.slice(0, -1).join(", "), locality: parts.at(-1) ?? "" };
}

function composeAddress(street: string, locality: string) {
  return [street.trim(), locality.trim()].filter(Boolean).join(", ");
}

type BorrowerAddressEditorProps = {
  api: MobileApi;
  borrower: Borrower;
  onNeedsReauthentication: () => void;
  onUpdated: () => void;
  tenantId: string;
};

export function BorrowerAddressEditor({
  api,
  borrower,
  onNeedsReauthentication,
  onUpdated,
  tenantId,
}: BorrowerAddressEditorProps) {
  const [open, setOpen] = useState(false);
  const [homeAddress, setHomeAddress] = useState(borrower.homeAddress);
  const [homeAddressLocality, setHomeAddressLocality] = useState("");
  const [workAddress, setWorkAddress] = useState(borrower.workAddress);
  const [workAddressLocality, setWorkAddressLocality] = useState("");
  const [homeConfirmed, setHomeConfirmed] = useState(borrower.homeAddressStatus === "confirmed");
  const [workConfirmed, setWorkConfirmed] = useState(borrower.workAddressStatus === "confirmed");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const home = splitAddress(borrower.homeAddress);
    const work = splitAddress(borrower.workAddress);
    setHomeAddress(home.street);
    setHomeAddressLocality(home.locality);
    setWorkAddress(work.street);
    setWorkAddressLocality(work.locality);
    setHomeConfirmed(borrower.homeAddressStatus === "confirmed");
    setWorkConfirmed(borrower.workAddressStatus === "confirmed");
    setMessage("");
  }, [borrower, open]);

  async function save() {
    if (
      !homeAddress.trim() ||
      !homeAddressLocality.trim() ||
      !workAddress.trim() ||
      !workAddressLocality.trim()
    ) {
      setMessage("Completa la dirección, barrio y municipio de casa y trabajo.");
      return;
    }
    if (!homeConfirmed || !workConfirmed) {
      setMessage("Confirma ambas direcciones con el cliente antes de guardar.");
      return;
    }
    setBusy(true);
    setMessage("");
    const input: BorrowerAddressUpdateRequest = {
      homeAddress: composeAddress(homeAddress, homeAddressLocality),
      workAddress: composeAddress(workAddress, workAddressLocality),
      homeAddressConfirmed: true,
      workAddressConfirmed: true,
    };
    try {
      await api.updateBorrowerAddresses(tenantId, borrower.id, input);
      setMessage("Direcciones guardadas. Ubícalas después para activar Waze.");
      onUpdated();
      setOpen(false);
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña actual para guardar las direcciones.");
      } else {
        setMessage(
          error instanceof MobileApiError
            ? error.message
            : "No fue posible guardar las direcciones.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.editButton}>
        <Text style={styles.editButtonText}>Editar direcciones</Text>
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
        transparent
        visible={open}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.backdrop}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <View style={styles.heading}>
                <View style={styles.headingCopy}>
                  <Text style={styles.eyebrow}>DATOS DE UBICACIÓN</Text>
                  <Text style={styles.title}>Corregir direcciones</Text>
                </View>
                <Pressable
                  disabled={busy}
                  onPress={() => setOpen(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.muted}>
                Guarda la dirección exacta que confirme el cliente. Al cambiarla se borran las
                coordenadas anteriores para evitar enviar al cobrador a un punto incorrecto.
              </Text>
              <Text style={styles.label}>Dirección de casa</Text>
              <TextInput
                autoCapitalize="sentences"
                editable={!busy}
                multiline
                onChangeText={(value) => {
                  setHomeAddress(value);
                  setHomeConfirmed(false);
                }}
                placeholder="Ej. Calle 10 # 20-30, Barrio..."
                placeholderTextColor="#77817a"
                style={styles.textarea}
                value={homeAddress}
              />
              <Text style={styles.label}>Barrio y municipio de casa</Text>
              <TextInput
                autoCapitalize="sentences"
                editable={!busy}
                onChangeText={(value) => {
                  setHomeAddressLocality(value);
                  setHomeConfirmed(false);
                }}
                placeholder="Ej. Barrio Centro, Cúcuta"
                placeholderTextColor="#77817a"
                style={styles.input}
                value={homeAddressLocality}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: homeConfirmed }}
                disabled={busy}
                onPress={() => setHomeConfirmed((checked) => !checked)}
                style={styles.checkRow}
              >
                <Text style={styles.checkbox}>{homeConfirmed ? "☑" : "☐"}</Text>
                <Text style={styles.checkText}>El cliente confirmó esta dirección</Text>
              </Pressable>
              <Text style={styles.label}>Dirección de trabajo</Text>
              <TextInput
                autoCapitalize="sentences"
                editable={!busy}
                multiline
                onChangeText={(value) => {
                  setWorkAddress(value);
                  setWorkConfirmed(false);
                }}
                placeholder="Ej. Carrera 7 # 80-10, Local..."
                placeholderTextColor="#77817a"
                style={styles.textarea}
                value={workAddress}
              />
              <Text style={styles.label}>Barrio y municipio de trabajo</Text>
              <TextInput
                autoCapitalize="sentences"
                editable={!busy}
                onChangeText={(value) => {
                  setWorkAddressLocality(value);
                  setWorkConfirmed(false);
                }}
                placeholder="Ej. Barrio La Playa, Cúcuta"
                placeholderTextColor="#77817a"
                style={styles.input}
                value={workAddressLocality}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: workConfirmed }}
                disabled={busy}
                onPress={() => setWorkConfirmed((checked) => !checked)}
                style={styles.checkRow}
              >
                <Text style={styles.checkbox}>{workConfirmed ? "☑" : "☐"}</Text>
                <Text style={styles.checkText}>El cliente confirmó esta dirección</Text>
              </Pressable>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <Pressable disabled={busy} onPress={() => void save()} style={styles.saveButton}>
                <Text style={styles.saveText}>{busy ? "Guardando…" : "Guardar direcciones"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = {
  editButton: { alignSelf: "flex-start" as const, paddingVertical: 4 },
  editButtonText: { color: "#fbbf24", fontSize: 12, fontWeight: "800" as const },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "flex-end" as const,
    padding: 14,
  },
  card: {
    gap: 10,
    maxHeight: "92%" as const,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#202523",
    borderWidth: 1,
    borderColor: "#3c453e",
  },
  heading: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8 },
  headingCopy: { flex: 1, gap: 4 },
  eyebrow: { color: "#fbbf24", fontSize: 11, fontWeight: "800" as const, letterSpacing: 0.7 },
  title: { color: "#f4f6f4", fontSize: 22, fontWeight: "800" as const },
  closeButton: { paddingHorizontal: 4, paddingVertical: 0 },
  closeText: { color: "#f4f6f4", fontSize: 26, lineHeight: 26 },
  muted: { color: "#99a39c", fontSize: 13, lineHeight: 18 },
  label: { color: "#f4f6f4", fontSize: 13, fontWeight: "700" as const, marginTop: 4 },
  textarea: {
    minHeight: 70,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#465149",
    backgroundColor: "#151817",
    color: "#f4f6f4",
    textAlignVertical: "top" as const,
  },
  input: {
    minHeight: 46,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#465149",
    backgroundColor: "#151817",
    color: "#f4f6f4",
  },
  checkRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  checkbox: { color: "#fbbf24", fontSize: 20 },
  checkText: { flex: 1, color: "#d8ded9", fontSize: 12 },
  message: { color: "#ffbf75", fontSize: 12, lineHeight: 17 },
  saveButton: {
    minHeight: 46,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 12,
    backgroundColor: "#fbbf24",
  },
  saveText: { color: "#171a18", fontSize: 14, fontWeight: "800" as const },
};
