import {
  type TenantMemberCreateRequest,
  tenantMemberCreateRequestSchema,
} from "@cobranzapp/contracts";
import { useState } from "react";
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

type CreatedCredentials = TenantMemberCreateRequest & { email: string };

export function EmployeeCreateForm({
  api,
  availableSeats,
  onCreated,
  onNeedsReauthentication,
  tenantId,
}: {
  api: MobileApi;
  availableSeats: number | null;
  onCreated: () => void;
  onNeedsReauthentication: () => void;
  tenantId: string;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"collector" | "supervisor">("collector");
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setDisplayName("");
    setUsername("");
    setPhone("");
    setPassword("");
    setRole("collector");
    setCreated(null);
    setMessage("");
  }

  async function submit() {
    const parsed = tenantMemberCreateRequestSchema.safeParse({
      displayName,
      username: username.toLowerCase(),
      phone,
      password,
      role,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Revisa los datos del empleado.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const member = await api.createMember(tenantId, parsed.data);
      setCreated({ ...parsed.data, email: member.email });
      setMessage("Empleado creado. Entrega estas credenciales por un canal seguro.");
      onCreated();
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña actual para crear el empleado.");
      } else {
        setMessage(
          error instanceof MobileApiError ? error.message : "No fue posible crear el empleado.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.openButton}>
        <Text style={styles.openButtonText}>Crear empleado</Text>
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => (!busy ? reset() : undefined)}
        transparent
        visible={open}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <View style={styles.heading}>
                <View style={styles.headingCopy}>
                  <Text style={styles.eyebrow}>ACCESO OPERATIVO</Text>
                  <Text style={styles.title}>{created ? "Empleado creado" : "Crear empleado"}</Text>
                </View>
                <Pressable disabled={busy} onPress={reset} style={styles.closeButton}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
              {created ? (
                <View style={styles.result}>
                  <Text style={styles.muted}>
                    Guarda estos datos ahora. No se envían por correo.
                  </Text>
                  <Text style={styles.resultLabel}>Usuario</Text>
                  <Text style={styles.resultValue}>{created.username}</Text>
                  <Text style={styles.resultLabel}>Teléfono</Text>
                  <Text style={styles.resultValue}>{created.phone}</Text>
                  <Text style={styles.resultLabel}>Contraseña inicial</Text>
                  <Text selectable style={styles.resultValue}>
                    {created.password}
                  </Text>
                  <Pressable onPress={reset} style={styles.saveButton}>
                    <Text style={styles.saveText}>Cerrar</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.muted}>
                    Crea el acceso con usuario, teléfono y contraseña. El empleado no necesita
                    correo.
                  </Text>
                  {availableSeats !== null ? (
                    <Text style={styles.seats}>
                      {availableSeats} cupo(s) disponibles según el plan.
                    </Text>
                  ) : null}
                  <Text style={styles.label}>Nombre completo</Text>
                  <TextInput
                    editable={!busy}
                    onChangeText={setDisplayName}
                    style={styles.input}
                    value={displayName}
                  />
                  <Text style={styles.label}>Nombre de usuario</Text>
                  <TextInput
                    autoCapitalize="none"
                    editable={!busy}
                    onChangeText={setUsername}
                    placeholder="ej. maria.gomez"
                    placeholderTextColor="#77817a"
                    style={styles.input}
                    value={username}
                  />
                  <Text style={styles.hint}>Minúsculas, números, punto, guion o guion bajo.</Text>
                  <Text style={styles.label}>Teléfono</Text>
                  <TextInput
                    editable={!busy}
                    keyboardType="phone-pad"
                    onChangeText={setPhone}
                    style={styles.input}
                    value={phone}
                  />
                  <Text style={styles.label}>Rol</Text>
                  <View style={styles.choiceRow}>
                    {(["collector", "supervisor"] as const).map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setRole(value)}
                        style={[styles.choice, role === value && styles.choiceActive]}
                      >
                        <Text style={styles.choiceText}>
                          {value === "collector" ? "Cobrador" : "Supervisor"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.label}>Contraseña inicial</Text>
                  <TextInput
                    autoCapitalize="none"
                    editable={!busy}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                  <Text style={styles.hint}>Usa al menos 12 caracteres.</Text>
                  {message ? <Text style={styles.message}>{message}</Text> : null}
                  <Pressable
                    disabled={busy}
                    onPress={() => void submit()}
                    style={styles.saveButton}
                  >
                    <Text style={styles.saveText}>{busy ? "Creando…" : "Crear empleado"}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = {
  openButton: {
    minHeight: 46,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 12,
    backgroundColor: "#fbbf24",
  },
  openButtonText: { color: "#171a18", fontSize: 14, fontWeight: "800" as const },
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
  closeButton: { paddingHorizontal: 4 },
  closeText: { color: "#f4f6f4", fontSize: 26, lineHeight: 26 },
  muted: { color: "#99a39c", fontSize: 13, lineHeight: 18 },
  seats: { color: "#fbbf24", fontSize: 12 },
  label: { color: "#f4f6f4", fontSize: 13, fontWeight: "700" as const, marginTop: 3 },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#465149",
    backgroundColor: "#151817",
    color: "#f4f6f4",
  },
  hint: { color: "#77817a", fontSize: 11 },
  choiceRow: { flexDirection: "row" as const, gap: 8 },
  choice: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center" as const,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#465149",
  },
  choiceActive: { borderColor: "#fbbf24", backgroundColor: "#2c2b20" },
  choiceText: { color: "#d8ded9", fontSize: 13, fontWeight: "700" as const },
  message: { color: "#ffbf75", fontSize: 12, lineHeight: 17 },
  saveButton: {
    minHeight: 46,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 12,
    backgroundColor: "#fbbf24",
    marginTop: 4,
  },
  saveText: { color: "#171a18", fontSize: 14, fontWeight: "800" as const },
  result: { gap: 8 },
  resultLabel: { color: "#99a39c", fontSize: 12, fontWeight: "700" as const, marginTop: 4 },
  resultValue: { color: "#f4f6f4", fontSize: 16, fontWeight: "800" as const },
};
