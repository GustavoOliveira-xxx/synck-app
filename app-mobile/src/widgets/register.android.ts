// Android: registra quem desenha os widgets da tela inicial.
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './handler';

registerWidgetTaskHandler(widgetTaskHandler);
