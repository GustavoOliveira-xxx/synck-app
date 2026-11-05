// Usado somente no APK x86_64 do teste. O APK distribuído usa o index.js do app.
import {registerRootComponent} from 'expo';
import React,{useEffect,useState} from 'react';
import {Text} from 'react-native';
import {getAllScheduledNotificationsAsync} from 'expo-notifications';
import {configureNotifications,rescheduleReminders} from './src/services/localNotifications';
import {makeEvent} from './src/utils/__tests__/fixtures';
import {expandEvent} from './src/utils/recurrence';
configureNotifications();
function AlarmProbe(){
 const [state,setState]=useState('Preparando');
 useEffect(()=>{(async()=>{
  const start=Date.now()+90000;
  const event=makeEvent({id:'probe',title:'SynCKLockProbe',starts_at:new Date(start).toISOString(),ends_at:new Date(start+60000).toISOString(),my_reminders:[0]});
  const occ=expandEvent(event,new Date(),new Date(start+60001));
  const count=await rescheduleReminders(occ,null,'UTC','24h');
  const pending=await getAllScheduledNotificationsAsync();
  setState(count===1&&pending.some(n=>n.content.title?.includes('SynCKLockProbe'))?'Alarme preparado':'Falha ao agendar');
 })().catch(()=>setState('Falha ao agendar'));},[]);
 return <Text>{state}</Text>;
}
registerRootComponent(AlarmProbe);
