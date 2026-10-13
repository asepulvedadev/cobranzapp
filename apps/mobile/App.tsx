import type {
  BorrowerDirectory,
  CurrentUser,
  PlatformOverview,
  PlatformSystemStatus,
  RouteDirectory,
  TenantMemberProfile,
  TenantOverview,
} from "@cobranzapp/contracts";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MobileApi, MobileApiError } from "./src/api";
import { BorrowerCreateForm } from "./src/BorrowerCreateForm";
import { MemberProfileForm } from "./src/MemberProfileForm";
import { VerificationNetworkCard } from "./src/VerificationNetworkCard";

type Screen =
  | { kind: "loading" }
  | { kind: "signed_out"; notice?: string }
  | { kind: "mfa" }
  | { kind: "authenticated"; user: CurrentUser };

type TenantSection = "home" | "verification";

const roleLabels: Record<
  CurrentUser["memberships"][number]["role"] | TenantOverview["actorRole"],
  string
> = {
  owner: "Propietario",
  supervisor: "Supervisor",
  collector: "Cobrador",
  customer: "Cliente",
  support: "Soporte temporal",
};

function errorText(error: unknown, fallback: string) {
  return error instanceof MobileApiError ? error.message : fallback;
}

function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        (pressed || disabled) && styles.primaryButtonDim,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function LoginScreen({
  api,
  notice,
  onMfaRequired,
  onAuthenticated,
}: {
  api: MobileApi;
  notice?: string;
  onMfaRequired: () => void;
  onAuthenticated: (user: CurrentUser) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api.login(identifier, password);
      if (result.kind === "mfa_required") onMfaRequired();
      else onAuthenticated(result.user);
    } catch (error) {
      setMessage(errorText(error, "No hay conexión con la plataforma."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>c</Text>
        </View>
        <Text style={styles.eyebrow}>COBRANZAPP · COLOMBIA</Text>
        <Text style={styles.heroTitle}>Tu operación, clara desde el celular.</Text>
        <Text style={styles.body}>
          Ingresa con tu usuario o correo para continuar al espacio de trabajo.
        </Text>
        <View style={styles.formCard}>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Text style={styles.label}>Usuario o correo</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="username"
            onChangeText={setIdentifier}
            placeholder="usuario o correo@empresa.com"
            placeholderTextColor="#8b948e"
            style={styles.input}
            value={identifier}
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="current-password"
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            placeholderTextColor="#8b948e"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {message}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={busy || !identifier || !password}
            label={busy ? "Verificando…" : "Ingresar"}
            onPress={() => void submit()}
          />
        </View>
        <Text style={styles.disclaimer}>
          Tus datos viajan por una conexión segura. Nunca compartas tu contraseña.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChangePasswordScreen({ api, onComplete }: { api: MobileApi; onComplete: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (newPassword.length < 12) {
      setMessage("La nueva contraseña debe tener al menos 12 caracteres.");
      return;
    }
    if (newPassword !== confirmation) {
      setMessage("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.changePassword(currentPassword, newPassword);
      onComplete();
    } catch (error) {
      setMessage(errorText(error, "No fue posible actualizar la contraseña."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>c</Text>
        </View>
        <Text style={styles.eyebrow}>PRIMER INGRESO</Text>
        <Text style={styles.heroTitle}>Protege tu cuenta antes de continuar.</Text>
        <Text style={styles.body}>
          La contraseña inicial es temporal. Actualízala para habilitar tu operación en cobranzapp.
        </Text>
        <View style={styles.formCard}>
          <Text style={styles.label}>Contraseña actual</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="current-password"
            onChangeText={setCurrentPassword}
            placeholder="Contraseña temporal"
            placeholderTextColor="#8b948e"
            secureTextEntry
            style={styles.input}
            value={currentPassword}
          />
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={setNewPassword}
            placeholder="Mínimo 12 caracteres"
            placeholderTextColor="#8b948e"
            secureTextEntry
            style={styles.input}
            value={newPassword}
          />
          <Text style={styles.label}>Confirma la nueva contraseña</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            onChangeText={setConfirmation}
            placeholder="Repite la nueva contraseña"
            placeholderTextColor="#8b948e"
            secureTextEntry
            style={styles.input}
            value={confirmation}
          />
          {message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {message}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={busy || !currentPassword || !newPassword || !confirmation}
            label={busy ? "Actualizando…" : "Actualizar contraseña"}
            onPress={() => void submit()}
          />
        </View>
        <Text style={styles.disclaimer}>
          Después de actualizarla tendrás que iniciar sesión de nuevo.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MfaScreen({
  api,
  onAuthenticated,
}: {
  api: MobileApi;
  onAuthenticated: (user: CurrentUser) => void;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      onAuthenticated(await api.verifyMfa(code));
    } catch (error) {
      setMessage(errorText(error, "Código no válido."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.centerCard}>
        <Text style={styles.eyebrow}>VERIFICACIÓN EN DOS PASOS</Text>
        <Text style={styles.sectionTitle}>Confirma que eres tú</Text>
        <Text style={styles.body}>
          Escribe el código de tu aplicación autenticadora o un código de recuperación.
        </Text>
        <TextInput
          autoCapitalize="characters"
          autoComplete="one-time-code"
          keyboardType="number-pad"
          maxLength={32}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor="#8b948e"
          style={[styles.input, styles.codeInput]}
          value={code}
        />
        {message ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {message}
          </Text>
        ) : null}
        <PrimaryButton
          disabled={busy || code.length < 6}
          label={busy ? "Verificando…" : "Verificar"}
          onPress={() => void submit()}
        />
      </View>
    </SafeAreaView>
  );
}

function DeveloperHome({
  overview,
  system,
}: {
  overview: PlatformOverview;
  system: PlatformSystemStatus | null;
}) {
  const metrics = [
    ["Empresas", overview.metrics.tenants],
    ["Activas", overview.metrics.activeTenants],
    ["Usuarios", overview.metrics.users],
    ["Membresías", overview.metrics.activeMemberships],
  ] as const;
  return (
    <View style={styles.stack}>
      <Text style={styles.eyebrow}>CONSOLA DE PLATAFORMA</Text>
      <Text style={styles.sectionTitle}>Buen día, desarrollador.</Text>
      <Text style={styles.body}>
        Supervisa los espacios empresariales desde una vista pensada para el celular.
      </Text>
      <View style={styles.metricGrid}>
        {metrics.map(([label, value]) => (
          <View key={label} style={styles.metric}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <View>
          <Text style={styles.cardTitle}>Plataforma operativa</Text>
          <Text style={styles.muted}>
            {system
              ? `API ${system.api.version === "development" ? "desarrollo" : system.api.version.slice(0, 8)}`
              : "Comprobando estado…"}
          </Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>Empresas recientes</Text>
      {overview.tenants.slice(0, 5).map((tenant) => (
        <View key={tenant.id} style={styles.listRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{tenant.displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.listCopy}>
            <Text style={styles.listTitle}>{tenant.displayName}</Text>
            <Text style={styles.muted}>
              {tenant.status === "active" ? "Activa" : "En configuración"}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      ))}
    </View>
  );
}

function TenantHome({
  api,
  overview,
  memberProfile,
  directory,
  routes,
  directorySearch,
  onDirectoryPageChange,
  onDirectorySearch,
  onBorrowerCreated,
  onNeedsReauthentication,
}: {
  api: MobileApi;
  overview: TenantOverview;
  memberProfile: TenantMemberProfile | null;
  directory: BorrowerDirectory | null;
  routes: RouteDirectory | null;
  directorySearch: string;
  onDirectoryPageChange: (page: number) => void;
  onDirectorySearch: (search: string) => void;
  onBorrowerCreated: () => void;
  onNeedsReauthentication: () => void;
}) {
  const [searchInput, setSearchInput] = useState(directorySearch);
  useEffect(() => setSearchInput(directorySearch), [directorySearch]);
  const metrics = [
    ["Personal", overview.metrics.members],
    ...(directory
      ? [
          ["Clientes activos", directory.borrowerSummary.active] as const,
          ["Clientes archivados", directory.borrowerSummary.archived] as const,
        ]
      : []),
    ...(directory
      ? [
          ["Identidades pendientes", directory.identitySummary.pending] as const,
          ["Identidades revisadas", directory.identitySummary.reviewed] as const,
          ["Identidades rechazadas", directory.identitySummary.rejected] as const,
        ]
      : []),
  ] as const;
  return (
    <View style={styles.stack}>
      <View style={[styles.tenantAccent, { backgroundColor: overview.settings.primaryColor }]} />
      <Text style={styles.eyebrow}>ESPACIO DE TRABAJO</Text>
      <Text style={styles.sectionTitle}>{overview.tenant.displayName}</Text>
      <Text style={styles.body}>
        Sesión como {roleLabels[overview.actorRole]}. Tu información está separada por empresa.
      </Text>
      <View style={styles.metricGrid}>
        {metrics.map(([label, value]) => (
          <View key={label} style={styles.metric}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.boundaryCard}>
        <Text style={styles.cardTitle}>Aislamiento activo</Text>
        <Text style={styles.muted}>
          Solo puedes consultar recursos de {overview.tenant.displayName}. Los módulos de cartera y
          recaudo se habilitarán después de la aprobación legal y contable.
        </Text>
      </View>
      {overview.actorRole !== "customer" && overview.actorRole !== "support" && memberProfile ? (
        <MemberProfileForm
          api={api}
          onNeedsReauthentication={onNeedsReauthentication}
          profile={memberProfile}
          tenantId={overview.tenant.id}
          userId={memberProfile.userId}
        />
      ) : null}
      {overview.actorRole !== "customer" && overview.actorRole !== "support" ? (
        <BorrowerCreateForm
          api={api}
          onCreated={onBorrowerCreated}
          onNeedsReauthentication={onNeedsReauthentication}
          tenantId={overview.tenant.id}
        />
      ) : null}
      {directory ? (
        <>
          <View style={styles.directoryHeading}>
            <Text style={styles.cardTitle}>Clientes</Text>
            <Text style={styles.muted}>
              Página {directory.pagination.page} de {directory.pagination.totalPages}
            </Text>
          </View>
          <View style={styles.directorySearch}>
            <TextInput
              accessibilityLabel="Buscar clientes"
              onChangeText={setSearchInput}
              onSubmitEditing={() => onDirectorySearch(searchInput)}
              placeholder="Nombre o últimos 4 de cédula"
              placeholderTextColor="#77817a"
              returnKeyType="search"
              style={styles.input}
              value={searchInput}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => onDirectorySearch(searchInput)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Buscar</Text>
            </Pressable>
          </View>
          {directory.borrowers.map((borrower) => (
            <View key={borrower.id} style={styles.listRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{borrower.fullName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{borrower.fullName}</Text>
                <Text style={styles.muted}>
                  {borrower.identity.documentType} •••• {borrower.identity.documentLast4} ·{" "}
                  {borrower.identity.verificationState === "reviewed"
                    ? "Identidad revisada"
                    : "Pendiente de revisión"}
                </Text>
              </View>
            </View>
          ))}
          {!directory.borrowers.length ? (
            <Text style={styles.muted}>Aún no hay clientes registrados.</Text>
          ) : null}
          {directory.pagination.totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <Pressable
                accessibilityRole="button"
                disabled={directory.pagination.page <= 1}
                onPress={() => onDirectoryPageChange(directory.pagination.page - 1)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Anterior</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={directory.pagination.page >= directory.pagination.totalPages}
                onPress={() => onDirectoryPageChange(directory.pagination.page + 1)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Siguiente</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      {routes ? (
        <>
          <View style={styles.directoryHeading}>
            <Text style={styles.cardTitle}>Rutas de cobranza</Text>
            <Text style={styles.muted}>{routes.routes.length} configuradas</Text>
          </View>
          {routes.routes.map((route) => (
            <View key={route.id} style={styles.routeCard}>
              <View style={styles.routeCardHeading}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{route.name}</Text>
                  <Text style={styles.muted}>
                    {route.branchName ?? "Sin sede"} · {route.stops.length} parada(s)
                  </Text>
                  <Text style={styles.muted}>
                    {route.assignedCollectorName
                      ? `Cobrador: ${route.assignedCollectorName}`
                      : "Sin cobrador asignado"}
                  </Text>
                </View>
                <Text style={styles.routeStatus}>
                  {route.status === "draft"
                    ? "Borrador"
                    : route.status === "active"
                      ? "Activa"
                      : "Archivada"}
                </Text>
              </View>
              {route.stops.slice(0, 5).map((stop) => (
                <View key={stop.id} style={styles.routeStopRow}>
                  <Text style={styles.routeStopNumber}>{stop.position}</Text>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{stop.borrowerName}</Text>
                    <Text style={styles.muted}>
                      {stop.addressKind === "home" ? "Casa" : "Trabajo"} · {stop.address}
                    </Text>
                  </View>
                </View>
              ))}
              {route.stops.length > 5 ? (
                <Text style={styles.muted}>+{route.stops.length - 5} paradas más</Text>
              ) : null}
            </View>
          ))}
          {!routes.routes.length ? (
            <Text style={styles.muted}>Aún no hay rutas configuradas.</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function TenantSectionNav({
  active,
  onChange,
  canVerify,
}: {
  active: TenantSection;
  onChange: (section: TenantSection) => void;
  canVerify: boolean;
}) {
  return (
    <View style={styles.sectionNav}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange("home")}
        style={[styles.sectionNavItem, active === "home" && styles.sectionNavItemActive]}
      >
        <Text style={[styles.sectionNavText, active === "home" && styles.sectionNavTextActive]}>
          Inicio
        </Text>
      </Pressable>
      {canVerify ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange("verification")}
          style={[styles.sectionNavItem, active === "verification" && styles.sectionNavItemActive]}
        >
          <Text
            style={[
              styles.sectionNavText,
              active === "verification" && styles.sectionNavTextActive,
            ]}
          >
            Verificar cliente
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AuthenticatedHome({
  api,
  onLogout,
  user,
}: {
  api: MobileApi;
  onLogout: () => void;
  user: CurrentUser;
}) {
  const [tenantId, setTenantId] = useState(user.memberships[0]?.tenantId ?? null);
  const [tenant, setTenant] = useState<TenantOverview | null>(null);
  const [memberProfile, setMemberProfile] = useState<TenantMemberProfile | null>(null);
  const [directory, setDirectory] = useState<BorrowerDirectory | null>(null);
  const [routes, setRoutes] = useState<RouteDirectory | null>(null);
  const [platform, setPlatform] = useState<PlatformOverview | null>(null);
  const [system, setSystem] = useState<PlatformSystemStatus | null>(null);
  const [message, setMessage] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthenticating, setReauthenticating] = useState(false);
  const [needsReauthentication, setNeedsReauthentication] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [tenantSection, setTenantSection] = useState<TenantSection>("home");
  const selectedMembershipRole = user.memberships.find(
    (membership) => membership.tenantId === tenantId,
  )?.role;

  useEffect(() => {
    let mounted = true;
    if (reloadKey > 0) setNeedsReauthentication(false);
    const canReadBorrowers = selectedMembershipRole
      ? ["owner", "supervisor", "collector"].includes(selectedMembershipRole)
      : false;
    Promise.all([
      user.platformRole === "developer" ? api.platformOverview() : Promise.resolve(null),
      user.platformRole === "developer" ? api.systemStatus() : Promise.resolve(null),
      tenantId ? api.tenantOverview(tenantId) : Promise.resolve(null),
      tenantId && canReadBorrowers ? api.memberProfile(tenantId, user.id) : Promise.resolve(null),
      tenantId && canReadBorrowers
        ? api.borrowerDirectory(tenantId, { search: directorySearch, page: directoryPage })
        : Promise.resolve(null),
      tenantId && canReadBorrowers ? api.routeDirectory(tenantId) : Promise.resolve(null),
    ])
      .then(
        ([
          platformResult,
          systemResult,
          tenantResult,
          memberProfileResult,
          borrowerResult,
          routeResult,
        ]) => {
          if (!mounted) return;
          setPlatform(platformResult);
          setSystem(systemResult);
          setTenant(tenantResult);
          setMemberProfile(memberProfileResult);
          setDirectory(borrowerResult);
          setRoutes(routeResult);
        },
      )
      .catch((error) => {
        if (!mounted) return;
        if (error instanceof MobileApiError && error.status === 428) {
          setNeedsReauthentication(true);
          setMessage("Confirma tu contraseña para consultar los clientes.");
          return;
        }
        setMessage(errorText(error, "No fue posible cargar el espacio."));
      })
      .finally(() => {
        if (mounted) setRefreshing(false);
      });
    return () => {
      mounted = false;
    };
  }, [
    api,
    directoryPage,
    directorySearch,
    reloadKey,
    selectedMembershipRole,
    tenantId,
    user.id,
    user.platformRole,
  ]);

  async function submitReauthentication() {
    setReauthenticating(true);
    setMessage("");
    try {
      await api.reauthenticate(reauthPassword);
      setReauthPassword("");
      setNeedsReauthentication(false);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setMessage(errorText(error, "No fue posible confirmar tu identidad."));
    } finally {
      setReauthenticating(false);
    }
  }

  function refreshWorkspace() {
    setRefreshing(true);
    setReloadKey((current) => current + 1);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.homeScroll}
        refreshControl={
          <RefreshControl
            colors={["#fbbf24"]}
            onRefresh={refreshWorkspace}
            refreshing={refreshing}
            tintColor="#fbbf24"
          />
        }
      >
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>cobranzapp</Text>
            <Text style={styles.muted}>@{user.username}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logout}>
            <Text style={styles.logoutText}>Salir</Text>
          </Pressable>
        </View>
        {user.mustChangePassword ? (
          <View style={styles.warning}>
            <Text style={styles.cardTitle}>Protege tu cuenta</Text>
            <Text style={styles.muted}>
              Cambia la contraseña inicial desde el panel web antes de operar con datos reales.
            </Text>
          </View>
        ) : null}
        {message ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {message}
          </Text>
        ) : null}
        {needsReauthentication ? (
          <View style={styles.reauthCard}>
            <Text style={styles.cardTitle}>Confirma tu identidad</Text>
            <Text style={styles.muted}>
              Esta consulta protegida requiere tu contraseña actual. La confirmación dura 10
              minutos.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setReauthPassword}
              placeholder="Contraseña actual"
              placeholderTextColor="#8b948e"
              secureTextEntry
              style={styles.input}
              value={reauthPassword}
            />
            <PrimaryButton
              disabled={reauthenticating || reauthPassword.length < 12}
              label={reauthenticating ? "Confirmando…" : "Confirmar y continuar"}
              onPress={() => void submitReauthentication()}
            />
          </View>
        ) : null}
        {user.platformRole === "developer" && platform ? (
          <DeveloperHome overview={platform} system={system} />
        ) : null}
        {user.memberships.length ? (
          <>
            <View style={styles.workspacePicker}>
              <Text style={styles.label}>Espacio de trabajo</Text>
              {user.memberships.map((membership) => (
                <Pressable
                  key={membership.tenantId}
                  onPress={() => {
                    setTenantId(membership.tenantId);
                    setTenantSection("home");
                    setDirectorySearch("");
                    setDirectoryPage(1);
                  }}
                  style={[
                    styles.workspaceOption,
                    membership.tenantId === tenantId && styles.workspaceOptionActive,
                  ]}
                >
                  <View>
                    <Text style={styles.listTitle}>{membership.tenantName}</Text>
                    <Text style={styles.muted}>{roleLabels[membership.role]}</Text>
                  </View>
                  <Text style={styles.radio}>{membership.tenantId === tenantId ? "●" : "○"}</Text>
                </Pressable>
              ))}
            </View>
            {tenant ? (
              <>
                <TenantSectionNav
                  active={tenantSection}
                  canVerify={
                    selectedMembershipRole
                      ? ["owner", "supervisor", "collector"].includes(selectedMembershipRole)
                      : false
                  }
                  onChange={setTenantSection}
                />
                {tenantSection === "verification" ? (
                  <VerificationNetworkCard
                    api={api}
                    onNeedsReauthentication={() => {
                      setNeedsReauthentication(true);
                      setMessage("Confirma tu contraseña para continuar con esta acción.");
                    }}
                    tenantId={tenant.tenant.id}
                  />
                ) : (
                  <TenantHome
                    api={api}
                    directory={directory}
                    directorySearch={directorySearch}
                    memberProfile={memberProfile}
                    onBorrowerCreated={() => setReloadKey((current) => current + 1)}
                    onDirectoryPageChange={setDirectoryPage}
                    onDirectorySearch={(search) => {
                      setDirectorySearch(search);
                      setDirectoryPage(1);
                    }}
                    onNeedsReauthentication={() => {
                      setNeedsReauthentication(true);
                      setMessage("Confirma tu contraseña para continuar con esta acción.");
                    }}
                    overview={tenant}
                    routes={routes}
                  />
                )}
              </>
            ) : (
              <ActivityIndicator color="#fbbf24" />
            )}
          </>
        ) : user.platformRole !== "developer" ? (
          <View style={styles.boundaryCard}>
            <Text style={styles.cardTitle}>Aún no tienes un espacio asignado</Text>
            <Text style={styles.muted}>Acepta una invitación de empresa para comenzar.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const api = useMemo(() => new MobileApi(), []);

  useEffect(() => {
    let mounted = true;
    MobileApi.restore().then(async (restoredApi) => {
      try {
        const user = await restoredApi.me();
        if (mounted) setScreen({ kind: "authenticated", user });
      } catch {
        await restoredApi.clearSession();
        if (mounted) setScreen({ kind: "signed_out" });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (screen.kind === "loading") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ActivityIndicator color="#fbbf24" size="large" />
      </SafeAreaView>
    );
  }
  if (screen.kind === "signed_out") {
    return (
      <LoginScreen
        api={api}
        notice={screen.notice}
        onAuthenticated={(user) => setScreen({ kind: "authenticated", user })}
        onMfaRequired={() => setScreen({ kind: "mfa" })}
      />
    );
  }
  if (screen.kind === "mfa") {
    return (
      <MfaScreen api={api} onAuthenticated={(user) => setScreen({ kind: "authenticated", user })} />
    );
  }
  if (screen.kind === "authenticated" && screen.user.mustChangePassword) {
    return (
      <ChangePasswordScreen
        api={api}
        onComplete={() =>
          setScreen({
            kind: "signed_out",
            notice: "Contraseña actualizada. Inicia sesión nuevamente.",
          })
        }
      />
    );
  }
  return (
    <AuthenticatedHome
      api={api}
      onLogout={() => {
        void api.logout();
        setScreen({ kind: "signed_out" });
      }}
      user={screen.user}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#151817" },
  loginScroll: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  homeScroll: { padding: 20, paddingBottom: 48, gap: 18 },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#fbbf24",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  brandMarkText: { color: "#151817", fontWeight: "900", fontSize: 34 },
  brand: { color: "#f6f7f5", fontWeight: "900", fontSize: 24, letterSpacing: -0.8 },
  eyebrow: {
    color: "#fbbf24",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#f6f7f5",
    fontWeight: "800",
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -1.2,
    maxWidth: 360,
  },
  sectionTitle: {
    color: "#f6f7f5",
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.8,
  },
  body: { color: "#b9c1bb", fontSize: 16, lineHeight: 24 },
  formCard: {
    marginTop: 18,
    backgroundColor: "#202523",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#343b36",
    padding: 18,
    gap: 10,
  },
  label: { color: "#dce2dd", fontSize: 13, fontWeight: "700", marginTop: 4 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#414a44",
    backgroundColor: "#151817",
    color: "#f6f7f5",
    paddingHorizontal: 14,
    fontSize: 16,
  },
  codeInput: { marginTop: 18, textAlign: "center", fontSize: 25, letterSpacing: 6 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#fbbf24",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  primaryButtonDim: { opacity: 0.45 },
  primaryButtonText: { color: "#151817", fontWeight: "800", fontSize: 16 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#48514b",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#f6f7f5", fontWeight: "700", fontSize: 14 },
  error: { color: "#ff9d93", fontSize: 14, lineHeight: 20 },
  notice: {
    color: "#cde8d4",
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1c2a22",
  },
  disclaimer: {
    color: "#77817a",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  centerCard: { margin: 20, padding: 22, borderRadius: 24, backgroundColor: "#202523", gap: 12 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  muted: { color: "#99a39c", fontSize: 14, lineHeight: 20 },
  logout: {
    borderWidth: 1,
    borderColor: "#48514b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  logoutText: { color: "#f6f7f5", fontWeight: "700" },
  stack: { gap: 12 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  metric: {
    width: "47%",
    minHeight: 92,
    borderRadius: 18,
    backgroundColor: "#202523",
    borderWidth: 1,
    borderColor: "#343b36",
    padding: 14,
    justifyContent: "space-between",
  },
  metricValue: { color: "#f6f7f5", fontWeight: "900", fontSize: 27 },
  metricLabel: { color: "#99a39c", fontSize: 13 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#1c2a22",
    borderWidth: 1,
    borderColor: "#31533c",
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#67d391" },
  cardTitle: { color: "#eef2ee", fontWeight: "800", fontSize: 16 },
  listRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2d342f",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#fbbf24",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#151817", fontWeight: "900" },
  listCopy: { flex: 1, gap: 2 },
  listTitle: { color: "#eef2ee", fontWeight: "700", fontSize: 15 },
  chevron: { color: "#8d978f", fontSize: 26 },
  directoryHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  directorySearch: { gap: 8 },
  paginationRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 4 },
  warning: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#3a2f13",
    borderWidth: 1,
    borderColor: "#775f20",
    gap: 4,
  },
  reauthCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#2b2515",
    borderWidth: 1,
    borderColor: "#775f20",
    gap: 8,
  },
  workspacePicker: { gap: 8, marginTop: 6 },
  workspaceOption: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#343b36",
    backgroundColor: "#202523",
  },
  workspaceOptionActive: { borderColor: "#fbbf24", backgroundColor: "#2c2b20" },
  radio: { color: "#fbbf24", fontSize: 20 },
  sectionNav: {
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#343b36",
    paddingBottom: 8,
  },
  sectionNavItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#343b36",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sectionNavItemActive: { borderColor: "#fbbf24", backgroundColor: "#2c2b20" },
  sectionNavText: { color: "#99a39c", fontSize: 13, fontWeight: "700" },
  sectionNavTextActive: { color: "#fbbf24" },
  boundaryCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#202523",
    borderWidth: 1,
    borderColor: "#343b36",
    gap: 6,
  },
  routeCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#202523",
    borderWidth: 1,
    borderColor: "#343b36",
    gap: 9,
  },
  routeCardHeading: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  routeStatus: { color: "#fbbf24", fontSize: 12, fontWeight: "800" },
  routeStopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2d342f",
  },
  routeStopNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#263b55",
    color: "#b7d6ff",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "800",
  },
  tenantAccent: { height: 5, borderRadius: 999, width: 70, marginBottom: 4 },
});
