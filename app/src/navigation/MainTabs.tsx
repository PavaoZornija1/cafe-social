import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useTranslation } from 'react-i18next';

import AppTabBar from '../components/navigation/AppTabBar';
import ChooseGameScreen from '../screens/ChooseGameScreen';
import FriendsScreen from '../screens/FriendsScreen';
import HomeScreen from '../screens/HomeScreen';
import PartnerVenuesMapScreen from '../screens/PartnerVenuesMapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { MainTabParamList } from './type';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: t('tabs.home') }}
      />
      <Tab.Screen
        name="PlayTab"
        component={ChooseGameScreen}
        options={{ title: t('tabs.play') }}
      />
      <Tab.Screen
        name="VenuesTab"
        component={PartnerVenuesMapScreen}
        options={{ title: t('tabs.venues') }}
      />
      <Tab.Screen
        name="FriendsTab"
        component={FriendsScreen}
        options={{ title: t('tabs.friends') }}
      />
      <Tab.Screen
        name="MeTab"
        component={ProfileScreen}
        options={{ title: t('tabs.me') }}
      />
    </Tab.Navigator>
  );
}
