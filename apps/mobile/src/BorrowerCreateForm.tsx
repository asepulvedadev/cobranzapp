import {
  borrowerCreateRequestSchema,
  type IdentityDocumentExtraction,
} from "@cobranzapp/contracts";
import { Contact, ContactField, requestPermissionsAsync } from "expo-contacts";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { MobileApi } from "./api";
import { MobileApiError } from "./api";

type SelectedImage = {
  uri: string;
  name: string;
  type: string;
  file?: Blob;
};

type UploadKey = "identity-front" | "identity-back" | "profile-photo";

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

function composeAddress(street: string, locality: string) {
  return [street.trim(), locality.trim()].filter(Boolean).join(", ");
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
  const [homeAddressLocality, setHomeAddressLocality] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [workAddressLocality, setWorkAddressLocality] = useState("");
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
  const [manualIdentity, setManualIdentity] = useState(false);
  const [registrationType, setRegistrationType] = useState<"new" | "legacy">("new");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [createdBorrowerId, setCreatedBorrowerId] = useState<string | null>(null);
  const [uploadedUploads, setUploadedUploads] = useState<UploadKey[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrExtraction, setOcrExtraction] = useState<IdentityDocumentExtraction | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setStep(1);
    setMessage("");
    setManualIdentity(false);
    setRegistrationType("new");
    setIdentityFront(null);
    setIdentityBack(null);
    setOcrExtraction(null);
  }

  function enableManualIdentity() {
    setManualIdentity(true);
    setIdentityFront(null);
    setIdentityBack(null);
    setOcrExtraction(null);
    setOcrBusy(false);
    setMessage("");
  }

  function useIdentityDocument() {
    setManualIdentity(false);
    setMessage("");
  }

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

  async function captureImage(setImage: (image: SelectedImage) => void, fallback: string) {
    setMessage("");
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage("Permite el acceso a la cámara para escanear el documento.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
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

  async function scanIdentity(front: SelectedImage, back?: SelectedImage | null) {
    setOcrBusy(true);
    setOcrExtraction(null);
    setMessage("Leyendo la cédula…");
    try {
      const extraction = await api.extractIdentityDocument(tenantId, front, back ?? undefined);
      setOcrExtraction(extraction);
      setFullName(extraction.fields.fullName ?? "");
      setDocumentNumber(extraction.fields.documentNumber ?? "");
      if (extraction.fields.documentType) setDocumentType(extraction.fields.documentType);
      setMessage(
        extraction.fields.fullName && extraction.fields.documentNumber
          ? `Lectura completada. Verifica los datos.`
          : "Completa los datos faltantes.",
      );
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Vuelve a intentar la lectura.");
      } else {
        setMessage(
          error instanceof MobileApiError
            ? error.message
            : "No fue posible leer la imagen. Completa los datos manualmente.",
        );
      }
    } finally {
      setOcrBusy(false);
    }
  }

  async function pickDeviceContact() {
    setMessage("");
    if (Platform.OS === "web") {
      setMessage("La agenda del dispositivo solo está disponible en la aplicación móvil.");
      return;
    }
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) {
        setMessage("Permite el acceso a un contacto para cargar su nombre y teléfono.");
        return;
      }
      const contact = await Contact.presentPicker();
      if (!contact) return;
      const details = await contact.getDetails([ContactField.FULL_NAME] as const);
      const phones = await contact.getPhones();
      const selectedPhone = phones.find((item) => item.number?.trim())?.number?.trim();
      const selectedName = details.fullName?.trim();
      if (selectedName) setFullName(selectedName);
      if (selectedPhone) {
        setPhone(selectedPhone);
        setWhatsappPhone(selectedPhone);
      }
      if (!selectedName && !selectedPhone) {
        setMessage("El contacto no tiene nombre ni teléfono guardado.");
      }
    } catch {
      setMessage(
        "No fue posible consultar la agenda. También puedes escribir los datos manualmente.",
      );
    }
  }

  function stepError(stepToValidate: number) {
    if (stepToValidate === 1) {
      if (!fullName.trim()) return "Completa el nombre del cliente.";
      if (registrationType === "new" && !profilePhoto) {
        return "Carga la selfie del cliente.";
      }
      if (
        (registrationType === "legacy" && !documentNumber.trim()) ||
        (registrationType === "new" &&
          !manualIdentity &&
          (!documentNumber.trim() || !identityFront))
      ) {
        return "Carga el frente de la cédula y completa su número.";
      }
    }
    if (stepToValidate === 2) {
      if (!phone.trim() || (registrationType === "new" && !whatsappPhone.trim())) {
        return registrationType === "legacy"
          ? "Completa el teléfono del cliente."
          : "Completa el celular y WhatsApp.";
      }
      if (
        !homeAddress.trim() ||
        !homeAddressLocality.trim() ||
        !workAddress.trim() ||
        !workAddressLocality.trim()
      ) {
        return "Registra la dirección, barrio y municipio de casa y trabajo.";
      }
      if (!homeAddressConfirmed || !workAddressConfirmed) {
        return "Confirma que ambas direcciones fueron verificadas con el cliente.";
      }
    }
    if (stepToValidate === 3) {
      if (
        registrationType === "new" &&
        (!contactName.trim() || !contactRelationship.trim() || !contactPhone.trim())
      ) {
        return "Registra al menos un contacto de emergencia completo.";
      }
      if (
        registrationType === "new" &&
        secondContact &&
        (!secondContactName.trim() ||
          !secondContactRelationship.trim() ||
          !secondContactPhone.trim())
      ) {
        return "Completa los datos del segundo contacto o quítalo.";
      }
      if (registrationType === "new" && !consent) return "Confirma el consentimiento del cliente.";
    }
    return "";
  }

  function missingFields() {
    return [1, 2, 3].some((stepToValidate) => Boolean(stepError(stepToValidate)));
  }

  function nextStep() {
    const error = stepError(step);
    if (error) {
      setMessage(error);
      return;
    }
    setMessage("");
    setStep((current) => Math.min(4, current + 1));
  }

  async function submit() {
    if (missingFields()) {
      setMessage(
        registrationType === "legacy"
          ? "Completa nombre, documento, teléfono y direcciones."
          : manualIdentity
            ? "Completa los datos requeridos y la selfie del cliente."
            : "Completa los datos requeridos, el frente de la cédula y la selfie del cliente.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    let borrowerIdForRetry = createdBorrowerId;
    try {
      let borrower: { id: string };
      if (borrowerIdForRetry) {
        borrower = { id: borrowerIdForRetry };
      } else {
        const payload = {
          fullName: fullName.trim(),
          registrationType,
          country: documentNumber.trim() ? "CO" : null,
          documentType: documentNumber.trim() ? documentType.trim().toUpperCase() : null,
          documentNumber: documentNumber.trim() || null,
          phone: phone.trim(),
          whatsappPhone: whatsappPhone.trim() || null,
          homeAddress: composeAddress(homeAddress, homeAddressLocality),
          workAddress: composeAddress(workAddress, workAddressLocality),
          homeAddressConfirmed,
          workAddressConfirmed,
          profilePhotoObjectKey: null,
          consentVersion: "borrower-dossier-v1",
          consentEvidenceRef:
            registrationType === "legacy"
              ? "legacy-client-registration"
              : `mobile-consent-${Date.now()}`,
          emergencyContacts:
            registrationType === "legacy"
              ? []
              : [
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
        };
        const parsed = borrowerCreateRequestSchema.safeParse(payload);
        if (!parsed.success) {
          setMessage(parsed.error.issues[0]?.message ?? "Revisa los datos del cliente.");
          return;
        }
        borrower = await api.createBorrower(tenantId, parsed.data);
        borrowerIdForRetry = borrower.id;
        setCreatedBorrowerId(borrower.id);
      }
      const uploads = [
        {
          key: "identity-front" as const,
          image: identityFront,
          category: "identity" as const,
          side: "front" as const,
          optional: registrationType === "legacy" || manualIdentity,
        },
        {
          key: "identity-back" as const,
          image: identityBack,
          category: "identity" as const,
          side: "back" as const,
          optional: true,
        },
        {
          key: "profile-photo" as const,
          image: profilePhoto,
          category: "profile_photo" as const,
          optional: registrationType === "new",
        },
      ];
      for (const upload of uploads) {
        if (uploadedUploads.includes(upload.key)) continue;
        if (!upload.image && upload.optional) continue;
        if (!upload.image) throw new Error("MISSING_BORROWER_IMAGE");
        await api.uploadBorrowerDocument(tenantId, borrower.id, {
          ...upload.image,
          category: upload.category,
          ...(upload.side ? { side: upload.side } : {}),
        });
        setUploadedUploads((current) => [...current, upload.key]);
      }
      setMessage("Cliente creado. Sus documentos quedaron guardados de forma privada.");
      setFullName("");
      setDocumentNumber("");
      setPhone("");
      setWhatsappPhone("");
      setHomeAddress("");
      setHomeAddressLocality("");
      setWorkAddress("");
      setWorkAddressLocality("");
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
      setManualIdentity(false);
      setRegistrationType("new");
      setOcrExtraction(null);
      setStep(1);
      setCreatedBorrowerId(null);
      setUploadedUploads([]);
      onCreated();
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 428) {
        onNeedsReauthentication();
        setMessage("Confirma tu contraseña actual para continuar.");
      } else {
        setMessage(
          borrowerIdForRetry
            ? `Cliente creado, pero faltan documentos por guardar. ${
                error instanceof MobileApiError
                  ? error.message
                  : "Reintenta para completar el expediente."
              }`
            : error instanceof MobileApiError
              ? error.message
              : "No fue posible crear el cliente.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clientes</Text>
          <Text style={styles.help}>
            Registra un cliente por pasos. Las direcciones de casa y trabajo deben confirmarse con
            la persona.
          </Text>
          <Pressable
            onPress={() => {
              setMessage("");
              setStep(1);
              setOcrExtraction(null);
              setOpen(true);
            }}
            style={styles.openButton}
          >
            <Text style={styles.openButtonText}>Crear cliente</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal animationType="slide" onRequestClose={close} transparent visible={open}>
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <View style={styles.modalHeader}>
                <Text style={styles.cardTitle}>Alta rápida de cliente</Text>
                <Pressable disabled={busy} onPress={close} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>Cerrar</Text>
                </Pressable>
              </View>
              <Text style={styles.stepIndicator}>Paso {step} de 4</Text>
              <View style={styles.stepTrack}>
                {[1, 2, 3, 4].map((item) => (
                  <View key={item} style={[styles.stepDot, item <= step && styles.stepDotActive]} />
                ))}
              </View>
              <Text style={styles.help}>
                Captura rápida con OCR asistivo. Revisa cada dato antes de guardar; las imágenes y
                las direcciones quedan privadas.
              </Text>

              {step === 1 ? (
                <>
                  <Text style={styles.sectionTitle}>Identidad</Text>
                  <Text style={styles.label}>Tipo de cliente</Text>
                  <View style={styles.registrationChoices}>
                    <Pressable
                      onPress={() => {
                        setRegistrationType("new");
                        setManualIdentity(false);
                      }}
                      style={[
                        styles.registrationChoice,
                        registrationType === "new" && styles.registrationChoiceActive,
                      ]}
                    >
                      <Text style={styles.registrationChoiceText}>Nuevo</Text>
                      <Text style={styles.registrationChoiceHint}>
                        Selfie, cédula y referencias
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRegistrationType("legacy");
                        setManualIdentity(true);
                      }}
                      style={[
                        styles.registrationChoice,
                        registrationType === "legacy" && styles.registrationChoiceActive,
                      ]}
                    >
                      <Text style={styles.registrationChoiceText}>Antiguo</Text>
                      <Text style={styles.registrationChoiceHint}>Solo datos básicos</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.addressHint}>
                    {manualIdentity
                      ? registrationType === "legacy"
                        ? "Cliente antiguo: no se solicitarán fotos ni referencias."
                        : "Registro manual activo: la cédula puede agregarse después desde el perfil."
                      : "Puedes leer la cédula automáticamente o ingresar los datos sin foto."}
                  </Text>
                  {registrationType === "new" ? (
                    <Pressable
                      onPress={manualIdentity ? useIdentityDocument : enableManualIdentity}
                      style={styles.manualIdentityButton}
                    >
                      <Text style={styles.manualIdentityButtonText}>
                        {manualIdentity
                          ? "Usar foto de cédula"
                          : "Registrar datos manualmente (sin foto de cédula)"}
                      </Text>
                    </Pressable>
                  ) : null}
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
                  {registrationType === "new" ? (
                    <Text style={styles.label}>Documentos privados</Text>
                  ) : null}
                  {registrationType === "new" ? (
                    <>
                      <ImageButton
                        label={
                          identityFront
                            ? `✓ Frente · ${identityFront.name}`
                            : manualIdentity
                              ? "Cédula · frente (opcional)"
                              : "Cargar cédula · frente"
                        }
                        onPress={() =>
                          void pickImage((image) => {
                            setIdentityFront(image);
                            void scanIdentity(image, identityBack);
                          }, "cedula-frente.jpg")
                        }
                        onCamera={() =>
                          void captureImage((image) => {
                            setIdentityFront(image);
                            void scanIdentity(image, identityBack);
                          }, "cedula-frente.jpg")
                        }
                      />
                      <ImageButton
                        label={
                          identityBack
                            ? `✓ Reverso · ${identityBack.name}`
                            : "Cargar cédula · reverso opcional"
                        }
                        onPress={() =>
                          void pickImage((image) => {
                            setIdentityBack(image);
                            if (identityFront) void scanIdentity(identityFront, image);
                          }, "cedula-reverso.jpg")
                        }
                        onCamera={() =>
                          void captureImage((image) => {
                            setIdentityBack(image);
                            if (identityFront) void scanIdentity(identityFront, image);
                          }, "cedula-reverso.jpg")
                        }
                      />
                      <ImageButton
                        label={
                          profilePhoto
                            ? `✓ Selfie · ${profilePhoto.name}`
                            : "Cargar selfie obligatoria"
                        }
                        onPress={() => void pickImage(setProfilePhoto, "foto-perfil.jpg")}
                        onCamera={() => void captureImage(setProfilePhoto, "foto-perfil.jpg")}
                      />
                      {ocrBusy ? <Text style={styles.ocrStatus}>Leyendo la cédula…</Text> : null}
                      {ocrExtraction ? (
                        <View style={styles.ocrDetails}>
                          <Text style={styles.ocrTitle}>Todos los datos detectados</Text>
                          {[
                            ["Nombres", ocrExtraction.fields.firstNames],
                            ["Apellidos", ocrExtraction.fields.lastNames],
                            ["Nacionalidad", ocrExtraction.fields.nationality],
                            ["Nacimiento", ocrExtraction.fields.birthDate],
                            ["Lugar de nacimiento", ocrExtraction.fields.birthPlace],
                            ["Sexo", ocrExtraction.fields.sex],
                            ["Estatura", ocrExtraction.fields.height],
                            ["RH", ocrExtraction.fields.bloodType],
                            ["Expedición", ocrExtraction.fields.issueDate],
                            ["Lugar de expedición", ocrExtraction.fields.issuePlace],
                            ["Vencimiento", ocrExtraction.fields.expirationDate],
                            ["Serial", ocrExtraction.fields.serialNumber],
                          ].map(([label, value]) =>
                            value ? (
                              <Text key={label} style={styles.ocrDetailText}>
                                {label}: {value}
                              </Text>
                            ) : null,
                          )}
                          {ocrExtraction.fields.mrzLines.length ? (
                            <Text style={styles.ocrMachineText}>
                              MRZ: {ocrExtraction.fields.mrzLines.join(" / ")}
                            </Text>
                          ) : null}
                          {ocrExtraction.fields.barcodeData ? (
                            <Text style={styles.ocrMachineText}>
                              Código: {ocrExtraction.fields.barcodeData}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Text style={styles.sectionTitle}>Contacto y direcciones</Text>
                  <Pressable onPress={() => void pickDeviceContact()} style={styles.contactButton}>
                    <Text style={styles.contactButtonText}>Usar contacto del dispositivo</Text>
                  </Pressable>
                  <Text style={styles.label}>Celular</Text>
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={setPhone}
                    placeholder="300 000 0000"
                    placeholderTextColor="#77817a"
                    style={styles.input}
                    value={phone}
                  />
                  {registrationType === "new" ? (
                    <>
                      <Text style={styles.label}>WhatsApp</Text>
                      <TextInput
                        keyboardType="phone-pad"
                        onChangeText={setWhatsappPhone}
                        placeholder="Número de WhatsApp"
                        placeholderTextColor="#77817a"
                        style={styles.input}
                        value={whatsappPhone}
                      />
                    </>
                  ) : null}
                  <Text style={styles.label}>Dirección de casa</Text>
                  <TextInput
                    onChangeText={setHomeAddress}
                    placeholder="Calle/carrera y nomenclatura"
                    placeholderTextColor="#77817a"
                    style={styles.input}
                    value={homeAddress}
                  />
                  <Text style={styles.label}>Barrio y municipio de casa</Text>
                  <TextInput
                    onChangeText={setHomeAddressLocality}
                    placeholder="Barrio y municipio"
                    placeholderTextColor="#77817a"
                    style={styles.input}
                    value={homeAddressLocality}
                  />
                  <Pressable
                    onPress={() => setHomeAddressConfirmed((current) => !current)}
                    style={styles.consentRow}
                  >
                    <Text style={styles.checkbox}>{homeAddressConfirmed ? "☑" : "☐"}</Text>
                    <Text style={styles.consentText}>
                      Confirmo que la dirección de casa está completa y fue verificada con el
                      cliente.
                    </Text>
                  </Pressable>
                  <Text style={styles.label}>Dirección de trabajo</Text>
                  <TextInput
                    onChangeText={setWorkAddress}
                    placeholder="Calle/carrera y nomenclatura"
                    placeholderTextColor="#77817a"
                    style={styles.input}
                    value={workAddress}
                  />
                  <Text style={styles.label}>Barrio y municipio de trabajo</Text>
                  <TextInput
                    onChangeText={setWorkAddressLocality}
                    placeholder="Barrio y municipio"
                    placeholderTextColor="#77817a"
                    style={styles.input}
                    value={workAddressLocality}
                  />
                  <Pressable
                    onPress={() => setWorkAddressConfirmed((current) => !current)}
                    style={styles.consentRow}
                  >
                    <Text style={styles.checkbox}>{workAddressConfirmed ? "☑" : "☐"}</Text>
                    <Text style={styles.consentText}>
                      Confirmo que la dirección de trabajo está completa y fue verificada con el
                      cliente.
                    </Text>
                  </Pressable>
                  <Text style={styles.addressHint}>
                    Guarda ambas direcciones tal como las confirmó el cliente. Luego podrás
                    ubicarlas en el mapa para las rutas.
                  </Text>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <Text style={styles.sectionTitle}>
                    {registrationType === "legacy"
                      ? "Registro antiguo"
                      : "Referencias y autorización"}
                  </Text>
                  {registrationType === "legacy" ? (
                    <Text style={styles.addressHint}>
                      No se requieren referencias ni autorización adicional para este registro
                      antiguo.
                    </Text>
                  ) : (
                    <>
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
                      <Pressable
                        onPress={() => setSecondContact((current) => !current)}
                        style={styles.toggle}
                      >
                        <Text style={styles.toggleText}>
                          {secondContact
                            ? "− Quitar segundo contacto"
                            : "+ Agregar segundo contacto"}
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
                      <Pressable
                        onPress={() => setConsent((current) => !current)}
                        style={styles.consentRow}
                      >
                        <Text style={styles.checkbox}>{consent ? "☑" : "☐"}</Text>
                        <Text style={styles.consentText}>
                          Confirmo que el cliente autorizó el registro de sus datos y documentos.
                        </Text>
                      </Pressable>
                    </>
                  )}
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <Text style={styles.sectionTitle}>Revisa antes de guardar</Text>
                  <View style={styles.reviewBox}>
                    <Text style={styles.reviewText}>Cliente: {fullName || "Sin nombre"}</Text>
                    <Text style={styles.reviewText}>
                      Documento:{" "}
                      {documentNumber
                        ? `${documentType.toUpperCase()} ${documentNumber}`
                        : "Pendiente de registrar"}
                    </Text>
                    <Text style={styles.reviewText}>Celular: {phone || "Sin registrar"}</Text>
                    {registrationType === "new" ? (
                      <Text style={styles.reviewText}>
                        WhatsApp: {whatsappPhone || "Sin registrar"}
                      </Text>
                    ) : null}
                    <Text style={styles.reviewText}>
                      Casa: {composeAddress(homeAddress, homeAddressLocality) || "Sin registrar"}
                    </Text>
                    <Text style={styles.reviewText}>
                      Trabajo: {composeAddress(workAddress, workAddressLocality) || "Sin registrar"}
                    </Text>
                    <Text style={styles.reviewText}>
                      {registrationType === "legacy"
                        ? "Registro antiguo: sin referencias ni imágenes"
                        : `Referencias: ${secondContact ? "2" : "1"} · Imágenes: ${identityBack ? "3" : "2"}`}
                    </Text>
                  </View>
                  <Text style={styles.addressHint}>
                    Las direcciones se guardarán con la confirmación del cliente y quedarán listas
                    para geocodificación y rutas.
                  </Text>
                </>
              ) : null}

              {message ? (
                <Text accessibilityRole="alert" style={styles.message}>
                  {message}
                </Text>
              ) : null}
              <View style={styles.stepActions}>
                {step > 1 ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => {
                      setMessage("");
                      setStep((current) => Math.max(1, current - 1));
                    }}
                    style={styles.backButton}
                  >
                    <Text style={styles.backButtonText}>Atrás</Text>
                  </Pressable>
                ) : null}
                {step < 4 ? (
                  <Pressable disabled={busy} onPress={nextStep} style={styles.submit}>
                    <Text style={styles.submitText}>Continuar</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    disabled={busy}
                    onPress={() => void submit()}
                    style={[styles.submit, busy && styles.disabled]}
                  >
                    <Text style={styles.submitText}>{busy ? "Guardando…" : "Crear cliente"}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function ImageButton({
  label,
  onCamera,
  onPress,
}: {
  label: string;
  onCamera: () => void;
  onPress: () => void;
}) {
  return (
    <View style={styles.imageActions}>
      <Pressable onPress={onPress} style={styles.imageButton}>
        <Text style={styles.imageButtonText}>{label}</Text>
      </Pressable>
      <Pressable onPress={onCamera} style={styles.cameraButton}>
        <Text style={styles.cameraButtonText}>Tomar foto</Text>
      </Pressable>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "flex-end" as const,
  },
  modalScroll: { padding: 12, paddingTop: 44 },
  modalHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  },
  closeButton: { paddingHorizontal: 10, paddingVertical: 8 },
  closeButtonText: { color: "#fbbf24", fontWeight: "800" as const, fontSize: 13 },
  stepIndicator: { color: "#fbbf24", fontSize: 12, fontWeight: "800" as const },
  stepTrack: { flexDirection: "row" as const, gap: 6, marginBottom: 2 },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#414a44",
  },
  stepDotActive: { backgroundColor: "#fbbf24" },
  sectionTitle: { color: "#eef2ee", fontWeight: "800" as const, fontSize: 16, marginTop: 4 },
  addressHint: { color: "#99a39c", fontSize: 12, lineHeight: 18 },
  registrationChoices: { flexDirection: "row" as const, gap: 8 },
  registrationChoice: {
    flex: 1,
    minHeight: 58,
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#414a44",
    backgroundColor: "#151817",
  },
  registrationChoiceActive: { borderColor: "#fbbf24", backgroundColor: "#2b2b20" },
  registrationChoiceText: { color: "#eef2ee", fontSize: 13, fontWeight: "800" as const },
  registrationChoiceHint: { color: "#99a39c", fontSize: 10, lineHeight: 14, marginTop: 3 },
  manualIdentityButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c79b28",
    backgroundColor: "#2b2b20",
    justifyContent: "center" as const,
  },
  manualIdentityButtonText: {
    color: "#f7cf63",
    fontSize: 13,
    fontWeight: "800" as const,
    textAlign: "center" as const,
  },
  reviewBox: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#151817",
    borderWidth: 1,
    borderColor: "#414a44",
  },
  reviewText: { color: "#dce2dd", fontSize: 14, lineHeight: 20 },
  openButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#fbbf24",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  openButtonText: { color: "#151817", fontWeight: "800" as const, fontSize: 15 },
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
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#48514b",
    justifyContent: "center" as const,
    paddingHorizontal: 12,
  },
  imageButtonText: { color: "#f6f7f5", fontSize: 14, fontWeight: "700" as const },
  imageActions: { flexDirection: "row" as const, gap: 8, alignItems: "center" as const },
  contactButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fbbf24",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 12,
  },
  contactButtonText: { color: "#fbbf24", fontWeight: "800" as const, fontSize: 13 },
  cameraButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fbbf24",
    justifyContent: "center" as const,
    paddingHorizontal: 10,
  },
  cameraButtonText: { color: "#fbbf24", fontSize: 12, fontWeight: "800" as const },
  ocrStatus: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "700" as const,
    lineHeight: 19,
  },
  ocrDetails: {
    gap: 5,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#355844",
    backgroundColor: "#17241d",
  },
  ocrTitle: { color: "#eef2ee", fontSize: 14, fontWeight: "800" as const },
  ocrDetailText: { color: "#c8d6cc", fontSize: 12, lineHeight: 18 },
  ocrMachineText: { color: "#9eb4a5", fontSize: 10, lineHeight: 15 },
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
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#fbbf24",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 4,
  },
  submitText: { color: "#151817", fontWeight: "800" as const, fontSize: 16 },
  stepActions: { flexDirection: "row" as const, gap: 8, marginTop: 4 },
  backButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#59645c",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  backButtonText: { color: "#dce2dd", fontWeight: "800" as const, fontSize: 15 },
  disabled: { opacity: 0.5 },
};
