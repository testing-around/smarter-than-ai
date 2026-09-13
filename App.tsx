import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider, useGame } from './src/context/GameContext';
import { FinalScreen } from './src/screens/FinalScreen';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { RoundResultScreen } from './src/screens/RoundResultScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { VoiceCheckScreen } from './src/screens/VoiceCheckScreen';
import { colors } from './src/theme/colors';

function Router() {
  const { screen, hydrated } = useGame();

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.cyan} size="large" />
      </View>
    );
  }

  switch (screen) {
    case 'HOME':
      return <HomeScreen />;
    case 'SETUP':
      return <SetupScreen />;
    case 'VOICE_CHECK':
      return <VoiceCheckScreen />;
    case 'LOBBY':
      return <LobbyScreen />;
    case 'GAME':
      return <GameScreen />;
    case 'ROUND_RESULT':
      return <RoundResultScreen />;
    case 'FINAL':
      return <FinalScreen />;
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style="light" />
        <Router />
      </GameProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
