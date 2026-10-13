import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { MobileApi } from "./api";
import { MobileApiError } from "./api";

type SelectedImage = {
  uri: string;
  name: string;
  type: string;
  file?: Blob;
};

type BorrowerCreateFormProps = {
  api: MobileApi;
  tenantId: string;
  onCreated: () => void;
  onNeedsReauthentication: () => void;
};

function fileName(uri: string, fallback: string) {
  const lastPart = uri.split(/[\\/]/).pop();
  return lastPart?.includes(".") ? lastPart : fallback;
}

export function BorrowerCreateForm({
  api,
  tenantId,
  onCreated,
  onNeedsReauthentication,
}: BorrowerCreateFormProps) {
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [homeAddressConfirmed, setHomeAddressConfirmed] = useState(false);
  const [workAddressConfirmed, setWorkAddressConfirmed] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRelationship, setContactRelationship] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [secondContact, setSecondContact] = useState(false);
  const [secondContactName, setSecondContactName] = useState("");
  const [secondContactRelationship, setSecondContactRelationship] = useState("");
  const [secondContactPhone, setSecondContactPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [identityFront, setIdentityFront] = useState<SelectedImage | null>(null);
  const [identityBack, setIdentityBack] = useState<SelectedImage | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<SelectedImage | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickImage(setImage: (image: SelectedImage) => void, fallback: string) {
    setMessage("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Permite el acceso a tus fotos para cargar el documento.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImage({
      uri: asset.uri,
      name: asset.fileName ?? fileName(asset.uri, fallback),
      type: asset.mimeType ?? "image/jpeg",
      file: asset.file,
    });
  }

  function missingFields() {
    if (!fullName.trim() || !documentNumber.trim() || !phone.trim() || !whatsappPhone.trim()) {
      return true;
    }
    if (
      !homeAddress.trim() ||
      !workAddress.trim() ||
      !homeAddressConfirmed ||
      !workAddressConfirmed
    ) {
      return true;
    }
    if (!contactName.trim() || !contactRelationship.trim() || !contactPhone.trim()) return true;
    if (
      secondContact &&
      (!secondContactName.trim() || !secondContactRelationship.trim() || !secondContactPhone.trim())
    ) {
      return true;
    }
    return !identityFront || !identityBack || !profilePhoto || !consent;
  }

  async function submit() {
    if (missingFields()) {
      setMessage(
        "Completa celular, WhatsApp, direcciones verificadas, contactos, consentimiento y las tres imágenes.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const borrower = await api.createBorrower(tenantId, {
        fullName: fullName.trim(),
        country: "CO",
        documentType: documentType.trim().toUpperCase(),
        documentNumber: documentNumber.trim(),
        phone: phone.trim(),
        whatsappPhone: whatsappPhone.trim(),
        homeAddress: homeAddress.trim(),
        workAddress: workAddress.trim(),
        homeAddressConfirmed,
        workAddressConfirmed,
        profilePhotoObjectKey: null,
        consentVersion: "borrower-dossier-v1",
        consentEvidenceRef: `mobile-consent-${Date.now()}`,
        emergencyContacts: [
          {
            fullName: contactName.trim(),
            relationship: contactRelationship.trim(),
            phone: contactPhone.trim(),
          },
          ...(secondContact
            ? [
                {
                  fullName: secondContactName.trim(),
                  relationship: secondContactRelationship.trim(),
                  phone: secondContactPhone.trim(),
                },
              ]
            : []),
        ],
        documents: [],
      });
      const uploads = [
        { image: identityFront, category: "identity" as const, side: "front" as const },
        { image: identityBack, category: "identity" as const, side: "back" as const },
        { image: profilePhoto, category: "profile_photo" as const },
      ];
      for (const upload of uploads) {
        if (!upload.image) throw new Error("MISSING_BORROWER_IMAGE");
        await api.uploadBorrowerDocument(tenantId, borrower.id, {
          ...upload.image,
          category: upload.category,
          ...(upload.side ? { side: upload.side } : {}),
        });
      }
      setMessage("Cliente creado. Sus documentos quedaron en revisión humana.");
      setFullName("");
      setDocumentNumber("");
      setPhone("");
      setWhatsappPhone("");
      setHomeAddress("");
      setWorkAddress("");
      setHomeAddressConfirmed(false);
      setWorkAddressConfirmed(false);
      setContactName("");
      setContactRelationship("");
      setContactPhone("");
      setSecondContact(false);
      setSecondContactName("");
      setSecondContactRelationship("");
      setSecondContactPhone("");
      setConsent(false);
      setIdentityFront(null);
      setIdentityBack(null);
      setProfilePhoto(null);
      onCreated();
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña actual para continuar.");
      } else {
        setMessage(
          error instanceof MobileApiError ? error.message : "No fue posible crear el cliente.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Alta rápida de cliente</Text>
      <Text style={styles.help}>
        Captura rápida con OCR asistivo en segundo plano. Las sugerencias requieren revisión humana
        y las imágenes quedan privadas.
      </Text>
      <Text style={styles.label}>Nombre completo</Text>
      <TextInput
        onChangeText={setFullName}
        placeholder="Nombre y apellidos"
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
      <Text style={styles.label}>Celular</Text>
      <TextInput
        keyboardType="phone-pad"
        onChangeText={setPhone}
        placeholder="300 000 0000"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={phone}
      />
      <Text style={styles.label}>WhatsApp</Text>
      <TextInput
        keyboardType="phone-pad"
        onChangeText={setWhatsappPhone}
        placeholder="Número de WhatsApp"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={whatsappPhone}
      />
      <Text style={styles.label}>Dirección de casa</Text>
      <TextInput
        onChangeText={setHomeAddress}
        placeholder="Dirección completa"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={homeAddress}
      />
      <Text style={styles.label}>Dirección de trabajo</Text>
      <TextInput
        onChangeText={setWorkAddress}
        placeholder="Dirección completa"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={workAddress}
      />
      <Pressable
        onPress={() => setHomeAddressConfirmed((current) => !current)}
        style={styles.consentRow}
      >
        <Text style={styles.checkbox}>{homeAddressConfirmed ? "☑" : "☐"}</Text>
        <Text style={styles.consentText}>
          Confirmo que la dirección de casa está completa y fue verificada con el cliente.
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setWorkAddressConfirmed((current) => !current)}
        style={styles.consentRow}
      >
        <Text style={styles.checkbox}>{workAddressConfirmed ? "☑" : "☐"}</Text>
        <Text style={styles.consentText}>
          Confirmo que la dirección de trabajo está completa y fue verificada con el cliente.
        </Text>
      </Pressable>
      <Text style={styles.label}>Contacto de emergencia</Text>
      <TextInput
        onChangeText={setContactName}
        placeholder="Nombre completo"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={contactName}
      />
      <TextInput
        onChangeText={setContactRelationship}
        placeholder="Relación"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={contactRelationship}
      />
      <TextInput
        keyboardType="phone-pad"
        onChangeText={setContactPhone}
        placeholder="Celular"
        placeholderTextColor="#77817a"
        style={styles.input}
        value={contactPhone}
      />
      <Pressable onPress={() => setSecondContact((current) => !current)} style={styles.toggle}>
        <Text style={styles.toggleText}>
          {secondContact ? "− Quitar segundo contacto" : "+ Agregar segundo contacto"}
        </Text>
      </Pressable>
      {secondContact ? (
        <>
          <TextInput
            onChangeText={setSecondContactName}
            placeholder="Segundo contacto · nombre"
            placeholderTextColor="#77817a"
            style={styles.input}
            value={secondContactName}
          />
          <TextInput
            onChangeText={setSecondContactRelationship}
            placeholder="Segundo contacto · relación"
            placeholderTextColor="#77817a"
            style={styles.input}
            value={secondContactRelationship}
          />
          <TextInput
            keyboardType="phone-pad"
            onChangeText={setSecondContactPhone}
            placeholder="Segundo contacto · celular"
            placeholderTextColor="#77817a"
            style={styles.input}
            value={secondContactPhone}
          />
        </>
      ) : null}
      <Text style={styles.label}>Documentos privados</Text>
      <ImageButton
        label={identityFront ? `✓ Frente · ${identityFront.name}` : "Cargar cédula · frente"}
        onPress={() => void pickImage(setIdentityFront, "cedula-frente.jpg")}
      />
      <ImageButton
        label={identityBack ? `✓ Reverso · ${identityBack.name}` : "Cargar cédula · reverso"}
        onPress={() => void pickImage(setIdentityBack, "cedula-reverso.jpg")}
      />
      <ImageButton
        label={profilePhoto ? `✓ Foto · ${profilePhoto.name}` : "Cargar foto designada de perfil"}
        onPress={() => void pickImage(setProfilePhoto, "foto-perfil.jpg")}
      />
      <Pressable onPress={() => setConsent((current) => !current)} style={styles.consentRow}>
        <Text style={styles.checkbox}>{consent ? "☑" : "☐"}</Text>
        <Text style={styles.consentText}>
          Confirmo que el cliente autorizó el registro de sus datos y documentos.
        </Text>
      </Pressable>
      {message ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
      ) : null}
      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[styles.submit, busy && styles.disabled]}
      >
        <Text style={styles.submitText}>{busy ? "Guardando…" : "Crear cliente"}</Text>
      </Pressable>
    </View>
  );
}

function ImageButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.imageButton}>
      <Text style={styles.imageButtonText}>{label}</Text>
    </Pressable>
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
  cardTitle: { color: "#eef2ee", fontWeight: "800" as const, fontSize: 17 },
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
  toggle: { paddingVertical: 6 },
  toggleText: { color: "#fbbf24", fontSize: 14, fontWeight: "700" as const },
  imageButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#48514b",
    justifyContent: "center" as const,
    paddingHorizontal: 12,
  },
  imageButtonText: { color: "#f6f7f5", fontSize: 14, fontWeight: "700" as const },
  consentRow: {
    flexDirection: "row" as const,
    gap: 8,
    alignItems: "flex-start" as const,
    paddingVertical: 5,
  },
  checkbox: { color: "#fbbf24", fontSize: 21, lineHeight: 22 },
  consentText: { flex: 1, color: "#b9c1bb", fontSize: 13, lineHeight: 19 },
  message: { color: "#ffbf75", fontSize: 14, lineHeight: 20 },
  submit: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#fbbf24",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 4,
  },
  submitText: { color: "#151817", fontWeight: "800" as const, fontSize: 16 },
  disabled: { opacity: 0.5 },
};
