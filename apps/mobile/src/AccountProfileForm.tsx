import type { UserProfile } from "@cobranzapp/contracts";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import type { MobileApi } from "./api";
import { MobileApiError } from "./api";

type SelectedImage = {
  uri: string;
  name: string;
  type: string;
  file?: Blob;
};

type AccountProfileFormProps = {
  api: MobileApi;
  onNeedsReauthentication: () => void;
  onSaved: (profile: UserProfile) => void;
  profile: UserProfile;
};

function fallbackName(uri: string) {
  const name = uri.split(/[\\/]/).pop();
  return name?.includes(".") ? name : "foto-perfil.jpg";
}

function messageFor(error: unknown, fallback: string) {
  if (error instanceof MobileApiError && error.status === 428) {
    return "Confirma tu contraseña actual para continuar.";
  }
  return error instanceof MobileApiError ? error.message : fallback;
}

export function AccountProfileForm({
  api,
  onNeedsReauthentication,
  onSaved,
  profile,
}: AccountProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [homeAddress, setHomeAddress] = useState(profile.homeAddress ?? "");
  const [workAddress, setWorkAddress] = useState(profile.workAddress ?? "");
  const [photo, setPhoto] = useState<SelectedImage | null>(null);
  const [photoVersion, setPhotoVersion] = useState<string | number | null>(
    profile.profilePhotoObjectKey,
  );
  const [busy, setBusy] = useState<"profile" | "photo" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDisplayName(profile.displayName);
    setPhone(profile.phone ?? "");
    setHomeAddress(profile.homeAddress ?? "");
    setWorkAddress(profile.workAddress ?? "");
    setPhotoVersion(profile.profilePhotoObjectKey);
  }, [profile]);

  async function saveProfile() {
    if (!displayName.trim()) {
      setMessage("Escribe tu nombre completo.");
      return;
    }
    setBusy("profile");
    setMessage("");
    try {
      const updated = await api.updateAccountProfile({
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        homeAddress: homeAddress.trim() || null,
        workAddress: workAddress.trim() || null,
      });
      setMessage("Perfil actualizado.");
      onSaved(updated);
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) onNeedsReauthentication();
      setMessage(messageFor(error, "No fue posible guardar tu perfil."));
    } finally {
      setBusy(null);
    }
  }

  async function choosePhoto() {
    setMessage("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Permite el acceso a tus fotos para seleccionar una imagen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhoto({
      uri: asset.uri,
      name: asset.fileName ?? fallbackName(asset.uri),
      type: asset.mimeType ?? "image/jpeg",
      file: asset.file,
    });
  }

  async function uploadPhoto() {
    if (!photo) {
      setMessage("Selecciona una foto de perfil.");
      return;
    }
    setBusy("photo");
    setMessage("");
    try {
      const updated = await api.uploadAccountProfilePhoto(photo);
      setPhoto(null);
      setPhotoVersion(Date.now());
      setMessage("Foto de perfil guardada en el almacenamiento privado.");
      onSaved(updated);
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) onNeedsReauthentication();
      setMessage(messageFor(error, "No fue posible guardar la foto de perfil."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.stack}>
      {profile.profilePhotoObjectKey ? (
        <Image
          source={api.accountProfilePhotoSource(photoVersion)}
          style={styles.avatar}
          accessibilityLabel="Foto de perfil"
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Pressable
        disabled={busy !== null}
        onPress={() => void choosePhoto()}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>{photo ? "Cambiar selección" : "Elegir foto"}</Text>
      </Pressable>
      {photo ? (
        <Pressable
          disabled={busy !== null}
          onPress={() => void uploadPhoto()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>
            {busy === "photo" ? "Guardando…" : "Guardar foto"}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Nombre completo</Text>
      <TextInput
        autoCapitalize="words"
        editable={busy === null}
        onChangeText={setDisplayName}
        style={styles.input}
        value={displayName}
      />
      <Text style={styles.label}>Celular</Text>
      <TextInput
        editable={busy === null}
        keyboardType="phone-pad"
        onChangeText={setPhone}
        style={styles.input}
        value={phone}
      />
      <Text style={styles.label}>Dirección de casa</Text>
      <TextInput
        editable={busy === null}
        multiline
        onChangeText={setHomeAddress}
        style={styles.textarea}
        value={homeAddress}
      />
      <Text style={styles.label}>Dirección de trabajo</Text>
      <TextInput
        editable={busy === null}
        multiline
        onChangeText={setWorkAddress}
        style={styles.textarea}
        value={workAddress}
      />
      <Pressable
        disabled={busy !== null}
        onPress={() => void saveProfile()}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryText}>
          {busy === "profile" ? "Guardando…" : "Guardar cambios"}
        </Text>
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = {
  stack: { gap: 10 },
  avatar: { width: 92, height: 92, borderRadius: 30, alignSelf: "center" as const },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignSelf: "center" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "#fbbf24",
  },
  avatarText: { color: "#151817", fontWeight: "900" as const, fontSize: 34 },
  label: { color: "#dce2dd", fontSize: 13, fontWeight: "700" as const, marginTop: 4 },
  input: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#414a44",
    backgroundColor: "#151817",
    color: "#f6f7f5",
    paddingHorizontal: 14,
    fontSize: 16,
  },
  textarea: {
    minHeight: 72,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#414a44",
    backgroundColor: "#151817",
    color: "#f6f7f5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "top" as const,
  },
  linkButton: { alignSelf: "center" as const, paddingVertical: 4 },
  linkText: { color: "#fbbf24", fontWeight: "800" as const },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#fbbf24",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 6,
  },
  primaryText: { color: "#151817", fontWeight: "800" as const, fontSize: 15 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#48514b",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondaryText: { color: "#f6f7f5", fontWeight: "700" as const },
  message: { color: "#ffbf75", fontSize: 13, lineHeight: 18 },
};
