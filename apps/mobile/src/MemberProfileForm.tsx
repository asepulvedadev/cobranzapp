import type { TenantMemberProfile } from "@cobranzapp/contracts";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { type MobileApi, MobileApiError } from "./api";

type ContactDraft = { id: string; fullName: string; relationship: string; phone: string };

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function errorText(error: unknown) {
  return error instanceof MobileApiError ? error.message : "No fue posible guardar la ficha.";
}

export function MemberProfileForm({
  api,
  onNeedsReauthentication,
  profile,
  tenantId,
  userId,
}: {
  api: MobileApi;
  onNeedsReauthentication: () => void;
  profile: TenantMemberProfile;
  tenantId: string;
  userId: string;
}) {
  const [documentType, setDocumentType] = useState(profile.documentType ?? "CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [homeAddress, setHomeAddress] = useState(profile.homeAddress ?? "");
  const [workAddress, setWorkAddress] = useState(profile.workAddress ?? "");
  const [bloodType, setBloodType] = useState<TenantMemberProfile["bloodType"]>(profile.bloodType);
  const [bloodConsent, setBloodConsent] = useState(Boolean(profile.bloodTypeConsentVersion));
  const [contacts, setContacts] = useState<ContactDraft[]>(() =>
    profile.emergencyContacts.length
      ? profile.emergencyContacts.map(({ id, fullName, relationship, phone: contactPhone }) => ({
          id,
          fullName,
          relationship,
          phone: contactPhone,
        }))
      : [{ id: "primary", fullName: "", relationship: "", phone: "" }],
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    setDocumentType(profile.documentType ?? "CC");
    setPhone(profile.phone ?? "");
    setHomeAddress(profile.homeAddress ?? "");
    setWorkAddress(profile.workAddress ?? "");
    setBloodType(profile.bloodType);
    setBloodConsent(Boolean(profile.bloodTypeConsentVersion));
  }, [profile]);

  function updateContact(index: number, field: keyof ContactDraft, value: string) {
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [field]: value } : contact,
      ),
    );
  }

  async function save() {
    if (!profile.documentLast4 && documentNumber.trim().length < 4) {
      setMessage("Registra el número de documento del integrante.");
      return;
    }
    if (!phone.trim() || !homeAddress.trim() || !workAddress.trim()) {
      setMessage("Celular y direcciones de casa y trabajo son obligatorios.");
      return;
    }
    const validContacts = contacts.filter(
      (contact) => contact.fullName.trim() || contact.relationship.trim() || contact.phone.trim(),
    );
    if (
      !validContacts.length ||
      validContacts.some((contact) => Object.values(contact).some((value) => !value.trim()))
    ) {
      setMessage("Registra al menos un contacto de emergencia completo.");
      return;
    }
    if (bloodType && !bloodConsent) {
      setMessage("Autoriza guardar el tipo de sangre o elimina ese dato.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.updateMemberProfile(tenantId, userId, {
        country: documentNumber.trim() ? "CO" : null,
        documentType: documentNumber.trim() ? documentType : null,
        documentNumber: documentNumber.trim() || null,
        phone: phone.trim(),
        homeAddress: homeAddress.trim(),
        workAddress: workAddress.trim(),
        profilePhotoObjectKey: profile.profilePhotoObjectKey,
        bloodType: bloodConsent ? bloodType : null,
        bloodTypeConsentVersion: bloodConsent && bloodType ? "staff-profile-v1" : null,
        emergencyContacts: validContacts.map((contact) => ({
          fullName: contact.fullName.trim(),
          relationship: contact.relationship.trim(),
          phone: contact.phone.trim(),
        })),
      });
      setDocumentNumber("");
      setMessage("Ficha operativa guardada.");
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) onNeedsReauthentication();
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto() {
    setPhotoBusy(true);
    setMessage("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("Autoriza el acceso a fotos para elegir tu imagen de perfil.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      await api.uploadMemberProfilePhoto(tenantId, userId, {
        uri: asset.uri,
        name: asset.fileName ?? "perfil.jpg",
        type: asset.mimeType ?? "image/jpeg",
        file: asset.file,
      });
      setMessage("Foto de perfil guardada en almacenamiento privado.");
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) onNeedsReauthentication();
      setMessage(errorText(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function pickIdentityDocument(side: "front" | "back") {
    setPhotoBusy(true);
    setMessage("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("Autoriza el acceso a fotos para cargar el documento.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      await api.uploadMemberIdentityDocument(tenantId, userId, {
        side,
        uri: asset.uri,
        name: asset.fileName ?? `${side}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
        file: asset.file,
      });
      setMessage(`Documento ${side === "front" ? "frontal" : "reverso"} guardado en privado.`);
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) onNeedsReauthentication();
      setMessage(errorText(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>FICHA OPERATIVA</Text>
      <Text style={styles.title}>Tus datos de trabajo</Text>
      <Text style={styles.help}>
        Son datos privados de la empresa. El documento se cifra y solo se muestra con los últimos
        cuatro dígitos.
      </Text>
      <Text style={styles.label}>Tipo de documento</Text>
      <View style={styles.choiceRow}>
        {["CC", "CE", "PPT"].map((value) => (
          <Pressable
            key={value}
            onPress={() => setDocumentType(value)}
            style={[styles.choice, documentType === value && styles.choiceActive]}
          >
            <Text style={styles.choiceText}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        inputMode="numeric"
        onChangeText={setDocumentNumber}
        placeholder={
          profile.documentLast4
            ? `Registrado · •••• ${profile.documentLast4}`
            : "Número de documento"
        }
        placeholderTextColor="#8b948e"
        style={styles.input}
        value={documentNumber}
      />
      <TextInput
        onChangeText={setPhone}
        placeholder="Celular"
        placeholderTextColor="#8b948e"
        style={styles.input}
        value={phone}
      />
      <TextInput
        onChangeText={setHomeAddress}
        placeholder="Dirección de casa"
        placeholderTextColor="#8b948e"
        style={styles.input}
        value={homeAddress}
      />
      <TextInput
        onChangeText={setWorkAddress}
        placeholder="Dirección de trabajo"
        placeholderTextColor="#8b948e"
        style={styles.input}
        value={workAddress}
      />
      <Text style={styles.label}>Tipo de sangre</Text>
      <View style={styles.choiceRow}>
        {bloodTypes.map((value) => (
          <Pressable
            key={value}
            onPress={() => setBloodType(bloodType === value ? null : value)}
            style={[styles.choice, bloodType === value && styles.choiceActive]}
          >
            <Text style={styles.choiceText}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setBloodConsent((current) => !current)} style={styles.consentRow}>
        <Text style={styles.checkbox}>{bloodConsent ? "☑" : "□"}</Text>
        <Text style={styles.help}>Autorizo guardar mi tipo de sangre para atención operativa.</Text>
      </Pressable>
      <Text style={styles.label}>Contacto de emergencia</Text>
      {contacts.map((contact, index) => (
        <View key={contact.id} style={styles.contactBlock}>
          <TextInput
            onChangeText={(value) => updateContact(index, "fullName", value)}
            placeholder="Nombre completo"
            placeholderTextColor="#8b948e"
            style={styles.input}
            value={contact.fullName}
          />
          <TextInput
            onChangeText={(value) => updateContact(index, "relationship", value)}
            placeholder="Relación"
            placeholderTextColor="#8b948e"
            style={styles.input}
            value={contact.relationship}
          />
          <TextInput
            onChangeText={(value) => updateContact(index, "phone", value)}
            placeholder="Celular"
            placeholderTextColor="#8b948e"
            style={styles.input}
            value={contact.phone}
          />
        </View>
      ))}
      {contacts.length < 2 ? (
        <Pressable
          onPress={() =>
            setContacts((current) => [
              ...current,
              { id: `contact-${Date.now()}`, fullName: "", relationship: "", phone: "" },
            ])
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>+ Agregar otro contacto</Text>
        </Pressable>
      ) : null}
      <View style={styles.actionRow}>
        <Pressable disabled={busy} onPress={() => void save()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{busy ? "Guardando…" : "Guardar ficha"}</Text>
        </Pressable>
        <Pressable
          disabled={photoBusy}
          onPress={() => void pickPhoto()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {photoBusy ? "Cargando…" : "Elegir foto de perfil"}
          </Text>
        </Pressable>
        <Pressable
          disabled={photoBusy}
          onPress={() => void pickIdentityDocument("front")}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {profile.identityFrontObjectKey ? "Reemplazar frente" : "Cargar frente"}
          </Text>
        </Pressable>
        <Pressable
          disabled={photoBusy}
          onPress={() => void pickIdentityDocument("back")}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {profile.identityBackObjectKey ? "Reemplazar reverso" : "Cargar reverso"}
          </Text>
        </Pressable>
      </View>
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
    backgroundColor: "#16201b",
    borderColor: "#2c3a32",
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  } as const,
  eyebrow: { color: "#b7d8b4", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 } as const,
  title: { color: "#f4f7f3", fontSize: 21, fontWeight: "800" } as const,
  help: { color: "#aab5ad", fontSize: 13, lineHeight: 19 } as const,
  label: { color: "#e3ebe4", fontSize: 13, fontWeight: "700" } as const,
  input: {
    backgroundColor: "#101713",
    borderColor: "#304238",
    borderRadius: 12,
    borderWidth: 1,
    color: "#f4f7f3",
    minHeight: 46,
    paddingHorizontal: 12,
  } as const,
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as const,
  choice: {
    backgroundColor: "#101713",
    borderColor: "#304238",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  } as const,
  choiceActive: { backgroundColor: "#c7f36b", borderColor: "#c7f36b" } as const,
  choiceText: { color: "#e8f1e8", fontSize: 13, fontWeight: "700" } as const,
  consentRow: { alignItems: "center", flexDirection: "row", gap: 8 } as const,
  checkbox: { color: "#c7f36b", fontSize: 21 } as const,
  contactBlock: { gap: 8 } as const,
  actionRow: { gap: 8, marginTop: 4 } as const,
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#c7f36b",
    borderRadius: 12,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
  } as const,
  primaryButtonText: { color: "#132016", fontSize: 14, fontWeight: "800" } as const,
  secondaryButton: {
    alignItems: "center",
    borderColor: "#4d6656",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
  } as const,
  secondaryButtonText: { color: "#dcebdc", fontSize: 13, fontWeight: "700" } as const,
  message: { color: "#f4c76b", fontSize: 13, lineHeight: 19 } as const,
};
