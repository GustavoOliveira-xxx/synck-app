// Ponto de entrada do app: as rotas do expo-router e, no Android, quem
// desenha os widgets da tela inicial (precisa estar registrado antes, porque
// o Android pode chamá-lo com o app fechado).
import './src/widgets/register';
import 'expo-router/entry';
