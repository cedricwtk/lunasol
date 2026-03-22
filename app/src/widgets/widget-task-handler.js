import AsyncStorage from '@react-native-async-storage/async-storage';
import { FastingWidget } from './FastingWidget';

const STORAGE_KEY = 'lunasol_active_fast';

export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }) {
  if (widgetAction === 'WIDGET_DELETED') return;

  let fast = null;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) fast = JSON.parse(stored);
  } catch {}

  renderWidget(<FastingWidget fast={fast} />);
}
