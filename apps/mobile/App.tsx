import { StatusBar } from "expo-status-bar";
import { Image, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.card}>
        <Image source={require("./assets/icon.png")} style={styles.logo} />
        <Text style={styles.eyebrow}>DEVELOPMENT FOUNDATION</Text>
        <Text style={styles.title}>cobranzapp</Text>
        <Text style={styles.copy}>
          The mobile workspace is ready for the first approved vertical slice.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#171717", padding: 16, justifyContent: "center" },
  card: {
    backgroundColor: "#FFEDD5",
    borderRadius: 24,
    padding: 24,
    minHeight: 420,
    justifyContent: "flex-end",
  },
  logo: { width: 56, height: 56, position: "absolute", top: 24, left: 24 },
  eyebrow: { color: "#92400E", fontWeight: "800", fontSize: 13, marginBottom: 12 },
  title: { color: "#171717", fontWeight: "800", fontSize: 44, letterSpacing: -1.5 },
  copy: { color: "#57534E", fontSize: 18, lineHeight: 27, marginTop: 12 },
});
